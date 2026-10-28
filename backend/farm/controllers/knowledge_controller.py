from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from farm.models import CropVariety, KnowledgeArticle
from farm.utils.helpers import api_response, parse_body
from farm.utils.roles import get_user_role, role_required


def serialize_article(a):
    return {
        "id": a.id,
        "title": a.title,
        "category": a.category,
        "category_display": a.get_category_display(),
        "variety_id": a.variety_id,
        "variety_name": a.variety.name if a.variety else None,
        "content": a.content,
        "source": a.source,
        "tags": a.tags,
        "is_active": a.is_active,
        "is_verified": a.is_verified,
        "created_by": a.created_by.username if a.created_by else "Hệ thống",
        "created_at": a.created_at.strftime("%Y-%m-%d %H:%M"),
    }


@require_GET
@role_required("Manager", "Technician")
def knowledge_list_view(request):
    qs = KnowledgeArticle.objects.select_related("variety", "created_by")
    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q) | Q(tags__icontains=q))
    return api_response([serialize_article(a) for a in qs])


@require_POST
@role_required("Manager", "Technician")
def knowledge_create_view(request):
    data = parse_body(request)
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    if not title or not content:
        return api_response(message="Tiêu đề và nội dung tài liệu không được để trống.", success=False, status=400)

    variety_id = data.get("variety_id")
    variety = None
    if variety_id:
        try:
            variety = CropVariety.objects.get(pk=variety_id)
        except CropVariety.DoesNotExist:
            pass

    # Only Manager can mark as verified
    role = get_user_role(request.user)
    is_verified = bool(data.get("is_verified", False)) if role in {"Manager", "Superuser"} else False

    article = KnowledgeArticle.objects.create(
        title=title,
        category=data.get("category", KnowledgeArticle.Category.GENERAL),
        variety=variety,
        content=content,
        source=data.get("source", "").strip(),
        tags=data.get("tags", "").strip(),
        is_active=bool(data.get("is_active", True)),
        is_verified=is_verified,
        created_by=request.user,
    )
    return api_response(serialize_article(article), message="Đã lưu tài liệu tri thức!", status=201)


@require_http_methods(["PUT", "POST"])
@role_required("Manager", "Technician")
def knowledge_update_view(request, pk):
    article = get_object_or_404(KnowledgeArticle, pk=pk)
    data = parse_body(request)

    if "title" in data:
        article.title = data["title"].strip()
    if "content" in data:
        article.content = data["content"].strip()
    if "category" in data:
        article.category = data["category"]
    if "variety_id" in data:
        article.variety_id = data["variety_id"] or None
    if "source" in data:
        article.source = data["source"].strip()
    if "tags" in data:
        article.tags = data["tags"].strip()
    if "is_active" in data:
        article.is_active = bool(data["is_active"])

    role = get_user_role(request.user)
    if "is_verified" in data and role in {"Manager", "Superuser"}:
        article.is_verified = bool(data["is_verified"])

    article.save()
    return api_response(serialize_article(article), message="Đã cập nhật tài liệu tri thức!")


@require_http_methods(["DELETE", "POST"])
@role_required("Manager")
def knowledge_delete_view(request, pk):
    article = get_object_or_404(KnowledgeArticle, pk=pk)
    article.delete()
    return api_response(message="Đã xóa tài liệu tri thức.")
