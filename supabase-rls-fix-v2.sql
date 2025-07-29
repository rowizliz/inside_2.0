-- Completely disable RLS for profiles table to fix update issues
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies for profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable all operations for profiles" ON profiles;

-- Create a single permissive policy for all operations
CREATE POLICY "Enable all operations for profiles" ON profiles
FOR ALL USING (true) WITH CHECK (true);

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position; 