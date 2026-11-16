-- 📆 영상으로 배우기 → 운동 달력 · 내 운동 기록 (2026-11-17 대표님 「운동 기록에 쌓기」 — 보고서 「오늘 해 봤어요 → 내 운동 기록」)
--   보고서 https://claude.ai/artifact/F9QW5nn9N51k5wqZmGKVdE 「더 좋은 아이디어」 표 — 끝낸 수업 · 카드가 운동 기록에 쌓여요(못한 건 안 보임).
--
--   ① training_class_play_days — 내 수업을 한 날(한국) · 분 · 번 (사람 · 날 · 수업마다 한 줄 · 내용 없음).
--   ② my_class_played — 지금 정의(20261114230326 · 운영 본문 = 저장소, 11/17 md5 확인) 그대로 + 센 때(1분 안 두 번 = 한 번)만 그날 줄에 더한다.
--   ③ my_learn_days(시작, 끝) — 본인만 · 날마다 내 수업 분 · 번 + 영상을 끝까지 본 동작 수(training_card_events 'complete' — 카드 · 레벨 미션).
--      한 것이 없는 날은 줄이 없다(달력이 그리지 않는다 — 빠진 날 표시 없음) · 400일까지 · 승인 전 계정은 빈 목록.
--   보관: 내 수업과 같이 — 계정을 지우면 함께. 수업을 지워도 그날 운동한 분 · 번은 남는다(이름 · 순서 · 메모 없음).
--   줄을 지우는 문장이 없다.

create table if not exists public.training_class_play_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  class_id uuid not null,
  minutes integer not null default 0 check (minutes between 0 and 1440),
  n integer not null default 0 check (n between 0 and 1000),
  last_at timestamptz not null default now(),
  primary key (user_id, day, class_id)
);
alter table public.training_class_play_days enable row level security;
revoke all on public.training_class_play_days from public, anon, authenticated;

-- ── 다 했어요 (본인) — 1분 안 두 번 = 한 번 · 센 때만 그날 줄에 ──
create or replace function public.my_class_played(p_id uuid, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m integer := greatest(1, least(coalesce(p_minutes, 1), 360));
  r public.training_my_classes%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  select * into r from public.training_my_classes
   where id = p_id and user_id = v_uid and removed_at is null
   for update;
  if not found then raise exception '그 수업을 찾지 못했어요' using errcode = 'P0002'; end if;
  if r.last_played_at is not null and r.last_played_at > now() - interval '60 seconds' then
    return jsonb_build_object('ok', true, 'plays', r.plays, 'minutes_total', r.minutes_total, 'counted', false);
  end if;
  update public.training_my_classes
     set plays = least(plays + 1, 100000),
         minutes_total = least(minutes_total + v_m, 10000000),
         last_played_at = now()
   where id = r.id
  returning * into r;
  -- 그날 기록(한국 날짜) — 운동 달력 · 내 운동 기록 (2026-11-17)
  insert into public.training_class_play_days as d (user_id, day, class_id, minutes, n)
  values (v_uid, (now() at time zone 'Asia/Seoul')::date, r.id, v_m, 1)
  on conflict (user_id, day, class_id) do update
     set minutes = least(d.minutes + excluded.minutes, 1440),
         n = least(d.n + 1, 1000),
         last_at = now();
  return jsonb_build_object('ok', true, 'plays', r.plays, 'minutes_total', r.minutes_total, 'counted', true);
end $$;
revoke all on function public.my_class_played(uuid, integer) from public, anon;
grant execute on function public.my_class_played(uuid, integer) to authenticated;

-- ── 날마다 영상으로 배우기 (본인) — [{day, minutes, plays, cards}] · 한 것이 있는 날만 ──
create or replace function public.my_learn_days(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception '날짜 범위가 맞지 않아요' using errcode = '22023';
  end if;
  if not public._is_active_member(v_uid) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', k.day, 'minutes', coalesce(c.minutes, 0), 'plays', coalesce(c.plays, 0), 'cards', coalesce(e.cards, 0))
                     order by k.day)
      from (select p.day from public.training_class_play_days p
             where p.user_id = v_uid and p.day between p_from and p_to and p.n > 0
            union
            select ev.day from public.training_card_events ev
             where ev.user_id = v_uid and ev.kind = 'complete' and ev.item ~ '^[cm]:' and ev.day between p_from and p_to) k
      left join (select p.day, sum(p.minutes)::integer as minutes, sum(p.n)::integer as plays
                   from public.training_class_play_days p
                  where p.user_id = v_uid and p.day between p_from and p_to and p.n > 0
                  group by p.day) c on c.day = k.day
      left join (select ev.day, count(distinct ev.item)::integer as cards
                   from public.training_card_events ev
                  where ev.user_id = v_uid and ev.kind = 'complete' and ev.item ~ '^[cm]:' and ev.day between p_from and p_to
                  group by ev.day) e on e.day = k.day), '[]'::jsonb);
end $$;
revoke all on function public.my_learn_days(date, date) from public, anon;
grant execute on function public.my_learn_days(date, date) to authenticated;
