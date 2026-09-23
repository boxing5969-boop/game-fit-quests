-- 153 마이복서 런칭 이벤트 (2026-09-23)
--
-- 대표님 지시: 사이니지 TV2 에 런칭 이벤트 ① 출석왕 ② 마이복서153 앱 활동왕 ③ 닉네임 좋아요왕.
-- 같은 지점 회원끼리 닉네임에 좋아요 — 한 사람에게 하나(다시 누르면 취소).
--
-- 1) nickname_likes — 좋아요 원장. (liker, target) 한 쌍에 한 행. 쓰기는 RPC 로만(같은 지점 검사).
-- 2) _king_scores(category, since) — 왕좌 점수 계산의 단일 출처. 8종:
--      attendance 출석왕 · streak 연속출석왕 · early_bird 얼리버드왕 · levelup 레벨업왕 · burpee 버피왕 ·
--      fitness 체력왕 · app 앱활동왕 · nickname 닉네임왕
--    app(앱활동) = 앱에서 한 행동 수: 앱을 연 날(xp_logs '출석 체크') + QR 출석 + 운동 종료 기록 +
--      아레나 도전 + 퀴즈 + 챔피언 일기·댓글 + 응원 + 장비 나눔 글 + 내가 보낸 닉네임 좋아요. 각 1점.
--    nickname(닉네임) = 기간 내 받은 좋아요 수.
-- 3) get_153_king_board / get_153_king_summary — 앱(로그인 회원)용, 공용 점수 함수 사용.
-- 4) get_launch_event_board(p_branch) — 사이니지 TV(anon)용. 지점 이름으로 ① 출석왕 ② 앱활동왕 ③ 닉네임왕 Top N.
--    기간은 KST 이번 달(매월 1일 새로 시작). 표시 이름은 닉네임 → 이름 → 익명 복서.

-- ─────────────────────────────────────────────────────────────
-- 1) 닉네임 좋아요
create table if not exists public.nickname_likes (
  liker_id    uuid not null,
  target_id   uuid not null,
  branch_name text not null,
  created_at  timestamptz not null default now(),
  primary key (liker_id, target_id),
  constraint nickname_likes_not_self check (liker_id <> target_id)
);
create index if not exists idx_nickname_likes_target_at on public.nickname_likes (target_id, created_at);
create index if not exists idx_nickname_likes_liker_at  on public.nickname_likes (liker_id, created_at);
comment on table public.nickname_likes is '닉네임 좋아요 — 같은 지점 회원끼리 1인 1좋아요. 쓰기는 toggle_nickname_like RPC 로만.';

alter table public.nickname_likes enable row level security;
revoke all on public.nickname_likes from anon, authenticated;
grant select on public.nickname_likes to authenticated;
drop policy if exists "nickname_likes_own_select" on public.nickname_likes;
create policy "nickname_likes_own_select" on public.nickname_likes
  for select to authenticated using (liker_id = auth.uid());

create or replace function public.toggle_nickname_like(_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_t_branch text;
  v_liked boolean;
  v_since timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if _target is null or _target = v_uid then raise exception '내 닉네임에는 좋아요를 보낼 수 없어요'; end if;

  select branch_name into v_my_branch from public.profiles where user_id = v_uid;
  select branch_name into v_t_branch from public.profiles where user_id = _target;
  if v_t_branch is null then raise exception '회원을 찾을 수 없습니다'; end if;
  if coalesce(v_my_branch, '') = '' or v_my_branch <> v_t_branch then
    raise exception '같은 지점 회원에게만 좋아요를 보낼 수 있어요';
  end if;

  if exists (select 1 from public.nickname_likes where liker_id = v_uid and target_id = _target) then
    delete from public.nickname_likes where liker_id = v_uid and target_id = _target;
    v_liked := false;
  else
    insert into public.nickname_likes (liker_id, target_id, branch_name) values (v_uid, _target, v_my_branch);
    v_liked := true;
  end if;

  return jsonb_build_object(
    'liked', v_liked,
    'likes_month', (select count(*) from public.nickname_likes where target_id = _target and created_at >= v_since),
    'likes_total', (select count(*) from public.nickname_likes where target_id = _target)
  );
end;
$$;
revoke all on function public.toggle_nickname_like(uuid) from public, anon;
grant execute on function public.toggle_nickname_like(uuid) to authenticated;

-- 같은 지점 회원 닉네임 목록 (좋아요 화면용). 지도진·본인 제외, 승인 회원만.
create or replace function public.get_branch_nicknames(p_search text default null, p_limit integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_since timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 60), 200));
  v_rows jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select branch_name into v_branch from public.profiles where user_id = v_uid;
  if coalesce(v_branch, '') = '' then
    return jsonb_build_object('branch', null, 'rows', '[]'::jsonb, 'my_given', 0);
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.likes_month desc, t.display asc), '[]'::jsonb)
    into v_rows
  from (
    select p.user_id,
           coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display,
           (nullif(p.nickname, '') is not null and p.nickname <> coalesce(p.name, '')) as has_nickname,
           (select count(*) from public.nickname_likes l where l.target_id = p.user_id and l.created_at >= v_since)::int as likes_month,
           exists (select 1 from public.nickname_likes l where l.target_id = p.user_id and l.liker_id = v_uid) as liked_by_me
      from public.profiles p
     where p.branch_name = v_branch
       and p.user_id <> v_uid
       and coalesce(p.is_staff, false) = false
       and coalesce(p.is_approved, false) = true
       and (v_q is null or p.nickname ilike '%' || v_q || '%' or p.name ilike '%' || v_q || '%')
     order by likes_month desc, display asc
     limit v_limit
  ) t;

  return jsonb_build_object(
    'branch', v_branch,
    'rows', v_rows,
    'my_given', (select count(*) from public.nickname_likes l where l.liker_id = v_uid)
  );
end;
$$;
revoke all on function public.get_branch_nicknames(text, integer) from public, anon;
grant execute on function public.get_branch_nicknames(text, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) 점수 계산 단일 출처 (내부 전용)
create or replace function public._king_scores(p_category text, p_since timestamptz)
returns table (user_id uuid, score numeric, tie_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sql text;
begin
  v_sql := case p_category
    when 'attendance' then $q$
      select a.user_id,
             count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::numeric,
             max(a.checked_in_at)
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
       group by a.user_id $q$
    when 'early_bird' then $q$
      select a.user_id, count(*)::numeric, max(a.checked_in_at)
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
         and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') < 9
       group by a.user_id $q$
    when 'streak' then $q$
      with days as (
        select distinct a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as d
          from public.attendance_logs a
         where coalesce(a.is_duplicate, false) = false
           and a.checked_in_at >= now() - interval '400 days'),
      runs as (
        select user_id, d, d - (row_number() over (partition by user_id order by d))::int as grp from days),
      agg as (
        select user_id, grp, count(*)::numeric as len, max(d) as last_d, min(d) as first_d
          from runs group by user_id, grp)
      select user_id, len, (first_d::timestamp at time zone 'Asia/Seoul')
        from agg
       where last_d >= ((now() at time zone 'Asia/Seoul')::date - 1) $q$
    when 'levelup' then $q$
      select x.user_id, count(*)::numeric, max(x.created_at)
        from public.xp_logs x
       where x.reason like '레벨업%' and x.created_at >= $1
       group by x.user_id $q$
    when 'burpee' then $q$
      select a.user_id, sum(a.submitted_value)::numeric, max(a.created_at)
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where c.category = 'burpee' and a.status <> 'rejected' and a.created_at >= $1
       group by a.user_id $q$
    when 'fitness' then $q$
      select a.user_id, count(*)::numeric, max(a.created_at)
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where a.status = 'completed'
         and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
         and a.created_at >= $1
       group by a.user_id $q$
    when 'app' then $q$
      with ev as (
        select x.user_id, x.created_at as ts from public.xp_logs x
         where x.reason = '출석 체크' and x.created_at >= $1
        union all
        select a.user_id, a.checked_in_at from public.attendance_logs a
         where a.method = 'qr_manual' and coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
        union all
        select a.user_id, a.ended_at from public.attendance_logs a
         where a.ended_at is not null and coalesce(a.is_duplicate, false) = false and a.ended_at >= $1
        union all
        select f.user_id, f.created_at from public.boxing_fun_challenge_attempts f where f.created_at >= $1
        union all
        select qz.user_id, qz.created_at from public.boxing_quiz_attempts qz where qz.created_at >= $1
        union all
        select j.user_id, j.created_at from public.champion_journal_entries j where j.created_at >= $1
        union all
        select jc.commenter_user_id, jc.created_at from public.champion_journal_comments jc where jc.created_at >= $1
        union all
        select ch.sender_user_id, ch.created_at from public.boxing_cheers ch where ch.created_at >= $1
        union all
        select g.user_id, g.created_at from public.boxing_gear_posts g where g.created_at >= $1
        union all
        select l.liker_id, l.created_at from public.nickname_likes l where l.created_at >= $1
      )
      select ev.user_id, count(*)::numeric, max(ev.ts) from ev where ev.user_id is not null group by ev.user_id $q$
    when 'nickname' then $q$
      select l.target_id, count(*)::numeric, max(l.created_at)
        from public.nickname_likes l
       where l.created_at >= $1
       group by l.target_id $q$
    else null
  end;
  if v_sql is null then
    raise exception 'invalid category';
  end if;
  return query execute v_sql using p_since;
end;
$$;
revoke all on function public._king_scores(text, timestamptz) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) 앱용 왕 보드 (로그인 회원) — 공용 점수 함수 사용
create or replace function public.get_153_king_board(
  p_category text,
  p_period text default 'weekly',
  p_scope text default 'branch',
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz;
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
  if p_period not in ('weekly', 'monthly') then
    raise exception 'invalid period';
  end if;
  if v_scope not in ('branch', 'all') then
    raise exception 'invalid scope';
  end if;

  v_since := case when p_period = 'weekly'
    then (date_trunc('week',  now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul'
    else (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul' end;

  select p.branch_name into v_branch from public.profiles p where p.user_id = v_uid;
  if v_scope = 'branch' and coalesce(v_branch, '') = '' then
    v_scope := 'all';
  end if;

  with ranked as (
    select s.user_id, s.score,
           coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
           coalesce(p.branch_name, '미지정') as branch_name,
           row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
      from public._king_scores(p_category, v_since) s
      join public.profiles p on p.user_id = s.user_id
     where s.score > 0
       and coalesce(p.is_staff, false) = false
       and (v_scope = 'all' or p.branch_name = v_branch)
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

  return jsonb_build_object(
    'category', p_category, 'period', p_period, 'scope', v_scope,
    'since', v_since, 'branch', v_branch
  ) || coalesce(v_out, '{}'::jsonb);
end;
$$;
revoke all on function public.get_153_king_board(text, text, text, integer) from public, anon;
grant execute on function public.get_153_king_board(text, text, text, integer) to authenticated;

create or replace function public.get_153_king_summary(
  p_period text default 'weekly',
  p_scope text default 'branch'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cat text;
  v_board jsonb;
  v_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  foreach v_cat in array array['attendance', 'streak', 'early_bird', 'levelup', 'burpee', 'fitness', 'app', 'nickname'] loop
    v_board := public.get_153_king_board(v_cat, p_period, p_scope, 1);
    v_items := v_items || jsonb_build_object(
      'category', v_cat,
      'king', v_board -> 'board' -> 0,
      'me', v_board -> 'me',
      'total', v_board -> 'total'
    );
  end loop;
  return jsonb_build_object('period', p_period, 'scope', v_board ->> 'scope', 'since', v_board -> 'since', 'items', v_items);
end;
$$;
revoke all on function public.get_153_king_summary(text, text) from public, anon;
grant execute on function public.get_153_king_summary(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) 사이니지 TV2 런칭 이벤트 보드 (anon) — 지점 이름으로 ① 출석왕 ② 앱활동왕 ③ 닉네임왕
--    이번 달(KST) 기준. 지도진 제외. 개인정보는 표시 이름(닉네임 우선)만 내려준다.
create or replace function public.get_launch_event_board(p_branch text, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_since timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_cat text;
  v_items jsonb := '[]'::jsonb;
  v_rows jsonb;
  v_total integer;
begin
  if coalesce(btrim(p_branch), '') = '' then
    raise exception 'branch required';
  end if;
  foreach v_cat in array array['attendance', 'app', 'nickname'] loop
    with ranked as (
      select s.user_id, s.score,
             coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
             row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
        from public._king_scores(v_cat, v_since) s
        join public.profiles p on p.user_id = s.user_id
       where s.score > 0
         and coalesce(p.is_staff, false) = false
         and p.branch_name = p_branch
    )
    select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                       from (select * from ranked order by rnk limit v_limit) r), '[]'::jsonb),
           (select count(*) from ranked)
      into v_rows, v_total;
    v_items := v_items || jsonb_build_object('category', v_cat, 'board', v_rows, 'total', v_total);
  end loop;
  return jsonb_build_object('branch', p_branch, 'since', v_since, 'period', 'monthly', 'items', v_items);
end;
$$;
revoke all on function public.get_launch_event_board(text, integer) from public;
grant execute on function public.get_launch_event_board(text, integer) to anon, authenticated;
