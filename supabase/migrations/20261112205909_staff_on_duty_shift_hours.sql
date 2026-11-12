-- 라이브보드 코치 칸 — 출근을 찍은 코치는 「근무」 시간표의 근무 시간에도 보이게
-- (2026-11-12 대표님 — 코치님 두 분이 "출첵을 했음에도 안뜨는데 … 상습적으로 그러던데")
--
-- 원인: public_staff_on_duty 는 지점장 · 관장 · 대표가 아니면 '출근 후 4시간'까지만 보여 준다.
--   브로제이는 직원 출근(GO_TO_WORK)을 하루 한 번만 적고 퇴근 · 다시 들어온 기록이 없다.
--   그래서 출근을 한 번 찍고 4시간 넘게 지나 일하는 코치는 근무 중인데도 TV 코치 칸에서 빠졌다 —
--   낮 · 저녁으로 나눠 일하는 코치의 저녁 근무(날마다 3시간), 낮에 PT 를 하고 저녁 수업을 하는 코치,
--   4시간이 넘는 저녁 근무의 끝부분.
--
-- 고침: 예전 규칙 둘(지점장 · 관장 · 대표 = 오늘 출근했으면 종일 / 그 밖 = 출근 후 4시간)은 그대로 두고 하나를 더한다.
--   오늘 출근을 찍은 사람이 153운영본부 「근무」 시간표의 근무 시간 안이면 보인다.
--   「근무」 탭 인정 시간(src/lib/opsWork.ts computeDay)과 같은 기준 —
--     · 근무자 카드가 켜져 있고(active) 근무 기간 안
--     · 승인된 쉰 날(off)이면 시간표를 안 본다
--     · 대타로 넘긴 수업(cover · 승인 · 시간이 겹침)은 뺀다
--     · 대타로 받은 수업(cover_staff_id · 승인) 시간은 더한다
--   근무자 카드 ↔ 출근부 짝은 ops_month 와 같은 식(앱 계정, 없으면 이름).
--
-- 그대로인 것: 열 이름 · 순서 · 형식 · 권한(TV 는 로그인 없이 읽는다) · 오늘 출근을 안 찍은 사람은 안 보임 ·
--   전화번호는 내보내지 않음. 시간표 · 쉰 날 · 대타 표는 이 뷰 안에서만 읽는다
--   (함수를 만들지 않았다 — 로그인 없이 부를 수 있는 새 함수가 생기지 않게).

create or replace view public.public_staff_on_duty as
with k as (
  select (now() at time zone 'Asia/Seoul')::date                      as d,
         (now() at time zone 'Asia/Seoul')::time                      as tm,
         extract(dow from (now() at time zone 'Asia/Seoul'))::int     as wd   -- 0 = 일요일 (ops_shift_rules.weekday 와 같다)
),
today_latest as (
  select distinct on (d.branch_name, d.phone_digits)
         d.branch_name,
         d.phone_digits,
         d.staff_name,
         d.user_id,
         d.checked_in_at
  from public.staff_duty_logs d
  where d.attend_date = (now() at time zone 'Asia/Seoul')::date
  order by d.branch_name, d.phone_digits, d.checked_in_at desc
)
select
  l.branch_name,
  coalesce(nullif(btrim(p.name), ''), l.staff_name) as name,
  coalesce(nullif(btrim(p.staff_title), ''), '코치') as title,
  p.avatar_url,
  l.user_id,
  l.checked_in_at
from today_latest l
cross join k
left join public.profiles p on p.user_id = l.user_id
where coalesce(nullif(btrim(p.staff_title), ''), '코치') in ('지점장', '관장', '대표')
   or l.checked_in_at > now() - interval '4 hours'
   or exists (
        select 1
          from public.ops_staff s
         where s.branch_name = l.branch_name
           and s.active
           and ((s.user_id is not null and s.user_id = l.user_id) or s.name = l.staff_name)
           and (
             -- 대타로 받은 수업 시간
             exists (
               select 1
                 from public.ops_day_entries c
                where c.cover_staff_id = s.id
                  and c.kind = 'cover'
                  and c.status = 'approved'
                  and c.work_date = k.d
                  and c.start_time <= k.tm
                  and k.tm < c.end_time
             )
             or (
               -- 시간표의 근무 시간 (쉰 날 · 넘긴 수업은 뺀다)
               (s.start_date is null or s.start_date <= k.d)
               and (s.end_date is null or s.end_date >= k.d)
               and not exists (
                 select 1
                   from public.ops_day_entries o
                  where o.staff_id = s.id
                    and o.work_date = k.d
                    and o.kind = 'off'
                    and o.status = 'approved'
               )
               and exists (
                 select 1
                   from public.ops_shift_rules r
                  where r.staff_id = s.id
                    and r.weekday = k.wd
                    and r.valid_from <= k.d
                    and (r.valid_to is null or r.valid_to >= k.d)
                    and r.start_time <= k.tm
                    and k.tm < r.end_time
                    and not exists (
                      select 1
                        from public.ops_day_entries g
                       where g.staff_id = s.id
                         and g.work_date = k.d
                         and g.kind = 'cover'
                         and g.status = 'approved'
                         and g.start_time is not null
                         and g.end_time is not null
                         and r.start_time < g.end_time
                         and g.start_time < r.end_time
                    )
               )
             )
           )
      );

comment on view public.public_staff_on_duty is
  '지금 근무중인 코치. 지점장/관장/대표는 오늘 출근했으면 종일, 그 외는 출근 후 4시간 + 오늘 출근했고 근무 시간표(대타 받은 수업 포함)의 근무 시간 안이면. 전화번호는 노출하지 않는다.';

grant select on public.public_staff_on_duty to anon, authenticated;
