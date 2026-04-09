
-- Level status change history for undo and timeline
CREATE TABLE public.level_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_status_id uuid NOT NULL REFERENCES public.level_status(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank_name rank_name NOT NULL,
  level_number integer NOT NULL,
  previous_status level_status_type NOT NULL,
  new_status level_status_type NOT NULL,
  changed_by uuid NOT NULL,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_level_status_history_level_status ON public.level_status_history(level_status_id);
CREATE INDEX idx_level_status_history_user ON public.level_status_history(user_id);

ALTER TABLE public.level_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own history"
  ON public.level_status_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Branch managers manage same branch history"
  ON public.level_status_history FOR ALL
  TO authenticated
  USING (is_same_branch(user_id));

CREATE POLICY "Super admins manage all history"
  ON public.level_status_history FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Update set_level_status to record history
CREATE OR REPLACE FUNCTION public.set_level_status(
  _member_id uuid, _rank rank_name, _level integer, _status level_status_type, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _caller_name text;
  _rank_label text;
  _old_status level_status_type;
  _ls_id uuid;
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;
  _rank_label := CASE _rank WHEN 'white' THEN '화이트' WHEN 'blue' THEN '블루' WHEN 'red' THEN '레드' WHEN 'black' THEN '블랙' END;

  -- Get current status
  SELECT status, id INTO _old_status, _ls_id FROM level_status
    WHERE user_id = _member_id AND rank_name = _rank AND level_number = _level;

  INSERT INTO level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
  VALUES (_member_id, _rank, _level, _status,
    CASE WHEN _status IN ('approved', 'boss_cleared') THEN now() ELSE NULL END,
    _caller_id, _note)
  ON CONFLICT (user_id, rank_name, level_number)
  DO UPDATE SET status = _status,
    completed_at = CASE WHEN _status IN ('approved', 'boss_cleared') THEN now() ELSE NULL END,
    approved_by = _caller_id, approval_note = _note, updated_at = now()
  RETURNING id INTO _ls_id;

  -- Record history
  INSERT INTO level_status_history (level_status_id, user_id, rank_name, level_number,
    previous_status, new_status, changed_by, change_reason)
  VALUES (_ls_id, _member_id, _rank, _level,
    COALESCE(_old_status, 'locked'), _status, _caller_id, _note);

  IF _status = 'approved' THEN
    PERFORM create_notification(_member_id,
      COALESCE(_caller_name, '관장님') || '님이 ' || _rank_label || ' 레벨 ' || _level || ' 완료를 승인했습니다', '');
  ELSIF _status = 'revision_requested' THEN
    PERFORM create_notification(_member_id,
      COALESCE(_caller_name, '관장님') || '님이 ' || _rank_label || ' 레벨 ' || _level || ' 보완을 요청했습니다', COALESCE(_note, ''));
  END IF;

  RETURN jsonb_build_object('status', _status::text, 'rank', _rank::text, 'level', _level,
    'previous_status', COALESCE(_old_status, 'locked')::text);
END;
$$;
