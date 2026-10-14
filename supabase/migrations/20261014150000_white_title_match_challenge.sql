-- 🏆 화이트 타이틀매치 — 회원 신청 · 지점장 영상 심사 · 도전 3번 · 3번 모두 아쉬우면 7일 뒤 다시 신청 (2026-10-14 대표님)
--
-- 흐름
--   1) 레벨 10 회원: 홈 팝업 → '타이틀미션 보기' → 타이틀매치 화면에서
--        ① 파트너를 구한다  ② 파트너와 타이틀미션을 연습한다  ③ 지점장님께 심사를 신청한다 (레벨 10이 되자마자 신청 가능)
--   2) 지점장(또는 관장): 심사함에서 도전마다 영상을 찍어 올리고 합격·불합격을 고른다.
--        미션 = 타이틀매치 동작을 완벽한 자세로 3번 연속 성공 → 같은 동작을 파트너에게 미트로 3번 받아주기
--   3) 합격 → 그 레벨 10 심사 항목(미션)을 전부 통과로 기록하고 approve_level_review 로 승급
--             (XP·챔피언 머니·알림·마일리지·축하 피드는 기존 경로 그대로)
--      불합격 → 남은 기회 알림. 3번째도 불합격이면 이번 신청은 끝나고, 한국 날짜로 7일 뒤부터 다시 신청한다.
--
-- 숫자 정본: title_match_max_attempts() = 3 · title_match_retry_days() = 7
-- 새 흐름을 쓰는 리그: title_match_flow_enabled(rank) — 지금은 화이트만 (블루~블랙은 기존 심사 항목 확인 방식 그대로)
-- 화이트 레벨 10 승인 권한: 담당 코치 → 지점장·관장 (대표님: "심사를 진행하는 지점장")
--
-- 기록은 아래 함수로만 쓴다 (테이블에 쓰기 정책 없음).
-- 영상은 비공개 저장소 title-match-videos/{회원 id}/… — 회원 본인 · 그 지점 지점장 · 관장만 본다.

-- ── 숫자 정본 ─────────────────────────────────────────────
create or replace function public.title_match_max_attempts()
returns integer
language sql
immutable
set search_path = public
as $$ select 3 $$;

create or replace function public.title_match_retry_days()
returns integer
language sql
immutable
set search_path = public
as $$ select 7 $$;

-- 회원 신청 · 지점장 영상 심사 흐름을 쓰는 리그
create or replace function public.title_match_flow_enabled(_rank rank_name)
returns boolean
language sql
immutable
set search_path = public
as $$ select _rank::text = 'white' $$;

-- 3번 마감된 날(한국 날짜) + 7일 0시부터 다시 신청
create or replace function public.title_match_retry_at(_closed_at timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (((_closed_at at time zone 'Asia/Seoul')::date + public.title_match_retry_days())::timestamp)
         at time zone 'Asia/Seoul'
$$;

-- ── 화이트 타이틀매치는 지점장·관장이 심사 ─────────────────
create or replace function public.level_gate_authority(_rank rank_name, _level integer)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when _level = 10 and _rank::text = 'white' then 'manager'
    when _level = 10 and _rank::text = 'blue'  then 'manager'
    when _level = 10 and _rank::text = 'red'   then 'owner'
    when _level = 10 and _rank::text = 'black' then 'owner'
    when _rank::text = 'black'                 then 'manager'
    else 'coach'
  end;
$function$;

-- ── 기록 ─────────────────────────────────────────────────
-- 신청 1건 = 도전 최대 3번. auth.users 와 FK 를 걸지 않는다 (계정 정리를 막지 않는 기록 테이블).
create table if not exists public.title_match_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rank_name rank_name not null,
  status text not null default 'requested',
  requested_by uuid,
  requested_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid,
  updated_at timestamptz not null default now(),
  constraint title_match_challenges_status_chk
    check (status in ('requested', 'passed', 'failed', 'cancelled'))
);

-- 한 리그에 열린 신청은 하나만
create unique index if not exists title_match_challenges_one_open
  on public.title_match_challenges (user_id, rank_name)
  where status = 'requested';

create index if not exists title_match_challenges_user_idx
  on public.title_match_challenges (user_id, requested_at desc);

create table if not exists public.title_match_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.title_match_challenges (id),
  user_id uuid not null,
  attempt_no integer not null,
  passed boolean not null,
  video_path text not null,
  note text,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  constraint title_match_attempts_no_chk check (attempt_no >= 1),
  constraint title_match_attempts_once unique (challenge_id, attempt_no)
);

create index if not exists title_match_attempts_user_idx
  on public.title_match_attempts (user_id, recorded_at desc);

alter table public.title_match_challenges enable row level security;
alter table public.title_match_attempts enable row level security;

revoke all on public.title_match_challenges from anon;
revoke all on public.title_match_attempts from anon;

do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'title_match_challenges'
                   and policyname = 'title_match_challenges_read') then
    create policy title_match_challenges_read on public.title_match_challenges
      for select to authenticated
      using (
        user_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'super_admin')
        or public.is_branch_manager_of((select auth.uid()), user_id)
        or public.is_coach_of((select auth.uid()), user_id)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'title_match_attempts'
                   and policyname = 'title_match_attempts_read') then
    create policy title_match_attempts_read on public.title_match_attempts
      for select to authenticated
      using (
        user_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'super_admin')
        or public.is_branch_manager_of((select auth.uid()), user_id)
        or public.is_coach_of((select auth.uid()), user_id)
      );
  end if;
end
$p$;

-- ── 영상 저장소 (비공개) ─────────────────────────────────────
-- 50MB — 앱 안 촬영은 720p 로 작게 저장한다 (1분 ≈ 20MB). 찍어 둔 영상은 앱이 크기를 먼저 확인한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('title-match-videos', 'title-match-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
on conflict (id) do nothing;

do $p$
begin
  -- 올리기: 그 회원 지점의 지점장 · 관장. 경로 첫 칸 = 회원 id
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'title_match_videos_insert') then
    create policy title_match_videos_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'title-match-videos'
        and case
              when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                then public.has_role((select auth.uid()), 'super_admin')
                     or public.is_branch_manager_of((select auth.uid()), ((storage.foldername(name))[1])::uuid)
              else false
            end
      );
  end if;
  -- 보기: 회원 본인 · 지점장 · 관장 · 담당 코치
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'title_match_videos_read') then
    create policy title_match_videos_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'title-match-videos'
        and case
              when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                then (storage.foldername(name))[1] = (select auth.uid())::text
                     or public.has_role((select auth.uid()), 'super_admin')
                     or public.is_branch_manager_of((select auth.uid()), ((storage.foldername(name))[1])::uuid)
                     or public.is_coach_of((select auth.uid()), ((storage.foldername(name))[1])::uuid)
              else false
            end
      );
  end if;
end
$p$;

-- ── 내부 도우미 ───────────────────────────────────────────
-- 3번 마감 뒤 다시 신청할 수 있는 시각 (잠겨 있지 않으면 null)
create or replace function public.title_match_retry_at_for(_uid uuid, _rank rank_name)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select r from (
    select public.title_match_retry_at(max(c.closed_at)) as r
      from public.title_match_challenges c
     where c.user_id = _uid and c.rank_name = _rank and c.status = 'failed'
  ) x
  where x.r > now()
$$;

-- 리그 이름 · 타이틀매치 화면 주소
create or replace function public.title_match_rank_ko(_rank rank_name)
returns text
language sql
immutable
set search_path = public
as $$
  select case _rank::text when 'white' then '화이트' when 'blue' then '블루' when 'red' then '레드' else '블랙' end
$$;

create or replace function public.title_match_link(_rank rank_name)
returns text
language sql
immutable
set search_path = public
as $$
  select '/title-match?lv=' || (array_position(array['white','blue','red','black'], _rank::text) * 10)::text
$$;

-- 심사함(level_status)에 올린다 — 이미 pending 이면 그대로 둔다
create or replace function public.title_match_put_in_review(_uid uuid, _rank rank_name, _by uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _old level_status_type; _ls_id uuid;
begin
  select status, id into _old, _ls_id from level_status
   where user_id = _uid and rank_name = _rank and level_number = 10;
  if _old = 'pending' then return; end if;

  insert into level_status (user_id, rank_name, level_number, status, approval_note)
  values (_uid, _rank, 10, 'pending', _reason)
  on conflict (user_id, rank_name, level_number)
  do update set status = 'pending', approval_note = _reason, updated_at = now()
  returning id into _ls_id;

  insert into level_status_history (level_status_id, user_id, rank_name, level_number,
                                    previous_status, new_status, changed_by, change_reason)
  values (_ls_id, _uid, _rank, 10, coalesce(_old, 'locked'), 'pending', _by, _reason);
end;
$$;

-- ── 상태 읽기 (회원 본인 · 지점장 · 관장 · 담당 코치) ─────────
create or replace function public.get_title_match_state(_member_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
  _flow := public.title_match_flow_enabled(_p.current_rank);
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
             'videoPath', a.video_path
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
    'authority', public.level_gate_authority(_p.current_rank, 10),
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
$$;

-- ── 회원: 지점장님께 심사 신청 ──────────────────────────────
create or replace function public.request_title_match_review()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _p record; _ls text; _retry timestamptz; _nick text; _branch text; _n int := 0; _r record; _body text;
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

  insert into title_match_challenges (user_id, rank_name, status, requested_by)
  values (_uid, _p.current_rank, 'requested', _uid);

  perform public.title_match_put_in_review(_uid, _p.current_rank, _uid, '회원 타이틀매치 심사 신청');

  -- 지점장님께 알림 — 그 지점에 지점장 계정이 없으면 관장님께
  select coalesce(nullif(btrim(nickname), ''), nullif(btrim(name), ''), '회원'), branch_name
    into _nick, _branch
    from profiles where user_id = _uid;
  _body := _nick || '님이 ' || public.title_match_rank_ko(_p.current_rank)
           || ' 타이틀매치 심사를 신청했어요. 심사함에서 영상을 찍어 결과를 올려 주세요.';

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

  return public.get_title_match_state(_uid);
end;
$$;

-- ── 회원: 신청 취소 (도전 기록이 없을 때만) ────────────────────
create or replace function public.cancel_title_match_request()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid(); _p record; _ch public.title_match_challenges%rowtype;
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtext('title_match:' || _uid::text));

  select * into _p from member_progress where user_id = _uid;
  if not found then raise exception '진행 정보가 없습니다'; end if;

  select * into _ch from title_match_challenges
   where user_id = _uid and rank_name = _p.current_rank and status = 'requested'
   limit 1;
  if _ch.id is null then raise exception '취소할 신청이 없어요'; end if;
  if exists (select 1 from title_match_attempts where challenge_id = _ch.id) then
    raise exception '이미 도전이 시작돼서 취소할 수 없어요';
  end if;

  update title_match_challenges
     set status = 'cancelled', closed_at = now(), closed_by = _uid, updated_at = now()
   where id = _ch.id;

  return public.get_title_match_state(_uid);
end;
$$;

-- ── 지점장·관장: 도전 기록 (영상 + 합격·불합격) ────────────────
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

-- ── 실행 권한 ─────────────────────────────────────────────
revoke all on function public.title_match_retry_at_for(uuid, rank_name) from public, anon, authenticated;
revoke all on function public.title_match_put_in_review(uuid, rank_name, uuid, text) from public, anon, authenticated;

revoke all on function public.get_title_match_state(uuid) from public, anon;
revoke all on function public.request_title_match_review() from public, anon;
revoke all on function public.cancel_title_match_request() from public, anon;
revoke all on function public.record_title_match_attempt(uuid, text, boolean, text) from public, anon;

grant execute on function public.get_title_match_state(uuid) to authenticated;
grant execute on function public.request_title_match_review() to authenticated;
grant execute on function public.cancel_title_match_request() to authenticated;
grant execute on function public.record_title_match_attempt(uuid, text, boolean, text) to authenticated;
