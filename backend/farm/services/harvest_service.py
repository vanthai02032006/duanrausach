from decimal import Decimal
from django.db import transaction
from farm.models import CropLot, Harvest


def create_harvest_record(lot_id, product_name, quantity_kg, quality_grade, harvested_at, user, note=""):
    with transaction.atomic():
        lot = CropLot.objects.select_for_update().get(pk=lot_id)
        harvest = Harvest.objects.create(
            lot=lot,
            product_name=product_name,
            quantity_kg=Decimal(str(quantity_kg)),
            quality=quality_grade,
            harvested_at=harvested_at,
            recorded_by=user,
            notes=note,
        )
        lot.status = CropLot.Status.HARVESTED
        lot.actual_harvest_date = harvested_at
        lot.save(update_fields=["status", "actual_harvest_date", "updated_at"])
        return harvest
