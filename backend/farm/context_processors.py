from .roles import get_user_role


def role_context(request):
    role = get_user_role(request.user) if getattr(request, "user", None) and request.user.is_authenticated else "Guest"
    return {
        "current_role": role,
        "is_manager": role in {"Manager", "Superuser"},
        "is_technician": role == "Technician",
        "is_staff_role": role == "Staff",
    }
