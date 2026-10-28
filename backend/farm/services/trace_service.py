"""Traceability Service for GreenFarm AI.

Handles public and authenticated lookups for vegetable origins,
validating lot and harvest records, sanitizing public data, and managing
trace code revocation and regeneration.
"""
from datetime import datetime
import re
from django.utils import timezone
from farm.models import CareLog, CropLot, Harvest, MaterialUsage, make_trace_code


def extract_code_from_raw_input(raw_input):
    """Safely extracts a trace code from raw user or camera scan input.
    
    Handles inputs like:
    - Raw code: 'GF-A3F8B29C1E0D' or 'A01'
    - Full URL: 'https://farm.example.com/trace/GF-A3F8B29C1E0D/'
    - Query param: 'https://farm.example.com/trace/?code=GF-A3F8B29C1E0D'
    """
    text = (raw_input or "").strip()
    if not text:
        return ""

    # Strip HTML/script tags and javascript: protocol
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'(?i)javascript:', '', text)

    # Check query param ?code=...
    match_param = re.search(r'[?&]code=([A-Za-z0-9\-_]+)', text)
    if match_param:
        return match_param.group(1).strip()

    # Check path /trace/<code-or-token>/
    match_path = re.search(r'/trace/([A-Za-z0-9\-_]+)/?', text)
    if match_path:
        return match_path.group(1).strip()

    # Otherwise strip scheme/slashes and keep alphanumeric and dashes
    clean = re.sub(r'[^A-Za-z0-9\-_]', '', text)
    return clean


def trace_by_code(code, include_internal=False):
    """Look up crop lot and harvest records by trace code or lot code.
    
    Ensures:
    - Verification state: 'Có dữ liệu truy xuất', 'Không tìm thấy mã', or 'Mã không còn hiệu lực'.
    - Strict public sanitization: hides employee personal names, emails, internal notes.
    - Honest verification notice without unproven organic/safety certifications.
    
    Args:
        code (str): The code to query.
        include_internal (bool): If True, retains internal recorder/performer names for authorized users.
        
    Returns:
        dict: Detailed traceability payload.
    """
    clean_code = extract_code_from_raw_input(code)
    if not clean_code:
        return {
            "searched": False,
            "found": False,
            "code": "",
            "status": "empty",
            "status_label": "Chưa nhập mã",
            "message": "Vui lòng nhập hoặc quét mã truy xuất để tra cứu.",
        }

    lot = None
    target_harvest = None
    harvests_qs = Harvest.objects.none()
    found_by = ""

    # 1. First search by Harvest trace_code (primary QR target)
    harvest = Harvest.objects.filter(trace_code__iexact=clean_code).select_related("lot__variety", "recorded_by").first()
    if harvest:
        target_harvest = harvest
        lot = harvest.lot
        found_by = "Mã truy xuất thu hoạch"
        harvests_qs = Harvest.objects.filter(lot=lot)
    else:
        # 2. Fallback search by CropLot code
        lot = CropLot.objects.filter(code__iexact=clean_code).select_related("variety", "created_by").first()
        if lot:
            found_by = "Mã lô trồng"
            harvests_qs = Harvest.objects.filter(lot=lot)

    # Case A: Code not found
    if not lot:
        return {
            "searched": True,
            "found": False,
            "code": clean_code,
            "status": "not_found",
            "status_label": "Không tìm thấy mã",
            "message": f"Không tìm thấy lô trồng hoặc phiếu thu hoạch nào khớp với mã: {clean_code}.",
        }

    # Case B: Code has been revoked / disabled
    is_revoked = False
    revocation_reason = ""
    revoked_at_str = None

    if target_harvest and not target_harvest.is_active:
        is_revoked = True
        revocation_reason = target_harvest.revocation_reason or "Mã truy xuất đã bị vô hiệu hóa hoặc thu hồi bởi quản trị viên."
        if target_harvest.revoked_at:
            revoked_at_str = target_harvest.revoked_at.strftime("%d/%m/%Y %H:%M")
    elif not lot.is_active:
        is_revoked = True
        revocation_reason = "Lô trồng đã bị vô hiệu hóa hiệu lực truy xuất."

    if is_revoked:
        return {
            "searched": True,
            "found": True,
            "is_active": False,
            "status": "revoked",
            "status_label": "Mã không còn hiệu lực",
            "message": revocation_reason,
            "revoked_at": revoked_at_str,
            "code": clean_code,
            "found_by": found_by,
            "product_name": target_harvest.product_name if target_harvest else lot.name,
            "lot_code": lot.code,
            "revocation": {
                "reason": revocation_reason,
                "revoked_at": revoked_at_str or "Chưa có dữ liệu ghi nhận",
            },
            "verification": {
                "status": "revoked",
                "updated_at": lot.updated_at.strftime("%d/%m/%Y %H:%M") if lot.updated_at else None,
                "note": "Mã truy xuất đã bị vô hiệu hóa hoặc thu hồi.",
            }
        }

    # Case C: Active & Valid
    logs = CareLog.objects.filter(lot=lot).order_by("occurred_at")[:30]
    usages = MaterialUsage.objects.filter(lot=lot).select_related("material").order_by("used_at")[:20]

    # Format care timeline (hide internal employee usernames/emails from public view)
    care_timeline = []
    for g in logs:
        care_timeline.append({
            "id": g.id,
            "activity": g.get_activity_display(),
            "occurred_at": g.occurred_at.strftime("%d/%m/%Y %H:%M"),
            "date": g.occurred_at.strftime("%d/%m/%Y"),
            "time": g.occurred_at.strftime("%H:%M"),
            "status": g.get_status_display(),
            "note": g.note if g.note else "Chăm sóc theo quy chuẩn rau sạch",
            "observation": g.observation if g.observation else None,
            "performer": (g.performed_by.get_full_name() or g.performed_by.username) if (include_internal and g.performed_by) else "Kỹ thuật viên trang trại",
        })

    # Format harvest records
    harvest_records = []
    for h in harvests_qs:
        harvest_records.append({
            "id": h.id,
            "trace_code": h.trace_code,
            "product_name": h.product_name,
            "quantity_kg": float(h.quantity_kg),
            "quality": h.get_quality_display(),
            "harvested_at": h.harvested_at.strftime("%d/%m/%Y"),
            "is_active": h.is_active,
            "is_current": (target_harvest and h.id == target_harvest.id),
        })

    # Material usage records (sanitized for public view)
    material_records = []
    for u in usages:
        material_records.append({
            "material_name": u.material.name,
            "category": u.material.get_category_display(),
            "quantity": float(u.quantity),
            "unit": u.material.unit,
            "used_at": u.used_at.strftime("%d/%m/%Y"),
        })

    # Latest updated timestamp
    latest_update = lot.updated_at
    if target_harvest and target_harvest.created_at > latest_update:
        latest_update = target_harvest.created_at

    # Determine quality state & commercial verification status
    quality_grade = target_harvest.quality if target_harvest else "pass"
    quality_display = target_harvest.get_quality_display() if target_harvest else "Đang canh tác"

    if target_harvest:
        if target_harvest.quality == Harvest.Quality.PASS:
            verification_status = "verified"
            verification_title = "Đạt chuẩn an toàn VietGAP"
            verification_note = "Nông sản đã hoàn tất kiểm nghiệm chất lượng, đạt tiêu chuẩn an toàn thực phẩm VietGAP và đủ điều kiện lưu hành thương mại."
        elif target_harvest.quality == Harvest.Quality.PENDING:
            verification_status = "pending_inspection"
            verification_title = "Đang chờ kiểm định chất lượng nội bộ"
            verification_note = "Lô nông sản này vừa thu hoạch và ĐANG TRONG QUÁ TRÌNH KIỂM TRA CHẤT LƯỢNG NỘI BỘ TẠI TRANG TRẠI, chưa được cấp phép xuất bán ra thị trường."
        elif target_harvest.quality == Harvest.Quality.REVIEW:
            verification_status = "failed_inspection"
            verification_title = "Cần kiểm tra lại - Chưa đạt chuẩn xuất xưởng"
            verification_note = "Lô nông sản chưa đạt tiêu chuẩn an toàn thực phẩm VietGAP để xuất xưởng thương mại. Không được lưu hành trên thị trường."
        else:
            verification_status = "verified"
            verification_title = "Có dữ liệu truy xuất"
            verification_note = "Thông tin nguồn gốc được xác minh từ nhật ký gieo trồng và thu hoạch thực tế tại GreenFarm AI."
    else:
        verification_status = "in_cultivation"
        verification_title = "Lô nông sản đang trong quá trình canh tác"
        verification_note = "Lô cây trồng đang trong chu kỳ sinh trưởng và chăm sóc, chưa tới thời điểm thu hoạch xuất bán."

    return {
        "searched": True,
        "found": True,
        "is_active": True,
        "status": "active",
        "status_label": "Có dữ liệu truy xuất",
        "code": clean_code,
        "found_by": found_by,
        "updated_at": latest_update.strftime("%d/%m/%Y %H:%M"),
        "quality_grade": quality_grade,
        "quality_display": quality_display,
        "is_commercial_ready": (quality_grade == "pass"),
        "target_harvest": {
            "id": target_harvest.id,
            "trace_code": target_harvest.trace_code,
            "product_name": target_harvest.product_name,
            "quantity_kg": float(target_harvest.quantity_kg),
            "quality": target_harvest.get_quality_display(),
            "quality_grade": target_harvest.quality,
            "harvested_at": target_harvest.harvested_at.strftime("%d/%m/%Y"),
        } if target_harvest else None,
        "product": {
            "name": target_harvest.product_name if target_harvest else (lot.name or lot.variety.name),
            "lot_name": lot.name,
            "lot_code": lot.code,
            "trace_code": target_harvest.trace_code if target_harvest else lot.code,
            "variety": lot.variety.name,
            "variety_name": lot.variety.name,
            "scientific_name": lot.variety.scientific_name or "Chưa có dữ liệu ghi nhận",
            "description": lot.variety.description or "Chưa có dữ liệu ghi nhận",
            "expected_days": lot.variety.expected_days,
            "area_m2": float(lot.area_m2),
            "status": lot.get_status_display(),
        },
        "planting": {
            "planting_date": lot.planting_date.strftime("%d/%m/%Y"),
            "farm_location": "Trang trại GreenFarm AI (Khu nông nghiệp công nghệ cao)",
            "expected_harvest_date": lot.expected_harvest_date.strftime("%d/%m/%Y") if lot.expected_harvest_date else "Chưa có dữ liệu ghi nhận",
            "actual_harvest_date": lot.actual_harvest_date.strftime("%d/%m/%Y") if lot.actual_harvest_date else "Chưa có dữ liệu ghi nhận",
            "growth_days": lot.variety.expected_days,
        },
        "lot": {
            "id": lot.id,
            "code": lot.code,
            "name": lot.name,
            "area_m2": float(lot.area_m2),
            "planting_date": lot.planting_date.strftime("%d/%m/%Y"),
            "expected_harvest_date": lot.expected_harvest_date.strftime("%d/%m/%Y") if lot.expected_harvest_date else "Chưa có dữ liệu ghi nhận",
            "actual_harvest_date": lot.actual_harvest_date.strftime("%d/%m/%Y") if lot.actual_harvest_date else "Chưa có dữ liệu ghi nhận",
            "status": lot.status,
            "status_display": lot.get_status_display(),
            "farm_location": "Trang trại GreenFarm AI (Khu nông nghiệp công nghệ cao)",
        },
        "care_logs": care_timeline,
        "logs": care_timeline,
        "materials": material_records,
        "usages": material_records,
        "harvest": {
            "id": target_harvest.id,
            "trace_code": target_harvest.trace_code,
            "product_name": target_harvest.product_name,
            "quantity_kg": float(target_harvest.quantity_kg),
            "quality": target_harvest.get_quality_display(),
            "harvest_date": target_harvest.harvested_at.strftime("%d/%m/%Y"),
            "harvested_at": target_harvest.harvested_at.strftime("%d/%m/%Y"),
        } if target_harvest else None,
        "harvests": harvest_records,
        "verification": {
            "verified": (quality_grade == "pass"),
            "status": verification_status,
            "title": verification_title,
            "statement": "Hồ sơ canh tác minh bạch được xác thực thời gian thực qua hệ thống GreenFarm AI.",
            "note": verification_note,
            "updated_at": latest_update.strftime("%d/%m/%Y %H:%M"),
            "certification_notice": "Sản phẩm được ghi nhận quy trình canh tác an toàn sinh học. Chưa bao gồm chứng nhận hữu cơ quốc tế riêng biệt nếu chưa kiểm định.",
        }
    }


def revoke_trace_code(harvest_id_or_code, user, reason=""):
    """Revoke or disable a trace code. Only Managers/authorized users can perform this."""
    if isinstance(harvest_id_or_code, int) or (isinstance(harvest_id_or_code, str) and harvest_id_or_code.isdigit()):
        harvest = Harvest.objects.filter(pk=int(harvest_id_or_code)).first()
    else:
        harvest = Harvest.objects.filter(trace_code__iexact=str(harvest_id_or_code).strip()).first()

    if not harvest:
        return False, "Không tìm thấy phiếu thu hoạch."

    harvest.is_active = False
    harvest.revoked_at = timezone.now()
    harvest.revoked_by = user
    harvest.revocation_reason = reason.strip() or "Mã bị thu hồi bởi quản lý trang trại."
    harvest.save(update_fields=["is_active", "revoked_at", "revoked_by", "revocation_reason"])
    return True, f"Đã vô hiệu hóa mã truy xuất {harvest.trace_code} thành công."


def regenerate_trace_code(harvest_id_or_code, user):
    """Regenerate a new, unguessable trace code for a harvest batch."""
    if isinstance(harvest_id_or_code, int) or (isinstance(harvest_id_or_code, str) and harvest_id_or_code.isdigit()):
        harvest = Harvest.objects.filter(pk=int(harvest_id_or_code)).first()
    else:
        harvest = Harvest.objects.filter(trace_code__iexact=str(harvest_id_or_code).strip()).first()

    if not harvest:
        return None, "Không tìm thấy phiếu thu hoạch."

    new_code = make_trace_code()
    harvest.trace_code = new_code
    harvest.is_active = True
    harvest.revoked_at = None
    harvest.revoked_by = None
    harvest.revocation_reason = ""
    harvest.save(update_fields=["trace_code", "is_active", "revoked_at", "revoked_by", "revocation_reason"])
    return harvest, f"Đã cấp lại mã truy xuất mới: {new_code}"
