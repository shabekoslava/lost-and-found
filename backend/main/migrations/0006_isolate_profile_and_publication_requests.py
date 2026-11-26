from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("main", "0005_item_contact_profile_avatar")]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="nickname",
            field=models.CharField(blank=True, max_length=60, verbose_name="Никнейм"),
        ),
        migrations.AddField(
            model_name="profile",
            name="bio",
            field=models.TextField(blank=True, max_length=1000, verbose_name="О себе"),
        ),
        migrations.AddField(
            model_name="item",
            name="client_request_id",
            field=models.UUIDField(blank=True, editable=False, null=True),
        ),
        migrations.AddConstraint(
            model_name="item",
            constraint=models.UniqueConstraint(
                fields=("author", "client_request_id"), name="unique_item_author_request",
            ),
        ),
    ]
