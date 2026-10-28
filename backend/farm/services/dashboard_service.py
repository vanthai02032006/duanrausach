from datetime import timedelta
from decimal import Decimal
from django.db.models import F, Sum
from django.utils import timezone
from farm.models import AIInteraction, CareLog, CropLot, Harvest, Material, Sale


def get_dashboard_summary():
    today = timezone.localdate()
    lots_qs = CropLot.objects.select_related("variety")
    logs_qs = CareLog.objects.select_related("lot", "performed_by")
    this_month_harvests = Harvest.objects.filter(harvested_at__year=today.year, harvested_at__month=today.month)
    sales = list(Sale.objects.filter(sold_at__year=today.year, sold_at__month=today.month))
    revenue = sum((s.total_price for s in sales), Decimal("0"))

    recent_lots = [
        {
            "id": l.id,
            "code": l.code,
            "name": l.name,
            "variety_name": l.variety.name,
            "area_m2": float(l.area_m2),
            "status": l.status,
            "status_display": l.get_status_display(),
            "planting_date": str(l.planting_date),
            "expected_harvest_date": str(l.expected_harvest_date) if l.expected_harvest_date else None,
        }
        for l in lots_qs[:6]
    ]

    recent_logs = [
        {
            "id": g.id,
            "lot_code": g.lot.code,
            "activity": g.activity,
            "activity_display": g.get_activity_display(),
            "occurred_at": g.occurred_at.strftime("%Y-%m-%d %H:%M"),
            "status": g.status,
            "status_display": g.get_status_display(),
            "note": g.note,
            "performer": g.performed_by.username if g.performed_by else "Hệ thống",
        }
        for g in logs_qs[:6]
    ]

    low_stock = [
        {
            "id": m.id,
            "name": m.name,
            "category": m.category,
            "category_display": m.get_category_display(),
            "quantity": float(m.quantity),
            "minimum_quantity": float(m.minimum_quantity),
            "unit": m.unit,
        }
        for m in Material.objects.filter(quantity__lte=F("minimum_quantity"))[:5]
    ]

    urgent_lots = [
        {
            "id": l.id,
            "code": l.code,
            "name": l.name,
            "variety_name": l.variety.name,
            "status": l.status,
            "expected_harvest_date": str(l.expected_harvest_date) if l.expected_harvest_date else None,
        }
        for l in lots_qs.filter(status=CropLot.Status.READY)[:4]
    ]

    return {
        "total_lots": lots_qs.count(),
        "active_lots": lots_qs.filter(status__in=[CropLot.Status.GROWING, CropLot.Status.READY]).count(),
        "total_area": float(lots_qs.aggregate(v=Sum("area_m2"))["v"] or Decimal("0")),
        "ready_lots": lots_qs.filter(status=CropLot.Status.READY).count(),
        "today_logs": logs_qs.filter(occurred_at__date=today).count(),
        "pending_logs": logs_qs.filter(status=CareLog.Status.TODO).count(),
        "monthly_harvest_kg": float(this_month_harvests.aggregate(v=Sum("quantity_kg"))["v"] or Decimal("0")),
        "monthly_revenue": float(revenue),
        "recent_lots": recent_lots,
        "recent_logs": recent_logs,
        "low_stock": low_stock,
        "urgent_lots": urgent_lots,
        "ai_week_count": AIInteraction.objects.filter(created_at__gte=timezone.now() - timedelta(days=7)).count(),
    }
