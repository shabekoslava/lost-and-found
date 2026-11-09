from django.shortcuts import render
from django.contrib import admin
from django.urls import path, include
from main.views import home, register, ItemListCreateView, ItemDetailView, create_item
from django.conf import settings
from django.conf.urls.static import static
from main.views import profile_view


urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')),
    path('', home, name='home'),
    path('register/', register, name='register'),
    path('api/items/', ItemListCreateView.as_view(), name='item-list'),
    path('api/items/<int:pk>/', ItemDetailView.as_view(), name='item-detail'),
    path('add/', create_item, name='add_item'),
    path('profile/', profile_view, name='profile'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)