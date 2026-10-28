from datetime import date
from decimal import Decimal
import io
import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image

from farm.models import CropLot, CropVariety, Harvest, CareLog
from farm.services.qr_service import (
    build_public_trace_url,
    generate_qr_image,
    generate_qr_data_uri,
    generate_printable_label_png,
)
from farm.services.trace_service import (
    extract_code_from_raw_input,
    trace_by_code,
    revoke_trace_code,
    regenerate_trace_code,
)

User = get_user_model()


class GreenFarmTraceabilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for name in ("Manager", "Technician", "Staff"):
            Group.objects.get_or_create(name=name)

        cls.manager = User.objects.create_user(
            "trace_manager", 
            email="manager_secret@greenfarm.internal", 
            password="Password123!", 
            first_name="Quản lý Trưởng"
        )
        cls.manager.groups.add(Group.objects.get(name="Manager"))

        cls.technician = User.objects.create_user(
            "trace_tech", 
            email="tech_private@greenfarm.internal", 
            password="Password123!", 
            first_name="Kỹ thuật viên Trực"
        )
        cls.technician.groups.add(Group.objects.get(name="Technician"))

        cls.staff = User.objects.create_user(
            "trace_staff", 
            email="staff_confidential@greenfarm.internal", 
            password="Password123!", 
            first_name="Nhân viên Vườn"
        )
        cls.staff.groups.add(Group.objects.get(name="Staff"))

        # Crop Variety
        cls.variety = CropVariety.objects.create(
            name="Cải thìa Thủy canh VietGAP",
            scientific_name="Brassica rapa subsp. chinensis",
            expected_days=30,
            care_notes="Nhiệt độ tối ưu 22-28C, pH 6.0-6.8"
        )

        # Crop Lot (Active)
        cls.lot = CropLot.objects.create(
            code="LOT-RAU-01",
            name="Lô Cải thìa Khu A",
            area_m2=Decimal("250.00"),
            variety=cls.variety,
            planting_date=date(2026, 10, 1),
            created_by=cls.manager,
            status=CropLot.Status.GROWING,
            is_active=True
        )

        # Care Log
        cls.care_log = CareLog.objects.create(
            lot=cls.lot,
            activity=CareLog.Activity.FERTILIZE,
            note="Bón bổ sung dung dịch hữu cơ sinh học đợt 2",
            observation="Cây phát triển đều, lá xanh đậm",
            performed_by=cls.technician
        )

        # Harvest with Unique Trace Code
        cls.harvest = Harvest.objects.create(
            lot=cls.lot,
            product_name="Cải thìa Thủy canh VietGAP (Túi 500g)",
            harvested_at=date(2026, 10, 25),
            quantity_kg=Decimal("120.50"),
            quality=Harvest.Quality.PASS,
            recorded_by=cls.manager,
            notes="Thu hoạch sáng sớm, độ tươi loại 1",
            is_active=True
        )

        # Lot without harvest for testing edge case
        cls.lot_no_harvest = CropLot.objects.create(
            code="LOT-NEW-02",
            name="Lô Rau Mới Gieo",
            area_m2=Decimal("150.00"),
            variety=cls.variety,
            planting_date=date(2026, 10, 26),
            created_by=cls.technician,
            status=CropLot.Status.GROWING,
            is_active=True
        )

    # -------------------------------------------------------------
    # 1. Tạo QR thành công
    # -------------------------------------------------------------
    def test_01_qr_code_generation(self):
        url = "https://greenfarm.vn/trace/GF-1234567890AB/"
        png_bytes = generate_qr_image(url, format="png")
        self.assertIsInstance(png_bytes, bytes)
        self.assertTrue(len(png_bytes) > 100)

        # Verify PIL can open it as a valid PNG
        img = Image.open(io.BytesIO(png_bytes))
        self.assertEqual(img.format, "PNG")

        # Test Data URI
        data_uri = generate_qr_data_uri(url, format="png")
        self.assertTrue(data_uri.startswith("data:image/png;base64,"))

        # Test Printable Label Image
        label_bytes = generate_printable_label_png(self.harvest, url)
        self.assertIsInstance(label_bytes, bytes)
        self.assertTrue(len(label_bytes) > 100)

    # -------------------------------------------------------------
    # 2. QR dẫn đến đúng trang truy xuất
    # -------------------------------------------------------------
    def test_02_qr_url_canonical(self):
        class DummyRequest:
            def build_absolute_uri(self, path):
                return f"https://greenfarm-live.vn{path}"

        url = build_public_trace_url(DummyRequest(), self.harvest.trace_code)
        self.assertEqual(url, f"https://greenfarm-live.vn/trace/{self.harvest.trace_code}/")
        self.assertNotIn("localhost:8000", url)

    # -------------------------------------------------------------
    # 3. Tra cứu bằng mã thủ công
    # -------------------------------------------------------------
    def test_03_manual_lookup_success(self):
        # By Harvest Trace Code via GET parameter
        response = self.client.get(reverse("trace"), {"code": self.harvest.trace_code})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.harvest.product_name)
        self.assertContains(response, "Có dữ liệu truy xuất")
        self.assertContains(response, self.lot.code)

        # By Harvest Trace Code via URL path: /trace/<code-or-token>/
        response2 = self.client.get(reverse("public_trace_detail", args=[self.harvest.trace_code]))
        self.assertEqual(response2.status_code, 200)
        self.assertContains(response2, self.harvest.product_name)

        # By Lot Code
        response3 = self.client.get(reverse("trace"), {"code": self.lot.code})
        self.assertEqual(response3.status_code, 200)
        self.assertContains(response3, self.lot.name)

    # -------------------------------------------------------------
    # 4. Không tìm thấy mã
    # -------------------------------------------------------------
    def test_04_code_not_found(self):
        # Web template
        response = self.client.get(reverse("trace"), {"code": "GF-NONEXISTENT999"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Không tìm thấy dữ liệu truy xuất")

        # API endpoint should return 404
        api_res = self.client.get("/api/trace/?code=GF-NONEXISTENT999")
        self.assertEqual(api_res.status_code, 404)
        data = api_res.json()
        self.assertFalse(data.get("found"))

    # -------------------------------------------------------------
    # 5. Mã đã bị vô hiệu hóa
    # -------------------------------------------------------------
    def test_05_revoked_code(self):
        # Revoke the harvest trace code
        success, msg = revoke_trace_code(self.harvest.trace_code, self.manager, reason="Lô hàng kiểm tra lại dư lượng nitrat")
        self.assertTrue(success)

        self.harvest.refresh_from_db()
        self.assertFalse(self.harvest.is_active)
        self.assertEqual(self.harvest.revocation_reason, "Lô hàng kiểm tra lại dư lượng nitrat")

        # Public lookup should show revoked warning
        response = self.client.get(reverse("public_trace_detail", args=[self.harvest.trace_code]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Mã không còn hiệu lực")
        self.assertContains(response, "Lô hàng kiểm tra lại dư lượng nitrat")

        # API should return HTTP 410 (Gone) with status="revoked"
        api_res = self.client.get(f"/api/trace/{self.harvest.trace_code}/")
        self.assertEqual(api_res.status_code, 410)
        data = api_res.json()
        self.assertEqual(data.get("status"), "revoked")

    # -------------------------------------------------------------
    # 6. Không có dữ liệu thu hoạch
    # -------------------------------------------------------------
    def test_06_lot_without_harvests(self):
        # New lot without harvests should display without error
        response = self.client.get(reverse("trace"), {"code": self.lot_no_harvest.code})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.lot_no_harvest.name)
        self.assertContains(response, "Chưa có dữ liệu thu hoạch")

    # -------------------------------------------------------------
    # 7. Không làm lộ thông tin nội bộ của nhân viên
    # -------------------------------------------------------------
    def test_07_no_internal_info_leaked(self):
        # Query public trace
        response = self.client.get(reverse("public_trace_detail", args=[self.harvest.trace_code]))
        content = response.content.decode("utf-8")

        # Must not contain private emails or username
        self.assertNotIn("manager_secret@greenfarm.internal", content)
        self.assertNotIn("tech_private@greenfarm.internal", content)
        self.assertNotIn("staff_confidential@greenfarm.internal", content)
        self.assertNotIn("trace_tech", content)
        self.assertNotIn("trace_staff", content)

        # Check API response
        api_res = self.client.get(f"/api/trace/{self.harvest.trace_code}/")
        api_json_str = json.dumps(api_res.json())
        self.assertNotIn("manager_secret", api_json_str)
        self.assertNotIn("tech_private", api_json_str)
        self.assertNotIn("trace_tech", api_json_str)

    # -------------------------------------------------------------
    # 8. Người không có quyền không thể tạo, sửa, thu hồi hoặc cấp lại mã
    # -------------------------------------------------------------
    def test_08_permission_enforcement(self):
        # Anonymous user cannot revoke
        url_revoke = reverse("trace_revoke", args=[self.harvest.trace_code])
        res_anon = self.client.post(url_revoke, {"reason": "Hacking"})
        self.assertEqual(res_anon.status_code, 302)  # Redirect to login

        # Staff user cannot revoke
        self.client.login(username="trace_staff", password="Password123!")
        res_staff = self.client.post(url_revoke, {"reason": "Staff attempt"})
        self.assertEqual(res_staff.status_code, 302)  # Redirect to dashboard
        self.client.logout()

        # Manager CAN revoke
        self.client.login(username="trace_manager", password="Password123!")
        res_mgr = self.client.post(url_revoke, {"reason": "Authorized revocation"})
        self.assertEqual(res_mgr.status_code, 302)
        self.harvest.refresh_from_db()
        self.assertFalse(self.harvest.is_active)

        # Manager CAN regenerate
        url_regen = reverse("trace_regenerate", args=[self.harvest.trace_code])
        res_regen = self.client.post(url_regen)
        self.assertEqual(res_regen.status_code, 302)
        self.harvest.refresh_from_db()
        self.assertTrue(self.harvest.is_active)
        self.client.logout()

    # -------------------------------------------------------------
    # 9. Camera không khả dụng vẫn có thể tra cứu thủ công
    # -------------------------------------------------------------
    def test_09_camera_unavailable_manual_fallback(self):
        # User without camera can always submit the manual form
        response = self.client.get(reverse("trace"), {"code": self.harvest.trace_code})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="pane-manual"')
        self.assertContains(response, self.harvest.product_name)

    # -------------------------------------------------------------
    # 10. QR giả mạo hoặc URL không hợp lệ không được thực thi
    # -------------------------------------------------------------
    def test_10_malicious_qr_sanitization(self):
        # XSS attempt in QR
        xss_code = '<script>alert("XSS")</script>'
        clean = extract_code_from_raw_input(xss_code)
        self.assertNotIn("<", clean)
        self.assertNotIn(">", clean)
        self.assertNotIn("script", clean)

        # SQL Injection attempt in QR
        sqli_code = "GF-123' OR 1=1; DROP TABLE--"
        clean_sqli = extract_code_from_raw_input(sqli_code)
        self.assertNotIn("'", clean_sqli)
        self.assertNotIn(" ", clean_sqli)
        self.assertNotIn(";", clean_sqli)

        # Full URL containing query param
        full_url = "https://fakedomain.org/trace/?code=GF-998877665544"
        clean_url = extract_code_from_raw_input(full_url)
        self.assertEqual(clean_url, "GF-998877665544")

        # Full URL containing path
        path_url = "https://greenfarm.vn/trace/GF-AABBCCDDEEFF/"
        clean_path = extract_code_from_raw_input(path_url)
        self.assertEqual(clean_path, "GF-AABBCCDDEEFF")

    # -------------------------------------------------------------
    # 11. Chức năng hoạt động trên desktop và mobile
    # -------------------------------------------------------------
    def test_11_desktop_and_mobile_views(self):
        # Mobile user-agent
        mobile_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
        response = self.client.get(
            reverse("public_trace_detail", args=[self.harvest.trace_code]),
            HTTP_USER_AGENT=mobile_ua
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "html5-qrcode.min.js")
        self.assertContains(response, "viewport")

        # Printable sticker label view
        label_res = self.client.get(reverse("trace_label", args=[self.harvest.trace_code]))
        self.assertEqual(label_res.status_code, 200)
        self.assertContains(label_res, "printable-sticker-target")
        self.assertContains(label_res, self.harvest.product_name)

    # -------------------------------------------------------------
    # 12. Chức năng cũ của trang truy xuất vẫn hoạt động
    # -------------------------------------------------------------
    def test_12_legacy_compatibility(self):
        # Old lot code lookup
        response = self.client.get(reverse("trace"), {"code": self.lot.code})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.lot.code)
        self.assertContains(response, self.lot.name)
        self.assertContains(response, self.variety.name)
