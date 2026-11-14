-- 🎬 영상으로 배우기 2단계 — 내 수업 · 코치 한마디 · 담기 기록
--   2026-11-14 대표님 「다음 2단계진행」 — 보고서 「영상으로 배우기 — 대표님 정리 편집 · 내 수업 · 반응 데이터」
--   https://claude.ai/artifact/F9QW5nn9N51k5wqZmGKVdE 의 「내 수업」 칸 · 결정 6번(나만 + 코치님께 보여드리기) · 7번(옛 루틴 만들기 접기)
--
--   ① 내 수업 training_my_classes — 회원님 · 코치님이 153 콘텐츠 카드(c:<카드>) · 레벨 미션 영상(m:<미션>)을 담아
--      이름 · 순서 · 분(또는 라운드) · 한 줄 메모로 짠 나만의 수업. 한 사람 20개 · 한 수업 12장.
--      항목 = {"k": "c:<id>" | "m:<id>", "u": "m"(분) | "r"(라운드 — 3분 운동 + 30초 쉬기), "n": 분 1~30 · 라운드 1~12, "note": 60자}.
--      지우기 = removed_at + 내용 비움(줄은 남긴다 — 지우는 SQL 을 쓰지 않는다). 계정을 지우면 함께.
--      재생 기록(plays · minutes_total · last_played_at)은 본인에게만 「n번 했어요」 — 코치님 화면에는 안 보낸다.
--   ② 코치님께 보여드리기(shared) — 켜면 같은 지점 코치진(_strategy_staff + 같은 지점) · 대표님(_strategy_hq)이 보고 한마디를 남긴다.
--      처음 켤 때 그 지점 코치진(_strategy_branch_staff)에게 알림 한 통(같은 수업은 20시간에 한 번).
--      코치님 · 대표님 수업은 보여드리기가 없다(나만 보기 — 서버가 끈다).
--   ③ 코치 한마디 training_class_notes — 남기면 회원님께 알림 '💬 내 수업에 한마디가 왔어요 · 이름 직함'.
--      코치님 한 분 하루 30개 · 지우기 = 쓴 분 · 대표님(removed_at + 글 비움).
--   ④ 담기 기록 training_card_saves — 사람 · 카드마다 한 줄(처음 담은 때 · 마지막 · 몇 번) → 4단계 「많이 담은 동작」의 바탕.
--      회원 여부(member)는 처음 남길 때 _is_rankable_member. 보관 1년(결정 8번 — 1단계 이용 기록과 같이 4단계에서 지우는 예약).
--   알림은 밤(22~07시 한국)이면 알림함에만(휴대폰 알림 없이).
--
--   새 표 3 · 새 함수 9(안쪽 6) · 기존 표 · 함수는 그대로.

-- ── ① 내 수업 ─────────────────────────────────────────────
create table if not exists public.training_my_classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 24),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 12),
  shared boolean not null default false,
  shared_at timestamptz,
  share_notified_at timestamptz,
  plays integer not null default 0 check (plays between 0 and 100000),
  minutes_total integer not null default 0 check (minutes_total between 0 and 10000000),
  last_played_at timestamptz,
  notes_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz
);
create index if not exists training_my_classes_user_idx on public.training_my_classes (user_id) where removed_at is null;
create index if not exists training_my_classes_shared_idx on public.training_my_classes (shared_at desc) where shared and removed_at is null;
alter table public.training_my_classes enable row level security;
revoke all on public.training_my_classes from public, anon, authenticated;

-- ── ③ 코치 한마디 ──────────────────────────────────────────
create table if not exists public.training_class_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.training_my_classes(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null default '' check (char_length(body) <= 300 and (removed_at is not null or char_length(btrim(body)) >= 1)),
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index if not exists training_class_notes_class_idx on public.training_class_notes (class_id, created_at);
create index if not exists training_class_notes_author_idx on public.training_class_notes (author_id, created_at desc);
alter table public.training_class_notes enable row level security;
revoke all on public.training_class_notes from public, anon, authenticated;

-- ── ④ 담기 기록 ────────────────────────────────────────────
create table if not exists public.training_card_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null check (item ~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  n integer not null default 1 check (n between 1 and 1000),
  member boolean not null default false,
  branch_name text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, item)
);
create index if not exists training_card_saves_item_idx on public.training_card_saves (item);
create index if not exists training_card_saves_last_idx on public.training_card_saves (last_at);
alter table public.training_card_saves enable row level security;
revoke all on public.training_card_saves from public, anon, authenticated;

-- ── 항목 다듬기 (안쪽) — 모양이 틀리면 막는다. 화면 src/lib/myClass.ts validateItems 와 같은 말 ──
create or replace function public._my_class_items(p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_out jsonb := '[]'::jsonb;
  e jsonb;
  v_k text;
  v_u text;
  v_n integer;
  v_note text;
begin
  if p_items is null then return '[]'::jsonb; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception '수업 모양이 맞지 않아요' using errcode = '22023'; end if;
  if jsonb_array_length(p_items) > 12 then raise exception '한 수업에 12장까지 담을 수 있어요' using errcode = '22023'; end if;
  for e in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e) <> 'object' then raise exception '수업 모양이 맞지 않아요' using errcode = '22023'; end if;
    v_k := lower(btrim(coalesce(e->>'k', '')));
    if v_k !~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception '수업에 넣을 수 없는 카드예요' using errcode = '22023';
    end if;
    if v_k like 'c:%' and not exists (select 1 from public.training_exercises t where t.id = substr(v_k, 3)::uuid) then
      raise exception '없는 카드예요' using errcode = '22023';
    end if;
    if v_k like 'm:%' and not exists (select 1 from public.missions m where m.id = substr(v_k, 3)::uuid) then
      raise exception '없는 영상이에요' using errcode = '22023';
    end if;
    v_u := coalesce(nullif(btrim(coalesce(e->>'u', '')), ''), 'm');
    if v_u not in ('m', 'r') then raise exception '분 또는 라운드로 정해요' using errcode = '22023'; end if;
    if coalesce(e->>'n', '') !~ '^[0-9]{1,3}$' then raise exception '시간은 1~30분 · 1~12라운드로 정해요' using errcode = '22023'; end if;
    v_n := (e->>'n')::integer;
    if (v_u = 'm' and (v_n < 1 or v_n > 30)) or (v_u = 'r' and (v_n < 1 or v_n > 12)) then
      raise exception '시간은 1~30분 · 1~12라운드로 정해요' using errcode = '22023';
    end if;
    v_note := btrim(regexp_replace(coalesce(e->>'note', ''), '\s+', ' ', 'g'));
    if char_length(v_note) > 60 then raise exception '메모는 60자까지 써요' using errcode = '22023'; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('k', v_k, 'u', v_u, 'n', v_n, 'note', v_note));
  end loop;
  return v_out;
end $$;
revoke all on function public._my_class_items(jsonb) from public, anon, authenticated;

-- ── 합계 분 (안쪽) — 라운드 = 3분 운동 + 사이 30초 쉬기 (화면 classSeconds 와 같은 셈) ──
create or replace function public._my_class_minutes(p_items jsonb)
returns integer language sql immutable security definer set search_path = public as $$
  select coalesce(round(sum(
           case when x->>'u' = 'r' then (x->>'n')::numeric * 3 + ((x->>'n')::numeric - 1) * 0.5
                else (x->>'n')::numeric end)), 0)::integer
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x;
$$;
revoke all on function public._my_class_minutes(jsonb) from public, anon, authenticated;

-- ── 보여 준 수업을 볼 수 있나 (안쪽) — 대표님 · 같은 지점 코치진 (본인 수업은 빼고) ──
create or replace function public._class_viewer(p_uid uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and p_owner is not null and p_uid <> p_owner and (
    public._strategy_hq(p_uid)
    or (public._strategy_staff(p_uid) and exists (
          select 1 from public.profiles o, public.profiles s
           where o.user_id = p_owner and s.user_id = p_uid
             and o.branch_name is not null and o.branch_name = s.branch_name)));
$$;
revoke all on function public._class_viewer(uuid, uuid) from public, anon, authenticated;

-- ── 수업 한 줄 → 화면 (안쪽) — 본인: 재생 기록 · 새 한마디 수 / 코치진: 회원 이름 · 사진(재생 기록 없음) ──
create or replace function public._my_class_json(c public.training_my_classes, p_owner boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'id', c.id, 'name', c.name, 'items', c.items,
           'shared', c.shared, 'shared_at', c.shared_at,
           'updated_at', c.updated_at, 'created_at', c.created_at,
           'notes', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', n.id, 'body', n.body, 'at', n.created_at,
                      'by', coalesce(public._strategy_display(n.author_id), jsonb_build_object('name', '코치', 'title', '코치')),
                      'mine', n.author_id is not distinct from auth.uid()) order by n.created_at)
               from public.training_class_notes n
              where n.class_id = c.id and n.removed_at is null), '[]'::jsonb))
      || case when p_owner then jsonb_build_object(
                'plays', c.plays, 'minutes_total', c.minutes_total, 'last_played_at', c.last_played_at,
                'new_notes', (select count(*) from public.training_class_notes n
                               where n.class_id = c.id and n.removed_at is null
                                 and (c.notes_seen_at is null or n.created_at > c.notes_seen_at)))
              else jsonb_build_object(
                'owner', jsonb_build_object(
                  'user_id', c.user_id,
                  'name', coalesce((select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''))
                                      from public.profiles p where p.user_id = c.user_id), '회원'),
                  'avatar_url', (select p.avatar_url from public.profiles p where p.user_id = c.user_id)))
         end;
$$;
revoke all on function public._my_class_json(public.training_my_classes, boolean) from public, anon, authenticated;

-- ── 담기 기록 (안쪽) — 같은 카드를 또 담으면 n 만 올린다 ──
create or replace function public._card_saves_log(p_uid uuid, p_keys text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_member boolean; v_branch text;
begin
  if p_uid is null or p_keys is null or cardinality(p_keys) = 0 then return; end if;
  v_member := public._is_rankable_member(p_uid);
  select p.branch_name into v_branch from public.profiles p where p.user_id = p_uid;
  insert into public.training_card_saves as s (user_id, item, member, branch_name)
  select p_uid, k, v_member, v_branch
    from (select distinct k from unnest(p_keys) k) x
   where k ~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  on conflict (user_id, item) do update set n = least(s.n + 1, 1000), last_at = now();
end $$;
revoke all on function public._card_saves_log(uuid, text[]) from public, anon, authenticated;

-- ── 보여 줬어요 알림 (안쪽) — 그 지점 코치진에게 한 통씩 ──
create or replace function public._my_class_share_notify(p_class uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  c public.training_my_classes%rowtype;
  v_branch text;
  v_who text;
  v_n integer := 0;
  v_quiet boolean := extract(hour from (now() at time zone 'Asia/Seoul')) not between 7 and 21;
begin
  select * into c from public.training_my_classes where id = p_class and removed_at is null;
  if not found then return 0; end if;
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원')
    into v_branch, v_who
    from public.profiles p where p.user_id = c.user_id;
  if v_branch is null then return 0; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  select s.user_id,
         '📋 ' || v_who || '님이 내 수업을 보여 줬어요',
         '‘' || c.name || '’ · 카드 ' || jsonb_array_length(c.items) || '장 · ' || public._my_class_minutes(c.items) || '분 — 보고 한마디를 남겨 주세요',
         '/office?tab=strategy&s=video&shelf=mine&class=' || c.id,
         case when v_quiet then now() end
    from (select distinct b.user_id from public._strategy_branch_staff(v_branch) b) s
   where s.user_id <> c.user_id;
  get diagnostics v_n = row_count;
  update public.training_my_classes set share_notified_at = now() where id = c.id;
  return v_n;
end $$;
revoke all on function public._my_class_share_notify(uuid) from public, anon, authenticated;

-- ── 내 수업 읽기 (본인) — 최근에 고치거나 한 것 먼저 ──
create or replace function public.my_classes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'staff', public._strategy_staff(v_uid),
    'limits', jsonb_build_object('classes', 20, 'items', 12),
    'classes', coalesce((
      select jsonb_agg(public._my_class_json(c, true) order by greatest(c.updated_at, c.last_played_at) desc, c.created_at desc)
        from public.training_my_classes c
       where c.user_id = v_uid and c.removed_at is null), '[]'::jsonb));
end $$;
revoke all on function public.my_classes() from public, anon;
grant execute on function public.my_classes() to authenticated;

-- ── 내 수업 저장 (새로 · 고치기) — 이름 · 항목 · 코치님께 보여드리기 ──
create or replace function public.my_class_save(p_id uuid, p_name text, p_items jsonb, p_shared boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 24);
  v_items jsonb;
  v_staff boolean;
  v_share boolean;
  v_prev_shared boolean := false;
  v_old_keys text[] := '{}';
  v_new_keys text[];
  v_created boolean := false;
  v_notified integer := 0;
  r public.training_my_classes%rowtype;
begin
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 내 수업을 만들 수 있어요' using errcode = '42501';
  end if;
  v_staff := public._strategy_staff(v_uid);
  if p_id is null then
    v_items := public._my_class_items(p_items);
    perform pg_advisory_xact_lock(hashtext('training_my_classes:' || v_uid::text));
    if (select count(*) from public.training_my_classes where user_id = v_uid and removed_at is null) >= 20 then
      raise exception '내 수업은 20개까지 만들 수 있어요' using errcode = '22023';
    end if;
    v_share := coalesce(p_shared, false) and not v_staff;
    insert into public.training_my_classes (user_id, name, items, shared, shared_at)
    values (v_uid, coalesce(nullif(v_name, ''), '내 수업'), v_items, v_share, case when v_share then now() end)
    returning * into r;
    v_created := true;
  else
    select * into r from public.training_my_classes
     where id = p_id and user_id = v_uid and removed_at is null
     for update;
    if not found then raise exception '그 수업을 찾지 못했어요' using errcode = 'P0002'; end if;
    v_prev_shared := r.shared;
    select coalesce(array_agg(x->>'k'), '{}') into v_old_keys from jsonb_array_elements(r.items) x;
    v_items := case when p_items is null then r.items else public._my_class_items(p_items) end;
    v_share := case when p_shared is null then r.shared and not v_staff else p_shared and not v_staff end;
    update public.training_my_classes
       set name = coalesce(nullif(v_name, ''), r.name),
           items = v_items,
           shared = v_share,
           shared_at = case when v_share and not r.shared then now() when v_share then r.shared_at end,
           updated_at = now()
     where id = r.id
    returning * into r;
  end if;
  -- 담기 기록 — 새로 들어온 카드만
  select array_agg(distinct x->>'k') into v_new_keys
    from jsonb_array_elements(v_items) x
   where not ((x->>'k') = any (v_old_keys));
  perform public._card_saves_log(v_uid, v_new_keys);
  -- 처음 보여 줄 때 코치진 알림 (같은 수업은 20시간에 한 번)
  if r.shared and not v_prev_shared and (r.share_notified_at is null or r.share_notified_at < now() - interval '20 hours') then
    v_notified := public._my_class_share_notify(r.id);
  end if;
  return jsonb_build_object('ok', true, 'id', r.id, 'created', v_created, 'shared', r.shared, 'notified', v_notified);
end $$;
revoke all on function public.my_class_save(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.my_class_save(uuid, text, jsonb, boolean) to authenticated;

-- ── 담기 — 카드 한 장을 수업에 (수업이 없으면 새로) · 이미 있으면 그대로 ──
create or replace function public.my_class_add(p_id uuid, p_item text, p_min integer default 5, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_k text := lower(btrim(coalesce(p_item, '')));
  v_n integer := greatest(1, least(coalesce(p_min, 5), 30));
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 24);
  v_created boolean := false;
  r public.training_my_classes%rowtype;
begin
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 내 수업을 만들 수 있어요' using errcode = '42501';
  end if;
  if v_k !~ '^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception '수업에 넣을 수 없는 카드예요' using errcode = '22023';
  end if;
  if v_k like 'c:%' and not exists (select 1 from public.training_exercises t where t.id = substr(v_k, 3)::uuid and t.is_active) then
    raise exception '없는 카드예요' using errcode = '22023';
  end if;
  if v_k like 'm:%' and not exists (select 1 from public.missions m where m.id = substr(v_k, 3)::uuid and m.is_active) then
    raise exception '없는 영상이에요' using errcode = '22023';
  end if;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtext('training_my_classes:' || v_uid::text));
    if (select count(*) from public.training_my_classes where user_id = v_uid and removed_at is null) >= 20 then
      raise exception '내 수업은 20개까지 만들 수 있어요' using errcode = '22023';
    end if;
    insert into public.training_my_classes (user_id, name, items)
    values (v_uid, coalesce(nullif(v_name, ''), '내 수업'),
            jsonb_build_array(jsonb_build_object('k', v_k, 'u', 'm', 'n', v_n, 'note', '')))
    returning * into r;
    v_created := true;
  else
    select * into r from public.training_my_classes
     where id = p_id and user_id = v_uid and removed_at is null
     for update;
    if not found then raise exception '그 수업을 찾지 못했어요' using errcode = 'P0002'; end if;
    if exists (select 1 from jsonb_array_elements(r.items) x where x->>'k' = v_k) then
      return jsonb_build_object('ok', true, 'id', r.id, 'name', r.name, 'count', jsonb_array_length(r.items),
                                'added', false, 'created', false);
    end if;
    if jsonb_array_length(r.items) >= 12 then
      raise exception '한 수업에 12장까지 담을 수 있어요' using errcode = '22023';
    end if;
    update public.training_my_classes
       set items = items || jsonb_build_array(jsonb_build_object('k', v_k, 'u', 'm', 'n', v_n, 'note', '')),
           updated_at = now()
     where id = r.id
    returning * into r;
  end if;
  perform public._card_saves_log(v_uid, array[v_k]);
  return jsonb_build_object('ok', true, 'id', r.id, 'name', r.name, 'count', jsonb_array_length(r.items),
                            'added', true, 'created', v_created);
end $$;
revoke all on function public.my_class_add(uuid, text, integer, text) from public, anon;
grant execute on function public.my_class_add(uuid, text, integer, text) to authenticated;

-- ── 내 수업 지우기 — 줄은 남기고 내용 · 한마디를 비운다 ──
create or replace function public.my_class_remove(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.training_my_classes
     set removed_at = now(), name = '', items = '[]'::jsonb, shared = false, shared_at = null, updated_at = now()
   where id = p_id and user_id = v_uid and removed_at is null;
  if not found then return false; end if;
  update public.training_class_notes set removed_at = now(), body = ''
   where class_id = p_id and removed_at is null;
  return true;
end $$;
revoke all on function public.my_class_remove(uuid) from public, anon;
grant execute on function public.my_class_remove(uuid) to authenticated;

-- ── 다 했어요 — 재생 횟수 · 분 (본인만 · 1분 안에 두 번 누르면 한 번) ──
create or replace function public.my_class_played(p_id uuid, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m integer := greatest(1, least(coalesce(p_minutes, 1), 360));
  r public.training_my_classes%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  select * into r from public.training_my_classes
   where id = p_id and user_id = v_uid and removed_at is null
   for update;
  if not found then raise exception '그 수업을 찾지 못했어요' using errcode = 'P0002'; end if;
  if r.last_played_at is not null and r.last_played_at > now() - interval '60 seconds' then
    return jsonb_build_object('ok', true, 'plays', r.plays, 'minutes_total', r.minutes_total, 'counted', false);
  end if;
  update public.training_my_classes
     set plays = least(plays + 1, 100000),
         minutes_total = least(minutes_total + v_m, 10000000),
         last_played_at = now()
   where id = r.id
  returning * into r;
  return jsonb_build_object('ok', true, 'plays', r.plays, 'minutes_total', r.minutes_total, 'counted', true);
end $$;
revoke all on function public.my_class_played(uuid, integer) from public, anon;
grant execute on function public.my_class_played(uuid, integer) to authenticated;

-- ── 한마디 읽음 (본인) ──
create or replace function public.my_class_notes_seen(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.training_my_classes set notes_seen_at = now()
   where id = p_id and user_id = v_uid and removed_at is null;
  return found;
end $$;
revoke all on function public.my_class_notes_seen(uuid) from public, anon;
grant execute on function public.my_class_notes_seen(uuid) to authenticated;

-- ── 회원님이 보여 준 수업 (코치진 — 그 지점 · 대표님은 고른 지점) ──
create or replace function public.class_shared_list(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._strategy_staff(v_uid) then raise exception '코치진만 볼 수 있어요' using errcode = '42501'; end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  return jsonb_build_object(
    'branch', v_branch,
    'classes', coalesce((
      select jsonb_agg(public._my_class_json(c, false) order by greatest(c.shared_at, c.updated_at) desc)
        from public.training_my_classes c
       where c.id in (
         select c2.id
           from public.training_my_classes c2
           join public.profiles p on p.user_id = c2.user_id
          where c2.shared and c2.removed_at is null and p.branch_name = v_branch and c2.user_id <> v_uid
          order by greatest(c2.shared_at, c2.updated_at) desc
          limit 60)), '[]'::jsonb));
end $$;
revoke all on function public.class_shared_list(text) from public, anon;
grant execute on function public.class_shared_list(text) to authenticated;

-- ── 코치 한마디 남기기 → 회원님 알림 ──
create or replace function public.class_note_add(p_class uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_since timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
  v_quiet boolean := extract(hour from (now() at time zone 'Asia/Seoul')) not between 7 and 21;
  v_by jsonb;
  v_id uuid;
  c public.training_my_classes%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if char_length(v_body) < 1 then raise exception '한마디를 적어 주세요' using errcode = '22023'; end if;
  if char_length(v_body) > 300 then raise exception '한마디는 300자까지 써요' using errcode = '22023'; end if;
  select * into c from public.training_my_classes where id = p_class and removed_at is null;
  if not found or not c.shared then raise exception '보여 준 수업이 아니에요' using errcode = 'P0002'; end if;
  if not public._class_viewer(v_uid, c.user_id) then
    raise exception '이 수업에는 한마디를 남길 수 없어요' using errcode = '42501';
  end if;
  if (select count(*) from public.training_class_notes n where n.author_id = v_uid and n.created_at >= v_since) >= 30 then
    raise exception '한마디는 하루 30개까지 남길 수 있어요' using errcode = '22023';
  end if;
  insert into public.training_class_notes (class_id, author_id, body) values (c.id, v_uid, v_body) returning id into v_id;
  v_by := public._strategy_display(v_uid);
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (c.user_id,
          '💬 내 수업에 한마디가 왔어요 · ' || coalesce(v_by->>'name', '코치') || ' ' || coalesce(v_by->>'title', '코치'),
          '‘' || c.name || '’ · ' || left(regexp_replace(v_body, '\s+', ' ', 'g'), 60),
          '/missions?learn=1&shelf=mine&class=' || c.id,
          case when v_quiet then now() end);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.class_note_add(uuid, text) from public, anon;
grant execute on function public.class_note_add(uuid, text) to authenticated;

-- ── 한마디 지우기 — 쓴 분 · 대표님 ──
create or replace function public.class_note_remove(p_note uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.training_class_notes n
     set removed_at = now(), body = ''
   where n.id = p_note and n.removed_at is null
     and (n.author_id = v_uid or public._strategy_hq(v_uid));
  return found;
end $$;
revoke all on function public.class_note_remove(uuid) from public, anon;
grant execute on function public.class_note_remove(uuid) to authenticated;
