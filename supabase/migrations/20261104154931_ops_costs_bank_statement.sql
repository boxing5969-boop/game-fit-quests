-- 153운영본부 「매출」 순이익 — 통장 내역서로 정리한 비용도 담기
--   (2026-11-04 대표님 "이게 선릉점 지금까지 거래내역서야" — 선릉역점 통장 내역서)
--   클로드가 통장 내역서를 나눠 달 · 항목 합계만 저장한다(거래 하나하나 · 파일은 서버 · 저장소에 두지 않음).
--   ① ops_branch_cost_months.source 에 'bank_statement'(통장 내역서) 추가
--   ② ops_costs_save: p_meta.source(없거나 모르는 값이면 gagyebu_csv) · 달마다 뺀 것 p_months[].excluded(없으면 p_meta.excluded)
--   ③ ops_costs: 달마다 source 도 돌려줌 → 화면 아래 줄 '통장 내역 ○월 ○일 정리'
--   권한(_ops_can_see_pay) · 가계부 CSV 올리기 동작은 그대로. 바탕 = DB 의 지금 정의(20261104004636 과 같음).

alter table public.ops_branch_cost_months drop constraint if exists ops_branch_cost_months_source_check;
alter table public.ops_branch_cost_months add constraint ops_branch_cost_months_source_check
  check (source in ('gagyebu_csv', 'bank_statement'));

create or replace function public.ops_costs_save(p_branch text, p_months jsonb, p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m jsonb;
  v_c jsonb;
  v_month date;
  v_total bigint;
  v_n integer := 0;
  v_stores text[];
  v_skipped text[];
  v_month_skipped text[];
  v_amount numeric;
  v_source text := case when p_meta->>'source' = 'bank_statement' then 'bank_statement' else 'gagyebu_csv' end;
begin
  if v_uid is null or not public._ops_can_see_pay(v_uid, p_branch) then
    raise exception '매출은 대표님 · 회계매니저만 볼 수 있어요' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = p_branch and b.enabled) then
    raise exception '지점을 찾을 수 없어요';
  end if;
  if p_months is null or jsonb_typeof(p_months) <> 'array' then
    raise exception '저장할 달이 없어요';
  end if;
  if jsonb_array_length(p_months) = 0 or jsonb_array_length(p_months) > 36 then
    raise exception '한 번에 1~36개월까지 저장할 수 있어요';
  end if;

  select coalesce(array_agg(left(x, 24)), '{}') into v_stores
    from (select jsonb_array_elements_text(case when jsonb_typeof(p_meta->'stores') = 'array' then p_meta->'stores' else '[]'::jsonb end) x limit 20) s;
  select coalesce(array_agg(left(x, 24)), '{}') into v_skipped
    from (select jsonb_array_elements_text(case when jsonb_typeof(p_meta->'excluded') = 'array' then p_meta->'excluded' else '[]'::jsonb end) x limit 40) s;

  for v_m in select value from jsonb_array_elements(p_months) loop
    if coalesce(v_m->>'month', '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception '달 모양이 이상해요';
    end if;
    v_month := to_date((v_m->>'month') || '-01', 'YYYY-MM-DD');
    if v_month < date '2015-01-01' or v_month > (date_trunc('month', now() at time zone 'Asia/Seoul')::date + interval '1 month')::date then
      raise exception '저장할 수 없는 달이에요';
    end if;
    if jsonb_typeof(v_m->'cats') <> 'array' or jsonb_array_length(v_m->'cats') > 40 then
      raise exception '항목이 너무 많아요';
    end if;
    -- 이 달에 뺀 것(통장 내역서는 달마다 다르다) — 없으면 p_meta 것
    if jsonb_typeof(v_m->'excluded') = 'array' then
      select coalesce(array_agg(left(x, 24)), '{}') into v_month_skipped
        from (select jsonb_array_elements_text(v_m->'excluded') x limit 40) s;
    else
      v_month_skipped := v_skipped;
    end if;

    delete from public.ops_branch_costs where branch_name = p_branch and month = v_month;
    for v_c in select value from jsonb_array_elements(v_m->'cats') loop
      if coalesce(v_c->>'k', '') !~ '^[a-z][a-z0-9_]*$' or char_length(v_c->>'k') > 24 then
        raise exception '항목 이름이 이상해요';
      end if;
      if jsonb_typeof(v_c->'amount') <> 'number' then
        raise exception '금액이 이상해요';
      end if;
      v_amount := round((v_c->>'amount')::numeric);
      if v_amount <= -100000000000 or v_amount >= 100000000000 then
        raise exception '금액이 너무 커요';
      end if;
      insert into public.ops_branch_costs (branch_name, month, category, label, amount, count)
      values (
        p_branch, v_month, v_c->>'k',
        coalesce(nullif(left(btrim(coalesce(v_c->>'label', '')), 24), ''), v_c->>'k'),
        v_amount::bigint,
        least(greatest(coalesce(case when jsonb_typeof(v_c->'count') = 'number' then (v_c->>'count')::numeric end, 0), 0), 100000)::integer
      )
      on conflict (branch_name, month, category) do update
        set amount = public.ops_branch_costs.amount + excluded.amount,
            count = least(public.ops_branch_costs.count + excluded.count, 100000);
    end loop;

    select coalesce(sum(amount), 0) into v_total from public.ops_branch_costs where branch_name = p_branch and month = v_month;
    insert into public.ops_branch_cost_months (branch_name, month, source, stores, no_store, skipped, total, saved_by, saved_at)
    values (p_branch, v_month, v_source, v_stores, coalesce((p_meta->>'no_store')::boolean, false), v_month_skipped, v_total, v_uid, now())
    on conflict (branch_name, month) do update
      set source = excluded.source, stores = excluded.stores, no_store = excluded.no_store, skipped = excluded.skipped,
          total = excluded.total, saved_by = excluded.saved_by, saved_at = excluded.saved_at;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'months', v_n);
end $$;

create or replace function public.ops_costs(p_branch text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public._ops_can_see_pay(v_uid, p_branch) then
    raise exception '매출은 대표님 · 회계매니저만 볼 수 있어요' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 1200 then
    raise exception '기간이 이상해요';
  end if;
  return jsonb_build_object(
    'months', coalesce((
      select jsonb_agg(jsonb_build_object(
               'month', to_char(m.month, 'YYYY-MM'), 'total', m.total, 'source', m.source, 'stores', to_jsonb(m.stores), 'no_store', m.no_store,
               'excluded', to_jsonb(m.skipped), 'saved_at', m.saved_at,
               'saved_by', (select nullif(btrim(p.name), '') from public.profiles p where p.user_id = m.saved_by))
             order by m.month)
        from public.ops_branch_cost_months m
       where m.branch_name = p_branch and m.month between date_trunc('month', p_from)::date and p_to), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(c.month, 'YYYY-MM'), 'k', c.category, 'label', c.label, 'amount', c.amount, 'count', c.count)
             order by c.month, c.amount desc)
        from public.ops_branch_costs c
       where c.branch_name = p_branch and c.month between date_trunc('month', p_from)::date and p_to), '[]'::jsonb));
end $$;

revoke all on function public.ops_costs_save(text, jsonb, jsonb) from public, anon;
revoke all on function public.ops_costs(text, date, date) from public, anon;
grant execute on function public.ops_costs_save(text, jsonb, jsonb) to authenticated;
grant execute on function public.ops_costs(text, date, date) to authenticated;
