"""Traceability and QR Code Controller for GreenFarm AI.

Endpoints:
- GET  /api/trace/?code=... (or /api/trace/<code-or-token>/) -> Public Trace JSON
- GET  /api/trace/<code-or-token>/qr/ -> QR Code PNG/SVG Image
- GET  /api/trace/<code-or-token>/label/ -> Printable Label PNG Image
- POST /api/trace/<code-or-token>/revoke/ -> Manager only: Revoke code
- POST /api/trace/<code-or-token>/regenerate/ -> Manager only: Regenerate code
"""
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from farm.models import Harvest
from farm.services.qr_service import (
    build_public_trace_url,
    generate_printable_label_png,
    generate_qr_data_uri,
    generate_qr_image,
)
from farm.services.trace_service import (
    extract_code_from_raw_input,
    regenerate_trace_code,
    revoke_trace_code,
    trace_by_code,
)
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import role_required


@require_GET
def trace_view(request, code=None):
    """Public API endpoint to look up vegetable origin data by code.
    
    Accepts code either via URL route parameter or query string `?code=...`.
    Does NOT require authentication for transparent public access.
    """
    lookup_code = code or request.GET.get("code", "")
    lookup_code = extract_code_from_raw_input(lookup_code)

    if not lookup_code:
        return api_response({
            "searched": False,
            "found": False,
            "code": "",
            "message": "Vui lòng cung cấp mã lô hoặc mã truy xuất thu hoạch.",
        })

    data = trace_by_code(lookup_code, include_internal=request.user.is_authenticated)

    # Attach public URL and QR data URI if record is found
    if data and data.get("found"):
        target_code = data.get("code", lookup_code)
        public_url = build_public_trace_url(request, target_code)
        qr_uri = generate_qr_data_uri(public_url, format="png")
        data["public_url"] = public_url
        data["qr_data_uri"] = qr_uri
        data["qr"] = {
            "data_uri": qr_uri,
            "image_url": f"/api/trace/{target_code}/qr/",
            "label_url": f"/api/trace/{target_code}/label/",
            "public_url": public_url,
        }

        if not data.get("is_active"):
            # HTTP 410 Gone / Revoked notice with payload
            return JsonResponse({
                "success": False,
                "status": "revoked",
                "found": True,
                "is_active": False,
                "code": target_code,
                "message": data.get("message", "Mã truy xuất không còn hiệu lực."),
                "data": data,
                "errors": ["trace_code_revoked"],
            }, status=410)

        return api_response(data)

    # If code not found
    return JsonResponse({
        "success": False,
        "status": "not_found",
        "found": False,
        "code": lookup_code,
        "message": data.get("message", "Không tìm thấy mã truy xuất trong hệ thống."),
        "data": data,
        "errors": ["trace_code_not_found"],
    }, status=404)


@require_GET
def trace_qr_image_view(request, code):
    """Returns the binary QR code image for a trace code.
    
    Query parameters:
    - download=1: triggers browser file download as attachment.
    - size=8: box size in pixels (default 8).
    """
    clean_code = extract_code_from_raw_input(code)
    public_url = build_public_trace_url(request, clean_code)

    box_size = 8
    try:
        box_size = max(4, min(24, int(request.GET.get("size", 8))))
    except (ValueError, TypeError):
        box_size = 8

    img_bytes = generate_qr_image(public_url, format="png", box_size=box_size, border=2)
    response = HttpResponse(img_bytes, content_type="image/png")

    if request.GET.get("download") == "1":
        response["Content-Disposition"] = f'attachment; filename="qr-{clean_code}.png"'
    else:
        response["Content-Disposition"] = f'inline; filename="qr-{clean_code}.png"'

    return response


@require_GET
def trace_label_image_view(request, code):
    """Generates a high-quality printable sticker label image (PNG) for a harvest batch."""
    clean_code = extract_code_from_raw_input(code)
    harvest = Harvest.objects.filter(trace_code__iexact=clean_code).select_related("lot__variety").first()
    if not harvest:
        return JsonResponse({"success": False, "message": "Không tìm thấy phiếu thu hoạch."}, status=404)

    public_url = build_public_trace_url(request, harvest.trace_code)
    label_bytes = generate_printable_label_png(harvest, public_url=public_url)

    response = HttpResponse(label_bytes, content_type="image/png")
    if request.GET.get("download") == "1":
        response["Content-Disposition"] = f'attachment; filename="label-{clean_code}.png"'
    else:
        response["Content-Disposition"] = f'inline; filename="label-{clean_code}.png"'

    return response


@require_POST
@role_required("Manager")
def trace_revoke_view(request, code):
    """Manager only endpoint: Revoke or disable a trace code."""
    data = parse_body(request)
    reason = (data.get("reason") or "").strip()

    clean_code = extract_code_from_raw_input(code)
    success, msg = revoke_trace_code(clean_code, request.user, reason=reason)
    if not success:
        return api_response(message=msg, success=False, status=404)

    return api_response(message=msg)


@require_POST
@role_required("Manager")
def trace_regenerate_view(request, code):
    """Manager only endpoint: Regenerate a new unguessable trace code for a harvest batch."""
    clean_code = extract_code_from_raw_input(code)
    harvest, msg = regenerate_trace_code(clean_code, request.user)
    if not harvest:
        return api_response(message=msg, success=False, status=404)

    return api_response({
        "old_code": clean_code,
        "new_code": harvest.trace_code,
        "harvest_id": harvest.id,
    }, message=msg)
