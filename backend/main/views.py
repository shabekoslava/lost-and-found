from django.http import HttpResponse
from django.shortcuts import render, redirect
from rest_framework import generics
from .models import Item, Profile
from .serializers import ItemSerializer
from django.contrib.auth.decorators import login_required
from .forms import ItemForm, CustomUserCreationForm, UserUpdateForm, ProfileUpdateForm
from django.views.decorators.csrf import ensure_csrf_cookie
from .permissions import IsAuthorOrReadOnly

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
    all_items = Item.objects.all()
    return render(request, 'home.html', {'items': all_items})

class ItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ItemSerializer

    def get_queryset(self):
        queryset = Item.objects.all()
        category_id = self.request.query_params.get('category')
        status = self.request.query_params.get('status')
        search_query = self.request.query_params.get('search')

        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if status:
            queryset = queryset.filter(status=status)

        if search_query:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class ItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthorOrReadOnly]

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


