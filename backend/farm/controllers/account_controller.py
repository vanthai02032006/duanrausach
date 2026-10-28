from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import get_user_role, role_required

User = get_user_model()


def serialize_user(u):
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.get_full_name() or u.first_name or u.username,
        "email": u.email,
        "role": get_user_role(u),
        "is_active": u.is_active,
        "is_superuser": u.is_superuser,
        "date_joined": u.date_joined.strftime("%Y-%m-%d %H:%M"),
    }


@require_GET
@role_required("Manager")
def account_list_view(request):
    users = User.objects.prefetch_related("groups").order_by("username")
    q = request.GET.get("q", "").strip()
    if q:
        users = users.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(email__icontains=q))

    return api_response({
        "users": [serialize_user(u) for u in users],
        "roles": [
            {"value": "Manager", "label": "Quản lý"},
            {"value": "Technician", "label": "Kỹ thuật viên"},
            {"value": "Staff", "label": "Nhân viên"},
        ],
    })


@require_POST
@role_required("Manager")
def account_create_view(request):
    data = parse_body(request)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip()
    role = data.get("role", "Staff")

    if not username or not password:
        return api_response(message="Vui lòng nhập tên đăng nhập và mật khẩu.", success=False, status=400)

    if User.objects.filter(username__iexact=username).exists():
        return api_response(message=f"Tên đăng nhập '{username}' đã được sử dụng.", success=False, status=400)

    user = User.objects.create_user(
        username=username,
        password=password,
        first_name=full_name,
        email=email,
    )
    if role in {"Manager", "Technician", "Staff"}:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)

    return api_response(serialize_user(user), message=f"Đã tạo tài khoản {username} thành công!", status=201)


@require_POST
@role_required("Manager")
def account_set_role_view(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        return api_response(message="Không thể đổi vai trò của chính tài khoản đang đăng nhập.", success=False, status=400)

    data = parse_body(request)
    role = data.get("role")
    if role in {"Manager", "Technician", "Staff"}:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.clear()
        user.groups.add(group)
        return api_response(serialize_user(user), message=f"Đã cập nhật vai trò {role} cho {user.username}.")
    return api_response(message="Vai trò không hợp lệ.", success=False, status=400)


@require_POST
@role_required("Manager")
def account_toggle_view(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        return api_response(message="Không thể tự khóa tài khoản của chính mình.", success=False, status=400)
    if user.is_superuser:
        return api_response(message="Không thể khóa tài khoản superuser.", success=False, status=400)

    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    state = "mở khóa" if user.is_active else "khóa"
    return api_response(serialize_user(user), message=f"Đã {state} tài khoản {user.username}.")
