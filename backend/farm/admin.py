from django.contrib import admin
from .models import (
    AIInteraction, CareLog, CropLot, CropVariety, Harvest, KnowledgeArticle, Material, MaterialUsage, Sale,
    ChatConversation, ChatMessage, ChatFeedback,
)

@admin.register(CropVariety)
class CropVarietyAdmin(admin.ModelAdmin):
    list_display = ("name", "expected_days")
    search_fields = ("name", "scientific_name")

@admin.register(CropLot)
class CropLotAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "variety", "area_m2", "status", "planting_date")
    list_filter = ("status", "variety")
    search_fields = ("code", "name")

@admin.register(CareLog)
class CareLogAdmin(admin.ModelAdmin):
    list_display = ("lot", "activity", "occurred_at", "status", "performed_by")
    list_filter = ("activity", "status")
    search_fields = ("lot__code", "note")

@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "quantity", "unit", "minimum_quantity")
    list_filter = ("category",)
    search_fields = ("name",)

@admin.register(Harvest)
class HarvestAdmin(admin.ModelAdmin):
    list_display = ("trace_code", "lot", "product_name", "quantity_kg", "harvested_at", "quality")
    search_fields = ("trace_code", "lot__code", "product_name")

@admin.register(MaterialUsage)
class MaterialUsageAdmin(admin.ModelAdmin):
    list_display = ("material", "lot", "quantity", "used_at", "used_by")

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("harvest", "quantity_kg", "unit_price", "sold_at", "customer_name")

@admin.register(KnowledgeArticle)
class KnowledgeArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "variety", "is_verified", "is_active")
    list_filter = ("category", "is_verified", "is_active")
    search_fields = ("title", "content", "tags")

@admin.register(AIInteraction)
class AIInteractionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "task", "user", "lot", "model_name", "latency_ms", "succeeded", "feedback")
    list_filter = ("task", "succeeded", "feedback", "prompt_version")
    readonly_fields = ("user", "lot", "task", "prompt_version", "model_name", "user_question", "output_text", "context_sources", "latency_ms", "succeeded", "error_category", "created_at")


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    fields = ("role", "content", "model_name", "latency_ms", "created_at")
    readonly_fields = ("created_at",)


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "crop_lot", "is_archived", "updated_at", "created_at")
    list_filter = ("is_archived", "created_at")
    search_fields = ("title", "user__username", "crop_lot__code")
    inlines = [ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "role", "model_name", "latency_ms", "created_at")
    list_filter = ("role", "created_at")
    search_fields = ("content", "conversation__title")


@admin.register(ChatFeedback)
class ChatFeedbackAdmin(admin.ModelAdmin):
    list_display = ("message", "user", "rating", "created_at")
    list_filter = ("rating", "created_at")

