
from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.contrib.auth.models import User
from django.contrib.staticfiles import finders
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Item, Category, Building


class HomePageTests(TestCase):
    def test_home_serves_frontend_and_seeded_directories(self):
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTemplateUsed(response, "index.html")
        self.assertContains(response, 'id="postsContainer"')
        self.assertIn("csrftoken", response.cookies)
        self.assertEqual(len(response.context["buildings"]), 50)
        self.assertIn("Документы", [entry["name"] for entry in response.context["categories"]])
        self.assertIsNotNone(finders.find("script.js"))
        self.assertIsNotNone(finders.find("style.css"))

    def test_empty_board_stats_are_zero(self):
        response = self.client.get(reverse("item-stats"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"found": 0, "lost": 0})


class ItemAPITests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword123"
        )

        self.category = Category.objects.create(name="Электроника")
        self.building1 = Building.objects.create(name="Корпус 1")
        self.building2 = Building.objects.create(name="Корпус 2")

        self.item1 = Item.objects.create(
            author=self.user,
            category=self.category,
            building=self.building1,
            title="Потерян телефон",
            description="Чёрный телефон",
            location="Аудитория 101",
            status="lost"
        )

        self.item2 = Item.objects.create(
            author=self.user,
            category=self.category,
            building=self.building2,
            title="Найдены ключи",
            description="Связка ключей",
            location="Коридор",
            status="found"
        )

        self.url = reverse("item-list")

    def test_get_items(self):
        # Проверяем получение списка
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_completion_removes_items_from_feed_and_active_statistics(self):
        stats_url = reverse("item-stats")
        self.assertEqual(self.client.get(stats_url).json(), {"found": 1, "lost": 1})
        self.client.force_authenticate(user=self.user)

        outcomes = (
            (self.item2, Item.Status.RETURNED, Item.Status.RECOVERED, {"found": 0, "lost": 1}),
            (self.item1, Item.Status.RECOVERED, Item.Status.RETURNED, {"found": 0, "lost": 0}),
        )
        for item, expected, invalid, counts in outcomes:
            with self.subTest(completion=expected):
                detail_url = reverse("item-detail", args=[item.pk])
                self.assertEqual(self.client.patch(detail_url, {"status": invalid}).status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(self.client.patch(detail_url, {"status": expected}).status_code, status.HTTP_200_OK)
                item.refresh_from_db()
                self.assertEqual(item.status, expected)
                self.assertEqual(self.client.get(stats_url).json(), counts)
                self.assertEqual(self.client.get(self.url, {"status": expected}).data, [])

        self.assertEqual(Item.objects.count(), 2)
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertEqual(self.client.get(self.url, {"status": Item.Status.values}).data, [])

    def test_my_items_include_only_owned_items_with_inactive_last(self):
        my_items_url = reverse("my-items")
        self.assertEqual(self.client.get(my_items_url).status_code, status.HTTP_403_FORBIDDEN)
        self.item2.status = Item.Status.RETURNED
        self.item2.save(update_fields=["status"])
        recovered = Item.objects.create(
            author=self.user, category=self.category, title="Вещь найдена владельцем",
            description="Описание", location="Коридор", status=Item.Status.RECOVERED,
        )
        other_user = User.objects.create_user(username="other_owner")
        other_item = Item.objects.create(
            author=other_user, category=self.category, title="Чужое объявление",
            description="Описание", location="Коридор",
        )

        self.client.force_authenticate(user=self.user)
        self.assertEqual([item["id"] for item in self.client.get(my_items_url).data], [self.item1.pk, recovered.pk, self.item2.pk])
        self.client.force_authenticate(user=other_user)
        self.assertEqual([item["id"] for item in self.client.get(my_items_url).data], [other_item.pk])

    def test_cannot_create_inactive_item(self):
        data = {
            "title": "Кошелёк", "description": "Коричневый", "location": "Столовая",
            "category": self.category.pk,
        }
        self.client.force_login(self.user)
        for inactive_status in Item.INACTIVE_STATUSES:
            with self.subTest(item_status=inactive_status):
                data["status"] = inactive_status
                response = self.client.post(self.url, data, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("status", response.data)
                form_response = self.client.post(reverse("add_item"), data)
                self.assertIn("status", form_response.context["form"].errors)
        self.assertEqual(Item.objects.count(), 2)

    def test_create_item(self):
        # Авторизуемся перед созданием
        self.client.force_authenticate(user=self.user)

        data = {
            "title": "Потерян кошелёк",
            "description": "Коричневый кошелёк",
            "location": "Столовая",
            "status": "lost",
            "category": self.category.id,
            "building": self.building1.id,
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Item.objects.count(), 3)

        new_item = Item.objects.get(pk=response.data["id"])
        self.assertEqual(new_item.author, self.user)
        self.assertEqual(new_item.date_event, timezone.localdate())

    def test_future_date_is_rejected_on_creation_and_update(self):
        self.client.force_authenticate(user=self.user)
        future = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.post(
            self.url,
            {
                "title": "Потерян кошелёк",
                "description": "Коричневый кошелёк",
                "location": "Столовая",
                "status": "lost",
                "category": self.category.id,
                "date_event": future,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_event", response.data)
        self.assertEqual(Item.objects.count(), 2)

        detail_url = reverse("item-detail", args=[self.item1.pk])
        response = self.client.patch(detail_url, {"date_event": future}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_event", response.data)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.date_event, timezone.localdate())

    def test_only_author_can_edit_and_delete_item(self):
        detail_url = reverse("item-detail", args=[self.item1.pk])
        completion_data = {"status": Item.Status.RECOVERED}
        self.assertEqual(self.client.patch(detail_url, completion_data).status_code, status.HTTP_403_FORBIDDEN)
        another_user = User.objects.create_user(username="another_user")
        self.client.force_authenticate(user=another_user)
        self.assertEqual(
            self.client.patch(detail_url, {"title": "Чужое объявление"}).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.patch(detail_url, completion_data).status_code, status.HTTP_403_FORBIDDEN)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.status, Item.Status.LOST)
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            detail_url, {"title": "Уточнённое название", "building": None}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.title, "Уточнённое название")
        self.assertIsNone(self.item1.building_id)
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Item.objects.filter(pk=self.item1.pk).exists())

    def test_filter_by_status(self):
        response = self.client.get(self.url, {"status": "lost"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Потерян телефон")

    def test_filter_by_multiple_statuses_groups_lost_items_last(self):
        returned, found, lost = [
            Item.objects.create(
                author=self.user, category=self.category, title=item_status.label,
                description="Описание", location="Коридор", status=item_status,
            )
            for item_status in (Item.Status.RETURNED, Item.Status.FOUND, Item.Status.LOST)
        ]
        first_publication = timezone.now() - timedelta(hours=1)
        for minutes, item in enumerate((self.item1, self.item2, returned, found, lost)):
            Item.objects.filter(pk=item.pk).update(created_at=first_publication + timedelta(minutes=minutes))

        response = self.client.get(self.url, {"status": ["lost", "returned", "found"]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [found.pk, self.item2.pk, lost.pk, self.item1.pk],
        )

        response = self.client.get(self.url, {"status": ["returned", "found"]})
        self.assertEqual([item["id"] for item in response.data], [found.pk, self.item2.pk])

        default_feed = self.client.get(self.url)
        self.assertEqual([item["id"] for item in default_feed.data], [lost.pk, found.pk, self.item2.pk, self.item1.pk])

    def test_filter_by_building(self):
        response = self.client.get(
            self.url, {"building": self.building1.id}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_filter_by_multiple_buildings(self):
        response = self.client.get(
            self.url,
            [
                ("building", self.building1.id),
                ("building", self.building2.id)
            ]
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_combined_filters(self):
        response = self.client.get(
            self.url,
            {"status": "lost", "building": self.building1.id}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_no_matching_items(self):
        response = self.client.get(self.url, {"building": 999999})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_invalid_data(self):
        self.client.force_authenticate(user=self.user)

        data = {
            "title": "",
            "description": "",
            "location": "",
            "status": "incorrect",
            "category": 999999
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)
        self.assertIn("status", response.data)

    def test_anonymous_cannot_create(self):
        data = {
            "title": "Тест",
            "description": "Описание",
            "location": "Корпус 1",
            "status": "lost",
            "category": self.category.id
        }

        response = self.client.post(self.url, data, format="json")

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
        )
        self.assertEqual(Item.objects.count(), 2)

    def test_publication_retry_uses_original_record_for_the_same_author(self):
        self.client.force_authenticate(user=self.user)
        key = str(uuid4())
        fields = {
            "title": "Потерян кошелёк",
            "description": "Коричневый кошелёк",
            "location": "Столовая",
            "status": "lost",
            "category": self.category.id,
        }
        first = self.client.post(self.url, fields, format="json", HTTP_IDEMPOTENCY_KEY=key)
        retry = self.client.post(self.url, fields, format="json", HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(retry.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["id"], retry.data["id"])
        self.assertEqual(Item.objects.filter(client_request_id=key).count(), 1)

        other = User.objects.create_user(username="other_publisher")
        self.client.force_authenticate(user=other)
        other_item = self.client.post(self.url, fields, format="json", HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(other_item.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(first.data["id"], other_item.data["id"])

    def test_profile_updates_belong_to_authenticated_user(self):
        url = reverse("my-profile")
        self.assertEqual(self.client.patch(url, {"nickname": "Гость"}).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.user)
        updated = self.client.patch(url, {"first_name": "Анна", "nickname": "anna", "bio": "Первый профиль"})
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["nickname"], "anna")

        other = User.objects.create_user(username="profile_second")
        self.client.force_authenticate(user=other)
        second = self.client.patch(url, {"nickname": "other"})
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["bio"], "")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Анна")
        self.assertEqual(self.user.profile.nickname, "anna")
        self.assertEqual(self.user.profile.bio, "Первый профиль")

    def test_feed_exposes_only_contact_explicitly_added_to_an_item(self):
        self.user.email = "private@example.test"
        self.user.save(update_fields=["email"])
        self.assertEqual(self.client.get(self.url).data[0]["contact"], "")

        self.client.force_authenticate(user=self.user)
        detail_url = reverse("item-detail", args=[self.item1.pk])
        response = self.client.patch(detail_url, {"contact": "@campus_test"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(detail_url).data["contact"], "@campus_test")

    def test_profile_avatar_is_visible_in_its_authors_items(self):
        avatar_url = reverse("profile-avatar")
        self.assertEqual(self.client.patch(avatar_url, {}).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.user)

        image_data = BytesIO()
        Image.new("RGB", (2, 2)).save(image_data, format="PNG")
        upload = SimpleUploadedFile("profile.png", image_data.getvalue(), content_type="image/png")
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = self.client.patch(avatar_url, {"avatar": upload}, format="multipart")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            avatar = response.data["avatar"]
            self.assertIn("/avatars/", avatar)

            another_user = User.objects.create_user(username="avatar_other")
            self.item2.author = another_user
            self.item2.save(update_fields=["author"])
            detail_url = reverse("item-detail", args=[self.item1.pk])
            self.client.force_authenticate(user=None)
            avatars = {item["id"]: item["author_avatar"] for item in self.client.get(self.url).data}
            self.assertEqual(avatars, {self.item1.pk: avatar, self.item2.pk: None})

            self.client.force_authenticate(user=self.user)
            removed = self.client.patch(avatar_url, {"avatar": ""}, format="multipart")
            self.assertEqual(removed.status_code, status.HTTP_200_OK)
            self.assertIsNone(self.client.get(detail_url).data["author_avatar"])
