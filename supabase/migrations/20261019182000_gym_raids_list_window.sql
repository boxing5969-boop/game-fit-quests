-- 우리 지점 목표 목록 — 다 채운 목표가 끝없이 쌓이지 않게 (2026-10-19 검수)
--   진행 중인 목표는 늘 보이고, 다 채운 목표는 끝난 날부터 30일까지만 보인다.
--   단, 내가 기여했는데 아직 보상을 안 받은 목표는 기간이 지나도 보인다 (보상 받을 길을 막지 않게).
do $$
declare
  v_def text;
  v_old text := $o$   where r.branch_name = v_branch
     and r.status in ('active', 'completed');$o$;
  v_new text := $n$   where r.branch_name = v_branch
     and (r.status = 'active'
          or (r.status = 'completed'
              and (r.end_date >= (now() at time zone 'Asia/Seoul')::date - 30
                   or (coalesce(c.my_count, 0) > 0 and cl.id is null))));$n$;
begin
  v_def := pg_get_functiondef('public.get_branch_gym_raids(text)'::regprocedure);
  if v_def like '%- 30%' then
    return; -- 이미 반영됨
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'get_branch_gym_raids — 바꿀 자리를 정확히 한 곳 찾지 못함';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
