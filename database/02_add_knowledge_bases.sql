-- ==============================================================================
-- Add knowledge_bases table
-- This table stores knowledge base metadata (collections of files)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_bases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON public.knowledge_bases(user_id);

-- Policy: Users can view their own knowledge bases
CREATE POLICY "Users can view own knowledge bases"
ON public.knowledge_bases
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own knowledge bases
CREATE POLICY "Users can insert own knowledge bases"
ON public.knowledge_bases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own knowledge bases
CREATE POLICY "Users can update own knowledge bases"
ON public.knowledge_bases
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own knowledge bases
CREATE POLICY "Users can delete own knowledge bases"
ON public.knowledge_bases
FOR DELETE
USING (auth.uid() = user_id);

-- Grant table privileges to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_bases TO authenticated;
