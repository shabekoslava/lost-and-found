from django.db import migrations


def add_default_categories(apps, schema_editor):
    category = apps.get_model("main", "Category")
    categories = category.objects.using(schema_editor.connection.alias)
    for name in ("Ключи", "Электроника", "Документы", "Одежда", "Другое"):
        if not categories.filter(name__iexact=name).exists():
            categories.create(name=name)


class Migration(migrations.Migration):
    dependencies = [("main", "0006_isolate_profile_and_publication_requests")]

    operations = [migrations.RunPython(add_default_categories, migrations.RunPython.noop)]
