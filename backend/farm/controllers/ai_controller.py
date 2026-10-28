from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from farm.models import AIInteraction, CropLot
from farm.services.ai_service import generate_advice, PROMPT_VERSION
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import get_user_role, role_required


def serialize_interaction(i):
    return {
        "id": i.id,
        "task": i.task,
        "task_display": i.get_task_display(),
        "lot_id": i.lot_id,
        "lot_code": i.lot.code if i.lot else None,
        "user_question": i.user_question,
        "output_text": i.output_text,
        "context_sources": i.context_sources,
        "latency_ms": i.latency_ms,
        "succeeded": i.succeeded,
        "feedback": i.feedback,
        "error_category": i.error_category,
        "created_at": i.created_at.strftime("%Y-%m-%d %H:%M"),
        "user": i.user.username if i.user else "Hệ thống",
    }


@require_GET
@role_required("Manager", "Technician", "Staff")
def ai_meta_view(request):
    role = get_user_role(request.user)
    allowed_tasks = {"schedule", "summary", "inspect", "harvest"} if role in {"Manager", "Technician", "Superuser"} else {"summary", "inspect"}
    tasks = [{"value": choice[0], "label": choice[1]} for choice in AIInteraction.Task.choices if choice[0] in allowed_tasks]

    recent_qs = AIInteraction.objects.select_related("user", "lot").filter(user=request.user)[:8]
    if role in {"Manager", "Superuser"}:
        recent_qs = AIInteraction.objects.select_related("user", "lot")[:8]

    return api_response({
        "tasks": tasks,
        "recent": [serialize_interaction(i) for i in recent_qs],
        "prompt_version": PROMPT_VERSION,
        "gemini_model": getattr(settings, "GEMINI_MODEL", ""),
    })


@require_POST
@role_required("Manager", "Technician", "Staff")
def ai_generate_view(request):
    data = parse_body(request)
    task = data.get("task", "summary")
    question = data.get("question", "").strip()[:2000]
    lot_id = data.get("lot_id")

    role = get_user_role(request.user)
    allowed_tasks = {"schedule", "summary", "inspect", "harvest"} if role in {"Manager", "Technician", "Superuser"} else {"summary", "inspect"}

    if task not in allowed_tasks:
        return api_response(message="Vai trò của bạn chưa được cấp quyền dùng tác vụ AI này.", success=False, status=403)

    selected_lot = None
    if lot_id:
        selected_lot = CropLot.objects.filter(pk=lot_id).select_related("variety").first()

    if task != "inspect" and not selected_lot:
        return api_response(message="Hãy chọn lô trồng để AI có đủ ngữ cảnh nghiệp vụ.", success=False, status=400)

    result = generate_advice(task, selected_lot, question)
    interaction = AIInteraction.objects.create(
        user=request.user,
        lot=selected_lot,
        task=task,
        prompt_version=PROMPT_VERSION,
        model_name=getattr(settings, "GEMINI_MODEL", ""),
        user_question=question,
        output_text=result["text"],
        context_sources=result["sources"],
        latency_ms=result["latency_ms"],
        succeeded=result["ok"],
        error_category=result["error"],
    )

    return api_response({
        "result": result,
        "interaction": serialize_interaction(interaction),
    }, message="Đã nhận kết quả tư vấn AI!")


@require_POST
@role_required("Manager", "Technician", "Staff")
def ai_feedback_view(request, pk):
    interaction = get_object_or_404(AIInteraction, pk=pk)
    role = get_user_role(request.user)
    if role not in {"Manager", "Superuser"} and interaction.user_id != request.user.id:
        return api_response(message="Bạn không có quyền đánh giá phản hồi của người khác.", success=False, status=403)

    data = parse_body(request)
    feedback = data.get("feedback")
    if feedback in {AIInteraction.Feedback.HELPFUL, AIInteraction.Feedback.NOT_HELPFUL}:
        interaction.feedback = feedback
        interaction.save(update_fields=["feedback"])
        return api_response(message="Cảm ơn bạn đã phản hồi chất lượng AI!")
    return api_response(message="Giá trị phản hồi không hợp lệ.", success=False, status=400)
