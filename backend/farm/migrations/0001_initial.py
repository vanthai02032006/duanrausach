# Initial schema for the GreenFarm AI learning project.
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
import farm.models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="CropVariety",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True, verbose_name="Tên giống cây")),
                ("scientific_name", models.CharField(blank=True, max_length=150, verbose_name="Tên khoa học")),
                ("description", models.TextField(blank=True, verbose_name="Mô tả")),
                ("expected_days", models.PositiveSmallIntegerField(default=35, verbose_name="Số ngày sinh trưởng tham khảo")),
                ("care_notes", models.TextField(blank=True, verbose_name="Ghi chú chăm sóc")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name": "Giống cây", "verbose_name_plural": "Giống cây", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Material",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=140, unique=True, verbose_name="Tên vật tư")),
                ("category", models.CharField(choices=[("seed", "Hạt giống"), ("fertilizer", "Phân bón"), ("bio", "Chế phẩm sinh học"), ("tool", "Dụng cụ"), ("other", "Khác")], default="other", max_length=20, verbose_name="Nhóm")),
                ("unit", models.CharField(default="kg", max_length=24, verbose_name="Đơn vị")),
                ("quantity", models.DecimalField(decimal_places=2, default=0, max_digits=12, validators=[django.core.validators.MinValueValidator(0)], verbose_name="Tồn kho")),
                ("minimum_quantity", models.DecimalField(decimal_places=2, default=5, max_digits=12, validators=[django.core.validators.MinValueValidator(0)], verbose_name="Ngưỡng cảnh báo")),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=14, validators=[django.core.validators.MinValueValidator(0)], verbose_name="Đơn giá (VNĐ)")),
                ("expiry_date", models.DateField(blank=True, null=True, verbose_name="Hạn sử dụng")),
                ("notes", models.TextField(blank=True, verbose_name="Ghi chú")),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"verbose_name": "Vật tư", "verbose_name_plural": "Vật tư", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="CropLot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=30, unique=True, verbose_name="Mã lô")),
                ("name", models.CharField(max_length=140, verbose_name="Tên lô")),
                ("area_m2", models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(0.1)], verbose_name="Diện tích (m²)")),
                ("planting_date", models.DateField(verbose_name="Ngày gieo trồng")),
                ("expected_harvest_date", models.DateField(blank=True, null=True, verbose_name="Ngày thu hoạch dự kiến")),
                ("actual_harvest_date", models.DateField(blank=True, null=True, verbose_name="Ngày thu hoạch thực tế")),
                ("status", models.CharField(choices=[("planned", "Chuẩn bị gieo"), ("growing", "Đang chăm sóc"), ("ready", "Sắp thu hoạch"), ("harvested", "Đã thu hoạch")], default="planned", max_length=16, verbose_name="Trạng thái")),
                ("notes", models.TextField(blank=True, verbose_name="Ghi chú")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_crop_lots", to=settings.AUTH_USER_MODEL)),
                ("variety", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="lots", to="farm.cropvariety", verbose_name="Giống cây")),
            ],
            options={"verbose_name": "Lô trồng", "verbose_name_plural": "Lô trồng", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="CareLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("activity", models.CharField(choices=[("water", "Tưới nước"), ("fertilize", "Bón phân"), ("pest_check", "Kiểm tra sâu bệnh"), ("weed", "Làm cỏ"), ("observe", "Quan sát sinh trưởng"), ("other", "Khác")], max_length=20, verbose_name="Công việc")),
                ("occurred_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Thời điểm")),
                ("status", models.CharField(choices=[("todo", "Chưa thực hiện"), ("in_progress", "Đang thực hiện"), ("done", "Hoàn thành")], default="done", max_length=20, verbose_name="Trạng thái")),
                ("note", models.TextField(verbose_name="Ghi chú nhật ký")),
                ("observation", models.TextField(blank=True, verbose_name="Quan sát thực tế")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("lot", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="care_logs", to="farm.croplot", verbose_name="Lô trồng")),
                ("performed_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="care_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Nhật ký chăm sóc", "verbose_name_plural": "Nhật ký chăm sóc", "ordering": ["-occurred_at"]},
        ),
        migrations.CreateModel(
            name="Harvest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("product_name", models.CharField(max_length=140, verbose_name="Tên nông sản")),
                ("quantity_kg", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(0.01)], verbose_name="Sản lượng (kg)")),
                ("quality", models.CharField(choices=[("pending", "Chờ kiểm tra"), ("pass", "Đạt yêu cầu"), ("review", "Cần kiểm tra lại")], default="pending", max_length=16, verbose_name="Kiểm tra chất lượng")),
                ("harvested_at", models.DateField(default=django.utils.timezone.localdate, verbose_name="Ngày thu hoạch")),
                ("trace_code", models.CharField(default=farm.models.make_trace_code, editable=False, max_length=40, unique=True, verbose_name="Mã truy xuất")),
                ("notes", models.TextField(blank=True, verbose_name="Ghi chú chất lượng")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("lot", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="harvests", to="farm.croplot", verbose_name="Lô trồng")),
                ("recorded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="harvest_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Phiếu thu hoạch", "verbose_name_plural": "Phiếu thu hoạch", "ordering": ["-harvested_at"]},
        ),
        migrations.CreateModel(
            name="KnowledgeArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180, verbose_name="Tiêu đề")),
                ("category", models.CharField(default="Chăm sóc cây trồng", max_length=100, verbose_name="Chủ đề")),
                ("content", models.TextField(verbose_name="Nội dung tham khảo")),
                ("tags", models.CharField(blank=True, help_text="Các từ khóa, phân cách bằng dấu phẩy", max_length=300, verbose_name="Từ khóa")),
                ("source", models.CharField(default="Tài liệu mẫu - cần chuyên gia kiểm chứng", max_length=300, verbose_name="Nguồn tài liệu")),
                ("is_verified", models.BooleanField(default=False, verbose_name="Đã được chuyên gia kiểm chứng")),
                ("is_active", models.BooleanField(default=True, verbose_name="Cho phép AI truy xuất")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="knowledge_articles", to=settings.AUTH_USER_MODEL)),
                ("variety", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="knowledge_articles", to="farm.cropvariety", verbose_name="Giống cây liên quan")),
            ],
            options={"verbose_name": "Tài liệu tri thức", "verbose_name_plural": "Kho tri thức AI", "ordering": ["category", "title"]},
        ),
        migrations.CreateModel(
            name="MaterialUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(0.01)], verbose_name="Số lượng sử dụng")),
                ("used_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Thời điểm sử dụng")),
                ("note", models.CharField(blank=True, max_length=300, verbose_name="Ghi chú")),
                ("lot", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="material_usages", to="farm.croplot", verbose_name="Lô trồng")),
                ("material", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="usages", to="farm.material", verbose_name="Vật tư")),
                ("used_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="material_usages", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Phiếu sử dụng vật tư", "verbose_name_plural": "Phiếu sử dụng vật tư", "ordering": ["-used_at"]},
        ),
        migrations.CreateModel(
            name="Sale",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity_kg", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(0.01)], verbose_name="Số lượng bán (kg)")),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(0)], verbose_name="Giá bán/kg (VNĐ)")),
                ("customer_name", models.CharField(blank=True, max_length=140, verbose_name="Khách hàng")),
                ("sold_at", models.DateField(default=django.utils.timezone.localdate, verbose_name="Ngày bán")),
                ("note", models.CharField(blank=True, max_length=300, verbose_name="Ghi chú")),
                ("harvest", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="sales", to="farm.harvest", verbose_name="Phiếu thu hoạch")),
                ("recorded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sales_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Phiếu bán hàng", "verbose_name_plural": "Phiếu bán hàng", "ordering": ["-sold_at"]},
        ),
        migrations.CreateModel(
            name="AIInteraction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("task", models.CharField(choices=[("schedule", "Sinh lịch chăm sóc"), ("summary", "Tóm tắt nhật ký"), ("inspect", "Gợi ý lô cần kiểm tra"), ("harvest", "Gợi ý xem xét thu hoạch")], max_length=20, verbose_name="Tác vụ AI")),
                ("prompt_version", models.CharField(default="v3.0", max_length=20, verbose_name="Phiên bản prompt")),
                ("model_name", models.CharField(blank=True, max_length=80, verbose_name="Model")),
                ("user_question", models.TextField(blank=True, verbose_name="Yêu cầu")),
                ("output_text", models.TextField(blank=True, verbose_name="Kết quả AI")),
                ("context_sources", models.JSONField(blank=True, default=list, verbose_name="Nguồn ngữ cảnh đã truy xuất")),
                ("latency_ms", models.PositiveIntegerField(default=0, verbose_name="Độ trễ (ms)")),
                ("succeeded", models.BooleanField(default=False, verbose_name="Thành công")),
                ("error_category", models.CharField(blank=True, max_length=80, verbose_name="Loại lỗi")),
                ("feedback", models.CharField(blank=True, choices=[("helpful", "Hữu ích"), ("not_helpful", "Chưa hữu ích")], max_length=20, verbose_name="Đánh giá")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("lot", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_interactions", to="farm.croplot")),
                ("user", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_interactions", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Nhật ký AI", "verbose_name_plural": "Nhật ký AI", "ordering": ["-created_at"]},
        ),
    ]
