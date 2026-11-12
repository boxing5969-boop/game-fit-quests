-- 타이틀매치 심사 영상 2개 — 치는 영상 · 받는 영상 (2026-11-12 대표님 「영상도 2개 올려야해 치는거 받는거」)
--
--   · title_match_attempts.receive_video_path (새 칸 · 비어 있어도 됨) = 받는 영상(파트너에게 미트 3번 받아주기).
--     video_path 는 치는 영상(완벽한 자세로 3번 연속). 이 날 전 기록은 video_path 하나에 치기 · 받기가 함께 찍혀 있다.
--   · record_title_match_attempt_v2(_member_id, _hit_video_path, _receive_video_path, _passed, _note) — 새 함수
--       치는 영상은 늘 · 받는 영상은 합격일 때 꼭 (불합격은 치는 영상만으로도 기록 — 3번 연속이 안 되면 받기까지 못 간다).
--       두 영상 모두 이 회원 폴더에 실제로 올라간 파일이어야 하고 서로 달라야 한다.
--       그 밖(잠금 · 권한 · 신청 자동 시작 · 3번 마감 · 승급 · 알림)은 v1 본문 그대로다.
--   · record_title_match_attempt(v1, 영상 1개)는 옛 화면 호환용으로 그대로 둔다 — 새로 고치지 않는다(다음 정리 때 지움).
--   · get_title_match_state: 도전 기록에 receiveVideoPath 한 칸 추가 (나머지 그대로 — 2026-11-12 DB 지금 정의 위에).

alter table public.title_match_attempts add column if not exists receive_video_path text;

comment on column public.title_match_attempts.video_path is '치는 영상(완벽한 자세로 3번 연속) — 2026-11-12 전 기록은 치기·받기를 한 영상에';
comment on column public.title_match_attempts.receive_video_path is '받는 영상(파트너에게 미트 3번 받아주기) — 합격이면 꼭, 불합격은 없을 수 있다 (2026-11-12)';

create or replace function public.record_title_match_attempt_v2(
  _member_id uuid,
  _hit_video_path text,
  _receive_video_path text,
  _passed boolean,
  _note text default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _caller uuid := auth.uid();
  _p record; _ls text; _ch public.title_match_challenges%rowtype; _no int; _max int := public.title_match_max_attempts();
  _retry timestamptz; _items jsonb; _res jsonb; _note2 text := nullif(btrim(coalesce(_note, '')), '');
  _rank_ko text; _link text;
  _recv text := nullif(btrim(coalesce(_receive_video_path, '')), '');
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  if _passed is null then raise exception '합격·불합격을 골라 주세요'; end if;
  if _member_id is null then raise exception '회원을 골라 주세요'; end if;
  -- 지점장이 스스로 레벨 10 이어도 자기 타이틀매치는 다른 지점장·관장님이 본다
  if _member_id = _caller then raise exception '본인 타이틀매치는 다른 지점장·관장님이 심사해요'; end if;
  -- 합격은 두 영상 모두 (치기 3번 연속 + 미트 3번 받아주기)
  if _passed and _recv is null then raise exception '합격은 치는 영상 · 받는 영상 2개를 모두 올려 주세요'; end if;

  -- 두 분이 동시에 올려도 한 줄씩 — 회원 상태를 읽기 전에 잠근다 (먼저 합격하면 뒤 기록은 레벨 확인에서 멈춘다)
  perform pg_advisory_xact_lock(hashtext('title_match:' || _member_id::text));

  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;
  if coalesce(_p.current_level, 1) <> 10 then
    raise exception '레벨 10 회원만 타이틀매치 심사를 할 수 있습니다';
  end if;
  if not public.title_match_flow_enabled_for(_member_id, _p.current_rank) then
    raise exception '이 리그 타이틀매치는 심사 항목 확인으로 진행합니다';
  end if;
  if not public.can_clear_level_gate(_caller, _member_id, _p.current_rank, 10) then
    raise exception '%', case public.level_gate_authority_for(_member_id, _p.current_rank, 10)
      when 'owner'   then '이 타이틀매치는 관장님만 심사할 수 있습니다'
      when 'manager' then '이 타이틀매치는 지점장·관장만 심사할 수 있습니다'
      else '담당 회원만 심사할 수 있습니다' end;
  end if;

  select status::text into _ls from level_status
   where user_id = _member_id and rank_name = _p.current_rank and level_number = 10;
  if _ls = 'boss_cleared' then raise exception '이미 통과한 타이틀매치입니다'; end if;

  -- 영상: 이 회원 폴더에 실제로 올라간 파일이어야 한다 (치는 영상은 늘 · 받는 영상은 있으면)
  if _hit_video_path is null
     or _hit_video_path !~ ('^' || _member_id::text || '/[A-Za-z0-9._-]{1,120}$') then
    raise exception '치는 영상 경로가 올바르지 않습니다';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'title-match-videos' and name = _hit_video_path) then
    raise exception '치는 영상이 아직 올라가지 않았습니다 — 다시 올려 주세요';
  end if;
  if _recv is not null then
    if _recv = _hit_video_path then raise exception '치는 영상과 받는 영상이 같은 파일이에요'; end if;
    if _recv !~ ('^' || _member_id::text || '/[A-Za-z0-9._-]{1,120}$') then
      raise exception '받는 영상 경로가 올바르지 않습니다';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'title-match-videos' and name = _recv) then
      raise exception '받는 영상이 아직 올라가지 않았습니다 — 다시 올려 주세요';
    end if;
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

  insert into title_match_attempts (challenge_id, user_id, attempt_no, passed, video_path, receive_video_path, note, recorded_by)
  values (_ch.id, _member_id, _no, _passed, _hit_video_path, _recv, _note2, _caller);

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
$function$;

revoke all on function public.record_title_match_attempt_v2(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.record_title_match_attempt_v2(uuid, text, text, boolean, text) to authenticated, service_role;

create or replace function public.get_title_match_state(_member_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  _caller uuid := auth.uid();
  _uid uuid := coalesce(_member_id, auth.uid());
  _p record; _ls text; _ch public.title_match_challenges%rowtype; _attempts jsonb := '[]'::jsonb;
  _retry timestamptz; _is_title boolean; _flow boolean; _cleared boolean;
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  if _uid is distinct from _caller
     and not (has_role(_caller, 'super_admin') or is_branch_manager_of(_caller, _uid) or is_coach_of(_caller, _uid)) then
    raise exception 'Not authorized';
  end if;

  select current_rank, coalesce(current_level, 1) as lv, coalesce(bosses_cleared, 0) as bc
    into _p from member_progress where user_id = _uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_progress');
  end if;

  select status::text into _ls from level_status
   where user_id = _uid and rank_name = _p.current_rank and level_number = 10;

  _is_title := (_p.lv = 10);
  _flow := public.title_match_flow_enabled_for(_uid, _p.current_rank);
  _cleared := coalesce(_ls = 'boss_cleared', false);

  -- 열린 신청이 있으면 그것, 없으면 가장 최근 신청 (기록 보기용)
  select * into _ch from title_match_challenges
   where user_id = _uid and rank_name = _p.current_rank
   order by (status = 'requested') desc, requested_at desc
   limit 1;

  if _ch.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'no', a.attempt_no,
             'passed', a.passed,
             'note', a.note,
             'recordedAt', a.recorded_at,
             'videoPath', a.video_path,
             'receiveVideoPath', a.receive_video_path
           ) order by a.attempt_no), '[]'::jsonb)
      into _attempts
      from title_match_attempts a
     where a.challenge_id = _ch.id;
  end if;

  _retry := public.title_match_retry_at_for(_uid, _p.current_rank);

  return jsonb_build_object(
    'ok', true,
    'rank', _p.current_rank::text,
    'level', _p.lv,
    'isTitleLevel', _is_title,
    'flowEnabled', _flow,
    'cleared', _cleared,
    'authority', public.level_gate_authority_for(_uid, _p.current_rank, 10),
    'maxAttempts', public.title_match_max_attempts(),
    'retryDays', public.title_match_retry_days(),
    'retryAt', _retry,
    'challenge', case when _ch.id is null then null else jsonb_build_object(
        'id', _ch.id,
        'status', _ch.status,
        'requestedAt', _ch.requested_at,
        'requestedBySelf', (_ch.requested_by = _uid),
        'closedAt', _ch.closed_at,
        'attempts', _attempts
      ) end,
    'canRequest', (_is_title and _flow and not _cleared and _retry is null
                   and not coalesce(_ch.status = 'requested', false))
  );
end;
$function$;
