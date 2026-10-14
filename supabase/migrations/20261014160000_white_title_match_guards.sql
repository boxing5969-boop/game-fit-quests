-- 🏆 화이트 타이틀매치 보완 (2026-10-14, 검수 지적 반영)
--   · 지점장이 자기 자신의 타이틀매치를 기록하지 못하게 (본인 심사 금지)
--   · 신청 → 취소 → 신청을 되풀이해도 지점장님 알림은 6시간에 한 번만
-- 두 함수를 통째로 다시 정의한다 (20261014150000_white_title_match_challenge.sql 의 같은 함수를 대체). 권한(grant)은 그대로 남는다.

create or replace function public.request_title_match_review()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _p record; _ls text; _retry timestamptz; _nick text; _branch text; _n int := 0; _r record; _body text; _notify boolean;
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  -- 같은 회원의 신청·취소·도전 기록이 동시에 들어와도 한 줄씩 (읽기 전에 잠근다)
  perform pg_advisory_xact_lock(hashtext('title_match:' || _uid::text));

  select * into _p from member_progress where user_id = _uid;
  if not found then raise exception '진행 정보가 없습니다'; end if;
  if coalesce(_p.current_level, 1) <> 10 then
    raise exception '레벨 10이 되면 타이틀매치를 신청할 수 있어요';
  end if;
  if not public.title_match_flow_enabled(_p.current_rank) then
    raise exception '이 리그 타이틀매치는 아직 앱 신청이 열리지 않았어요 — 코치님께 말씀해 주세요';
  end if;

  select status::text into _ls from level_status
   where user_id = _uid and rank_name = _p.current_rank and level_number = 10;
  if _ls = 'boss_cleared' then raise exception '이미 통과한 타이틀매치예요'; end if;

  if exists (select 1 from title_match_challenges
              where user_id = _uid and rank_name = _p.current_rank and status = 'requested') then
    raise exception '이미 심사를 신청했어요 — 지점장님이 심사 일정을 잡아 드려요';
  end if;

  _retry := public.title_match_retry_at_for(_uid, _p.current_rank);
  if _retry is not null then
    raise exception '%부터 다시 신청할 수 있어요 (도전 %번 마감)',
      to_char(_retry at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"'), public.title_match_max_attempts();
  end if;

  -- 신청 → 취소 → 신청을 되풀이해도 지점장님 알림은 6시간에 한 번만 (취소 기록이 있으면 이번엔 조용히)
  _notify := not exists (select 1 from title_match_challenges
                          where user_id = _uid and rank_name = _p.current_rank and status = 'cancelled'
                            and requested_at > now() - interval '6 hours');

  insert into title_match_challenges (user_id, rank_name, status, requested_by)
  values (_uid, _p.current_rank, 'requested', _uid);

  perform public.title_match_put_in_review(_uid, _p.current_rank, _uid, '회원 타이틀매치 심사 신청');

  -- 지점장님께 알림 — 그 지점에 지점장 계정이 없으면 관장님께
  select coalesce(nullif(btrim(nickname), ''), nullif(btrim(name), ''), '회원'), branch_name
    into _nick, _branch
    from profiles where user_id = _uid;
  _body := _nick || '님이 ' || public.title_match_rank_ko(_p.current_rank)
           || ' 타이틀매치 심사를 신청했어요. 심사함에서 영상을 찍어 결과를 올려 주세요.';

  if _notify then
    for _r in
      select distinct ur.user_id
        from user_roles ur join profiles mp on mp.user_id = ur.user_id
       where ur.role = 'branch_manager' and _branch is not null and mp.branch_name = _branch
    loop
      insert into notifications (user_id, title, body, link)
      values (_r.user_id, '🏆 타이틀매치 심사 신청', _body, '/manager?tab=level_review');
      _n := _n + 1;
    end loop;

    if _n = 0 then
      for _r in select distinct user_id from user_roles where role = 'super_admin' loop
        insert into notifications (user_id, title, body, link)
        values (_r.user_id, '🏆 타이틀매치 심사 신청', _body, '/manager?tab=level_review');
      end loop;
    end if;
  end if;

  return public.get_title_match_state(_uid);
end;
$$;

create or replace function public.record_title_match_attempt(
  _member_id uuid,
  _video_path text,
  _passed boolean,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _p record; _ls text; _ch public.title_match_challenges%rowtype; _no int; _max int := public.title_match_max_attempts();
  _retry timestamptz; _items jsonb; _res jsonb; _note2 text := nullif(btrim(coalesce(_note, '')), '');
  _rank_ko text; _link text;
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  if _passed is null then raise exception '합격·불합격을 골라 주세요'; end if;
  if _member_id is null then raise exception '회원을 골라 주세요'; end if;
  -- 지점장이 스스로 레벨 10 이어도 자기 타이틀매치는 다른 지점장·관장님이 본다
  if _member_id = _caller then raise exception '본인 타이틀매치는 다른 지점장·관장님이 심사해요'; end if;

  -- 두 분이 동시에 올려도 한 줄씩 — 회원 상태를 읽기 전에 잠근다 (먼저 합격하면 뒤 기록은 레벨 확인에서 멈춘다)
  perform pg_advisory_xact_lock(hashtext('title_match:' || _member_id::text));

  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;
  if coalesce(_p.current_level, 1) <> 10 then
    raise exception '레벨 10 회원만 타이틀매치 심사를 할 수 있습니다';
  end if;
  if not public.title_match_flow_enabled(_p.current_rank) then
    raise exception '이 리그 타이틀매치는 심사 항목 확인으로 진행합니다';
  end if;
  if not public.can_clear_level_gate(_caller, _member_id, _p.current_rank, 10) then
    raise exception '%', case public.level_gate_authority(_p.current_rank, 10)
      when 'owner'   then '이 타이틀매치는 관장님만 심사할 수 있습니다'
      when 'manager' then '이 타이틀매치는 지점장·관장만 심사할 수 있습니다'
      else '담당 회원만 심사할 수 있습니다' end;
  end if;

  select status::text into _ls from level_status
   where user_id = _member_id and rank_name = _p.current_rank and level_number = 10;
  if _ls = 'boss_cleared' then raise exception '이미 통과한 타이틀매치입니다'; end if;

  -- 영상: 이 회원 폴더에 실제로 올라간 파일이어야 한다
  if _video_path is null
     or _video_path !~ ('^' || _member_id::text || '/[A-Za-z0-9._-]{1,120}$') then
    raise exception '영상 경로가 올바르지 않습니다';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'title-match-videos' and name = _video_path) then
    raise exception '영상이 아직 올라가지 않았습니다 — 다시 올려 주세요';
  end if;

  select * into _ch from title_match_challenges
   where user_id = _member_id and rank_name = _p.current_rank and status = 'requested'
   limit 1
   for update;

  if _ch.id is null then
    -- 회원이 앱에서 신청하지 않았어도 지점장이 바로 심사를 시작할 수 있다 (7일 잠금은 그대로)
    _retry := public.title_match_retry_at_for(_member_id, _p.current_rank);
    if _retry is not null then
      raise exception '%부터 다시 도전할 수 있습니다 (도전 %번 마감)',
        to_char(_retry at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"'), _max;
    end if;
    insert into title_match_challenges (user_id, rank_name, status, requested_by)
    values (_member_id, _p.current_rank, 'requested', _caller)
    returning * into _ch;
    perform public.title_match_put_in_review(_member_id, _p.current_rank, _caller, '지점장 타이틀매치 심사 시작');
  end if;

  select coalesce(max(attempt_no), 0) + 1 into _no from title_match_attempts where challenge_id = _ch.id;
  if _no > _max then raise exception '도전 %번을 모두 썼습니다', _max; end if;

  insert into title_match_attempts (challenge_id, user_id, attempt_no, passed, video_path, note, recorded_by)
  values (_ch.id, _member_id, _no, _passed, _video_path, _note2, _caller);

  _rank_ko := public.title_match_rank_ko(_p.current_rank);
  _link := public.title_match_link(_p.current_rank);

  if _passed then
    -- 그 레벨 10 심사 항목을 모두 통과로 기록 (누가·언제·몇 번째 도전인지 남는다)
    select coalesce(jsonb_object_agg(m.id::text, jsonb_build_object(
             'passed', true, 'by', _caller, 'at', now(),
             'note', '타이틀매치 도전 ' || _no || '번째 합격 (영상 심사)')), '{}'::jsonb)
      into _items
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10
       and m.is_active = true and m.category <> 'warmup';

    insert into level_status (user_id, rank_name, level_number, status, checked_items)
    values (_member_id, _p.current_rank, 10, 'pending', _items)
    on conflict (user_id, rank_name, level_number)
    do update set checked_items = coalesce(level_status.checked_items, '{}'::jsonb) || _items,
                  updated_at = now();

    update title_match_challenges
       set status = 'passed', closed_at = now(), closed_by = _caller, updated_at = now()
     where id = _ch.id;

    -- 승급은 기존 승인 경로 하나로 (권한·항목 확인·보상·알림이 거기 있다)
    _res := public.approve_level_review(_member_id, true,
              coalesce(_note2, _rank_ko || ' 타이틀매치 합격 (도전 ' || _no || '/' || _max || ', 영상 심사)'));

    return jsonb_build_object('ok', true, 'result', 'passed', 'attemptNo', _no,
                              'maxAttempts', _max, 'promotion', _res);
  end if;

  if _no >= _max then
    update title_match_challenges
       set status = 'failed', closed_at = now(), closed_by = _caller, updated_at = now()
     where id = _ch.id;
    _retry := public.title_match_retry_at(now());

    insert into notifications (user_id, title, body, link)
    values (_member_id,
            '🏆 ' || _rank_ko || ' 타이틀매치 도전 ' || _no || '/' || _max || ' — 이번엔 아쉬워요',
            to_char(_retry at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"')
              || '부터 다시 신청할 수 있어요. 파트너와 더 연습해서 다시 도전해요!'
              || coalesce(' · 지점장님 한마디: ' || _note2, ''),
            _link);

    return jsonb_build_object('ok', true, 'result', 'failed_final', 'attemptNo', _no,
                              'maxAttempts', _max, 'retryAt', _retry);
  end if;

  insert into notifications (user_id, title, body, link)
  values (_member_id,
          '🏆 ' || _rank_ko || ' 타이틀매치 도전 ' || _no || '/' || _max || ' — 아쉽게 불합격',
          '남은 기회 ' || (_max - _no) || '번! 지점장님과 다시 도전해요.'
            || coalesce(' · 지점장님 한마디: ' || _note2, ''),
          _link);

  return jsonb_build_object('ok', true, 'result', 'failed', 'attemptNo', _no,
                            'maxAttempts', _max, 'attemptsLeft', _max - _no);
end;
$$;
