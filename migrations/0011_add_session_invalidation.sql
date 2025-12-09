-- Add token_version and updated_at columns to users table for session invalidation
ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN updated_at timestamp NOT NULL DEFAULT NOW();
