from django.db import transaction
from rest_framework import serializers
from .models import Category, Item, Profile


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']


class ItemSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.username')
    author_avatar = serializers.ImageField(source='author.profile.avatar', read_only=True, allow_null=True)

    class Meta:
        model = Item
        fields = [
            'id',
            'title',
            'description',
            'contact',
            'status',
            'location',
            'date_event',
            'image',
            'category',
            'building',
            'author',
            'author_name',
            'author_avatar',
            'created_at',
        ]

        read_only_fields = [
            'id', 'author', 'author_name', 'created_at'
        ]

    def validate_status(self, value):
        if value in Item.INACTIVE_STATUSES:
            if self.instance is None:
                raise serializers.ValidationError('Завершить можно существующее объявление.')
            current_status = self.instance.status
            if value != current_status and value != Item.COMPLETION_STATUSES.get(current_status):
                raise serializers.ValidationError('Этот итог не подходит для текущего статуса объявления.')

        return value


class ProfileAvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['avatar']


class MyProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="user.first_name", max_length=150, allow_blank=True, required=False)
    last_name = serializers.CharField(source="user.last_name", max_length=150, allow_blank=True, required=False)

    class Meta:
        model = Profile
        fields = ["first_name", "last_name", "nickname", "faculty", "group", "bio", "avatar"]

    @transaction.atomic
    def update(self, instance, validated_data):
        user_fields = validated_data.pop("user", {})
        if user_fields:
            user = instance.user
            for name, value in user_fields.items():
                setattr(user, name, value)
            user.save(update_fields=list(user_fields))
        return super().update(instance, validated_data)
