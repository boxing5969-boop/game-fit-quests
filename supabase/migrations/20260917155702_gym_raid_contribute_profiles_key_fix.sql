-- 짐 레이드 기여도 같은 버그였다 (2026-09-17)
--
-- 앞선 복구에서 조회 쪽(get_active_gym_raids)만 고쳤는데, 기여를 넣는
-- contribute_to_gym_raid 에도 같은 줄이 남아 있었다:
--     SELECT branch_name INTO v_my_branch FROM public.profiles WHERE id = v_uid;
-- → 항상 NULL → 'no branch' 로 조용히 반환.
-- 즉 레이드를 만들어도 숫자가 영원히 0 에 머문다.
--
-- 다른 로직은 그대로 두고 그 한 줄만 user_id 로 바꾼다.

create or replace function public.contribute_to_gym_raid(
  p_source_type text,
  p_source_id uuid default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_raid public.boxing_gym_raids%ROWTYPE;
  v_raid_type text;
  v_value numeric := 1;
  v_source_valid boolean := false;
  v_resolved_source_id uuid := p_source_id;
  v_inserted_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_source_type IS NULL OR length(trim(p_source_type)) = 0 THEN
    RAISE EXCEPTION 'gym raid invalid source';
  END IF;

  -- §11-⑬ source 검증 — 다른 사람 source 자기 것으로 등록 방지
  -- source_id 가 NULL 이면 본인의 최근 5분 내 source 자동 매칭 (v1 RPC 가 ID
  -- 반환 안 하는 quiz/challenge 우회용 — 매번 같은 source 면 UNIQUE 로 차단)
  IF p_source_type = 'boxing_quiz_attempt' THEN
    IF v_resolved_source_id IS NULL THEN
      SELECT id INTO v_resolved_source_id
      FROM public.boxing_quiz_attempts
      WHERE user_id = v_uid AND is_correct = true
        AND created_at > now() - INTERVAL '5 minutes'
      ORDER BY created_at DESC LIMIT 1;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.boxing_quiz_attempts
      WHERE id = v_resolved_source_id AND user_id = v_uid AND is_correct = true
    ) INTO v_source_valid;
    v_raid_type := 'quiz_correct';

  ELSIF p_source_type = 'boxing_fun_challenge_attempt' THEN
    IF v_resolved_source_id IS NULL THEN
      SELECT id INTO v_resolved_source_id
      FROM public.boxing_fun_challenge_attempts
      WHERE user_id = v_uid AND status = 'completed'
        AND created_at > now() - INTERVAL '5 minutes'
      ORDER BY created_at DESC LIMIT 1;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.boxing_fun_challenge_attempts
      WHERE id = v_resolved_source_id AND user_id = v_uid AND status = 'completed'
    ) INTO v_source_valid;
    v_raid_type := 'challenge_clear';

  ELSIF p_source_type = 'champion_journal_entry' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.champion_journal_entries
      WHERE id = v_resolved_source_id AND user_id = v_uid
    ) INTO v_source_valid;
    v_raid_type := 'journal_write';

  ELSIF p_source_type = 'boxing_cheer' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.boxing_cheers
      WHERE id = v_resolved_source_id AND sender_user_id = v_uid
    ) INTO v_source_valid;
    v_raid_type := 'cheer_sent';

  ELSE
    RAISE EXCEPTION 'gym raid invalid source';
  END IF;

  IF NOT v_source_valid OR v_resolved_source_id IS NULL THEN
    -- silent return (사용자 흐름 막지 않음 — §21 요구사항)
    RETURN jsonb_build_object(
      'success', true,
      'contributed', false,
      'reason', 'no recent source'
    );
  END IF;

  PERFORM public.boxing_gym_raid_lazy_expire();

  -- 회원의 branch + 매칭되는 active raid 찾기
  -- ⚠️ auth.uid() 는 profiles.user_id 와 일치한다 (예전엔 id 로 봐서 항상 NULL)
  SELECT branch_name INTO v_my_branch FROM public.profiles WHERE user_id = v_uid;
  IF v_my_branch IS NULL THEN
    RETURN jsonb_build_object('success', true, 'contributed', false, 'reason', 'no branch');
  END IF;

  FOR v_raid IN
    SELECT * FROM public.boxing_gym_raids
    WHERE branch_name = v_my_branch
      AND status = 'active'
      AND raid_type = v_raid_type
      AND start_date <= (now() AT TIME ZONE 'Asia/Seoul')::date
      AND end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date
  LOOP
    -- contribution insert (UNIQUE 충돌 시 무시)
    INSERT INTO public.boxing_gym_raid_contributions (
      raid_id, user_id, contribution_value, contribution_type,
      source_type, source_id, metadata
    ) VALUES (
      v_raid.id, v_uid, v_value, v_raid_type,
      p_source_type, v_resolved_source_id,
      jsonb_build_object('auto', true)
    )
    ON CONFLICT (raid_id, user_id, source_type, source_id) DO NOTHING;

    IF FOUND THEN
      -- raid current_value 업데이트
      UPDATE public.boxing_gym_raids
      SET current_value = current_value + v_value
      WHERE id = v_raid.id;
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  -- lazy completed 전환
  PERFORM public.boxing_gym_raid_lazy_expire();

  RETURN jsonb_build_object(
    'success', true,
    'contributed', v_inserted_count > 0,
    'raids_contributed', v_inserted_count
  );
END;
$function$;
