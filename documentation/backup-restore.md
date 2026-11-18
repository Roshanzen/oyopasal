# OyoPasal – Database Backup & Restoration Guide

This guide describes how to backup, export, and restore the OyoPasal MySQL 8.0 database.

---

## 1. Automated PowerShell Scripts

Two scripts are available in `database/scripts/`:

### Creating a Backup:
```powershell
.\database\scripts\backup.ps1
```
This generates a timestamped `.sql` file in `database/backups/oyopasal_backup_YYYYMMDD_HHMMSS.sql` using `mysqldump` with `--single-transaction`, `--routines`, and `--default-character-set=utf8mb4`.

### Restoring from a Backup:
```powershell
.\database\scripts\restore.ps1 -BackupFile "database\backups\oyopasal_backup_20261118_120000.sql"
```

---

## 2. Manual Commands (mysqldump / mysql CLI)

### Manual Backup (CLI):
```powershell
mysqldump -h 127.0.0.1 -u oyopasal_user -p --default-character-set=utf8mb4 --single-transaction --no-tablespaces oyopasal_db > database/backups/manual_backup.sql
```

### Manual Restore (CLI):
```powershell
mysql -h 127.0.0.1 -u oyopasal_user -p --default-character-set=utf8mb4 oyopasal_db < database/backups/manual_backup.sql
```

---

## 3. Django Fixture Backup (Cross-Database JSON)

To dump and load data across different database engines (e.g., SQLite to MySQL or MySQL to PostgreSQL):

### Export all application data:
```powershell
python backend/manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 -o database/backups/django_data_export.json
```

### Import into active database:
```powershell
python backend/manage.py loaddata database/backups/django_data_export.json
```
