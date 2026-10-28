"""QR Code Generation and Label Rendering Service for GreenFarm AI.

Generates QR codes encoding public origin-tracing URLs and renders printable
product stamps/labels with QR codes, harvest metadata, and farm branding.
"""
import base64
import io
import logging
from django.conf import settings
from django.urls import reverse
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


def get_lan_ip():
    """Detect machine's local LAN IP so mobile phones on the same Wi-Fi can scan and open QR."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def build_public_trace_url(request, trace_code):
    """Build the full canonical public trace URL for a given trace code.
    
    If running locally on localhost/127.0.0.1, auto-replaces with local LAN IP
    so mobile phones connected to the same Wi-Fi can scan and open the URL seamlessly.
    """
    clean_code = (trace_code or "").strip()
    try:
        rel_path = reverse("public_trace_detail", kwargs={"code": clean_code})
    except Exception:
        rel_path = f"/trace/{clean_code}/"

    if request:
        uri = request.build_absolute_uri(rel_path)
        # If the request host is loopback/localhost, replace with configured SITE_URL or LAN IP for mobile scan accessibility
        if hasattr(request, "get_host"):
            host = request.get_host()
            if "localhost" in host or "127.0.0.1" in host:
                base = getattr(settings, "SITE_URL", "").strip().rstrip("/")
                if base:
                    return f"{base}{rel_path}"
                lan_ip = get_lan_ip()
                if lan_ip and lan_ip != "127.0.0.1":
                    port_part = ""
                    if ":" in host:
                        port_part = ":" + host.split(":", 1)[1]
                    scheme = getattr(request, "scheme", "http") or "http"
                    return f"{scheme}://{lan_ip}{port_part}{rel_path}"
        return uri

    base = getattr(settings, "SITE_URL", "").strip().rstrip("/")
    if base:
        return f"{base}{rel_path}"

    lan_ip = get_lan_ip()
    host_to_use = lan_ip if lan_ip != "127.0.0.1" else "localhost"
    return f"http://{host_to_use}:8000{rel_path}"


def generate_qr_image(url_or_text, format="png", box_size=8, border=2, fill_color="#064e3b", back_color="#ffffff"):
    """Generate raw QR code image bytes.
    
    Args:
        url_or_text (str): The target URL or code to encode.
        format (str): 'png' or 'jpeg'.
        box_size (int): Size in pixels for each box in the QR grid.
        border (int): Quiet zone border width in boxes.
        fill_color (str): Hex color or color name for the QR modules (default emerald green).
        back_color (str): Hex color or color name for background (default white).
        
    Returns:
        bytes: Binary image data.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(url_or_text)
    qr.make(fit=True)

    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    buffer = io.BytesIO()
    img.save(buffer, format=format.upper())
    return buffer.getvalue()


def generate_qr_data_uri(url_or_text, format="png", box_size=6, border=2):
    """Generate base64 data URI for direct inline embedding in HTML/CSS."""
    raw_bytes = generate_qr_image(url_or_text, format=format, box_size=box_size, border=border)
    b64 = base64.b64encode(raw_bytes).decode("ascii")
    return f"data:image/{format.lower()};base64,{b64}"


def generate_printable_label_png(harvest, public_url=None):
    """Generate a high-resolution printable sticker label image (PNG) for a harvest batch.
    
    Dimensions: 600x380 px (approx 60x38mm standard thermal label size).
    Contains:
    - GreenFarm AI header branding
    - QR Code
    - Vegetable / Product Name
    - Variety
    - Lot Code
    - Harvest Date & Quantity
    - Trace Code
    """
    width = 620
    height = 360

    img = Image.new("RGB", (width, height), color="#ffffff")
    draw = ImageDraw.Draw(img)

    # 1. Outer Border & Header Banner
    draw.rounded_rectangle([(10, 10), (width - 10, height - 10)], radius=12, outline="#059669", width=2)
    draw.rounded_rectangle([(12, 12), (width - 12, 54)], radius=8, fill="#064e3b")

    # Header text
    try:
        font_header = ImageFont.load_default()
    except Exception:
        font_header = None

    draw.text((24, 24), "GREENFARM AI · NÔNG SẢN SẠCH MINH BẠCH", fill="#ffffff", font=font_header)
    draw.text((width - 140, 24), "TRUY XUẤT NGUỒN GỐC", fill="#a7f3d0", font=font_header)

    # 2. QR Code on Left
    target_url = public_url or f"/trace/{harvest.trace_code}/"
    qr_bytes = generate_qr_image(target_url, format="png", box_size=5, border=1)
    qr_img = Image.open(io.BytesIO(qr_bytes)).convert("RGB")
    qr_img = qr_img.resize((190, 190))
    img.paste(qr_img, (26, 75))

    # Trace Code pill below QR
    draw.rectangle([(26, 275), (216, 305)], fill="#ecfdf5", outline="#a7f3d0", width=1)
    draw.text((36, 285), harvest.trace_code, fill="#047857", font=font_header)

    draw.text((26, 320), "Quét mã để xem nhật ký", fill="#64748b", font=font_header)

    # 3. Product Info on Right
    x_info = 236
    draw.text((x_info, 78), f"Sản phẩm:", fill="#64748b", font=font_header)
    draw.text((x_info, 96), f"{harvest.product_name}", fill="#064e3b", font=font_header)

    draw.text((x_info, 130), f"Giống cây: {harvest.lot.variety.name}", fill="#1e293b", font=font_header)
    draw.text((x_info, 156), f"Mã lô trồng: {harvest.lot.code} ({harvest.lot.name})", fill="#1e293b", font=font_header)
    draw.text((x_info, 182), f"Ngày thu hoạch: {harvest.harvested_at.strftime('%d/%m/%Y')}", fill="#1e293b", font=font_header)
    draw.text((x_info, 208), f"Khối lượng tịnh: {harvest.quantity_kg:.2f} kg", fill="#1e293b", font=font_header)
    draw.text((x_info, 234), f"Chất lượng: {harvest.get_quality_display()}", fill="#047857", font=font_header)

    draw.line([(x_info, 268), (width - 30, 268)], fill="#e2e8f0", width=1)
    draw.text((x_info, 280), "Cam kết tiêu chuẩn rau sạch, minh bạch từ gieo trồng đến bàn ăn.", fill="#64748b", font=font_header)
    draw.text((x_info, 304), f"Hệ thống chứng thực GreenFarm AI · www.greenfarm.local", fill="#94a3b8", font=font_header)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
