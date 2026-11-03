-- 153운영본부 「매출」 탭 · 순이익 (2026-11-04 대표님 "153가계부랑 연동해서 선릉역점 통장내역 올리면 순이익도 계산하자"
--   → 「가계부에 올리기」 · 「매출 − 사업 비용」)
--
--   153가계부(153-gagyebu.pages.dev)는 10/29 판부터 기록을 그 기기 안에만 둔다(서버 연결 없음).
--   그래서 가계부 › 설정 › '엑셀용 CSV'(전체 내역 내보내기) 파일을 매출 탭에 올리면, 화면(브라우저)이 그 파일을 읽어
--   사업 장부 · 고른 매장의 지출만 달 · 항목별로 더하고 그 합계만 여기에 저장한다(ops_costs_save) — 거래 하나하나 · 개인 장부는 서버로 안 온다.
--   순이익(매출 − 비용)은 화면이 계산한다(매출 = Edge Function ops-sales).
--   보고 · 저장하는 사람 = 돈을 보는 분(_ops_can_see_pay — 대표님 · 회계매니저, 10-29 규칙). 지점장 · 코치님은 못 본다.
--   새 표 2 · 새 함수 3 (기존 함수 · 표는 그대로).

create table if not exists public.ops_branch_costs (
  branch_name text not null references public.ops_branches(branch_name) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category text not null check (category ~ '^[a-z][a-z0-9_]*$' and char_length(category) <= 24),
  label text not null check (char_length(label) between 1 and 24),
  amount bigint not null check (amount > -100000000000 and amount < 100000000000),
  count integer not null default 0 check (count between 0 and 100000),
  primary key (branch_name, month, category)
);

create table if not exists public.ops_branch_cost_months (
  branch_name text not null references public.ops_branches(branch_name) on delete cascade,
  month date not null check (extract(day from month) = 1),
  source text not null default 'gagyebu_csv' check (source in ('gagyebu_csv')),
  stores text[] not null default '{}',        -- 가계부에서 고른 매장 이름
  no_store boolean not null default false,     -- 매장을 안 적은 사업 지출도 넣었나
  skipped text[] not null default '{}',        -- 뺀 항목(예: loan 대출·금융)
  total bigint not null default 0,
  saved_by uuid,
  saved_at timestamptz not null default now(),
  primary key (branch_name, month)
);

alter table public.ops_branch_costs enable row level security;
alter table public.ops_branch_cost_months enable row level security;
revoke all on public.ops_branch_costs from anon, authenticated;
revoke all on public.ops_branch_cost_months from anon, authenticated;

-- 저장 — 보낸 달은 통째로 바꾼다(같은 달을 다시 올리면 새 값). 보내지 않은 달은 그대로.
--   p_months = [{ "month": "2026-10", "cats": [{ "k": "bpay", "label": "인건비", "amount": 3300000, "count": 4 }, …] }, …]
--   p_meta   = { "stores": ["153복싱짐 선릉역점"], "no_store": false, "excluded": ["loan", "save"] }
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
  v_amount numeric;
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
    values (p_branch, v_month, 'gagyebu_csv', v_stores, coalesce((p_meta->>'no_store')::boolean, false), v_skipped, v_total, v_uid, now())
    on conflict (branch_name, month) do update
      set source = excluded.source, stores = excluded.stores, no_store = excluded.no_store, skipped = excluded.skipped,
          total = excluded.total, saved_by = excluded.saved_by, saved_at = excluded.saved_at;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'months', v_n);
end $$;

-- 읽기 — 그 지점 · 기간의 달별 비용(항목) + 올린 정보
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
               'month', to_char(m.month, 'YYYY-MM'), 'total', m.total, 'stores', to_jsonb(m.stores), 'no_store', m.no_store,
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

-- 한 달 지우기(잘못 올렸을 때)
create or replace function public.ops_costs_clear(p_branch text, p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
begin
  if v_uid is null or not public._ops_can_see_pay(v_uid, p_branch) then
    raise exception '매출은 대표님 · 회계매니저만 볼 수 있어요' using errcode = '42501';
  end if;
  delete from public.ops_branch_costs where branch_name = p_branch and month = v_month;
  delete from public.ops_branch_cost_months where branch_name = p_branch and month = v_month;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.ops_costs_save(text, jsonb, jsonb) from public, anon;
revoke all on function public.ops_costs(text, date, date) from public, anon;
revoke all on function public.ops_costs_clear(text, date) from public, anon;
grant execute on function public.ops_costs_save(text, jsonb, jsonb) to authenticated;
grant execute on function public.ops_costs(text, date, date) to authenticated;
grant execute on function public.ops_costs_clear(text, date) to authenticated;
