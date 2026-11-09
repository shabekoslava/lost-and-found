from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import Profile, Item

class ItemForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['title', 'description', 'location', 'status', 'category', 'image', 'building']
        widgets = {
            'title': forms.TextInput(attrs={'placeholder': 'Например: Ключи от машины'}),
            'description': forms.Textarea(attrs={'rows': 3}),
        }

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True, label="Email")
    faculty = forms.CharField(max_length=100, required=False, label="Факультет")
    group = forms.CharField(max_length=50, required=False, label="Группа")

    class Meta:
        model = User
        fields = ("username", "email")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        if commit:
            user.save()
            profile = user.profile
            profile.faculty = self.cleaned_data["faculty"]
            profile.group = self.cleaned_data["group"]
            profile.save()
        return user

# Форма РЕДАКТИРОВАНИЯ ПРОФИЛЯ
class UserUpdateForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['username', 'email']
        labels = {'username': 'Никнейм (Логин)'}

class ProfileUpdateForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['faculty', 'group', 'phone']
