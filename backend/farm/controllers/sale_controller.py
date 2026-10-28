from decimal import Decimal
from django.views.decorators.http import require_GET, require_POST
from farm.models import Harvest, Sale
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import role_required


def serialize_sale(s):
    return {
        "id": s.id,
        "harvest_id": s.harvest_id,
        "harvest_trace_code": s.harvest.trace_code,
        "product_name": s.harvest.product_name,
        "lot_code": s.harvest.lot.code,
        "customer_name": s.customer_name,
        "quantity_kg": float(s.quantity_kg),
        "unit_price": float(s.unit_price),
        "total_price": float(s.total_price),
        "sold_at": str(s.sold_at),
        "recorded_by": s.recorded_by.username if s.recorded_by else "Hệ thống",
    }


@require_GET
@role_required("Manager")
def sale_list_view(request):
    sales_qs = Sale.objects.select_related("harvest", "harvest__lot", "recorded_by")[:150]
    total_rev = sum((s.total_price for s in sales_qs), Decimal("0"))
    return api_response({
        "sales": [serialize_sale(s) for s in sales_qs],
        "total_revenue": float(total_rev),
    })


@require_POST
@role_required("Manager")
def sale_create_view(request):
    data = parse_body(request)
    harvest_id = data.get("harvest_id")
    customer_name = data.get("customer_name", "").strip()
    quantity_kg = data.get("quantity_kg")
    unit_price = data.get("unit_price")
    sold_at = data.get("sold_at")

    if not harvest_id or not customer_name or not quantity_kg or not unit_price or not sold_at:
        return api_response(message="Vui lòng điền đầy đủ thông tin bán hàng.", success=False, status=400)

    try:
        harvest = Harvest.objects.get(pk=harvest_id)
    except Harvest.DoesNotExist:
        return api_response(message="Phiếu thu hoạch không tồn tại.", success=False, status=400)

    sale = Sale.objects.create(
        harvest=harvest,
        customer_name=customer_name,
        quantity_kg=Decimal(str(quantity_kg)),
        unit_price=Decimal(str(unit_price)),
        sold_at=sold_at,
        recorded_by=request.user,
    )
    return api_response(serialize_sale(sale), message="Đã tạo phiếu bán hàng thành công!", status=201)
