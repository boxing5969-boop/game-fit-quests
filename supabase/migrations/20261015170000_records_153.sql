-- 153 레코드 (2026-10-15 대표님: "세계적 기업이 될 153복싱짐의 역사적인 순간 기록 —
-- 최초 가입자 · 최초 레벨 10 · 최초 레벨 11 · 153 체력테스트 최초 기록 보유자 등등")
--   · records_153 — '최초' 기록은 한 번 새겨지면 바뀌지 않는다 (탈퇴·레벨 조정이 있어도 역사 그대로)
--   · get_153_records() — 비어 있는 기록만 지금 데이터로 채운 뒤(refresh) 돌려준다. 예약 작업 없음.
--     달성 시각은 '처음 연 시각'이 아니라 실제 달성 시각(출석·레벨 기록·아레나 기록 시각)이다.
--   · 체력테스트 신기록(종목별 최고)은 계속 바뀌는 기록이라 저장하지 않고 그때그때 계산한다.
--     직접 입력 기록이라 종목별 상한(상급 목표 × 3)을 둔다 — 153 킹 보드 버피왕과 같은 규칙.
--   · 대상 회원 = 랭킹과 같음: 켜진 지점 · 지도진/테스트 계정 아님 · 관리자 계정 아님

create table if not exists public.records_153 (
  record_key  text primary key,
  user_id     uuid not null,
  achieved_at timestamptz not null,
  value       numeric,
  locked_at   timestamptz not null default now()
);
alter table public.records_153 enable row level security;
-- 정책 없음: 읽기·쓰기는 아래 함수로만

create or replace function public.refresh_153_records()
returns void language sql security definer set search_path to 'public' as $$
  with elig as (
    select p.user_id, p.created_at
      from public.profiles p
     where public.is_branch_visible(p.branch_name)
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles r
                        where r.user_id = p.user_id and r.role in ('super_admin', 'admin', 'branch_manager'))
  ),
  att as (
    select a.user_id, a.checked_in_at,
           row_number() over (partition by a.user_id order by a.checked_in_at) as n
      from public.attendance_logs a join elig e on e.user_id = a.user_id
     where not coalesce(a.is_duplicate, false)
  ),
  cand(k, user_id, at, v) as (
    select 'first_signup', e.user_id, e.created_at, null::numeric from elig e
    union all
    select 'first_checkin', a.user_id, a.checked_in_at, null from att a where a.n = 1
    union all
    select 'first_100_checkins', a.user_id, a.checked_in_at, 100 from att a where a.n = 100
    union all
    -- 레벨 10 = 화이트 Lv.10 도달 (10레벨 도달 자동 심사 기록)
    select 'first_lv10', h.user_id, h.created_at, 10
      from public.level_status_history h join elig e on e.user_id = h.user_id
     where h.rank_name = 'white' and h.level_number = 10
    union all
    -- 레벨 11 / 21 / 31 = 블루 / 레드 / 블랙 리그 첫 입성
    select x.k, h.user_id, h.created_at, x.v
      from public.level_status_history h join elig e on e.user_id = h.user_id
      join (values ('first_lv11', 11::numeric, array['blue','red','black']),
                   ('first_lv21', 21, array['red','black']),
                   ('first_lv31', 31, array['black'])) x(k, v, ranks)
        on h.rank_name::text = any (x.ranks)
    union all
    select x.k, mp.user_id, coalesce(mp.level_started_at, mp.updated_at), x.v
      from public.member_progress mp join elig e on e.user_id = mp.user_id
      join (values ('first_lv11', 11::numeric, array['blue','red','black']),
                   ('first_lv21', 21, array['red','black']),
                   ('first_lv31', 31, array['black'])) x(k, v, ranks)
        on mp.current_rank::text = any (x.ranks)
    union all
    -- 153 체력테스트 = 챌린지 아레나 체력 종목
    select 'first_fitness', a.user_id, a.created_at, a.submitted_value
      from public.boxing_fun_challenge_attempts a
      join public.boxing_fun_challenges c on c.id = a.challenge_id
      join elig e on e.user_id = a.user_id
     where c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
       and a.status <> 'rejected' and a.submitted_value > 0 and a.submitted_value < 'Infinity'::numeric
    union all
    select 'first_journal', j.user_id, j.created_at, null
      from public.champion_journal_entries j join elig e on e.user_id = j.user_id
     where j.kind = 'journal' and j.hidden_at is null
    union all
    select 'first_handwrap', w.user_id, w.created_at, null
      from public.handwrap_practice_logs w join elig e on e.user_id = w.user_id
  )
  insert into public.records_153 (record_key, user_id, achieved_at, value)
  select distinct on (c.k) c.k, c.user_id, c.at, c.v
    from cand c
   where c.at is not null and c.at <= now()
     and not exists (select 1 from public.records_153 r where r.record_key = c.k)
   order by c.k, c.at, c.user_id
  on conflict (record_key) do nothing;
$$;
revoke all on function public.refresh_153_records() from public, anon, authenticated;

create or replace function public.get_153_records()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  perform public.refresh_153_records();

  with elig as (
    select p.user_id
      from public.profiles p
     where public.is_branch_visible(p.branch_name)
       and not coalesce(p.is_staff, false)
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles r
                        where r.user_id = p.user_id and r.role in ('super_admin', 'admin', 'branch_manager'))
  )
  select jsonb_build_object(
    'firsts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', r.record_key, 'user_id', r.user_id,
               'nickname', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'),
               'avatar_url', p.avatar_url, 'branch_name', p.branch_name,
               'achieved_at', r.achieved_at, 'value', r.value, 'is_me', r.user_id = v_uid)
             order by r.achieved_at)
        from public.records_153 r left join public.profiles p on p.user_id = r.user_id), '[]'::jsonb),
    'bests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', c.code, 'category', c.category, 'title', c.title, 'metric', c.target_metric,
               'user_id', b.user_id,
               'nickname', case when b.user_id is null then null
                                else coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서') end,
               'value', b.v, 'achieved_at', b.at, 'is_me', b.user_id = v_uid)
             order by c.sort_order, c.code)
        from public.boxing_fun_challenges c
        left join lateral (
          select a.user_id,
                 least(a.submitted_value, greatest(coalesce((c.difficulty_targets ->> 'advanced')::numeric, 0) * 3, 1)) as v,
                 a.created_at as at
            from public.boxing_fun_challenge_attempts a join elig e on e.user_id = a.user_id
           where a.challenge_id = c.id
             and a.status <> 'rejected' and a.submitted_value > 0 and a.submitted_value < 'Infinity'::numeric
           order by 2 desc, a.created_at asc
           limit 1) b on true
        left join public.profiles p on p.user_id = b.user_id
       where c.active
         and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')), '[]'::jsonb),
    'members', (select count(*) from elig)
  ) into v_out;

  return v_out;
end $$;
revoke all on function public.get_153_records() from public, anon;
grant execute on function public.get_153_records() to authenticated;

