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

## Настройки сервера

В окружении приложения задай переменные:

- `DJANGO_DEBUG=0` включает режим развёртывания, перенаправление на HTTPS и флаг `Secure` у сессионной и CSRF-cookie.
- `DJANGO_SECRET_KEY` должен содержать новый случайный ключ не короче 50 символов. Сгенерируй его через `django.core.management.utils.get_random_secret_key` и сохрани в настройках окружения сервера.
- `DJANGO_ALLOWED_HOSTS` содержит имена хостов через запятую, без схемы и порта. Например, `found.example.org`.

Если HTTPS завершается на обратном прокси, включай `DJANGO_TRUST_PROXY_HTTPS=1` только при закрытом прямом доступе к Django и когда прокси заменяет входящий `X-Forwarded-Proto` своим значением. После проверки HTTPS можно задать `DJANGO_HSTS_SECONDS` для этого домена.

С тем же окружением выполни команды из корня проекта:

```text
python -B backend/manage.py migrate
python -B backend/manage.py collectstatic --noinput
python -B backend/manage.py check --deploy
```

Запускай `uniwebsite.wsgi:application` WSGI-сервером с рабочей папкой `backend`. Настрой HTTPS на сервере или прокси. Направь `/static/` в `backend/staticfiles/`, а `/media/` в каталог загруженных фотографий `backend/media/`.

Для восстановления паролей настрой SMTP через `DJANGO_SMTP_HOST`, `DJANGO_SMTP_PORT`, `DJANGO_SMTP_USER`, `DJANGO_SMTP_PASSWORD`, `DJANGO_SMTP_USE_TLS=1` и `DJANGO_FROM_EMAIL`. В локальном режиме Django использует временный ключ, если `DJANGO_SECRET_KEY` не задан. Для сохранения локальных сессий после перезапуска задай постоянный ключ в окружении.
