-- Add settings columns to the users table
-- Run this in your Supabase SQL Editor

ALTER TABLE users
ADD COLUMN IF NOT EXISTS auto_block BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS record_calls BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS block_robocalls BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS block_scammers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS block_telemarketing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS call_forwarding BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_numbers TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Optional: Update existing users to have default settings
UPDATE users
SET
  auto_block = COALESCE(auto_block, true),
  record_calls = COALESCE(record_calls, true),
  block_robocalls = COALESCE(block_robocalls, true),
  block_scammers = COALESCE(block_scammers, true),
  block_telemarketing = COALESCE(block_telemarketing, true),
  notifications = COALESCE(notifications, true),
  call_forwarding = COALESCE(call_forwarding, false)
WHERE auto_block IS NULL;
