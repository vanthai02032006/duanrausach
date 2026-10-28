from decimal import Decimal
from django.db import transaction
from farm.models import Material, MaterialUsage


class StockError(Exception):
    pass


def record_material_usage(material_id, lot_id, quantity, user, note=""):
    quantity_dec = Decimal(str(quantity))
    with transaction.atomic():
        try:
            material = Material.objects.select_for_update().get(pk=material_id)
        except Material.DoesNotExist:
            raise StockError("Vật tư không tồn tại.")

        if quantity_dec > material.quantity:
            raise StockError(f"Tồn kho chỉ còn {material.quantity} {material.unit}, không đủ để sử dụng {quantity_dec} {material.unit}.")

        material.quantity -= quantity_dec
        material.save(update_fields=["quantity", "updated_at"])

        usage = MaterialUsage.objects.create(
            material=material,
            lot_id=lot_id,
            quantity=quantity_dec,
            used_by=user,
            note=note,
        )
        return usage
