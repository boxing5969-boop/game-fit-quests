-- 153 레코드 이름: '최초 레벨 11 · 21 · 31' → '최초 블루리그 달성 · 최초 레드리그 달성 · 최초 블랙리그 달성'
--   (2026-10-16 대표님: "최초레벨 11보다 최초 블루리그 달성 최초 레드리그 달성 최초 블랙리그 달성으로 변경해줘")
--   기록 키(first_lv11 등)와 기준은 그대로 — 이름만 바뀐다. 알림·마일리지 내역에 쓰는 이름표.
--   아직 주인이 없는 칸이라 지난 내역은 바꿀 게 없다.

create or replace function public.record_153_label(_key text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case _key
    when 'first_signup' then '최초 가입자'
    when 'first_checkin' then '최초 출석'
    when 'first_100_checkins' then '최초 출석 100회'
    when 'first_journal' then '최초 커뮤니티 글'
    when 'first_handwrap' then '최초 붕대 감기 연습'
    when 'first_lv10' then '최초 레벨 10'
    when 'first_lv11' then '최초 블루리그 달성'
    when 'first_lv21' then '최초 레드리그 달성'
    when 'first_lv31' then '최초 블랙리그 달성'
    when 'first_test153' then '최초 153 TEST 완주'
    when 'first_fitness' then '최초 체력테스트 기록'
    else _key end;
$$;
