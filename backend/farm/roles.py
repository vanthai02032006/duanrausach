from functools import wraps
from django.contrib import messages
from django.contrib.auth.views import redirect_to_login
from django.shortcuts import redirect

ROLE_GROUPS = {
    "Manager": "Quản lý",
    "Technician": "Kỹ thuật viên",
    "Staff": "Nhân viên",
}


def get_user_role(user):
    if not user or not user.is_authenticated:
        return "Guest"
    if user.is_superuser:
        return "Superuser"
    names = set(user.groups.values_list("name", flat=True))
    for group in ("Manager", "Technician", "Staff"):
        if group in names:
            return group
    return "Staff"


def role_required(*allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            role = get_user_role(request.user)
            if role == "Superuser" or role in allowed_roles:
                return view_func(request, *args, **kwargs)
            messages.error(request, "Tài khoản của bạn chưa được cấp quyền cho chức năng này.")
            return redirect("dashboard")
        return wrapped
    return decorator
