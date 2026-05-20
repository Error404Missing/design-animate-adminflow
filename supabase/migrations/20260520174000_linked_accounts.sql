CREATE TABLE public.linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ign TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX linked_accounts_ign_lower_idx ON public.linked_accounts (LOWER(ign));

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view links" ON public.linked_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own links" ON public.linked_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can delete links" ON public.linked_accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
