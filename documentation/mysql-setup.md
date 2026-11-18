# OyoPasal – MySQL 8.0 Database Setup Guide

This guide details setting up, configuring, and connecting MySQL 8.0 for OyoPasal on Windows.

---

## 1. Prerequisites
- **MySQL Server 8.0+** installed
- **Character Set:** `utf8mb4`
- **Collation:** `utf8mb4_unicode_ci`
- **Default Storage Engine:** `InnoDB`

---

## 2. Starting the MySQL Service on Windows

MySQL runs as a Windows background service (typically named `MySQL80` or `MySQL`).

### Using PowerShell (Run as Administrator):
```powershell
# 1. Check MySQL service status
Get-Service -Name *mysql*

# 2. Start the service
Start-Service -Name MySQL80
# Or using net start:
net start MySQL80
```

### Using Windows Services UI:
1. Press `Win + R`, type `services.msc`, and press **Enter**.
2. Scroll down to locate **MySQL80**.
3. Right-click **MySQL80** and click **Start** (or set Startup type to **Automatic**).

---

## 3. Creating Database and User Privileges

Once MySQL is running, connect via the MySQL CLI or MySQL Workbench and run:

```sql
-- 1. Create the Database with full UTF8MB4 support
CREATE DATABASE IF NOT EXISTS oyopasal_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. Create the Application User
CREATE USER IF NOT EXISTS 'oyopasal_user'@'localhost' IDENTIFIED BY 'oyopasal_password';
CREATE USER IF NOT EXISTS 'oyopasal_user'@'127.0.0.1' IDENTIFIED BY 'oyopasal_password';

-- 3. Grant Privileges
GRANT ALL PRIVILEGES ON oyopasal_db.* TO 'oyopasal_user'@'localhost';
GRANT ALL PRIVILEGES ON oyopasal_db.* TO 'oyopasal_user'@'127.0.0.1';

-- 4. Apply changes
FLUSH PRIVILEGES;
```

*Note: You can also execute the automated script directly:*
```powershell
mysql -u root -p < database/scripts/init_mysql.sql
```

---

## 4. Connecting Django to MySQL

In `backend/.env`, set:
```ini
USE_SQLITE=False
DB_ENGINE=django.db.backends.mysql
DB_NAME=oyopasal_db
DB_USER=oyopasal_user
DB_PASSWORD=oyopasal_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

Then test connectivity with:
```powershell
cd backend
python manage.py check --database default
python manage.py showmigrations
```
