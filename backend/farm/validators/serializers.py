"""Validators and serialization schemas for GreenFarm API."""
from decimal import Decimal, InvalidOperation


def validate_lot_payload(data):
    errors = []
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    planting_date = data.get("planting_date")
    variety_id = data.get("variety_id")
    area_m2 = data.get("area_m2")

    if not code:
        errors.append("Mã lô không được để trống.")
    if not name:
        errors.append("Tên lô không được để trống.")
    if not variety_id:
        errors.append("Vui lòng chọn giống cây.")
    if not planting_date:
        errors.append("Vui lòng nhập ngày gieo trồng.")

    try:
        if area_m2 is None or Decimal(str(area_m2)) <= 0:
            errors.append("Diện tích phải lớn hơn 0 m².")
    except (InvalidOperation, ValueError):
        errors.append("Diện tích không hợp lệ.")

    return errors


def validate_care_payload(data):
    errors = []
    if not data.get("lot_id"):
        errors.append("Vui lòng chọn lô trồng.")
    if not data.get("activity"):
        errors.append("Vui lòng chọn loại hoạt động chăm sóc.")
    if not (data.get("note") or "").strip():
        errors.append("Nội dung ghi chú nhật ký không được để trống.")
    return errors


def validate_material_payload(data):
    errors = []
    name = (data.get("name") or "").strip()
    if not name:
        errors.append("Tên vật tư không được để trống.")
    return errors
