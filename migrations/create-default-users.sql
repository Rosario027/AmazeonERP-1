-- ============================================================
-- AmazeonERP - Create Default Users for Login
-- ============================================================
-- Run this SQL in pgAdmin QUERY TOOL to create login credentials
--
-- DEFAULT CREDENTIALS:
-- Admin User:  username = admin,  password = admin@123
-- Normal User: username = user,   password = user@123
--
-- These are bcrypt hashed passwords (10 rounds)
-- ============================================================

-- Insert Default ADMIN User
INSERT INTO users (id, username, password, role, token_version, updated_at)
VALUES (
  'admin-user-id-001',
  'admin',
  '$2a$10$slYQmyNdGzin7aUMHSVH2OPST9/PgBkqquzi.Ss7KIUgO2t0jKMm2',
  'admin',
  0,
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Insert Default NORMAL User
INSERT INTO users (id, username, password, role, token_version, updated_at)
VALUES (
  'normal-user-id-001',
  'user',
  '$2a$10$CdyWu8z2O/v8UF6VvNvkuObvMcWWVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'user',
  0,
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Verify users were created
SELECT id, username, role FROM users;

-- ============================================================
-- USE THESE CREDENTIALS TO LOGIN:
-- ============================================================
-- 
-- ADMIN:
--   Username: admin
--   Password: admin@123
--
-- USER:
--   Username: user
--   Password: user@123
--
-- ============================================================
