import secrets
import uuid
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


def make_trace_code():
    # Cryptographically secure, unguessable trace code (e.g. GF-A3F8B29C1E0D)
    return "GF-" + secrets.token_hex(6).upper()


class CropVariety(models.Model):
    name = models.CharField("Tên giống cây", max_length=120, unique=True)
    scientific_name = models.CharField("Tên khoa học", max_length=150, blank=True)
    description = models.TextField("Mô tả", blank=True)
    expected_days = models.PositiveSmallIntegerField("Số ngày sinh trưởng tham khảo", default=35)
    care_notes = models.TextField("Ghi chú chăm sóc", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Giống cây"
        verbose_name_plural = "Giống cây"

    def __str__(self):
        return self.name


class CropLot(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Chuẩn bị gieo"
        GROWING = "growing", "Đang chăm sóc"
        READY = "ready", "Sắp thu hoạch"
        HARVESTED = "harvested", "Đã thu hoạch"

    code = models.CharField("Mã lô", max_length=30, unique=True)
    name = models.CharField("Tên lô", max_length=140)
    area_m2 = models.DecimalField("Diện tích (m²)", max_digits=10, decimal_places=2, validators=[MinValueValidator(0.1)])
    variety = models.ForeignKey(CropVariety, on_delete=models.PROTECT, related_name="lots", verbose_name="Giống cây")
    planting_date = models.DateField("Ngày gieo trồng")
    expected_harvest_date = models.DateField("Ngày thu hoạch dự kiến", blank=True, null=True)
    actual_harvest_date = models.DateField("Ngày thu hoạch thực tế", blank=True, null=True)
    status = models.CharField("Trạng thái", max_length=16, choices=Status.choices, default=Status.PLANNED)
    is_active = models.BooleanField("Hiệu lực truy xuất", default=True)
    notes = models.TextField("Ghi chú", blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_crop_lots")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Lô trồng"
        verbose_name_plural = "Lô trồng"

    def __str__(self):
        return f"{self.code} - {self.name}"


class CareLog(models.Model):
    class Activity(models.TextChoices):
        WATER = "water", "Tưới nước"
        FERTILIZE = "fertilize", "Bón phân"
        PEST_CHECK = "pest_check", "Kiểm tra sâu bệnh"
        WEED = "weed", "Làm cỏ"
        OBSERVE = "observe", "Quan sát sinh trưởng"
        OTHER = "other", "Khác"

    class Status(models.TextChoices):
        TODO = "todo", "Chưa thực hiện"
        IN_PROGRESS = "in_progress", "Đang thực hiện"
        DONE = "done", "Hoàn thành"

    lot = models.ForeignKey(CropLot, on_delete=models.CASCADE, related_name="care_logs", verbose_name="Lô trồng")
    activity = models.CharField("Công việc", max_length=20, choices=Activity.choices)
    occurred_at = models.DateTimeField("Thời điểm", default=timezone.now)
    status = models.CharField("Trạng thái", max_length=20, choices=Status.choices, default=Status.DONE)
    note = models.TextField("Ghi chú nhật ký")
    observation = models.TextField("Quan sát thực tế", blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="care_logs")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        verbose_name = "Nhật ký chăm sóc"
        verbose_name_plural = "Nhật ký chăm sóc"

    def __str__(self):
        return f"{self.lot.code} - {self.get_activity_display()}"


class Material(models.Model):
    class Category(models.TextChoices):
        SEED = "seed", "Hạt giống"
        FERTILIZER = "fertilizer", "Phân bón"
        BIO = "bio", "Chế phẩm sinh học"
        TOOL = "tool", "Dụng cụ"
        OTHER = "other", "Khác"

    name = models.CharField("Tên vật tư", max_length=140, unique=True)
    category = models.CharField("Nhóm", max_length=20, choices=Category.choices, default=Category.OTHER)
    unit = models.CharField("Đơn vị", max_length=24, default="kg")
    quantity = models.DecimalField("Tồn kho", max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    minimum_quantity = models.DecimalField("Ngưỡng cảnh báo", max_digits=12, decimal_places=2, default=5, validators=[MinValueValidator(0)])
    unit_price = models.DecimalField("Đơn giá (VNĐ)", max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    expiry_date = models.DateField("Hạn sử dụng", null=True, blank=True)
    notes = models.TextField("Ghi chú", blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Vật tư"
        verbose_name_plural = "Vật tư"

    @property
    def is_low_stock(self):
        return self.quantity <= self.minimum_quantity

    def __str__(self):
        return self.name


class MaterialUsage(models.Model):
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name="usages", verbose_name="Vật tư")
    lot = models.ForeignKey(CropLot, on_delete=models.PROTECT, related_name="material_usages", verbose_name="Lô trồng")
    quantity = models.DecimalField("Số lượng sử dụng", max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    used_at = models.DateTimeField("Thời điểm sử dụng", default=timezone.now)
    used_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="material_usages")
    note = models.CharField("Ghi chú", max_length=300, blank=True)

    class Meta:
        ordering = ["-used_at"]
        verbose_name = "Phiếu sử dụng vật tư"
        verbose_name_plural = "Phiếu sử dụng vật tư"


class Harvest(models.Model):
    class Quality(models.TextChoices):
        PENDING = "pending", "Chờ kiểm tra"
        PASS = "pass", "Đạt yêu cầu"
        REVIEW = "review", "Cần kiểm tra lại"

    lot = models.ForeignKey(CropLot, on_delete=models.PROTECT, related_name="harvests", verbose_name="Lô trồng")
    product_name = models.CharField("Tên nông sản", max_length=140)
    quantity_kg = models.DecimalField("Sản lượng (kg)", max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    quality = models.CharField("Kiểm tra chất lượng", max_length=16, choices=Quality.choices, default=Quality.PENDING)
    harvested_at = models.DateField("Ngày thu hoạch", default=timezone.localdate)
    trace_code = models.CharField("Mã truy xuất", max_length=40, unique=True, default=make_trace_code, editable=False)
    is_active = models.BooleanField("Hiệu lực truy xuất", default=True, help_text="Trạng thái hiệu lực của tem/mã truy xuất")
    revoked_at = models.DateTimeField("Thời điểm vô hiệu hóa", null=True, blank=True)
    revoked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="revoked_harvests")
    revocation_reason = models.CharField("Lý do vô hiệu hóa", max_length=255, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="harvest_records")
    notes = models.TextField("Ghi chú chất lượng", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-harvested_at"]
        verbose_name = "Phiếu thu hoạch"
        verbose_name_plural = "Phiếu thu hoạch"

    def __str__(self):
        return f"{self.trace_code} - {self.product_name}"


class Sale(models.Model):
    harvest = models.ForeignKey(Harvest, on_delete=models.PROTECT, related_name="sales", verbose_name="Phiếu thu hoạch")
    quantity_kg = models.DecimalField("Số lượng bán (kg)", max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    unit_price = models.DecimalField("Giá bán/kg (VNĐ)", max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    customer_name = models.CharField("Khách hàng", max_length=140, blank=True)
    sold_at = models.DateField("Ngày bán", default=timezone.localdate)
    note = models.CharField("Ghi chú", max_length=300, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="sales_records")

    class Meta:
        ordering = ["-sold_at"]
        verbose_name = "Phiếu bán hàng"
        verbose_name_plural = "Phiếu bán hàng"

    @property
    def total_price(self):
        return self.quantity_kg * self.unit_price


class KnowledgeArticle(models.Model):
    title = models.CharField("Tiêu đề", max_length=180)
    category = models.CharField("Chủ đề", max_length=100, default="Chăm sóc cây trồng")
    variety = models.ForeignKey(CropVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name="knowledge_articles", verbose_name="Giống cây liên quan")
    content = models.TextField("Nội dung tham khảo")
    tags = models.CharField("Từ khóa", max_length=300, blank=True, help_text="Các từ khóa, phân cách bằng dấu phẩy")
    source = models.CharField("Nguồn tài liệu", max_length=300, default="Tài liệu mẫu - cần chuyên gia kiểm chứng")
    is_verified = models.BooleanField("Đã được chuyên gia kiểm chứng", default=False)
    is_active = models.BooleanField("Cho phép AI truy xuất", default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="knowledge_articles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "title"]
        verbose_name = "Tài liệu tri thức"
        verbose_name_plural = "Kho tri thức AI"

    def __str__(self):
        return self.title


class AIInteraction(models.Model):
    class Task(models.TextChoices):
        SCHEDULE = "schedule", "Sinh lịch chăm sóc"
        SUMMARY = "summary", "Tóm tắt nhật ký"
        INSPECT = "inspect", "Gợi ý lô cần kiểm tra"
        HARVEST = "harvest", "Gợi ý xem xét thu hoạch"

    class Feedback(models.TextChoices):
        HELPFUL = "helpful", "Hữu ích"
        NOT_HELPFUL = "not_helpful", "Chưa hữu ích"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="ai_interactions")
    lot = models.ForeignKey(CropLot, on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_interactions")
    task = models.CharField("Tác vụ AI", max_length=20, choices=Task.choices)
    prompt_version = models.CharField("Phiên bản prompt", max_length=20, default="v3.0")
    model_name = models.CharField("Model", max_length=80, blank=True)
    user_question = models.TextField("Yêu cầu", blank=True)
    output_text = models.TextField("Kết quả AI", blank=True)
    context_sources = models.JSONField("Nguồn ngữ cảnh đã truy xuất", default=list, blank=True)
    latency_ms = models.PositiveIntegerField("Độ trễ (ms)", default=0)
    succeeded = models.BooleanField("Thành công", default=False)
    error_category = models.CharField("Loại lỗi", max_length=80, blank=True)
    feedback = models.CharField("Đánh giá", max_length=20, choices=Feedback.choices, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Nhật ký AI"
        verbose_name_plural = "Nhật ký AI"

    def __str__(self):
        return f"{self.get_task_display()} - {self.created_at:%d/%m/%Y %H:%M}"


class ChatConversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_conversations",
        verbose_name="Người dùng",
    )
    title = models.CharField("Tiêu đề cuộc trò chuyện", max_length=200, default="Cuộc trò chuyện mới")
    crop_lot = models.ForeignKey(
        CropLot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_conversations",
        verbose_name="Lô trồng ngữ cảnh",
    )
    is_archived = models.BooleanField("Đã lưu trữ", default=False)
    created_at = models.DateTimeField("Thời điểm tạo", auto_now_add=True)
    updated_at = models.DateTimeField("Cập nhật lần cuối", auto_now=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Cuộc hội thoại AI"
        verbose_name_plural = "Cuộc hội thoại AI"

    def __str__(self):
        return f"{self.title} ({self.user.username})"


class ChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = "user", "Người dùng"
        ASSISTANT = "assistant", "Trợ lý AI"

    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name="messages",
        verbose_name="Cuộc hội thoại",
    )
    role = models.CharField("Vai trò", max_length=20, choices=Role.choices)
    content = models.TextField("Nội dung tin nhắn")
    status = models.CharField("Trạng thái", max_length=20, default="done")
    model_name = models.CharField("Model AI", max_length=80, blank=True)
    latency_ms = models.PositiveIntegerField("Thời gian phản hồi (ms)", default=0)
    references_data = models.JSONField("Dữ liệu tham chiếu thực tế", default=dict, blank=True)
    created_at = models.DateTimeField("Thời điểm gửi", auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Tin nhắn hội thoại"
        verbose_name_plural = "Tin nhắn hội thoại"

    def __str__(self):
        return f"[{self.role}] {self.content[:40]}..."


class ChatFeedback(models.Model):
    class Rating(models.IntegerChoices):
        HELPFUL = 1, "Hữu ích"
        NOT_HELPFUL = -1, "Chưa hữu ích"

    message = models.OneToOneField(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name="feedback",
        verbose_name="Tin nhắn AI",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="chat_feedbacks",
        verbose_name="Người đánh giá",
    )
    rating = models.SmallIntegerField("Đánh giá", choices=Rating.choices)
    comment = models.TextField("Góp ý thêm", blank=True)
    created_at = models.DateTimeField("Thời điểm đánh giá", auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Đánh giá tin nhắn"
        verbose_name_plural = "Đánh giá tin nhắn"

    def __str__(self):
        return f"Feedback for msg #{self.message_id}: {self.get_rating_display()}"
