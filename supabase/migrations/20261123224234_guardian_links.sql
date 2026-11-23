-- 보호자(어머님 · 아버님) 계정 · 아이 입장 / 운동 끝 알림 · 「운동을 끝낼까요?」 (2026-11-23 대표님 「추천대로」)
--
-- 대표님 말씀: 수험생 등록이 많아 어머님들이 늦게까지 안 오면 걱정하신다 → 어머님도 마이복서153 에 가입해서
--   아이가 몇 시에 왔고 얼마나 운동했고 153 에서 무엇을 얻었는지 보게. 아이는 운동이 끝나면 「운동 끝」을 누르고,
--   출석 뒤 50분이 지나 앱을 열면 「운동을 끝낼까요?」가 뜬다.
-- 결정(추천대로): 가입 = 아이가 보내는 링크 + 데스크 QR · 미성년은 데스크에서만 연결을 끊고 성인은 본인이 수락 · 끊기
--   · 끝 기록이 없을 때 보호자 알림은 보내지 않음 · 팝업 = 보호자가 연결된 회원 + 생년월일로 미성년인 회원 · 문자 알림은 2단계.
--
-- 새 것만: 설정 app_settings 'guardian' · profiles.account_kind 칸 · 새 표 3 · 새 함수 · 예약 1.
-- 기존 함수 · 표 동작은 그대로(출석 표에 트리거를 달지 않는다 — 1분 예약이 훑는다). 줄을 지우는 문장 없음.

-- ── 설정 ────────────────────────────────────────────────────────────────────
insert into public.app_settings (key, value)
values ('guardian', jsonb_build_object(
  'on', true,
  'prompt_min', 50,          -- 출석 뒤 몇 분부터 「운동을 끝낼까요?」
  'prompt_max_min', 180,     -- 몇 분까지 (그 뒤는 운동 시간 고치기)
  'snooze_min', 20,          -- 「아직 하는 중」을 누르면 몇 분 뒤 다시
  'remind_min', 70,          -- 끝 기록이 없으면 아이 휴대폰에 한 번 (보호자가 연결된 회원만)
  'invite_child_days', 7,    -- 아이가 보내는 링크 기한
  'invite_desk_hours', 24,   -- 데스크 QR 기한
  'max_guardians', 4))
on conflict (key) do nothing;

-- ── 보호자만 쓰는 계정 표시 ─────────────────────────────────────────────────
-- 회원 승인 목록 · 회원 수에서 빼고, 로그인하면 「우리 아이」 화면으로 보낸다. 회원 기능 권한은 guardian_links 로만 생긴다.
alter table public.profiles add column if not exists account_kind text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_account_kind_check') then
    alter table public.profiles add constraint profiles_account_kind_check
      check (account_kind is null or account_kind = 'guardian');
  end if;
end $$;

-- ── 표 ──────────────────────────────────────────────────────────────────────
create table if not exists public.guardian_links (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid not null references auth.users(id) on delete cascade,
  member_id    uuid not null references auth.users(id) on delete cascade,
  relation     text not null check (relation in ('mom', 'dad', 'guardian')),
  via          text not null check (via in ('child_invite', 'desk_qr')),
  status       text not null default 'active' check (status in ('pending', 'active', 'ended')),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  ended_at     timestamptz,
  ended_by     uuid,
  ended_reason text check (ended_reason is null or ended_reason in ('guardian', 'member', 'staff', 'declined')),
  check (guardian_id <> member_id)
);
create unique index if not exists guardian_links_live on public.guardian_links (guardian_id, member_id)
  where status in ('pending', 'active');
create index if not exists guardian_links_member on public.guardian_links (member_id) where status in ('pending', 'active');

create table if not exists public.guardian_invites (
  token       text primary key check (token ~ '^[a-f0-9]{32}$'),
  member_id   uuid not null references auth.users(id) on delete cascade,
  via         text not null check (via in ('child_invite', 'desk_qr')),
  made_by     uuid not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid
);
create index if not exists guardian_invites_member on public.guardian_invites (member_id, created_at desc);
create index if not exists guardian_invites_maker on public.guardian_invites (made_by, created_at desc);

-- 알림은 출석 한 건 · 받는 사람 · 종류마다 한 번
create table if not exists public.guardian_notices (
  kind          text not null check (kind in ('in', 'end', 'kid_remind')),
  attendance_id uuid not null references public.attendance_logs(id) on delete cascade,
  user_id       uuid not null,
  sent_at       timestamptz not null default now(),
  primary key (kind, attendance_id, user_id)
);

alter table public.guardian_links   enable row level security;
alter table public.guardian_invites enable row level security;
alter table public.guardian_notices enable row level security;
revoke all on public.guardian_links, public.guardian_invites, public.guardian_notices from anon, authenticated;

-- ── 안쪽 함수 ───────────────────────────────────────────────────────────────
create or replace function public._guardian_conf()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('on', true, 'prompt_min', 50, 'prompt_max_min', 180, 'snooze_min', 20, 'remind_min', 70,
           'invite_child_days', 7, 'invite_desk_hours', 24, 'max_guardians', 4)
         || coalesce((select s.value from public.app_settings s where s.key = 'guardian' and jsonb_typeof(s.value) = 'object'), '{}'::jsonb);
$$;

-- 미성년인가 — true / false / null(모름). 생년월일이 있으면 만 나이, 해만 있으면 그해 나이 18 이하 = 미성년 · 20 이상 = 성인 · 19 = 모름
create or replace function public._guardian_minor(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_bd text;
  v_by int;
  v_date date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_year int := extract(year from (now() at time zone 'Asia/Seoul'))::int;
begin
  if p_user is null then return null; end if;
  select btrim(birth_date) into v_bd from public.profiles where user_id = p_user;
  if v_bd ~ '^\d{4}-\d{2}-\d{2}$' then
    begin v_date := v_bd::date; exception when others then v_date := null; end;
  elsif v_bd ~ '^\d{8}$' then
    begin v_date := to_date(v_bd, 'YYYYMMDD'); exception when others then v_date := null; end;
  end if;
  if v_date is not null and v_date between date '1920-01-01' and v_today then
    return extract(year from age(v_today, v_date))::int < 19;
  end if;
  select f.birth_year into v_by from public.member_fitness_profile f where f.user_id = p_user;
  if v_by is null and v_bd ~ '^\d{4}' then v_by := left(v_bd, 4)::int; end if;
  if v_by is null or v_by < 1920 or v_by > v_year then return null; end if;
  if v_year - v_by <= 18 then return true; end if;
  if v_year - v_by >= 20 then return false; end if;
  return null;
end $$;

create or replace function public._guardian_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''))
                     from public.profiles p where p.user_id = p_user), '회원');
$$;

create or replace function public._guardian_rel_label(p_relation text)
returns text language sql immutable as $$
  select case p_relation when 'mom' then '엄마' when 'dad' then '아빠' else '보호자' end;
$$;

create or replace function public._guardian_min_text(p_min int)
returns text language sql immutable as $$
  select case
    when p_min is null or p_min < 1 then '1분'
    when p_min < 60 then p_min || '분'
    when p_min % 60 = 0 then (p_min / 60) || '시간'
    else (p_min / 60) || '시간 ' || (p_min % 60) || '분' end;
$$;

-- 연결할 수 있는 회원 — 승인된 회원 · 지도진 아님 · 쓰지 않는 예전 계정 아님
create or replace function public._guardian_member_ok(p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.user_id = p_member
       and coalesce(p.is_approved, false)
       and not coalesce(p.is_staff, false)
       and p.merged_into is null);
$$;

-- 데스크(같은 지점 지도진 · 관리자) — set_member_locker 와 같은 기준
create or replace function public._guardian_staff_can(p_member uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_my text;
  v_staff boolean;
  v_target text;
begin
  if v_me is null or p_member is null then return false; end if;
  if public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin') then return true; end if;
  select branch_name, coalesce(is_staff, false) into v_my, v_staff from public.profiles where user_id = v_me;
  if not (public.has_role(v_me, 'branch_manager') or public.has_role(v_me, 'coach') or coalesce(v_staff, false)) then
    return false;
  end if;
  select branch_name into v_target from public.profiles where user_id = p_member;
  return coalesce(v_my, '') <> '' and v_my = v_target;
end $$;

create or replace function public._guardian_token()
returns text language sql volatile as $$
  select left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 32);
$$;

-- 알림함 + 휴대폰. p_quiet = 밤 10시 ~ 아침 8시는 알림함에만(연결 안내 같은 것) · 입장 / 운동 끝은 늘 휴대폰으로
create or replace function public._guardian_notify(p_user uuid, p_title text, p_body text, p_link text, p_quiet boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (p_user, left(p_title, 120), left(coalesce(p_body, ''), 300), p_link,
          case when p_quiet and (v_h >= 22 or v_h < 8) then now() end);
end $$;

-- ── 링크 만들기 ─────────────────────────────────────────────────────────────
-- 아이(회원 본인)가 엄마 · 아빠에게 보내는 링크
create or replace function public.guardian_invite_create()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_conf jsonb := public._guardian_conf();
  v_tok text;
  v_exp timestamptz;
  v_n int;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if not coalesce((v_conf->>'on')::boolean, true) then raise exception '지금은 보호자 연결을 쓸 수 없어요'; end if;
  if not public._guardian_member_ok(v_me) then raise exception '승인된 회원만 보호자를 연결할 수 있어요'; end if;
  select count(*) into v_n from public.guardian_invites where member_id = v_me and created_at > now() - interval '1 day';
  if v_n >= 10 then raise exception '오늘은 링크를 더 만들 수 없어요 · 내일 다시 해 주세요'; end if;
  v_tok := public._guardian_token();
  v_exp := now() + make_interval(days => greatest(1, least(30, coalesce((v_conf->>'invite_child_days')::int, 7))));
  insert into public.guardian_invites (token, member_id, via, made_by, expires_at)
  values (v_tok, v_me, 'child_invite', v_me, v_exp);
  return jsonb_build_object('ok', true, 'token', v_tok, 'expires_at', v_exp, 'name', public._guardian_name(v_me));
end $$;

-- 데스크 QR — 같은 지점 지도진이 회원 화면에서. 어머님이 그 자리에서 찍어 가입한다
create or replace function public.guardian_invite_create_for(p_member uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_conf jsonb := public._guardian_conf();
  v_tok text;
  v_exp timestamptz;
  v_n int;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if not coalesce((v_conf->>'on')::boolean, true) then raise exception '지금은 보호자 연결을 쓸 수 없어요'; end if;
  if not public._guardian_staff_can(p_member) then raise exception '같은 지점 지도진만 보호자 QR 을 만들 수 있어요'; end if;
  if not public._guardian_member_ok(p_member) then raise exception '승인된 회원만 보호자를 연결할 수 있어요'; end if;
  select count(*) into v_n from public.guardian_invites where made_by = v_me and created_at > now() - interval '1 day';
  if v_n >= 60 then raise exception '오늘은 QR 을 더 만들 수 없어요'; end if;
  v_tok := public._guardian_token();
  v_exp := now() + make_interval(hours => greatest(1, least(72, coalesce((v_conf->>'invite_desk_hours')::int, 24))));
  insert into public.guardian_invites (token, member_id, via, made_by, expires_at)
  values (v_tok, p_member, 'desk_qr', v_me, v_exp);
  return jsonb_build_object('ok', true, 'token', v_tok, 'expires_at', v_exp,
                            'name', public._guardian_name(p_member), 'minor', public._guardian_minor(p_member));
end $$;

-- ── 링크 열기 (보호자) ──────────────────────────────────────────────────────
create or replace function public.guardian_invite_peek(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  r public.guardian_invites%rowtype;
  v_link text;
  v_branch text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'code', 'login'); end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  select * into r from public.guardian_invites where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  if r.used_at is not null then
    return jsonb_build_object('ok', false, 'code', case when r.used_by = v_me then 'done' else 'used' end);
  end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
  if r.member_id = v_me then return jsonb_build_object('ok', false, 'code', 'self'); end if;
  if not public._guardian_member_ok(r.member_id) then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  select l.status into v_link from public.guardian_links l
   where l.guardian_id = v_me and l.member_id = r.member_id and l.status in ('pending', 'active');
  select replace(branch_name, '153복싱짐 ', '') into v_branch from public.profiles where user_id = r.member_id;
  return jsonb_build_object('ok', true, 'name', public._guardian_name(r.member_id), 'branch', v_branch,
                            'via', r.via, 'linked', v_link, 'expires_at', r.expires_at,
                            'needs_accept', r.via = 'desk_qr' and public._guardian_minor(r.member_id) is false);
end $$;

create or replace function public.guardian_invite_accept(p_token text, p_relation text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_conf jsonb := public._guardian_conf();
  v_rel text := coalesce(nullif(btrim(p_relation), ''), 'guardian');
  r public.guardian_invites%rowtype;
  v_existing public.guardian_links%rowtype;
  v_status text;
  v_id uuid;
  v_n int;
  v_gname text;
  v_label text;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if v_rel not in ('mom', 'dad', 'guardian') then raise exception '엄마 · 아빠 · 보호자 중에서 골라 주세요'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception '링크를 찾을 수 없어요'; end if;
  select * into r from public.guardian_invites where token = p_token for update;
  if not found then raise exception '링크를 찾을 수 없어요'; end if;
  if r.used_at is not null then
    if r.used_by = v_me then
      select * into v_existing from public.guardian_links
       where guardian_id = v_me and member_id = r.member_id and status in ('pending', 'active');
      return jsonb_build_object('ok', true, 'already', true, 'status', coalesce(v_existing.status, 'ended'), 'link_id', v_existing.id);
    end if;
    raise exception '이미 쓴 링크예요 · 새 링크를 받아 주세요';
  end if;
  if r.expires_at < now() then raise exception '기한이 지난 링크예요 · 새 링크를 받아 주세요'; end if;
  if r.member_id = v_me then raise exception '내가 만든 링크는 내가 쓸 수 없어요 · 엄마나 아빠에게 보내 주세요'; end if;
  if not public._guardian_member_ok(r.member_id) then raise exception '연결할 수 없는 회원이에요'; end if;

  select * into v_existing from public.guardian_links
   where guardian_id = v_me and member_id = r.member_id and status in ('pending', 'active');
  if found then
    update public.guardian_invites set used_at = now(), used_by = v_me where token = p_token;
    return jsonb_build_object('ok', true, 'already', true, 'status', v_existing.status, 'link_id', v_existing.id);
  end if;

  select count(*) into v_n from public.guardian_links where member_id = r.member_id and status in ('pending', 'active');
  if v_n >= greatest(1, coalesce((v_conf->>'max_guardians')::int, 4)) then
    raise exception '보호자는 %명까지 연결할 수 있어요', greatest(1, coalesce((v_conf->>'max_guardians')::int, 4));
  end if;

  -- 아이가 보낸 링크 = 아이가 동의한 것 · 데스크 QR 은 성인 회원이면 본인이 수락해야 이어진다
  v_status := case when r.via = 'desk_qr' and public._guardian_minor(r.member_id) is false then 'pending' else 'active' end;
  insert into public.guardian_links (guardian_id, member_id, relation, via, status, created_by, accepted_at)
  values (v_me, r.member_id, v_rel, r.via, v_status, r.made_by, case when v_status = 'active' then now() end)
  returning id into v_id;
  update public.guardian_invites set used_at = now(), used_by = v_me where token = p_token;

  -- 보호자만 쓰는 계정이면 표시 (승인된 회원 · 지도진 계정은 그대로 — 회원 화면 홈에 「우리 아이」 카드가 더해진다)
  update public.profiles set account_kind = 'guardian'
   where user_id = v_me and not coalesce(is_approved, false) and not coalesce(is_staff, false) and account_kind is null;

  v_gname := public._guardian_name(v_me);
  v_label := public._guardian_rel_label(v_rel);
  if v_status = 'active' then
    perform public._guardian_notify(r.member_id, '보호자가 연결됐어요',
      v_label || ' · ' || v_gname || '님이 체육관에 온 시각과 운동 시간을 볼 수 있어요', '/settings?guardian=1', true);
  else
    perform public._guardian_notify(r.member_id, '보호자 연결 요청이 왔어요',
      v_label || ' · ' || v_gname || '님이 연결을 요청했어요 · 수락하면 체육관에 온 시각과 운동 시간이 보여요', '/settings?guardian=1', true);
  end if;
  return jsonb_build_object('ok', true, 'status', v_status, 'link_id', v_id, 'name', public._guardian_name(r.member_id));
end $$;

-- ── 수락 · 끊기 ─────────────────────────────────────────────────────────────
create or replace function public.guardian_respond(p_link uuid, p_accept boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  l public.guardian_links%rowtype;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  select * into l from public.guardian_links where id = p_link for update;
  if not found or l.member_id <> v_me then raise exception '요청을 찾을 수 없어요'; end if;
  if l.status <> 'pending' then return jsonb_build_object('ok', true, 'status', l.status); end if;
  if coalesce(p_accept, false) then
    update public.guardian_links set status = 'active', accepted_at = now() where id = p_link;
    perform public._guardian_notify(l.guardian_id, '보호자 연결이 이어졌어요',
      public._guardian_name(v_me) || ' 회원이 연결을 수락했어요', '/guardian', true);
    return jsonb_build_object('ok', true, 'status', 'active');
  end if;
  update public.guardian_links set status = 'ended', ended_at = now(), ended_by = v_me, ended_reason = 'declined' where id = p_link;
  perform public._guardian_notify(l.guardian_id, '보호자 연결이 이어지지 않았어요',
    '회원이 연결 요청을 수락하지 않았어요', '/guardian', true);
  return jsonb_build_object('ok', true, 'status', 'ended');
end $$;

create or replace function public.guardian_unlink(p_link uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  l public.guardian_links%rowtype;
  v_who text;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  select * into l from public.guardian_links where id = p_link and status in ('pending', 'active') for update;
  if not found then raise exception '연결을 찾을 수 없어요'; end if;
  if l.guardian_id = v_me then
    v_who := 'guardian';
  elsif l.member_id = v_me then
    -- 미성년(또는 나이를 모르는) 회원은 데스크에서만 끊는다 — 성인 회원은 본인이
    if l.status = 'active' and public._guardian_minor(v_me) is distinct from false then
      raise exception '연결을 끊으려면 데스크에 말씀해 주세요';
    end if;
    v_who := 'member';
  elsif public._guardian_staff_can(l.member_id) then
    v_who := 'staff';
  else
    raise exception '이 연결을 끊을 수 없어요';
  end if;
  update public.guardian_links set status = 'ended', ended_at = now(), ended_by = v_me, ended_reason = v_who where id = p_link;
  if v_who <> 'guardian' then
    perform public._guardian_notify(l.guardian_id, '보호자 연결이 끝났어요',
      public._guardian_name(l.member_id) || ' 회원과의 연결이 끝났어요', '/guardian', true);
  end if;
  if v_who <> 'member' then
    perform public._guardian_notify(l.member_id, '보호자 연결이 끝났어요',
      public._guardian_rel_label(l.relation) || ' · ' || public._guardian_name(l.guardian_id) || '님과의 연결이 끝났어요',
      '/settings?guardian=1', true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 화면 자료 ───────────────────────────────────────────────────────────────
-- 누구에게나: 회원 쪽(내 보호자 · 팝업 대상) + 보호자 쪽(연결된 아이 수 · 보호자 계정인가)
create or replace function public.my_guardian_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_conf jsonb := public._guardian_conf();
  v_on boolean;
  v_member boolean;
  v_minor boolean;
  v_kind text;
  v_links jsonb;
  v_active boolean;
  v_kids int;
begin
  if v_me is null then return jsonb_build_object('on', false); end if;
  v_on := coalesce((v_conf->>'on')::boolean, true);
  select account_kind into v_kind from public.profiles where user_id = v_me;
  v_member := public._guardian_member_ok(v_me);
  v_minor := public._guardian_minor(v_me);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'relation', l.relation, 'status', l.status, 'via', l.via,
           'name', public._guardian_name(l.guardian_id), 'since', coalesce(l.accepted_at, l.created_at))
           order by l.created_at), '[]'::jsonb)
    into v_links
    from public.guardian_links l
   where l.member_id = v_me and l.status in ('pending', 'active');
  v_active := exists (select 1 from public.guardian_links l where l.member_id = v_me and l.status = 'active');
  select count(*) into v_kids from public.guardian_links l where l.guardian_id = v_me and l.status = 'active';
  return jsonb_build_object(
    'on', v_on,
    'is_member', v_member,
    'guardian_account', v_kind = 'guardian',
    'kids', v_kids,
    'minor', v_minor,
    'links', v_links,
    'has_guardian', v_active,
    'can_unlink', v_minor is false,
    'prompt', v_on and v_member and (v_active or v_minor is true),
    'prompt_min', greatest(10, least(170, coalesce((v_conf->>'prompt_min')::int, 50))),
    'prompt_max_min', greatest(60, least(240, coalesce((v_conf->>'prompt_max_min')::int, 180))),
    'snooze_min', greatest(5, least(120, coalesce((v_conf->>'snooze_min')::int, 20))));
end $$;

-- 보호자 화면 「우리 아이」 — 연결된 아이마다 오늘 · 이번 달 · 최근 기록 · 레벨 · 코치님 한마디 · 153 PB.
-- 보이지 않는 것: 메시지 · 커뮤니티 글 · 마음 체크 · 몸무게 · 체지방률
create or replace function public.guardian_home()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month timestamp := date_trunc('month', now() at time zone 'Asia/Seoul');
  v_kids jsonb := '[]'::jsonb;
  r record;
  v_in timestamptz;
  v_out timestamptz;
  v_src text;
  v_mdays int;
  v_mmin int;
  v_tdays int;
  v_tmin int;
  v_first timestamptz;
  v_dates jsonb;
  v_recent jsonb;
  v_rank text;
  v_level int;
  v_since timestamptz;
  v_prog numeric;
  v_req int;
  v_notes jsonb;
  v_pb_best int;
  v_pb_n int;
  v_branch text;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  for r in
    select l.id, l.member_id, l.relation, l.via, coalesce(l.accepted_at, l.created_at) as since
      from public.guardian_links l
     where l.guardian_id = v_me and l.status = 'active'
     order by l.created_at
  loop
    v_in := null; v_out := null; v_src := null;
    select a.checked_in_at, a.ended_at, a.ended_source into v_in, v_out, v_src
      from public.attendance_logs a
     where a.user_id = r.member_id and not coalesce(a.is_duplicate, false)
       and (a.checked_in_at at time zone 'Asia/Seoul')::date = v_today
     order by a.checked_in_at asc limit 1;

    select count(*), coalesce(sum(public.workout_minutes(a.checked_in_at, a.ended_at)), 0)
      into v_mdays, v_mmin
      from public.attendance_logs a
     where a.user_id = r.member_id and not coalesce(a.is_duplicate, false)
       and (a.checked_in_at at time zone 'Asia/Seoul') >= v_month;

    select count(*), coalesce(sum(public.workout_minutes(a.checked_in_at, a.ended_at)), 0), min(a.checked_in_at)
      into v_tdays, v_tmin, v_first
      from public.attendance_logs a
     where a.user_id = r.member_id and not coalesce(a.is_duplicate, false);

    select coalesce(jsonb_agg(d order by d), '[]'::jsonb) into v_dates
      from (select distinct (a.checked_in_at at time zone 'Asia/Seoul')::date as d
              from public.attendance_logs a
             where a.user_id = r.member_id and not coalesce(a.is_duplicate, false)
               and (a.checked_in_at at time zone 'Asia/Seoul') >= v_month) x;

    -- 최근 10번 — 들어온 시각 · 나간 시각(끝 기록이 있을 때만) · 실제로 머문 분
    select coalesce(jsonb_agg(jsonb_build_object(
             'day', (x.checked_in_at at time zone 'Asia/Seoul')::date,
             'in', to_char(x.checked_in_at at time zone 'Asia/Seoul', 'HH24:MI'),
             'out', case when x.ended_at is not null and x.ended_at > x.checked_in_at
                              and x.ended_at - x.checked_in_at <= interval '4 hours'
                         then to_char(x.ended_at at time zone 'Asia/Seoul', 'HH24:MI') end,
             'min', case when x.ended_at is not null and x.ended_at > x.checked_in_at
                              and x.ended_at - x.checked_in_at <= interval '4 hours'
                         then ceil(extract(epoch from (x.ended_at - x.checked_in_at)) / 60.0)::int end)
             order by x.checked_in_at desc), '[]'::jsonb)
      into v_recent
      from (select a.checked_in_at, a.ended_at
              from public.attendance_logs a
             where a.user_id = r.member_id and not coalesce(a.is_duplicate, false)
             order by a.checked_in_at desc limit 10) x;

    v_rank := null; v_level := null; v_since := null;
    select mp.current_rank::text, coalesce(mp.current_level, 1), mp.level_started_at
      into v_rank, v_level, v_since
      from public.member_progress mp where mp.user_id = r.member_id;
    v_req := null; v_prog := null;
    if v_rank is not null then
      v_req := public.level_visit_requirement(v_rank::rank_name);
      select coalesce(sum(public.workout_progress(public.workout_minutes(a.checked_in_at, a.ended_at))), 0)
        into v_prog
        from public.attendance_logs a
       where a.user_id = r.member_id and not coalesce(a.is_duplicate, false)
         and a.checked_in_at >= coalesce(v_since, now() - interval '3650 days');
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'day', n.day, 'body', n.body,
             'who', coalesce(nullif(btrim(cp.name), ''), nullif(btrim(cp.nickname), ''), '코치') || ' '
                    || coalesce(nullif(btrim(cp.staff_title), ''), '코치') || '님')
             order by n.day desc, n.created_at desc), '[]'::jsonb)
      into v_notes
      from (select * from public.coach_day_notes c
             where c.member_user_id = r.member_id and c.removed_at is null
             order by c.day desc, c.created_at desc limit 3) n
      left join public.profiles cp on cp.user_id = n.coach_user_id;

    select min(t.total_ms) filter (where t.official and t.finished), count(*) filter (where t.official)
      into v_pb_best, v_pb_n
      from public.test153_records t where t.user_id = r.member_id;

    select replace(p.branch_name, '153복싱짐 ', '') into v_branch from public.profiles p where p.user_id = r.member_id;

    v_kids := v_kids || jsonb_build_array(jsonb_build_object(
      'link_id', r.id,
      'member_id', r.member_id,
      'relation', r.relation,
      'since', r.since,
      'name', public._guardian_name(r.member_id),
      'branch', v_branch,
      'today', jsonb_build_object(
        'in', case when v_in is not null then to_char(v_in at time zone 'Asia/Seoul', 'HH24:MI') end,
        'in_at', v_in,
        'out', case when v_out is not null and v_out > v_in and v_out - v_in <= interval '4 hours'
                    then to_char(v_out at time zone 'Asia/Seoul', 'HH24:MI') end,
        'min', case when v_out is not null and v_out > v_in and v_out - v_in <= interval '4 hours'
                    then ceil(extract(epoch from (v_out - v_in)) / 60.0)::int end,
        'elapsed', case when v_in is not null and v_out is null
                        then greatest(0, floor(extract(epoch from (now() - v_in)) / 60))::int end),
      'month', jsonb_build_object('days', v_mdays, 'minutes', v_mmin, 'dates', v_dates),
      'total', jsonb_build_object('days', v_tdays, 'minutes', v_tmin,
                                  'first', case when v_first is not null then (v_first at time zone 'Asia/Seoul')::date end),
      'recent', v_recent,
      'level', case when v_rank is null then null else jsonb_build_object(
        'rank', v_rank, 'level', v_level,
        'need', case when v_level < 10 and v_rank in ('white', 'blue')
                     then greatest(0, v_req - floor(v_prog)::int) end) end,
      'notes', v_notes,
      'pb', case when coalesce(v_pb_n, 0) = 0 then null else jsonb_build_object('best_ms', v_pb_best, 'count', v_pb_n) end
    ));
  end loop;
  return jsonb_build_object('ok', true, 'today', v_today, 'kids', v_kids,
                            'guardian_account', exists (select 1 from public.profiles p where p.user_id = v_me and p.account_kind = 'guardian'));
end $$;

-- 데스크 — 회원 화면의 보호자 칸
create or replace function public.guardian_staff_links(p_member uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._guardian_staff_can(p_member) then raise exception '같은 지점 지도진만 볼 수 있어요'; end if;
  return jsonb_build_object(
    'ok', true,
    'minor', public._guardian_minor(p_member),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'relation', l.relation, 'status', l.status, 'via', l.via,
               'name', public._guardian_name(l.guardian_id), 'since', coalesce(l.accepted_at, l.created_at))
               order by l.created_at)
        from public.guardian_links l
       where l.member_id = p_member and l.status in ('pending', 'active')), '[]'::jsonb));
end $$;

-- ── 1분 예약 ────────────────────────────────────────────────────────────────
-- ① 들어왔어요(그날 첫 출석) → 보호자 ② 운동 끝(종료 버튼 · 얼굴 인식 한 번 더) → 보호자
-- ③ 끝 기록 없이 remind_min 분 → 아이에게 한 번. 끝 기록이 없다고 보호자에게 알리지는 않는다(대표님 결정 3).
create or replace function public.guardian_tick()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_conf jsonb := public._guardian_conf();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_remind int;
  r record;
  v_in int := 0;
  v_end int := 0;
  v_kid int := 0;
begin
  if not coalesce((v_conf->>'on')::boolean, true) then return jsonb_build_object('off', true); end if;
  v_remind := greatest(30, least(180, coalesce((v_conf->>'remind_min')::int, 70)));

  for r in
    select a.id as att_id, a.user_id, a.checked_in_at, l.guardian_id
      from public.attendance_logs a
      join public.guardian_links l on l.member_id = a.user_id and l.status = 'active'
     where not coalesce(a.is_duplicate, false)
       and a.created_at > now() - interval '40 minutes'
       and a.checked_in_at > now() - interval '3 hours'
       and (a.checked_in_at at time zone 'Asia/Seoul')::date = v_today
       and not exists (select 1 from public.attendance_logs b
                        where b.user_id = a.user_id and not coalesce(b.is_duplicate, false)
                          and (b.checked_in_at at time zone 'Asia/Seoul')::date = v_today
                          and b.checked_in_at < a.checked_in_at)
       and not exists (select 1 from public.guardian_notices n
                        where n.kind = 'in' and n.attendance_id = a.id and n.user_id = l.guardian_id)
  loop
    insert into public.guardian_notices (kind, attendance_id, user_id) values ('in', r.att_id, r.guardian_id)
    on conflict do nothing;
    if found then
      perform public._guardian_notify(r.guardian_id,
        public._guardian_name(r.user_id) || ' · ' || to_char(r.checked_in_at at time zone 'Asia/Seoul', 'HH24:MI') || ' 체육관 도착',
        '운동 끝 기록이 남으면 다시 알려 드릴게요', '/guardian', false);
      v_in := v_in + 1;
    end if;
  end loop;

  for r in
    select a.id as att_id, a.user_id, a.checked_in_at, a.ended_at, l.guardian_id
      from public.attendance_logs a
      join public.guardian_links l on l.member_id = a.user_id and l.status = 'active'
     where not coalesce(a.is_duplicate, false)
       and a.ended_at is not null
       and a.ended_at > now() - interval '40 minutes'
       and a.ended_at <= now() + interval '1 minute'
       and a.ended_at > a.checked_in_at
       and a.ended_at - a.checked_in_at <= interval '4 hours'
       and (a.checked_in_at at time zone 'Asia/Seoul')::date = v_today
       and not exists (select 1 from public.attendance_logs b
                        where b.user_id = a.user_id and not coalesce(b.is_duplicate, false)
                          and (b.checked_in_at at time zone 'Asia/Seoul')::date = v_today
                          and b.checked_in_at < a.checked_in_at)
       and not exists (select 1 from public.guardian_notices n
                        where n.kind = 'end' and n.attendance_id = a.id and n.user_id = l.guardian_id)
  loop
    insert into public.guardian_notices (kind, attendance_id, user_id) values ('end', r.att_id, r.guardian_id)
    on conflict do nothing;
    if found then
      perform public._guardian_notify(r.guardian_id,
        public._guardian_name(r.user_id) || ' · ' || to_char(r.ended_at at time zone 'Asia/Seoul', 'HH24:MI') || ' 운동 끝',
        '오늘 ' || public._guardian_min_text(ceil(extract(epoch from (r.ended_at - r.checked_in_at)) / 60.0)::int)
          || ' 운동했어요 · ' || to_char(r.checked_in_at at time zone 'Asia/Seoul', 'HH24:MI') || ' ~ '
          || to_char(r.ended_at at time zone 'Asia/Seoul', 'HH24:MI'),
        '/guardian', false);
      v_end := v_end + 1;
    end if;
  end loop;

  for r in
    select a.id as att_id, a.user_id
      from public.attendance_logs a
     where not coalesce(a.is_duplicate, false)
       and a.ended_at is null
       and a.checked_in_at <= now() - make_interval(mins => v_remind)
       and a.checked_in_at > now() - make_interval(mins => v_remind + 30)
       and (a.checked_in_at at time zone 'Asia/Seoul')::date = v_today
       and exists (select 1 from public.guardian_links l where l.member_id = a.user_id and l.status = 'active')
       and not exists (select 1 from public.attendance_logs b
                        where b.user_id = a.user_id and not coalesce(b.is_duplicate, false)
                          and (b.checked_in_at at time zone 'Asia/Seoul')::date = v_today
                          and b.checked_in_at < a.checked_in_at)
       and not exists (select 1 from public.guardian_notices n
                        where n.kind = 'kid_remind' and n.attendance_id = a.id and n.user_id = a.user_id)
  loop
    insert into public.guardian_notices (kind, attendance_id, user_id) values ('kid_remind', r.att_id, r.user_id)
    on conflict do nothing;
    if found then
      perform public._guardian_notify(r.user_id, '운동 끝나면 「운동 끝」을 눌러 주세요',
        '누르면 보호자에게 끝난 시각이 바로 가요', '/home?finish=1', false);
      v_kid := v_kid + 1;
    end if;
  end loop;

  return jsonb_build_object('in', v_in, 'end', v_end, 'kid', v_kid);
end $$;

-- ── 권한 ────────────────────────────────────────────────────────────────────
revoke execute on function public._guardian_conf() from public, anon, authenticated;
revoke execute on function public._guardian_minor(uuid) from public, anon, authenticated;
revoke execute on function public._guardian_name(uuid) from public, anon, authenticated;
revoke execute on function public._guardian_rel_label(text) from public, anon, authenticated;
revoke execute on function public._guardian_min_text(int) from public, anon, authenticated;
revoke execute on function public._guardian_member_ok(uuid) from public, anon, authenticated;
revoke execute on function public._guardian_staff_can(uuid) from public, anon, authenticated;
revoke execute on function public._guardian_token() from public, anon, authenticated;
revoke execute on function public._guardian_notify(uuid, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.guardian_tick() from public, anon, authenticated;

revoke execute on function public.guardian_invite_create() from public, anon;
revoke execute on function public.guardian_invite_create_for(uuid) from public, anon;
revoke execute on function public.guardian_invite_peek(text) from public, anon;
revoke execute on function public.guardian_invite_accept(text, text) from public, anon;
revoke execute on function public.guardian_respond(uuid, boolean) from public, anon;
revoke execute on function public.guardian_unlink(uuid) from public, anon;
revoke execute on function public.my_guardian_state() from public, anon;
revoke execute on function public.guardian_home() from public, anon;
revoke execute on function public.guardian_staff_links(uuid) from public, anon;

grant execute on function public.guardian_invite_create() to authenticated;
grant execute on function public.guardian_invite_create_for(uuid) to authenticated;
grant execute on function public.guardian_invite_peek(text) to authenticated;
grant execute on function public.guardian_invite_accept(text, text) to authenticated;
grant execute on function public.guardian_respond(uuid, boolean) to authenticated;
grant execute on function public.guardian_unlink(uuid) to authenticated;
grant execute on function public.my_guardian_state() to authenticated;
grant execute on function public.guardian_home() to authenticated;
grant execute on function public.guardian_staff_links(uuid) to authenticated;

-- 끄기: update public.app_settings set value = jsonb_set(value, '{on}', 'false') where key = 'guardian';
--       (예약까지) select cron.unschedule('guardian-tick');
select cron.schedule('guardian-tick', '* * * * *', $$select public.guardian_tick()$$);
