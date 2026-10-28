from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import AIInteraction, CareLog, CropLot, CropVariety, Harvest, Material

User = get_user_model()


class GreenFarmAccessAndWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for name in ("Manager", "Technician", "Staff"):
            Group.objects.get_or_create(name=name)

        cls.manager = User.objects.create_user("manager_test", password="TestPassword123!", first_name="Quản lý")
        cls.manager.groups.add(Group.objects.get(name="Manager"))
        cls.technician = User.objects.create_user("tech_test", password="TestPassword123!", first_name="Kỹ thuật")
        cls.technician.groups.add(Group.objects.get(name="Technician"))
        cls.staff = User.objects.create_user("staff_test", password="TestPassword123!", first_name="Nhân viên")
        cls.staff.groups.add(Group.objects.get(name="Staff"))

        cls.variety = CropVariety.objects.create(
            name="Xà lách test", expected_days=35, care_notes="Chỉ là dữ liệu kiểm thử."
        )
        cls.lot = CropLot.objects.create(
            code="TEST-A1", name="Lô kiểm thử", area_m2=Decimal("100.00"),
            variety=cls.variety, planting_date=date(2026, 10, 1), created_by=cls.manager,
        )
        cls.material = Material.objects.create(
            name="Phân hữu cơ test", category=Material.Category.FERTILIZER,
            unit="kg", quantity=Decimal("10.00"), minimum_quantity=Decimal("2.00"),
            unit_price=Decimal("1000.00"),
        )

    def test_login_and_dashboard(self):
        self.assertTrue(self.client.login(username="manager_test", password="TestPassword123!"))
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "GreenFarm")

    def test_staff_cannot_open_account_management(self):
        self.client.login(username="staff_test", password="TestPassword123!")
        response = self.client.get(reverse("accounts"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("dashboard"))

    def test_staff_cannot_create_harvest(self):
        self.client.login(username="staff_test", password="TestPassword123!")
        response = self.client.get(reverse("harvest_create"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("dashboard"))

    def test_staff_can_view_trace_search(self):
        harvest = Harvest.objects.create(
            lot=self.lot, product_name="Xà lách", quantity_kg=Decimal("12.50"),
            harvested_at=date(2026, 10, 25), recorded_by=self.technician,
        )
        self.client.login(username="staff_test", password="TestPassword123!")
        response = self.client.get(reverse("trace"), {"code": harvest.trace_code})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, harvest.trace_code)
        self.assertContains(response, "Xà lách")

    def test_lot_search_filters_by_code(self):
        self.client.login(username="manager_test", password="TestPassword123!")
        response = self.client.get(reverse("lots"), {"q": "TEST-A1"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "TEST-A1")

    def test_invalid_crop_date_order_is_rejected(self):
        self.client.login(username="manager_test", password="TestPassword123!")
        response = self.client.post(reverse("lot_create"), {
            "code": "TEST-BAD", "name": "Ngày sai", "area_m2": "100",
            "variety": str(self.variety.pk), "planting_date": "2026-10-20",
            "expected_harvest_date": "2026-10-10", "status": CropLot.Status.GROWING,
            "notes": "",
        })
        self.assertEqual(response.status_code, 200)
        self.assertFalse(CropLot.objects.filter(code="TEST-BAD").exists())

    def test_health_endpoint(self):
        response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"status": "ok", "service": "GreenFarm AI", "framework": "Django"})

    def test_material_usage_decreases_stock_transactionally(self):
        self.client.login(username="tech_test", password="TestPassword123!")
        response = self.client.post(reverse("material_usage_create"), {
            "material": str(self.material.pk), "lot": str(self.lot.pk),
            "quantity": "2.50", "note": "Test dùng vật tư",
        })
        self.assertEqual(response.status_code, 302)
        self.material.refresh_from_db()
        self.assertEqual(self.material.quantity, Decimal("7.50"))

    def test_usage_cannot_exceed_stock(self):
        self.client.login(username="tech_test", password="TestPassword123!")
        response = self.client.post(reverse("material_usage_create"), {
            "material": str(self.material.pk), "lot": str(self.lot.pk),
            "quantity": "100.00", "note": "Vượt tồn kho",
        })
        self.assertEqual(response.status_code, 200)
        self.material.refresh_from_db()
        self.assertEqual(self.material.quantity, Decimal("10.00"))

    @override_settings(GEMINI_API_KEY="", GEMINI_MODEL="gemini-3.8-flash")
    def test_ai_missing_key_is_logged_as_failure_not_fake_success(self):
        self.client.login(username="manager_test", password="TestPassword123!")
        response = self.client.post(reverse("ai_assistant"), {
            "task": "summary", "lot": str(self.lot.pk), "question": "Tóm tắt nhật ký",
        })
        self.assertEqual(response.status_code, 200)
        interaction = AIInteraction.objects.latest("created_at")
        self.assertFalse(interaction.succeeded)
        self.assertEqual(interaction.error_category, "missing_api_key")
        self.assertContains(response, "Chưa cấu hình GEMINI_API_KEY")

