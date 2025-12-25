-- Manual subscription upgrade to Basic tier
-- Run this in Supabase SQL Editor

UPDATE users
SET
  subscription_tier = 'basic',
  subscription_status = 'active',
  calls_limit = 15,
  calls_used_this_month = 5,  -- Keep your current usage
  updated_at = NOW()
WHERE clerk_user_id = 'user_37FF2zct26yvO7fWvdSxC7wm05F';

-- Verify the update
SELECT
  email,
  subscription_tier,
  subscription_status,
  calls_used_this_month,
  calls_limit,
  updated_at
FROM users
WHERE clerk_user_id = 'user_37FF2zct26yvO7fWvdSxC7wm05F';
