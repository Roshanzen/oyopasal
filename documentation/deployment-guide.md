# OyoPasal – Production Deployment Guide

This guide outlines deploying the OyoPasal multi-vendor platform to production.

---

## 1. System Architecture in Production

```text
               ┌───────────────────────┐
               │  Nginx Reverse Proxy  │
               │      (Port 80/443)    │
               └───────────┬───────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    ┌─────────────────┐        ┌──────────────────┐
    │  Vite Frontend  │        │   Django WSGI/   │
    │  (Static Build) │        │     Gunicorn     │
    │   /dist/files   │        │   (Port 8000)    │
    └─────────────────┘        └─────────┬────────┘
                                         ▼
                               ┌──────────────────┐
                               │  MySQL 8.0 Server│
                               │   (Port 3306)    │
                               └──────────────────┘
```

---

## 2. MySQL Production Setup
1. Configure `my.cnf` / `my.ini` for optimal InnoDB buffer pool:
   ```ini
   [mysqld]
   default_storage_engine = InnoDB
   character_set_server = utf8mb4
   collation_server = utf8mb4_unicode_ci
   innodb_buffer_pool_size = 1G
   max_connections = 200
   ```
2. Enable automated daily backups using `database/scripts/backup.ps1` or cron job.

---

## 3. Django Backend Deployment
1. Set production environment variables in `backend/.env`:
   ```ini
   ENVIRONMENT=production
   DEBUG=False
   SECRET_KEY=generate-a-strong-64-character-production-key
   ALLOWED_HOSTS=oyopasal.com,www.oyopasal.com,api.oyopasal.com
   CORS_ALLOWED_ORIGINS=https://oyopasal.com,https://www.oyopasal.com
   CSRF_TRUSTED_ORIGINS=https://oyopasal.com,https://api.oyopasal.com
   USE_SQLITE=False
   DB_ENGINE=django.db.backends.mysql
   DB_NAME=oyopasal_prod_db
   DB_USER=oyopasal_prod_user
   DB_PASSWORD=strong_production_password
   DB_HOST=127.0.0.1
   DB_PORT=3306
   ```
2. Run migrations and collect static files:
   ```powershell
   python backend/manage.py migrate
   python backend/manage.py collectstatic --noinput
   ```
3. Run with Gunicorn or Daphne:
   ```bash
   gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 4 --threads 2
   ```

---

## 4. Frontend Build
```powershell
npm run build
```
Deploy the generated `dist/` directory to Nginx or a static hosting CDN (Cloudflare Pages, Vercel, S3).
