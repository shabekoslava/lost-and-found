from django.contrib import admin
from .models import Category, Item, Profile, Building

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'group', 'phone')
    search_fields = ('user__username', 'group')

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'status', 'category', 'location', 'author', 'date_event')
    list_filter = ('status', 'category')
    search_fields = ('title', 'description', 'location')

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)

@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address')

