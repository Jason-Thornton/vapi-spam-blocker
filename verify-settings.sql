-- Check if your user has settings columns populated
-- Run this in Supabase SQL Editor to verify

SELECT
  id,
  email,
  auto_block,
  record_calls,
  block_robocalls,
  block_scammers,
  block_telemarketing,
  notifications,
  call_forwarding
FROM users
WHERE email = 'livendaadd3@gmail.com';
