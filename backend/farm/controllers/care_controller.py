from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from farm.models import CareLog, CropLot
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import get_user_role, role_required


def serialize_care_log(g):
    return {
        "id": g.id,
        "lot_id": g.lot_id,
        "lot_code": g.lot.code,
        "lot_name": g.lot.name,
        "activity": g.activity,
        "activity_display": g.get_activity_display(),
        "occurred_at": g.occurred_at.strftime("%Y-%m-%d %H:%M"),
        "status": g.status,
        "status_display": g.get_status_display(),
        "note": g.note,
        "observation": g.observation,
        "performed_by": g.performed_by.username if g.performed_by else "Hệ thống",
        "performed_by_id": g.performed_by_id,
    }


@require_GET
@role_required("Manager", "Technician", "Staff")
def care_list_view(request):
    qs = CareLog.objects.select_related("lot", "performed_by")
    q = request.GET.get("q", "").strip()
    status = request.GET.get("status", "").strip()
    lot_id = request.GET.get("lot_id", "").strip()

    if q:
        qs = qs.filter(Q(lot__code__icontains=q) | Q(lot__name__icontains=q) | Q(note__icontains=q) | Q(activity__icontains=q))
    if status:
        qs = qs.filter(status=status)
    if lot_id and lot_id.isdigit():
        qs = qs.filter(lot_id=int(lot_id))

    role = get_user_role(request.user)
    if role == "Staff":
        qs = qs.filter(Q(performed_by=request.user) | Q(status=CareLog.Status.TODO))

    return api_response([serialize_care_log(g) for g in qs[:150]])


@require_POST
@role_required("Manager", "Technician", "Staff")
def care_create_view(request):
    data = parse_body(request)
    lot_id = data.get("lot_id")
    activity = data.get("activity")
    note = data.get("note", "").strip()
    observation = data.get("observation", "").strip()
    status = data.get("status", CareLog.Status.DONE)
    occurred_at = data.get("occurred_at")

    role = get_user_role(request.user)
    if status == CareLog.Status.TODO and role not in {"Manager", "Technician", "Superuser"}:
        return api_response(message="Nhân viên chỉ có quyền xem lịch chăm sóc, không được tạo lịch mới.", success=False, status=403)

    if not lot_id or not activity or not note:
        return api_response(message="Vui lòng chọn lô trồng, loại hoạt động và nội dung ghi chú.", success=False, status=400)

    try:
        lot = CropLot.objects.get(pk=lot_id)
    except CropLot.DoesNotExist:
        return api_response(message="Lô trồng không tồn tại.", success=False, status=400)

    log = CareLog.objects.create(
        lot=lot,
        activity=activity,
        note=note,
        observation=observation,
        status=status,
        occurred_at=occurred_at or timezone.now(),
        performed_by=request.user,
    )
    return api_response(serialize_care_log(log), message="Đã lưu nhật ký chăm sóc!", status=201)


@require_http_methods(["PUT", "POST"])
@role_required("Manager", "Technician", "Staff")
def care_update_view(request, pk):
    log = get_object_or_404(CareLog, pk=pk)
    role = get_user_role(request.user)
    if role == "Staff" and log.status == CareLog.Status.TODO:
        return api_response(message="Nhân viên chỉ có quyền xem lịch chăm sóc, không được chỉnh sửa lịch.", success=False, status=403)
    if role == "Staff" and log.performed_by_id != request.user.id:
        return api_response(message="Bạn không có quyền sửa nhật ký của người khác.", success=False, status=403)

    data = parse_body(request)
    if "lot_id" in data:
        log.lot = get_object_or_404(CropLot, pk=data["lot_id"])
    if "activity" in data:
        log.activity = data["activity"]
    if "note" in data:
        log.note = data["note"].strip()
    if "observation" in data:
        log.observation = data["observation"].strip()
    if "status" in data:
        log.status = data["status"]
    if "occurred_at" in data and data["occurred_at"]:
        log.occurred_at = data["occurred_at"]

    log.save()
    return api_response(serialize_care_log(log), message="Đã cập nhật nhật ký chăm sóc!")


@require_http_methods(["DELETE", "POST"])
@role_required("Manager")
def care_delete_view(request, pk):
    log = get_object_or_404(CareLog, pk=pk)
    log.delete()
    return api_response(message="Đã xóa nhật ký chăm sóc.")
