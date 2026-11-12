-- 타이틀매치 영상 보관 한 달 (2026-11-12 대표님 「2번까지 하고 보관기관은 한달로」)
--
--   · 도전이 끝난(합격 · 마감 · 취소) 지 30일 지난 도전의 영상 파일(치는 영상 · 받는 영상)을 저장소에서 지운다.
--     합격 · 불합격 기록(title_match_attempts 줄)은 그대로 — video_deleted_at 에 지운 시각만 남긴다.
--   · 기록에 붙지 않은 영상(올리다 끊겨 기록이 안 된 파일)은 하루 지나면 지운다.
--   · storage.objects 는 SQL 로 지울 수 없다(protect_objects_delete 트리거 · 지워도 실제 파일은 남는다)
--     → Edge Function title-video-cleanup 이 저장소 API(remove)로 지우고, 여기 함수 둘은 고르기 · 표시만 한다.
--   · 크론 title-video-cleanup 매일 04:23 KST(19:23 UTC) → net.http_post(x-auto-key) — 다른 크론 함수와 같은 방식.
--   · get_title_match_state: 도전 기록에 videoDeletedAt (나머지 그대로 — 20261112161952 정의 위에).

alter table public.title_match_attempts add column if not exists video_deleted_at timestamptz;

comment on column public.title_match_attempts.video_deleted_at is
  '보관 기간(도전이 끝나고 30일)이 지나 영상 파일(치는 · 받는)을 지운 시각 — 기록은 남는다 (2026-11-12)';

-- 지울 영상 고르기: 끝난 지 _days 일 지난 도전의 영상(한 기록의 두 파일은 함께) + 기록 없는 하루 지난 파일
create or replace function public.title_match_video_cleanup_targets(_days int default 30, _limit int default 200)
 returns table(path text, reason text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with done as (
    select a.video_path, a.receive_video_path
      from title_match_attempts a
      join title_match_challenges c on c.id = a.challenge_id
     where c.status <> 'requested'
       and coalesce(c.closed_at, c.updated_at) < now() - make_interval(days => greatest(coalesce(_days, 30), 1))
       and a.video_deleted_at is null
     order by coalesce(c.closed_at, c.updated_at)
     limit greatest(coalesce(_limit, 200), 1)
  ),
  orphans as (
    select o.name as obj_name
      from storage.objects o
     where o.bucket_id = 'title-match-videos'
       and o.created_at < now() - interval '1 day'
       and not exists (
         select 1 from title_match_attempts a
          where a.video_path = o.name or a.receive_video_path = o.name)
     order by o.created_at
     limit greatest(coalesce(_limit, 200), 1)
  )
  select video_path, 'closed' from done
  union all
  select receive_video_path, 'closed' from done where receive_video_path is not null
  union all
  select obj_name, 'orphan' from orphans;
$function$;

-- 지운 표시: 한 기록의 파일이 모두 지워졌을 때만 (하나만 지워진 기록은 다음에 다시 고른다)
create or replace function public.title_match_mark_videos_deleted(_paths text[])
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _n int;
begin
  if _paths is null or cardinality(_paths) = 0 then return 0; end if;
  update title_match_attempts
     set video_deleted_at = now()
   where video_deleted_at is null
     and video_path = any(_paths)
     and (receive_video_path is null or receive_video_path = any(_paths));
  get diagnostics _n = row_count;
  return _n;
end;
$function$;

revoke all on function public.title_match_video_cleanup_targets(int, int) from public, anon, authenticated;
revoke all on function public.title_match_mark_videos_deleted(text[]) from public, anon, authenticated;
grant execute on function public.title_match_video_cleanup_targets(int, int) to service_role;
grant execute on function public.title_match_mark_videos_deleted(text[]) to service_role;

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
             'receiveVideoPath', a.receive_video_path,
             'videoDeletedAt', a.video_deleted_at
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

-- 매일 04:23 KST — Edge Function 이 고르기 → 저장소에서 지우기 → 지운 표시
select cron.schedule(
  'title-video-cleanup',
  '23 19 * * *',
  $cron$
  select net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/title-video-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 120000);
  $cron$
);
