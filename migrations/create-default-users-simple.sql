-- ============================================================
-- AmazeonERP - Create Default Users for Login
-- ============================================================
-- If you get error about token_version, run this simpler version:

-- Check current users table structure
\d users

-- Insert Default ADMIN User (without token_version if column doesn't exist)
INSERT INTO users (username, password, role)
VALUES (
  'admin',
  '$2b$10$IIwX1N2flvMI6F.6L27ovuoybduhqYjHpIfaAXvHi587plF7oFugi',
  'admin'
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2b$10$IIwX1N2flvMI6F.6L27ovuoybduhqYjHpIfaAXvHi587plF7oFugi',
  role = 'admin';

-- Insert Default NORMAL User
INSERT INTO users (username, password, role)
VALUES (
  'user',
  '$2b$10$ixYpBGMES9IhTBroQZRvEe/wFDjZggENU2sHs4QHuw.3UpSsHpT2q',
  'user'
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2b$10$ixYpBGMES9IhTBroQZRvEe/wFDjZggENU2sHs4QHuw.3UpSsHpT2q',
  role = 'user';

-- Verify users were created
SELECT id, username, role FROM users;

-- ============================================================
-- If the above fails, add the missing columns first:
-- ============================================================

-- ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Then run the INSERT statements above again.
