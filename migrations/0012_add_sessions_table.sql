-- Add sessions table for tracking active user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_info text,
  ip_address text,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  login_at timestamp with time zone NOT NULL DEFAULT NOW(),
  last_activity_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_is_active_idx ON sessions(is_active);
