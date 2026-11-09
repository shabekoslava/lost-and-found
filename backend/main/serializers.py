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
            'id', 'title', 'description', 'status',
            'location', 'date_event', 'image',
            'category', 'author', 'author_name', 'created_at'
        ]


