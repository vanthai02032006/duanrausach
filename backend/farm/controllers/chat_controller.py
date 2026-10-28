"""Chatbot Controller for GreenFarm AI Agricultural Assistant.

Exposes REST APIs for conversation history, sending messages with grounded PostgreSQL RAG,
multi-turn context, and message feedback.
"""
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from farm.models import (
    AIInteraction,
    ChatConversation,
    ChatMessage,
    ChatFeedback,
    CropLot,
)
from farm.services.farm_context_service import (
    can_user_access_lot,
    retrieve_farm_context,
)
from farm.services.gemini_service import call_gemini_chat
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import get_user_role, role_required


def serialize_message(msg):
    feedback_data = None
    if hasattr(msg, "feedback") and msg.feedback:
        feedback_data = {
            "rating": msg.feedback.rating,
            "comment": msg.feedback.comment,
        }

    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "role": msg.role,
        "content": msg.content,
        "status": msg.status,
        "model_name": msg.model_name,
        "latency_ms": msg.latency_ms,
        "references_data": msg.references_data or {},
        "feedback": feedback_data,
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "time_display": msg.created_at.strftime("%H:%M"),
    }


def serialize_conversation(conv, include_messages=False):
    lot_data = None
    if conv.crop_lot:
        lot_data = {
            "id": conv.crop_lot.id,
            "code": conv.crop_lot.code,
            "name": conv.crop_lot.name,
            "variety": conv.crop_lot.variety.name if conv.crop_lot.variety else "",
            "status": conv.crop_lot.get_status_display(),
        }

    data = {
        "id": conv.id,
        "title": conv.title,
        "crop_lot": lot_data,
        "crop_lot_id": conv.crop_lot_id,
        "is_archived": conv.is_archived,
        "created_at": conv.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": conv.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
        "date_display": conv.updated_at.strftime("%d/%m/%Y"),
        "message_count": conv.messages.count() if hasattr(conv, "messages") else 0,
    }

    if include_messages:
        msgs = conv.messages.select_related("feedback").order_by("created_at")
        data["messages"] = [serialize_message(m) for m in msgs]

    return data


@require_http_methods(["GET", "POST"])
@role_required("Manager", "Technician", "Staff")
def conversation_list_create_view(request):
    """GET: List current user's conversations.
    POST: Create a new conversation for current user.
    """
    if request.method == "GET":
        qs = ChatConversation.objects.filter(user=request.user)
        if request.GET.get("archived") != "1":
            qs = qs.filter(is_archived=False)
        qs = qs.select_related("crop_lot", "crop_lot__variety").order_by("-updated_at")

        conversations = [serialize_conversation(c) for c in qs]
        return api_response(conversations)

    # POST: create new conversation
    data = parse_body(request)
    title = (data.get("title") or "").strip() or "Cuộc trò chuyện mới"
    lot_id = data.get("crop_lot_id")

    selected_lot = None
    if lot_id:
        selected_lot = CropLot.objects.filter(pk=lot_id).select_related("variety").first()
        if not selected_lot:
            return api_response(message="Lô trồng không tồn tại.", success=False, status=404)
        if not can_user_access_lot(request.user, selected_lot):
            return api_response(message="Bạn không có quyền truy cập lô trồng này.", success=False, status=403)

    conv = ChatConversation.objects.create(
        user=request.user,
        title=title[:200],
        crop_lot=selected_lot,
    )
    return api_response(serialize_conversation(conv, include_messages=True), message="Đã tạo cuộc trò chuyện mới!", status=201)


@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
@role_required("Manager", "Technician", "Staff")
def conversation_detail_view(request, pk):
    """GET: Retrieve conversation with its full message history.
    PATCH/PUT: Rename or update conversation.
    DELETE: Delete conversation (and cascade messages).
    """
    conv = get_object_or_404(ChatConversation.objects.select_related("crop_lot", "crop_lot__variety"), pk=pk)

    # Ownership check
    if conv.user_id != request.user.id and not request.user.is_superuser:
        return api_response(message="Bạn không có quyền truy cập cuộc trò chuyện này.", success=False, status=403)

    if request.method == "GET":
        return api_response(serialize_conversation(conv, include_messages=True))

    if request.method == "DELETE":
        conv.delete()
        return api_response(message="Đã xóa cuộc trò chuyện thành công!")

    # PATCH / PUT: update title, crop_lot, or is_archived
    data = parse_body(request)
    fields_to_update = []

    if "title" in data:
        new_title = (data.get("title") or "").strip()
        if new_title:
            conv.title = new_title[:200]
            fields_to_update.append("title")

    if "is_archived" in data:
        conv.is_archived = bool(data.get("is_archived"))
        fields_to_update.append("is_archived")

    if "crop_lot_id" in data:
        lot_id = data.get("crop_lot_id")
        if lot_id:
            lot = CropLot.objects.filter(pk=lot_id).select_related("variety").first()
            if not lot:
                return api_response(message="Lô trồng không tồn tại.", success=False, status=404)
            if not can_user_access_lot(request.user, lot):
                return api_response(message="Bạn không có quyền truy cập lô trồng này.", success=False, status=403)
            conv.crop_lot = lot
        else:
            conv.crop_lot = None
        fields_to_update.append("crop_lot")

    if fields_to_update:
        conv.save(update_fields=fields_to_update + ["updated_at"])

    return api_response(serialize_conversation(conv, include_messages=True), message="Đã cập nhật cuộc trò chuyện!")


@require_POST
@role_required("Manager", "Technician", "Staff")
def chat_send_message_view(request, pk):
    """Send user message to a conversation and receive grounded Gemini response."""
    conv = get_object_or_404(ChatConversation, pk=pk)

    # Ownership check
    if conv.user_id != request.user.id and not request.user.is_superuser:
        return api_response(message="Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này.", success=False, status=403)

    data = parse_body(request)
    content = (data.get("content") or "").strip()
    if not content:
        return api_response(message="Nội dung câu hỏi không được để trống.", success=False, status=400)
    if len(content) > 3000:
        return api_response(message="Câu hỏi quá dài (tối đa 3000 ký tự).", success=False, status=400)

    # Optional lot override for this query
    lot_id = data.get("crop_lot_id")
    target_lot = conv.crop_lot
    if lot_id:
        lot = CropLot.objects.filter(pk=lot_id).select_related("variety").first()
        if not lot:
            return api_response(message="Lô trồng được chọn không tồn tại.", success=False, status=404)
        if not can_user_access_lot(request.user, lot):
            return api_response(message="Bạn không có quyền truy cập dữ liệu của lô này.", success=False, status=403)
        target_lot = lot
        if conv.crop_lot_id != lot.id:
            conv.crop_lot = lot
            conv.save(update_fields=["crop_lot", "updated_at"])

    # 1. Create user message
    user_msg = ChatMessage.objects.create(
        conversation=conv,
        role=ChatMessage.Role.USER,
        content=content,
        status="done",
    )

    # Auto rename default title on first message
    if conv.title == "Cuộc trò chuyện mới":
        auto_title = content.replace("\n", " ").strip()
        conv.title = (auto_title[:50] + "...") if len(auto_title) > 50 else auto_title
        conv.save(update_fields=["title", "updated_at"])

    # 2. Retrieve grounded PostgreSQL context (RAG)
    context_res = retrieve_farm_context(user=request.user, lot=target_lot, question=content)

    # 3. Retrieve recent history for multi-turn prompt
    recent_messages = list(
        conv.messages.exclude(pk=user_msg.pk)
        .order_by("-created_at")[:6]
    )
    recent_messages.reverse()
    history = [{"role": m.role, "content": m.content} for m in recent_messages]

    # 4. Call Gemini AI service
    user_role = get_user_role(request.user)
    ai_result = call_gemini_chat(
        user_question=content,
        context_text=context_res["context_text"],
        conversation_history=history,
        user_role=user_role,
    )

    # 5. Create assistant message
    assistant_msg = ChatMessage.objects.create(
        conversation=conv,
        role=ChatMessage.Role.ASSISTANT,
        content=ai_result["text"],
        status="done" if ai_result["ok"] else "error",
        model_name=ai_result["model_name"],
        latency_ms=ai_result["latency_ms"],
        references_data=context_res["references"],
    )

    conv.save(update_fields=["updated_at"])

    # 6. Backward-compatible logging for AIMonitorPage
    try:
        articles = context_res["references"].get("articles", [])
        AIInteraction.objects.create(
            user=request.user,
            lot=target_lot,
            task="summary",
            prompt_version="v3.1-chat",
            model_name=ai_result["model_name"],
            user_question=content,
            output_text=ai_result["text"],
            context_sources=[a.get("title", "") for a in articles if isinstance(a, dict)],
            latency_ms=ai_result["latency_ms"],
            succeeded=ai_result["ok"],
            error_category=ai_result.get("error", ""),
        )
    except Exception:
        pass

    return api_response({
        "user_message": serialize_message(user_msg),
        "assistant_message": serialize_message(assistant_msg),
        "conversation_id": conv.id,
        "conversation_title": conv.title,
    })


@require_POST
@role_required("Manager", "Technician", "Staff")
def chat_feedback_view(request, pk):
    """Submit rating and optional feedback comment on an assistant message."""
    msg = get_object_or_404(ChatMessage.objects.select_related("conversation"), pk=pk)

    # Verify ownership of conversation
    if msg.conversation.user_id != request.user.id and not request.user.is_superuser:
        return api_response(message="Bạn không có quyền đánh giá tin nhắn này.", success=False, status=403)

    if msg.role != ChatMessage.Role.ASSISTANT:
        return api_response(message="Chỉ có thể đánh giá câu trả lời của Trợ lý AI.", success=False, status=400)

    data = parse_body(request)
    rating = data.get("rating")
    if rating not in (1, -1, "1", "-1"):
        return api_response(message="Giá trị đánh giá phải là 1 (Hữu ích) hoặc -1 (Chưa hữu ích).", success=False, status=400)

    rating_int = int(rating)
    comment = (data.get("comment") or "").strip()

    feedback, _ = ChatFeedback.objects.update_or_create(
        message=msg,
        defaults={
            "user": request.user,
            "rating": rating_int,
            "comment": comment,
        },
    )

    return api_response({
        "id": feedback.id,
        "message_id": msg.id,
        "rating": feedback.rating,
        "comment": feedback.comment,
    }, message="Cảm ơn bạn đã gửi phản hồi đánh giá AI!")
