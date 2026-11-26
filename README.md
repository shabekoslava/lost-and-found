# Бюро находок ТПУ

Веб-приложение для объявлений о потерянных и найденных вещах. Django открывает интерфейс, обрабатывает запросы API и хранит данные в SQLite.

## Локальный запуск

Открой корень репозитория в VS Code. В терминале PowerShell выполни команды из папки, где находятся `backend` и `frontend`. Запуск проверен с Python 3.14.2.

```powershell
python -m venv ..\tpu-venv
& ..\tpu-venv\Scripts\python.exe -m pip install -r backend\requirements.txt
& ..\tpu-venv\Scripts\python.exe -B backend\manage.py migrate
& ..\tpu-venv\Scripts\python.exe -B backend\manage.py runserver
```

Открой [главную страницу](http://127.0.0.1:8000/). При первом запуске `migrate` создаст локальную базу и заполнит справочники локаций и категорий. Чтобы опубликовать объявление, зарегистрируй аккаунт на сайте.

## Тесты

Выполни из корня репозитория в отдельном терминале.

```powershell
& ..\tpu-venv\Scripts\python.exe -B backend\manage.py test main --verbosity 1
```

## Админка

Для доступа к админке создай администратора в локальной базе. Команда попросит ввести имя пользователя и пароль.

```powershell
& ..\tpu-venv\Scripts\python.exe -B backend\manage.py createsuperuser
```

Войди с этой учётной записью в [админку Django](http://127.0.0.1:8000/admin/).
