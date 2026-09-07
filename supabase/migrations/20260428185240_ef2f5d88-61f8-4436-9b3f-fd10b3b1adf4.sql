-- Marketing contacts captured from /mobile-preview CTA
CREATE TABLE public.marketing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  source text NOT NULL DEFAULT 'mobile_preview',
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_contacts_email_or_phone_required
    CHECK ((email IS NOT NULL AND length(trim(email)) > 0)
        OR (phone IS NOT NULL AND length(trim(phone)) > 0))
);

CREATE INDEX idx_marketing_contacts_created_at ON public.marketing_contacts(created_at DESC);

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can submit a contact entry
CREATE POLICY marketing_contacts_public_insert
  ON public.marketing_contacts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read the contacts list
CREATE POLICY marketing_contacts_admin_select
  ON public.marketing_contacts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));