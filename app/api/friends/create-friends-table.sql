-- This is a reference SQL file for creating the friends table in your Supabase database
-- You can run this in the Supabase SQL editor

-- Create friends table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_sender UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_receiver UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT unique_friendship UNIQUE (user_id_sender, user_id_receiver)
);

-- Add RLS policies
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see their own friend relationships
CREATE POLICY "Users can view their own friend relationships"
  ON public.friends
  FOR SELECT
  USING (auth.uid() = user_id_sender OR auth.uid() = user_id_receiver);

-- Policy to allow users to create friend requests
CREATE POLICY "Users can create friend requests"
  ON public.friends
  FOR INSERT
  WITH CHECK (auth.uid() = user_id_sender);

-- Policy to allow users to update friend requests they've received
CREATE POLICY "Users can update friend requests they've received"
  ON public.friends
  FOR UPDATE
  USING (auth.uid() = user_id_receiver AND status = 'pending');

-- Policy to allow users to delete their own friend relationships
CREATE POLICY "Users can delete their own friend relationships"
  ON public.friends
  FOR DELETE
  USING (auth.uid() = user_id_sender OR auth.uid() = user_id_receiver);

