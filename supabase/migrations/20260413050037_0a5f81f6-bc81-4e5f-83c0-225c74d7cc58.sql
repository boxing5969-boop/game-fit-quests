
-- Create activity_sessions table
CREATE TABLE public.activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'auto_ended')),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  expires_from_board_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_sessions_branch_status ON public.activity_sessions (branch_name, status);
CREATE INDEX idx_activity_sessions_user_date ON public.activity_sessions (user_id, started_at);

-- Enable RLS
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own sessions"
  ON public.activity_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own sessions"
  ON public.activity_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.activity_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Branch managers view branch sessions"
  ON public.activity_sessions FOR SELECT
  TO authenticated
  USING (is_same_branch(user_id));

CREATE POLICY "Super admins manage all sessions"
  ON public.activity_sessions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anon view sessions for live board"
  ON public.activity_sessions FOR SELECT
  TO anon
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_sessions;
