-- 리그별 승급 요건 차등 — 뒤로 갈수록 무거워진다.
--
-- 지금까지 40레벨 전부가 '출석 3회'로 평평했다. 블랙 리그가 화이트와 같은 무게였다.
-- 태권도(1단→2단 1년 … 8단→9단 9년)·주짓수(파란띠 2년, 보라 1.5년, 갈 1년)처럼
-- 위로 갈수록 기간이 급격히 늘어나는 구조로 바꾼다.
--
--   화이트 (1~10)  출석 3회 /레벨   → 누적  27회   자동 승급
--   블루   (11~20) 출석 5회 /레벨   → 누적  72회   자동 승급
--   레드   (21~30) 출석 8회 /레벨   → 누적 144회   코치 승인 전용
--   블랙   (31~40) 출석 20회/레벨   → 누적 324회   코치 승인 전용 + 레벨당 최소 45일 체류
--                                                  + 레벨 40은 관장만 승인 (다음 마이그레이션)
--
-- 블랙은 권위의 상징이다. 출석을 몰아쳐도 시간이 걸리도록 '연한'(최소 체류 45일)을 둔다.
-- 브로제이 출석 데이터(월 평균 5.6회) 기준 도달 시점:
--   레벨 10  5개월 / 레벨 20  1년 1개월 / 레벨 30  2년 2개월 / 레벨 40  4년 10개월

-- ── 1) 리그별 요건 (단일 출처) ─────────────────────────────────────────
create or replace function public.level_visit_requirement(_rank rank_name)
returns int language sql immutable set search_path = public as $$
  select case _rank::text
    when 'white' then 3
    when 'blue'  then 5
    when 'red'   then 8
    when 'black' then 20
    else 3 end;
$$;

comment on function public.level_visit_requirement(rank_name) is
  '리그별 레벨업에 필요한 출석 횟수 (하루 1회 인정). 화이트3/블루5/레드8/블랙20';

create or replace function public.level_min_days(_rank rank_name)
returns int language sql immutable set search_path = public as $$
  select case _rank::text when 'black' then 45 else 0 end;
$$;

comment on function public.level_min_days(rank_name) is
  '리그별 레벨당 최소 체류 일수(연한). 블랙만 45일 — 출석을 몰아쳐도 건너뛸 수 없다';

-- ── 2) 진행도 조회 — 앱이 이 값을 그대로 표시한다 ──────────────────────
create or replace function public.get_level_cycle_progress(_user_id uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _since timestamptz; _sessions int := 0; _days int := 0; _minutes int := 0;
  _rank rank_name; _req int; _min_days int; _elapsed int;
begin
  if _user_id is null then raise exception 'no user'; end if;
  if _user_id <> auth.uid()
     and not (has_role(auth.uid(),'super_admin') or is_branch_manager_of(auth.uid(),_user_id) or is_coach_of(auth.uid(),_user_id)) then
    raise exception 'Not authorized';
  end if;

  select level_started_at, current_rank into _since, _rank from member_progress where user_id = _user_id;
  if _since is null then _since := now() - interval '3650 days'; end if;
  if _rank is null then _rank := 'white'::rank_name; end if;

  _req      := level_visit_requirement(_rank);
  _min_days := level_min_days(_rank);
  _elapsed  := greatest(0, floor(extract(epoch from (now() - _since)) / 86400))::int;

  -- 얼굴 인식(브로제이) 출석이 곧 정식 출석이다. 하루 1회(is_duplicate=false).
  select count(*), count(distinct ((checked_in_at at time zone 'Asia/Seoul')::date))
    into _sessions, _days
    from attendance_logs
    where user_id = _user_id and coalesce(is_duplicate,false) = false
      and checked_in_at >= _since;

  -- 훈련 분수는 참고용 (얼굴 인식은 퇴장 시각이 없다)
  select coalesce(sum(greatest(0, floor(extract(epoch from (coalesce(ended_at, now()) - started_at))/60)))::int, 0)
    into _minutes
    from activity_sessions
    where user_id = _user_id and started_at >= _since and status in ('completed','auto_ended');

  return jsonb_build_object(
    'sessions', _sessions, 'days', _days, 'minutes', _minutes,
    'reqSessions', _req, 'reqDays', _req, 'reqMinutes', 0,
    'reqMinDays', _min_days, 'elapsedDays', _elapsed, 'rank', _rank::text,
    'meets', (_sessions >= _req and _elapsed >= _min_days),
    'since', _since);
end; $$;

-- ── 3) 자동 승급 — 리그별 요건 적용 ────────────────────────────────────
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
  _auto_ranks constant text[] := array['white','blue'];
begin
  if _user_id is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  perform pg_advisory_xact_lock(hashtext('auto_advance:' || _user_id::text));

  loop
    _guard := _guard + 1; exit when _guard > 12;

    select * into _p from member_progress where user_id = _user_id;
    if not found then exit; end if;

    _req      := level_visit_requirement(_p.current_rank);
    _min_days := level_min_days(_p.current_rank);
    _elapsed  := greatest(0, floor(extract(epoch from
                   (now() - coalesce(_p.level_started_at, now() - interval '3650 days'))) / 86400))::int;

    select count(*) into _visits
    from attendance_logs
    where user_id = _user_id
      and coalesce(is_duplicate, false) = false
      and checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');

    -- ── 레드·블랙: 승인 전용 (출석을 채워도 코치가 봐야 올라간다) ──────
    if not (_p.current_rank::text = any(_auto_ranks)) then
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
        set current_level = _p.current_level + 1, level_started_at = now(), updated_at = now()
        where user_id = _user_id;

      insert into xp_logs (user_id, amount, reason) values (_user_id, 50, '레벨업 보상 (출석 자동 승급)');
      update member_progress set total_xp = total_xp + 50 where user_id = _user_id;
      perform grant_gems(_user_id, 10, '레벨업 보상 (출석 자동 승급)');
      perform create_notification(_user_id, '레벨 '||(_p.current_level+1)||' 달성! 🥊',
        '출석 '||_req||'회를 채워 자동으로 승급했어요. XP +50, 💎 +10');

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
        '보스 레벨 출석을 다 채웠어요. 코치님 승인만 남았습니다!');
      _pending_boss := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'promoted', _promoted, 'pending_boss', _pending_boss);
end; $function$;
