-- 지도자 홈 — 코치 · 관장 · 관리자 홈 맨 위 (2026-11-26 대표님 「추천대로 가자」 · 선릉역점만 · 앱 규칙 r_ad42f1de95)
--   목표 = 신규 회원 재등록률 70% 이상 · 1순위 기간 임박 · 2순위 재미를 느끼기 어려운 신규 회원.
--   · 설정 app_settings.leader_home — branches = 켠 지점(빈 배열 = 끔) · 기간 임박 n일 · 끝난 뒤 n일 · 첫 4주 기준 · 사진 보관 날수.
--   · leader_contacts — 코치가 「이야기함 · 안내 보냄 · 처방함」을 누른 기록(누가 · 언제 · 무엇). 같은 회원에게 여러 코치가
--     같은 말을 하지 않게 화면에 「누가 · 언제」가 보인다. 함수로만.
--   · member_coach_photos + 비공개 저장소 coach-photos — 코치 화면용 얼굴 사진. 회원이 코치 휴대폰에서 동의를 누른 뒤 한 장.
--     그 지점 지도진 · 본사만 본다(다른 회원 · TV · 사이니지 없음). 얼굴 인식(출입) 데이터와 따로 둔다(인식에 쓰지 않음).
--     수강권이 끝나고 photo_keep_days(180일)가 지나면 크론이 지운다 · 코치에게 말하면 바로 지운다.
--   · leader_kpi — 신규 재등록률 숫자(Edge Function leader-kpi 가 153OS registration_report 로 계산해 넣는다 · 이름 없음).
--   · leader_member_flags — 「첫 수강권」 표시(같은 지점 · 같은 이름 대조 — 이름이 겹치면 표시하지 않음 · leader-kpi 가 넣는다).
--   · leader_home(p_branch) · leader_contact_save · leader_contact_undo · leader_photo_saved · leader_photo_remove
--   · 저장소 정책 도우미 can_access_coach_photo(name, write) — authenticated 실행 가능(정책에 쓰는 함수는 반드시 · CLAUDE.md)
--   · 서버 키 전용: leader_photo_cleanup_targets · leader_photo_mark_purged
--   · 크론 leader-kpi 매일 05:12 KST(20:12 UTC) → Edge Function leader-kpi(x-auto-key) — 재등록률 다시 계산 + 사진 정리.
--   기존 함수 · 표 · 출석 · 수강권은 건드리지 않는다(읽기만).

-- 1) 설정
insert into public.app_settings (key, value, updated_at)
values (
  'leader_home',
  jsonb_build_object(
    'note', '지도자 홈 (2026-11-26 대표님 「추천대로 가자」 · 선릉역점만). branches = 켠 지점(빈 배열 = 끔) · target_rate = 신규 재등록률 목표(%) · expiring_days = 기간 임박(수강권 끝나기 n일 안) · winback_days = 끝난 지 n일 안 · starter_days/starter_goal = 첫 4주 8번 · watch_days = 신규로 지켜보는 날수 · gap_days = n일 넘게 안 온 신규 · photo_keep_days = 수강권 끝나고 사진 보관 날수 · kpi_stale_hours = 재등록률 다시 계산 간격.',
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'start_date', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'target_rate', 70,
    'expiring_days', 14,
    'winback_days', 30,
    'starter_days', 28,
    'starter_goal', 8,
    'watch_days', 56,
    'gap_days', 7,
    'photo_keep_days', 180,
    'kpi_stale_hours', 6
  ),
  now()
)
on conflict (key) do nothing;

-- 2) 표
create table if not exists public.leader_contacts (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  member_user_id uuid not null,
  staff_user_id uuid not null,
  kind text not null check (kind in ('talk', 'notice', 'rx')),
  topic text not null check (topic in ('expiring', 'winback', 'starter')),
  rx text check (rx is null or rx in ('name', 'jab', 'promise', 'note', 'partner', 'level', 'other')),
  note text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index if not exists leader_contacts_member_idx on public.leader_contacts (member_user_id, created_at desc);
create index if not exists leader_contacts_branch_idx on public.leader_contacts (branch_name, created_at desc);
alter table public.leader_contacts enable row level security;
revoke all on table public.leader_contacts from anon, authenticated;
comment on table public.leader_contacts is
  '지도자 홈 — 코치가 회원에게 「이야기함(talk) · 안내 보냄(notice) · 처방함(rx)」을 누른 기록. topic = expiring(기간 임박) · winback(끝난 지 30일 안) · starter(신규). 지우기 = removed_at. 함수로만(leader_home · leader_contact_save · leader_contact_undo).';

create table if not exists public.member_coach_photos (
  user_id uuid primary key,
  branch_name text not null,
  path text not null,
  consent_version text not null,
  consent_at timestamptz not null,
  taken_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid,
  remove_reason text,
  purged_at timestamptz
);
alter table public.member_coach_photos enable row level security;
revoke all on table public.member_coach_photos from anon, authenticated;
comment on table public.member_coach_photos is
  '지도자 홈 코치용 얼굴 사진(비공개 저장소 coach-photos/<회원>/face.jpg) — 회원이 코치 휴대폰에서 동의(consent_version · consent_at) 뒤 코치(taken_by)가 찍는다. 그 지점 지도진 · 본사만. 얼굴 인식에 쓰지 않는다. 빼기 = removed_at · 저장소에서 지운 시각 = purged_at(크론 leader-kpi).';

create table if not exists public.leader_kpi (
  branch_name text primary key,
  payload jsonb not null,
  computed_at timestamptz not null default now()
);
alter table public.leader_kpi enable row level security;
revoke all on table public.leader_kpi from anon, authenticated;
comment on table public.leader_kpi is
  '지도자 홈 신규 재등록률 숫자 — Edge Function leader-kpi 가 153OS registration_report(매출 기록 · 같은 이름 대조 추정)로 계산해 넣는다. 이름 없이 숫자만. leader_home 이 읽는다.';

create table if not exists public.leader_member_flags (
  user_id uuid primary key,
  branch_name text not null,
  first_term boolean not null,
  paid_count integer not null default 0,
  first_paid_on date,
  last_paid_on date,
  updated_at timestamptz not null default now()
);
alter table public.leader_member_flags enable row level security;
revoke all on table public.leader_member_flags from anon, authenticated;
comment on table public.leader_member_flags is
  '지도자 홈 「첫 수강권」 표시 — leader-kpi 가 같은 지점 · 같은 이름(띄어쓰기 무시 · 앱에 같은 이름이 둘 이상이면 넣지 않음)으로 153OS 매출과 맞춘다. 최근 400일 수강권 결제 수(paid_count) · 첫 결제일 · 마지막 결제일.';

-- 3) 비공개 저장소
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-photos', 'coach-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4) 안쪽 도우미
create or replace function public._leader_conf()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'leader_home'), '{}'::jsonb)
$$;

create or replace function public._leader_branch_on(_branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _branch is not null
     and _branch in (select jsonb_array_elements_text(coalesce(public._leader_conf() -> 'branches', '[]'::jsonb)))
$$;

-- 이 사람이 이 지점 지도진(코치 · 관장)이거나 본사(전체관리자 · 관리자)인가
create or replace function public._leader_can(_uid uuid, _branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _uid is not null and _branch is not null and (
    public._strategy_hq(_uid)
    or exists (select 1 from public._strategy_branch_staff(_branch) s where s.user_id = _uid)
  )
$$;

-- 지도자 홈 명단에 드는 회원인가 (그 지점 · 코치/운영진/체험/합쳐진 계정 제외 — 동기부여 1단계와 같은 기준)
create or replace function public._leader_member_ok(_uid uuid, _branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _uid is not null and exists (
    select 1
      from public.profiles p
     where p.user_id = _uid
       and p.branch_name = _branch
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
       )
  )
$$;

-- 저장소 정책 도우미 — 이름은 '<회원 uuid>/face.jpg' 한 가지. 그 회원 지점 지도진 · 본사만.
--   _write = 올리기 · 바꾸기(켠 지점 회원만) / 아니면 보기 · 지우기(끈 지점이어도 정리할 수 있게)
create or replace function public.can_access_coach_photo(_name text, _write boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(_name, '');
  v_member uuid;
  v_branch text;
begin
  if auth.uid() is null
     or v_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/face\.jpg$' then
    return false;
  end if;
  v_member := split_part(v_name, '/', 1)::uuid;
  select p.branch_name into v_branch from public.profiles p where p.user_id = v_member;
  if v_branch is null then
    return public._strategy_hq(auth.uid()) and not _write;
  end if;
  if _write and not (public._leader_branch_on(v_branch) and public._leader_member_ok(v_member, v_branch)) then
    return false;
  end if;
  return coalesce(public._leader_can(auth.uid(), v_branch), false);
end
$$;

drop policy if exists coach_photos_select on storage.objects;
create policy coach_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'coach-photos' and public.can_access_coach_photo(name, false));
drop policy if exists coach_photos_insert on storage.objects;
create policy coach_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-photos' and public.can_access_coach_photo(name, true));
drop policy if exists coach_photos_update on storage.objects;
create policy coach_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'coach-photos' and public.can_access_coach_photo(name, true))
  with check (bucket_id = 'coach-photos' and public.can_access_coach_photo(name, true));
drop policy if exists coach_photos_delete on storage.objects;
create policy coach_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-photos' and public.can_access_coach_photo(name, false));

-- 5) 지도자 홈 — 한 번에 (숫자 · 기간 임박 · 끝난 지 30일 안 · 재미 위험 신규 · 관장 · 관리자 칸)
--   회원 · 다른 사람이 부르면 조용히 {on:false} (화면은 안 그림). 본사는 지점을 고를 수 있다.
create or replace function public.leader_home(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  c jsonb := public._leader_conf();
  v_branches jsonb := coalesce(c -> 'branches', '[]'::jsonb);
  v_hq boolean;
  v_role text;
  v_branch text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day0 timestamptz;
  v_exp integer;
  v_win integer;
  v_sd integer;
  v_goal integer;
  v_watch integer;
  v_gap integer;
  v_stale integer;
  v_lists jsonb;
  v_team jsonb := null;
  v_admin jsonb := null;
  v_kpi jsonb := null;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_hq := public._strategy_hq(v_me);
  if v_hq then
    v_role := 'admin';
    v_branch := coalesce(
      nullif(trim(p_branch), ''),
      (select p.branch_name from public.profiles p where p.user_id = v_me and public._leader_branch_on(p.branch_name)),
      (select x from jsonb_array_elements_text(v_branches) x limit 1)
    );
  else
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null or not exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_me) then
      return jsonb_build_object('on', false, 'role', 'none');
    end if;
    v_role := case when public.has_role(v_me, 'branch_manager') then 'manager' else 'coach' end;
  end if;
  if not public._leader_branch_on(v_branch) then
    return jsonb_build_object('on', false, 'role', v_role, 'branch', v_branch, 'branches', v_branches);
  end if;

  v_exp := greatest(1, coalesce((c ->> 'expiring_days')::integer, 14));
  v_win := greatest(1, coalesce((c ->> 'winback_days')::integer, 30));
  v_sd := greatest(7, coalesce((c ->> 'starter_days')::integer, 28));
  v_goal := greatest(1, coalesce((c ->> 'starter_goal')::integer, 8));
  v_watch := greatest(v_sd, coalesce((c ->> 'watch_days')::integer, 56));
  v_gap := greatest(3, coalesce((c ->> 'gap_days')::integer, 7));
  v_stale := greatest(1, coalesce((c ->> 'kpi_stale_hours')::integer, 6));
  v_day0 := v_today::timestamp at time zone 'Asia/Seoul';

  with m as (
    select p.user_id, p.name, p.nickname, p.avatar_url, p.membership_end
      from public.profiles p
     where p.branch_name = v_branch
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and p.merged_into is null
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = p.user_id and r.role::text in ('coach', 'branch_manager', 'admin', 'super_admin')
       )
  ), days as (
    select a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as day
      from public.attendance_logs a
      join m on m.user_id = a.user_id
     where not coalesce(a.is_duplicate, false) and a.checked_in_at is not null
     group by 1, 2
  ), st as (
    select d.user_id, min(d.day) as first_day, max(d.day) as last_day, count(*)::integer as total,
           (count(*) filter (where d.day >= v_today - 13))::integer as v14
      from days d group by d.user_id
  ), tod as (
    -- 오늘 들어온 시각 · 지금 체육관(2시간 안에 들어오고 아직 안 끝남 — 추정)
    select a.user_id, max(a.checked_in_at) as came_at,
           bool_or(a.checked_in_at > now() - interval '2 hours' and (a.ended_at is null or a.ended_at > now())) as here
      from public.attendance_logs a
      join m on m.user_id = a.user_id
     where not coalesce(a.is_duplicate, false) and a.checked_in_at >= v_day0
     group by a.user_id
  ), lc as (
    select distinct on (l.member_user_id)
           l.member_user_id, l.id, l.kind, l.topic, l.rx, l.created_at, l.staff_user_id,
           coalesce(nullif(trim(sp.name), ''), nullif(trim(sp.nickname), ''), '코치') as staff_name
      from public.leader_contacts l
      left join public.profiles sp on sp.user_id = l.staff_user_id
     where l.branch_name = v_branch and l.removed_at is null and l.created_at >= now() - interval '21 days'
     order by l.member_user_id, l.created_at desc
  ), b as (
    select m.user_id, m.name, m.nickname, m.avatar_url, m.membership_end,
           st.first_day, st.last_day, coalesce(st.total, 0) as total, coalesce(st.v14, 0) as v14,
           tod.came_at, coalesce(tod.here, false) as here,
           ph.path as photo_path, fl.first_term,
           lc.id as lc_id, lc.kind as lc_kind, lc.topic as lc_topic, lc.rx as lc_rx, lc.created_at as lc_at,
           lc.staff_user_id as lc_staff, lc.staff_name as lc_by
      from m
      left join st on st.user_id = m.user_id
      left join tod on tod.user_id = m.user_id
      left join public.member_coach_photos ph on ph.user_id = m.user_id and ph.removed_at is null
      left join public.leader_member_flags fl on fl.user_id = m.user_id and fl.branch_name = v_branch
      left join lc on lc.member_user_id = m.user_id
  ), j as (
    select b.*,
           jsonb_build_object(
             'user_id', b.user_id,
             'name', coalesce(nullif(trim(b.nickname), ''), b.name, '회원'),
             'real_name', b.name,
             'avatar_url', b.avatar_url,
             'photo_path', b.photo_path,
             'first_term', b.first_term,
             'first_day', b.first_day,
             'last_day', b.last_day,
             'total', b.total,
             'v14', b.v14,
             'came_at', b.came_at,
             'here', b.here,
             'end', b.membership_end,
             'contact', case when b.lc_id is null then null else jsonb_build_object(
               'id', b.lc_id, 'kind', b.lc_kind, 'topic', b.lc_topic, 'rx', b.lc_rx, 'at', b.lc_at,
               'by', b.lc_by, 'mine', b.lc_staff = v_me) end
           ) as base
      from b
  ), sw as (
    -- 신규로 지켜보는 회원(첫 출석 watch_days 안) — 첫 4주 출석 수 · 속도
    select j.user_id, j.base, j.first_day, j.last_day, j.v14, j.came_at, j.here,
           (v_today - j.first_day + 1) as dayn,
           (select count(*)::integer from days d
             where d.user_id = j.user_id and d.day between j.first_day and j.first_day + (v_sd - 1)) as c28,
           exists (select 1 from public.motivation_awards x where x.user_id = j.user_id and x.kind = 'starter') as done8
      from j
     where j.first_day is not null and j.first_day >= v_today - (v_watch - 1)
  ), sr as (
    select sw.*,
           case when sw.dayn <= v_sd then floor(sw.dayn * v_goal::numeric / v_sd)::integer else v_goal end as expected,
           (v_today - sw.last_day) as gapn
      from sw
  ), sx as (
    select sr.*,
           array_remove(array[
             case when sr.first_day = v_today then 'first' end,
             case when sr.dayn <= v_sd and sr.first_day < v_today and sr.c28 < floor(sr.dayn * v_goal::numeric / v_sd) then 'behind' end,
             case when (v_today - sr.last_day) >= v_gap then 'gap' end,
             case when sr.dayn > v_sd and sr.v14 < 4 and (v_today - sr.last_day) < v_gap then 'slow' end
           ], null) as reasons
      from sr
  )
  select jsonb_build_object(
    'expiring', coalesce((select jsonb_agg(j.base || jsonb_build_object('days_left', j.membership_end - v_today)
                                           order by j.membership_end, j.name)
                            from j where j.membership_end between v_today and v_today + v_exp), '[]'::jsonb),
    'winback', coalesce((select jsonb_agg(j.base || jsonb_build_object('days_since', v_today - j.membership_end)
                                          order by j.membership_end desc, j.name)
                           from j where j.membership_end between v_today - v_win and v_today - 1), '[]'::jsonb),
    'starters', coalesce((select jsonb_agg(sx.base || jsonb_build_object(
                                   'day', sx.dayn, 'count', sx.c28, 'expected', sx.expected, 'goal', v_goal,
                                   'gap', sx.gapn, 'done8', sx.done8, 'reasons', to_jsonb(sx.reasons))
                                   order by sx.here desc, sx.first_day desc)
                            from sx where cardinality(sx.reasons) > 0), '[]'::jsonb),
    'counts', jsonb_build_object(
      'expiring', (select count(*) from j where j.membership_end between v_today and v_today + v_exp),
      'expiring_first', (select count(*) from j where j.membership_end between v_today and v_today + v_exp and j.first_term),
      'winback', (select count(*) from j where j.membership_end between v_today - v_win and v_today - 1),
      'starters', (select count(*) from sw where sw.dayn <= v_sd),
      'starters_behind', (select count(*) from sx where 'behind' = any(sx.reasons)),
      'risk', (select count(*) from sx where cardinality(sx.reasons) > 0),
      'here', (select count(*) from j where j.here),
      'active', (select count(*) from j where j.membership_end >= v_today),
      'photos', (select count(*) from j where j.membership_end >= v_today and j.photo_path is not null),
      'avatars', (select count(*) from j where j.membership_end >= v_today and j.photo_path is null and nullif(j.avatar_url, '') is not null),
      'untouched_d3', (select count(*) from j
                        where j.membership_end between v_today and v_today + 3
                          and j.lc_id is null),
      'today_contacts', (select count(*) from public.leader_contacts l
                          where l.branch_name = v_branch and l.removed_at is null and l.created_at >= v_day0)
    )
  ) into v_lists;

  -- 관장 · 관리자 칸 — 이번 주(7일) 코치별 기록
  if v_role in ('manager', 'admin') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'staff_user_id', x.staff_user_id, 'name', x.name,
             'talk', x.talk, 'notice', x.notice, 'rx', x.rx, 'total', x.total) order by x.total desc, x.name), '[]'::jsonb)
      into v_team
      from (
        select l.staff_user_id,
               coalesce(nullif(trim(p.name), ''), nullif(trim(p.nickname), ''), '코치') as name,
               count(*) filter (where l.kind = 'talk')::integer as talk,
               count(*) filter (where l.kind = 'notice')::integer as notice,
               count(*) filter (where l.kind = 'rx')::integer as rx,
               count(*)::integer as total
          from public.leader_contacts l
          left join public.profiles p on p.user_id = l.staff_user_id
         where l.branch_name = v_branch and l.removed_at is null and l.created_at >= now() - interval '7 days'
         group by l.staff_user_id, p.name, p.nickname
      ) x;
  end if;

  -- 관리자 칸 — 지점 고르기 · 출석 동기화 시각
  if v_role = 'admin' then
    v_admin := jsonb_build_object(
      'branches', (select coalesce(jsonb_agg(jsonb_build_object('name', b.name, 'on', public._leader_branch_on(b.name)) order by b.name), '[]'::jsonb)
                     from public.branches b where coalesce(b.is_visible, true) or public._leader_branch_on(b.name)),
      'sync_at', (select max(a.created_at) from public.attendance_logs a where a.branch_name = v_branch)
    );
  end if;

  select jsonb_build_object(
           'payload', k.payload,
           'computed_at', k.computed_at,
           'stale', k.computed_at < now() - make_interval(hours => v_stale))
    into v_kpi
    from public.leader_kpi k
   where k.branch_name = v_branch;

  return jsonb_build_object(
    'on', true,
    'role', v_role,
    'branch', v_branch,
    'branches', v_branches,
    'today', v_today,
    'conf', jsonb_build_object(
      'target_rate', greatest(1, least(100, coalesce((c ->> 'target_rate')::integer, 70))),
      'expiring_days', v_exp, 'winback_days', v_win, 'starter_days', v_sd, 'starter_goal', v_goal,
      'watch_days', v_watch, 'gap_days', v_gap),
    'expiring', v_lists -> 'expiring',
    'winback', v_lists -> 'winback',
    'starters', v_lists -> 'starters',
    'counts', v_lists -> 'counts',
    'kpi', v_kpi,
    'team', v_team,
    'admin', v_admin
  );
end
$$;

-- 6) 「이야기함 · 안내 보냄 · 처방함」 — 같은 사람이 같은 회원에게 같은 기록을 10분 안에 또 누르면 한 줄로
create or replace function public.leader_contact_save(
  p_member uuid,
  p_kind text,
  p_topic text,
  p_rx text default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_branch text;
  v_id uuid;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 80), '');
  v_rx text := case when p_kind = 'rx' then p_rx else null end;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('talk', 'notice', 'rx')
     or p_topic is null or p_topic not in ('expiring', 'winback', 'starter') then
    raise exception '잘못된 값이에요' using errcode = '22023';
  end if;
  if p_kind = 'rx' and (p_rx is null or p_rx not in ('name', 'jab', 'promise', 'note', 'partner', 'level', 'other')) then
    raise exception '처방을 골라 주세요' using errcode = '22023';
  end if;
  select p.branch_name into v_branch from public.profiles p where p.user_id = p_member;
  if not public._leader_branch_on(v_branch) or not public._leader_member_ok(p_member, v_branch) then
    raise exception '지도자 홈을 켠 지점 회원이 아니에요' using errcode = '42501';
  end if;
  if not public._leader_can(v_me, v_branch) then
    raise exception '지점 지도진만 남길 수 있어요' using errcode = '42501';
  end if;

  select l.id into v_id
    from public.leader_contacts l
   where l.member_user_id = p_member and l.staff_user_id = v_me and l.kind = p_kind
     and l.removed_at is null and l.created_at > now() - interval '10 minutes'
   order by l.created_at desc
   limit 1;
  if v_id is not null then
    update public.leader_contacts
       set topic = p_topic, rx = v_rx, note = coalesce(v_note, note), created_at = now()
     where id = v_id;
  else
    insert into public.leader_contacts (branch_name, member_user_id, staff_user_id, kind, topic, rx, note)
    values (v_branch, p_member, v_me, p_kind, p_topic, v_rx, v_note)
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;

-- 잘못 누른 것 되돌리기 — 내가 남긴 것만 · 24시간 안 (본사는 언제든)
create or replace function public.leader_contact_undo(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.leader_contacts%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.leader_contacts l where l.id = p_id and l.removed_at is null;
  if not found then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if not (public._strategy_hq(v_me) or (v_row.staff_user_id = v_me and v_row.created_at > now() - interval '24 hours')) then
    raise exception '내가 남긴 기록만 24시간 안에 되돌릴 수 있어요' using errcode = '42501';
  end if;
  update public.leader_contacts set removed_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end
$$;

-- 7) 코치용 사진 — 저장소에 올린 뒤 부른다(회원 동의 시각 = 지금). 이름은 서버가 정한다.
create or replace function public.leader_photo_saved(p_member uuid, p_consent_version text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_branch text;
  v_path text := p_member::text || '/face.jpg';
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_consent_version is null or p_consent_version not in ('coach-photo-v1') then
    raise exception '동의 문구 판이 맞지 않아요' using errcode = '22023';
  end if;
  select p.branch_name into v_branch from public.profiles p where p.user_id = p_member;
  if not public._leader_branch_on(v_branch) or not public._leader_member_ok(p_member, v_branch) then
    raise exception '지도자 홈을 켠 지점 회원이 아니에요' using errcode = '42501';
  end if;
  if not public._leader_can(v_me, v_branch) then
    raise exception '지점 지도진만 사진을 남길 수 있어요' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'coach-photos' and o.name = v_path) then
    raise exception '사진이 아직 올라가지 않았어요' using errcode = 'P0002';
  end if;
  insert into public.member_coach_photos (user_id, branch_name, path, consent_version, consent_at, taken_by)
  values (p_member, v_branch, v_path, p_consent_version, now(), v_me)
  on conflict (user_id) do update
    set branch_name = excluded.branch_name,
        path = excluded.path,
        consent_version = excluded.consent_version,
        consent_at = excluded.consent_at,
        taken_by = excluded.taken_by,
        updated_at = now(),
        removed_at = null,
        removed_by = null,
        remove_reason = null,
        purged_at = null;
  return jsonb_build_object('ok', true, 'path', v_path);
end
$$;

-- 사진 빼기 — 그 지점 지도진 · 본사 · 회원 본인. 저장소 파일은 부른 쪽이 지우고(정책), 못 지운 것은 크론이 지운다.
create or replace function public.leader_photo_remove(p_member uuid, p_reason text default 'staff')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.member_coach_photos%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.member_coach_photos x where x.user_id = p_member;
  if not found then
    return jsonb_build_object('ok', true, 'path', null);
  end if;
  if not (v_me = p_member or public._leader_can(v_me, v_row.branch_name)) then
    raise exception '지점 지도진이나 회원 본인만 뺄 수 있어요' using errcode = '42501';
  end if;
  update public.member_coach_photos
     set removed_at = coalesce(removed_at, now()),
         removed_by = coalesce(removed_by, v_me),
         remove_reason = coalesce(remove_reason, case when v_me = p_member then 'member' else left(coalesce(nullif(btrim(p_reason), ''), 'staff'), 40) end),
         updated_at = now()
   where user_id = p_member;
  return jsonb_build_object('ok', true, 'path', v_row.path);
end
$$;

-- 8) 서버 키 전용 — 사진 정리(크론 leader-kpi): 뺀 사진 · 수강권 끝나고 보관 날수가 지난 사진 · 지점을 떠난 회원
create or replace function public.leader_photo_cleanup_targets(_limit integer default 200)
returns table(user_id uuid, path text, reason text)
language sql
stable
security definer
set search_path = public
as $$
  with conf as (
    select greatest(30, coalesce((public._leader_conf() ->> 'photo_keep_days')::integer, 180)) as keep_days,
           (now() at time zone 'Asia/Seoul')::date as today
  )
  select x.user_id, x.path,
         case
           when x.removed_at is not null then 'removed'
           when p.user_id is null or p.merged_into is not null or p.branch_name is distinct from x.branch_name
                or coalesce(p.is_staff, false) then 'left'
           else 'expired'
         end as reason
    from public.member_coach_photos x
    cross join conf
    left join public.profiles p on p.user_id = x.user_id
   where x.purged_at is null
     and (
       x.removed_at is not null
       or p.user_id is null
       or p.merged_into is not null
       or p.branch_name is distinct from x.branch_name
       or coalesce(p.is_staff, false)
       or (p.membership_end is not null and p.membership_end < conf.today - conf.keep_days)
       or (p.membership_end is null and x.consent_at < now() - make_interval(days => conf.keep_days))
     )
   order by x.updated_at
   limit greatest(1, least(coalesce(_limit, 200), 1000))
$$;

create or replace function public.leader_photo_mark_purged(_user_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.member_coach_photos
     set purged_at = now(),
         removed_at = coalesce(removed_at, now()),
         remove_reason = coalesce(remove_reason, 'auto'),
         updated_at = now()
   where user_id = any(coalesce(_user_ids, '{}'::uuid[])) and purged_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- 9) 권한
revoke all on function public._leader_conf() from public, anon, authenticated;
revoke all on function public._leader_branch_on(text) from public, anon, authenticated;
revoke all on function public._leader_can(uuid, text) from public, anon, authenticated;
revoke all on function public._leader_member_ok(uuid, text) from public, anon, authenticated;
revoke all on function public.leader_photo_cleanup_targets(integer) from public, anon, authenticated;
revoke all on function public.leader_photo_mark_purged(uuid[]) from public, anon, authenticated;
revoke all on function public.can_access_coach_photo(text, boolean) from public, anon;
revoke all on function public.leader_home(text) from public, anon;
revoke all on function public.leader_contact_save(uuid, text, text, text, text) from public, anon;
revoke all on function public.leader_contact_undo(uuid) from public, anon;
revoke all on function public.leader_photo_saved(uuid, text) from public, anon;
revoke all on function public.leader_photo_remove(uuid, text) from public, anon;
grant execute on function public.can_access_coach_photo(text, boolean) to authenticated;
grant execute on function public.leader_home(text) to authenticated;
grant execute on function public.leader_contact_save(uuid, text, text, text, text) to authenticated;
grant execute on function public.leader_contact_undo(uuid) to authenticated;
grant execute on function public.leader_photo_saved(uuid, text) to authenticated;
grant execute on function public.leader_photo_remove(uuid, text) to authenticated;

-- 10) 크론 — 매일 05:12 KST 재등록률 다시 계산 + 사진 정리 (다른 크론 함수와 같은 x-auto-key)
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'leader-kpi') then
    perform cron.unschedule('leader-kpi');
  end if;
  perform cron.schedule(
    'leader-kpi',
    '12 20 * * *',
    $cron$
    select net.http_post(
      url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/leader-kpi',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 120000);
    $cron$
  );
end
$do$;
