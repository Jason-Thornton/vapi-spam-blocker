-- Move all calls from duplicate accounts to jason.thornton.dev@gmail.com
-- Run this AFTER running fix-duplicate-phones.sql

-- Get Jason's user ID
-- jason.thornton.dev@gmail.com = 4ce36bbd-ce05-420d-982d-491b49585086

-- Move calls from 19jbird73@gmail.com
UPDATE call_logs
SET user_id = '4ce36bbd-ce05-420d-982d-491b49585086'
WHERE user_id = '9fdd9da6-0104-4c2f-ad68-aa8d9606d0dd';

-- Move calls from jadmarketingai@gmail.com
UPDATE call_logs
SET user_id = '4ce36bbd-ce05-420d-982d-491b49585086'
WHERE user_id = '55d911ea-8f5b-450f-8d9c-bfb21858e47f';

-- Move calls from liveundead33@gmail.com
UPDATE call_logs
SET user_id = '4ce36bbd-ce05-420d-982d-491b49585086'
WHERE user_id = 'c540580d-4658-49c3-9c5e-82c56dbf01fb';

-- Update jason.thornton.dev's call count
UPDATE users
SET calls_used_this_month = (
  SELECT COUNT(*) FROM call_logs WHERE user_id = '4ce36bbd-ce05-420d-982d-491b49585086'
)
WHERE id = '4ce36bbd-ce05-420d-982d-491b49585086';

-- Verify the consolidation
SELECT
  u.email,
  u.calls_used_this_month,
  COUNT(cl.id) as actual_calls
FROM users u
LEFT JOIN call_logs cl ON cl.user_id = u.id
WHERE u.email IN ('jason.thornton.dev@gmail.com', '19jbird73@gmail.com', 'jadmarketingai@gmail.com', 'liveundead33@gmail.com')
GROUP BY u.email, u.calls_used_this_month;
