
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Item, Category, Building

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
            "date_event": "2026-11-22"
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Item.objects.count(), 3)

        new_item = Item.objects.get(pk=response.data["id"])
        self.assertEqual(new_item.author, self.user)

    def test_filter_by_status(self):
        response = self.client.get(self.url, {"status": "lost"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Потерян телефон")

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