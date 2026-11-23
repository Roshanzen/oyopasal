-- =============================================================================
-- OyoPasal — MySQL Production Least Privilege & Security Configuration
-- Separates administrative migrations user from runtime application user
-- =============================================================================

-- 1. Create Dedicated Production Application User (Least Privilege)
-- This user is restricted to DML queries (SELECT, INSERT, UPDATE, DELETE)
-- It cannot alter schema, drop tables, or grant privileges.
CREATE USER IF NOT EXISTS 'oyopasal_app'@'127.0.0.1' IDENTIFIED BY 'STRONG_APP_PASSWORD_HERE';
CREATE USER IF NOT EXISTS 'oyopasal_app'@'localhost' IDENTIFIED BY 'STRONG_APP_PASSWORD_HERE';

GRANT SELECT, INSERT, UPDATE, DELETE ON `oyopasal_prod`.* TO 'oyopasal_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `oyopasal_prod`.* TO 'oyopasal_app'@'localhost';

-- 2. Create Migration User (Used only during CI/CD deploy migrations)
CREATE USER IF NOT EXISTS 'oyopasal_migrator'@'127.0.0.1' IDENTIFIED BY 'STRONG_MIGRATOR_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON `oyopasal_prod`.* TO 'oyopasal_migrator'@'127.0.0.1';

-- 3. Dedicated Read-Only Backup User (Used by mysqldump backup script)
CREATE USER IF NOT EXISTS 'oyopasal_backup'@'127.0.0.1' IDENTIFIED BY 'STRONG_BACKUP_PASSWORD_HERE';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON `oyopasal_prod`.* TO 'oyopasal_backup'@'127.0.0.1';

FLUSH PRIVILEGES;
