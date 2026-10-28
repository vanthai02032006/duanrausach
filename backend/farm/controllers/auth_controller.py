from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import get_user_role


@ensure_csrf_cookie
@require_GET
def csrf_token_view(request):
    """Provides CSRF cookie and checks current auth status."""
    user = request.user
    if user.is_authenticated:
        return api_response({
            "authenticated": True,
            "username": user.username,
            "full_name": user.get_full_name() or user.username,
            "role": get_user_role(user),
            "email": user.email,
        })
    return api_response({"authenticated": False})


@require_POST
def login_view(request):
    data = parse_body(request)
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return api_response(message="Vui lòng nhập tên đăng nhập và mật khẩu.", success=False, status=400)

    user = authenticate(request, username=username, password=password)
    if user is not None:
        if not user.is_active:
            return api_response(message="Tài khoản này hiện đang bị khóa.", success=False, status=403)
        login(request, user)
        role = get_user_role(user)
        return api_response({
            "username": user.username,
            "full_name": user.get_full_name() or user.username,
            "role": role,
            "email": user.email,
        }, message="Đăng nhập thành công!")
    return api_response(message="Tên đăng nhập hoặc mật khẩu không chính xác.", success=False, status=400)


@require_POST
def logout_view(request):
    logout(request)
    return api_response(message="Đăng xuất thành công!")


@require_GET
def me_view(request):
    if not request.user.is_authenticated:
        return api_response(message="Chưa đăng nhập.", success=False, status=401)
    user = request.user
    return api_response({
        "id": user.id,
        "username": user.username,
        "full_name": user.get_full_name() or user.username,
        "role": get_user_role(user),
        "email": user.email,
    })
