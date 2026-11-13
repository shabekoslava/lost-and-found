from rest_framework import serializers
from .models import Item, Category


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']


class ItemSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.username')

    class Meta:
        model = Item
        fields = [
            'id',
            'title',
            'description',
            'status',
            'location',
            'date_event',
            'image',
            'category',
            'building',
            'author',
            'author_name',
            'created_at',
        ]

        read_only_fields = [
            'id', 'author', 'author_name', 'created_at'
        ]

    def validate_status(self, value):
        if self.instance is None and value == 'returned':
            raise serializers.ValidationError(
                "При создании объявления можно выбрать только "
                "'lost' или 'found'."
            )

        return value
