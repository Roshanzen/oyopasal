import os
from .base import *

DEBUG = True

# Database Configuration: Standardized on MySQL 8.0+ (with SQLite fallback for isolated unit testing)
DB_ENGINE = os.getenv('DB_ENGINE', 'django.db.backends.mysql')
DB_NAME = os.getenv('DB_NAME', 'oyopasal_db')
DB_USER = os.getenv('DB_USER', 'oyopasal_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'oyopasal_password')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')

# Allow local sqlite and in-memory cache fallback if running tests or if explicitly set
USE_SQLITE = os.getenv('USE_SQLITE', 'False') == 'True'

if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'oyopasal-test-cache',
        }
    }
else:
    db_config = {
        'ENGINE': DB_ENGINE,
        'NAME': DB_NAME,
        'USER': DB_USER,
        'PASSWORD': DB_PASSWORD,
        'HOST': DB_HOST,
        'PORT': DB_PORT,
    }
    if 'mysql' in DB_ENGINE:
        db_config['OPTIONS'] = {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    DATABASES = {
        'default': db_config
    }

# Email Configuration - Local Development
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    "notifications@oyopasal.com"
)
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:3000"
)
