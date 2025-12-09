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
VALUES ('admin', '$2a$10$slYQmyNdGzin7aUMHSVH2OPST9/PgBkqquzi.Ss7KIUgO2t0jKMm2', 'admin', 0, NOW());

INSERT INTO users (username, password, role, token_version, updated_at)
VALUES ('user', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT3e', 'user', 0, NOW());

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
