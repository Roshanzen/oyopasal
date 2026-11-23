# OyoPasal — Production Deployment & Infrastructure Runbook

This document details the production deployment, system hardening, backup, and disaster recovery procedures for **OyoPasal**, a multi-vendor e-commerce marketplace platform tailored for Nepal.

---

## 1. Architecture Overview

```
                                [ Internet / Clients ]
                                          │
                                   HTTPS (Port 443)
                                          ▼
                         [ Nginx Reverse Proxy & SSL (HSTS) ]
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
   [ Static / Media Assets ]     [ Frontend SPA ]             [ API / Django ]
   /var/www/oyopasal/staticfiles /var/www/oyopasal/dist     Proxy to 127.0.0.1:8000
                                (Vite React 19 Bundle)    (Gunicorn WSGI - 4 Workers)
                                                                      │
                                                ┌─────────────────────┴─────────────────────┐
                                                ▼                                           ▼
                                      [ MySQL 8.0 Database ]                       [ Redis 7 Cluster ]
                                      (oyopasal_prod schema)                    (Cache, Celery & Channels)
                                                ▲                                           │
                                                │                                           ▼
                                     [ Periodic Backups ]                        [ Celery Workers & Beat ]
                                    (Cron + Compressed Dump)                    (Async Tasks & Expirations)
```

---

## 2. Server Prerequisites

- **Operating System**: Ubuntu 22.04 LTS or 24.04 LTS (x86_64)
- **Compute Recommendations**:
  - Minimum: 2 vCPU, 4 GB RAM, 40 GB NVMe SSD
  - Recommended Production: 4 vCPU, 8 GB RAM, 80 GB NVMe SSD
- **Software Dependencies**:
  - Python 3.12+ with `python3-venv` and `python3-dev`
  - Node.js 22.x LTS and `npm`
  - MySQL 8.0+ Server and client libraries (`libmysqlclient-dev` / `default-libmysqlclient-dev`)
  - Redis 7.x Server
  - Nginx 1.24+
  - Certbot with `python3-certbot-nginx`

### Baseline OS Package Installation
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git ufw fail2ban \
    python3.12 python3.12-venv python3.12-dev \
    mysql-server default-libmysqlclient-dev pkg-config \
    redis-server nginx certbot python3-certbot-nginx
```

---

## 3. Firewall & Security Hardening

```bash
# Allow SSH, HTTP, and HTTPS only
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Configure fail2ban for SSH and Nginx protection
sudo systemctl enable --now fail2ban
```

---

## 4. Database Setup & Least Privilege Configuration

Execute MySQL secure installation and configure the production database:

```bash
sudo mysql_secure_installation
```

Log in as MySQL root:
```bash
sudo mysql -u root -p
```

Execute the least-privilege script from `deploy/scripts/mysql_least_privilege.sql`:
```sql
CREATE DATABASE IF NOT EXISTS `oyopasal_prod` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Dedicated Runtime Application User (DML operations only)
CREATE USER 'oyopasal_app'@'127.0.0.1' IDENTIFIED BY 'YOUR_STRONG_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON `oyopasal_prod`.* TO 'oyopasal_app'@'127.0.0.1';

-- 2. Migrator User (Used exclusively during deploy migrations)
CREATE USER 'oyopasal_migrator'@'127.0.0.1' IDENTIFIED BY 'YOUR_STRONG_MIGRATOR_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON `oyopasal_prod`.* TO 'oyopasal_migrator'@'127.0.0.1';

-- 3. Dedicated Read-Only Backup User (Used by automated mysqldump script)
CREATE USER 'oyopasal_backup'@'127.0.0.1' IDENTIFIED BY 'YOUR_STRONG_BACKUP_PASSWORD';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON `oyopasal_prod`.* TO 'oyopasal_backup'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

---

## 5. Application Code & Environment Setup

### 5.1 Directory Structure
```bash
sudo mkdir -p /var/www/oyopasal /var/log/oyopasal /var/backups/oyopasal/mysql /var/run/celery
sudo chown -R www-data:www-data /var/www/oyopasal /var/log/oyopasal /var/backups/oyopasal /var/run/celery
```

### 5.2 Clone & Install Backend
```bash
cd /var/www/oyopasal
git clone https://github.com/your-org/oyopasal.git .

# Create and activate Python virtual environment
python3.12 -m venv backend/venv
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt gunicorn
```

### 5.3 Configure Production Environment (`backend/.env`)
Copy [backend/.env.example](file:///c:/Users/acer/Documents/psl/oyopasal/backend/.env.example) to `backend/.env` and populate production values:
```ini
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=generate_with_python_secrets_token_urlsafe_64
DEBUG=False
ENVIRONMENT=production
ALLOWED_HOSTS=oyopasal.com,www.oyopasal.com,api.oyopasal.com,vendor.oyopasal.com,admin.oyopasal.com,127.0.0.1

DB_ENGINE=django.db.backends.mysql
DB_NAME=oyopasal_prod
DB_USER=oyopasal_app
DB_PASSWORD=YOUR_STRONG_APP_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=3306

CORS_ALLOWED_ORIGINS=https://oyopasal.com,https://www.oyopasal.com,https://vendor.oyopasal.com,https://admin.oyopasal.com
CSRF_TRUSTED_ORIGINS=https://oyopasal.com,https://www.oyopasal.com,https://vendor.oyopasal.com,https://admin.oyopasal.com

REDIS_URL=redis://127.0.0.1:6379/1
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0

# Optional Sentry Monitoring
SENTRY_DSN=https://your_sentry_dsn_here
```
Restrict file permissions:
```bash
chmod 600 /var/www/oyopasal/backend/.env
```

### 5.4 Run Migrations and Static Collection
```bash
# Execute migrations using the migrator credentials
DB_USER=oyopasal_migrator DB_PASSWORD=YOUR_STRONG_MIGRATOR_PASSWORD python backend/manage.py migrate --noinput

# Collect static assets
python backend/manage.py collectstatic --noinput
```

---

## 6. Frontend Build & Optimization

The frontend bundle is optimized with route-based `React.lazy` code-splitting and vendor chunking:
```bash
cd /var/www/oyopasal
npm ci
npm run build
```
- The compiled SPA output is located at `/var/www/oyopasal/dist`.
- Initial customer entrypoint: **~390 kB** (gzip: 95 kB), down from 1.79 MB.

---

## 7. Systemd Service Management

Install the production service definitions:
```bash
sudo cp deploy/systemd/oyopasal-backend.service /etc/systemd/system/
sudo cp deploy/systemd/oyopasal-celery.service /etc/systemd/system/
sudo cp deploy/systemd/oyopasal-celerybeat.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now oyopasal-backend
sudo systemctl enable --now oyopasal-celery
sudo systemctl enable --now oyopasal-celerybeat
```

### Service Verification
```bash
sudo systemctl status oyopasal-backend
sudo systemctl status oyopasal-celery
sudo systemctl status oyopasal-celerybeat
```

---

## 8. Nginx & SSL Setup

```bash
# Copy Nginx configuration
sudo cp deploy/nginx/oyopasal.conf /etc/nginx/sites-available/oyopasal.conf
sudo ln -s /etc/nginx/sites-available/oyopasal.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax
sudo nginx -t

# Obtain Let's Encrypt SSL certificate
sudo certbot --nginx -d oyopasal.com -d www.oyopasal.com -d api.oyopasal.com -d vendor.oyopasal.com -d admin.oyopasal.com

# Reload Nginx
sudo systemctl reload nginx
```

---

## 9. Automated Database Backups & Recovery

### 9.1 Daily Automated Backup via Cron
Make the backup script executable:
```bash
chmod +x /var/www/oyopasal/deploy/scripts/backup_mysql.sh
```

Configure `crontab -e`:
```cron
# Run daily MySQL compressed backup at 02:00 AM NPT (UTC+5:45)
0 2 * * * /var/www/oyopasal/deploy/scripts/backup_mysql.sh >> /var/log/oyopasal/mysql_backup.log 2>&1
```

### 9.2 Restoration Procedure
In the event of database recovery:
```bash
chmod +x /var/www/oyopasal/deploy/scripts/restore_mysql.sh

# Run restore targeting staging/test database first to verify integrity
./deploy/scripts/restore_mysql.sh /var/backups/oyopasal/mysql/oyopasal_db_YYYYMMDD_HHMMSS.sql.gz test_restore_db

# Run restore targeting production database after strict validation
./deploy/scripts/restore_mysql.sh /var/backups/oyopasal/mysql/oyopasal_db_YYYYMMDD_HHMMSS.sql.gz oyopasal_prod
```

---

## 10. Zero-Downtime Deployment Runbook

To deploy a new release:

```bash
cd /var/www/oyopasal

# 1. Fetch latest verified commit
git fetch origin && git checkout main && git pull origin main

# 2. Update backend virtualenv dependencies
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# 3. Execute database migrations (backward-compatible)
DB_USER=oyopasal_migrator DB_PASSWORD=YOUR_STRONG_MIGRATOR_PASSWORD python backend/manage.py migrate --noinput

# 4. Collect static files
python backend/manage.py collectstatic --noinput

# 5. Build optimized frontend bundle
npm ci
npm run build

# 6. Graceful reload of backend application workers (zero dropped requests)
sudo systemctl reload oyopasal-backend
sudo systemctl restart oyopasal-celery
sudo systemctl restart oyopasal-celerybeat
sudo systemctl reload nginx

# 7. Verify health check
curl -f https://oyopasal.com/api/v1/health/
```

---

## 11. Rollback Procedure

If unexpected errors occur post-deploy:

```bash
# 1. Revert to previous release tag or commit
git checkout <previous_stable_commit>

# 2. Re-build frontend
npm run build

# 3. Reload services
sudo systemctl reload oyopasal-backend
sudo systemctl restart oyopasal-celery
sudo systemctl reload nginx

# 4. If schema rollback is required:
python backend/manage.py migrate <app_name> <previous_migration_name>
```

---

## 12. Troubleshooting & Common Pitfalls

| Issue | Typical Cause | Diagnostic Command | Remediation |
|---|---|---|---|
| **502 Bad Gateway** | Gunicorn process crashed or stopped | `sudo systemctl status oyopasal-backend` | Check `/var/log/oyopasal/gunicorn_error.log` for Python exceptions. |
| **CSRF Failed** | Mismatched trusted origins or missing header | Check `CSRF_TRUSTED_ORIGINS` in `.env` | Ensure frontend origin (`https://oyopasal.com`) is present in `CSRF_TRUSTED_ORIGINS`. |
| **413 Request Entity Too Large** | Upload exceeds body limit | Inspect Nginx `client_max_body_size` | Ensure both Nginx and Django settings allow 25M uploads. |
| **WebSocket Connection Failed** | Daphne not running or upgrade headers missing | `sudo systemctl status daphne` | Verify `proxy_set_header Upgrade $http_upgrade` in Nginx `/ws/` block. |
| **MySQL Connection Refused** | MySQL service down or connection limit reached | `sudo systemctl status mysql` | Check `max_connections` in `/etc/mysql/mysql.conf.d/mysqld.cnf`. |
