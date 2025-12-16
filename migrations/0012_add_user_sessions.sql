-- Add user_sessions table for tracking active logins
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_info TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
