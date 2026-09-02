-- 라이브보드 코치 표시를 '앱 계정' 이 아니라 '브로제이 직원 출근' 기준으로 바꾼다.
--
-- 배경 (2026-09-02):
--   코치가 앱에 가입하지 않았거나 브로제이와 전화번호가 다르면 (실제 사례: 이재우
--   코치) 라이브보드에 아예 나타나지 않았다. 반대로 한 번 출근이 찍히면 브로제이에
--   퇴근 기록이 없어서 (기록 유형이 GO_TO_WORK 뿐) 자정까지 계속 떠 있었다.
--
-- 해결:
--   1) staff_duty_logs — 브로제이 user_type='직원' 출근을 앱 계정 유무와 무관하게 저장.
--   2) public_staff_on_duty — '지금 근무중' 판정을 담은 읽기 전용 뷰.
--      · 지점장/관장/대표 : 오늘 출근했으면 하루 종일 표시
--      · 그 외 코치        : 출근 후 4시간까지만 표시
--      (대표님 지정 규칙. 퇴근 기록이 없으니 시간 기반 추정이 최선이다.)
--
-- 전화번호는 뷰로 절대 나가지 않는다 — 보드는 anon 으로 읽힌다.

create table if not exists public.staff_duty_logs (
  id            uuid primary key default gen_random_uuid(),
  source_ref    text not null unique,          -- 'broj:<attendance_id>' — 재실행해도 중복 없음
  branch_name   text not null,
  phone_digits  text not null,                 -- 숫자만. 사람 식별 키 (앱 계정이 없을 수 있어서)
  staff_name    text not null,
  user_id       uuid,                          -- 앱 계정이 있으면 연결 (직함·아바타 조회용)
  checked_in_at timestamptz not null,
  attend_date   date not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_staff_duty_branch_time
  on public.staff_duty_logs (branch_name, checked_in_at desc);
create index if not exists idx_staff_duty_date
  on public.staff_duty_logs (attend_date);

alter table public.staff_duty_logs enable row level security;

-- 쓰기는 sync-broj-checkins(service_role) 만. 읽기는 아래 뷰로만 나간다.
revoke all on public.staff_duty_logs from anon, authenticated;

comment on table public.staff_duty_logs is
  '브로제이 직원(코치) 출근 기록. 앱 계정이 없어도 저장된다. 읽기는 public_staff_on_duty 뷰 사용.';

-- ── 근무중 판정 뷰 ──────────────────────────────────────────────
-- 사람 1명당 오늘의 마지막 출근 1건만 보고, 직함에 따라 유지 시간을 다르게 준다.
create or replace view public.public_staff_on_duty as
with today_latest as (
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
left join public.profiles p on p.user_id = l.user_id
where coalesce(nullif(btrim(p.staff_title), ''), '코치') in ('지점장', '관장', '대표')
   or l.checked_in_at > now() - interval '4 hours';

comment on view public.public_staff_on_duty is
  '지금 근무중인 코치. 지점장/관장/대표는 오늘 출근했으면 종일, 그 외는 출근 후 4시간. 전화번호는 노출하지 않는다.';

grant select on public.public_staff_on_duty to anon, authenticated;
