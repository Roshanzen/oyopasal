import os
from .base import *

DEBUG = False

# Production Host & Origin Hardening
ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', 'oyopasal.com,www.oyopasal.com,vendor.oyopasal.com,supplier.oyopasal.com,admin.oyopasal.com,api.oyopasal.com,localhost,127.0.0.1').split(',') if host]
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv('CSRF_TRUSTED_ORIGINS', 'https://oyopasal.com,https://www.oyopasal.com,https://vendor.oyopasal.com,https://supplier.oyopasal.com,https://admin.oyopasal.com').split(',') if origin]
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ALLOWED_ORIGINS', 'https://oyopasal.com,https://www.oyopasal.com,https://vendor.oyopasal.com,https://supplier.oyopasal.com,https://admin.oyopasal.com').split(',') if origin]

# Trusted Proxy & SSL Termination behind Nginx
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Enforce HTTPS & Cookie Security
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'True') == 'True'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # Allows frontend SPA client to read CSRF token if needed
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Upload Size Limits (25 MB max to protect against memory exhaustion)
DATA_UPLOAD_MAX_MEMORY_SIZE = 26214400  # 25 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 26214400  # 25 MB

# Production Database (MySQL 8.0)
DB_PASSWORD = os.getenv('DB_PASSWORD')
if not DB_PASSWORD:
    raise ValueError("CRITICAL PRODUCTION SECURITY ERROR: DB_PASSWORD environment variable must be explicitly configured.")

DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.mysql'),
        'NAME': os.getenv('DB_NAME', 'oyopasal_prod'),
        'USER': os.getenv('DB_USER', 'oyopasal_admin'),
        'PASSWORD': DB_PASSWORD,
        'HOST': os.getenv('DB_HOST', 'mysql'),
        'PORT': os.getenv('DB_PORT', '3306'),
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# Production Secret Key Verification
if not SECRET_KEY or 'change' in SECRET_KEY.lower():
    raise ValueError("CRITICAL PRODUCTION SECURITY ERROR: A cryptographically secure non-default SECRET_KEY must be provided.")

# Sentry SDK Error Tracking
SENTRY_DSN = os.getenv('SENTRY_DSN')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
