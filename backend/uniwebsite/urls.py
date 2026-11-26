from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from main.views import (
    ItemDetailView, ItemListCreateView, MyAvatarView, MyItemListView, MyProfileView,
    create_item, home, item_stats, profile_view, register,
)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')),
    path('', home, name='home'),
    path('register/', register, name='register'),
    path('api/items/', ItemListCreateView.as_view(), name='item-list'),
    path('api/items/mine/', MyItemListView.as_view(), name='my-items'),
    path('api/items/<int:pk>/', ItemDetailView.as_view(), name='item-detail'),
    path('api/item-stats/', item_stats, name='item-stats'),
    path('api/profile/', MyProfileView.as_view(), name='my-profile'),
    path('api/profile/avatar/', MyAvatarView.as_view(), name='profile-avatar'),
    path('add/', create_item, name='add_item'),
    path('profile/', profile_view, name='profile'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
