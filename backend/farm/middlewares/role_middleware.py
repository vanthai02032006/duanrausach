import logging
from django.http import JsonResponse
from farm.utils.roles import get_user_role

logger = logging.getLogger(__name__)


class RoleAndApiMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, "user"):
            request.user_role = get_user_role(request.user)
        response = self.get_response(request)
        return response

    def process_exception(self, request, exception):
        if request.path.startswith("/api/"):
            logger.exception("Unhandled API error at %s", request.path)
            return JsonResponse({
                "success": False,
                "message": "Đã xảy ra lỗi hệ thống ở phía máy chủ.",
                "error": str(exception),
            }, status=500)
        return None
