from decimal import Decimal
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from farm.models import CropLot, CropVariety
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import role_required


def serialize_lot(lot):
    return {
        "id": lot.id,
        "code": lot.code,
        "name": lot.name,
        "area_m2": float(lot.area_m2),
        "variety_id": lot.variety_id,
        "variety_name": lot.variety.name,
        "planting_date": str(lot.planting_date),
        "expected_harvest_date": str(lot.expected_harvest_date) if lot.expected_harvest_date else None,
        "actual_harvest_date": str(lot.actual_harvest_date) if lot.actual_harvest_date else None,
        "status": lot.status,
        "status_display": lot.get_status_display(),
        "notes": lot.notes,
        "created_by": lot.created_by.username if lot.created_by else None,
        "created_at": lot.created_at.strftime("%Y-%m-%d %H:%M"),
    }


@require_GET
@role_required("Manager", "Technician", "Staff")
def lot_list_view(request):
    qs = CropLot.objects.select_related("variety", "created_by")
    q = request.GET.get("q", "").strip()
    status = request.GET.get("status", "").strip()
    variety = request.GET.get("variety", "").strip()

    if q:
        qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q) | Q(variety__name__icontains=q))
    if status:
        qs = qs.filter(status=status)
    if variety and variety.isdigit():
        qs = qs.filter(variety_id=int(variety))

    return api_response([serialize_lot(l) for l in qs])


@require_POST
@role_required("Manager", "Technician")
def lot_create_view(request):
    data = parse_body(request)
    code = data.get("code", "").strip()
    name = data.get("name", "").strip()
    variety_id = data.get("variety_id")
    area_m2 = data.get("area_m2")
    planting_date = data.get("planting_date")
    expected_harvest_date = data.get("expected_harvest_date") or None
    notes = data.get("notes", "")

    if not code or not name or not variety_id or not area_m2 or not planting_date:
        return api_response(message="Vui lòng điền đầy đủ các thông tin bắt buộc.", success=False, status=400)

    if CropLot.objects.filter(code__iexact=code).exists():
        return api_response(message=f"Mã lô '{code}' đã tồn tại.", success=False, status=400)

    try:
        variety = CropVariety.objects.get(pk=variety_id)
    except CropVariety.DoesNotExist:
        return api_response(message="Giống cây không hợp lệ.", success=False, status=400)

    lot = CropLot.objects.create(
        code=code,
        name=name,
        variety=variety,
        area_m2=Decimal(str(area_m2)),
        planting_date=planting_date,
        expected_harvest_date=expected_harvest_date,
        notes=notes,
        status=data.get("status", CropLot.Status.PLANNED),
        created_by=request.user,
    )
    return api_response(serialize_lot(lot), message="Đã tạo lô trồng mới thành công!", status=201)


@require_http_methods(["PUT", "POST"])
@role_required("Manager", "Technician")
def lot_update_view(request, pk):
    lot = get_object_or_404(CropLot, pk=pk)
    data = parse_body(request)

    if "name" in data:
        lot.name = data["name"].strip()
    if "area_m2" in data:
        lot.area_m2 = Decimal(str(data["area_m2"]))
    if "variety_id" in data:
        lot.variety = get_object_or_404(CropVariety, pk=data["variety_id"])
    if "planting_date" in data:
        lot.planting_date = data["planting_date"]
    if "expected_harvest_date" in data:
        lot.expected_harvest_date = data["expected_harvest_date"] or None
    if "status" in data:
        lot.status = data["status"]
    if "notes" in data:
        lot.notes = data["notes"]

    lot.save()
    return api_response(serialize_lot(lot), message="Đã cập nhật lô trồng thành công!")


@require_http_methods(["DELETE", "POST"])
@role_required("Manager")
def lot_delete_view(request, pk):
    lot = get_object_or_404(CropLot, pk=pk)
    if lot.harvests.exists():
        return api_response(message="Không thể xóa lô đã có phiếu thu hoạch để bảo toàn truy xuất nguồn gốc.", success=False, status=400)
    lot.delete()
    return api_response(message="Đã xóa lô trồng thành công.")
