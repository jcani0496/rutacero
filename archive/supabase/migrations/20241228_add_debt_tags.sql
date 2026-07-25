-- Add tags column to debts table for custom categorization (PRO feature)
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add index for faster tag-based queries
CREATE INDEX IF NOT EXISTS idx_debts_tags ON public.debts USING gin(tags);
