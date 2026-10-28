from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from farm.models import CropVariety
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import role_required


def serialize_variety(v):
    return {
        "id": v.id,
        "name": v.name,
        "scientific_name": v.scientific_name,
        "expected_days": v.expected_days,
        "description": v.description,
        "care_notes": v.care_notes,
        "lots_count": v.lots.count(),
    }


@require_GET
@role_required("Manager", "Technician", "Staff")
def variety_list_view(request):
    qs = CropVariety.objects.all()
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(scientific_name__icontains=q))
    return api_response([serialize_variety(v) for v in qs])


@require_POST
@role_required("Manager")
def variety_create_view(request):
    data = parse_body(request)
    name = data.get("name", "").strip()
    if not name:
        return api_response(message="Tên giống cây không được để trống.", success=False, status=400)
    if CropVariety.objects.filter(name__iexact=name).exists():
        return api_response(message=f"Giống cây '{name}' đã tồn tại.", success=False, status=400)

    obj = CropVariety.objects.create(
        name=name,
        scientific_name=data.get("scientific_name", "").strip(),
        expected_days=int(data.get("expected_days", 35)),
        description=data.get("description", "").strip(),
        care_notes=data.get("care_notes", "").strip(),
    )
    return api_response(serialize_variety(obj), message="Đã thêm giống cây thành công!", status=201)


@require_http_methods(["PUT", "POST"])
@role_required("Manager")
def variety_update_view(request, pk):
    obj = get_object_or_404(CropVariety, pk=pk)
    data = parse_body(request)
    if "name" in data:
        obj.name = data["name"].strip()
    if "scientific_name" in data:
        obj.scientific_name = data["scientific_name"].strip()
    if "expected_days" in data:
        obj.expected_days = int(data["expected_days"])
    if "description" in data:
        obj.description = data["description"].strip()
    if "care_notes" in data:
        obj.care_notes = data["care_notes"].strip()
    obj.save()
    return api_response(serialize_variety(obj), message="Đã cập nhật giống cây thành công!")


@require_http_methods(["DELETE", "POST"])
@role_required("Manager")
def variety_delete_view(request, pk):
    obj = get_object_or_404(CropVariety, pk=pk)
    if obj.lots.exists():
        return api_response(message="Không thể xóa giống cây đang được dùng bởi các lô trồng.", success=False, status=400)
    obj.delete()
    return api_response(message="Đã xóa giống cây thành công.")
