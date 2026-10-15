-- 153 TEST (153 체력테스트) 기록 (2026-10-15 대표님: "하이록스처럼 153 체력테스트 — 기록 체크, 얼마나 좋아졌는지, 나중에 대회")
--   종목(기획안 확정): 8라운드 × (셀트런 100m → 스테이션)
--     버피 30 · 원·투·쓰리 스텝 10세트 · 스쿼트 50 · 푸시업 30 · 복서 스텝 콤비 10세트 · 싯업 40 · 런지 40 · 줄넘기 200
--   구간 = 16개(셀트런1, 스테이션1, … 셀트런8, 스테이션8) — splits_ms 에 구간별 걸린 시간(ms)
--   타임캡 25분: 끝내지 못하면 점수 = 25:00 + 남은 동작 수 × 1초 → 완주한 사람은 항상 못 한 사람보다 앞
--   부문: starter(입문 · 개수 절반) / open(기본)
--   공식 기록 = 코치·지점장(같은 지점) 또는 전체관리자가 측정 화면에서 저장한 것만. 회원이 직접 넣는 길은 없다.
--   순위 = 회원마다 부문별 최고 기록 1개. 지도진·테스트 계정·관리자 계정은 순위에서 뺀다(다른 랭킹과 같은 규칙).

create table if not exists public.test153_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  branch_name text,
  division text not null check (division in ('starter', 'open')),
  gender text check (gender in ('남', '여')),
  age_group text,
  splits_ms integer[] not null,
  total_ms integer not null check (total_ms > 0),
  finished boolean not null default true,
  remaining_reps integer not null default 0 check (remaining_reps >= 0),
  score_ms integer generated always as (case when finished then total_ms else 1500000 + remaining_reps * 1000 end) stored,
  official boolean not null default true,
  coach_id uuid not null,
  note text,
  measured_at timestamptz not null default now()
);

create index if not exists test153_records_user_idx on public.test153_records (user_id, division, measured_at desc);
create index if not exists test153_records_rank_idx on public.test153_records (division, score_ms) where official;

alter table public.test153_records enable row level security;

-- 읽기: 본인 기록 · 같은 지점 코치/지점장 · 관리자. 쓰기는 아래 함수로만.
do $$ begin
  create policy "test153 read own or staff" on public.test153_records for select to authenticated
    using (
      user_id = (select auth.uid())
      or public.has_role((select auth.uid()), 'super_admin'::app_role)
      or public.has_role((select auth.uid()), 'admin'::app_role)
      or (
        (public.has_role((select auth.uid()), 'branch_manager'::app_role) or public.has_role((select auth.uid()), 'coach'::app_role))
        and branch_name = (select p.branch_name from public.profiles p where p.user_id = (select auth.uid()))
      )
    );
exception when duplicate_object then null; end $$;

/** 측정할 수 있는 사람인가 — 전체관리자, 또는 회원과 같은 지점의 코치·지점장 */
create or replace function public.can_measure_test153(_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'super_admin'::app_role)
      or public.has_role(auth.uid(), 'admin'::app_role)
      or (
        (public.has_role(auth.uid(), 'branch_manager'::app_role) or public.has_role(auth.uid(), 'coach'::app_role))
        and exists (
          select 1 from public.profiles me join public.profiles m on m.branch_name = me.branch_name
           where me.user_id = auth.uid() and m.user_id = _member
        )
      );
$$;
revoke all on function public.can_measure_test153(uuid) from public, anon;
grant execute on function public.can_measure_test153(uuid) to authenticated;

create or replace function public.test153_age_group(_birth text)
returns text language sql immutable as $$
  select case
    when _birth is null or _birth !~ '^\d{4}' then null
    when extract(year from now())::int - left(_birth, 4)::int < 20 then '10대'
    when extract(year from now())::int - left(_birth, 4)::int < 30 then '20대'
    when extract(year from now())::int - left(_birth, 4)::int < 40 then '30대'
    when extract(year from now())::int - left(_birth, 4)::int < 50 then '40대'
    else '50대+'
  end;
$$;

/**
 * 코치 측정 화면 '공식 기록으로 저장'.
 *   p_splits_ms: 구간별 걸린 시간. 완주면 16개, 타임캡이면 그때까지 한 구간들(마지막은 하던 구간).
 *   돌려주는 것: id · 점수 · 이번이 개인 최고(PB)인지 · 그 전 PB
 */
create or replace function public.save_test153_record(
  p_user_id uuid,
  p_division text,
  p_gender text,
  p_splits_ms integer[],
  p_finished boolean,
  p_remaining_reps integer default 0,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_branch text;
  v_birth text;
  v_total integer;
  v_prev integer;
  v_id uuid;
  v_score integer;
  v_gender text := nullif(btrim(coalesce(p_gender, '')), '');
begin
  if auth.uid() is null or not public.can_measure_test153(p_user_id) then
    raise exception '측정 권한이 없어요 (같은 지점 코치·지점장만)';
  end if;
  if p_division not in ('starter', 'open') then raise exception '부문이 잘못됐어요'; end if;
  if v_gender is not null and v_gender not in ('남', '여') then raise exception '성별이 잘못됐어요'; end if;
  if p_splits_ms is null or array_length(p_splits_ms, 1) is null or array_length(p_splits_ms, 1) > 16 then
    raise exception '구간 기록이 잘못됐어요';
  end if;
  if p_finished and array_length(p_splits_ms, 1) <> 16 then raise exception '완주 기록은 16구간이어야 해요'; end if;
  if exists (select 1 from unnest(p_splits_ms) s where s is null or s < 0) then raise exception '구간 시간이 잘못됐어요'; end if;

  select coalesce(sum(s), 0) into v_total from unnest(p_splits_ms) s;
  if p_finished then
    if v_total < 180000 or v_total > 1500000 then raise exception '완주 시간은 3분~25분 사이여야 해요'; end if;
  else
    v_total := 1500000;
    if coalesce(p_remaining_reps, 0) <= 0 then raise exception '타임캡이면 남은 동작 수를 넣어 주세요'; end if;
  end if;

  select p.branch_name, p.birth_date, coalesce(v_gender, p.gender)
    into v_branch, v_birth, v_gender
    from public.profiles p where p.user_id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없어요'; end if;
  if v_gender not in ('남', '여') then v_gender := null; end if;

  -- 성별이 비어 있는 회원은 측정 때 고른 성별을 프로필에도 채운다
  if v_gender is not null then
    update public.profiles set gender = v_gender where user_id = p_user_id and gender is null;
  end if;

  select min(score_ms) into v_prev from public.test153_records
   where user_id = p_user_id and division = p_division and official;

  insert into public.test153_records (user_id, branch_name, division, gender, age_group, splits_ms, total_ms,
                                      finished, remaining_reps, coach_id, note)
  values (p_user_id, v_branch, p_division, v_gender, public.test153_age_group(v_birth), p_splits_ms, v_total,
          p_finished, case when p_finished then 0 else p_remaining_reps end, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  returning id, score_ms into v_id, v_score;

  return jsonb_build_object('id', v_id, 'score_ms', v_score, 'is_pb', v_prev is null or v_score < v_prev, 'prev_pb_ms', v_prev);
end $$;
revoke all on function public.save_test153_record(uuid, text, text, integer[], boolean, integer, text) from public, anon;
grant execute on function public.save_test153_record(uuid, text, text, integer[], boolean, integer, text) to authenticated;

/** 잘못 잰 기록 취소 — 공식에서 내린다(지우지 않음). 같은 지점 코치·지점장·관리자, 7일 안 */
create or replace function public.void_test153_record(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_at timestamptz;
begin
  select user_id, measured_at into v_user, v_at from public.test153_records where id = p_id;
  if not found then raise exception '기록을 찾을 수 없어요'; end if;
  if not public.can_measure_test153(v_user) then raise exception '취소 권한이 없어요'; end if;
  if v_at < now() - interval '7 days'
     and not (public.has_role(auth.uid(), 'super_admin'::app_role) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception '7일이 지난 기록은 전체관리자만 취소할 수 있어요';
  end if;
  update public.test153_records set official = false where id = p_id;
end $$;
revoke all on function public.void_test153_record(uuid) from public, anon;
grant execute on function public.void_test153_record(uuid) to authenticated;

/** 순위에 드는 회원 — 다른 랭킹과 같은 제외 규칙 */
create or replace function public.test153_rankable(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.user_id = _user
       and coalesce(p.is_staff, false) = false
       and not coalesce(p.is_test_account, false)
  ) and not exists (
    select 1 from public.user_roles ur where ur.user_id = _user and ur.role in ('super_admin', 'admin', 'branch_manager', 'coach')
  );
$$;

/**
 * 153 TEST 순위 — 회원마다 부문별 최고 기록 하나.
 *   p_branch: null = 켜진 지점 전체 / p_gender · p_age: null = 전체
 */
create or replace function public.get_test153_ranking(
  p_division text default 'open',
  p_branch text default null,
  p_gender text default null,
  p_age text default null,
  p_limit integer default 50
) returns table(r_position bigint, r_user_id uuid, r_nickname text, r_avatar_url text, r_branch_name text,
                r_score_ms integer, r_finished boolean, r_remaining_reps integer, r_gender text, r_age_group text,
                r_measured_at timestamptz)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (r.user_id) r.*
      from public.test153_records r
     where r.official and r.division = p_division
       and public.test153_rankable(r.user_id)
     order by r.user_id, r.score_ms asc, r.measured_at asc
  )
  select row_number() over (order by b.score_ms asc, b.measured_at asc),
         b.user_id,
         coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'),
         p.avatar_url, p.branch_name, b.score_ms, b.finished, b.remaining_reps, b.gender, b.age_group, b.measured_at
    from best b
    join public.profiles p on p.user_id = b.user_id
   where (p_branch is null and public.is_branch_visible(p.branch_name) or p.branch_name = p_branch)
     and (p_gender is null or b.gender = p_gender)
     and (p_age is null or b.age_group = p_age)
   order by 1
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke all on function public.get_test153_ranking(text, text, text, text, integer) from public, anon;
grant execute on function public.get_test153_ranking(text, text, text, text, integer) to authenticated;

/**
 * 내 기록(회원) — 관리자는 p_user_id 로 그 회원 것
 *   { records: [...최근순], best: {starter: {...}, open: {...}}, rank: {open: {branch, branch_total, all, all_total}, ...} }
 */
create or replace function public.get_test153_summary(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_branch text;
  v_records jsonb;
  v_best jsonb := '{}'::jsonb;
  v_rank jsonb := '{}'::jsonb;
  d text;
  v_pb record;
  v_branch_pos bigint; v_branch_total bigint; v_all_pos bigint; v_all_total bigint;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if v_user <> auth.uid() and not public.can_measure_test153(v_user) then raise exception '볼 수 없는 기록이에요'; end if;

  select branch_name into v_branch from public.profiles where user_id = v_user;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'division', r.division, 'score_ms', r.score_ms, 'total_ms', r.total_ms,
           'finished', r.finished, 'remaining_reps', r.remaining_reps, 'splits_ms', to_jsonb(r.splits_ms),
           'measured_at', r.measured_at, 'note', r.note,
           'coach_name', coalesce(nullif(btrim(c.name), ''), nullif(btrim(c.nickname), ''), '코치'))
           order by r.measured_at desc), '[]'::jsonb)
    into v_records
    from public.test153_records r
    left join public.profiles c on c.user_id = r.coach_id
   where r.user_id = v_user and r.official;

  foreach d in array array['starter', 'open'] loop
    select r.id, r.score_ms, r.finished, r.remaining_reps, r.splits_ms, r.measured_at
      into v_pb
      from public.test153_records r
     where r.user_id = v_user and r.division = d and r.official
     order by r.score_ms asc, r.measured_at asc limit 1;
    if found then
      v_best := v_best || jsonb_build_object(d, jsonb_build_object(
        'id', v_pb.id, 'score_ms', v_pb.score_ms, 'finished', v_pb.finished, 'remaining_reps', v_pb.remaining_reps,
        'splits_ms', to_jsonb(v_pb.splits_ms), 'measured_at', v_pb.measured_at));
      if public.test153_rankable(v_user) then
        select max(case when r_user_id = v_user then r_position end), count(*)
          into v_branch_pos, v_branch_total
          from public.get_test153_ranking(d, v_branch, null, null, 200);
        select max(case when r_user_id = v_user then r_position end), count(*)
          into v_all_pos, v_all_total
          from public.get_test153_ranking(d, null, null, null, 200);
        v_rank := v_rank || jsonb_build_object(d, jsonb_build_object(
          'branch', v_branch_pos, 'branch_total', v_branch_total, 'all', v_all_pos, 'all_total', v_all_total));
      end if;
    end if;
  end loop;

  return jsonb_build_object('records', v_records, 'best', v_best, 'rank', v_rank, 'branch_name', v_branch);
end $$;
revoke all on function public.get_test153_summary(uuid) from public, anon;
grant execute on function public.get_test153_summary(uuid) to authenticated;
