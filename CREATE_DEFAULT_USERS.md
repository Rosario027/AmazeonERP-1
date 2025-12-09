# How to Create Default Login Credentials

## Quick Steps:

### 1. Open pgAdmin
- Go to your PostgreSQL database in pgAdmin
- Click on your database

### 2. Open Query Tool
- Right-click on your database name
- Select **"Query Tool"**

### 3. Copy-Paste This SQL:

```sql
INSERT INTO users (username, password, role, token_version, updated_at)
VALUES ('admin', '$2b$10$IIwX1N2flvMI6F.6L27ovuoybduhqYjHpIfaAXvHi587plF7oFugi', 'admin', 0, NOW())
ON CONFLICT (username) DO UPDATE SET password = '$2b$10$IIwX1N2flvMI6F.6L27ovuoybduhqYjHpIfaAXvHi587plF7oFugi', role = 'admin', updated_at = NOW();

INSERT INTO users (username, password, role, token_version, updated_at)
VALUES ('user', '$2b$10$ixYpBGMES9IhTBroQZRvEe/wFDjZggENU2sHs4QHuw.3UpSsHpT2q', 'user', 0, NOW())
ON CONFLICT (username) DO UPDATE SET password = '$2b$10$ixYpBGMES9IhTBroQZRvEe/wFDjZggENU2sHs4QHuw.3UpSsHpT2q', role = 'user', updated_at = NOW();

SELECT * FROM users;
```

### 4. Click Execute (or press F5)

### 5. Now You Can Login With:

**ADMIN ACCOUNT:**
```
Username: admin
Password: admin@123
```

**USER ACCOUNT:**
```
Username: user
Password: user@123
```

---

## What You Just Did:
- Created two user accounts in the database
- The passwords are securely hashed with bcrypt
- You can now login to the AmazeonERP application

## After Login:
1. Go to Settings page
2. You can change passwords or create more users
3. Remember to change these default passwords for security!
