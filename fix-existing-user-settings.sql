-- This will set default settings for ALL existing users
-- Run this in your Supabase SQL Editor

UPDATE users
SET
  auto_block = true,
  record_calls = true,
  block_robocalls = true,
  block_scammers = true,
  block_telemarketing = true,
  notifications = true,
  call_forwarding = false;

-- Check that it worked by viewing your users
SELECT id, email, auto_block, record_calls, block_robocalls FROM users;
