"""Farm Context Retrieval Service (PostgreSQL RAG) for GreenFarm AI Chatbot.

Retrieves actual database records (CropLots, CareLogs, Materials, Harvests,
KnowledgeArticles) with strict role-based access control.
"""
import re
from datetime import timedelta
from decimal import Decimal
from django.db.models import Q
from django.utils import timezone
from farm.models import (
    CropLot,
    CareLog,
    Material,
    MaterialUsage,
    Harvest,
    KnowledgeArticle,
)
from farm.utils.roles import get_user_role


def can_user_access_lot(user, lot):
    """Verify if user has permission to inspect or query the specified crop lot."""
    if not user or not user.is_authenticated or not lot:
        return False
    role = get_user_role(user)
    if role in {"Manager", "Superuser"}:
        return True
    if role == "Technician":
        return True
    if role == "Staff":
        # Staff can access active lots or lots they have worked on
        if lot.status != CropLot.Status.HARVESTED:
            return True
        return CareLog.objects.filter(lot=lot, performed_by=user).exists()
    return False


def get_accessible_lots(user):
    """Return queryset of lots the current user is allowed to access."""
    if not user or not user.is_authenticated:
        return CropLot.objects.none()
    role = get_user_role(user)
    if role in {"Manager", "Superuser", "Technician"}:
        return CropLot.objects.select_related("variety").all()
    # Staff: active lots or lots with logs by this user
    return CropLot.objects.select_related("variety").filter(
        Q(status__in=[
            CropLot.Status.PLANNED,
            CropLot.Status.GROWING,
            CropLot.Status.READY,
        ]) | Q(care_logs__performed_by=user)
    ).distinct()


def retrieve_knowledge_articles(lot=None, question=""):
    """Retrieve relevant KnowledgeArticle records using keyword relevance (PostgreSQL RAG)."""
    qs = KnowledgeArticle.objects.filter(is_active=True).select_related("variety")
    tokens = [t.lower() for t in re.findall(r"[\wÀ-ỹ-]{3,}", question or "") if len(t) >= 3][:15]
    variety_name = (lot.variety.name.lower() if lot and lot.variety else "")

    scored = []
    for doc in qs[:100]:
        score = 0
        doc_text = f"{doc.title} {doc.category} {doc.tags} {doc.content} {doc.variety.name if doc.variety else ''}".lower()
        matched = False
        if variety_name and variety_name in doc_text:
            score += 5
            matched = True

        for token in tokens:
            if token in doc.title.lower():
                score += 3
                matched = True
            elif token in (doc.tags or "").lower():
                score += 2
                matched = True
            elif token in doc_text:
                score += 1
                matched = True

        if matched:
            if doc.is_verified:
                score += 1
            scored.append((score, doc))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [doc for _, doc in scored[:4]]


def retrieve_farm_context(user, lot=None, question=""):
    """Construct grounded context string and structured references metadata.

    Returns:
        dict: {
            "context_text": str (for LLM prompt),
            "references": dict (structured actual data for frontend inspection)
        }
    """
    role = get_user_role(user)
    ref_lot = None
    ref_logs = []
    ref_materials = []
    ref_harvests = []
    ref_articles = []

    text_sections = []

    # 1. SPECIFIC LOT CONTEXT
    if lot:
        ref_lot = {
            "id": lot.id,
            "code": lot.code,
            "name": lot.name,
            "variety": lot.variety.name,
            "status": lot.get_status_display(),
            "status_raw": lot.status,
            "area_m2": float(lot.area_m2),
            "planting_date": lot.planting_date.strftime("%d/%m/%Y"),
            "expected_harvest_date": lot.expected_harvest_date.strftime("%d/%m/%Y") if lot.expected_harvest_date else None,
            "days_growing": (timezone.localdate() - lot.planting_date).days if lot.planting_date else 0,
        }

        exp_harvest_str = lot.expected_harvest_date.strftime("%d/%m/%Y") if lot.expected_harvest_date else "Chưa xác định"
        lot_lines = [
            f"=== THÔNG TIN LÔ TRỒNG [{lot.code} - {lot.name}] ===",
            f"- Giống cây: {lot.variety.name} (Tên khoa học: {lot.variety.scientific_name or 'N/A'})",
            f"- Thời gian sinh trưởng chuẩn: {lot.variety.expected_days} ngày",
            f"- Diện tích: {lot.area_m2} m² | Trạng thái hiện tại: {lot.get_status_display()}",
            f"- Ngày gieo trồng: {lot.planting_date:%d/%m/%Y}",
            f"- Ngày dự kiến thu hoạch: {exp_harvest_str}",
            f"- Ghi chú giống: {lot.variety.care_notes or 'Không có'}",
            f"- Ghi chú lô: {lot.notes or 'Không có'}",
        ]
        text_sections.append("\n".join(lot_lines))

        # Care logs for this lot
        care_logs_qs = CareLog.objects.filter(lot=lot).select_related("performed_by").order_by("-occurred_at")[:10]
        if care_logs_qs.exists():
            log_lines = ["=== NHẬT KÝ CHĂM SÓC GẦN ĐÂY ==="]
            for cl in care_logs_qs:
                ref_logs.append({
                    "id": cl.id,
                    "activity": cl.get_activity_display(),
                    "status": cl.get_status_display(),
                    "occurred_at": cl.occurred_at.strftime("%d/%m/%Y %H:%M"),
                    "note": cl.note,
                    "observation": cl.observation or "",
                    "performed_by": cl.performed_by.get_full_name() or cl.performed_by.username if cl.performed_by else "Hệ thống",
                })
                log_lines.append(
                    f"- {cl.occurred_at:%d/%m/%Y %H:%M}: [{cl.get_activity_display()}] Trạng thái: {cl.get_status_display()} | "
                    f"Ghi chú: {cl.note} | Quan sát: {cl.observation or 'Không có'}"
                )
            text_sections.append("\n".join(log_lines))
        else:
            text_sections.append("=== NHẬT KÝ CHĂM SÓC: Chưa có nhật ký nào được ghi nhận cho lô này. ===")

        # Material usage for this lot
        usages = MaterialUsage.objects.filter(lot=lot).select_related("material").order_by("-used_at")[:6]
        if usages.exists():
            usage_lines = ["=== VẬT TƯ ĐÃ SỬ DỤNG CHO LÔ ==="]
            for u in usages:
                usage_lines.append(f"- {u.used_at:%d/%m/%Y}: {u.material.name} - {u.quantity} {u.material.unit} (Ghi chú: {u.note or 'N/A'})")
            text_sections.append("\n".join(usage_lines))

        # Harvest info if ready or harvested
        harvests = Harvest.objects.filter(lot=lot).order_by("-harvested_at")[:3]
        if harvests.exists():
            h_lines = ["=== DỮ LIỆU THU HOẠCH ==="]
            for h in harvests:
                ref_harvests.append({
                    "trace_code": h.trace_code,
                    "product_name": h.product_name,
                    "quantity_kg": float(h.quantity_kg),
                    "quality": h.get_quality_display(),
                    "harvested_at": h.harvested_at.strftime("%d/%m/%Y"),
                })
                h_lines.append(f"- Tem truy xuất {h.trace_code}: {h.product_name}, {h.quantity_kg} kg, chất lượng: {h.get_quality_display()}, ngày: {h.harvested_at:%d/%m/%Y}")
            text_sections.append("\n".join(h_lines))

    # 2. GENERAL FARM CONTEXT (when no specific lot is selected or question is broad)
    else:
        active_lots = list(CropLot.objects.select_related("variety").exclude(status=CropLot.Status.HARVESTED).order_by("planting_date")[:15])
        pending_tasks = list(CareLog.objects.filter(status=CareLog.Status.TODO).select_related("lot", "lot__variety").order_by("occurred_at")[:10])

        farm_lines = ["=== DANH SÁCH LÔ ĐANG CANH TÁC TRÊN TOÀN TRANG TRẠI ==="]
        if active_lots:
            for l in active_lots:
                days = (timezone.localdate() - l.planting_date).days if l.planting_date else 0
                l_exp_harvest = l.expected_harvest_date.strftime("%d/%m/%Y") if l.expected_harvest_date else "N/A"
                farm_lines.append(
                    f"- Mã lô: {l.code} | Tên: {l.name} | Giống: {l.variety.name} | Trạng thái: {l.get_status_display()} | "
                    f"Gieo: {l.planting_date:%d/%m/%Y} ({days} ngày tuổi) | Thu hoạch dự kiến: {l_exp_harvest}"
                )
        else:
            farm_lines.append("- Hiện không có lô nào đang trong quá trình canh tác.")
        text_sections.append("\n".join(farm_lines))

        if pending_tasks:
            task_lines = ["=== CÔNG VIỆC CHĂM SÓC ĐANG CHỜ THỰC HIỆN (TODO) ==="]
            for pt in pending_tasks:
                task_lines.append(f"- Lô {pt.lot.code}: [{pt.get_activity_display()}] Dự kiến: {pt.occurred_at:%d/%m/%Y %H:%M} | Ghi chú: {pt.note}")
            text_sections.append("\n".join(task_lines))

    # 3. WAREHOUSE / MATERIALS CONTEXT (If relevant to query or user is Manager/Tech)
    q_lower = (question or "").lower()
    needs_materials = any(k in q_lower for k in ["vật tư", "kho", "phân", "thuốc", "hạt giống", "tồn kho", "thiếu"])
    if needs_materials or not lot:
        all_mats = list(Material.objects.all().order_by("category", "name")[:15])
        mat_lines = ["=== TÌNH TRẠNG KHO VẬT TƯ HIỆN TẠI ==="]
        for m in all_mats:
            is_low = m.is_low_stock
            if is_low or needs_materials:
                ref_materials.append({
                    "id": m.id,
                    "name": m.name,
                    "category": m.get_category_display(),
                    "quantity": float(m.quantity),
                    "unit": m.unit,
                    "minimum_quantity": float(m.minimum_quantity),
                    "is_low_stock": is_low,
                })
            status_text = "CẢNH BÁO TỒN THẤP" if is_low else "Đủ tồn kho"
            mat_lines.append(f"- {m.name} ({m.get_category_display()}): Tồn {m.quantity} {m.unit} (Tối thiểu: {m.minimum_quantity} {m.unit}) -> {status_text}")
        text_sections.append("\n".join(mat_lines))

    # 4. KNOWLEDGE ARTICLES (RAG)
    matched_articles = retrieve_knowledge_articles(lot=lot, question=question)
    if matched_articles:
        kb_lines = ["=== TÀI LIỆU KHO TRI THỨC NÔNG NGHIỆP TRUY XUẤT (RAG TỪ POSTGRESQL) ==="]
        for art in matched_articles:
            ref_articles.append({
                "id": art.id,
                "title": art.title,
                "category": art.category,
                "is_verified": art.is_verified,
                "source": art.source,
                "variety": art.variety.name if art.variety else "Chung",
            })
            verify_str = "Đã kiểm chứng bởi chuyên gia" if art.is_verified else "Chưa kiểm chứng (Tham khảo)"
            kb_lines.append(
                f"- [Tài liệu: {art.title} | Chủ đề: {art.category} | Nguồn: {art.source} | {verify_str}]\n"
                f"  Nội dung: {art.content[:700]}"
            )
        text_sections.append("\n".join(kb_lines))
    else:
        text_sections.append("=== KHO TRI THỨC: Không tìm thấy tài liệu cụ thể phù hợp với câu hỏi này. Hãy dựa trên dữ liệu nhật ký và nguyên tắc an toàn chung. ===")

    context_text = "\n\n".join(text_sections)

    references = {
        "lot": ref_lot,
        "care_logs": ref_logs,
        "materials": ref_materials,
        "harvests": ref_harvests,
        "articles": ref_articles,
    }

    return {
        "context_text": context_text,
        "references": references,
    }
