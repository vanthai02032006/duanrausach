from django.views.decorators.http import require_GET
from farm.services.dashboard_service import get_dashboard_summary
from farm.utils.helpers import api_response
from farm.utils.roles import role_required


@require_GET
@role_required("Manager", "Technician", "Staff")
def dashboard_view(request):
    data = get_dashboard_summary()
    return api_response(data)
