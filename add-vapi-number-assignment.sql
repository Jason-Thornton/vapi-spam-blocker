-- Add assigned_vapi_number column to users table
ALTER TABLE users
ADD COLUMN assigned_vapi_number TEXT;

-- Assign your current number to your account
UPDATE users
SET assigned_vapi_number = '+16183528320'  -- Herbert
WHERE email = 'jason.thornton.dev@gmail.com';

-- Assign your wife's number
UPDATE users
SET assigned_vapi_number = '+16183528316'  -- Jolene
WHERE phone_number = '+16183009698';

-- Check current assignments
SELECT email, phone_number, assigned_vapi_number
FROM users
WHERE assigned_vapi_number IS NOT NULL;
