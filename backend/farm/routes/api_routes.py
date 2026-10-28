from django.urls import path
from farm.controllers import (
    csrf_token_view, login_view, logout_view, me_view,
    dashboard_view,
    lot_list_view, lot_create_view, lot_update_view, lot_delete_view,
    variety_list_view, variety_create_view, variety_update_view, variety_delete_view,
    care_list_view, care_create_view, care_update_view, care_delete_view,
    material_list_view, material_create_view, material_update_view, material_usage_create_view,
    harvest_list_view, harvest_create_view,
    sale_list_view, sale_create_view,
    trace_view, trace_qr_image_view, trace_label_image_view, trace_revoke_view, trace_regenerate_view,
    ai_meta_view, ai_generate_view, ai_feedback_view,
    conversation_list_create_view, conversation_detail_view, chat_send_message_view, chat_feedback_view,
    knowledge_list_view, knowledge_create_view, knowledge_update_view, knowledge_delete_view,
    reports_view, ai_monitor_view,
    account_list_view, account_create_view, account_set_role_view, account_toggle_view,
)

urlpatterns = [
    # Auth
    path("auth/csrf/", csrf_token_view, name="api_csrf"),
    path("auth/login/", login_view, name="api_login"),
    path("auth/logout/", logout_view, name="api_logout"),
    path("auth/me/", me_view, name="api_me"),

    # Dashboard
    path("dashboard/", dashboard_view, name="api_dashboard"),

    # Lots
    path("lots/", lot_list_view, name="api_lots"),
    path("lots/create/", lot_create_view, name="api_lot_create"),
    path("lots/<int:pk>/", lot_update_view, name="api_lot_update"),
    path("lots/<int:pk>/delete/", lot_delete_view, name="api_lot_delete"),

    # Varieties
    path("varieties/", variety_list_view, name="api_varieties"),
    path("varieties/create/", variety_create_view, name="api_variety_create"),
    path("varieties/<int:pk>/", variety_update_view, name="api_variety_update"),
    path("varieties/<int:pk>/delete/", variety_delete_view, name="api_variety_delete"),

    # Care Logs
    path("care/", care_list_view, name="api_care"),
    path("care/create/", care_create_view, name="api_care_create"),
    path("care/<int:pk>/", care_update_view, name="api_care_update"),
    path("care/<int:pk>/delete/", care_delete_view, name="api_care_delete"),

    # Materials
    path("materials/", material_list_view, name="api_materials"),
    path("materials/create/", material_create_view, name="api_material_create"),
    path("materials/<int:pk>/", material_update_view, name="api_material_update"),
    path("materials/use/", material_usage_create_view, name="api_material_use"),

    # Harvests
    path("harvests/", harvest_list_view, name="api_harvests"),
    path("harvests/create/", harvest_create_view, name="api_harvest_create"),

    # Sales
    path("sales/", sale_list_view, name="api_sales"),
    path("sales/create/", sale_create_view, name="api_sale_create"),

    # Trace
    path("trace/", trace_view, name="api_trace"),
    path("trace/<str:code>/", trace_view, name="api_trace_detail"),
    path("trace/<str:code>/qr/", trace_qr_image_view, name="api_trace_qr"),
    path("trace/<str:code>/label/", trace_label_image_view, name="api_trace_label"),
    path("trace/<str:code>/revoke/", trace_revoke_view, name="api_trace_revoke"),
    path("trace/<str:code>/regenerate/", trace_regenerate_view, name="api_trace_regenerate"),

    # AI Legacy & Chatbot
    path("ai/meta/", ai_meta_view, name="api_ai_meta"),
    path("ai/generate/", ai_generate_view, name="api_ai_generate"),
    path("ai/<int:pk>/feedback/", ai_feedback_view, name="api_ai_feedback"),
    path("ai/chat/conversations/", conversation_list_create_view, name="api_chat_conversations"),
    path("ai/chat/conversations/<int:pk>/", conversation_detail_view, name="api_chat_conversation_detail"),
    path("ai/chat/conversations/<int:pk>/messages/", chat_send_message_view, name="api_chat_send_message"),
    path("ai/chat/messages/<int:pk>/feedback/", chat_feedback_view, name="api_chat_feedback"),

    # Knowledge
    path("knowledge/", knowledge_list_view, name="api_knowledge"),
    path("knowledge/create/", knowledge_create_view, name="api_knowledge_create"),
    path("knowledge/<int:pk>/", knowledge_update_view, name="api_knowledge_update"),
    path("knowledge/<int:pk>/delete/", knowledge_delete_view, name="api_knowledge_delete"),

    # Reports & Monitoring
    path("reports/", reports_view, name="api_reports"),
    path("reports/ai-monitor/", ai_monitor_view, name="api_ai_monitor"),

    # Accounts
    path("accounts/", account_list_view, name="api_accounts"),
    path("accounts/create/", account_create_view, name="api_account_create"),
    path("accounts/<int:pk>/role/", account_set_role_view, name="api_account_role"),
    path("accounts/<int:pk>/toggle/", account_toggle_view, name="api_account_toggle"),
]
