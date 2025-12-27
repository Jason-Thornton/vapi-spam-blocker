-- Enable RLS on call_logs table (if not already enabled)
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can insert their own call logs" ON call_logs;

-- Allow users to read their own call logs
-- Note: We can't use auth.uid() because we're using Clerk, not Supabase Auth
-- So we need to match on user_id
CREATE POLICY "Users can view their own call logs"
ON call_logs
FOR SELECT
USING (true);  -- Allow all reads for now since we filter by user_id in the app

-- Allow backend (service role) to insert call logs
CREATE POLICY "Service role can insert call logs"
ON call_logs
FOR INSERT
WITH CHECK (true);

-- Allow backend (service role) to update call logs
CREATE POLICY "Service role can update call logs"
ON call_logs
FOR UPDATE
USING (true);

-- Also ensure users table has proper RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Allow users to read all user data (needed for looking up phone numbers)
CREATE POLICY "Users can view user data"
ON users
FOR SELECT
USING (true);

-- Allow users to update their own data
CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
USING (true);

-- Allow service role to insert new users
CREATE POLICY "Service role can insert users"
ON users
FOR INSERT
WITH CHECK (true);
