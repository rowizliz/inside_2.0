-- Fix RLS policies for posts table
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily for posts table
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;

-- Or create permissive policies for posts table
-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy for inserting posts (any authenticated user can insert)
CREATE POLICY "Users can insert their own posts" ON posts
FOR INSERT WITH CHECK (auth.uid() = author_uid);

-- Policy for viewing posts (anyone can view)
CREATE POLICY "Anyone can view posts" ON posts
FOR SELECT USING (true);

-- Policy for updating posts (only author can update)
CREATE POLICY "Users can update their own posts" ON posts
FOR UPDATE USING (auth.uid() = author_uid);

-- Policy for deleting posts (only author can delete)
CREATE POLICY "Users can delete their own posts" ON posts
FOR DELETE USING (auth.uid() = author_uid);

-- Fix RLS policies for post_likes table
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Policy for post_likes
CREATE POLICY "Users can manage their own likes" ON post_likes
FOR ALL USING (auth.uid() = user_id);

-- Fix storage policies
-- Run this in Supabase Storage settings

-- For posts bucket, create policy:
-- Policy Name: "Public Access"
-- Policy Definition: (bucket_id = 'posts')
-- Allowed Operations: SELECT, INSERT, UPDATE, DELETE
-- Target Roles: authenticated, anon 

-- Disable RLS temporarily for profiles table to fix upload issues
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Or create more permissive policies if you want to keep RLS enabled
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable all operations for profiles" ON profiles;
CREATE POLICY "Enable all operations for profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- Re-enable RLS if you want to keep it
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; 