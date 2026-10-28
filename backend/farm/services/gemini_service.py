"""Gemini AI Chat Service for GreenFarm AI.

Handles communication with Google Gemini API via official google-genai SDK,
injecting farm system prompts, multi-turn history, and grounded PostgreSQL context.
"""
import logging
import time
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).resolve().parent.parent / "prompts" / "farm_assistant.txt"
if PROMPT_FILE.exists():
    SYSTEM_INSTRUCTION = PROMPT_FILE.read_text(encoding="utf-8").strip()
else:
    SYSTEM_INSTRUCTION = "Bạn là trợ lý AI quản lý trang trại rau sạch GreenFarm AI."


def call_gemini_chat(user_question, context_text="", conversation_history=None, user_role="Staff"):
    """Call Google Gemini API with system instructions, context, and conversation history.

    Args:
        user_question (str): The current user prompt/question.
        context_text (str): Real PostgreSQL data context retrieved for the query.
        conversation_history (list): Optional list of dicts: [{"role": "user"|"assistant", "content": "..."}]
        user_role (str): Role of requesting user ("Manager", "Technician", "Staff").

    Returns:
        dict: {
            "ok": bool,
            "text": str,
            "latency_ms": int,
            "model_name": str,
            "error": str
        }
    """
    model_name = getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite")
    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    timeout_sec = getattr(settings, "AI_TIMEOUT_SECONDS", 25)

    if not api_key:
        return {
            "ok": False,
            "text": "Chưa cấu hình GEMINI_API_KEY. Vui lòng thêm khóa GEMINI_API_KEY vào file .env của backend để kích hoạt Trợ lý AI Gemini.",
            "latency_ms": 0,
            "model_name": model_name,
            "error": "missing_api_key",
        }

    # Format multi-turn conversation into prompt
    history_snippets = []
    if conversation_history:
        # Take at most last 6 turns to avoid token bloat
        for msg in conversation_history[-6:]:
            role_label = "Người dùng" if msg.get("role") == "user" else "Trợ lý AI"
            content = (msg.get("content") or "").strip()
            if content:
                history_snippets.append(f"[{role_label}]: {content}")

    history_text = "\n".join(history_snippets) if history_snippets else "Chưa có hội thoại trước đó."

    full_prompt = f"""[THÔNG TIN NGƯỜI DÙNG & VAI TRÒ]
- Vai trò tài khoản: {user_role}

[DỮ LIỆU THỰC TẾ TRÍCH XUẤT TỪ HỆ THỐNG POSTGRESQL (GROUNDED CONTEXT)]
{context_text or 'Không có dữ liệu ngữ cảnh đặc thù.'}

[LỊCH SỬ HỘI THOẠI GẦN ĐÂY]
{history_text}

[CÂU HỎI MỚI NHẤT CỦA NGƯỜI DÙNG]
{user_question}

[YÊU CẦU ĐỊNH DẠNG VÀ PHẢN HỒI]
1. Trả lời trực tiếp, rõ ràng bằng tiếng Việt.
2. Sử dụng Markdown chuẩn: chia đoạn mạch lạc, dùng gạch đầu dòng, danh sách số và in đậm các điểm mấu chốt.
3. Nếu dựa trên dữ liệu thật của lô, hãy nêu rõ mã lô và số liệu tương ứng.
4. Nếu dữ liệu trong hệ thống còn thiếu để kết luận, hãy thành thật nêu rõ thông tin còn thiếu.
5. Luôn kèm lời khuyên nhắc nhở kiểm chứng thực địa trước khi áp dụng.
6. ĐẶC BIỆT: Nếu câu hỏi KHÔNG liên quan hoặc ít liên quan đến nông nghiệp, rau sạch, lô trồng hay trang trại (ví dụ toán học như 1+1, câu đố, kiến thức đời sống, thơ ca, lập trình...): Bắt buộc mở đầu câu trả lời bằng câu: "Tuy câu hỏi này không liên quan trực tiếp đến lĩnh vực quản lý trang trại và rau sạch, nhưng tôi vẫn có thể hỗ trợ giải đáp cho bạn như sau:". Sau đó trả lời chính xác, ngắn gọn và ở đoạn cuối khéo léo gợi ý người dùng quay lại các chủ đề về nông nghiệp GreenFarm AI."""

    start_time = time.perf_counter()
    candidate_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]
    if model_name not in candidate_models:
        candidate_models.insert(0, model_name)

    from google import genai
    from google.genai import types

    last_exc = None
    used_model = model_name

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=timeout_sec * 1000),
        )

        for candidate in candidate_models:
            try:
                response = client.models.generate_content(
                    model=candidate,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.3,
                        max_output_tokens=1500,
                    ),
                )
                output_text = (getattr(response, "text", None) or "").strip()
                if output_text:
                    used_model = candidate
                    latency_ms = round((time.perf_counter() - start_time) * 1000)
                    return {
                        "ok": True,
                        "text": output_text,
                        "latency_ms": latency_ms,
                        "model_name": used_model,
                        "error": "",
                    }
            except Exception as candidate_err:
                last_exc = candidate_err
                logger.warning("Gemini candidate model %s failed: %s", candidate, str(candidate_err))
                continue

        if last_exc:
            raise last_exc
        raise ValueError("Không nhận được phản hồi từ bất kỳ mô hình Gemini nào.")

    except Exception as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000)
        error_type = type(exc).__name__
        logger.warning("Gemini API call failed (%s): %s", error_type, str(exc))

        fallback_msg = (
            "Trợ lý Gemini hiện không thể phản hồi hoặc kết nối bị gián đoạn. "
            "Vui lòng kiểm tra lại kết nối mạng, hạn mức API key của bạn, hoặc thử gửi lại câu hỏi."
        )
        return {
            "ok": False,
            "text": fallback_msg,
            "latency_ms": latency_ms,
            "model_name": model_name,
            "error": error_type,
        }
