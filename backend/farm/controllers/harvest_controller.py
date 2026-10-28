from django.db.models import Q
from django.views.decorators.http import require_GET, require_POST
from farm.models import CropLot, Harvest
from farm.services.harvest_service import create_harvest_record
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import role_required


def serialize_harvest(h):
    return {
        "id": h.id,
        "trace_code": h.trace_code,
        "lot_id": h.lot_id,
        "lot_code": h.lot.code,
        "lot_name": h.lot.name,
        "product_name": h.product_name,
        "quantity_kg": float(h.quantity_kg),
        "quality_grade": h.quality,
        "quality_grade_display": h.get_quality_display(),
        "harvested_at": str(h.harvested_at),
        "recorded_by": h.recorded_by.username if h.recorded_by else "Hệ thống",
        "note": h.notes,
    }


@require_GET
@role_required("Manager", "Technician", "Staff")
def harvest_list_view(request):
    qs = Harvest.objects.select_related("lot", "recorded_by")
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(trace_code__icontains=q) | Q(lot__code__icontains=q) | Q(product_name__icontains=q))
    return api_response([serialize_harvest(h) for h in qs[:100]])


@require_POST
@role_required("Manager", "Technician")
def harvest_create_view(request):
    data = parse_body(request)
    lot_id = data.get("lot_id")
    product_name = data.get("product_name", "").strip()
    quantity_kg = data.get("quantity_kg")
    quality_grade = data.get("quality_grade", Harvest.Quality.PENDING)
    if quality_grade not in Harvest.Quality.values:
        quality_grade = Harvest.Quality.PENDING
    harvested_at = data.get("harvested_at")
    note = data.get("note", "").strip()

    if not lot_id or not product_name or not quantity_kg or not harvested_at:
        return api_response(message="Vui lòng điền đầy đủ thông tin thu hoạch bắt buộc.", success=False, status=400)

    try:
        harvest = create_harvest_record(
            lot_id=lot_id,
            product_name=product_name,
            quantity_kg=quantity_kg,
            quality_grade=quality_grade,
            harvested_at=harvested_at,
            user=request.user,
            note=note,
        )
        return api_response(serialize_harvest(harvest), message=f"Đã ghi nhận thu hoạch! Mã truy xuất: {harvest.trace_code}", status=201)
    except CropLot.DoesNotExist:
        return api_response(message="Lô trồng không tồn tại.", success=False, status=400)
    except Exception as e:
        return api_response(message=f"Lỗi khi lưu phiếu thu hoạch: {str(e)}", success=False, status=400)
