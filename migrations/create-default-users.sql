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

-- Delete existing users first (OPTIONAL - uncomment if needed)
-- DELETE FROM users;

-- Insert Default ADMIN User
INSERT INTO users (username, password, role, token_version, updated_at)
VALUES (
  'admin',
  '$2b$10$IIwX1N2flvMI6F.6L27ovuoybduhqYjHpIfaAXvHi587plF7oFugi',
  'admin',
  0,
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2b$10$IIwX1N2flvMI6F.6L27ovuoybduhqYjHpIfaAXvHi587plF7oFugi',
  role = 'admin',
  updated_at = NOW();

-- Insert Default NORMAL User
INSERT INTO users (username, password, role, token_version, updated_at)
VALUES (
  'user',
  '$2b$10$ixYpBGMES9IhTBroQZRvEe/wFDjZggENU2sHs4QHuw.3UpSsHpT2q',
  'user',
  0,
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2b$10$ixYpBGMES9IhTBroQZRvEe/wFDjZggENU2sHs4QHuw.3UpSsHpT2q',
  role = 'user',
  updated_at = NOW();

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
