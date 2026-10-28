from django.db.models import Avg, Sum
from django.utils import timezone
from django.views.decorators.http import require_GET
from farm.models import AIInteraction, CareLog, CropLot, Harvest, Material
from farm.services.ai_service import PROMPT_VERSION
from farm.utils.helpers import api_response
from farm.utils.roles import role_required


@require_GET
@role_required("Manager", "Technician")
def reports_view(request):
    today = timezone.localdate()
    month_harvests = Harvest.objects.filter(harvested_at__year=today.year, harvested_at__month=today.month)
    interactions = AIInteraction.objects.all()
    ai_total = interactions.count()
    ai_success = interactions.filter(succeeded=True).count()
    feedback_total = interactions.exclude(feedback="").count()
    helpful = interactions.filter(feedback=AIInteraction.Feedback.HELPFUL).count()

    recent_ai = [
        {
            "id": i.id,
            "user": i.user.username if i.user else "Hệ thống",
            "task_display": i.get_task_display(),
            "lot_code": i.lot.code if i.lot else None,
            "succeeded": i.succeeded,
            "latency_ms": i.latency_ms,
            "feedback": i.feedback,
            "created_at": i.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for i in interactions.select_related("user", "lot")[:10]
    ]

    return api_response({
        "lot_count": CropLot.objects.count(),
        "total_area": float(CropLot.objects.aggregate(v=Sum("area_m2"))["v"] or 0),
        "month_harvest_kg": float(month_harvests.aggregate(v=Sum("quantity_kg"))["v"] or 0),
        "material_count": Material.objects.count(),
        "pending_care_logs": CareLog.objects.filter(status=CareLog.Status.TODO).count(),
        "ai_total": ai_total,
        "ai_success_rate": round(ai_success * 100 / ai_total, 1) if ai_total else 0,
        "ai_avg_latency": round(interactions.aggregate(v=Avg("latency_ms"))["v"] or 0),
        "feedback_total": feedback_total,
        "helpful_rate": round(helpful * 100 / feedback_total, 1) if feedback_total else 0,
        "recent_ai": recent_ai,
    })


@require_GET
@role_required("Manager")
def ai_monitor_view(request):
    interactions = AIInteraction.objects.select_related("user", "lot")
    total = interactions.count()
    success = interactions.filter(succeeded=True).count()

    return api_response({
        "total": total,
        "success_rate": round(success * 100 / total, 1) if total else 0,
        "avg_latency": round(interactions.aggregate(v=Avg("latency_ms"))["v"] or 0),
        "feedback_count": interactions.exclude(feedback="").count(),
        "prompt_version": PROMPT_VERSION,
        "interactions": [
            {
                "id": i.id,
                "user": i.user.username if i.user else "Hệ thống",
                "task_display": i.get_task_display(),
                "lot_code": i.lot.code if i.lot else None,
                "model_name": i.model_name,
                "succeeded": i.succeeded,
                "latency_ms": i.latency_ms,
                "feedback": i.feedback,
                "error_category": i.error_category,
                "created_at": i.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
            for i in interactions[:100]
        ],
    })
