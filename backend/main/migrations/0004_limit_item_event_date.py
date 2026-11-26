import django.core.validators
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("main", "0003_populate_campus_places")]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="date_event",
            field=models.DateField(
                default=django.utils.timezone.localdate,
                validators=[
                    django.core.validators.MaxValueValidator(
                        django.utils.timezone.localdate,
                        message="Дата события не может быть в будущем.",
                    ),
                ],
                verbose_name="Дата потери/находки",
            ),
        ),
    ]
