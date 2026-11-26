from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("main", "0004_limit_item_event_date")]

    operations = [
        migrations.AddField(
            model_name="item",
            name="contact",
            field=models.CharField(
                blank=True,
                help_text="Указанный контакт будет виден в объявлении.",
                max_length=160,
                verbose_name="Контакт для связи",
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="avatar",
            field=models.ImageField(blank=True, null=True, upload_to="avatars/", verbose_name="Аватар"),
        ),
    ]
