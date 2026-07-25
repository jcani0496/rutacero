CREATE TABLE IF NOT EXISTS public.user_consent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('tos', 'privacy', 'financial_disclaimer', 'cookies')),
    version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_consent_log_user_doc
  ON public.user_consent_log(user_id, document_type);

ALTER TABLE public.user_consent_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent history
CREATE POLICY "Users read own consents"
  ON public.user_consent_log FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts only from service role (so the signup server action does the write)
CREATE POLICY "Service role manages consents"
  ON public.user_consent_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
