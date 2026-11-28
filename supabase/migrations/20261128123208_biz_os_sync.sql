-- 사업자 가계부 → 153OS 월별 손익 정산판 자동 맞춤 (2026-11-28 대표님 「그래 그렇게하고」 · 문서 docs/features/73-사업자-가계부.md)
--
--   가계부 줄이 바뀌면(_biz_sync — 줄 넣기 · 고치기 · 지우기 · 통장 파일 올리기 · 순이익 연결 켜기) 그 사업자 · 달을 대기열(biz_os_queue)에 넣는다.
--   Edge Function biz-os-sync 가 대기열을 읽어 153OS branch_pl_months(그 지점 · 그 달)를 가계부 숫자로 다시 쓴다.
--     · 부르는 길: ① 가계부 화면이 고친 뒤 바로(로그인한 대표님 · 회계매니저) ② 크론 biz-os-sync 10분마다(대기열에 일이 있을 때만 · x-auto-key)
--     · 순이익 연결(costs_live)을 켠 사업자만 — 꺼져 있으면 _biz_sync 가 아무것도 안 하므로 대기열에도 안 들어간다.
--   biz_os_payload(사업자, 달) = 그 달 숫자만(항목별 비용 · 사람별 급여 · 뺀 돈) — 서버(service_role)만 부른다.

-- 1) 대기열 — 사업자 · 달 한 줄. 다시 고치면 시각만 새로(시도 횟수 0)
create table if not exists public.biz_os_queue (
  book_id uuid not null references public.biz_books(id) on delete cascade,
  month date not null,
  queued_at timestamptz not null default now(),
  tries integer not null default 0,
  last_error text,
  primary key (book_id, month)
);
alter table public.biz_os_queue enable row level security;
revoke all on public.biz_os_queue from public, anon, authenticated;
comment on table public.biz_os_queue is
  '사업자 가계부 → 153OS 월별 손익(branch_pl_months) 맞춤 대기열. _biz_sync 가 넣고 Edge Function biz-os-sync 가 처리 뒤 지운다(실패하면 tries · last_error). 화면은 못 읽는다.';

-- 2) _biz_sync — 지금 정의(20261128100610_biz_ledger.sql) 그대로 + 대기열 넣기 한 줄
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
  -- 153OS 월별 손익도 맞추기(biz-os-sync) — 달이 비게 돼도 넣는다(그때는 우리가 쓴 153OS 줄을 지운다)
  insert into public.biz_os_queue (book_id, month) values (_book, _month)
  on conflict (book_id, month) do update set queued_at = now(), tries = 0, last_error = null;

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

-- 3) 153OS 로 보낼 한 달 숫자 — 비용 = 지출 − 돌려받음(항목별, 인건비 빼고) · 인건비는 사람별 · 뺀 돈(이동 · 개인)은 상대 · 적요별(들어온 돈 '입금…' 빼고)
create or replace function public.biz_os_payload(p_book uuid, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  b public.biz_books;
begin
  select * into b from public.biz_books where id = p_book;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_BOOK');
  end if;
  return jsonb_build_object(
    'ok', true,
    'live', b.costs_live and b.branch_name is not null and b.archived_at is null,
    'branch', b.branch_name,
    'month', to_char(p_month, 'YYYY-MM'),
    'n', (select count(*) from public.biz_entries e
           where e.book_id = p_book and e.month = p_month and e.kind in ('out', 'back', 'move')),
    'cats', coalesce((
      select jsonb_agg(jsonb_build_object('cat', t.cat, 'label', public._biz_cat_label(t.cat), 'amt', t.amt) order by t.cat)
        from (select e.cat, sum(case when e.kind = 'out' then e.amount else -e.amount end)::bigint as amt
                from public.biz_entries e
               where e.book_id = p_book and e.month = p_month and e.kind in ('out', 'back') and e.cat <> 'bpay'
               group by e.cat) t
       where t.amt <> 0), '[]'::jsonb),
    'pay', coalesce((
      select jsonb_agg(jsonb_build_object('who', t.who, 'amt', t.amt) order by t.who)
        from (select coalesce(nullif(btrim(e.party), ''), s.name, '') as who,
                     sum(case when e.kind = 'out' then e.amount else -e.amount end)::bigint as amt
                from public.biz_entries e
                left join public.ops_staff s on s.id = e.staff_id
               where e.book_id = p_book and e.month = p_month and e.kind in ('out', 'back') and e.cat = 'bpay'
               group by 1) t
       where t.amt <> 0), '[]'::jsonb),
    'mv', coalesce((
      select jsonb_agg(jsonb_build_object('party', t.party, 'memo', t.memo, 'amt', t.amt) order by t.party, t.memo)
        from (select btrim(e.party) as party, split_part(e.memo, ' · ', 1) as memo, sum(e.amount)::bigint as amt
                from public.biz_entries e
               where e.book_id = p_book and e.month = p_month and e.kind = 'move'
                 and e.memo not like '입금%'
               group by 1, 2) t
       where t.amt <> 0), '[]'::jsonb));
end $$;

revoke all on function public.biz_os_payload(uuid, date) from public, anon, authenticated;
grant execute on function public.biz_os_payload(uuid, date) to service_role;
-- 화면에서 부를 때 「대표님 · 회계매니저인가」를 Edge Function 이 서버 키로 확인한다
grant execute on function public._biz_any(uuid) to service_role;

-- 4) 처음 한 번 — 순이익 연결을 켠 사업자의 가계부 달을 모두 대기열에(153OS 표 이름을 153OS 분류 규칙 이름으로 맞춤)
insert into public.biz_os_queue (book_id, month)
select distinct e.book_id, e.month
  from public.biz_entries e
  join public.biz_books b on b.id = e.book_id
 where b.costs_live and b.branch_name is not null and b.archived_at is null
on conflict (book_id, month) do update set queued_at = now(), tries = 0, last_error = null;

-- 5) 크론 — 10분마다(3 · 13 · 23 … 분), 대기열에 할 일이 있을 때만 Edge Function 을 부른다(다른 크론 함수와 같은 x-auto-key)
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'biz-os-sync') then
    perform cron.unschedule('biz-os-sync');
  end if;
  perform cron.schedule(
    'biz-os-sync',
    '3-59/10 * * * *',
    $cron$
    select net.http_post(
      url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/biz-os-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 60000)
     where exists (select 1 from public.biz_os_queue where tries < 5);
    $cron$
  );
end
$do$;
