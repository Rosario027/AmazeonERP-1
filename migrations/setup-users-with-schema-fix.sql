-- ============================================================
-- AmazeonERP - Complete User Setup with Schema Fix
-- ============================================================
-- Run this script to fix missing columns and create users

-- Step 1: Add missing columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Step 2: Create Default ADMIN User
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

-- Step 3: Create Default NORMAL User
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

-- Step 4: Verify users were created/updated
SELECT id, username, role, token_version FROM users ORDER BY role DESC;

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
