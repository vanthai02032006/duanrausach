from farm.models import CareLog, CropLot, Harvest, MaterialUsage


def trace_by_code(code):
    code = (code or "").strip()
    if not code:
        return None

    lot = None
    harvests = []
    found_by = ""

    lot = CropLot.objects.filter(code__iexact=code).select_related("variety", "created_by").first()
    if lot:
        found_by = "Mã lô trồng"
        harvests_qs = Harvest.objects.filter(lot=lot).select_related("recorded_by")
    else:
        harvest = Harvest.objects.filter(trace_code__iexact=code).select_related("lot__variety", "recorded_by").first()
        if harvest:
            lot = harvest.lot
            found_by = "Mã truy xuất thu hoạch"
            harvests_qs = Harvest.objects.filter(lot=lot).select_related("recorded_by")
        else:
            harvests_qs = Harvest.objects.none()

    if not lot:
        return {"searched": True, "found": False, "code": code}

    logs = CareLog.objects.filter(lot=lot).select_related("performed_by")[:30]
    usages = MaterialUsage.objects.filter(lot=lot).select_related("material", "used_by")[:20]

    return {
        "searched": True,
        "found": True,
        "code": code,
        "found_by": found_by,
        "lot": {
            "id": lot.id,
            "code": lot.code,
            "name": lot.name,
            "variety_name": lot.variety.name,
            "scientific_name": lot.variety.scientific_name,
            "area_m2": float(lot.area_m2),
            "planting_date": str(lot.planting_date),
            "expected_harvest_date": str(lot.expected_harvest_date) if lot.expected_harvest_date else None,
            "actual_harvest_date": str(lot.actual_harvest_date) if lot.actual_harvest_date else None,
            "status": lot.status,
            "status_display": lot.get_status_display(),
            "notes": lot.notes,
        },
        "harvests": [
            {
                "id": h.id,
                "trace_code": h.trace_code,
                "product_name": h.product_name,
                "quantity_kg": float(h.quantity_kg),
                "quality_grade": h.get_quality_grade_display(),
                "harvested_at": str(h.harvested_at),
                "recorder": h.recorded_by.username if h.recorded_by else None,
                "note": h.note,
            }
            for h in harvests_qs
        ],
        "logs": [
            {
                "id": g.id,
                "activity": g.get_activity_display(),
                "occurred_at": g.occurred_at.strftime("%Y-%m-%d %H:%M"),
                "status": g.get_status_display(),
                "note": g.note,
                "observation": g.observation,
                "performer": g.performed_by.username if g.performed_by else "Hệ thống",
            }
            for g in logs
        ],
        "usages": [
            {
                "id": u.id,
                "material_name": u.material.name,
                "quantity": float(u.quantity),
                "unit": u.material.unit,
                "used_at": str(u.used_at),
                "used_by": u.used_by.username if u.used_by else None,
                "note": u.note,
            }
            for u in usages
        ],
    }
