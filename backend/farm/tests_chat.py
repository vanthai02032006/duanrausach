"""Unit and Integration Tests for GreenFarm AI Chatbot.

Verifies:
1. Unauthenticated users cannot access chat endpoints (401).
2. Users can only access/read their own conversations (isolation).
3. Access to crop lots outside permitted role/scope is rejected (403).
4. Creating conversation succeeds with correct defaults.
5. Sending messages correctly persists user & assistant records.
6. Gemini service failure/timeout is handled gracefully without crash.
7. Missing GEMINI_API_KEY returns a clear, helpful message.
8. Unrelated/empty data returns honest notices, preventing hallucinations.
9. Message feedback (helpful/not helpful) is stored and retrieved correctly.
10. Roles cannot be forged through payload manipulation.
11. Deletion of conversation enforces ownership and cascades properly.
12. Legacy farm management & AI monitor functionality remains intact.
"""
from datetime import date
from decimal import Decimal
import json
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from django.urls import reverse
from farm.models import (
    ChatConversation,
    ChatMessage,
    ChatFeedback,
    CropLot,
    CropVariety,
    CareLog,
    Material,
    KnowledgeArticle,
)
from farm.services.farm_context_service import can_user_access_lot, retrieve_farm_context

User = get_user_model()


class ChatbotTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for name in ("Manager", "Technician", "Staff"):
            Group.objects.get_or_create(name=name)

        cls.manager = User.objects.create_user("manager_chat", password="Password123!", first_name="Quan Ly")
        cls.manager.groups.add(Group.objects.get(name="Manager"))

        cls.tech = User.objects.create_user("tech_chat", password="Password123!", first_name="Ky Thuat")
        cls.tech.groups.add(Group.objects.get(name="Technician"))

        cls.staff = User.objects.create_user("staff_chat", password="Password123!", first_name="Nhan Vien")
        cls.staff.groups.add(Group.objects.get(name="Staff"))

        cls.other_user = User.objects.create_user("other_chat", password="Password123!", first_name="Nguoi Khac")
        cls.other_user.groups.add(Group.objects.get(name="Staff"))

        cls.variety = CropVariety.objects.create(name="Xà lách Lô Gô", expected_days=35)
        cls.lot_active = CropLot.objects.create(
            code="LOT-ACT-01",
            name="Lô xà lách đang trồng",
            area_m2=Decimal("300.00"),
            variety=cls.variety,
            planting_date=date(2026, 10, 1),
            status=CropLot.Status.GROWING,
            created_by=cls.manager,
        )
        cls.lot_harvested = CropLot.objects.create(
            code="LOT-HARV-99",
            name="Lô đã thu hoạch cũ",
            area_m2=Decimal("200.00"),
            variety=cls.variety,
            planting_date=date(2026, 8, 1),
            status=CropLot.Status.HARVESTED,
            created_by=cls.manager,
        )
        cls.article = KnowledgeArticle.objects.create(
            title="Kỹ thuật tưới xà lách",
            category="Quy trình chuẩn",
            variety=cls.variety,
            content="Tưới nước buổi sáng sớm, giữ ẩm đất 60-70%. Không tưới đọng lá ban đêm.",
            tags="xà lách, tưới nước, độ ẩm",
            is_verified=True,
            is_active=True,
        )

    # 1. Unauthenticated users cannot access chat endpoints
    def test_01_unauthenticated_rejected(self):
        conv_url = reverse("api_chat_conversations")
        res_get = self.client.get(conv_url)
        self.assertEqual(res_get.status_code, 401)

        res_post = self.client.post(conv_url, data=json.dumps({"title": "Test"}), content_type="application/json")
        self.assertEqual(res_post.status_code, 401)

    # 2. Users can only read their own conversations
    def test_02_conversation_isolation(self):
        conv_manager = ChatConversation.objects.create(user=self.manager, title="Cuộc họp của Quản lý")
        self.client.force_login(self.staff)

        # Staff listing should not see Manager's conversation
        list_res = self.client.get(reverse("api_chat_conversations"))
        self.assertEqual(list_res.status_code, 200)
        conv_ids = [c["id"] for c in list_res.json()["data"]]
        self.assertNotIn(conv_manager.id, conv_ids)

        # Direct access to Manager's conversation by Staff is 403 Forbidden
        detail_res = self.client.get(reverse("api_chat_conversation_detail", kwargs={"pk": conv_manager.id}))
        self.assertEqual(detail_res.status_code, 403)

    # 3. Cannot access lots outside permitted role/scope
    def test_03_lot_permission_enforcement(self):
        # Staff cannot query harvested lot that they never worked on
        self.assertFalse(can_user_access_lot(self.staff, self.lot_harvested))

        self.client.force_login(self.staff)
        # Attempt to create conversation with unauthorized lot
        res = self.client.post(
            reverse("api_chat_conversations"),
            data=json.dumps({"title": "Hỏi về lô cũ", "crop_lot_id": self.lot_harvested.id}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 403)

        # Manager can access all lots
        self.assertTrue(can_user_access_lot(self.manager, self.lot_harvested))

    # 4. Create conversation successfully
    def test_04_create_conversation_success(self):
        self.client.force_login(self.tech)
        res = self.client.post(
            reverse("api_chat_conversations"),
            data=json.dumps({"title": "Tư vấn dinh dưỡng", "crop_lot_id": self.lot_active.id}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        self.assertEqual(data["title"], "Tư vấn dinh dưỡng")
        self.assertEqual(data["crop_lot"]["code"], "LOT-ACT-01")

    # 5. Sending messages correctly stores user and assistant records
    @patch("farm.controllers.chat_controller.call_gemini_chat")
    def test_05_send_message_persists_records(self, mock_gemini):
        mock_gemini.return_value = {
            "ok": True,
            "text": "Dựa trên dữ liệu lô LOT-ACT-01, cây phát triển tốt.",
            "latency_ms": 320,
            "model_name": "gemini-3.8-flash",
            "error": "",
        }

        self.client.force_login(self.tech)
        conv = ChatConversation.objects.create(user=self.tech, title="Cuộc trò chuyện mới", crop_lot=self.lot_active)

        res = self.client.post(
            reverse("api_chat_send_message", kwargs={"pk": conv.id}),
            data=json.dumps({"content": "Cây xà lách hiện tại phát triển thế nào?"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]

        # Check messages stored in database
        self.assertEqual(conv.messages.count(), 2)
        user_m = conv.messages.filter(role=ChatMessage.Role.USER).first()
        assistant_m = conv.messages.filter(role=ChatMessage.Role.ASSISTANT).first()

        self.assertEqual(user_m.content, "Cây xà lách hiện tại phát triển thế nào?")
        self.assertIn("Dựa trên dữ liệu", assistant_m.content)
        self.assertEqual(assistant_m.model_name, "gemini-3.8-flash")
        self.assertIn("articles", assistant_m.references_data)

        # Check auto-rename on first message
        conv.refresh_from_db()
        self.assertNotEqual(conv.title, "Cuộc trò chuyện mới")
        self.assertIn("xà lách", conv.title)

    # 6. Gemini service failure/timeout is handled gracefully without crash
    @patch("farm.controllers.chat_controller.call_gemini_chat")
    def test_06_gemini_error_handling(self, mock_gemini):
        mock_gemini.return_value = {
            "ok": False,
            "text": "Trợ lý Gemini hiện không thể phản hồi hoặc kết nối bị gián đoạn.",
            "latency_ms": 1500,
            "model_name": "gemini-3.8-flash",
            "error": "TimeoutError",
        }

        self.client.force_login(self.manager)
        conv = ChatConversation.objects.create(user=self.manager, title="Test Timeout")

        res = self.client.post(
            reverse("api_chat_send_message", kwargs={"pk": conv.id}),
            data=json.dumps({"content": "Kiểm tra sâu bệnh"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        assistant_m = conv.messages.filter(role=ChatMessage.Role.ASSISTANT).first()
        self.assertEqual(assistant_m.status, "error")
        self.assertIn("không thể phản hồi", assistant_m.content)

    # 7. Missing GEMINI_API_KEY returns clear, helpful message
    @override_settings(GEMINI_API_KEY="")
    def test_07_missing_api_key_reported(self):
        from farm.services.gemini_service import call_gemini_chat
        res = call_gemini_chat(user_question="Xin chào")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "missing_api_key")
        self.assertIn("GEMINI_API_KEY", res["text"])

    # 8. Unrelated/empty data returns honest notice without hallucination
    def test_08_no_relevant_data_honesty(self):
        res = retrieve_farm_context(user=self.manager, lot=None, question="cây sầu riêng trĩu quả")
        context_text = res["context_text"]
        # Knowledge base doesn't have durian
        self.assertIn("Không tìm thấy tài liệu cụ thể phù hợp", context_text)

    # 9. Message feedback rating is stored and retrieved correctly
    def test_09_message_feedback_rating(self):
        self.client.force_login(self.tech)
        conv = ChatConversation.objects.create(user=self.tech, title="Hội thoại đánh giá")
        assistant_m = ChatMessage.objects.create(
            conversation=conv,
            role=ChatMessage.Role.ASSISTANT,
            content="Gợi ý tưới nước 500ml/m2.",
        )

        res = self.client.post(
            reverse("api_chat_feedback", kwargs={"pk": assistant_m.id}),
            data=json.dumps({"rating": 1, "comment": "Rất hữu ích"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

        # Verify feedback in DB
        fb = ChatFeedback.objects.get(message=assistant_m)
        self.assertEqual(fb.rating, 1)
        self.assertEqual(fb.comment, "Rất hữu ích")
        self.assertEqual(fb.user, self.tech)

    # 10. Role cannot be forged through payload manipulation
    def test_10_role_forgery_prevention(self):
        self.client.force_login(self.staff)
        # Even if payload sends fake role="Manager" or user_id=1, backend relies on request.user
        conv = ChatConversation.objects.create(user=self.staff, title="Staff Conv")

        with patch("farm.controllers.chat_controller.call_gemini_chat") as mock_gemini:
            mock_gemini.return_value = {"ok": True, "text": "OK", "latency_ms": 100, "model_name": "m", "error": ""}
            self.client.post(
                reverse("api_chat_send_message", kwargs={"pk": conv.id}),
                data=json.dumps({"content": "Hỏi câu hỏi", "role": "Manager", "user_id": 999}),
                content_type="application/json",
            )
            # Verify call_gemini_chat was passed user_role="Staff"
            _, kwargs = mock_gemini.call_args
            self.assertEqual(kwargs.get("user_role"), "Staff")

    # 11. Deletion enforces ownership and cascades properly
    def test_11_delete_conversation_ownership_and_cascade(self):
        conv = ChatConversation.objects.create(user=self.tech, title="Xóa tôi")
        msg = ChatMessage.objects.create(conversation=conv, role=ChatMessage.Role.USER, content="Tin nhắn thử")

        # Staff cannot delete Technician's conversation
        self.client.force_login(self.staff)
        res_fail = self.client.delete(reverse("api_chat_conversation_detail", kwargs={"pk": conv.id}))
        self.assertEqual(res_fail.status_code, 403)
        self.assertTrue(ChatConversation.objects.filter(pk=conv.id).exists())

        # Technician deletes own conversation -> cascades to messages
        self.client.force_login(self.tech)
        res_ok = self.client.delete(reverse("api_chat_conversation_detail", kwargs={"pk": conv.id}))
        self.assertEqual(res_ok.status_code, 200)
        self.assertFalse(ChatConversation.objects.filter(pk=conv.id).exists())
        self.assertFalse(ChatMessage.objects.filter(pk=msg.id).exists())

    # 12. Legacy farm management and AI monitor functionality remains intact
    def test_12_legacy_compatibility(self):
        self.client.force_login(self.manager)

        # Legacy AI Meta
        meta_res = self.client.get(reverse("api_ai_meta"))
        self.assertEqual(meta_res.status_code, 200)

        # AI Monitor
        monitor_res = self.client.get(reverse("api_ai_monitor"))
        self.assertEqual(monitor_res.status_code, 200)
        self.assertIn("interactions", monitor_res.json()["data"])

    # 13. Floating Chatbot Widget is rendered across base template views
    def test_13_chatbot_widget_rendered_in_templates(self):
        self.client.force_login(self.manager)

        # Dashboard view inherits base.html
        res = self.client.get(reverse("dashboard"))
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # Verify widget container, trigger button, chat window, and static assets
        self.assertIn('id="gf-chatbot-widget"', content)
        self.assertIn('id="gf-chat-trigger-btn"', content)
        self.assertIn('id="gf-chat-window"', content)
        self.assertIn('chatbot-widget.css', content)
        self.assertIn('chatbot-widget.js', content)
        self.assertIn('Trợ lý GreenFarm AI', content)

    # 14. Floating Widget conversation seamlessly syncs with full assistant
    def test_14_widget_conversation_sync_with_full_assistant(self):
        self.client.force_login(self.tech)

        # 1. Create conversation through widget API endpoint
        create_res = self.client.post(
            reverse("api_chat_conversations"),
            data=json.dumps({"title": "Trò chuyện nhanh từ widget"}),
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        conv_id = create_res.json()["data"]["id"]

        # 2. Send message via widget
        with patch("farm.controllers.chat_controller.call_gemini_chat") as mock_gemini:
            mock_gemini.return_value = {
                "ok": True,
                "text": "Câu trả lời từ Gemini cho widget",
                "latency_ms": 320,
                "model_name": "gemini-3.8-flash",
                "error": "",
            }
            send_res = self.client.post(
                reverse("api_chat_send_message", kwargs={"pk": conv_id}),
                data=json.dumps({"content": "Kiểm tra vật tư sắp hết trong kho."}),
                content_type="application/json",
            )
            self.assertEqual(send_res.status_code, 200)

        # 3. Full assistant loads all conversations
        list_res = self.client.get(reverse("api_chat_conversations"))
        self.assertEqual(list_res.status_code, 200)
        conv_ids = [c["id"] for c in list_res.json()["data"]]
        self.assertIn(conv_id, conv_ids)

        # 4. Full assistant loads specific conversation detail
        detail_res = self.client.get(reverse("api_chat_conversation_detail", kwargs={"pk": conv_id}))
        self.assertEqual(detail_res.status_code, 200)
        msgs = detail_res.json()["data"]["messages"]
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0]["content"], "Kiểm tra vật tư sắp hết trong kho.")
        self.assertEqual(msgs[1]["content"], "Câu trả lời từ Gemini cho widget")

    # 15. Widget lot context permission validation
    def test_15_widget_lot_context_security(self):
        self.client.force_login(self.staff)

        # Staff creates a conversation
        conv = ChatConversation.objects.create(user=self.staff, title="Staff Lot Query")

        # Staff attempts to query a harvested lot that they never worked on (not allowed for staff role)
        res_bad_lot = self.client.post(
            reverse("api_chat_send_message", kwargs={"pk": conv.id}),
            data=json.dumps({"content": "Hỏi về lô này", "crop_lot_id": self.lot_harvested.id}),
            content_type="application/json",
        )
        self.assertEqual(res_bad_lot.status_code, 403)
        self.assertIn("không có quyền truy cập", res_bad_lot.json()["message"])
