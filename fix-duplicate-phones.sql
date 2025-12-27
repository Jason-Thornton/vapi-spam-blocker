-- Remove phone number from all accounts except jason.thornton.dev@gmail.com
-- This will ensure all calls go to the right account

-- Clear phone from 19jbird73@gmail.com
UPDATE users
SET phone_number = NULL
WHERE email = '19jbird73@gmail.com';

-- Clear phone from jadmarketingai@gmail.com
UPDATE users
SET phone_number = NULL
WHERE email = 'jadmarketingai@gmail.com';

-- Clear phone from liveundead33@gmail.com
UPDATE users
SET phone_number = NULL
WHERE email = 'liveundead33@gmail.com';

-- Verify only jason.thornton.dev has the phone number
SELECT email, phone_number, calls_used_this_month
FROM users
WHERE phone_number = '+16184224956';
