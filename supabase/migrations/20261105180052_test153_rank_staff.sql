-- ⏱️ 153 PB 순위에 코치님 · 운영진도 (2026-11-05 대표님 "153bp 현동 21분18초 나 26분 30초
--   코치님들은 최초 레코드에 포함하지 말고 랭킹에만 넣어줘")
--   · 순위(get_test153_ranking · get_test153_summary 의 내 순위) = 체험용 계정만 빼고 모두 — 코치님 · 운영진 기록도 오른다.
--   · 153 레코드(최초 153 PB 완주 · 최초 153 PB 1위)와 그 한 달 창(test153_top_window)은 그대로 회원만
--     (refresh_153_records · get_153_records · test153_top_window 의 elig — is_staff · 운영진 역할 · 체험용 제외, 이 파일에서 안 바꿈).
--   · get_test153_ranking_v2 = v1 + r_staff_label(직함 '코치' · '지점장' 또는 '운영진', 회원은 null) — 화면이 이름 옆에 작게.
--     v1 은 옛 화면 · get_test153_summary 용으로 그대로 둔다(같은 순서 · 같은 사람).

create or replace function public.test153_rankable(_user uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
     where p.user_id = _user
       and not coalesce(p.is_test_account, false)
  );
$$;

create or replace function public.get_test153_ranking_v2(
  p_division text default 'open',
  p_branch text default null,
  p_gender text default null,
  p_age text default null,
  p_limit integer default 50)
returns table(r_position bigint, r_user_id uuid, r_nickname text, r_avatar_url text, r_branch_name text,
              r_score_ms integer, r_finished boolean, r_remaining_reps integer, r_gender text, r_age_group text,
              r_measured_at timestamp with time zone, r_staff_label text)
language sql
stable security definer
set search_path to 'public'
as $$
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
         p.avatar_url, p.branch_name, b.score_ms, b.finished, b.remaining_reps, b.gender, b.age_group, b.measured_at,
         case
           when coalesce(p.is_staff, false) then coalesce(nullif(btrim(p.staff_title), ''), '코치')
           when exists (select 1 from public.user_roles ur where ur.user_id = b.user_id and ur.role = 'coach') then '코치'
           when exists (select 1 from public.user_roles ur
                         where ur.user_id = b.user_id and ur.role in ('super_admin', 'admin', 'branch_manager')) then '운영진'
         end
    from best b
    join public.profiles p on p.user_id = b.user_id
   where (p_branch is null and public.is_branch_visible(p.branch_name) or p.branch_name = p_branch)
     and (p_gender is null or b.gender = p_gender)
     and (p_age is null or b.age_group = p_age)
   order by 1
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.get_test153_ranking_v2(text, text, text, text, integer) from public, anon;
grant execute on function public.get_test153_ranking_v2(text, text, text, text, integer) to authenticated;
