-- 🧤 타이틀미션 「왜 미트를 잡아 줄까」 3일 이야기 (2026-11-05 대표님
--   "레벨 10에 왜 미트를 대 주고 지도를 해 봐야 하는지 설득하는 탭 만들고, 레벨 10이 되면 이 글 3일간 발송되게 하자")
--
-- 화이트 레벨 10 이 된 회원(타이틀 신청 흐름이 열린 시범 지점 — title_match_flow_enabled_for)에게
-- 하루 한 편씩 3번 알림(notifications → 알림함 · 휴대폰 알림 켠 회원은 푸시).
--   1편 = 레벨 10 이 되고 1시간 뒤(수업이 끝날 무렵)
--   2편 · 3편 = 다음 평일들, 1편과 같은 시각
--   보내는 때 = 평일(월~금) 08:00~21:00 한국 시각만(잡는 시각은 20:30 까지). 밖이면 다음 평일 08:00 으로 미룬다.
--   통과했거나 리그가 바뀐 회원은 남은 편을 보내지 않고 닫는다(skipped).
--   한 회원 · 한 리그에 한 번뿐(다시 레벨 10 이 돼도 또 보내지 않음).
-- 이야기 본문은 화면 src/lib/titleTeachLessons.ts 한 곳 — 알림은 짧은 제목 · 한 줄 + 그 이야기로 바로 가는 링크
-- (/title-match?lv=10&why=1~3 → 타이틀미션 카드 '왜 미트를 잡아 줄까' 탭이 그 편으로 열린다).
-- 알림 글을 바꾸면 titleTeachLessons.ts 의 notice 도 같이 바꾼다.
-- 스위치: internal_sync_config key 'title_teach_drip' = 'on' | 'off' (없거나 off 면 새로 잡지도, 보내지도 않는다).

create table if not exists public.title_teach_drip (
  user_id         uuid        not null,
  rank_name       rank_name   not null,
  day_no          smallint    not null check (day_no between 1 and 3),
  due_at          timestamptz not null,
  sent_at         timestamptz,
  skipped         text,                     -- 보내지 않고 닫은 까닭: cleared(통과) · moved(리그가 바뀜)
  notification_id uuid,
  created_at      timestamptz not null default now(),
  primary key (user_id, rank_name, day_no)
);
create index if not exists title_teach_drip_due_idx
  on public.title_teach_drip (due_at) where sent_at is null and skipped is null;

-- 서버 함수만 읽고 쓴다 (정책 없음)
alter table public.title_teach_drip enable row level security;
revoke all on public.title_teach_drip from anon, authenticated;

-- ── 보내는 때 맞추기 ──────────────────────────────────────

-- 평일 08:00~20:30(한국) 안으로 미룬다. 밖이면 다음 평일 08:00.
-- (보내기는 21:00 까지 — 20:30 에 잡힌 편도 10분마다 도는 보내기가 21시 전에 보낸다)
create or replace function public._title_teach_window(_t timestamptz)
returns timestamptz
language plpgsql
stable
set search_path to 'public'
as $$
declare
  k  timestamp := (_t at time zone 'Asia/Seoul');
  d  date := k::date;
  tm time := k::time;
begin
  if tm > time '20:30' then
    d := d + 1; tm := time '08:00';
  elsif tm < time '08:00' then
    tm := time '08:00';
  end if;
  while extract(isodow from d) >= 6 loop   -- 6 = 토, 7 = 일
    d := d + 1; tm := time '08:00';
  end loop;
  return (d + tm) at time zone 'Asia/Seoul';
end;
$$;

-- n 번째 편이 나갈 시각 — 1편 = 레벨 10 + 1시간(창 안으로), 2 · 3편 = 다음 평일들의 같은 시각
create or replace function public._title_teach_due(_base timestamptz, _day integer)
returns timestamptz
language plpgsql
stable
set search_path to 'public'
as $$
declare
  first timestamptz := public._title_teach_window(_base + interval '1 hour');
  k timestamp; d date; tm time; n integer := 1;
begin
  if coalesce(_day, 1) <= 1 then
    return first;
  end if;
  k := first at time zone 'Asia/Seoul'; d := k::date; tm := k::time;
  while n < _day loop
    d := d + 1;
    if extract(isodow from d) < 6 then
      n := n + 1;
    end if;
  end loop;
  return (d + tm) at time zone 'Asia/Seoul';
end;
$$;

create or replace function public._title_teach_on()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select value from public.internal_sync_config where key = 'title_teach_drip'), 'off') = 'on'
$$;

-- ── 시작 — 이 회원에게 3편을 잡는다 ─────────────────────────

create or replace function public.title_teach_start(_uid uuid, _rank rank_name, _base timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  if _uid is null or not public._title_teach_on() then
    return 0;
  end if;
  if _rank is distinct from 'white'::rank_name then      -- 지금은 화이트 타이틀미션(레벨 10)만
    return 0;
  end if;
  if not public.title_match_flow_enabled_for(_uid, _rank) then
    return 0;
  end if;
  if exists (select 1 from public.level_status
              where user_id = _uid and rank_name = _rank and level_number = 10 and status = 'boss_cleared') then
    return 0;
  end if;

  insert into public.title_teach_drip (user_id, rank_name, day_no, due_at)
  select _uid, _rank, d, public._title_teach_due(coalesce(_base, now()), d)
    from generate_series(1, 3) as d
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 레벨 10 이 되는 순간(출석 자동 승급 · 코치 승급 · 관리자 수정 어느 길이든) 잡는다.
-- 무슨 일이 있어도 레벨업 자체는 막지 않는다.
create or replace function public._title_teach_on_progress()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.current_rank = 'white'::rank_name
     and coalesce(new.current_level, 0) = 10
     and (tg_op = 'INSERT'
          or old.current_rank is distinct from new.current_rank
          or coalesce(old.current_level, 0) <> 10) then
    begin
      perform public.title_teach_start(new.user_id, new.current_rank, now());
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists title_teach_on_progress on public.member_progress;
create trigger title_teach_on_progress
  after insert or update of current_level, current_rank on public.member_progress
  for each row execute function public._title_teach_on_progress();

-- ── 보내기 — 10분마다 ─────────────────────────────────────

create or replace function public.title_teach_dispatch()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r   record;
  k   timestamp := now() at time zone 'Asia/Seoul';
  nid uuid;
  t   text;
  b   text;
  n   integer := 0;
begin
  if not public._title_teach_on() then
    return 0;
  end if;
  -- 평일 08~21시(한국)에만 보낸다 — 밀린 편도 이 시간에
  if extract(isodow from k) >= 6 or k::time < time '08:00' or k::time >= time '21:00' then
    return 0;
  end if;

  for r in
    select d.user_id, d.rank_name, d.day_no,
           mp.current_rank as cur_rank, coalesce(mp.current_level, 0) as cur_level
      from public.title_teach_drip d
      left join public.member_progress mp on mp.user_id = d.user_id
     where d.sent_at is null
       and d.skipped is null
       and d.due_at <= now()
       -- 앞 편이 나가고 18시간이 지나야 다음 편 (하루에 두 편이 몰리지 않게)
       and (d.day_no = 1
            or exists (select 1 from public.title_teach_drip p
                        where p.user_id = d.user_id and p.rank_name = d.rank_name and p.day_no = d.day_no - 1
                          and (p.skipped is not null or p.sent_at <= now() - interval '18 hours')))
     order by d.due_at, d.day_no
     limit 200
     for update of d skip locked
  loop
    if exists (select 1 from public.level_status
                where user_id = r.user_id and rank_name = r.rank_name and level_number = 10 and status = 'boss_cleared') then
      update public.title_teach_drip set skipped = 'cleared'
       where user_id = r.user_id and rank_name = r.rank_name and sent_at is null and skipped is null;
      continue;
    end if;
    if r.cur_rank is distinct from r.rank_name or r.cur_level <> 10 then
      update public.title_teach_drip set skipped = 'moved'
       where user_id = r.user_id and rank_name = r.rank_name and sent_at is null and skipped is null;
      continue;
    end if;

    -- 알림 글 (화면 src/lib/titleTeachLessons.ts 의 notice 와 같게)
    t := case r.day_no
           when 1 then '레벨 10, 마지막 관문은 왜 미트 잡아 주기일까요?'
           when 2 then '미트 잡아 주는 동안, 내 연습은 손해일까요?'
           else        '왜 한 번이 아니라 3번 연속일까요?'
         end;
    b := case r.day_no
           when 1 then '가르쳐 본 사람이 더 오래 기억해요. 타이틀미션 이야기 1/3'
           when 2 then '번갈아 하면 내가 치는 횟수가 줄어도 배우는 건 줄지 않아요. 타이틀미션 이야기 2/3'
           else        '한 번은 운이어도 3번 연속은 실력이에요. 타이틀미션 이야기 3/3'
         end;

    insert into public.notifications (user_id, title, body, link)
    values (r.user_id, t, b, public.title_match_link(r.rank_name) || '&why=' || r.day_no)
    returning id into nid;

    update public.title_teach_drip
       set sent_at = now(), notification_id = nid
     where user_id = r.user_id and rank_name = r.rank_name and day_no = r.day_no;
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke execute on function public._title_teach_window(timestamptz) from public, anon, authenticated;
revoke execute on function public._title_teach_due(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public._title_teach_on() from public, anon, authenticated;
revoke execute on function public.title_teach_start(uuid, rank_name, timestamptz) from public, anon, authenticated;
revoke execute on function public._title_teach_on_progress() from public, anon, authenticated;
revoke execute on function public.title_teach_dispatch() from public, anon, authenticated;

-- 켜기 (대표님 요청) — 끄기: update internal_sync_config set value = 'off' where key = 'title_teach_drip';
insert into public.internal_sync_config (key, value, updated_at)
values ('title_teach_drip', 'on', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'title-teach-dispatch';
select cron.schedule('title-teach-dispatch', '*/10 * * * *', $$select public.title_teach_dispatch();$$);
