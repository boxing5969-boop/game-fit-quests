-- 🧤 타이틀미션 레벨 10 이야기 → 「설계 노트」 알림 글 (2026-11-05 11:24 대표님
--   "왜 미트 잡아 주기일까요보다 왜 3번 공격 3번 미트로 설계했는지 설명하는 게 더 좋을 것 같아 — 설득하려 하면 방어기제가 생기니까 ·
--    부정어를 줄이고 긍정어로")
-- 바뀌는 것은 title_teach_dispatch() 의 알림 제목 · 한 줄뿐 — 일정 · 대상 · 건너뛰기 규칙은 20261105011632 그대로.
-- 화면 src/lib/titleTeachLessons.ts 의 notice 와 같은 글.

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
           when 1 then '153이 타이틀미션을 3번 공격 · 3번 미트로 만든 이유'
           when 2 then '미트를 잡는 시간도 훈련이 되는 이유'
           else        '3번 연속 성공 · 3번 기회로 만든 이유'
         end;
    b := case r.day_no
           when 1 then '설계 노트 1/3 · 가르쳐 본 사람이 가장 오래 기억해요'
           when 2 then '설계 노트 2/3 · 세계 최고 팀들도 서로 가르치며 강해져요'
           else        '설계 노트 3/3 · 반복은 천재를 만들어요'
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

revoke execute on function public.title_teach_dispatch() from public, anon, authenticated;
