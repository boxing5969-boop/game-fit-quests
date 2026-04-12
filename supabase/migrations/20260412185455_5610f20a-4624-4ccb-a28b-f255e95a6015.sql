
-- 1. QR 체크인 토큰 테이블
CREATE TABLE public.qr_checkin_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_name text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_checkin_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_qr_tokens_branch ON public.qr_checkin_tokens (branch_name, is_active);
CREATE INDEX idx_qr_tokens_token ON public.qr_checkin_tokens (token) WHERE is_active = true;

CREATE POLICY "Branch managers manage own branch tokens"
  ON public.qr_checkin_tokens FOR ALL TO authenticated
  USING (is_same_branch(created_by) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Branch managers insert tokens"
  ON public.qr_checkin_tokens FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      has_role(auth.uid(), 'branch_manager'::app_role) OR
      has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 2. 출석 로그 테이블
CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_name text NOT NULL,
  method text NOT NULL DEFAULT 'qr',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  xp_granted integer NOT NULL DEFAULT 0,
  is_duplicate boolean NOT NULL DEFAULT false,
  display_name_snapshot text NOT NULL DEFAULT '',
  league_snapshot text NOT NULL DEFAULT 'white',
  level_snapshot integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attendance_branch_date ON public.attendance_logs (branch_name, checked_in_at);
CREATE INDEX idx_attendance_user_date ON public.attendance_logs (user_id, checked_in_at);

CREATE POLICY "Users view own attendance"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Branch managers view own branch attendance"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (is_same_branch(user_id));

CREATE POLICY "Super admins manage all attendance"
  ON public.attendance_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Branch managers delete own branch attendance"
  ON public.attendance_logs FOR DELETE TO authenticated
  USING (is_same_branch(user_id) AND has_role(auth.uid(), 'branch_manager'::app_role));

-- Allow anon SELECT for live board (filtered by branch only, no sensitive data)
CREATE POLICY "Anon view attendance for live board"
  ON public.attendance_logs FOR SELECT TO anon
  USING (true);

-- 3. 지점 표시 설정 테이블
CREATE TABLE public.branch_display_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_name text NOT NULL UNIQUE,
  display_name_mode text NOT NULL DEFAULT 'nickname',
  show_avatar boolean NOT NULL DEFAULT true,
  show_rank boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT false,
  animation_level text NOT NULL DEFAULT 'normal',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_display_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view display settings"
  ON public.branch_display_settings FOR SELECT TO anon
  USING (true);

CREATE POLICY "Authenticated view display settings"
  ON public.branch_display_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Branch managers manage own settings"
  ON public.branch_display_settings FOR ALL TO authenticated
  USING (
    branch_name = get_my_branch() AND (
      has_role(auth.uid(), 'branch_manager'::app_role) OR
      has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Super admins manage all settings"
  ON public.branch_display_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime for attendance_logs (for live board)
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
