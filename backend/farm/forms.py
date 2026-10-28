from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import Group
from django.db.models import Sum
from .models import (
    AIInteraction, CareLog, CropLot, CropVariety, Harvest, KnowledgeArticle,
    Material, MaterialUsage, Sale,
)

User = get_user_model()


def style_form(form):
    for field in form.fields.values():
        widget = field.widget
        if isinstance(widget, forms.CheckboxInput):
            widget.attrs.setdefault("class", "form-check-input")
        elif isinstance(widget, forms.Select):
            widget.attrs.setdefault("class", "form-select")
        elif isinstance(widget, forms.Textarea):
            widget.attrs.setdefault("class", "form-control")
            widget.attrs.setdefault("rows", 3)
        else:
            widget.attrs.setdefault("class", "form-control")
    return form


class CropVarietyForm(forms.ModelForm):
    class Meta:
        model = CropVariety
        fields = ["name", "scientific_name", "expected_days", "description", "care_notes"]
        widgets = {"expected_days": forms.NumberInput(attrs={"min": 1}), "description": forms.Textarea(), "care_notes": forms.Textarea()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)


class CropLotForm(forms.ModelForm):
    class Meta:
        model = CropLot
        fields = ["code", "name", "area_m2", "variety", "planting_date", "expected_harvest_date", "status", "notes"]
        widgets = {
            "planting_date": forms.DateInput(attrs={"type": "date"}),
            "expected_harvest_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)

    def clean(self):
        cleaned = super().clean()
        pdate, hdate = cleaned.get("planting_date"), cleaned.get("expected_harvest_date")
        if pdate and hdate and hdate < pdate:
            self.add_error("expected_harvest_date", "Ngày dự kiến thu hoạch không thể trước ngày gieo trồng.")
        return cleaned


class CareLogForm(forms.ModelForm):
    class Meta:
        model = CareLog
        fields = ["lot", "activity", "occurred_at", "status", "note", "observation"]
        widgets = {"occurred_at": forms.DateTimeInput(attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"), "note": forms.Textarea(), "observation": forms.Textarea()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); self.fields["occurred_at"].input_formats = ["%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S"]; style_form(self)


class MaterialForm(forms.ModelForm):
    class Meta:
        model = Material
        fields = ["name", "category", "unit", "quantity", "minimum_quantity", "unit_price", "expiry_date", "notes"]
        widgets = {"expiry_date": forms.DateInput(attrs={"type": "date"}), "notes": forms.Textarea()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)


class MaterialUsageForm(forms.ModelForm):
    class Meta:
        model = MaterialUsage
        fields = ["material", "lot", "quantity", "note"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)

    def clean(self):
        cleaned = super().clean()
        material, quantity = cleaned.get("material"), cleaned.get("quantity")
        if material and quantity is not None and quantity > material.quantity:
            self.add_error("quantity", f"Tồn kho hiện có {material.quantity} {material.unit}, không đủ số lượng yêu cầu.")
        return cleaned


class HarvestForm(forms.ModelForm):
    class Meta:
        model = Harvest
        fields = ["lot", "product_name", "quantity_kg", "quality", "harvested_at", "notes"]
        widgets = {"harvested_at": forms.DateInput(attrs={"type": "date"}), "notes": forms.Textarea()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)


class SaleForm(forms.ModelForm):
    class Meta:
        model = Sale
        fields = ["harvest", "quantity_kg", "unit_price", "customer_name", "sold_at", "note"]
        widgets = {"sold_at": forms.DateInput(attrs={"type": "date"})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)

    def clean(self):
        cleaned = super().clean()
        harvest, quantity = cleaned.get("harvest"), cleaned.get("quantity_kg")
        if harvest and quantity:
            sold = harvest.sales.aggregate(total=Sum("quantity_kg"))["total"] or 0
            if sold + quantity > harvest.quantity_kg:
                self.add_error("quantity_kg", f"Phiếu thu hoạch còn {harvest.quantity_kg - sold} kg chưa bán.")
        return cleaned


class KnowledgeArticleForm(forms.ModelForm):
    class Meta:
        model = KnowledgeArticle
        fields = ["title", "category", "variety", "content", "tags", "source", "is_verified", "is_active"]
        widgets = {"content": forms.Textarea(attrs={"rows": 7})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs); style_form(self)


class FarmUserCreateForm(UserCreationForm):
    full_name = forms.CharField(label="Họ và tên", max_length=150)
    email = forms.EmailField(label="Email")
    role = forms.ChoiceField(label="Vai trò", choices=[("Manager", "Quản lý"), ("Technician", "Kỹ thuật viên"), ("Staff", "Nhân viên")])

    class Meta:
        model = User
        fields = ["username", "full_name", "email", "role", "password1", "password2"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].label = "Tên đăng nhập"
        self.fields["password1"].label = "Mật khẩu"
        self.fields["password2"].label = "Nhập lại mật khẩu"
        style_form(self)

    def save(self, commit=True):
        user = super().save(commit=False)
        user.first_name = self.cleaned_data["full_name"]
        user.email = self.cleaned_data["email"]
        if commit:
            user.save()
            group = Group.objects.get(name=self.cleaned_data["role"])
            user.groups.clear(); user.groups.add(group)
        return user
