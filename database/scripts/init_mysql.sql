ALTER USER 'root'@'localhost' IDENTIFIED BY 'money';
CREATE DATABASE IF NOT EXISTS oyopasal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'oyopasal_user'@'localhost' IDENTIFIED BY 'money';
CREATE USER IF NOT EXISTS 'oyopasal_user'@'127.0.0.1' IDENTIFIED BY 'money';
ALTER USER 'oyopasal_user'@'localhost' IDENTIFIED BY 'money';
ALTER USER 'oyopasal_user'@'127.0.0.1' IDENTIFIED BY 'money';
GRANT ALL PRIVILEGES ON oyopasal_db.* TO 'oyopasal_user'@'localhost';
GRANT ALL PRIVILEGES ON oyopasal_db.* TO 'oyopasal_user'@'127.0.0.1';
FLUSH PRIVILEGES;
