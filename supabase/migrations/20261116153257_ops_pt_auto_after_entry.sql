-- PT 자동 기록 — 차감이 입장보다 먼저 잡힌 수업도 잇기 (2026-11-16 대표님 「추천대로 진행하고 2-2진행하자」)
--
--   시범 1주차에 본 빈틈: 코치가 수업 직전에 브로제이에서 차감했고, 회원이 들어오기 전에 그 차감이 읽혔다(차감은 회원마다
--   하루~이틀에 한 번 읽는다). 자동 기록은 「차감이 잡히기 전 이틀 안의 입장」만 찾아서 그 수업이 「사유 없는 차감」으로
--   남았다 — 12월 수업분부터는 이런 건이 수당 보류가 된다.
--
--   고침: 앞 규칙(차감 전 이틀 안의 입장)이 못 찾았을 때만, **차감이 잡힌 그날 · 잡힌 뒤 3시간 안의 첫 입장**을 그 수업으로 본다.
--     · 3시간: 선릉역점 3주 자료 — 차감 뒤 같은 날 다시 들어온 것은 모두 5시간 뒤(다른 일로 온 것)였고, 빈틈 건은 1시간 뒤였다.
--       더 늦은 입장을 이으면 「전날 출석 체크 없이 수업 → 오늘 차감이 읽힘 → 오늘 개인 운동」이 오늘 수업으로 잘못 적힌다.
--     · 이렇게 넣은 기록은 메모가 다르다('차감이 먼저 잡힌 수업 — 그 뒤 입장으로 자동 기록') — 화면 기록 줄에 그대로 보인다.
--     · 그 밖은 그대로: 한 차감은 한 번만(ops_pt_auto_log) · 지운 자동 기록은 되살리지 않음 · 30일 넘은 차감 · 담당 코치 없는
--       차감은 사람 몫 · 예약 ops-pt-auto-record(매시 50분) · 권한.
--   화면 어림(src/lib/opsPtRecord.ts ptGuessClassDay)도 같은 결 — 「사유 없는 차감」 [기록하기]가 그날을 채워 준다.
--
--   **근무 1단계(20261112225136_ops_work_stage1)의 _ops_pt_auto_record 위에 얹었다** — 적용 직전 운영 본문 md5
--   39c8e318fe196ff6a535b087d6067e9a = 그 파일 정의. 달라진 곳은 ③ 안의 ④ 갈래와 메모 한 줄뿐이다.
--   시험: 로컬 Postgres(뼈대 + PT 기록 1단계 + 근무 1단계의 PT 자동 기록 부분 + 이 파일 두 번).

create or replace function public._ops_pt_auto_record()
returns integer language plpgsql security definer set search_path = public as $$
declare
  st record;
  m record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
  v_min date;
  n integer := 0;
  v_sd date[];
  v_st boolean[];
  v_ue uuid[];
  v_uw date[];
  v_ua timestamptz[];
  v_ul integer[];
  v_uc uuid[];
  v_ut text[];
  v_taken date[];
  v_ns integer;
  v_nu integer;
  i integer;
  j integer;
  v_guess date;
  v_sid uuid;
  v_name text;
  v_after boolean;
begin
  for st in select s.branch_name, s.started_on from public.ops_pt_settings s where s.record_on and s.auto_record loop
    v_from := greatest(v_today - 120, st.started_on - 14);   -- ops_pt_record 와 같은 창
    v_min := st.started_on - 14;
    for m in
      select distinct e.member_user_id as uid
        from public.ops_pt_events e
       where e.branch_name = st.branch_name and e.member_user_id is not null
         and e.status in ('auto', 'confirmed') and e.used > 0
         and e.work_date >= greatest(st.started_on, v_today - 30)
    loop
      -- 칸
      select coalesce(array_agg(x.d order by x.d, x.c), '{}'::date[]) into v_sd
        from (select s.session_date as d, s.created_at as c
                from public.ops_pt_sessions s
                cross join lateral generate_series(1, greatest(1, s.uses::int)) g
               where s.branch_name = st.branch_name and s.member_user_id = m.uid and s.status = 'open'
                 and s.kind in ('lesson', 'noshow', 'late_cancel') and s.session_date >= v_from) x;
      v_ns := coalesce(array_length(v_sd, 1), 0);
      v_st := array_fill(false, array[greatest(v_ns, 1)]);
      -- 차감
      select coalesce(array_agg(e.id order by e.work_date, e.detected_at), '{}'::uuid[]),
             coalesce(array_agg(e.work_date order by e.work_date, e.detected_at), '{}'::date[]),
             coalesce(array_agg(e.detected_at order by e.work_date, e.detected_at), '{}'::timestamptz[]),
             coalesce(array_agg(e.used order by e.work_date, e.detected_at), '{}'::integer[]),
             coalesce(array_agg(e.coach_staff_id order by e.work_date, e.detected_at), '{}'::uuid[]),
             coalesce(array_agg(e.ticket_name order by e.work_date, e.detected_at), '{}'::text[])
        into v_ue, v_uw, v_ua, v_ul, v_uc, v_ut
        from public.ops_pt_events e
       where e.branch_name = st.branch_name and e.member_user_id = m.uid
         and e.status in ('auto', 'confirmed') and e.used > 0
         and e.work_date >= greatest(v_from, st.started_on);
      v_nu := coalesce(array_length(v_ue, 1), 0);
      continue when v_nu = 0;

      -- ① 제때(이틀 안)
      for i in 1 .. v_nu loop
        j := 1;
        while v_ul[i] > 0 and j <= v_ns loop
          if not v_st[j] and v_sd[j] <= v_uw[i] and v_uw[i] - v_sd[j] <= 2 then
            v_st[j] := true;
            v_ul[i] := v_ul[i] - 1;
          end if;
          j := j + 1;
        end loop;
      end loop;
      -- ② 늦은 차감 — 더 오래된 기록
      for i in 1 .. v_nu loop
        j := 1;
        while v_ul[i] > 0 and j <= v_ns loop
          if not v_st[j] and v_sd[j] < v_uw[i] then
            v_st[j] := true;
            v_ul[i] := v_ul[i] - 1;
          end if;
          j := j + 1;
        end loop;
      end loop;

      -- ③ 남은 차감 — 입장한 날 어림
      select coalesce(array_agg(distinct s.session_date), '{}'::date[]) into v_taken
        from public.ops_pt_sessions s
       where s.branch_name = st.branch_name and s.member_user_id = m.uid and s.status = 'open';
      for i in 1 .. v_nu loop
        continue when v_ul[i] <= 0;
        select a.d into v_guess
          from (select (l.checked_in_at at time zone 'Asia/Seoul')::date as d, min(l.checked_in_at) as first_at
                  from public.attendance_logs l
                 where l.branch_name = st.branch_name and l.user_id = m.uid and not coalesce(l.is_duplicate, false)
                   and l.checked_in_at >= ((v_uw[i] - 2)::timestamp at time zone 'Asia/Seoul')
                   and l.checked_in_at < ((v_uw[i] + 1)::timestamp at time zone 'Asia/Seoul')
                 group by 1) a
         where a.first_at < v_ua[i] and a.d >= v_min and not (a.d = any(v_taken))
         order by a.d desc
         limit 1;
        v_after := false;
        if v_guess is null then
          -- ④ 차감이 먼저 잡힌 수업 — 그날, 차감이 잡힌 뒤 3시간 안의 첫 입장
          --    (코치가 수업 직전에 차감했고 입장보다 먼저 차감이 읽힌 경우 · 더 늦은 입장은 다른 날 수업일 수 있어 잇지 않는다)
          select a.d into v_guess
            from (select (l.checked_in_at at time zone 'Asia/Seoul')::date as d, min(l.checked_in_at) as first_at
                    from public.attendance_logs l
                   where l.branch_name = st.branch_name and l.user_id = m.uid and not coalesce(l.is_duplicate, false)
                     and l.checked_in_at >= (v_uw[i]::timestamp at time zone 'Asia/Seoul')
                     and l.checked_in_at < ((v_uw[i] + 1)::timestamp at time zone 'Asia/Seoul')
                   group by 1) a
           where a.first_at >= v_ua[i] and a.first_at < v_ua[i] + interval '3 hours'
             and a.d >= v_min and not (a.d = any(v_taken));
          v_after := v_guess is not null;
        end if;
        continue when v_guess is null;
        v_taken := v_taken || v_guess;                -- 넣지 않고 넘겨도 그 입장은 이 차감 몫(화면과 같게)
        continue when v_uw[i] < v_today - 30;         -- 오래된 차감은 사람 몫
        continue when v_uc[i] is null;                -- 담당 코치가 없으면 지점장 몫
        continue when exists (select 1 from public.ops_pt_auto_log g where g.event_id = v_ue[i]);   -- 한 번 넣은 차감은 다시 안 넣는다
        select coalesce(nullif(btrim(p.name), ''), '회원') into v_name from public.profiles p where p.user_id = m.uid;
        begin
          insert into public.ops_pt_sessions (branch_name, coach_staff_id, member_user_id, member_name, ticket_name,
                                              session_date, kind, uses, note, source)
          values (st.branch_name, v_uc[i], m.uid, left(coalesce(v_name, '회원'), 40), left(v_ut[i], 80),
                  v_guess, 'lesson', least(greatest(v_ul[i], 1), 4),
                  case when v_after then '차감이 먼저 잡힌 수업 — 그 뒤 입장으로 자동 기록' else '자동 기록 — 브로제이 차감 + 그날 입장' end, 'auto')
          returning id into v_sid;
          insert into public.ops_pt_auto_log (event_id, session_id) values (v_ue[i], v_sid);
          n := n + 1;
        exception when unique_violation then
          null;   -- 그사이 그날 기록이 들어왔다
        end;
      end loop;
    end loop;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_auto_record: %', sqlerrm;
  return -1;
end $$;

revoke all on function public._ops_pt_auto_record() from public, anon, authenticated;
