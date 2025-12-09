-- ============================================================
-- ONE-TIME SESSION INVALIDATION SCRIPT
-- ============================================================
-- Run this ONCE during deployment to logout all active sessions
-- This increments token_version for all users, invalidating their JWTs
-- ============================================================

-- Increment token_version for ALL users to invalidate all active JWT tokens
UPDATE users 
SET token_version = COALESCE(token_version, 0) + 1,
    updated_at = NOW();

-- Verify the update
SELECT id, username, role, token_version, updated_at FROM users;

-- ============================================================
-- RESULT:
-- All active sessions are now INVALID
-- Users must LOGIN AGAIN to get new tokens
-- ============================================================
