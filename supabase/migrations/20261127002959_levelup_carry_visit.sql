-- ✅ 출석 자동 승급 — 승급시킨 출석을 다음 레벨 첫 출석으로 (2026-11-27 대표님 「배경민 회원님 … 17레벨 언제되?」 → 원인 보고 → 「응 그렇게 고치재」)
--   승급 검사(auto_advance_from_attendance)는 새 출석이 들어올 때만 돈다(브로제이 동기화 · QR · 얼굴 키오스크). 오래 운동한 출석(최대 1.25회)은
--   운동이 끝나야 진행도가 오르니, 요건은 4번째 운동이 끝날 때 채워도 승급은 다음 출석 때 됐고 — 예전엔 레벨 시작을 그 검사 시각(그 출석 뒤)으로
--   적어 승급을 부른 그 출석이 새 레벨에서도 빠졌다(11/24 운동 끝에 블루 5 요건 5.0 → 11/25 출석 때 승급 → 11/25 출석은 블루 6 에도 안 셈).
--   이제: 이번 레벨 출석을 시간순으로 쌓아 요건을 이미 채운 뒤의 출석(보통 승급을 부른 오늘 출석)부터 새 레벨 — 꼭 필요한 출석이었으면 예전처럼 지금부터.
--   그래서 2시간 넘게 운동하는 회원은 블루 레벨당 4번(1.25 × 4 = 5)이면 된다(journeyMath 예상과 같아짐). 승급 순간은 그대로 출석할 때(사이니지 그대로).
--   · 한 번 부를 때 한 레벨만(예전에도 레벨 시작이 지금이라 사실상 한 번) — 넘긴 출석이 많아도 출석마다 한 레벨씩.
--   · 운영 DB 의 지금 정의(저장소 마지막 정의 20261009150000_champion_money_economy.sql 과 지문 같음 확인) 위에 두 곳만.
--   · 화면: 오늘 레벨이 오른 날 이번 레벨 출석이 1(오늘)일 수 있다 — lib/levelQuest.ts leveledUpToday · questStamps.

CREATE OR REPLACE FUNCTION public.auto_advance_from_attendance(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _p record; _visits int; _promoted int := 0; _pending_boss boolean := false;
  _old level_status_type; _ls_id uuid; _guard int := 0;
  _req int; _min_days int; _elapsed int;
  -- 승급 시각: 같은 트랜잭션에서 방금 넣은 출석 행(checked_in_at = now())이
  -- 다음 레벨의 ">= level_started_at" 집계에 다시 들어가지 않도록 now() 보다 뒤로 잡는다.
  _started_at timestamptz := greatest(clock_timestamp(), now() + interval '1 microsecond');
begin
  if _user_id is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  perform pg_advisory_xact_lock(hashtext('auto_advance:' || _user_id::text));

  loop
    _guard := _guard + 1; exit when _guard > 12;
    -- (2026-11-27) 한 번 부를 때 한 레벨만 — 넘긴 출석으로 또 채우면 다음 출석 때 올라간다(사이니지 레벨업도 출석마다 하나씩)
    exit when _promoted > 0;

    select * into _p from member_progress where user_id = _user_id;
    if not found then exit; end if;

    _req      := level_visit_requirement(_p.current_rank);
    _min_days := level_min_days(_p.current_rank);
    _elapsed  := greatest(0, floor(extract(epoch from
                   (now() - coalesce(_p.level_started_at, now() - interval '3650 days'))) / 86400))::int;

    -- 출석 "횟수" 가 아니라 "진행량" 을 센다.
    -- 운동시간이 길면 한 번이 최대 1.25회로 쌓인다(workout_progress).
    -- floor 를 쓰는 이유: 요건을 실제로 다 채워야 열린다. 4.75 는 5회가 아니다.
    select floor(coalesce(sum(
             public.workout_progress(
               public.workout_minutes(a.checked_in_at, a.ended_at))), 0))::int
      into _visits
    from attendance_logs a
    where a.user_id = _user_id
      and coalesce(a.is_duplicate, false) = false
      and a.checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');

    -- ── 레드·블랙: 승인 전용 (출석을 채워도 코치가 봐야 올라간다) ──────
    if not public.level_auto_advances(_p.current_rank) then
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=_p.current_level;
      if _old in ('pending','approved','boss_cleared') then exit; end if;

      exit when _visits < _req or _elapsed < _min_days;

      insert into level_status (user_id, rank_name, level_number, status, approval_note)
      values (_user_id, _p.current_rank, _p.current_level, 'pending',
              '출석 '||_req||'회 충족 — 코치 승인 대기 (레드·블랙은 승인 전용)')
      on conflict (user_id, rank_name, level_number)
      do update set status='pending',
                    approval_note='출석 '||_req||'회 충족 — 코치 승인 대기 (레드·블랙은 승인 전용)',
                    updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'pending', _user_id,
              '출석 '||_req||'회 충족 — 승인 전용 리그 심사 신청');

      perform create_notification(_user_id, '승급 심사 대기 중 🥇',
        '출석은 다 채웠어요! 이 리그부터는 코치님이 직접 보고 승급합니다.');
      _pending_boss := true;
      exit;
    end if;

    -- ── 화이트·블루: 출석 충족 시 자동 승급 ───────────────────────────
    if _p.current_level < 10 then
      exit when _visits < _req;

      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=_p.current_level;

      insert into level_status (user_id, rank_name, level_number, status, completed_at, approval_note)
      values (_user_id, _p.current_rank, _p.current_level, 'approved', now(), '출석 '||_req||'회 자동 승급')
      on conflict (user_id, rank_name, level_number)
      do update set status='approved', completed_at=now(), approval_note='출석 '||_req||'회 자동 승급', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'approved', _user_id, '출석 '||_req||'회 자동 승급');

      update member_progress
        set current_level = _p.current_level + 1, level_started_at = coalesce((
          -- (2026-11-27 대표님 「응 그렇게 고치재」) 승급시킨 출석을 다음 레벨 첫 출석으로 — 이번 레벨 출석을 시간순으로 쌓아
          -- 요건(_req)을 이미 채운 뒤의 출석(보통 승급을 부른 오늘 출석)부터 다음 레벨. 꼭 필요한 출석이었으면 예전처럼 지금부터.
          select min(c.checked_in_at)
            from (select a.checked_in_at,
                         coalesce(sum(public.workout_progress(public.workout_minutes(a.checked_in_at, a.ended_at)))
                           over (order by a.checked_in_at, a.id rows between unbounded preceding and 1 preceding), 0) as before_sum
                    from attendance_logs a
                   where a.user_id = _user_id
                     and coalesce(a.is_duplicate, false) = false
                     and a.checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days')) c
           where floor(c.before_sum) >= _req), _started_at), updated_at = now()
        where user_id = _user_id;

      insert into xp_logs (user_id, amount, reason) values (_user_id, 50, '레벨업 보상 (출석 자동 승급)');
      update member_progress set total_xp = total_xp + 50 where user_id = _user_id;
      perform grant_gems(_user_id, 500, '레벨업 보상 (출석 자동 승급)');
      perform create_notification(_user_id, '레벨 '||(_p.current_level+1)||' 달성! 🥊',
        '출석 '||_req||'회를 채워 자동으로 승급했어요. XP +50, 챔피언 머니 +500');

      _promoted := _promoted + 1;

      -- 방금 10레벨(타이틀매치)에 도달했다면 즉시 승급 심사를 연다.
      if _p.current_level + 1 = 10 then
        insert into level_status (user_id, rank_name, level_number, status, approval_note)
        values (_user_id, _p.current_rank, 10, 'pending', '10레벨 도달 — 승급 심사 자동 신청')
        on conflict (user_id, rank_name, level_number)
        do update set status='pending', approval_note='10레벨 도달 — 승급 심사 자동 신청', updated_at=now()
        returning id into _ls_id;

        insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
        values (_ls_id, _user_id, _p.current_rank, 10, 'locked', 'pending', _user_id, '10레벨 도달 자동 심사 신청');

        perform create_notification(_user_id, '승급 심사 대기 중 🥇',
          '타이틀매치에 도달했어요! 코치님이 승인하면 다음 리그로 갑니다.');
        _pending_boss := true;
        exit;
      end if;
    else
      -- 이미 10레벨: 심사가 걸려 있지 않다면 출석 충족 후 자동 신청
      select status, id into _old, _ls_id from level_status
        where user_id=_user_id and rank_name=_p.current_rank and level_number=10;
      if _old in ('pending','approved','boss_cleared') then exit; end if;

      exit when _visits < _req;

      insert into level_status (user_id, rank_name, level_number, status, approval_note)
      values (_user_id, _p.current_rank, 10, 'pending', '출석 '||_req||'회 충족 — 자동 심사 신청')
      on conflict (user_id, rank_name, level_number)
      do update set status='pending', approval_note='출석 '||_req||'회 충족 — 자동 심사 신청', updated_at=now()
      returning id into _ls_id;

      insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
      values (_ls_id, _user_id, _p.current_rank, 10, coalesce(_old,'locked'), 'pending', _user_id, '출석 '||_req||'회 자동 심사 신청');

      perform create_notification(_user_id, '승급 심사 대기 중 🥇',
        '타이틀매치 출석을 다 채웠어요. 코치님 승인만 남았습니다!');
      _pending_boss := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'promoted', _promoted, 'pending_boss', _pending_boss);
end; $function$;

