import json
from decimal import Decimal
from django.core.serializers.json import DjangoJSONEncoder
from django.http import JsonResponse


class ExtendedEncoder(DjangoJSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def api_response(data=None, message="", success=True, status=200, errors=None):
    payload = {
        "success": success,
        "message": message,
        "data": data,
        "errors": errors or [],
    }
    return JsonResponse(payload, status=status, encoder=ExtendedEncoder, safe=False)


def parse_body(request):
    """Safely parse JSON body or request.POST."""
    if request.content_type == "application/json" and request.body:
        try:
            return json.loads(request.body.decode("utf-8"))
        except Exception:
            return {}
    return request.POST.dict()
