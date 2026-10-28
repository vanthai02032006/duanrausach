from datetime import timedelta
from decimal import Decimal
from functools import wraps
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.conf import settings
from django.contrib.auth.models import Group
from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.core.paginator import Paginator
from .ai_service import generate_advice, PROMPT_VERSION
from .forms import (
    CareLogForm, CropLotForm, CropVarietyForm, FarmUserCreateForm, HarvestForm,
    KnowledgeArticleForm, MaterialForm, MaterialUsageForm, SaleForm,
)
from .models import (
    AIInteraction, CareLog, CropLot, CropVariety, Harvest, KnowledgeArticle,
    Material, MaterialUsage, Sale,
)
from .roles import get_user_role, role_required
from farm.services.trace_service import (
    trace_by_code, extract_code_from_raw_input, revoke_trace_code, regenerate_trace_code,
)
from farm.services.qr_service import (
    build_public_trace_url, generate_qr_data_uri, generate_qr_image, generate_printable_label_png,
)
from django.http import HttpResponse

User = get_user_model()


def _can(user, *roles):
    role = get_user_role(user)
    return role == "Superuser" or role in roles


def _can_edit_log(user, log):
    return _can(user, "Manager", "Technician") or (get_user_role(user) == "Staff" and log.performed_by_id == user.id)


def _lock_expert_verification(form, user):
    # Only the Manager role can mark a knowledge source as expert-verified in this MVP.
    if not _can(user, "Manager"):
        form.fields["is_verified"].disabled = True
        form.fields["is_verified"].help_text = "Chỉ Quản lý được xác nhận tài liệu đã được chuyên gia kiểm chứng."
    return form


@role_required("Manager", "Technician", "Staff")
def dashboard(request):
    today = timezone.localdate()
    lots_qs = CropLot.objects.select_related("variety")
    logs_qs = CareLog.objects.select_related("lot", "performed_by")
    this_month_harvests = Harvest.objects.filter(harvested_at__year=today.year, harvested_at__month=today.month)
    sales = list(Sale.objects.filter(sold_at__year=today.year, sold_at__month=today.month))
    revenue = sum((s.total_price for s in sales), Decimal("0"))
    context = {
        "total_lots": lots_qs.count(),
        "active_lots": lots_qs.filter(status__in=[CropLot.Status.GROWING, CropLot.Status.READY]).count(),
        "total_area": lots_qs.aggregate(v=Sum("area_m2"))["v"] or Decimal("0"),
        "ready_lots": lots_qs.filter(status=CropLot.Status.READY).count(),
        "today_logs": logs_qs.filter(occurred_at__date=today).count(),
        "pending_logs": logs_qs.filter(status=CareLog.Status.TODO).count(),
        "monthly_harvest_kg": this_month_harvests.aggregate(v=Sum("quantity_kg"))["v"] or Decimal("0"),
        "monthly_revenue": revenue,
        "recent_lots": lots_qs[:6],
        "recent_logs": logs_qs[:6],
        "low_stock": Material.objects.filter(quantity__lte=F("minimum_quantity"))[:5],
        "urgent_lots": lots_qs.filter(status=CropLot.Status.READY)[:4],
        "ai_week_count": AIInteraction.objects.filter(created_at__gte=timezone.now() - timedelta(days=7)).count(),
    }
    return render(request, "farm/dashboard.html", context)


@role_required("Manager", "Technician", "Staff")
def lots_list(request):
    qs = CropLot.objects.select_related("variety", "created_by")
    q = request.GET.get("q", "").strip()
    status = request.GET.get("status", "")
    variety = request.GET.get("variety", "")
    if q:
        qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q) | Q(variety__name__icontains=q))
    if status:
        qs = qs.filter(status=status)
    if variety.isdigit():
        qs = qs.filter(variety_id=int(variety))
    page = Paginator(qs, 12).get_page(request.GET.get("page"))
    return render(request, "farm/lots_list.html", {
        "page_obj": page, "q": q, "status_filter": status, "variety_filter": variety,
        "varieties": CropVariety.objects.all(), "status_choices": CropLot.Status.choices,
    })


@role_required("Manager", "Technician")
def lot_create(request):
    form = CropLotForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        obj = form.save(commit=False); obj.created_by = request.user; obj.save()
        messages.success(request, "Đã tạo lô trồng mới."); return redirect("lots")
    return render(request, "farm/form.html", {"form": form, "title": "Thêm lô trồng", "back_url": "lots", "submit_label": "Lưu lô trồng"})


@role_required("Manager", "Technician")
def lot_edit(request, pk):
    obj = get_object_or_404(CropLot, pk=pk)
    form = CropLotForm(request.POST or None, instance=obj)
    if request.method == "POST" and form.is_valid():
        form.save(); messages.success(request, "Đã cập nhật lô trồng."); return redirect("lots")
    return render(request, "farm/form.html", {"form": form, "title": f"Cập nhật lô {obj.code}", "back_url": "lots", "submit_label": "Lưu thay đổi"})


@require_POST
@role_required("Manager")
def lot_delete(request, pk):
    obj = get_object_or_404(CropLot, pk=pk)
    if obj.harvests.exists():
        messages.error(request, "Không thể xóa lô đã có phiếu thu hoạch để bảo toàn truy xuất nguồn gốc.")
    else:
        obj.delete(); messages.success(request, "Đã xóa lô trồng.")
    return redirect("lots")


@role_required("Manager", "Technician", "Staff")
def varieties_list(request):
    q = request.GET.get("q", "").strip()
    qs = CropVariety.objects.all()
    if q: qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
    return render(request, "farm/varieties_list.html", {"varieties": qs, "q": q})


@role_required("Manager")
def variety_create(request):
    form = CropVarietyForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save(); messages.success(request, "Đã thêm giống cây."); return redirect("varieties")
    return render(request, "farm/form.html", {"form": form, "title": "Thêm giống cây", "back_url": "varieties", "submit_label": "Lưu giống cây"})


@role_required("Manager")
def variety_edit(request, pk):
    obj = get_object_or_404(CropVariety, pk=pk); form = CropVarietyForm(request.POST or None, instance=obj)
    if request.method == "POST" and form.is_valid():
        form.save(); messages.success(request, "Đã cập nhật giống cây."); return redirect("varieties")
    return render(request, "farm/form.html", {"form": form, "title": "Sửa giống cây", "back_url": "varieties", "submit_label": "Lưu thay đổi"})


@require_POST
@role_required("Manager")
def variety_delete(request, pk):
    obj = get_object_or_404(CropVariety, pk=pk)
    if obj.lots.exists(): messages.error(request, "Không thể xóa giống cây đang được dùng bởi lô trồng.")
    else: obj.delete(); messages.success(request, "Đã xóa giống cây.")
    return redirect("varieties")


@role_required("Manager", "Technician", "Staff")
def care_list(request):
    qs = CareLog.objects.select_related("lot", "performed_by")
    q = request.GET.get("q", "").strip(); status = request.GET.get("status", "")
    if q: qs = qs.filter(Q(lot__code__icontains=q) | Q(lot__name__icontains=q) | Q(note__icontains=q) | Q(activity__icontains=q))
    if status: qs = qs.filter(status=status)
    if get_user_role(request.user) == "Staff":
        qs = qs.filter(Q(performed_by=request.user) | Q(status=CareLog.Status.TODO))
    return render(request, "farm/care_list.html", {"logs": qs[:150], "q": q, "status_filter": status, "status_choices": CareLog.Status.choices})


@role_required("Manager", "Technician", "Staff")
def care_create(request):
    form = CareLogForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        obj = form.save(commit=False); obj.performed_by = request.user; obj.save()
        messages.success(request, "Đã ghi nhật ký chăm sóc."); return redirect("care")
    return render(request, "farm/form.html", {"form": form, "title": "Ghi nhật ký chăm sóc", "back_url": "care", "submit_label": "Lưu nhật ký"})


@role_required("Manager", "Technician", "Staff")
def care_edit(request, pk):
    obj = get_object_or_404(CareLog, pk=pk)
    if not _can_edit_log(request.user, obj): return HttpResponseForbidden("Bạn không có quyền sửa nhật ký này.")
    form = CareLogForm(request.POST or None, instance=obj)
    if request.method == "POST" and form.is_valid():
        changed = form.save(commit=False); changed.save(); messages.success(request, "Đã cập nhật nhật ký."); return redirect("care")
    return render(request, "farm/form.html", {"form": form, "title": "Cập nhật nhật ký", "back_url": "care", "submit_label": "Lưu thay đổi"})


@require_POST
@role_required("Manager")
def care_delete(request, pk):
    get_object_or_404(CareLog, pk=pk).delete(); messages.success(request, "Đã xóa nhật ký chăm sóc."); return redirect("care")


@role_required("Manager", "Technician", "Staff")
def materials_list(request):
    qs = Material.objects.all(); q = request.GET.get("q", "").strip(); low = request.GET.get("low", "")
    if q: qs = qs.filter(Q(name__icontains=q) | Q(category__icontains=q))
    if low == "1": qs = qs.filter(quantity__lte=F("minimum_quantity"))
    usages = MaterialUsage.objects.select_related("material", "lot", "used_by")[:30]
    return render(request, "farm/materials_list.html", {"materials": qs, "usages": usages, "q": q, "low": low})


@role_required("Manager")
def material_create(request):
    form = MaterialForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save(); messages.success(request, "Đã thêm vật tư."); return redirect("materials")
    return render(request, "farm/form.html", {"form": form, "title": "Thêm vật tư", "back_url": "materials", "submit_label": "Lưu vật tư"})


@role_required("Manager")
def material_edit(request, pk):
    obj = get_object_or_404(Material, pk=pk); form = MaterialForm(request.POST or None, instance=obj)
    if request.method == "POST" and form.is_valid(): form.save(); messages.success(request, "Đã cập nhật vật tư."); return redirect("materials")
    return render(request, "farm/form.html", {"form": form, "title": "Cập nhật vật tư", "back_url": "materials", "submit_label": "Lưu thay đổi"})


@role_required("Manager", "Technician", "Staff")
def material_usage_create(request):
    form = MaterialUsageForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        data = form.cleaned_data
        try:
            with transaction.atomic():
                material = Material.objects.select_for_update().get(pk=data["material"].pk)
                if data["quantity"] > material.quantity:
                    form.add_error("quantity", f"Tồn kho cập nhật hiện chỉ còn {material.quantity} {material.unit}.")
                else:
                    material.quantity -= data["quantity"]; material.save(update_fields=["quantity", "updated_at"])
                    obj = form.save(commit=False); obj.material = material; obj.used_by = request.user; obj.save()
                    messages.success(request, "Đã ghi phiếu sử dụng và trừ tồn kho."); return redirect("materials")
        except Material.DoesNotExist:
            form.add_error("material", "Vật tư không còn tồn tại.")
    return render(request, "farm/form.html", {"form": form, "title": "Ghi nhận sử dụng vật tư", "back_url": "materials", "submit_label": "Ghi nhận sử dụng"})


@role_required("Manager", "Technician", "Staff")
def harvests_list(request):
    qs = Harvest.objects.select_related("lot", "recorded_by"); q = request.GET.get("q", "").strip()
    if q: qs = qs.filter(Q(trace_code__icontains=q) | Q(lot__code__icontains=q) | Q(product_name__icontains=q))
    return render(request, "farm/harvests_list.html", {"harvests": qs[:100], "q": q})


@role_required("Manager", "Technician")
def harvest_create(request):
    form = HarvestForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        obj = form.save(commit=False); obj.recorded_by = request.user
        with transaction.atomic():
            obj.save()
            lot = CropLot.objects.select_for_update().get(pk=obj.lot_id)
            lot.status = CropLot.Status.HARVESTED; lot.actual_harvest_date = obj.harvested_at; lot.save(update_fields=["status", "actual_harvest_date", "updated_at"])
        messages.success(request, f"Đã ghi thu hoạch. Mã truy xuất: {obj.trace_code}"); return redirect("harvests")
    return render(request, "farm/form.html", {"form": form, "title": "Ghi nhận thu hoạch", "back_url": "harvests", "submit_label": "Lưu phiếu thu hoạch"})


@role_required("Manager")
def sales_list(request):
    sales = Sale.objects.select_related("harvest", "harvest__lot", "recorded_by")[:150]
    total = sum((s.total_price for s in sales), Decimal("0"))
    return render(request, "farm/sales_list.html", {"sales": sales, "total_revenue": total})


@role_required("Manager")
def sale_create(request):
    form = SaleForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        obj = form.save(commit=False); obj.recorded_by = request.user; obj.save()
        messages.success(request, "Đã tạo phiếu bán hàng."); return redirect("sales")
    return render(request, "farm/form.html", {"form": form, "title": "Tạo phiếu bán hàng", "back_url": "sales", "submit_label": "Lưu phiếu bán"})


def trace_search(request, code=None):
    """Trang tra cứu và truy xuất nguồn gốc công khai (không yêu cầu đăng nhập).
    Hỗ trợ quét mã QR bằng camera và tra cứu thủ công bằng mã.
    """
    raw_code = code or request.GET.get("code", "")
    clean_code = extract_code_from_raw_input(raw_code)

    trace_data = None
    qr_data_uri = ""
    public_url = ""

    if clean_code:
        trace_data = trace_by_code(clean_code, include_internal=request.user.is_authenticated)
        if trace_data and trace_data.get("found"):
            target_code = trace_data.get("code", clean_code)
            public_url = build_public_trace_url(request, target_code)
            qr_data_uri = generate_qr_data_uri(public_url, format="png", box_size=6)

    # Context objects for template rendering
    lot_obj = None
    harvests_list = []
    logs_list = []
    usages_list = []
    if clean_code:
        lot_obj = CropLot.objects.filter(code__iexact=clean_code).select_related("variety").first()
        if not lot_obj:
            h_obj = Harvest.objects.filter(trace_code__iexact=clean_code).select_related("lot__variety").first()
            if h_obj:
                lot_obj = h_obj.lot
        if lot_obj:
            harvests_list = Harvest.objects.filter(lot=lot_obj).select_related("recorded_by")
            logs_list = CareLog.objects.filter(lot=lot_obj).select_related("performed_by")[:30]
            usages_list = MaterialUsage.objects.filter(lot=lot_obj).select_related("material", "used_by")[:20]

    return render(request, "farm/trace.html", {
        "code": clean_code,
        "searched": bool(clean_code),
        "trace_data": trace_data,
        "qr_data_uri": qr_data_uri,
        "public_url": public_url,
        "lot": lot_obj,
        "found_by": trace_data.get("found_by") if trace_data else "",
        "harvests": harvests_list,
        "logs": logs_list,
        "usages": usages_list,
        "is_manager": request.user.is_authenticated and (get_user_role(request.user) == "Manager" or request.user.is_superuser),
    })


def qr_code_download(request, code):
    """Download or view PNG QR code image."""
    clean_code = extract_code_from_raw_input(code)
    public_url = build_public_trace_url(request, clean_code)
    img_bytes = generate_qr_image(public_url, format="png", box_size=8, border=2)
    response = HttpResponse(img_bytes, content_type="image/png")
    if request.GET.get("download") == "1":
        response["Content-Disposition"] = f'attachment; filename="qr-{clean_code}.png"'
    else:
        response["Content-Disposition"] = f'inline; filename="qr-{clean_code}.png"'
    return response


def qr_label_view(request, code):
    """View or print a dedicated sticker label with QR code."""
    clean_code = extract_code_from_raw_input(code)
    harvest = Harvest.objects.filter(trace_code__iexact=clean_code).select_related("lot__variety").first()
    if not harvest:
        messages.error(request, "Không tìm thấy phiếu thu hoạch để in nhãn.")
        return redirect("trace")

    public_url = build_public_trace_url(request, harvest.trace_code)
    qr_data_uri = generate_qr_data_uri(public_url, format="png", box_size=7)

    return render(request, "farm/label_print.html", {
        "harvest": harvest,
        "qr_data_uri": qr_data_uri,
        "public_url": public_url,
    })


@require_POST
@role_required("Manager")
def trace_revoke_action(request, code):
    """Quản lý vô hiệu hóa tem truy xuất."""
    clean_code = extract_code_from_raw_input(code)
    reason = request.POST.get("reason", "").strip() or "Vô hiệu hóa bởi Quản lý trang trại"
    success, msg = revoke_trace_code(clean_code, request.user, reason=reason)
    if success:
        messages.success(request, msg)
    else:
        messages.error(request, msg)
    return redirect(request.META.get("HTTP_REFERER", "harvests"))


@require_POST
@role_required("Manager")
def trace_regenerate_action(request, code):
    """Quản lý cấp lại mã truy xuất mới cho đợt thu hoạch."""
    clean_code = extract_code_from_raw_input(code)
    harvest, msg = regenerate_trace_code(clean_code, request.user)
    if harvest:
        messages.success(request, msg)
    else:
        messages.error(request, msg)
    return redirect(request.META.get("HTTP_REFERER", "harvests"))


@role_required("Manager", "Technician", "Staff")
def ai_assistant(request):
    role = get_user_role(request.user)
    allowed_tasks = {"schedule", "summary", "inspect", "harvest"} if role in {"Manager", "Technician", "Superuser"} else {"summary", "inspect"}
    tasks = [choice for choice in AIInteraction.Task.choices if choice[0] in allowed_tasks]
    result = None; interaction = None; selected_lot = None
    question = ""; selected_task = tasks[0][0] if tasks else "summary"
    if request.method == "POST":
        selected_task = request.POST.get("task", "summary"); question = request.POST.get("question", "").strip()[:2000]
        if selected_task not in allowed_tasks:
            messages.error(request, "Vai trò của bạn chưa được cấp quyền dùng tác vụ AI này.")
            return redirect("ai_assistant")
        lot_id = request.POST.get("lot", "")
        if lot_id:
            selected_lot = CropLot.objects.filter(pk=lot_id).select_related("variety").first()
        if selected_task != "inspect" and not selected_lot:
            messages.error(request, "Hãy chọn lô trồng để AI có đủ ngữ cảnh.")
        else:
            result = generate_advice(selected_task, selected_lot, question)
            interaction = AIInteraction.objects.create(
                user=request.user, lot=selected_lot, task=selected_task,
                prompt_version=PROMPT_VERSION, model_name=getattr(settings, "GEMINI_MODEL", ""),
                user_question=question, output_text=result["text"], context_sources=result["sources"],
                latency_ms=result["latency_ms"], succeeded=result["ok"], error_category=result["error"],
            )
            if result["ok"]: messages.success(request, "Đã nhận kết quả AI. Hãy kiểm chứng trước khi áp dụng.")
    recent = AIInteraction.objects.select_related("user", "lot").filter(user=request.user)[:8]
    if role in {"Manager", "Superuser"}: recent = AIInteraction.objects.select_related("user", "lot")[:8]
    return render(request, "farm/ai_assistant.html", {
        "lots": CropLot.objects.select_related("variety").all(), "tasks": tasks,
        "selected_task": selected_task, "selected_lot": selected_lot, "question": question,
        "result": result, "interaction": interaction, "recent": recent,
    })


@require_POST
@role_required("Manager", "Technician", "Staff")
def ai_feedback(request, pk):
    interaction = get_object_or_404(AIInteraction, pk=pk)
    if get_user_role(request.user) not in {"Manager", "Superuser"} and interaction.user_id != request.user.id:
        return HttpResponseForbidden("Bạn không có quyền đánh giá phản hồi của người khác.")
    feedback = request.POST.get("feedback")
    if feedback in {AIInteraction.Feedback.HELPFUL, AIInteraction.Feedback.NOT_HELPFUL}:
        interaction.feedback = feedback; interaction.save(update_fields=["feedback"])
        messages.success(request, "Cảm ơn bạn đã phản hồi để cải thiện chất lượng AI.")
    return redirect("ai_assistant")


@role_required("Manager", "Technician")
def knowledge_list(request):
    qs = KnowledgeArticle.objects.select_related("variety", "created_by")
    q = request.GET.get("q", "").strip()
    if q: qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q) | Q(tags__icontains=q))
    return render(request, "farm/knowledge_list.html", {"articles": qs, "q": q})


@role_required("Manager", "Technician")
def knowledge_create(request):
    form = _lock_expert_verification(KnowledgeArticleForm(request.POST or None), request.user)
    if request.method == "POST" and form.is_valid():
        obj = form.save(commit=False); obj.created_by = request.user; obj.save()
        messages.success(request, "Đã thêm tài liệu vào kho tri thức. AI chỉ truy xuất tài liệu đang bật."); return redirect("knowledge")
    return render(request, "farm/form.html", {"form": form, "title": "Thêm tài liệu tri thức", "back_url": "knowledge", "submit_label": "Lưu tài liệu"})


@role_required("Manager", "Technician")
def knowledge_edit(request, pk):
    obj = get_object_or_404(KnowledgeArticle, pk=pk)
    form = _lock_expert_verification(KnowledgeArticleForm(request.POST or None, instance=obj), request.user)
    if request.method == "POST" and form.is_valid(): form.save(); messages.success(request, "Đã cập nhật tài liệu tri thức."); return redirect("knowledge")
    return render(request, "farm/form.html", {"form": form, "title": "Chỉnh sửa tài liệu tri thức", "back_url": "knowledge", "submit_label": "Lưu thay đổi"})


@role_required("Manager", "Technician")
def reports(request):
    today = timezone.localdate()
    month_harvests = Harvest.objects.filter(harvested_at__year=today.year, harvested_at__month=today.month)
    interactions = AIInteraction.objects.all()
    ai_total = interactions.count(); ai_success = interactions.filter(succeeded=True).count()
    feedback_total = interactions.exclude(feedback="").count()
    helpful = interactions.filter(feedback=AIInteraction.Feedback.HELPFUL).count()
    return render(request, "farm/reports.html", {
        "lot_count": CropLot.objects.count(), "area": CropLot.objects.aggregate(v=Sum("area_m2"))["v"] or 0,
        "harvest_kg": month_harvests.aggregate(v=Sum("quantity_kg"))["v"] or 0,
        "material_count": Material.objects.count(), "pending": CareLog.objects.filter(status=CareLog.Status.TODO).count(),
        "ai_total": ai_total, "ai_success_rate": round(ai_success * 100 / ai_total, 1) if ai_total else 0,
        "ai_avg_latency": round(interactions.aggregate(v=Avg("latency_ms"))["v"] or 0),
        "feedback_total": feedback_total, "helpful_rate": round(helpful * 100 / feedback_total, 1) if feedback_total else 0,
        "recent_ai": interactions.select_related("user", "lot")[:10],
    })


@role_required("Manager")
def ai_monitor(request):
    interactions = AIInteraction.objects.select_related("user", "lot")
    total = interactions.count(); success = interactions.filter(succeeded=True).count()
    return render(request, "farm/ai_monitor.html", {
        "interactions": interactions[:100], "total": total,
        "success_rate": round(success * 100 / total, 1) if total else 0,
        "avg_latency": round(interactions.aggregate(v=Avg("latency_ms"))["v"] or 0),
        "feedback_count": interactions.exclude(feedback="").count(),
        "prompt_version": PROMPT_VERSION,
    })


@role_required("Manager")
def accounts_list(request):
    users = User.objects.prefetch_related("groups").order_by("username")
    q = request.GET.get("q", "").strip()
    if q: users = users.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(email__icontains=q))
    return render(request, "farm/accounts_list.html", {"users": users, "q": q, "roles": [("Manager", "Quản lý"), ("Technician", "Kỹ thuật viên"), ("Staff", "Nhân viên")]})


@role_required("Manager")
def account_create(request):
    form = FarmUserCreateForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save(); messages.success(request, f"Đã tạo tài khoản {user.username} với vai trò đã chọn."); return redirect("accounts")
    return render(request, "farm/form.html", {"form": form, "title": "Tạo tài khoản", "back_url": "accounts", "submit_label": "Tạo tài khoản"})


@require_POST
@role_required("Manager")
def account_set_role(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        messages.error(request, "Không đổi vai trò của chính tài khoản đang đăng nhập tại màn hình này.")
    else:
        role = request.POST.get("role")
        if role in {"Manager", "Technician", "Staff"}:
            user.groups.clear(); user.groups.add(Group.objects.get(name=role))
            messages.success(request, f"Đã cập nhật vai trò cho {user.username}.")
    return redirect("accounts")


@require_POST
@role_required("Manager")
def account_toggle(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        messages.error(request, "Không thể tự khóa tài khoản đang sử dụng.")
    elif user.is_superuser:
        messages.error(request, "Không thể khóa tài khoản superuser tại đây.")
    else:
        user.is_active = not user.is_active; user.save(update_fields=["is_active"])
        messages.success(request, f"Đã {'mở khóa' if user.is_active else 'khóa'} tài khoản {user.username}.")
    return redirect("accounts")


def health(request):
    return JsonResponse({"status": "ok", "service": "GreenFarm AI", "framework": "Django"})
