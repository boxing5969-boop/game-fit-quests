-- 153운영본부 · PT 수업권마다 따로 세기 + 기한 연장 「끝남」 오탐 정리 + 재등록 겹침 확인
--   (2026-11-06 대표님 「진행하자」 — 메이삼 「PT 수업권 끝남 · 남은 2회」(11/1) 카드가 잘못 뜬 일)
--
--   그날 실제: 옛 20회권 기한(10/31)이 지나 앱이 「끝남」으로 봄 → 브로제이에서 기한을 11/13로 늘림 → 11/2 · 11/5 수업 → 11/5 새 20회권.
--   앱은 회원마다 PT 수업권을 '대표 한 장'(가장 늦게 끝나는 장)만 받아서
--     ① 기한이 늘어나 다시 살아나도 「끝남」 카드가 그대로 남았고
--     ② 재등록 직후 두 장이 겹치면 옛 장의 마지막 수업(11/5)이 차감 기록에 안 잡혔다.
--
--   바꾸는 것
--   · profiles.pt_tickets (jsonb) — 153OS 가 브로제이에서 본 PT 수업권 목록. sync-pt-members 가 옮긴다.
--       [{"id":"<수업권 id>","name":"퍼스널 트레이닝 20회권","left":19,"total":20,"start":"2026-11-05","end":"2027-03-04","on":true}]
--       on = 확인한 날 살아 있음(기한 안 · 남은 횟수 있음 · 해지 아님). 목록은 153OS 워커가 채운다(153OS 쪽 작업 — 배포 전에는 비어 있다).
--   · 목록이 있으면 수업권(id)마다 비교한다:
--       남은 횟수가 줄면 그만큼 'used' · 남은 횟수가 있는데 닫히면(기한 지남 · 해지) 'ended' 확인 ·
--       목록에서 사라지면 'ended' 확인(마지막 수업 · 환불) · 닫혔던 장이 다시 살아나면 그 장의 확인 카드를 스스로 뺀다.
--       새 장(재등록)은 기록할 것이 없다 — 옛 장은 옛 장대로 계속 센다.
--   · 목록이 아직 없는 동안(지금)은 예전 '대표 한 장' 방식 그대로 + 두 가지 보강:
--       a) 「끝남」 확인 카드(45일 안 · 같은 이름) 뒤에 수업권이 다시 보이면 —
--          남은 횟수가 같으면 카드를 빼고(끝남 아님), 줄었으면 줄어든 만큼 수업으로 바꾼다. 늘었으면 새 장(재등록)이라 카드는 그대로.
--       b) 같은 이름인데 남은 횟수가 늘고 끝나는 날도 늦어지면(재등록으로 대표 장이 새 장으로 바뀜) —
--          옛 장의 남은 횟수가 더는 안 보이므로 확인 카드로 남긴다(다 썼으면 「수업」 · 남았으면 「빼기」).
--   · ops_pt_events.ticket_key — 수업권 id(목록 방식에서만). 다시 살아난 장의 카드를 찾는 열쇠.
--   · sync-pt-members 예약 매시 40분 → 45분: 153OS 스윕(매시 40분)보다 몇 초 먼저 돌아 한 시간씩 늦던 것(11/6 14:40 실측 18초 차이).
--
--   새 칸 · 함수 본문 · 트리거 열 목록 · 예약 분만 바꾼다. 트리거는 실패해도 회원 정보 저장을 막지 않는다(경고만, 예전과 같음).

-- ───────────────────────── 칸 ─────────────────────────
alter table public.profiles add column if not exists pt_tickets jsonb;
comment on column public.profiles.pt_tickets is
  'PT 수업권 목록(153OS 가 브로제이에서 확인 → sync-pt-members). [{id,name,left,total,start,end,on}] — 수업권마다 차감 세기(_ops_pt_capture)';

alter table public.ops_pt_events add column if not exists ticket_key text;
comment on column public.ops_pt_events.ticket_key is '수업권 id(profiles.pt_tickets 의 id) — 목록 방식으로 잡은 기록만';
create index if not exists ops_pt_events_open_check_idx on public.ops_pt_events (member_user_id) where status = 'check';

-- ───────────────────────── 차감 잡기 (profiles 트리거) ─────────────────────────
create or replace function public._ops_pt_capture()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_branch text := coalesce(new.branch_name, old.branch_name);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_member text := coalesce(nullif(btrim(new.name), ''), '회원');
  v_coach uuid;
  v_used integer;
  v_kind text;
  v_status text := 'auto';
  v_note text;
  v_after integer;
  t jsonb;
  o jsonb;
  e public.ops_pt_events;
begin
  begin
    if v_branch is null or not exists (select 1 from public.ops_branches b where b.branch_name = v_branch and b.enabled) then
      return new;
    end if;
    if (select count(*) from public.ops_staff s where s.branch_name = v_branch and s.active and s.pt_freelancer) = 1 then
      select s.id into v_coach from public.ops_staff s where s.branch_name = v_branch and s.active and s.pt_freelancer;
    end if;

    -- ① 수업권 목록(pt_tickets)이 있으면 수업권 id 마다 비교한다
    if jsonb_typeof(new.pt_tickets) = 'array' then
      if jsonb_typeof(old.pt_tickets) is distinct from 'array' then
        -- 목록이 처음 들어온 순간 — 예전 대표 장(같은 이름 · 같은 끝나는 날)이 줄었으면 그만큼만 수업으로 잇는다
        if old.pt_ticket is not null and old.pt_remaining is not null then
          select x into t from jsonb_array_elements(new.pt_tickets) x
           where x->>'name' = old.pt_ticket
             and (x->>'end') is not distinct from to_char(old.pt_end_date, 'YYYY-MM-DD')
             and jsonb_typeof(x->'left') = 'number'
           limit 1;
          if t is not null and (t->>'left')::int < old.pt_remaining and old.pt_remaining - (t->>'left')::int <= 50 then
            insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, ticket_key,
                                              before_remaining, after_remaining, used, kind, status, coach_staff_id, work_date)
            values (v_branch, new.user_id, v_member, old.pt_ticket, t->>'id', old.pt_remaining, (t->>'left')::int,
                    old.pt_remaining - (t->>'left')::int, 'used', 'auto', v_coach, v_today);
          end if;
        end if;
        return new;
      end if;

      for t in select x from jsonb_array_elements(new.pt_tickets) x loop
        o := null;
        select y into o from jsonb_array_elements(old.pt_tickets) y where y->>'id' = t->>'id' limit 1;
        continue when o is null;   -- 새 장(재등록) — 기록할 것 없음
        -- 남은 횟수가 줄어든 만큼 = 수업
        if jsonb_typeof(o->'left') = 'number' and jsonb_typeof(t->'left') = 'number'
           and (t->>'left')::int < (o->>'left')::int and (o->>'left')::int - (t->>'left')::int <= 50 then
          insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, ticket_key,
                                            before_remaining, after_remaining, used, kind, status, coach_staff_id, work_date)
          values (v_branch, new.user_id, v_member, coalesce(t->>'name', o->>'name'), t->>'id', (o->>'left')::int, (t->>'left')::int,
                  (o->>'left')::int - (t->>'left')::int, 'used', 'auto', v_coach, v_today);
        end if;
        -- 닫혔던 장이 다시 살아남(기한 연장 등) → 그 장의 「끝남」 확인 카드는 스스로 뺀다
        if coalesce((o->>'on')::boolean, false) = false and coalesce((t->>'on')::boolean, false) then
          update public.ops_pt_events
             set status = 'excluded', updated_at = now(),
                 note = left('기한이 늘어나 다시 살아남(~' || coalesce(t->>'end', '?') || ') — 끝남 아님, 자동으로 뺐어요', 300)
           where member_user_id = new.user_id and ticket_key = t->>'id' and kind = 'ended' and status = 'check';
        end if;
        -- 남은 횟수가 있는데 닫힘(기한 지남 · 해지 · 환불) → 지점장 확인
        if coalesce((o->>'on')::boolean, false) and coalesce((t->>'on')::boolean, false) = false
           and jsonb_typeof(t->'left') = 'number' and (t->>'left')::int between 1 and 50 then
          insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, ticket_key,
                                            before_remaining, after_remaining, used, kind, status, coach_staff_id, work_date, note)
          values (v_branch, new.user_id, v_member, coalesce(t->>'name', o->>'name'), t->>'id', (t->>'left')::int, null,
                  (t->>'left')::int, 'ended', 'check', v_coach, v_today,
                  case when (t->>'end') ~ '^\d{4}-\d{2}-\d{2}$' and (t->>'end')::date < v_today
                       then '수업권 기한이 지나 끝났을 수 있어요' else '수업권이 닫혔어요 — 환불 · 정지인지 확인해 주세요' end);
        end if;
      end loop;

      -- 목록에서 사라진 장 — 살아 있었고 남은 횟수가 있었으면 확인(마지막 수업 · 환불 · 삭제)
      for o in select y from jsonb_array_elements(old.pt_tickets) y
                where coalesce((y->>'on')::boolean, false)
                  and jsonb_typeof(y->'left') = 'number' and (y->>'left')::int between 1 and 50
                  and not exists (select 1 from jsonb_array_elements(new.pt_tickets) x where x->>'id' = y->>'id') loop
        insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, ticket_key,
                                          before_remaining, after_remaining, used, kind, status, coach_staff_id, work_date, note)
        values (v_branch, new.user_id, v_member, o->>'name', o->>'id', (o->>'left')::int, null,
                (o->>'left')::int, 'ended', 'check', v_coach, v_today,
                case when (o->>'end') ~ '^\d{4}-\d{2}-\d{2}$' and (o->>'end')::date < v_today
                     then '수업권 기한이 지나 끝났을 수 있어요' else '마지막 수업인지 확인해 주세요' end);
      end loop;
      return new;
    end if;

    -- ② 목록이 아직 없을 때(153OS 워커 배포 전) — 대표 한 장으로 비교
    v_after := new.pt_remaining;
    if old.pt_ticket is not null and new.pt_ticket is not distinct from old.pt_ticket
       and old.pt_remaining is not null and new.pt_remaining is not null and new.pt_remaining < old.pt_remaining then
      v_used := old.pt_remaining - new.pt_remaining;
      v_kind := 'used';
    elsif old.pt_ticket is not null and new.pt_ticket is null and coalesce(old.pt_remaining, 0) > 0 then
      v_used := old.pt_remaining;
      v_kind := 'ended';
      v_status := 'check';
      v_note := case when old.pt_end_date is not null and old.pt_end_date < v_today
                     then '수업권 기한이 지나 끝났을 수 있어요' else '마지막 수업인지 확인해 주세요' end;
    elsif old.pt_ticket is not null and new.pt_ticket is not distinct from old.pt_ticket
       and coalesce(old.pt_remaining, 0) > 0 and new.pt_remaining is not null and new.pt_remaining > old.pt_remaining
       and old.pt_end_date is not null and new.pt_end_date is not null and new.pt_end_date > old.pt_end_date then
      -- 보강 b) 재등록으로 대표 장이 새 장으로 바뀜 — 옛 장의 남은 횟수는 이제 안 보이므로 확인 카드로 남긴다
      v_used := old.pt_remaining;
      v_kind := 'ended';
      v_status := 'check';
      v_after := null;
      v_note := '새 수업권으로 바뀌었어요 — 옛 수업권(~' || to_char(old.pt_end_date, 'FMMM/FMDD') || ') 남은 '
                || old.pt_remaining || '회를 다 썼으면 「수업」, 남았으면 「빼기」';
    elsif old.pt_ticket is null and new.pt_ticket is not null and new.pt_remaining is not null then
      -- 보강 a) 「끝남」 뒤에 같은 이름 수업권이 다시 보임 — 45일 안의 확인 카드를 정리한다
      select * into e from public.ops_pt_events
       where member_user_id = new.user_id and kind = 'ended' and status = 'check' and ticket_key is null
         and ticket_name is not distinct from new.pt_ticket and before_remaining is not null
         and work_date >= v_today - 45
         and coalesce(note, '') not like '새 수업권으로%'   -- 재등록 겹침 카드(보강 b)는 '끝남'이 아니라 옛 장 확인이라 건드리지 않는다
       order by work_date desc, detected_at desc
       limit 1;
      if e.id is not null then
        if new.pt_remaining = e.before_remaining then
          update public.ops_pt_events
             set status = 'excluded', updated_at = now(),
                 note = left('기한이 늘어나 다시 살아남(~' || coalesce(to_char(new.pt_end_date, 'FMMM/FMDD'), '?')
                             || ') — 끝남 아님, 자동으로 뺐어요', 300)
           where id = e.id;
        elsif new.pt_remaining < e.before_remaining and e.before_remaining - new.pt_remaining <= 50 then
          update public.ops_pt_events
             set kind = 'used', status = 'auto', used = e.before_remaining - new.pt_remaining,
                 after_remaining = new.pt_remaining, work_date = v_today, updated_at = now(),
                 note = left('기한이 늘어나 다시 살아남(~' || coalesce(to_char(new.pt_end_date, 'FMMM/FMDD'), '?')
                             || ') — 그사이 ' || (e.before_remaining - new.pt_remaining) || '회 수업', 300)
           where id = e.id;
        end if;
        -- 남은 횟수가 늘었으면 새 장(재등록) — 옛 장 카드는 그대로 둔다(지점장 확인)
      end if;
      return new;
    else
      return new;
    end if;
    if v_used <= 0 or v_used > 50 then return new; end if;

    insert into public.ops_pt_events (branch_name, member_user_id, member_name, ticket_name, before_remaining, after_remaining,
                                      used, kind, status, coach_staff_id, work_date, note)
    values (v_branch, new.user_id, v_member, old.pt_ticket, old.pt_remaining, v_after,
            v_used, v_kind, v_status, v_coach, v_today, v_note);
  exception when others then
    raise warning 'ops_pt_capture: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function public._ops_pt_capture() from public, anon, authenticated;

drop trigger if exists ops_pt_capture on public.profiles;
create trigger ops_pt_capture
  after update of pt_remaining, pt_ticket, pt_tickets on public.profiles
  for each row
  when (old.pt_remaining is distinct from new.pt_remaining or old.pt_ticket is distinct from new.pt_ticket
        or old.pt_tickets is distinct from new.pt_tickets)
  execute function public._ops_pt_capture();

-- ───────────────────────── 예약: 매시 40분 → 45분 ─────────────────────────
-- 153OS 홀딩 스윕(워커 크론 매시 40분)이 회원 수업권을 다시 읽은 뒤에 옮기도록 5분 늦춘다.
do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'sync-pt-members';
  if v_job is not null then
    perform cron.alter_job(job_id := v_job, schedule := '45 * * * *');
  end if;
end $$;
