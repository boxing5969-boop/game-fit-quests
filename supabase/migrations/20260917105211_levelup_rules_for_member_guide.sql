-- 회원 가이드에 승급 기준을 띄우기 위한 정본 조회 함수 (2026-09-17)
--
-- 가이드 화면에 숫자를 하드코딩하면 서버 기준이 바뀔 때 또 어긋난다.
-- (이 앱에서 이미 "레벨당 3회"가 세 군데에 박혀 블루 회원에게 틀린 숫자를
--  보여주던 문제가 있었다.) 그래서 화면은 이 함수가 주는 값만 쓴다.

-- 자동 승급 리그 — auto_advance_from_attendance 와 가이드가 같은 정의를 쓴다
create or replace function public.level_auto_advances(_rank rank_name)
returns boolean language sql immutable set search_path to 'public' as $fn$
  select _rank::text in ('white','blue');
$fn$;

revoke execute on function public.level_auto_advances(rank_name) from public;
grant execute on function public.level_auto_advances(rank_name) to authenticated;

create or replace function public.get_levelup_rules()
returns jsonb language sql stable security definer set search_path to 'public' as $fn$
  select jsonb_agg(jsonb_build_object(
           'rank',            r,
           'firstLevel',      (idx - 1) * 10 + 1,
           'lastLevel',       idx * 10,
           'visitsPerLevel',  public.level_visit_requirement(r::rank_name),
           'minDaysPerLevel', public.level_min_days(r::rank_name),
           'autoAdvance',     public.level_auto_advances(r::rank_name),
           'levelAuthority',  public.level_gate_authority(r::rank_name, 1),
           'titleAuthority',  public.level_gate_authority(r::rank_name, 10)
         ) order by idx)
    from unnest(array['white','blue','red','black']) with ordinality as t(r, idx);
$fn$;

revoke execute on function public.get_levelup_rules() from public;
grant execute on function public.get_levelup_rules() to authenticated;

-- auto_advance_from_attendance — 자동 승급 리그 판정을 헬퍼로 일원화한다.
-- 동작은 이전과 동일(화이트·블루 자동, 레드·블랙 승인 전용). 정의가 두 군데
-- 있던 것을 한 곳으로 모으는 변경이다.
create or replace function public.auto_advance_from_attendance(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _p record; _visits int; _promoted int := 0; _pending_boss boolean := false;
  _old level_status_type; _ls_id uuid; _guard int := 0;
  _req int; _min_days int; _elapsed int;
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
        set current_level = _p.current_level + 1, level_started_at = now(), updated_at = now()
        where user_id = _user_id;

      insert into xp_logs (user_id, amount, reason) values (_user_id, 50, '레벨업 보상 (출석 자동 승급)');
      update member_progress set total_xp = total_xp + 50 where user_id = _user_id;
      perform grant_gems(_user_id, 10, '레벨업 보상 (출석 자동 승급)');
      perform create_notification(_user_id, '레벨 '||(_p.current_level+1)||' 달성! 🥊',
        '출석 '||_req||'회를 채워 자동으로 승급했어요. XP +50, 💎 +10');

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
