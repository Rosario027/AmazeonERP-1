-- ============================================================
-- AmazeonERP - User Reset Script
-- ============================================================
-- Run this SQL in pgAdmin to reset user credentials
--
-- IMPORTANT NOTES:
-- 1. Passwords are HASHED with bcrypt for security
-- 2. You cannot retrieve original passwords from the database
-- 3. Use this script to create NEW default credentials
-- 4. Remember to change these after first login!
-- ============================================================

-- Step 1: View current users in the database
SELECT id, username, role, updated_at FROM users;

-- Step 2: Delete existing users (OPTIONAL - uncomment only if needed)
-- DELETE FROM users;

-- Step 3: Create DEFAULT ADMIN user with password: admin123
-- bcrypt hash for 'admin123' 
INSERT INTO users (username, password, role, token_version, updated_at)
VALUES (
  'admin',
  '$2a$10$EIXjxbXJdN6d.l5OQvk4jODQrK5S5.sKqGUvOVo7H.Cyo1S9QKUKK',
  'admin',
  0,
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2a$10$EIXjxbXJdN6d.l5OQvk4jODQrK5S5.sKqGUvOVo7H.Cyo1S9QKUKK',
  role = 'admin',
  updated_at = NOW();

-- Step 4: Create DEFAULT USER with password: user123
-- bcrypt hash for 'user123'
INSERT INTO users (username, password, role, token_version, updated_at)
VALUES (
  'user',
  '$2a$10$cVbS9.hNqKFT3jMqEzK0tu63TCjLJpqHt4O9PkrFuYoMJN7P8G/Za',
  'user',
  0,
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2a$10$cVbS9.hNqKFT3jMqEzK0tu63TCjLJpqHt4O9PkrFuYoMJN7P8G/Za',
  role = 'user',
  updated_at = NOW();

-- Step 5: Verify users were created/updated
SELECT id, username, role FROM users ORDER BY role DESC;

-- ============================================================
-- DEFAULT CREDENTIALS
-- ============================================================
-- Admin:
--   Username: admin
--   Password: admin123
--
-- User:
--   Username: user
--   Password: user123
--
-- ⚠️  IMPORTANT: Change these credentials after first login!
-- ============================================================
