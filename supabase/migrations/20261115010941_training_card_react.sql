-- 🎬 영상으로 배우기 3단계 — 반응 · 의견 · 찾았는데 없는 동작 · 영상 찍어 주세요
--   2026-11-15 대표님 「3단계시작」 — 보고서 「영상으로 배우기 — 대표님 정리 편집 · 내 수업 · 반응 데이터」
--   https://claude.ai/artifact/F9QW5nn9N51k5wqZmGKVdE 의 3단계 칸 · 결정 4번(코치님 · 대표님만 보는 의견부터) · 5번(♥ 숫자는 5명 넘을 때만)
--
--   ① 반응 training_card_reactions — 사람 · 카드마다 한 줄: ♥(heart) · 쉬워요/딱 좋아요/어려워요(feel easy · ok · hard).
--      회원 화면 숫자 = ♥ 누른 회원이 5명을 넘을 때만 · 코치진 화면 = 전부(♥ · 쉬워요 · 딱 좋아요 · 어려워요 · 영상 요청 · 의견 수).
--   ② 의견 training_card_opinions — 회원님 「코치님께 의견」(300자 · 하루 5개) → 그 지점 코치진 알림.
--      보는 사람 = 쓴 분 · 그 지점 코치진 · 대표님. 코치님 답은 의견마다 하나(쓴 코치님 · 대표님은 고칠 수 있음) → 회원님 알림.
--      지우기 = 쓴 분 · 대표님 → removed_at + 글 · 답 비움(줄은 남긴다 — 지우는 SQL 을 쓰지 않는다).
--   ③ 찾기 · 요청 training_card_asks — 찾았는데 없는 동작(miss — 찾기 결과 0, 화면이 잠깐 기다렸다 한 번) ·
--      영상 찍어 주세요(film — 영상 없는 카드 또는 없던 검색어). 사람 · 종류 · 열쇠마다 한 줄(다시 남기면 n 만 올림).
--      보관 1년(결정 8번 — 4단계에서 이용 기록과 같이 지우는 예약).
--   회원 여부(member)는 처음 남길 때 _is_rankable_member — 숫자는 회원 줄만 센다(코치진 · 체험 계정 빼고).
--   알림은 밤(22~07시 한국)이면 알림함에만(휴대폰 알림 없이).
--
--   새 표 3 · 새 함수 8(안쪽 4) · 기존 표 · 함수는 그대로.

-- ── ① 반응 ─────────────────────────────────────────────────
create table if not exists public.training_card_reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null check (item ~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  heart boolean not null default false,
  feel text check (feel in ('easy', 'ok', 'hard')),
  member boolean not null default false,
  branch_name text,
  heart_at timestamptz,
  feel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item)
);
create index if not exists training_card_reactions_item_idx on public.training_card_reactions (item);
alter table public.training_card_reactions enable row level security;
revoke all on public.training_card_reactions from public, anon, authenticated;

-- ── ② 의견 ─────────────────────────────────────────────────
create table if not exists public.training_card_opinions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null check (item ~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  body text not null default '' check (char_length(body) <= 300 and (removed_at is not null or char_length(btrim(body)) >= 1)),
  branch_name text,
  member boolean not null default false,
  created_at timestamptz not null default now(),
  reply text check (reply is null or char_length(reply) between 1 and 300),
  reply_by uuid references auth.users(id) on delete set null,
  reply_at timestamptz,
  reply_seen_at timestamptz,
  removed_at timestamptz
);
create index if not exists training_card_opinions_item_idx on public.training_card_opinions (item, created_at desc) where removed_at is null;
create index if not exists training_card_opinions_branch_idx on public.training_card_opinions (branch_name, created_at desc) where removed_at is null;
create index if not exists training_card_opinions_user_idx on public.training_card_opinions (user_id, created_at desc);
alter table public.training_card_opinions enable row level security;
revoke all on public.training_card_opinions from public, anon, authenticated;

-- ── ③ 찾았는데 없는 동작 · 영상 찍어 주세요 ──────────────────
create table if not exists public.training_card_asks (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('miss', 'film')),
  key text not null check (key ~ '^(q:.{2,40}|[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  query text check (query is null or char_length(query) <= 40),
  n integer not null default 1 check (n between 1 and 1000),
  member boolean not null default false,
  branch_name text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);
create index if not exists training_card_asks_key_idx on public.training_card_asks (kind, key);
create index if not exists training_card_asks_last_idx on public.training_card_asks (last_at);
alter table public.training_card_asks enable row level security;
revoke all on public.training_card_asks from public, anon, authenticated;

-- ── 항목이 있나 (안쪽) — c:<카드> · m:<레벨 미션 영상> ──
create or replace function public._card_item_ok(p_item text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce(p_item, '') !~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    when p_item like 'c:%' then exists (select 1 from public.training_exercises t where t.id = substr(p_item, 3)::uuid)
    else exists (select 1 from public.missions m where m.id = substr(p_item, 3)::uuid)
  end;
$$;
revoke all on function public._card_item_ok(text) from public, anon, authenticated;

-- ── 항목 이름 (안쪽) — 알림 글 · 코치진 목록 ([복싱/○○] 꼬리표는 뺀다) ──
create or replace function public._card_item_name(p_item text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when coalesce(p_item, '') !~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then '카드'
    when p_item like 'c:%' then coalesce((select t.name from public.training_exercises t where t.id = substr(p_item, 3)::uuid), '카드')
    else coalesce((select nullif(btrim(regexp_replace(m.title, '\[[^]]*\]', '', 'g')), '')
                     from public.missions m where m.id = substr(p_item, 3)::uuid), '워밍업 영상')
  end;
$$;
revoke all on function public._card_item_name(text) from public, anon, authenticated;

-- ── 의견을 보고 답할 수 있나 (안쪽) — 대표님 · 그 지점 코치진 ──
create or replace function public._card_opinion_viewer(p_uid uuid, p_branch text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and (
    public._strategy_hq(p_uid)
    or (p_branch is not null and public._strategy_staff(p_uid)
        and exists (select 1 from public.profiles s where s.user_id = p_uid and s.branch_name = p_branch)));
$$;
revoke all on function public._card_opinion_viewer(uuid, text) from public, anon, authenticated;

-- ── 의견 한 줄 → 화면 (안쪽) — 코치진(p_staff)에게만 회원 이름 · 사진 · 지점 · 카드 이름 · 답할 수 있나 ──
create or replace function public._card_opinion_json(o public.training_card_opinions, p_staff boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'id', o.id, 'item', o.item, 'body', o.body, 'at', o.created_at,
           'reply', case when o.reply is null then null else jsonb_build_object(
                      'body', o.reply, 'at', o.reply_at,
                      'by', coalesce(public._strategy_display(o.reply_by), jsonb_build_object('name', '코치', 'title', '코치')),
                      'mine', o.reply_by is not distinct from auth.uid()) end,
           'seen', o.reply is null or o.reply_seen_at is not null)
      || case when p_staff then jsonb_build_object(
                'branch', o.branch_name,
                'item_name', public._card_item_name(o.item),
                'owner', jsonb_build_object(
                  'user_id', o.user_id,
                  'name', coalesce((select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''))
                                      from public.profiles p where p.user_id = o.user_id), '회원'),
                  'avatar_url', (select p.avatar_url from public.profiles p where p.user_id = o.user_id)),
                'can_reply', o.reply is null or o.reply_by is not distinct from auth.uid() or public._strategy_hq(auth.uid()))
              else '{}'::jsonb end;
$$;
revoke all on function public._card_opinion_json(public.training_card_opinions, boolean) from public, anon, authenticated;

-- ── 카드 한 장의 반응 · 의견 (카드 시트) ──
--   회원: 내 ♥ · 내 쉬워요/어려워요 · 영상 요청했나 · 내 의견과 답 · ♥ 숫자(5명 넘을 때만)
--   코치진: + 회원 숫자 전부 · 그 지점(대표님은 모든 지점) 회원님 의견 30개
create or replace function public.training_card_social(p_item text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item text := lower(btrim(coalesce(p_item, '')));
  v_staff boolean;
  v_hq boolean;
  v_branch text;
  v_hearts integer;
  r public.training_card_reactions%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._card_item_ok(v_item) then raise exception '없는 카드예요' using errcode = '22023'; end if;
  v_staff := public._strategy_staff(v_uid);
  v_hq := public._strategy_hq(v_uid);
  select * into r from public.training_card_reactions where user_id = v_uid and item = v_item;
  select count(*) into v_hearts from public.training_card_reactions where item = v_item and heart and member;
  if v_staff then select p.branch_name into v_branch from public.profiles p where p.user_id = v_uid; end if;
  return jsonb_build_object(
    'viewer', case when v_staff then 'staff' else 'member' end,
    'me', jsonb_build_object(
      'heart', coalesce(r.heart, false),
      'feel', r.feel,
      'asked', exists (select 1 from public.training_card_asks a where a.user_id = v_uid and a.kind = 'film' and a.key = v_item)),
    'hearts', case when v_hearts > 5 then v_hearts end,
    'opinions', coalesce((
      select jsonb_agg(public._card_opinion_json(o, false) order by o.created_at)
        from public.training_card_opinions o
       where o.user_id = v_uid and o.item = v_item and o.removed_at is null), '[]'::jsonb),
    'staff', case when not v_staff then null else jsonb_build_object(
      'counts', (select jsonb_build_object(
                          'hearts', count(*) filter (where x.heart),
                          'easy', count(*) filter (where x.feel = 'easy'),
                          'ok', count(*) filter (where x.feel = 'ok'),
                          'hard', count(*) filter (where x.feel = 'hard'))
                   from public.training_card_reactions x where x.item = v_item and x.member)
             || jsonb_build_object(
                  'asks', (select count(*) from public.training_card_asks a where a.kind = 'film' and a.key = v_item and a.member),
                  'opinions', (select count(*) from public.training_card_opinions o where o.item = v_item and o.removed_at is null and o.member)),
      'opinions', coalesce((
        select jsonb_agg(public._card_opinion_json(o, true) order by (o.reply is null) desc, o.created_at desc)
          from (select * from public.training_card_opinions o2
                 where o2.item = v_item and o2.removed_at is null and (v_hq or o2.branch_name = v_branch)
                 order by o2.created_at desc
                 limit 30) o), '[]'::jsonb)) end);
end $$;
revoke all on function public.training_card_social(text) from public, anon;
grant execute on function public.training_card_social(text) to authenticated;

-- ── 반응 남기기 — ♥ 켜고 끄기 · 쉬워요/딱 좋아요/어려워요 (p_feel: null = 그대로 · '' = 지우기) ──
create or replace function public.training_card_react(p_item text, p_heart boolean default null, p_feel text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item text := lower(btrim(coalesce(p_item, '')));
  v_feel text := nullif(lower(btrim(coalesce(p_feel, ''))), '');
  v_hearts integer;
  r public.training_card_reactions%rowtype;
begin
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 반응을 남길 수 있어요' using errcode = '42501';
  end if;
  if not public._card_item_ok(v_item) then raise exception '없는 카드예요' using errcode = '22023'; end if;
  if v_feel is not null and v_feel not in ('easy', 'ok', 'hard') then
    raise exception '쉬워요 · 딱 좋아요 · 어려워요 중에서 골라요' using errcode = '22023';
  end if;
  insert into public.training_card_reactions as x (user_id, item, heart, feel, member, branch_name, heart_at, feel_at)
  values (v_uid, v_item, coalesce(p_heart, false), v_feel,
          public._is_rankable_member(v_uid), (select p.branch_name from public.profiles p where p.user_id = v_uid),
          case when p_heart then now() end, case when v_feel is not null then now() end)
  on conflict (user_id, item) do update
    set heart = coalesce(p_heart, x.heart),
        heart_at = case when p_heart and not x.heart then now() else x.heart_at end,
        feel = case when p_feel is null then x.feel else v_feel end,
        feel_at = case when p_feel is not null and v_feel is distinct from x.feel then now() else x.feel_at end,
        updated_at = now()
  returning * into r;
  select count(*) into v_hearts from public.training_card_reactions where item = v_item and heart and member;
  return jsonb_build_object('ok', true, 'heart', r.heart, 'feel', r.feel, 'hearts', case when v_hearts > 5 then v_hearts end);
end $$;
revoke all on function public.training_card_react(text, boolean, text) from public, anon;
grant execute on function public.training_card_react(text, boolean, text) to authenticated;

-- ── 코치님께 의견 (회원님) → 그 지점 코치진 알림 ──
create or replace function public.training_card_opinion_add(p_item text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item text := lower(btrim(coalesce(p_item, '')));
  v_body text := btrim(coalesce(p_body, ''));
  v_since timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
  v_quiet boolean := extract(hour from (now() at time zone 'Asia/Seoul')) not between 7 and 21;
  v_branch text;
  v_who text;
  v_id uuid;
  v_n integer := 0;
begin
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 의견을 보낼 수 있어요' using errcode = '42501';
  end if;
  if public._strategy_staff(v_uid) then
    raise exception '코치님은 회원님 의견에 답을 남겨 주세요' using errcode = '42501';
  end if;
  if not public._card_item_ok(v_item) then raise exception '없는 카드예요' using errcode = '22023'; end if;
  if char_length(v_body) < 1 then raise exception '의견을 적어 주세요' using errcode = '22023'; end if;
  if char_length(v_body) > 300 then raise exception '의견은 300자까지 써요' using errcode = '22023'; end if;
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원')
    into v_branch, v_who
    from public.profiles p where p.user_id = v_uid;
  if v_branch is null then raise exception '지점이 정해진 회원만 의견을 보낼 수 있어요' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('training_card_opinions:' || v_uid::text));
  if (select count(*) from public.training_card_opinions o where o.user_id = v_uid and o.created_at >= v_since) >= 5 then
    raise exception '의견은 하루 5개까지 보낼 수 있어요' using errcode = '22023';
  end if;
  insert into public.training_card_opinions (user_id, item, body, branch_name, member)
  values (v_uid, v_item, v_body, v_branch, public._is_rankable_member(v_uid))
  returning id into v_id;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  select s.user_id,
         '💡 ' || v_who || '님이 카드 의견을 보냈어요',
         '‘' || public._card_item_name(v_item) || '’ · ' || left(regexp_replace(v_body, '\s+', ' ', 'g'), 60),
         '/office?tab=strategy&s=video&opinion=' || v_id,
         case when v_quiet then now() end
    from (select distinct b.user_id from public._strategy_branch_staff(v_branch) b) s
   where s.user_id <> v_uid;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'id', v_id, 'notified', v_n);
end $$;
revoke all on function public.training_card_opinion_add(text, text) from public, anon;
grant execute on function public.training_card_opinion_add(text, text) to authenticated;

-- ── 코치님 답 → 회원님 알림 (처음 답할 때만 · 고치면 알림 없음) ──
create or replace function public.training_card_opinion_reply(p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_quiet boolean := extract(hour from (now() at time zone 'Asia/Seoul')) not between 7 and 21;
  v_by jsonb;
  v_first boolean;
  o public.training_card_opinions%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if char_length(v_body) < 1 then raise exception '답을 적어 주세요' using errcode = '22023'; end if;
  if char_length(v_body) > 300 then raise exception '답은 300자까지 써요' using errcode = '22023'; end if;
  select * into o from public.training_card_opinions where id = p_id and removed_at is null for update;
  if not found then raise exception '그 의견을 찾지 못했어요' using errcode = 'P0002'; end if;
  if not public._card_opinion_viewer(v_uid, o.branch_name) then
    raise exception '이 의견에는 답을 남길 수 없어요' using errcode = '42501';
  end if;
  if o.reply is not null and o.reply_by is distinct from v_uid and not public._strategy_hq(v_uid) then
    raise exception '다른 코치님이 먼저 답했어요' using errcode = '22023';
  end if;
  v_first := o.reply is null;
  update public.training_card_opinions set reply = v_body, reply_by = v_uid, reply_at = now() where id = o.id;
  if v_first then
    v_by := public._strategy_display(v_uid);
    insert into public.notifications (user_id, title, body, link, pushed_at)
    values (o.user_id,
            '💬 코치님이 의견에 답했어요 · ' || coalesce(v_by->>'name', '코치') || ' ' || coalesce(v_by->>'title', '코치'),
            '‘' || public._card_item_name(o.item) || '’ · ' || left(regexp_replace(v_body, '\s+', ' ', 'g'), 60),
            case when o.item like 'c:%' then '/missions?learn=1&card=' || substr(o.item, 3) else '/missions?learn=1' end,
            case when v_quiet then now() end);
  end if;
  return jsonb_build_object('ok', true, 'first', v_first);
end $$;
revoke all on function public.training_card_opinion_reply(uuid, text) from public, anon;
grant execute on function public.training_card_opinion_reply(uuid, text) to authenticated;

-- ── 회원님 의견 목록 (코치진 — 그 지점 · 대표님은 고른 지점) — 지난 60일 · 답 기다리는 것 먼저 ──
create or replace function public.training_card_opinions(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._strategy_staff(v_uid) then raise exception '코치진만 볼 수 있어요' using errcode = '42501'; end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  return jsonb_build_object(
    'branch', v_branch,
    'waiting', (select count(*) from public.training_card_opinions o
                 where o.removed_at is null and o.reply is null and o.branch_name = v_branch
                   and o.created_at > now() - interval '60 days'),
    'opinions', coalesce((
      select jsonb_agg(public._card_opinion_json(o, true) order by (o.reply is null) desc, o.created_at desc)
        from (select * from public.training_card_opinions o2
               where o2.removed_at is null and o2.branch_name = v_branch
                 and o2.created_at > now() - interval '60 days'
               order by (o2.reply is null) desc, o2.created_at desc
               limit 60) o), '[]'::jsonb));
end $$;
revoke all on function public.training_card_opinions(text) from public, anon;
grant execute on function public.training_card_opinions(text) to authenticated;

-- ── 답 읽음 (회원님 — 카드 시트에서 답을 보면) ──
create or replace function public.training_card_opinion_seen(p_item text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer := 0;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.training_card_opinions set reply_seen_at = now()
   where user_id = v_uid and item = lower(btrim(coalesce(p_item, ''))) and removed_at is null
     and reply is not null and reply_seen_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.training_card_opinion_seen(text) from public, anon;
grant execute on function public.training_card_opinion_seen(text) to authenticated;

-- ── 의견 지우기 — 쓴 분 · 대표님 (줄은 남기고 글 · 답 비움) ──
create or replace function public.training_card_opinion_remove(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.training_card_opinions o
     set removed_at = now(), body = '', reply = null, reply_by = null, reply_at = null
   where o.id = p_id and o.removed_at is null
     and (o.user_id = v_uid or public._strategy_hq(v_uid));
  return found;
end $$;
revoke all on function public.training_card_opinion_remove(uuid) from public, anon;
grant execute on function public.training_card_opinion_remove(uuid) to authenticated;

-- ── 찾았는데 없는 동작 · 영상 찍어 주세요 ──
--   p_kind 'miss' = 찾기 결과 0(p_query) · 'film' = 영상 찍어 주세요(p_item = 영상 없는 카드, 또는 p_query = 없던 검색어)
--   검색어 열쇠 = 'q:' + 소문자 · 띄어쓰기 · 가운뎃점 · 줄표 · 괄호를 뺀 글(화면 찾기와 같은 셈) · 40자
create or replace function public.training_card_ask(p_kind text, p_item text default null, p_query text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_item text := nullif(lower(btrim(coalesce(p_item, ''))), '');
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 40);
  v_norm text;
  v_key text;
  v_today timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  if not public._is_active_member(v_uid) then return false; end if;
  if v_kind not in ('miss', 'film') then return false; end if;
  if v_item is not null then
    if v_kind <> 'film' or not public._card_item_ok(v_item) then return false; end if;
    v_key := v_item;
    v_query := null;
  else
    v_norm := left(lower(regexp_replace(v_query, '[[:space:]·_/()-]+', '', 'g')), 40);
    if char_length(v_norm) < 2 then return false; end if;
    v_key := 'q:' || v_norm;
  end if;
  -- 찾기 기록은 사람마다 하루 50개까지
  if v_kind = 'miss' and (select count(*) from public.training_card_asks a
                           where a.user_id = v_uid and a.kind = 'miss' and a.last_at >= v_today) >= 50 then
    return false;
  end if;
  insert into public.training_card_asks as a (user_id, kind, key, query, member, branch_name)
  values (v_uid, v_kind, v_key, nullif(v_query, ''), public._is_rankable_member(v_uid),
          (select p.branch_name from public.profiles p where p.user_id = v_uid))
  on conflict (user_id, kind, key) do update
    set n = least(a.n + 1, 1000), last_at = now(), query = coalesce(excluded.query, a.query);
  return true;
end $$;
revoke all on function public.training_card_ask(text, text, text) from public, anon;
grant execute on function public.training_card_ask(text, text, text) to authenticated;
