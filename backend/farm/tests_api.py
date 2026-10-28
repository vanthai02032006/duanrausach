from datetime import date
from decimal import Decimal
import json
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from farm.models import CropLot, CropVariety, Harvest, Material

User = get_user_model()


class GreenFarmApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for name in ("Manager", "Technician", "Staff"):
            Group.objects.get_or_create(name=name)

        cls.manager = User.objects.create_user("manager_api", password="TestPassword123!", first_name="Quản lý API")
        cls.manager.groups.add(Group.objects.get(name="Manager"))

        cls.staff = User.objects.create_user("staff_api", password="TestPassword123!", first_name="Nhân viên API")
        cls.staff.groups.add(Group.objects.get(name="Staff"))

        cls.variety = CropVariety.objects.create(name="Cải ngọt Test", expected_days=30)
        cls.lot = CropLot.objects.create(
            code="LOT-TEST-01",
            name="Lô kiểm thử API",
            area_m2=Decimal("250.00"),
            variety=cls.variety,
            planting_date=date(2026, 10, 1),
            created_by=cls.manager,
        )
        cls.material = Material.objects.create(
            name="Phân vi sinh Test",
            category=Material.Category.BIO,
            unit="kg",
            quantity=Decimal("50.00"),
            minimum_quantity=Decimal("10.00"),
            unit_price=Decimal("15000.00"),
        )

    def test_csrf_endpoint(self):
        response = self.client.get(reverse("api_csrf"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertFalse(data["data"]["authenticated"])

    def test_login_and_me_endpoint(self):
        login_res = self.client.post(
            reverse("api_login"),
            data=json.dumps({"username": "manager_api", "password": "TestPassword123!"}),
            content_type="application/json",
        )
        self.assertEqual(login_res.status_code, 200)
        res_data = login_res.json()
        self.assertTrue(res_data["success"])
        self.assertEqual(res_data["data"]["role"], "Manager")

        me_res = self.client.get(reverse("api_me"))
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["data"]["username"], "manager_api")

    def test_dashboard_endpoint(self):
        self.client.force_login(self.manager)
        response = self.client.get(reverse("api_dashboard"))
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertGreaterEqual(data["total_lots"], 1)
        self.assertIn("monthly_revenue", data)

    def test_lots_list_endpoint(self):
        self.client.force_login(self.staff)
        response = self.client.get(reverse("api_lots"))
        self.assertEqual(response.status_code, 200)
        lots = response.json()["data"]
        self.assertGreaterEqual(len(lots), 1)
        self.assertEqual(lots[0]["code"], "LOT-TEST-01")

    def test_material_usage_validation(self):
        self.client.force_login(self.staff)
        # Try to use 100 kg when only 50 kg in stock
        res = self.client.post(
            reverse("api_material_use"),
            data=json.dumps({
                "material_id": self.material.id,
                "lot_id": self.lot.id,
                "quantity": 100,
                "note": "Quá tồn kho",
            }),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()["success"])
        self.assertIn("không đủ", res.json()["message"])

    def test_trace_endpoint(self):
        response = self.client.get(reverse("api_trace") + f"?code={self.lot.code}")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertTrue(data["found"])
        self.assertEqual(data["lot"]["code"], "LOT-TEST-01")
