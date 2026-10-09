-- ─────────────────────────────────────────────────────────────────────────────
-- 챔피언 머니 경제 개편 (2026-10-09)
--
-- 문제: 적립(레벨업 +10, 출석체크 +2)이 가격표(200~320,000)에 비해 사실상 0이라
--       구매가 한 번도 일어나지 않았다 (user_owned_customizations 0행,
--       지갑 3,103/3,375 명이 잔액 0).
--
-- 개편 내용:
--   1. 체육관 출석(도어 체크인)  : 챔피언 머니 +100 / 1일 1회 (KST 기준)
--   2. 앱 출석 체크             : +2  → +20
--   3. 자동 레벨업 (화이트·블루) : +10 → +500
--   4. 승인 레벨업·타이틀매치    : +10 → +1,000
--   5. customization_prices 에 'boxer' 카테고리 시딩 (서버 가격표 단일 진실)
--   6. is_hof_required_item 에 'boxer' HoF 한정판 추가
--   7. 1회성 소급 지급: 출석일수×100 + 완료 레벨×500 ('챔피언 머니 전환 보너스')
--
-- UI 표기는 "파이트 머니" → "챔피언 머니" 로 앱 코드에서 함께 변경한다.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1·2) 앱 출석 체크: +2 → +20 ------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM xp_logs
    WHERE user_id = _user_id AND reason = '출석 체크'
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN
    RETURN;
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_user_id, 10, '출석 체크');

  UPDATE member_progress
  SET total_xp = total_xp + 10, streak_days = streak_days + 1
  WHERE user_id = _user_id;

  -- 챔피언 머니 +20 (기존 +2)
  PERFORM grant_gems(_user_id, 20, '출석 체크 보상');
END;
$function$;

-- 1) 체육관 출석(도어): 챔피언 머니 +100 / KST 1일 1회 + is_duplicate 가드 ----
CREATE OR REPLACE FUNCTION public.attendance_base_xp_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  _base  int;
  _staff boolean;
begin
  if new.user_id is null then return null; end if;
  if new.checked_in_at is null or new.checked_in_at < now() - interval '3 days' then return null; end if;
  -- 중복 출석(짧은 간격 재태깅)은 보상 대상이 아니다
  if coalesce(new.is_duplicate, false) then return null; end if;

  select coalesce(is_staff, false) into _staff from public.profiles where user_id = new.user_id;
  if coalesce(_staff, false) then return null; end if;
  if not exists (select 1 from public.member_progress where user_id = new.user_id) then return null; end if;

  -- ── 챔피언 머니 +100: KST 기준 하루 1회 (XP 와 별개로 지급) ──────────────
  if not exists (
    select 1 from public.wallet_transactions
     where user_id = new.user_id
       and reason = '체육관 출석 보상'
       and (created_at at time zone 'Asia/Seoul')::date
           = (new.checked_in_at at time zone 'Asia/Seoul')::date
  ) then
    perform public.grant_gems(new.user_id, 100, '체육관 출석 보상');
  end if;

  -- ── 기본 운동 XP (기존 로직 그대로: 행당 1회, xp_granted 가드) ──────────
  if coalesce(new.xp_granted, 0) > 0 then return null; end if;

  _base := public.workout_xp(public.workout_default_minutes());
  if _base <= 0 then return null; end if;

  insert into public.xp_logs (user_id, amount, reason)
  values (new.user_id, _base, '운동 출석 (기본 ' || public.workout_default_minutes() || '분)');
  update public.member_progress set total_xp = total_xp + _base where user_id = new.user_id;
  update public.attendance_logs set xp_granted = _base where id = new.id;
  return null;
end;
$function$;

-- 3) 자동 레벨업 (화이트·블루): +10 → +500 ------------------------------------
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
        set current_level = _p.current_level + 1, level_started_at = _started_at, updated_at = now()
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

-- 4) 승인 레벨업·타이틀매치: +10 → +1,000 -------------------------------------
CREATE OR REPLACE FUNCTION public.approve_level_review(_member_id uuid, _approve boolean DEFAULT true, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _caller uuid := auth.uid(); _caller_name text; _p record;
  _rank_order text[] := array['white','blue','red','black']; _idx int; _next_rank rank_name;
  _new_level int; _new_rank rank_name; _ranked_up boolean := false; _ls_id uuid; _old level_status_type;
  _checked jsonb; _need_cnt int; _done_cnt int; _global_lv int; _need text; _fast boolean := false;
begin
  -- 담당 관계 — 이 회원을 볼 수 있는 사람인가
  if not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id) or is_coach_of(_caller,_member_id)) then
    raise exception 'Not authorized';
  end if;
  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  _idx := array_position(_rank_order, _p.current_rank::text);
  _global_lv := (coalesce(_idx,1) - 1) * 10 + _p.current_level;
  _need := public.level_gate_authority(_p.current_rank, _p.current_level);

  -- ── 관문별 승인 권한 게이트 ──────────────────────────────────────────
  if _approve and not public.can_clear_level_gate(_caller, _member_id, _p.current_rank, _p.current_level) then
    raise exception '%',
      case
        when _need = 'owner' and _p.current_level = 10 then
          '레벨 ' || _global_lv || ' 타이틀매치는 관장님만 승인할 수 있습니다'
        when _need = 'owner' then
          '블랙 리그 승급은 관장님만 승인할 수 있습니다'
        when _need = 'manager' and _p.current_level = 10 then
          '레벨 ' || _global_lv || ' 타이틀매치는 지점장·관장만 승인할 수 있습니다'
        else
          '블랙 리그 승급은 지점장·관장만 승인할 수 있습니다'
      end;
  end if;

  select nickname into _caller_name from profiles where user_id = _caller;
  select status, id, coalesce(checked_items,'{}'::jsonb)
    into _old, _ls_id, _checked
    from level_status
   where user_id=_member_id and rank_name=_p.current_rank and level_number=_p.current_level;
  _checked := coalesce(_checked, '{}'::jsonb);

  -- ── 보완 요청 — 체크는 건드리지 않는다 (통과시킨 항목은 그대로 남는다) ──
  if not _approve then
    insert into level_status (user_id, rank_name, level_number, status, approved_by, approval_note)
    values (_member_id, _p.current_rank, _p.current_level, 'revision_requested', _caller, _note)
    on conflict (user_id, rank_name, level_number)
    do update set status='revision_requested', approved_by=_caller, approval_note=_note, updated_at=now()
    returning id into _ls_id;
    insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
    values (_ls_id, _member_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'revision_requested', _caller, _note);
    perform create_notification(_member_id, coalesce(_caller_name,'코치')||'님이 레벨업 보완을 요청했습니다', coalesce(_note,''));
    return jsonb_build_object('approved', false, 'status','revision_requested');
  end if;

  -- ── 타이틀매치(L10): 심사 항목을 전부 통과해야 한다 ─────────────────────
  if _p.current_level = 10 then
    select count(*) into _need_cnt
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true and m.category <> 'warmup';

    if _need_cnt = 0 then
      raise exception '레벨 % 타이틀매치에 심사 항목이 없습니다 — 레벨 미션을 먼저 등록해야 승급을 승인할 수 있습니다', _global_lv;
    end if;

    select count(*) into _done_cnt
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true and m.category <> 'warmup'
       and coalesce((_checked -> m.id::text ->> 'passed')::boolean, false);

    if _done_cnt < _need_cnt then
      raise exception '심사 항목 %개 중 %개만 통과했습니다 — 전부 확인해야 승급됩니다', _need_cnt, _done_cnt;
    end if;
  end if;

  insert into level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
  values (_member_id, _p.current_rank, _p.current_level,
          case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end, now(), _caller, _note)
  on conflict (user_id, rank_name, level_number)
  do update set status = case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end,
                completed_at=now(), approved_by=_caller, approval_note=_note, updated_at=now()
  returning id into _ls_id;
  insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
  values (_ls_id, _member_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'),
          case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end, _caller,
          coalesce(_note, case when _p.current_level=10
            then '레벨 '||_global_lv||' 타이틀매치 승인 (심사 항목 '||coalesce(_need_cnt,0)||'개 전부 통과)'
            else '레벨업 승인' end));

  if _p.current_level < 10 then
    _new_level := _p.current_level + 1; _new_rank := _p.current_rank;
    update member_progress set current_level=_new_level, level_started_at=now(), updated_at=now() where user_id=_member_id;
  else
    if _idx is null or _idx >= 4 then
      -- 블랙 타이틀매치 — 다음 리그가 없다
      _new_level := 10; _new_rank := _p.current_rank;
      update member_progress set bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
    else
      _next_rank := _rank_order[_idx+1]::rank_name; _ranked_up := true; _new_rank := _next_rank;

      if coalesce(_p.fast_track_gates,0) > 0 then
        -- ── 패스트 트랙: 다음 리그의 타이틀매치로 직행, 직행권 1장 사용 ──
        _fast := true; _new_level := 10;
        update member_progress
           set current_rank = _next_rank, current_level = 10,
               bosses_cleared = bosses_cleared + 1,
               fast_track_gates = greatest(0, coalesce(fast_track_gates,0) - 1),
               level_started_at = now(), updated_at = now()
         where user_id = _member_id;

        -- 다음 관문 심사를 바로 연다 (출석 요건을 다시 채우게 하지 않는다)
        insert into level_status (user_id, rank_name, level_number, status, approval_note)
        values (_member_id, _next_rank, 10, 'pending', '패스트 트랙 — 다음 타이틀매치 도전')
        on conflict (user_id, rank_name, level_number)
        do update set status = 'pending',
                      approval_note = '패스트 트랙 — 다음 타이틀매치 도전',
                      updated_at = now();
      else
        _new_level := 1;
        update member_progress set current_rank=_next_rank, current_level=1, bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
        insert into level_status (user_id, rank_name, level_number, status)
        values (_member_id, _next_rank, 1, 'in_progress')
        on conflict (user_id, rank_name, level_number) do update set status='in_progress';
      end if;
    end if;
  end if;

  insert into xp_logs (user_id, amount, reason) values (_member_id, 50, '레벨업 승인 보상');
  update member_progress set total_xp = total_xp + 50 where user_id=_member_id;
  perform grant_gems(_member_id, 1000, '레벨업 승인 보상');
  perform create_notification(_member_id, coalesce(_caller_name,'코치')||'님이 레벨업을 승인했습니다! 🎉',
    case when _fast then '다음 타이틀매치가 바로 열렸습니다! XP +50, 챔피언 머니 +1,000'
         when _ranked_up then '다음 리그로 승급! XP +50, 챔피언 머니 +1,000'
         else '레벨 '||_new_level||' 달성! XP +50, 챔피언 머니 +1,000' end);
  return jsonb_build_object('approved', true, 'ranked_up', _ranked_up, 'fast_track', _fast,
                            'new_rank', _new_rank::text, 'new_level', _new_level);
end; $function$;

-- 5) 서버 가격표에 'boxer' 카테고리 시딩 --------------------------------------
-- 캐릭터 스튜디오의 복서 구매가 localStorage 가 아니라
-- purchase_customization RPC(서버 영속)를 타도록 가격표를 등록한다.
INSERT INTO public.customization_prices (category, item_key, price) VALUES
  ('boxer','female_02',200),
  ('boxer','male_03',250),
  ('boxer','female_03',300),
  ('boxer','male_04',350),
  ('boxer','female_04',400),
  ('boxer','male_05',450),
  ('boxer','female_05',450),
  ('boxer','male_06',500),
  ('boxer','female_06',500),
  ('boxer','female_pink_01',800),
  ('boxer','female_pink_02',900),
  ('boxer','male_blue_01',1000),
  ('boxer','male_blue_02',1100),
  ('boxer','male_blue_03',1200),
  ('boxer','male_gold_01',1500),
  ('boxer','male_gold_02',2000),
  ('boxer','kpop_02',2000),
  ('boxer','kpop_03',2500),
  ('boxer','master_male_01',3000),
  ('boxer','master_male_02',4000),
  ('boxer','female_master_01',5000),
  ('boxer','female_master_02',6000),
  ('boxer','nika_male_03',7000),
  ('boxer','female_gm_01',8000),
  ('boxer','female_gm_02',8000),
  ('boxer','female_gm_03',10000),
  ('boxer','new_13',180000),
  ('boxer','new_16',190000),
  ('boxer','new_17',190000),
  ('boxer','new_14',200000),
  ('boxer','new_01',200000),
  ('boxer','new_18',210000),
  ('boxer','new_05',210000),
  ('boxer','new_02',220000),
  ('boxer','new_07',230000),
  ('boxer','new_03',240000),
  ('boxer','new_04',250000),
  ('boxer','new_06',260000),
  ('boxer','new_08',270000),
  ('boxer','new_10',270000),
  ('boxer','new_09',280000),
  ('boxer','new_11',290000),
  ('boxer','new_12',320000)
ON CONFLICT (category, item_key) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

-- 6) 'boxer' HoF 한정판 서버 게이트 -------------------------------------------
CREATE OR REPLACE FUNCTION public.is_hof_required_item(_category text, _item_key text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _category
    WHEN 'title' THEN _item_key IN ('eternal_153', 'king_of_ring', 'god_fist')
    WHEN 'aura'  THEN _item_key IN ('halo_rainbow_master', 'divine', 'aura_celestial')
    WHEN 'boxer' THEN _item_key IN (
      'new_01','new_02','new_03','new_04','new_05','new_06','new_07','new_08',
      'new_09','new_10','new_11','new_12','new_13','new_14','new_16','new_17','new_18'
    )
    ELSE false
  END;
$function$;

-- 7) 1회성 소급 지급: 챔피언 머니 전환 보너스 ----------------------------------
-- 지금까지의 체육관 출석일수 × 100 + 완료한 레벨 × 500.
-- reason '챔피언 머니 전환 보너스' 가 이미 있으면 다시 지급하지 않는다 (재실행 안전).
DO $$
declare
  _rank_order text[] := array['white','blue','red','black'];
  _m record;
  _days int; _levels_done int; _amount int;
begin
  for _m in
    select mp.user_id, mp.current_rank, mp.current_level
      from member_progress mp
      join profiles pr on pr.user_id = mp.user_id
     where coalesce(pr.is_staff, false) = false
       and not exists (
         select 1 from wallet_transactions wt
          where wt.user_id = mp.user_id
            and wt.reason = '챔피언 머니 전환 보너스'
       )
  loop
    select count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)
      into _days
      from attendance_logs a
     where a.user_id = _m.user_id
       and coalesce(a.is_duplicate, false) = false;

    _levels_done := greatest(0,
      (coalesce(array_position(_rank_order, _m.current_rank::text), 1) - 1) * 10
      + coalesce(_m.current_level, 1) - 1);

    _amount := coalesce(_days, 0) * 100 + _levels_done * 500;

    if _amount > 0 then
      perform public.grant_gems(_m.user_id, _amount, '챔피언 머니 전환 보너스');
    end if;
  end loop;
end $$;
