-- =========================================================================
-- 10레벨 도달 즉시 승급 심사 오픈 + 유효회원 과거 출석 일괄 배치 (2026-09-02)
--
-- 규칙 보정: 9레벨에서 출석 3회를 채워 10레벨(보스)에 도달하는 "순간"
--            승급 심사가 코치 승인함에 자동으로 올라간다.
--            (종전에는 10레벨에서 출석 3회를 또 채워야 심사가 열렸다)
--
-- 일괄 배치(코드가 아닌 1회성 데이터 작업, 2026-09-02 실행):
--   · 대상: 브로제이 유효 이용권 회원 중 앱 계정 보유자 (코치 제외) 232명
--   · 규칙: 레벨 = min(9, 1 + 총출석/3), 1년 이상 재적자는 무조건 9
--   · 보상 없음(재배치이므로), level_started_at 리셋 — 다음 3회부터 새 규칙
-- =========================================================================

CREATE OR REPLACE FUNCTION public.auto_advance_from_attendance(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _p record; _visits int; _promoted int := 0; _pending_boss boolean := false;
  _old level_status_type; _ls_id uuid; _guard int := 0;
begin
  if _user_id is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  perform pg_advisory_xact_lock(hashtext('auto_advance:' || _user_id::text));

  loop
    _guard := _guard + 1; exit when _guard > 12;

    select * into _p from member_progress where user_id = _user_id;
    if not found then exit; end if;

    if _p.current_level < 10 then
      select count(*) into _visits
      from attendance_logs
      where user_id = _user_id
        and coalesce(is_duplicate, false) = false
        and checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');

      exit when _visits < 3;

      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=_p.current_level;

      insert into level_status (user_id, rank_name, level_number, status, completed_at, approval_note)
      values (_user_id, _p.current_rank, _p.current_level, 'approved', now(), '출석 3회 자동 승급')
      on conflict (user_id, rank_name, level_number)
      do update set status='approved', completed_at=now(), approval_note='출석 3회 자동 승급', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'approved', _user_id, '출석 3회 자동 승급');

      update member_progress
        set current_level = _p.current_level + 1, level_started_at = now(), updated_at = now()
        where user_id = _user_id;

      insert into xp_logs (user_id, amount, reason) values (_user_id, 50, '레벨업 보상 (출석 자동 승급)');
      update member_progress set total_xp = total_xp + 50 where user_id = _user_id;
      perform grant_gems(_user_id, 10, '레벨업 보상 (출석 자동 승급)');
      perform create_notification(_user_id, '레벨 '||(_p.current_level+1)||' 달성! 🥊',
        '출석 3회를 채워 자동으로 승급했어요. XP +50, 💎 +10');

      _promoted := _promoted + 1;

      -- 방금 10레벨(보스)에 도달했다면 즉시 승급 심사를 연다 — 이게 "승급 시험"이다.
      if _p.current_level + 1 = 10 then
        insert into level_status (user_id, rank_name, level_number, status, approval_note)
        values (_user_id, _p.current_rank, 10, 'pending', '10레벨 도달 — 승급 심사 자동 신청')
        on conflict (user_id, rank_name, level_number)
        do update set status='pending', approval_note='10레벨 도달 — 승급 심사 자동 신청', updated_at=now()
        returning id into _ls_id;

        insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
        values (_ls_id, _user_id, _p.current_rank, 10, 'locked', 'pending', _user_id, '10레벨 도달 자동 심사 신청');

        perform create_notification(_user_id, '승급 심사 대기 중 🥇',
          '보스 레벨에 도달했어요! 코치님이 승인하면 다음 리그로 갑니다.');
        _pending_boss := true;
        exit;
      end if;
    else
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=10;
      if _old in ('pending','approved','boss_cleared') then exit; end if;

      select count(*) into _visits
      from attendance_logs
      where user_id = _user_id
        and coalesce(is_duplicate, false) = false
        and checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');
      exit when _visits < 3;

      insert into level_status (user_id, rank_name, level_number, status, approval_note)
      values (_user_id, _p.current_rank, 10, 'pending', '출석 3회 충족 — 자동 심사 신청')
      on conflict (user_id, rank_name, level_number)
      do update set status='pending', approval_note='출석 3회 충족 — 자동 심사 신청', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, 10, coalesce(_old,'locked'), 'pending', _user_id, '출석 3회 자동 심사 신청');

      perform create_notification(_user_id, '승급 심사 대기 중 🥇',
        '보스 레벨 출석을 다 채웠어요. 코치님 승인만 남았습니다!');
      _pending_boss := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'promoted', _promoted, 'pending_boss', _pending_boss);
end; $function$;
