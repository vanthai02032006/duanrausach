from django.views.decorators.http import require_GET
from farm.services.trace_service import trace_by_code
from farm.utils.helpers import api_response


@require_GET
def trace_view(request):
    code = request.GET.get("code", "").strip()
    if not code:
        return api_response({"searched": False, "code": ""})

    data = trace_by_code(code)
    return api_response(data)
