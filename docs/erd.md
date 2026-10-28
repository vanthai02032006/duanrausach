# ERD GreenFarm AI

```mermaid
erDiagram
  USER ||--o{ CROP_LOT : creates
  USER ||--o{ CARE_LOG : records
  USER ||--o{ MATERIAL_USAGE : records
  USER ||--o{ HARVEST : records
  USER ||--o{ SALE : records
  USER ||--o{ KNOWLEDGE_ARTICLE : creates
  USER ||--o{ AI_INTERACTION : asks
  CROP_VARIETY ||--o{ CROP_LOT : classifies
  CROP_LOT ||--o{ CARE_LOG : has
  CROP_LOT ||--o{ MATERIAL_USAGE : consumes
  MATERIAL ||--o{ MATERIAL_USAGE : used_in
  CROP_LOT ||--o{ HARVEST : produces
  HARVEST ||--o{ SALE : sold_by
  CROP_VARIETY ||--o{ KNOWLEDGE_ARTICLE : relates_to
  CROP_LOT ||--o{ AI_INTERACTION : context_for
```

## Ràng buộc chính

- `CropVariety.name`, `CropLot.code`, `Material.name` và `Harvest.trace_code` duy nhất.
- Diện tích, tồn kho, số lượng sử dụng/thu hoạch/bán và giá không âm; lượng sử dụng/bán phải dương.
- Không xóa giống đã được lô sử dụng; không xóa lô có phiếu thu hoạch để giữ truy xuất.
- Ghi phiếu vật tư trong transaction, khóa bản ghi tồn kho và trừ số lượng; kiểm tra lại tồn kho ở server để tránh oversell.
- Không xóa cứng dữ liệu tài khoản/AI logs cần kiểm toán trong production; MVP chỉ hỗ trợ khóa tài khoản và feedback.
