-- 2026-09-23 BOXER 풀파워 검수 후속 ① — 153 챌린지 왕좌·런칭 이벤트 점수 무결성
-- 확정 발견: H1 앱활동 무제한 누적 · H2 외부 가입/미승인 계정 순위 · H4 좋아요 기간 필터로 이벤트 전 좋아요 0점
--           H5 관리자 계정 순위 포함 · H7 버피 자기신고 무제한(NaN/Infinity) · M7 실명 검색 · M8 이벤트 연속출석
--
-- 1) _is_rankable_member     : 순위·좋아요 자격 = 지도진 아님 + 승인 + 회원 역할만 + (이용권 기록 또는 얼굴 인식 출석 1회 이상)
-- 2) _counted_nickname_likes : "세는 좋아요" 정의를 한 곳에 — 지금 같은 지점 · 닉네임을 정한 회원에게 ·
--                              자격 있고 처음 받은 아이디/비밀번호를 바꾼 회원이 보낸 것
-- 3) _king_scores v3         : 출석 계열은 얼굴 인식(broj/face)만, 활동은 종류별 하루 1점, 버피는 하루 최고 기록(상한),
--                              체력은 (종목, 날) 1라운드, 닉네임은 지금 받고 있는 좋아요
-- 4) get_153_king_board v5 · get_launch_event_board v4 : 자격 필터, 연속출석은 이벤트 기간에만 시작일 적용
-- 5) toggle_nickname_like v2 · get_branch_nicknames v2 : 원자적 토글, 자격 검사, 닉네임만 검색, can_like/reason
-- 6) 인덱스 · nickname_likes 정책 initplan

-- ── 1) 순위 자격 ───────────────────────────────────────────────
create or replace function public._is_rankable_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
      from public.profiles p
     where p.user_id = p_user
       and coalesce(p.is_staff, false) = false
       and coalesce(p.is_approved, false) = true
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role <> 'member'::public.app_role)
       and (p.membership_end is not null
            or exists (
              select 1 from public.attendance_logs a
               where a.user_id = p.user_id and a.method in ('broj', 'face')))
  );
$function$;

revoke all on function public._is_rankable_member(uuid) from public, anon, authenticated;

-- ── 2) 세는 좋아요 ─────────────────────────────────────────────
create or replace function public._counted_nickname_likes(p_until timestamptz default null)
returns table(liker_id uuid, target_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select l.liker_id, l.target_id, l.created_at
    from public.nickname_likes l
    join public.profiles t  on t.user_id  = l.target_id
    join public.profiles lk on lk.user_id = l.liker_id
   where coalesce(t.branch_name, '') <> ''
     and l.branch_name  = t.branch_name
     and lk.branch_name = t.branch_name
     and nullif(btrim(t.nickname), '') is not null
     and btrim(t.nickname) <> btrim(coalesce(t.name, ''))
     and coalesce(lk.must_change_credentials, false) = false
     and l.created_at <= now()
     and (p_until is null or l.created_at < p_until)
     and public._is_rankable_member(l.liker_id);
$function$;

revoke all on function public._counted_nickname_likes(timestamptz) from public, anon, authenticated;

-- ── 3) 점수 v3 ─────────────────────────────────────────────────
create or replace function public._king_scores(p_category text, p_since timestamptz, p_until timestamptz default null)
returns table(user_id uuid, score numeric, tie_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sql text;
begin
  -- $1 = since (null = 하한 없음 · streak 은 최근 400일), $2 = until (null = 상한 없음)
  -- v3 (2026-09-23 검수):
  --   출석·얼리버드·연속 = 얼굴 인식 출석(method broj/face)만. QR 은 체육관 밖에서도 찍힐 수 있어 왕좌에서 뺀다.
  --   얼리버드 = 새벽 5시~오전 9시(KST)에 들어온 날 수.
  --   레벨업 = '레벨업…' + '… 타이틀매치 클리어' XP 기록.
  --   버피 = 하루 최고 기록의 합 (한 번 기록 상한 = 상급 목표 × 3, NaN/Infinity 제외).
  --   체력 = 목표를 채운 (종목, 날) 수.
  --   앱활동 = (행동 종류, 날) 수 — 종류별 하루 1점, 하루 최대 10점.
  --   닉네임 = 지금 받고 있는 좋아요(_counted_nickname_likes). 누른 좋아요는 취소 전까지 유효 → since 무시.
  v_sql := case p_category
    when 'attendance' then $q$
      with d as (
        select a.user_id as uid, (a.checked_in_at at time zone 'Asia/Seoul')::date as kd, min(a.checked_in_at) as first_at
          from public.attendance_logs a
         where a.method in ('broj', 'face')
           and a.checked_in_at <= now()
           and ($1::timestamptz is null or a.checked_in_at >= $1)
           and ($2::timestamptz is null or a.checked_in_at < $2)
         group by 1, 2)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'early_bird' then $q$
      with d as (
        select a.user_id as uid, (a.checked_in_at at time zone 'Asia/Seoul')::date as kd, min(a.checked_in_at) as first_at
          from public.attendance_logs a
         where a.method in ('broj', 'face')
           and a.checked_in_at <= now()
           and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') >= 5
           and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') < 9
           and ($1::timestamptz is null or a.checked_in_at >= $1)
           and ($2::timestamptz is null or a.checked_in_at < $2)
         group by 1, 2)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'streak' then $q$
      with days as (
        select distinct a.user_id as uid, (a.checked_in_at at time zone 'Asia/Seoul')::date as kd
          from public.attendance_logs a
         where a.method in ('broj', 'face')
           and a.checked_in_at <= now()
           and a.checked_in_at >= coalesce($1::timestamptz, now() - interval '400 days')
           and ($2::timestamptz is null or a.checked_in_at < $2)),
      runs as (
        select days.uid, days.kd, days.kd - (row_number() over (partition by days.uid order by days.kd))::int as grp
          from days),
      agg as (
        select runs.uid, runs.grp, count(*)::numeric as len, max(runs.kd) as last_d, min(runs.kd) as first_d
          from runs group by runs.uid, runs.grp)
      select agg.uid, agg.len, (agg.first_d::timestamp at time zone 'Asia/Seoul')
        from agg
       where agg.last_d >= (least(coalesce($2::timestamptz, now()), now()) at time zone 'Asia/Seoul')::date - 1 $q$
    when 'levelup' then $q$
      select x.user_id, count(*)::numeric, max(x.created_at)
        from public.xp_logs x
       where (x.reason like '레벨업%' or x.reason like '%타이틀매치 클리어%')
         and x.created_at <= now()
         and ($1::timestamptz is null or x.created_at >= $1)
         and ($2::timestamptz is null or x.created_at < $2)
       group by x.user_id $q$
    when 'burpee' then $q$
      with best as (
        select a.user_id as uid, (a.created_at at time zone 'Asia/Seoul')::date as kd,
               max(least(a.submitted_value,
                         greatest(coalesce((c.difficulty_targets ->> 'advanced')::numeric, 0) * 3, 1))) as v,
               max(a.created_at) as last_at
          from public.boxing_fun_challenge_attempts a
          join public.boxing_fun_challenges c on c.id = a.challenge_id
         where c.category = 'burpee'
           and a.status <> 'rejected'
           and a.submitted_value > 0
           and a.submitted_value < 'Infinity'::numeric
           and a.created_at <= now()
           and ($1::timestamptz is null or a.created_at >= $1)
           and ($2::timestamptz is null or a.created_at < $2)
         group by 1, 2)
      select best.uid, sum(best.v)::numeric, max(best.last_at) from best group by best.uid $q$
    when 'fitness' then $q$
      with d as (
        select a.user_id as uid, a.challenge_id, (a.created_at at time zone 'Asia/Seoul')::date as kd,
               min(a.created_at) as first_at
          from public.boxing_fun_challenge_attempts a
          join public.boxing_fun_challenges c on c.id = a.challenge_id
         where a.status = 'completed'
           and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
           and a.created_at <= now()
           and ($1::timestamptz is null or a.created_at >= $1)
           and ($2::timestamptz is null or a.created_at < $2)
         group by 1, 2, 3)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'app' then $q$
      with ev as (
        select x.user_id as uid, 'open'::text as src, x.created_at as ts
          from public.xp_logs x where x.reason = '출석 체크'
        union all
        select a.user_id, 'qr', a.checked_in_at from public.attendance_logs a where a.method = 'qr_manual'
        union all
        select a.user_id, 'finish', a.ended_at from public.attendance_logs a
         where a.ended_at is not null and a.ended_source = 'member_app'
        union all
        select f.user_id, 'arena', f.created_at from public.boxing_fun_challenge_attempts f
        union all
        select qz.user_id, 'quiz', qz.created_at from public.boxing_quiz_attempts qz
        union all
        select j.user_id, 'journal', j.created_at from public.champion_journal_entries j
        union all
        select jc.commenter_user_id, 'comment', jc.created_at from public.champion_journal_comments jc
        union all
        select ch.sender_user_id, 'cheer', ch.created_at from public.boxing_cheers ch
        union all
        select g.user_id, 'gear', g.created_at from public.boxing_gear_posts g
        union all
        select l.liker_id, 'like', l.created_at from public.nickname_likes l
      ),
      d as (
        select ev.uid, ev.src, (ev.ts at time zone 'Asia/Seoul')::date as kd, min(ev.ts) as first_at
          from ev
         where ev.uid is not null and ev.ts is not null and ev.ts <= now()
           and ($1::timestamptz is null or ev.ts >= $1)
           and ($2::timestamptz is null or ev.ts < $2)
         group by 1, 2, 3)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'nickname' then $q$
      select c.target_id, count(*)::numeric, max(c.created_at)
        from public._counted_nickname_likes($2::timestamptz) c
       group by c.target_id $q$
    else null
  end;
  if v_sql is null then
    raise exception 'invalid category';
  end if;
  return query execute v_sql using p_since, p_until;
end;
$function$;

revoke all on function public._king_scores(text, timestamptz, timestamptz) from public, anon, authenticated;

-- ── 4) 앱 킹 보드 v5 ───────────────────────────────────────────
create or replace function public.get_153_king_board(p_category text, p_period text default 'weekly'::text, p_scope text default 'branch'::text, p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz;
  v_until timestamptz := null;
  v_win jsonb := null;
  v_branch text;
  v_scope text := coalesce(p_scope, 'branch');
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if p_category not in ('attendance', 'streak', 'early_bird', 'levelup', 'burpee', 'fitness', 'app', 'nickname') then
    raise exception 'invalid category';
  end if;
  if p_period not in ('weekly', 'monthly', 'event') then
    raise exception 'invalid period';
  end if;
  if v_scope not in ('branch', 'all') then
    raise exception 'invalid scope';
  end if;

  if p_period = 'event' then
    v_win := public.get_launch_event_window();
    v_since := (v_win ->> 'since')::timestamptz;
    v_until := (v_win ->> 'until')::timestamptz;
  else
    v_since := case when p_period = 'weekly'
      then (date_trunc('week',  now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul'
      else (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul' end;
  end if;

  select p.branch_name into v_branch from public.profiles p where p.user_id = v_uid;
  if v_scope = 'branch' and coalesce(v_branch, '') = '' then
    v_scope := 'all';
  end if;

  if p_period = 'event' and (v_win ->> 'status') = 'upcoming' then
    v_out := jsonb_build_object('board', '[]'::jsonb, 'me', null, 'total', 0);
  else
    with ranked as (
      select s.user_id, s.score,
             coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
             coalesce(p.branch_name, '미지정') as branch_name,
             row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
        from public._king_scores(
               p_category,
               -- 연속출석은 '지금 연속' — 주·월 기간을 쓰지 않는다. 이벤트 기간에만 시작일부터 센다.
               case when p_category = 'streak' and p_period <> 'event' then null else v_since end,
               v_until) s
        join public.profiles p on p.user_id = s.user_id
       where s.score > 0
         and (v_scope = 'all' or p.branch_name = v_branch)
         and public._is_rankable_member(s.user_id)
    )
    select jsonb_build_object(
      'board', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'rank', r.rnk, 'user_id', r.user_id, 'display_name', r.display_name,
                 'branch_name', r.branch_name, 'score', r.score, 'is_me', r.user_id = v_uid)
               order by r.rnk)
          from (select * from ranked order by rnk limit v_limit) r), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', r.rnk, 'score', r.score) from ranked r where r.user_id = v_uid),
      'total', (select count(*) from ranked)
    ) into v_out;
  end if;

  return jsonb_build_object(
    'category', p_category, 'period', p_period, 'scope', v_scope,
    'since', v_since, 'until', v_until, 'branch', v_branch, 'event', v_win
  ) || coalesce(v_out, '{}'::jsonb);
end;
$function$;

-- ── 5) TV2 런칭 이벤트 보드 v4 (anon) ───────────────────────────
create or replace function public.get_launch_event_board(p_branch text, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_win jsonb := public.get_launch_event_window();
  v_since timestamptz := (v_win ->> 'since')::timestamptz;
  v_until timestamptz := (v_win ->> 'until')::timestamptz;
  v_status text := v_win ->> 'status';
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_cat text;
  v_items jsonb := '[]'::jsonb;
  v_rows jsonb;
  v_total integer;
  v_month_since timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_cur_month jsonb;
  v_cur_all jsonb;
  v_first_day date;
begin
  if coalesce(btrim(p_branch), '') = '' then
    raise exception 'branch required';
  end if;

  -- 런칭 이벤트 세 왕좌
  foreach v_cat in array array['attendance', 'app', 'nickname'] loop
    if v_status = 'upcoming' then
      v_rows := '[]'::jsonb; v_total := 0;
    else
      with ranked as (
        select s.user_id, s.score,
               coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
               row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
          from public._king_scores(v_cat, v_since, v_until) s
          join public.profiles p on p.user_id = s.user_id
         where s.score > 0
           and p.branch_name = p_branch
           and public._is_rankable_member(s.user_id)
      )
      select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                         from (select * from ranked order by rnk limit v_limit) r), '[]'::jsonb),
             (select count(*) from ranked)
        into v_rows, v_total;
    end if;
    v_items := v_items || jsonb_build_object('category', v_cat, 'board', v_rows, 'total', v_total);
  end loop;

  -- 현재 출석왕 (이번 달) Top 3
  with ranked as (
    select s.user_id, s.score,
           coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
           row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
      from public._king_scores('attendance', v_month_since, null) s
      join public.profiles p on p.user_id = s.user_id
     where s.score > 0 and p.branch_name = p_branch and public._is_rankable_member(s.user_id)
  )
  select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                     from (select * from ranked order by rnk limit 3) r), '[]'::jsonb)
    into v_cur_month;

  -- 역대 출석왕 (기록 시작부터) Top 3
  select min((a.checked_in_at at time zone 'Asia/Seoul')::date) into v_first_day
    from public.attendance_logs a where a.method in ('broj', 'face');
  with ranked as (
    select s.user_id, s.score,
           coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
           row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
      from public._king_scores('attendance', null, null) s
      join public.profiles p on p.user_id = s.user_id
     where s.score > 0 and p.branch_name = p_branch and public._is_rankable_member(s.user_id)
  )
  select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                     from (select * from ranked order by rnk limit 3) r), '[]'::jsonb)
    into v_cur_all;

  return jsonb_build_object(
    'branch', p_branch, 'period', 'event', 'items', v_items,
    'current_attendance', jsonb_build_object(
      'month', jsonb_build_object('since', v_month_since, 'board', v_cur_month),
      'all_time', jsonb_build_object('since_date', v_first_day, 'board', v_cur_all)
    )
  ) || v_win;
end;
$function$;

-- ── 6) 닉네임 좋아요 토글 v2 ───────────────────────────────────
create or replace function public.toggle_nickname_like(_target uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_t public.profiles%rowtype;
  v_deleted integer;
  v_liked boolean;
  v_likes integer;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if _target is null or _target = v_uid then raise exception '내 닉네임에는 좋아요를 보낼 수 없어요'; end if;

  -- 원자적 토글: 먼저 지우고, 지운 게 없을 때만 넣는다. 취소는 자격과 상관없이 언제나 된다.
  delete from public.nickname_likes where liker_id = v_uid and target_id = _target;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    v_liked := false;
  else
    select * into v_me from public.profiles where user_id = v_uid;
    select * into v_t from public.profiles where user_id = _target;
    if v_t.user_id is null then raise exception '회원을 찾을 수 없습니다'; end if;
    if coalesce(v_me.branch_name, '') = '' or v_me.branch_name is distinct from v_t.branch_name then
      raise exception '같은 지점 회원에게만 좋아요를 보낼 수 있어요';
    end if;
    -- 전체관리자·관리자는 체험용으로 누를 수 있다(점수에는 안 들어간다 — _counted_nickname_likes).
    if not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
      if not public._is_rankable_member(v_uid) then
        raise exception '지점 회원만 좋아요를 보낼 수 있어요';
      end if;
      if coalesce(v_me.must_change_credentials, false) then
        raise exception '처음 받은 아이디·비밀번호를 바꾼 뒤에 좋아요를 보낼 수 있어요';
      end if;
    end if;
    if not public._is_rankable_member(_target)
       or nullif(btrim(v_t.nickname), '') is null
       or btrim(v_t.nickname) = btrim(coalesce(v_t.name, '')) then
      raise exception '닉네임을 정한 지점 회원에게만 좋아요를 보낼 수 있어요';
    end if;
    insert into public.nickname_likes (liker_id, target_id, branch_name)
    values (v_uid, _target, v_me.branch_name)
    on conflict (liker_id, target_id) do nothing;
    v_liked := true;
  end if;

  select count(*)::int into v_likes from public._counted_nickname_likes(null) c where c.target_id = _target;

  -- likes_month · likes_total 은 이전 화면 호환용 (값은 likes 와 같다)
  return jsonb_build_object('liked', v_liked, 'likes', v_likes, 'likes_month', v_likes, 'likes_total', v_likes);
end;
$function$;

-- ── 7) 같은 지점 닉네임 목록 v2 ─────────────────────────────────
create or replace function public.get_branch_nicknames(p_search text default null::text, p_limit integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_q text := left(nullif(btrim(coalesce(p_search, '')), ''), 30);
  v_pat text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 60), 200));
  v_rows jsonb;
  v_can_like boolean;
  v_reason text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select * into v_me from public.profiles where user_id = v_uid;
  if coalesce(v_me.branch_name, '') = '' then
    return jsonb_build_object('branch', null, 'rows', '[]'::jsonb, 'my_given', 0, 'can_like', false, 'reason', 'no_branch');
  end if;

  if public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin') then
    v_can_like := true;  v_reason := 'admin_test';
  elsif not public._is_rankable_member(v_uid) then
    v_can_like := false; v_reason := 'not_member';
  elsif coalesce(v_me.must_change_credentials, false) then
    v_can_like := false; v_reason := 'change_credentials';
  else
    v_can_like := true;  v_reason := null;
  end if;

  -- 검색은 닉네임만 (실명 검색으로 별명 주인을 역추적하지 못하게). % _ \ 는 글자 그대로 찾는다.
  v_pat := case when v_q is null then null
                else '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with counted as (
    select c.target_id, count(*)::int as n
      from public._counted_nickname_likes(null) c
     group by c.target_id
  ), cand as (
    select p.user_id,
           btrim(p.nickname) as display,
           coalesce(cn.n, 0) as likes,
           exists (select 1 from public.nickname_likes l where l.target_id = p.user_id and l.liker_id = v_uid) as liked_by_me
      from public.profiles p
      left join counted cn on cn.target_id = p.user_id
     where p.branch_name = v_me.branch_name
       and p.user_id <> v_uid
       -- 닉네임을 정한 회원만 (일괄 등록 때 닉네임 = 실명으로 채워진 계정은 목록에 안 나온다)
       and nullif(btrim(p.nickname), '') is not null
       and btrim(p.nickname) <> btrim(coalesce(p.name, ''))
       and (v_pat is null or p.nickname ilike v_pat escape '\')
       and public._is_rankable_member(p.user_id)
     order by likes desc, display asc
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id, 'display', c.display, 'has_nickname', true,
           'likes', c.likes, 'likes_month', c.likes, 'liked_by_me', c.liked_by_me)
         order by c.likes desc, c.display asc), '[]'::jsonb)
    into v_rows
    from cand c;

  return jsonb_build_object(
    'branch', v_me.branch_name,
    'rows', v_rows,
    'my_given', (select count(*) from public.nickname_likes l where l.liker_id = v_uid),
    'can_like', v_can_like,
    'reason', v_reason
  );
end;
$function$;

-- ── 8) 인덱스 · 정책 ───────────────────────────────────────────
create index if not exists idx_xp_logs_created_at on public.xp_logs (created_at);
create index if not exists idx_attendance_checked_in_at on public.attendance_logs (checked_in_at);

drop policy if exists nickname_likes_own_select on public.nickname_likes;
create policy nickname_likes_own_select on public.nickname_likes
  for select to authenticated
  using (liker_id = (select auth.uid()));
