-- 153운영본부 · PT 기록 — 아침 10시 「이틀 넘은 확인 필요」 알림이 갓 잡힌 차감까지 세던 것 고침
--   (2026-11-12 첫날 점검: 지점을 켠 날 10:00 에, 그날 새벽에 잡힌 차감 2회가 「이틀 넘은 확인 필요 · 사유 없는 차감 2회」로 나갔다.
--    제목은 '이틀 넘은'인데 몇 시간 된 차감이었다 — 받은 분이 급한 일로 읽게 된다. 대표님 11/12 밤 「추천대로 진행할게」)
--
--   원인: _ops_pt_overdue 의 '사유 없는 차감' 셈이 시작일 뒤 모든 차감(d)을 모든 기록(c_all)과 견줬다 — 차감이 언제 잡혔는지 보지 않았다.
--         같은 알림의 '기록 없는 입장' · '차감 대기'는 처음부터 날짜를 봤다.
--   고침: 사흘 전까지 잡힌 차감(이틀이 꽉 지난 것)만 세고, 그 차감을 설명할 수 있는 기록(사흘 전까지의 기록 = c_pre + c_old)과 견준다.
--         더 새 기록은 옛 차감을 설명하지 못한다 — 화면 짝짓기(src/lib/opsPtRecord.ts matchPtRecord)의
--         「기록보다 앞선 차감은 그 기록과 짝짓지 않는다」와 같은 결.
--   자동 기록을 켠 지점도 같다: 입장이 있는 차감은 한 시간 안에 저절로 기록이 생기고, 입장이 없어 기록이 안 생긴 차감만
--         이틀이 꽉 지난 뒤 이 알림에 잡힌다(그 전에는 밤 10시 요약이 코치에게 알린다).
--
--   이 파일은 20261112225136_ops_work_stage1.sql 의 _ops_pt_overdue(자동 기록을 켠 지점은 입장 확인을 하루 더 기다림) **위에** 얹는다 —
--   그 정의에서 '사유 없는 차감' 셈 한 곳만 다르다. 나머지 줄은 한 글자도 바꾸지 않았다.
--   그대로인 것: 밤 10시 요약(_ops_pt_nightly — 코치에게 '사유 없는 차감 n회')은 그날 바로 알려 주는 것이 맞아 손대지 않았다.
--               _ops_pt_balance · 표 · 예약(ops-pt-overdue 10:00 KST) · 권한도 그대로 — 이 함수 하나만 create or replace.
--   서버 알림은 여전히 개수만 견주는 어림이다 — 화면 숫자가 정본.

create or replace function public._ops_pt_overdue()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_miss integer;
  v_wait integer;
  v_extra integer;
  v_rows integer;
begin
  for r in select st.branch_name, st.started_on, st.auto_record as auto from public.ops_pt_settings st where st.record_on and st.notify_on
  loop
    -- 이틀 넘게 '수업이었는지' 답이 없는 입장(회원 · 날짜)
    select count(*) into v_miss from (
      select distinct l.user_id, (l.checked_in_at at time zone 'Asia/Seoul')::date as d
        from public.attendance_logs l
        join public.profiles p on p.user_id = l.user_id and p.pt_ticket is not null
                              and not coalesce(p.is_test_account, false) and not coalesce(p.is_staff, false)
       where l.branch_name = r.branch_name
         and l.checked_in_at >= (r.started_on::timestamp at time zone 'Asia/Seoul')
         and l.checked_in_at < ((v_today - case when r.auto then 2 else 1 end)::timestamp at time zone 'Asia/Seoul')
         and not coalesce(l.is_duplicate, false)) a
     where not exists (select 1 from public.ops_pt_sessions s
                        where s.branch_name = r.branch_name and s.member_user_id = a.user_id
                          and s.session_date = a.d and s.status = 'open');
    -- 아침 10시: 사흘 전까지의 것(이틀이 꽉 지난 것)만 본다
    --   차감 대기       = 사흘 전까지의 수업 가운데 차감이 아직 안 잡힌 것
    --   사유 없는 차감 = 사흘 전까지 잡힌 차감 가운데, 사흘 전까지의 기록(시작 앞 기록 · 자동 기록 포함)으로 설명이 안 되는 것
    select coalesce(sum(greatest(b.c_old - greatest(b.d - b.c_pre, 0), 0)), 0)::int,
           coalesce(sum(greatest(coalesce(o.d_old, 0) - b.c_pre - b.c_old, 0)), 0)::int
      into v_wait, v_extra
      from public._ops_pt_balance(r.branch_name, null, r.started_on, v_today - 3) b
      left join (
        select coalesce(x.member_user_id::text, 'name:' || x.member_name) as k, sum(x.used)::int as d_old
          from public.ops_pt_events x
         where x.branch_name = r.branch_name and x.status in ('auto', 'confirmed')
           and x.work_date >= r.started_on and x.work_date <= v_today - 3
         group by 1) o on o.k = b.member_key;

    if v_miss + v_wait + v_extra > 0 then
      insert into public.ops_pt_notices (kind, ref, user_id)
      values ('overdue', r.branch_name || ':' || v_today::text, '00000000-0000-0000-0000-000000000000')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        perform public._ops_notify_managers(r.branch_name, 'PT 기록 · 이틀 넘은 확인 필요',
          concat_ws(' · ',
            replace(r.branch_name, '153복싱짐 ', ''),
            case when v_miss > 0 then '기록 없는 입장 ' || v_miss || '건' end,
            case when v_wait > 0 then '차감 대기 ' || v_wait || '건' end,
            case when v_extra > 0 then '사유 없는 차감 ' || v_extra || '회' end));
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
exception when others then
  raise warning '_ops_pt_overdue: %', sqlerrm;
  return -1;
end $$;

-- create or replace 는 권한을 그대로 두지만, 이 파일만 다시 돌려도 같은 상태가 되게 한 번 더 막는다
revoke all on function public._ops_pt_overdue() from public, anon, authenticated;
