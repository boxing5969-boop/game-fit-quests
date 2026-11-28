-- 사업자 가계부 (2026-11-28 대표님 「전체 메뉴에 사업자 별로 153복싱짐 칠금점 153복싱짐 선릉역점 등등 사업자 가계부 내역을
--   만들고 따로 관리할수있는 도록 메뉴 만들어줘」 → 계획 7줄 「진행」)
--
--   사업자(biz_books)마다 가계부 줄(biz_entries): 지출 out · 수입 in · 돌려받음 back · 이동 move(내 통장끼리 · 개인 — 계산 안 함).
--   153가계부(휴대폰 안에만)와 달리 줄 하나하나가 서버에 있다 → 운영본부 순이익 · 회계관리 엑셀 · 클로드가 같은 숫자를 본다.
--   보는 · 쓰는 사람 = 돈을 보는 분: 대표님(_strategy_hq) · 회계매니저(ops_managers.title '회계매니저', 지점이 정해진 분은 그 지점 사업자만).
--   표는 함수로만(RLS 켬 · anon/authenticated 권한 없음). 계좌번호는 저장하지 않는다(통장 이름만).
--
--   운영본부 「매출」 순이익: 사업자에 지점을 잇고 costs_live 를 켜면 그 지점 달 · 항목 비용(ops_branch_costs)을 이 가계부가 채운다(_biz_sync).
--     비용 = 항목마다 지출 − 돌려받음. 수입 · 이동은 비용이 아니다. 달 = 귀속 월(month — 급여는 일한 달로 넣을 수 있다).
--     켠 지점은 예전 「가계부 CSV 올리기」(ops_costs_save · ops_costs_clear)를 막는다 — 두 곳이 같은 달을 덮지 않게.
--   같은 거래 두 번 막기: 파일에서 온 줄은 지문(fp — 날짜 · 금액 · 상대 · 통장 · 잔액 …)으로 한 번만(biz_import).
--   새 표 3 · 새 함수 · ops_branch_cost_months.source 에 'ledger' 추가 · ops_costs_save / ops_costs_clear 에 막는 줄 하나.

create table if not exists public.biz_books (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_name text not null default '' check (char_length(owner_name) <= 20),
  kind text not null default 'personal' check (kind in ('personal', 'corp')),   -- 개인사업자 · 법인
  branch_name text references public.ops_branches(branch_name) on delete set null, -- 운영본부 순이익과 잇는 지점(없으면 안 이음)
  costs_live boolean not null default false,                                    -- 켜면 그 지점 순이익 비용을 이 가계부가 채운다
  accounts text[] not null default '{}',                                        -- 통장 · 카드 이름(번호 없이)
  sort integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index if not exists biz_books_branch_uq on public.biz_books (branch_name) where branch_name is not null and archived_at is null;
create unique index if not exists biz_books_name_uq on public.biz_books (lower(btrim(name))) where archived_at is null;

create table if not exists public.biz_entries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.biz_books(id) on delete cascade,
  day date not null,
  month date not null check (extract(day from month) = 1),                       -- 귀속 월
  kind text not null check (kind in ('out', 'in', 'back', 'move')),
  cat text not null check (cat ~ '^[a-z][a-z0-9_]*$' and char_length(cat) <= 24),
  amount bigint not null check (amount > 0 and amount < 100000000000),
  n integer not null default 1 check (n between 1 and 100000),                   -- 합계 줄이면 몇 건
  party text not null default '' check (char_length(party) <= 60),               -- 받는 · 보낸 사람(곳)
  memo text not null default '' check (char_length(memo) <= 200),
  account text not null default '' check (char_length(account) <= 30),
  staff_id uuid references public.ops_staff(id) on delete set null,              -- 인건비면 그 근무자
  wht bigint check (wht is null or (wht >= 0 and wht < 100000000000)),            -- 원천세(3.3%) 참고 — 비용 계산에는 안 씀
  source text not null default 'manual' check (source in ('manual', 'gagyebu_csv', 'bank_file', 'summary')),
  fp text check (fp is null or char_length(fp) between 8 and 80),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists biz_entries_fp_uq on public.biz_entries (book_id, fp) where fp is not null;
create index if not exists biz_entries_book_month on public.biz_entries (book_id, month);

create table if not exists public.biz_rules (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.biz_books(id) on delete cascade,
  keyword text not null check (char_length(btrim(keyword)) between 1 and 30),
  kind text not null default 'out' check (kind in ('out', 'in', 'back', 'move')),
  cat text not null check (cat ~ '^[a-z][a-z0-9_]*$' and char_length(cat) <= 24),
  staff_id uuid references public.ops_staff(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists biz_rules_key on public.biz_rules (book_id, (lower(keyword)));

alter table public.biz_books enable row level security;
alter table public.biz_entries enable row level security;
alter table public.biz_rules enable row level security;
revoke all on public.biz_books from anon, authenticated;
revoke all on public.biz_entries from anon, authenticated;
revoke all on public.biz_rules from anon, authenticated;

-- 순이익 카드 아래 줄 — 사업자 가계부에서 온 달
alter table public.ops_branch_cost_months drop constraint if exists ops_branch_cost_months_source_check;
alter table public.ops_branch_cost_months add constraint ops_branch_cost_months_source_check
  check (source in ('gagyebu_csv', 'bank_statement', 'ledger'));

-- ── 안쪽 함수 ─────────────────────────────────────────────

-- 항목 키 → 이름 (화면 src/lib/bizLedger.ts BIZ_CAT_LABEL 과 같게)
create or replace function public._biz_cat_label(_k text)
returns text language sql immutable set search_path = public as $$
  select case _k
    when 'bpay' then '인건비' when 'brent' then '임대료' when 'butil' then '공과금·렌탈' when 'bfee' then '세무·수수료'
    when 'bins' then '4대보험' when 'insure' then '보험' when 'tax' then '세금' when 'bclean' then '청소·세탁·방역'
    when 'bad' then '광고·마케팅' when 'bsupply' then '용품·장비' when 'brefund' then '회원 환불(통장)'
    when 'bsend' then '인건비·시설(개인 송금)' when 'house' then '숙소·관리비' when 'phone' then '통신·구독'
    when 'car' then '교통·차량' when 'food' then '식비' when 'card' then '카드대금' when 'epay' then '간편결제'
    when 'loan' then '대출·금융' when 'cafe' then '카페·간식' when 'living' then '생활·마트' when 'health' then '의료·건강'
    when 'kids' then '자녀·교육' when 'gift' then '경조사·선물' when 'shop' then '쇼핑·의류' when 'fun' then '여가·여행'
    when 'save' then '저축·투자' when 'sales' then '매출 입금' when 'subsidy' then '지원금' when 'move' then '내 통장 · 개인'
    else '기타' end;
$$;

-- 'YYYY-MM' → 그달 1일 (모양이 이상하거나 비면 이번 달)
create or replace function public._biz_month(_m text)
returns date language sql stable set search_path = public as $$
  select case when coalesce(_m, '') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then to_date(_m || '-01', 'YYYY-MM-DD')
              else date_trunc('month', now() at time zone 'Asia/Seoul')::date end;
$$;

-- 모든 사업자를 보는 분(대표님 · 지점이 안 정해진 회계매니저)
create or replace function public._biz_hq(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null
     and (public._strategy_hq(_uid)
          or exists (select 1 from public.ops_managers m where m.user_id = _uid and m.title = '회계매니저' and m.branch_name is null));
$$;

-- 사업자 가계부를 쓸 수 있는 분(대표님 · 회계매니저)
create or replace function public._biz_any(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null
     and (public._strategy_hq(_uid)
          or exists (select 1 from public.ops_managers m where m.user_id = _uid and m.title = '회계매니저'));
$$;

-- 이 사업자를 볼 수 있나(보관한 사업자는 안 보인다)
create or replace function public._biz_can_book(_uid uuid, _book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid is not null and exists (
    select 1 from public.biz_books b
     where b.id = _book and b.archived_at is null
       and (public._strategy_hq(_uid)
            or exists (select 1 from public.ops_managers m
                        where m.user_id = _uid and m.title = '회계매니저'
                          and (m.branch_name is null or m.branch_name = b.branch_name))));
$$;

-- 줄 한 개 검사 → 행 모양(아이디 · 사업자 · 출처 · 지문은 부르는 쪽이 채움)
create or replace function public._biz_entry_row(p jsonb)
returns public.biz_entries language plpgsql stable set search_path = public as $$
declare
  e public.biz_entries;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if coalesce(p->>'day', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception '날짜가 이상해요';
  end if;
  e.day := (p->>'day')::date;
  if e.day < date '2015-01-01' or e.day > v_today + 62 then
    raise exception '날짜가 이상해요';
  end if;
  e.month := case when coalesce(p->>'month', '') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then to_date(p->>'month' || '-01', 'YYYY-MM-DD')
                  else date_trunc('month', e.day)::date end;
  if e.month < date '2015-01-01' or e.month > date_trunc('month', v_today + 62)::date then
    raise exception '귀속 월이 이상해요';
  end if;
  e.kind := p->>'kind';
  if e.kind is null or e.kind not in ('out', 'in', 'back', 'move') then
    raise exception '구분이 이상해요';
  end if;
  e.cat := coalesce(nullif(p->>'cat', ''), case e.kind when 'in' then 'sales' when 'move' then 'move' else 'etc' end);
  if e.cat !~ '^[a-z][a-z0-9_]*$' or char_length(e.cat) > 24 then
    raise exception '항목이 이상해요';
  end if;
  if jsonb_typeof(p->'amount') is distinct from 'number' then
    raise exception '금액이 이상해요';
  end if;
  e.amount := round((p->>'amount')::numeric);
  if e.amount <= 0 or e.amount >= 100000000000 then
    raise exception '금액이 이상해요';
  end if;
  e.n := case when jsonb_typeof(p->'n') = 'number' then least(greatest(round((p->>'n')::numeric), 1), 100000)::int else 1 end;
  e.party := left(btrim(coalesce(p->>'party', '')), 60);
  e.memo := left(btrim(coalesce(p->>'memo', '')), 200);
  e.account := left(btrim(coalesce(p->>'account', '')), 30);
  e.staff_id := case when coalesce(p->>'staff_id', '') ~ '^[0-9a-fA-F-]{36}$' then (p->>'staff_id')::uuid end;
  if e.staff_id is not null and not exists (select 1 from public.ops_staff s where s.id = e.staff_id) then
    e.staff_id := null;
  end if;
  e.wht := case when jsonb_typeof(p->'wht') = 'number' and (p->>'wht')::numeric >= 0 and (p->>'wht')::numeric < 100000000000
                then round((p->>'wht')::numeric)::bigint end;
  return e;
end $$;

-- 이 사업자 · 이 달 → 이어진 지점 순이익 비용(ops_branch_costs). 순이익 연결(costs_live)이 꺼져 있으면 아무것도 안 한다.
create or replace function public._biz_sync(_book uuid, _month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.biz_books;
  v_total bigint;
begin
  select * into b from public.biz_books where id = _book;
  if not found or not b.costs_live or b.branch_name is null or b.archived_at is not null then
    return;
  end if;
  delete from public.ops_branch_costs where branch_name = b.branch_name and month = _month;
  insert into public.ops_branch_costs (branch_name, month, category, label, amount, count)
  select b.branch_name, _month, e.cat, public._biz_cat_label(e.cat),
         sum(case when e.kind = 'out' then e.amount else -e.amount end)::bigint,
         least(sum(case when e.kind = 'out' then e.n else 0 end), 100000)::int
    from public.biz_entries e
   where e.book_id = _book and e.month = _month and e.kind in ('out', 'back')
   group by e.cat
  having sum(case when e.kind = 'out' then e.amount else -e.amount end) <> 0
      or sum(case when e.kind = 'out' then e.n else 0 end) > 0;

  if not exists (select 1 from public.ops_branch_costs where branch_name = b.branch_name and month = _month) then
    delete from public.ops_branch_cost_months where branch_name = b.branch_name and month = _month;
    return;
  end if;
  select coalesce(sum(amount), 0) into v_total from public.ops_branch_costs where branch_name = b.branch_name and month = _month;
  insert into public.ops_branch_cost_months (branch_name, month, source, stores, no_store, skipped, total, saved_by, saved_at)
  values (b.branch_name, _month, 'ledger', '{}', false, '{}', v_total, auth.uid(), now())
  on conflict (branch_name, month) do update
    set source = 'ledger', stores = '{}', no_store = false, total = excluded.total,
        saved_by = excluded.saved_by, saved_at = excluded.saved_at;   -- skipped(예전에 뺀 것 표시)은 그대로 둔다
end $$;

-- 사업자의 모든 달 다시 맞추기(순이익 연결을 켤 때)
create or replace function public._biz_sync_all(_book uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_m date;
  v_n integer := 0;
begin
  for v_m in select distinct e.month from public.biz_entries e where e.book_id = _book order by 1 loop
    perform public._biz_sync(_book, v_m);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ── 화면이 부르는 함수 ────────────────────────────────────

-- 첫 화면 — 사업자 카드(이 달 지출 · 수입 · 줄 수) · 사업자를 더할 수 있나 · 이을 수 있는 지점
create or replace function public.biz_home(p_month text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month date := public._biz_month(p_month);
begin
  if v_uid is null or not public._biz_any(v_uid) then
    raise exception '사업자 가계부는 대표님 · 회계매니저만 볼 수 있어요' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ok', true,
    'month', to_char(v_month, 'YYYY-MM'),
    'can_add', public._biz_hq(v_uid),
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'name', b.name, 'owner_name', b.owner_name, 'kind', b.kind, 'branch', b.branch_name,
               'costs_live', b.costs_live, 'accounts', to_jsonb(b.accounts),
               'out', coalesce(t.out_amt, 0), 'back', coalesce(t.back_amt, 0), 'in', coalesce(t.in_amt, 0), 'n', coalesce(t.n, 0),
               'last_day', (select max(e.day) from public.biz_entries e where e.book_id = b.id))
             order by b.sort, b.created_at)
        from public.biz_books b
        left join lateral (
          select sum(e.amount) filter (where e.kind = 'out') as out_amt,
                 sum(e.amount) filter (where e.kind = 'back') as back_amt,
                 sum(e.amount) filter (where e.kind = 'in') as in_amt,
                 count(*) as n
            from public.biz_entries e
           where e.book_id = b.id and e.month = v_month) t on true
       where b.archived_at is null and public._biz_can_book(v_uid, b.id)), '[]'::jsonb),
    'branches', coalesce((select jsonb_agg(ob.branch_name order by ob.branch_name) from public.ops_branches ob where ob.enabled), '[]'::jsonb));
end $$;

-- 사업자 더하기 · 고치기 — p = { id?, name, owner_name, kind, branch, costs_live, accounts[] }
create or replace function public.biz_book_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := case when coalesce(p->>'id', '') ~ '^[0-9a-fA-F-]{36}$' then (p->>'id')::uuid end;
  v_name text := left(btrim(coalesce(p->>'name', '')), 40);
  v_owner text := left(btrim(coalesce(p->>'owner_name', '')), 20);
  v_kind text := case when p->>'kind' = 'corp' then 'corp' else 'personal' end;
  v_branch text := nullif(btrim(coalesce(p->>'branch', '')), '');
  v_live boolean := coalesce(p->>'costs_live', '') = 'true';
  v_accounts text[];
  v_old public.biz_books;
begin
  if v_uid is null or not public._biz_any(v_uid) then
    raise exception '사업자 가계부는 대표님 · 회계매니저만 쓸 수 있어요' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 then
    raise exception '사업자 이름을 적어 주세요';
  end if;
  if v_branch is not null and not exists (select 1 from public.ops_branches b where b.branch_name = v_branch and b.enabled) then
    raise exception '지점을 찾을 수 없어요';
  end if;
  if v_branch is null then
    v_live := false;
  end if;
  select coalesce(array_agg(a order by a), '{}') into v_accounts
    from (select distinct left(btrim(x), 30) as a
            from jsonb_array_elements_text(case when jsonb_typeof(p->'accounts') = 'array' then p->'accounts' else '[]'::jsonb end) x
           where btrim(x) <> '' limit 10) s;

  if v_id is null then
    if not public._biz_hq(v_uid) then
      raise exception '사업자는 대표님만 더할 수 있어요' using errcode = '42501';
    end if;
    insert into public.biz_books (name, owner_name, kind, branch_name, costs_live, accounts, sort, created_by)
    values (v_name, v_owner, v_kind, v_branch, v_live, v_accounts,
            coalesce((select max(sort) + 1 from public.biz_books), 0), v_uid)
    returning id into v_id;
  else
    select * into v_old from public.biz_books where id = v_id;
    if not found or not public._biz_can_book(v_uid, v_id) then
      raise exception '사업자를 찾을 수 없어요' using errcode = '42501';
    end if;
    if (v_old.branch_name is distinct from v_branch or v_old.costs_live is distinct from v_live) and not public._biz_hq(v_uid) then
      raise exception '지점 · 순이익 연결은 대표님만 바꿀 수 있어요' using errcode = '42501';
    end if;
    update public.biz_books
       set name = v_name, owner_name = v_owner, kind = v_kind, branch_name = v_branch, costs_live = v_live,
           accounts = v_accounts, updated_at = now()
     where id = v_id;
  end if;
  if v_live then
    perform public._biz_sync_all(v_id);
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  raise exception '같은 이름이거나 같은 지점에 이어진 사업자가 이미 있어요';
end $$;

-- 사업자 보관(목록에서 숨김 · 순이익 연결 끔) — 대표님만
create or replace function public.biz_book_archive(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public._biz_hq(v_uid) then
    raise exception '사업자 보관은 대표님만 할 수 있어요' using errcode = '42501';
  end if;
  update public.biz_books set archived_at = now(), costs_live = false, updated_at = now() where id = p_id and archived_at is null;
  if not found then
    raise exception '사업자를 찾을 수 없어요';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 한 사업자 · 한 달 — 줄 전부 · 최근 12개월 흐름 · 이어진 지점 근무자(인건비 고르기)
create or replace function public.biz_month(p_book uuid, p_month text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month date := public._biz_month(p_month);
  b public.biz_books;
begin
  if v_uid is null or not public._biz_can_book(v_uid, p_book) then
    raise exception '사업자 가계부를 볼 수 없어요' using errcode = '42501';
  end if;
  select * into b from public.biz_books where id = p_book;
  return jsonb_build_object(
    'ok', true,
    'month', to_char(v_month, 'YYYY-MM'),
    'book', jsonb_build_object('id', b.id, 'name', b.name, 'owner_name', b.owner_name, 'kind', b.kind, 'branch', b.branch_name,
                               'costs_live', b.costs_live, 'accounts', to_jsonb(b.accounts)),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'day', e.day, 'month', to_char(e.month, 'YYYY-MM'), 'kind', e.kind, 'cat', e.cat, 'amount', e.amount,
               'n', e.n, 'party', e.party, 'memo', e.memo, 'account', e.account, 'staff_id', e.staff_id, 'staff_name', s.name,
               'wht', e.wht, 'source', e.source)
             order by e.day desc, e.created_at desc)
        from public.biz_entries e
        left join public.ops_staff s on s.id = e.staff_id
       where e.book_id = p_book and e.month = v_month), '[]'::jsonb),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(g.m, 'YYYY-MM'), 'cost', coalesce(t.cost, 0), 'in', coalesce(t.inn, 0),
                                          'n', coalesce(t.n, 0)) order by g.m)
        from generate_series(v_month - interval '11 months', v_month::timestamp, interval '1 month') g(m)
        left join lateral (
          select sum(case e.kind when 'out' then e.amount when 'back' then -e.amount else 0 end) as cost,
                 sum(e.amount) filter (where e.kind = 'in') as inn,
                 count(*) as n
            from public.biz_entries e
           where e.book_id = p_book and e.month = g.m::date) t on true), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'kind', s.kind, 'active', s.active) order by s.active desc, s.name)
        from public.ops_staff s
       where b.branch_name is not null and s.branch_name = b.branch_name), '[]'::jsonb));
end $$;

-- 줄 하나 넣기 · 고치기 — p = { id?, book, day, month?, kind, cat, amount, n?, party, memo, account, staff_id?, wht?, rule? }
--   rule = true 면 받는 사람(곳) 이름을 다음부터 같은 구분 · 항목으로 자동 분류(biz_rules)
create or replace function public.biz_entry_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := case when coalesce(p->>'id', '') ~ '^[0-9a-fA-F-]{36}$' then (p->>'id')::uuid end;
  v_book uuid := case when coalesce(p->>'book', '') ~ '^[0-9a-fA-F-]{36}$' then (p->>'book')::uuid end;
  v_old public.biz_entries;
  e public.biz_entries;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if v_id is not null then
    select * into v_old from public.biz_entries where id = v_id;
    if not found then
      raise exception '내역을 찾을 수 없어요';
    end if;
    v_book := v_old.book_id;
  end if;
  if v_book is null or not public._biz_can_book(v_uid, v_book) then
    raise exception '사업자 가계부를 볼 수 없어요' using errcode = '42501';
  end if;
  e := public._biz_entry_row(p);

  if v_id is null then
    insert into public.biz_entries (book_id, day, month, kind, cat, amount, n, party, memo, account, staff_id, wht, source, created_by)
    values (v_book, e.day, e.month, e.kind, e.cat, e.amount, e.n, e.party, e.memo, e.account, e.staff_id, e.wht, 'manual', v_uid)
    returning id into v_id;
  else
    update public.biz_entries
       set day = e.day, month = e.month, kind = e.kind, cat = e.cat, amount = e.amount, n = e.n, party = e.party,
           memo = e.memo, account = e.account, staff_id = e.staff_id, wht = e.wht, updated_at = now()
     where id = v_id;
    if v_old.month <> e.month then
      perform public._biz_sync(v_book, v_old.month);
    end if;
  end if;
  perform public._biz_sync(v_book, e.month);

  if coalesce(p->>'rule', '') = 'true' and char_length(e.party) between 2 and 30 then
    insert into public.biz_rules (book_id, keyword, kind, cat, staff_id, created_by)
    values (v_book, e.party, e.kind, e.cat, e.staff_id, v_uid)
    on conflict (book_id, (lower(keyword))) do update set kind = excluded.kind, cat = excluded.cat, staff_id = excluded.staff_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.biz_entry_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old public.biz_entries;
begin
  select * into v_old from public.biz_entries where id = p_id;
  if not found then
    raise exception '내역을 찾을 수 없어요';
  end if;
  if v_uid is null or not public._biz_can_book(v_uid, v_old.book_id) then
    raise exception '사업자 가계부를 볼 수 없어요' using errcode = '42501';
  end if;
  delete from public.biz_entries where id = p_id;
  perform public._biz_sync(v_old.book_id, v_old.month);
  return jsonb_build_object('ok', true);
end $$;

-- 파일에서 여러 줄 — p_rows = [{ day, month?, kind, cat, amount, party, memo, account, staff_id?, fp }, …] (3,000줄까지)
--   같은 지문(fp)이 이미 있으면 건너뛴다. p_meta.source = 'gagyebu_csv' | 'bank_file'
create or replace function public.biz_import(p_book uuid, p_rows jsonb, p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_src text := case when p_meta->>'source' = 'gagyebu_csv' then 'gagyebu_csv' else 'bank_file' end;
  v_row jsonb;
  e public.biz_entries;
  v_fp text;
  v_in integer := 0;
  v_skip integer := 0;
  v_n integer;
  v_months date[] := '{}';
  v_m date;
begin
  if v_uid is null or not public._biz_can_book(v_uid, p_book) then
    raise exception '사업자 가계부를 볼 수 없어요' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception '넣을 내역이 없어요';
  end if;
  if jsonb_array_length(p_rows) > 3000 then
    raise exception '한 번에 3,000줄까지 넣을 수 있어요';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_fp := btrim(coalesce(v_row->>'fp', ''));
    if char_length(v_fp) < 8 or char_length(v_fp) > 80 then
      raise exception '줄 표시가 이상해요';
    end if;
    e := public._biz_entry_row(v_row);
    insert into public.biz_entries (book_id, day, month, kind, cat, amount, n, party, memo, account, staff_id, wht, source, fp, created_by)
    values (p_book, e.day, e.month, e.kind, e.cat, e.amount, e.n, e.party, e.memo, e.account, e.staff_id, e.wht, v_src, v_fp, v_uid)
    on conflict (book_id, fp) where fp is not null do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_in := v_in + 1;
      if not (e.month = any (v_months)) then
        v_months := v_months || e.month;
      end if;
    else
      v_skip := v_skip + 1;
    end if;
  end loop;
  foreach v_m in array v_months loop
    perform public._biz_sync(p_book, v_m);
  end loop;
  return jsonb_build_object('ok', true, 'inserted', v_in, 'skipped', v_skip,
    'months', (select coalesce(jsonb_agg(to_char(x, 'YYYY-MM') order by x), '[]'::jsonb) from unnest(v_months) x));
end $$;

-- 자동 분류 규칙 — 받는 사람(곳) · 메모에 낱말이 들어 있으면 그 구분 · 항목(· 근무자)
create or replace function public.biz_rules(p_book uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public._biz_can_book(v_uid, p_book) then
    raise exception '사업자 가계부를 볼 수 없어요' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true, 'rules', coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'keyword', r.keyword, 'kind', r.kind, 'cat', r.cat, 'staff_id', r.staff_id,
                                        'staff_name', s.name) order by char_length(r.keyword) desc, r.keyword)
      from public.biz_rules r
      left join public.ops_staff s on s.id = r.staff_id
     where r.book_id = p_book), '[]'::jsonb));
end $$;

create or replace function public.biz_rule_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_book uuid := case when coalesce(p->>'book', '') ~ '^[0-9a-fA-F-]{36}$' then (p->>'book')::uuid end;
  v_kw text := left(btrim(coalesce(p->>'keyword', '')), 30);
  v_kind text := coalesce(nullif(p->>'kind', ''), 'out');
  v_cat text := coalesce(nullif(p->>'cat', ''), 'etc');
  v_staff uuid := case when coalesce(p->>'staff_id', '') ~ '^[0-9a-fA-F-]{36}$' then (p->>'staff_id')::uuid end;
  v_id uuid;
begin
  if v_uid is null or v_book is null or not public._biz_can_book(v_uid, v_book) then
    raise exception '사업자 가계부를 볼 수 없어요' using errcode = '42501';
  end if;
  if char_length(v_kw) < 1 then
    raise exception '낱말을 적어 주세요';
  end if;
  if v_kind not in ('out', 'in', 'back', 'move') then
    raise exception '구분이 이상해요';
  end if;
  if v_cat !~ '^[a-z][a-z0-9_]*$' or char_length(v_cat) > 24 then
    raise exception '항목이 이상해요';
  end if;
  if v_staff is not null and not exists (select 1 from public.ops_staff s where s.id = v_staff) then
    v_staff := null;
  end if;
  insert into public.biz_rules (book_id, keyword, kind, cat, staff_id, created_by)
  values (v_book, v_kw, v_kind, v_cat, v_staff, v_uid)
  on conflict (book_id, (lower(keyword))) do update set keyword = excluded.keyword, kind = excluded.kind, cat = excluded.cat,
                                                       staff_id = excluded.staff_id
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.biz_rule_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_book uuid;
begin
  select book_id into v_book from public.biz_rules where id = p_id;
  if v_book is null or v_uid is null or not public._biz_can_book(v_uid, v_book) then
    raise exception '규칙을 찾을 수 없어요' using errcode = '42501';
  end if;
  delete from public.biz_rules where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ── 예전 「가계부 CSV 올리기」 — 순이익 연결을 켠 지점은 막는다 (바탕 = DB 의 지금 정의, 20261104154931 과 같음) ──

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
  -- 사업자 가계부가 순이익 비용을 채우는 지점(2026-11-28)
  if exists (select 1 from public.biz_books bb where bb.branch_name = p_branch and bb.costs_live and bb.archived_at is null) then
    raise exception '이 지점 비용은 사업자 가계부에서 넣고 고쳐 주세요';
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

create or replace function public.ops_costs_clear(p_branch text, p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
begin
  if v_uid is null or not public._ops_can_see_pay(v_uid, p_branch) then
    raise exception '매출은 대표님 · 회계매니저만 볼 수 있어요' using errcode = '42501';
  end if;
  -- 사업자 가계부가 순이익 비용을 채우는 지점(2026-11-28)
  if exists (select 1 from public.biz_books bb where bb.branch_name = p_branch and bb.costs_live and bb.archived_at is null) then
    raise exception '이 지점 비용은 사업자 가계부에서 넣고 고쳐 주세요';
  end if;
  delete from public.ops_branch_costs where branch_name = p_branch and month = v_month;
  delete from public.ops_branch_cost_months where branch_name = p_branch and month = v_month;
  return jsonb_build_object('ok', true);
end $$;

-- ── 권한 — 화면 함수만 로그인한 분께(안에서 대표님 · 회계매니저 확인), 안쪽 함수는 아무도 바로 못 부른다 ──
revoke all on function public._biz_cat_label(text) from public, anon, authenticated;
revoke all on function public._biz_month(text) from public, anon, authenticated;
revoke all on function public._biz_hq(uuid) from public, anon, authenticated;
revoke all on function public._biz_any(uuid) from public, anon, authenticated;
revoke all on function public._biz_can_book(uuid, uuid) from public, anon, authenticated;
revoke all on function public._biz_entry_row(jsonb) from public, anon, authenticated;
revoke all on function public._biz_sync(uuid, date) from public, anon, authenticated;
revoke all on function public._biz_sync_all(uuid) from public, anon, authenticated;

revoke all on function public.biz_home(text) from public, anon;
revoke all on function public.biz_book_save(jsonb) from public, anon;
revoke all on function public.biz_book_archive(uuid) from public, anon;
revoke all on function public.biz_month(uuid, text) from public, anon;
revoke all on function public.biz_entry_save(jsonb) from public, anon;
revoke all on function public.biz_entry_delete(uuid) from public, anon;
revoke all on function public.biz_import(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.biz_rules(uuid) from public, anon;
revoke all on function public.biz_rule_save(jsonb) from public, anon;
revoke all on function public.biz_rule_delete(uuid) from public, anon;
grant execute on function public.biz_home(text) to authenticated;
grant execute on function public.biz_book_save(jsonb) to authenticated;
grant execute on function public.biz_book_archive(uuid) to authenticated;
grant execute on function public.biz_month(uuid, text) to authenticated;
grant execute on function public.biz_entry_save(jsonb) to authenticated;
grant execute on function public.biz_entry_delete(uuid) to authenticated;
grant execute on function public.biz_import(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.biz_rules(uuid) to authenticated;
grant execute on function public.biz_rule_save(jsonb) to authenticated;
grant execute on function public.biz_rule_delete(uuid) to authenticated;
