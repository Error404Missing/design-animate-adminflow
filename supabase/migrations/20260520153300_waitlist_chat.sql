
-- Test Requests table
CREATE TABLE public.test_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ign TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'overall',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.test_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own request" ON public.test_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own requests" ON public.test_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests" ON public.test_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.test_requests(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_requests r
      WHERE r.id = request_id
      AND (r.user_id = auth.uid() OR r.tester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Chat participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.test_requests r
      WHERE r.id = request_id
      AND (r.user_id = auth.uid() OR r.tester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Grant has_role to authenticated if not already granted
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
