from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Case, Count, Q, Value, When
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import Building, Category, Item, Profile
from .serializers import ItemSerializer, MyProfileSerializer, ProfileAvatarSerializer
from django.contrib.auth.decorators import login_required
from .forms import ItemForm, CustomUserCreationForm, UserUpdateForm, ProfileUpdateForm
from django.views.decorators.csrf import ensure_csrf_cookie
from .permissions import IsAuthorOrReadOnly
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS

def hello_view(request):
    return HttpResponse('Hello')


def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = CustomUserCreationForm()

    return render(request, 'registration/register.html', {'form': form})

@ensure_csrf_cookie
def home(request):
    return render(request, 'index.html', {
        'buildings': Building.objects.order_by('id').values('id', 'name'),
        'categories': Category.objects.order_by('id').values('id', 'name'),
    })


@require_safe
@never_cache
def item_stats(request):
    counts = Item.objects.aggregate(
        found=Count('pk', filter=Q(status=Item.Status.FOUND)),
        lost=Count('pk', filter=Q(status=Item.Status.LOST)),
    )
    return JsonResponse(counts)


class ReadOnlyOrAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return (
            request.method in SAFE_METHODS
            or request.user.is_authenticated
        )

class ItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ItemSerializer
    permission_classes = [ReadOnlyOrAuthenticated]

    def get_queryset(self):
        queryset = Item.objects.filter(status__in=Item.ACTIVE_STATUSES).select_related("author__profile")

        category_id = self.request.query_params.get('category')
        statuses = self.request.query_params.getlist('status')
        buildings = self.request.query_params.getlist('building')
        search_query = self.request.query_params.get('search')

        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if statuses:
            queryset = queryset.filter(status__in=statuses)

        if buildings:
            queryset = queryset.filter(building_id__in=buildings)

        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        if len(set(statuses)) > 1:
            queryset = queryset.order_by(
                Case(When(status=Item.Status.LOST, then=Value(1)), default=Value(0)),
                '-created_at',
                '-pk',
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def create(self, request, *args, **kwargs):
        raw_key = request.headers.get("Idempotency-Key")
        if raw_key is None:
            return super().create(request, *args, **kwargs)

        try:
            key = UUID(raw_key)
        except ValueError as error:
            raise ValidationError({"detail": "Недопустимый ключ публикации."}) from error

        matching = Item.objects.select_related("author__profile").filter(
            author=request.user, client_request_id=key,
        )
        previous = matching.first()
        if previous is not None:
            return Response(self.get_serializer(previous).data)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.validated_data.get("image")
        try:
            with transaction.atomic():
                # Сначала резервируем запись, чтобы при одновременном повторе не загрузить второе фото.
                item = serializer.save(author=request.user, client_request_id=key, image=None)
                if image is not None:
                    item.image = image
                    item.save(update_fields=["image"])
        except IntegrityError:
            previous = matching.first()
            if previous is None:
                raise
            return Response(self.get_serializer(previous).data)

        data = serializer.data
        return Response(data, status=status.HTTP_201_CREATED, headers=self.get_success_headers(data))

class MyItemListView(generics.ListAPIView):
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Item.objects.filter(author=self.request.user).select_related('author__profile').order_by(
            Case(When(status__in=Item.INACTIVE_STATUSES, then=Value(1)), default=Value(0)),
            '-created_at',
            '-pk',
        )


class ItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Item.objects.select_related("author__profile")
    serializer_class = ItemSerializer
    permission_classes = [IsAuthorOrReadOnly]

    def get_queryset(self):
        visible_items = Q(status__in=Item.ACTIVE_STATUSES)
        if self.request.user.is_authenticated:
            visible_items |= Q(author=self.request.user)
        return super().get_queryset().filter(visible_items)


class MyProfileView(generics.UpdateAPIView):
    serializer_class = MyProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


class MyAvatarView(MyProfileView):
    serializer_class = ProfileAvatarSerializer


@login_required
def create_item(request):
    if request.method == 'POST':
        form = ItemForm(request.POST, request.FILES)
        if form.is_valid():
            item = form.save(commit=False)
            item.author = request.user
            item.save()
            return redirect('home')
    else:
        form = ItemForm()
    return render(request, 'create_item.html', {'form': form})


@login_required
def profile_view(request):

    profile, created = Profile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        u_form = UserUpdateForm(request.POST, instance=request.user)
        p_form = ProfileUpdateForm(request.POST, instance=profile)

        if u_form.is_valid() and p_form.is_valid():
            u_form.save()
            p_form.save()
            return redirect('profile')
    else:
        u_form = UserUpdateForm(instance=request.user)
        p_form = ProfileUpdateForm(instance=profile)

    context = {
        'u_form': u_form,
        'p_form': p_form
    }

    return render(request, 'profile.html', context)


