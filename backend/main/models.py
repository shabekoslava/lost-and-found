from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver

class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name="Категория вещи")
    icon = models.CharField(max_length=50, blank=True, help_text="Например: fa-key, fa-mobile")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    faculty = models.CharField(max_length=100, blank=True, verbose_name="Факультет")
    group = models.CharField(max_length=50, blank=True, verbose_name="Группа")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Телефон для связи")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True, verbose_name="Аватар")
    nickname = models.CharField(max_length=60, blank=True, verbose_name="Никнейм")
    bio = models.TextField(max_length=1000, blank=True, verbose_name="О себе")

    def __str__(self):
        return f"Профиль {self.user.username}"

    class Meta:
        verbose_name = "Профиль"
        verbose_name_plural = "Профили"

class Building(models.Model):
    name = models.CharField(max_length=100, verbose_name="Название корпуса")
    address = models.CharField(max_length=255, blank=True, verbose_name="Адрес (необязательно)")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Корпус"
        verbose_name_plural = "Корпуса"


class Item(models.Model):
    class Status(models.TextChoices):
        LOST = 'lost', 'Потеряно'
        FOUND = 'found', 'Найдено'
        RETURNED = 'returned', 'Возвращено владельцу'
        RECOVERED = 'recovered', 'Найдено владельцем'

    COMPLETION_STATUSES = {
        Status.LOST: Status.RECOVERED,
        Status.FOUND: Status.RETURNED,
    }
    ACTIVE_STATUSES = tuple(COMPLETION_STATUSES)
    INACTIVE_STATUSES = tuple(COMPLETION_STATUSES.values())

    building = models.ForeignKey(
        Building,
        on_delete=models.SET_NULL,  # Если корпус удалят, объявление останется, но поле станет пустым
        null=True,
        blank=True,
        related_name='items',
        verbose_name="Корпус"
    )

    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='items', verbose_name="Автор объявления")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='items', verbose_name="Категория")

    title = models.CharField(max_length=200, verbose_name="Название вещи")
    description = models.TextField(verbose_name="Приметы / Описание")
    contact = models.CharField(
        max_length=160,
        blank=True,
        verbose_name="Контакт для связи",
        help_text="Указанный контакт будет виден в объявлении.",
    )

    location = models.CharField(
        max_length=255,
        verbose_name="Где найдено/потеряно",
        help_text="Например: 3 корпус, столовая"
    )
    date_event = models.DateField(
        default=timezone.localdate,
        validators=[MaxValueValidator(timezone.localdate, message="Дата события не может быть в будущем.")],
        verbose_name="Дата потери/находки",
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.FOUND,
        verbose_name="Статус"
    )

    image = models.ImageField(upload_to='items/', null=True, blank=True, verbose_name="Фото вещи")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата публикации")
    client_request_id = models.UUIDField(null=True, blank=True, editable=False)

    def __str__(self):
        return f"{self.get_status_display()}: {self.title}"

    class Meta:
        verbose_name = "Объявление"
        verbose_name_plural = "Объявления"
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=["author", "client_request_id"], name="unique_item_author_request"),
        ]


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, **kwargs):
    Profile.objects.get_or_create(user=instance)

