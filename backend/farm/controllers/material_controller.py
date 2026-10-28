from decimal import Decimal
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from farm.models import Material, MaterialUsage
from farm.services.inventory_service import record_material_usage, StockError
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import role_required


def serialize_material(m):
    return {
        "id": m.id,
        "name": m.name,
        "category": m.category,
        "category_display": m.get_category_display(),
        "unit": m.unit,
        "quantity": float(m.quantity),
        "minimum_quantity": float(m.minimum_quantity),
        "unit_price": float(m.unit_price),
        "is_low_stock": m.quantity <= m.minimum_quantity,
        "description": m.description,
    }


def serialize_usage(u):
    return {
        "id": u.id,
        "material_id": u.material_id,
        "material_name": u.material.name,
        "lot_id": u.lot_id,
        "lot_code": u.lot.code,
        "lot_name": u.lot.name,
        "quantity": float(u.quantity),
        "unit": u.material.unit,
        "used_at": str(u.used_at),
        "used_by": u.used_by.username if u.used_by else "Hệ thống",
        "note": u.note,
    }


@require_GET
@role_required("Manager", "Technician", "Staff")
def material_list_view(request):
    qs = Material.objects.all()
    q = request.GET.get("q", "").strip()
    low = request.GET.get("low", "").strip()

    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(category__icontains=q))
    if low == "1":
        qs = qs.filter(quantity__lte=F("minimum_quantity"))

    usages_qs = MaterialUsage.objects.select_related("material", "lot", "used_by")[:30]

    return api_response({
        "materials": [serialize_material(m) for m in qs],
        "usages": [serialize_usage(u) for u in usages_qs],
    })


@require_POST
@role_required("Manager")
def material_create_view(request):
    data = parse_body(request)
    name = data.get("name", "").strip()
    if not name:
        return api_response(message="Tên vật tư không được để trống.", success=False, status=400)
    if Material.objects.filter(name__iexact=name).exists():
        return api_response(message=f"Vật tư '{name}' đã tồn tại trong kho.", success=False, status=400)

    m = Material.objects.create(
        name=name,
        category=data.get("category", Material.Category.OTHER),
        unit=data.get("unit", "kg").strip(),
        quantity=Decimal(str(data.get("quantity", 0))),
        minimum_quantity=Decimal(str(data.get("minimum_quantity", 0))),
        unit_price=Decimal(str(data.get("unit_price", 0))),
        description=data.get("description", "").strip(),
    )
    return api_response(serialize_material(m), message="Đã thêm vật tư mới!", status=201)


@require_http_methods(["PUT", "POST"])
@role_required("Manager")
def material_update_view(request, pk):
    m = get_object_or_404(Material, pk=pk)
    data = parse_body(request)
    if "name" in data:
        m.name = data["name"].strip()
    if "category" in data:
        m.category = data["category"]
    if "unit" in data:
        m.unit = data["unit"].strip()
    if "quantity" in data:
        m.quantity = Decimal(str(data["quantity"]))
    if "minimum_quantity" in data:
        m.minimum_quantity = Decimal(str(data["minimum_quantity"]))
    if "unit_price" in data:
        m.unit_price = Decimal(str(data["unit_price"]))
    if "description" in data:
        m.description = data["description"].strip()
    m.save()
    return api_response(serialize_material(m), message="Đã cập nhật vật tư thành công!")


@require_POST
@role_required("Manager", "Technician", "Staff")
def material_usage_create_view(request):
    data = parse_body(request)
    material_id = data.get("material_id")
    lot_id = data.get("lot_id")
    quantity = data.get("quantity")
    note = data.get("note", "").strip()

    if not material_id or not lot_id or not quantity:
        return api_response(message="Vui lòng điền đầy đủ vật tư, lô sử dụng và số lượng.", success=False, status=400)

    try:
        usage = record_material_usage(
            material_id=material_id,
            lot_id=lot_id,
            quantity=quantity,
            user=request.user,
            note=note,
        )
        return api_response(serialize_usage(usage), message="Đã ghi nhận sử dụng và tự động trừ kho thành công!", status=201)
    except StockError as e:
        return api_response(message=str(e), success=False, status=400)
