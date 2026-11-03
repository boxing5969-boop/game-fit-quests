-- 153운영본부 · 근무 — 계약서 (2026-11-03 대표님 "코치님들 계약서 작성해야하는데 계약서 작성 기능 만들어줘")
--
--   고른 방식(11-03): 「앱에서 서명」 — 대표님이 근무자 카드에서 계약서를 만들어 서명해 보내면, 코치님이 앱에서 읽고 손가락으로 서명한다.
--     근로기준법 17조 2항(2021-01-05 개정): 서면 명시 · 교부에 전자문서도 포함 — 두 사람 모두 앱에서 언제든 보고 PDF 로 받는다.
--   양식(11-03 「표준 양식으로」): 고용노동부 표준근로계약서(기간 없음 · 기간 있음 · 단시간근로자) + PT 업무위탁 계약서.
--     근무자 카드(형태 · 시급/월급 · 기간) · 시간표 · PT 수당표로 채우고 '특약' 칸. 글 만들기 · 점검은 화면 src/lib/opsContract.ts 한 곳.
--
--   ops_employers — 지점마다 사업주 정보(사업체명 · 대표자 · 사업자번호 · 주소 · 전화) + 대표님 서명(그림). 대표님만 바꾼다.
--   ops_contracts — 보낸 계약서 한 장. 글(doc)은 보낼 때 얼려 두고 지문(doc_hash = sha256)을 남긴다 — 서명할 때 같은 지문이어야 한다.
--     status sent(서명 기다림) → signed(서명 완료) · void(무효). 고치기는 없다 — 바꾸려면 새 계약서(같은 사람 · 같은 종류의
--     서명 전 계약서는 저절로 무효). 서명하면 봉인 지문(sealed_hash = 글 지문 · 두 서명 · 이름 · 시각)을 남긴다.
--     서명 = 코치님 본인 계정(worker_user_id — 보낼 때 근무자 카드의 앱 계정) 또는 대면 서명(in_person — 돈을 보는 관리자 휴대폰에서 코치님이 직접).
--   보는 사람: 돈을 보는 분(_ops_can_see_pay — 대표님 · 회계매니저) · 받은 코치님 본인. 지점장은 못 본다(계약서에 시급이 있다, 10-29 규칙).
--   보관: 지우는 함수가 없다 — 근로계약서는 근로관계가 끝난 뒤 3년 보관(근로기준법 42조). 앱 계정을 지워도 남는다(계정과 묶지 않음).
--
--   새 표 · 새 함수만 (기존 함수 동작은 그대로). 표는 RLS 를 켜고 정책 없이 — 읽기 · 쓰기는 아래 함수로만.
--   실제 사업주 정보 · 서명 · 근무자 값은 이 파일에 넣지 않는다(공개 저장소) — 앱 화면에서 넣는다.

-- ───────────────────────── 표 ─────────────────────────
create table if not exists public.ops_employers (
  branch_name text primary key references public.ops_branches(branch_name),
  biz_name text not null default '' check (length(biz_name) <= 60),
  owner_name text not null default '' check (length(owner_name) <= 30),
  biz_number text not null default '' check (length(biz_number) <= 20),
  address text not null default '' check (length(address) <= 120),
  phone text not null default '' check (length(phone) <= 30),
  sign text check (sign is null or (sign like 'data:image/png;base64,%' and length(sign) between 100 and 400000)),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ops_employers enable row level security;

create table if not exists public.ops_contracts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.ops_staff(id),
  branch_name text not null references public.ops_branches(branch_name),
  kind text not null check (kind in ('labor', 'freelance')),
  title text not null check (length(btrim(title)) between 1 and 60),
  start_date date,
  end_date date,
  terms jsonb not null default '{}'::jsonb,           -- 화면이 채운 값(다음 계약서 미리 채우기용)
  doc jsonb not null,                                   -- 보낸 글 그대로(서명하는 글)
  doc_hash text not null,                               -- sha256(doc::text)
  status text not null default 'sent' check (status in ('sent', 'signed', 'void')),
  worker_user_id uuid,                                  -- 보낼 때 근무자 카드의 앱 계정 (없으면 대면 서명만)
  employer_owner text not null,                         -- 대표자 이름 (보낼 때 그대로)
  employer_sign text not null,                          -- 대표님 서명 (보낼 때 그대로)
  created_by uuid not null,
  created_at timestamptz not null default now(),        -- 보낸 때 = 사업주 서명 시각
  viewed_at timestamptz,                                -- 코치님이 처음 연 때
  worker_sign text,
  worker_sign_name text,
  worker_address text,
  worker_phone text,
  worker_signed_at timestamptz,
  worker_signed_by uuid,                                -- 서명한 계정 (대면 서명이면 관리자 계정)
  in_person boolean not null default false,
  sealed_hash text,
  delivered_at timestamptz,                             -- 사본을 준 때 (앱 계정이 있으면 서명 순간)
  delivered_how text check (delivered_how is null or delivered_how in ('app', 'pdf', 'paper')),
  void_at timestamptz,
  void_by uuid,
  void_reason text check (void_reason is null or length(void_reason) <= 200)
);
create index if not exists ops_contracts_staff_idx on public.ops_contracts (staff_id, created_at desc);
create index if not exists ops_contracts_worker_idx on public.ops_contracts (worker_user_id) where worker_user_id is not null;
create index if not exists ops_contracts_branch_idx on public.ops_contracts (branch_name, status);
alter table public.ops_contracts enable row level security;

revoke all on public.ops_employers, public.ops_contracts from anon, authenticated;

-- ───────────────────────── 조각 ─────────────────────────
-- 목록 한 줄 (글 · 서명 그림 빼고)
create or replace function public._ops_contract_brief(c public.ops_contracts)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'staff_id', c.staff_id, 'branch', c.branch_name, 'kind', c.kind, 'title', c.title,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'sent_at', c.created_at, 'viewed_at', c.viewed_at, 'signed_at', c.worker_signed_at, 'in_person', c.in_person,
    'delivered_at', c.delivered_at, 'delivered_how', c.delivered_how,
    'void_at', c.void_at, 'void_reason', c.void_reason, 'has_app', c.worker_user_id is not null);
$$;
revoke all on function public._ops_contract_brief(public.ops_contracts) from public, anon, authenticated;

-- 사업주 정보 (서명 그림 포함 — 돈을 보는 분에게만 보낸다)
create or replace function public._ops_employer_json(_branch text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('biz_name', e.biz_name, 'owner_name', e.owner_name, 'biz_number', e.biz_number,
                            'address', e.address, 'phone', e.phone, 'sign', e.sign, 'updated_at', e.updated_at)
    from public.ops_employers e where e.branch_name = _branch;
$$;
revoke all on function public._ops_employer_json(text) from public, anon, authenticated;

-- ───────────────────────── 읽기 ─────────────────────────
-- 근무자 카드 '계약서' 탭 — 사업주 정보 · 이 사람 계약서 · 지점의 마지막 계약 값(미리 채우기) · PT 수당표
create or replace function public.ops_contract_list(p_staff_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_staff public.ops_staff;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_staff from public.ops_staff where id = p_staff_id;
  if v_staff.id is null then raise exception '근무자를 찾을 수 없어요'; end if;
  if not public._ops_can_see_pay(v_uid, v_staff.branch_name) then
    raise exception '계약서는 대표님 · 회계매니저만 볼 수 있어요';
  end if;
  return jsonb_build_object(
    'branch', v_staff.branch_name,
    'hq', public._strategy_hq(v_uid),
    'employer', public._ops_employer_json(v_staff.branch_name),
    'contracts', coalesce((select jsonb_agg(public._ops_contract_brief(c) order by c.created_at desc)
                             from public.ops_contracts c where c.staff_id = p_staff_id), '[]'::jsonb),
    'last_labor', (select c.terms from public.ops_contracts c
                    where c.branch_name = v_staff.branch_name and c.kind = 'labor' order by c.created_at desc limit 1),
    'last_freelance', (select c.terms from public.ops_contracts c
                        where c.branch_name = v_staff.branch_name and c.kind = 'freelance' order by c.created_at desc limit 1),
    'pt_rates', coalesce((select jsonb_agg(jsonb_build_object('team_size', r.team_size, 'sessions', r.sessions,
                                                              'session_rate', r.session_rate, 'valid_from', r.valid_from)
                                           order by r.team_size, r.sessions, r.valid_from)
                            from public.ops_pt_rates r where r.branch_name = v_staff.branch_name), '[]'::jsonb));
end $$;

-- 지점 근무자 목록의 '계약서 없음 · 서명 대기' 표시 — 돈을 보는 분에게만(다른 분은 빈 목록)
create or replace function public.ops_contract_branch(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._ops_can_see_pay(v_uid, p_branch) then
    return jsonb_build_object('pay', false, 'contracts', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'pay', true,
    'contracts', coalesce((select jsonb_agg(public._ops_contract_brief(c) order by c.created_at desc)
                             from public.ops_contracts c where c.branch_name = p_branch and c.status <> 'void'), '[]'::jsonb));
end $$;

-- 내 계약서 (코치님 '내 근무')
create or replace function public.ops_contract_mine()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_agg(public._ops_contract_brief(c) order by c.created_at desc)
                     from public.ops_contracts c where auth.uid() is not null and c.worker_user_id = auth.uid()), '[]'::jsonb);
$$;

-- 계약서 한 장 — 글 · 서명까지. 코치님이 처음 열면 viewed_at
create or replace function public.ops_contract_get(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.ops_contracts;
  v_manage boolean;
  v_worker boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into c from public.ops_contracts where id = p_id;
  if c.id is null then raise exception '계약서를 찾을 수 없어요'; end if;
  v_manage := public._ops_can_see_pay(v_uid, c.branch_name);
  v_worker := c.worker_user_id is not null and c.worker_user_id = v_uid;
  if not v_manage and not v_worker then raise exception '이 계약서를 볼 수 없어요'; end if;
  if v_worker and c.viewed_at is null then
    update public.ops_contracts set viewed_at = now() where id = p_id returning * into c;
  end if;
  return public._ops_contract_brief(c) || jsonb_build_object(
    'doc', c.doc, 'doc_hash', c.doc_hash, 'sealed_hash', c.sealed_hash,
    'employer_owner', c.employer_owner, 'employer_sign', c.employer_sign,
    'worker_sign', c.worker_sign, 'worker_sign_name', c.worker_sign_name,
    'worker_address', c.worker_address, 'worker_phone', c.worker_phone,
    'staff_name', (select s.name from public.ops_staff s where s.id = c.staff_id),
    'can_manage', v_manage, 'is_worker', v_worker,
    'can_sign', c.status = 'sent' and (v_worker or v_manage));
end $$;

-- ───────────────────────── 쓰기 ─────────────────────────
-- 사업주 정보 · 대표님 서명 — 대표님만 (회계매니저는 이 서명으로 보내기만)
create or replace function public.ops_employer_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_branch text := p->>'branch';
  v_sign text;
  v_keep_sign boolean := not (p ? 'sign');
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not public._strategy_hq(v_uid) then raise exception '사업주 정보와 서명은 대표님만 바꿔요'; end if;
  if not exists (select 1 from public.ops_branches b where b.branch_name = v_branch and b.enabled) then
    raise exception '지점을 찾을 수 없어요';
  end if;
  v_sign := nullif(p->>'sign', '');
  if v_sign is not null and (v_sign not like 'data:image/png;base64,%' or length(v_sign) < 100 or length(v_sign) > 400000) then
    raise exception '서명 그림이 이상해요 — 다시 그려 주세요';
  end if;
  insert into public.ops_employers as e (branch_name, biz_name, owner_name, biz_number, address, phone, sign, updated_by, updated_at)
  values (v_branch,
          left(btrim(coalesce(p->>'biz_name', '')), 60), left(btrim(coalesce(p->>'owner_name', '')), 30),
          left(btrim(coalesce(p->>'biz_number', '')), 20), left(btrim(coalesce(p->>'address', '')), 120),
          left(btrim(coalesce(p->>'phone', '')), 30), v_sign, v_uid, now())
  on conflict (branch_name) do update
    set biz_name = excluded.biz_name, owner_name = excluded.owner_name, biz_number = excluded.biz_number,
        address = excluded.address, phone = excluded.phone,
        sign = case when v_keep_sign then e.sign else excluded.sign end,
        updated_by = v_uid, updated_at = now();
  return public._ops_employer_json(v_branch);
end $$;

-- 계약서 보내기 — 대표님 서명이 들어간 채로. 같은 사람 · 같은 종류의 서명 전 계약서는 무효(새 계약서로 바꿈)
create or replace function public.ops_contract_send(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_staff public.ops_staff;
  v_emp public.ops_employers;
  v_kind text := p->>'kind';
  v_title text := btrim(coalesce(p->>'title', ''));
  v_doc jsonb := p->'doc';
  v_terms jsonb := coalesce(p->'terms', '{}'::jsonb);
  v_notify boolean;
  v_start date;
  v_end date;
  v_hash text;
  v_id uuid;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  begin
    select * into v_staff from public.ops_staff where id = (p->>'staff_id')::uuid;
    v_start := nullif(p->>'start_date', '')::date;
    v_end := nullif(p->>'end_date', '')::date;
    v_notify := coalesce((p->>'notify')::boolean, true);
  exception when others then
    raise exception '계약서 값 모양이 이상해요';
  end;
  if v_staff.id is null then raise exception '근무자를 찾을 수 없어요'; end if;
  if not public._ops_can_see_pay(v_uid, v_staff.branch_name) then
    raise exception '계약서는 대표님 · 회계매니저만 보낼 수 있어요';
  end if;
  if v_kind is null or v_kind not in ('labor', 'freelance') then raise exception '계약서 종류가 이상해요'; end if;
  if length(v_title) = 0 or length(v_title) > 60 then raise exception '계약서 제목이 이상해요'; end if;
  if v_doc is null or jsonb_typeof(v_doc) <> 'object' or jsonb_typeof(v_doc->'items') is distinct from 'array' then
    raise exception '계약서 내용이 비어 있어요';
  end if;
  if jsonb_array_length(v_doc->'items') = 0 then raise exception '계약서 내용이 비어 있어요'; end if;
  if jsonb_typeof(v_terms) <> 'object' then raise exception '계약서 값 모양이 이상해요'; end if;
  if octet_length(v_doc::text) > 100000 or octet_length(v_terms::text) > 50000 then raise exception '계약서가 너무 길어요'; end if;
  if v_start is null then raise exception '시작일을 넣어 주세요'; end if;
  if v_end is not null and v_end < v_start then raise exception '끝나는 날이 시작일보다 앞이에요'; end if;

  select * into v_emp from public.ops_employers where branch_name = v_staff.branch_name;
  if v_emp.branch_name is null or length(btrim(v_emp.biz_name)) = 0 or length(btrim(v_emp.owner_name)) = 0 or v_emp.sign is null then
    raise exception '사업주 정보와 대표님 서명을 먼저 넣어 주세요';
  end if;

  v_hash := encode(sha256(convert_to(v_doc::text, 'UTF8')), 'hex');

  update public.ops_contracts
     set status = 'void', void_at = now(), void_by = v_uid, void_reason = '새 계약서로 바꿈'
   where staff_id = v_staff.id and kind = v_kind and status = 'sent';

  insert into public.ops_contracts (staff_id, branch_name, kind, title, start_date, end_date, terms, doc, doc_hash, status,
                                    worker_user_id, employer_owner, employer_sign, created_by)
  values (v_staff.id, v_staff.branch_name, v_kind, v_title, v_start, v_end, v_terms, v_doc, v_hash, 'sent',
          v_staff.user_id, btrim(v_emp.owner_name), v_emp.sign, v_uid)
  returning id into v_id;

  if v_notify and v_staff.user_id is not null and v_staff.user_id <> v_uid then
    insert into public.notifications (user_id, title, body, link)
    values (v_staff.user_id,
            case when v_kind = 'freelance' then '📝 업무위탁 계약서가 도착했어요' else '📝 근로계약서가 도착했어요' end,
            replace(v_staff.branch_name, '153복싱짐 ', '') || ' · 읽고 서명해 주세요',
            '/office?tab=work&contract=' || v_id);
  end if;

  return jsonb_build_object('id', v_id, 'doc_hash', v_hash);
end $$;

-- 서명 — 코치님 본인 계정, 또는 대면 서명(돈을 보는 관리자 휴대폰에서 코치님이 직접). 보낸 글과 같은 지문이어야 한다
create or replace function public.ops_contract_sign(
  p_id uuid, p_hash text, p_sign text, p_name text,
  p_address text default null, p_phone text default null, p_in_person boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.ops_contracts;
  v_now timestamptz := now();
  v_name text := btrim(coalesce(p_name, ''));
  v_in_person boolean := coalesce(p_in_person, false);
  v_seal text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into c from public.ops_contracts where id = p_id for update;
  if c.id is null then raise exception '계약서를 찾을 수 없어요'; end if;
  if v_in_person then
    if not public._ops_can_see_pay(v_uid, c.branch_name) then
      raise exception '대면 서명은 대표님 · 회계매니저 휴대폰에서만 받아요';
    end if;
  elsif c.worker_user_id is null or c.worker_user_id <> v_uid then
    raise exception '이 계약서에 서명할 수 없어요';
  end if;
  if c.status = 'signed' then raise exception '이미 서명한 계약서예요'; end if;
  if c.status <> 'sent' then raise exception '무효가 된 계약서예요 — 새로 온 계약서를 확인해 주세요'; end if;
  if coalesce(p_hash, '') <> c.doc_hash then raise exception '계약서 내용이 바뀌었어요 — 다시 열어 주세요'; end if;
  if length(v_name) = 0 or length(v_name) > 40 then raise exception '이름을 넣어 주세요'; end if;
  if p_sign is null or p_sign not like 'data:image/png;base64,%' or length(p_sign) < 200 or length(p_sign) > 400000 then
    raise exception '서명을 다시 그려 주세요';
  end if;
  if length(coalesce(p_address, '')) > 120 or length(coalesce(p_phone, '')) > 30 then
    raise exception '주소 · 연락처가 너무 길어요';
  end if;

  v_seal := encode(sha256(convert_to(
              c.doc_hash || '|' || encode(sha256(convert_to(c.employer_sign, 'UTF8')), 'hex') || '|' ||
              encode(sha256(convert_to(p_sign, 'UTF8')), 'hex') || '|' || v_name || '|' ||
              to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'UTF8')), 'hex');

  update public.ops_contracts
     set status = 'signed', worker_sign = p_sign, worker_sign_name = v_name,
         worker_address = nullif(btrim(coalesce(p_address, '')), ''),
         worker_phone = nullif(btrim(coalesce(p_phone, '')), ''),
         worker_signed_at = v_now, worker_signed_by = v_uid, in_person = v_in_person, sealed_hash = v_seal,
         delivered_at = case when c.worker_user_id is not null then v_now end,
         delivered_how = case when c.worker_user_id is not null then 'app' end,
         viewed_at = coalesce(c.viewed_at, v_now)
   where id = p_id;

  if not v_in_person then
    -- 앱에서 서명 → 보낸 분께
    insert into public.notifications (user_id, title, body, link)
    select c.created_by, '✍️ ' || v_name || '님이 계약서에 서명했어요', c.title, '/office?tab=work&contract=' || c.id
     where c.created_by is not null and c.created_by <> v_uid;
  elsif c.worker_user_id is not null and c.worker_user_id <> v_uid then
    -- 대면 서명이어도 앱 계정이 있으면 사본은 앱에
    insert into public.notifications (user_id, title, body, link)
    values (c.worker_user_id, '📝 서명한 계약서가 앱에 있어요', c.title || ' · 언제든 보고 PDF 로 받을 수 있어요',
            '/office?tab=work&contract=' || c.id);
  end if;

  return jsonb_build_object('ok', true, 'signed_at', v_now, 'sealed_hash', v_seal);
end $$;

-- 무효로 하기 — 서명한 계약서는 사유가 있어야 한다. 지우지 않는다(보관)
create or replace function public.ops_contract_void(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.ops_contracts;
  v_reason text := left(btrim(coalesce(p_reason, '')), 200);
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into c from public.ops_contracts where id = p_id for update;
  if c.id is null then raise exception '계약서를 찾을 수 없어요'; end if;
  if not public._ops_can_see_pay(v_uid, c.branch_name) then raise exception '계약서는 대표님 · 회계매니저만 바꿀 수 있어요'; end if;
  if c.status = 'void' then raise exception '이미 무효인 계약서예요'; end if;
  if c.status = 'signed' and length(v_reason) < 2 then raise exception '서명한 계약서는 무효로 하는 사유를 적어 주세요'; end if;
  update public.ops_contracts
     set status = 'void', void_at = now(), void_by = v_uid, void_reason = nullif(v_reason, '')
   where id = p_id;
  if c.status = 'signed' and c.worker_user_id is not null and c.worker_user_id <> v_uid then
    insert into public.notifications (user_id, title, body, link)
    values (c.worker_user_id, '📄 계약서가 무효가 됐어요', c.title || ' · ' || v_reason, '/office?tab=work&contract=' || c.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 사본을 줬어요 — 앱 계정이 없는 분께 대면 서명을 받은 뒤 PDF · 종이로 준 것을 남긴다(근로기준법 17조 교부)
create or replace function public.ops_contract_delivered(p_id uuid, p_how text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.ops_contracts;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p_how is null or p_how not in ('pdf', 'paper') then raise exception '어떻게 줬는지 골라 주세요'; end if;
  select * into c from public.ops_contracts where id = p_id for update;
  if c.id is null then raise exception '계약서를 찾을 수 없어요'; end if;
  if not public._ops_can_see_pay(v_uid, c.branch_name) then raise exception '계약서는 대표님 · 회계매니저만 바꿀 수 있어요'; end if;
  if c.status <> 'signed' then raise exception '서명을 마친 계약서만 사본을 줘요'; end if;
  update public.ops_contracts set delivered_at = now(), delivered_how = p_how where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 권한 ─────────────────────────
revoke all on function public.ops_contract_list(uuid) from public, anon;
revoke all on function public.ops_contract_branch(text) from public, anon;
revoke all on function public.ops_contract_mine() from public, anon;
revoke all on function public.ops_contract_get(uuid) from public, anon;
revoke all on function public.ops_employer_save(jsonb) from public, anon;
revoke all on function public.ops_contract_send(jsonb) from public, anon;
revoke all on function public.ops_contract_sign(uuid, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.ops_contract_void(uuid, text) from public, anon;
revoke all on function public.ops_contract_delivered(uuid, text) from public, anon;
grant execute on function public.ops_contract_list(uuid) to authenticated;
grant execute on function public.ops_contract_branch(text) to authenticated;
grant execute on function public.ops_contract_mine() to authenticated;
grant execute on function public.ops_contract_get(uuid) to authenticated;
grant execute on function public.ops_employer_save(jsonb) to authenticated;
grant execute on function public.ops_contract_send(jsonb) to authenticated;
grant execute on function public.ops_contract_sign(uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.ops_contract_void(uuid, text) to authenticated;
grant execute on function public.ops_contract_delivered(uuid, text) to authenticated;
