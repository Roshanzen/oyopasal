# OyoPasal Database Management (MySQL 8.0)

This directory contains database management scripts, schema definitions, and migration backups for OyoPasal.

## Configuration
- **Engine**: MySQL 8.0 (InnoDB)
- **Charset**: `utf8mb4` (Full Unicode & Nepali language support)
- **Collation**: `utf8mb4_unicode_ci`
- **Database**: `oyopasal_db`
- **User**: `oyopasal_user`
- **Host**: `127.0.0.1` / `localhost`
- **Port**: `3306`

## Scripts
- **`scripts/init_mysql.sql`**: Idempotent SQL script to create `oyopasal_db` and configure user privileges.
- **`scripts/backup.ps1`**: Automated PowerShell backup script using `mysqldump`.
- **`scripts/restore.ps1`**: Restoration script for MySQL dumps.

## Backups Directory
All `.sql` dumps and `.json` data exports are stored in `database/backups/`.
Credentials and sensitive customer records are excluded from Git via `.gitignore`.
