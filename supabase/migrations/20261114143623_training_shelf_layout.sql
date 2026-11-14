-- 🎬 영상으로 배우기 — 대표님 정리 편집 · 이용 기록 · 화이트 기술 카드 4장 (1단계)
--   2026-11-14 대표님 「추천대로진행하자」 — 보고서 「영상으로 배우기 — 대표님 정리 편집 · 내 수업 · 반응 데이터」
--   https://claude.ai/artifact/F9QW5nn9N51k5wqZmGKVdE 의 결정 10가지 추천안
--
--   ① 정리표 training_shelf_layouts — 전 지점 같은 정리 한 벌(scope 'default' · 결정 1번).
--      글(JSON)은 화면 src/lib/shelfLayout.ts 가 읽고 다듬는다 — 칸 순서 · 칸 이름 · 칸마다 카드 순서 ·
--      회원에게 숨김(결정 2번 — 코치진 화면에는 흐리게) · 맨 앞 고정 · 합치기 · 묶음(폴더) · 위 리그 접기(결정 3번).
--      정리표에 없는 새 카드는 분류대로 그 칸 맨 뒤 — 표가 비어 있으면(처음) 예전 화면 그대로다.
--      고치기 = 대표님 · 운영진(super_admin · admin — 훈련 라이브러리 고치기와 같은 사람), 읽기 = 로그인한 사람 모두.
--      두 분이 같이 고치면 뒤에 저장한 분에게 'conflict'(먼저 고친 정리가 있어요 — 새로 불러올게요).
--   ② 정리 기록 training_shelf_layout_history — 저장할 때마다 한 줄, 60칸을 돌려 쓴다(지우지 않고 덮어씀) →
--      편집 화면 「정리 기록」에서 지난 정리로 한 번에 되돌리기(되돌리기도 새 판으로 남는다).
--   ③ 이용 기록 training_card_events — 카드 시트를 열고(open) · 영상이 돌고(play) · 끝까지 돌고(complete) ·
--      다시 돈(replay) 것, 「영상으로 배우기」를 본 날(shelf) · 칸 칩(s:) · 묶음(f:)을 연 것.
--      사람 · 항목 · 종류 · 날(한국 시간)마다 한 줄(같은 날 다시는 n 만 올림 — '본 사람'은 하루 한 번으로 센다).
--      회원 여부(member)는 처음 남길 때 _is_rankable_member 로 — 대표님 요약은 회원 줄만 센다(코치진 · 운영진 · 체험 계정 빼고).
--      보관 1년(결정 8번) — 1년 지난 줄을 지우는 예약은 4단계(대표님 데이터 화면 · 월요일 요약)에서 만든다(2027-11-14 전).
--      대표님 화면은 합계만(training_card_brief) — 누가 무엇을 봤는지는 내보내지 않는다.
--   ④ 화이트 기술 카드 4장(결정 9번) — 기술 칸(콤비네이션 · 카운터)에 화이트(레벨 1~10) 카드가 0장이었다.
--      화이트 커리큘럼(src/data/allLevelsData.ts 레벨 4 · 6 · 8 · 9)의 연결 동작 — '카운터' = 153 말로 뒷손 직선.
--      영상은 다음 촬영 때(지금은 글만). 고정 id 1530c4d0-000n-…-000000001114 · 같은 id 나 이름이 있으면 안 넣는다.
--      화면 예시 카드(src/lib/trainingCardsSample.ts NEW_CARDS_1114)와 같은 글.
--
--   새 표 3 · 새 함수 7(안쪽 1) · 기존 표 · 함수는 그대로(카드 4장 넣기만).

-- ── ① 정리표 ───────────────────────────────────────────────
create table if not exists public.training_shelf_layouts (
  scope text primary key check (scope = 'default'),
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object'),
  version integer not null default 0 check (version >= 0),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.training_shelf_layouts enable row level security;
revoke all on public.training_shelf_layouts from public, anon, authenticated;

-- ── ② 정리 기록 (60칸 돌려 쓰기) ─────────────────────────────
create table if not exists public.training_shelf_layout_history (
  scope text not null default 'default' check (scope = 'default'),
  slot smallint not null check (slot between 0 and 59),
  version integer not null check (version >= 1),
  layout jsonb not null check (jsonb_typeof(layout) = 'object'),
  note text not null default '' check (char_length(note) <= 80),
  saved_by uuid,
  saved_at timestamptz not null default now(),
  primary key (scope, slot)
);
alter table public.training_shelf_layout_history enable row level security;
revoke all on public.training_shelf_layout_history from public, anon, authenticated;

-- ── ③ 이용 기록 ─────────────────────────────────────────────
create table if not exists public.training_card_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null check (item ~ '^(shelf|s:[a-z]{2,12}|f:[a-z0-9_-]{1,24}|[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  kind text not null check (kind in ('shelf', 'open', 'play', 'complete', 'replay')),
  day date not null,
  n integer not null default 1 check (n between 1 and 1000),
  member boolean not null default false,
  branch_name text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, item, kind, day)
);
create index if not exists training_card_events_day_idx on public.training_card_events (day);
create index if not exists training_card_events_item_day_idx on public.training_card_events (item, day);
alter table public.training_card_events enable row level security;
revoke all on public.training_card_events from public, anon, authenticated;

-- ── 누가 고치나 (안쪽) ─────────────────────────────────────
create or replace function public._training_shelf_can_edit(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null
     and (public.has_role(p_uid, 'super_admin'::public.app_role) or public.has_role(p_uid, 'admin'::public.app_role));
$$;
revoke all on function public._training_shelf_can_edit(uuid) from public, anon, authenticated;

-- ── 정리 읽기 (로그인한 사람 모두) ──────────────────────────
create or replace function public.training_shelf_layout()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.training_shelf_layouts%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  select * into r from public.training_shelf_layouts where scope = 'default';
  return jsonb_build_object(
    'layout', coalesce(r.layout, '{}'::jsonb),
    'version', coalesce(r.version, 0),
    'updated_at', r.updated_at,
    'can_edit', public._training_shelf_can_edit(v_uid));
end $$;
revoke all on function public.training_shelf_layout() from public, anon;
grant execute on function public.training_shelf_layout() to authenticated;

-- ── 정리 저장 (대표님 · 운영진) — 판 번호가 다르면 conflict ──
create or replace function public.training_shelf_layout_save(p_layout jsonb, p_base_version integer, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cur integer;
  v_new integer;
  v_now timestamptz := now();
  v_note text := left(btrim(coalesce(p_note, '')), 80);
begin
  if not public._training_shelf_can_edit(v_uid) then
    raise exception '정리는 대표님 · 운영진만 고칠 수 있어요' using errcode = '42501';
  end if;
  if p_layout is null or jsonb_typeof(p_layout) <> 'object' then
    raise exception '정리 모양이 맞지 않아요' using errcode = '22023';
  end if;
  if octet_length(p_layout::text) > 65536 then
    raise exception '정리가 너무 커요' using errcode = '22023';
  end if;
  insert into public.training_shelf_layouts (scope) values ('default') on conflict (scope) do nothing;
  select version into v_cur from public.training_shelf_layouts where scope = 'default' for update;
  if p_base_version is distinct from v_cur then
    return jsonb_build_object('ok', false, 'code', 'conflict', 'version', v_cur);
  end if;
  v_new := v_cur + 1;
  update public.training_shelf_layouts
     set layout = p_layout, version = v_new, updated_by = v_uid, updated_at = v_now
   where scope = 'default';
  insert into public.training_shelf_layout_history as h (scope, slot, version, layout, note, saved_by, saved_at)
  values ('default', (v_new % 60)::smallint, v_new, p_layout, v_note, v_uid, v_now)
  on conflict (scope, slot) do update
    set version = excluded.version, layout = excluded.layout, note = excluded.note,
        saved_by = excluded.saved_by, saved_at = excluded.saved_at;
  return jsonb_build_object('ok', true, 'version', v_new, 'updated_at', v_now);
end $$;
revoke all on function public.training_shelf_layout_save(jsonb, integer, text) from public, anon;
grant execute on function public.training_shelf_layout_save(jsonb, integer, text) to authenticated;

-- ── 정리 기록 (대표님 · 운영진) — 최근 것부터 ────────────────
create or replace function public.training_shelf_layout_history(p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._training_shelf_can_edit(v_uid) then
    raise exception '정리 기록은 대표님 · 운영진만 볼 수 있어요' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'version', h.version, 'note', h.note, 'saved_at', h.saved_at,
             'saved_by_name', coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), ''),
             'layout', h.layout) order by h.version desc)
      from (select * from public.training_shelf_layout_history
             where scope = 'default'
             order by version desc
             limit greatest(1, least(coalesce(p_limit, 20), 60))) h
      left join public.profiles p on p.user_id = h.saved_by
  ), '[]'::jsonb);
end $$;
revoke all on function public.training_shelf_layout_history(integer) from public, anon;
grant execute on function public.training_shelf_layout_history(integer) to authenticated;

-- ── 지난 정리로 되돌리기 (새 판으로 저장) ────────────────────
create or replace function public.training_shelf_layout_restore(p_version integer, p_base_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_layout jsonb;
begin
  if not public._training_shelf_can_edit(v_uid) then
    raise exception '정리는 대표님 · 운영진만 고칠 수 있어요' using errcode = '42501';
  end if;
  select layout into v_layout from public.training_shelf_layout_history
   where scope = 'default' and version = p_version;
  if v_layout is null then raise exception '그 정리 기록이 없어요' using errcode = 'P0002'; end if;
  return public.training_shelf_layout_save(v_layout, p_base_version, '되돌림 · ' || p_version || '번 정리');
end $$;
revoke all on function public.training_shelf_layout_restore(integer, integer) from public, anon;
grant execute on function public.training_shelf_layout_restore(integer, integer) to authenticated;

-- ── 이용 기록 남기기 (로그인한 사람 · 화면이 부른다) ──────────
create or replace function public.training_card_event(p_item text, p_kind text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_item text := btrim(coalesce(p_item, ''));
  v_kind text := btrim(coalesce(p_kind, ''));
begin
  if v_uid is null then return false; end if;
  if v_kind not in ('shelf', 'open', 'play', 'complete', 'replay') then return false; end if;
  if v_item !~ '^(shelf|s:[a-z]{2,12}|f:[a-z0-9_-]{1,24}|[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then
    return false;
  end if;
  -- 종류와 항목이 맞아야 한다: 영상으로 배우기 = shelf · 칸 칩 · 묶음 = open · 카드 · 레벨 미션 = open/play/complete/replay
  if (v_item = 'shelf') <> (v_kind = 'shelf') then return false; end if;
  if v_item ~ '^[sf]:' and v_kind <> 'open' then return false; end if;
  if v_item like 'c:%' and not exists (select 1 from public.training_exercises t where t.id = substr(v_item, 3)::uuid) then
    return false;
  end if;
  if v_item like 'm:%' and not exists (select 1 from public.missions m where m.id = substr(v_item, 3)::uuid) then
    return false;
  end if;
  update public.training_card_events
     set n = least(n + 1, 1000), last_at = now()
   where user_id = v_uid and item = v_item and kind = v_kind and day = v_day;
  if not found then
    insert into public.training_card_events as e (user_id, item, kind, day, member, branch_name)
    values (v_uid, v_item, v_kind, v_day, public._is_rankable_member(v_uid),
            (select p.branch_name from public.profiles p where p.user_id = v_uid))
    on conflict (user_id, item, kind, day) do update set n = least(e.n + 1, 1000), last_at = now();
  end if;
  return true;
end $$;
revoke all on function public.training_card_event(text, text) from public, anon;
grant execute on function public.training_card_event(text, text) to authenticated;

-- ── 대표님 요약 — 지난 n일 회원 숫자만 (이름 없음) ─────────────
create or replace function public.training_card_brief(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 7), 90));
  v_since date := (now() at time zone 'Asia/Seoul')::date - (v_days - 1);
begin
  if not public._training_shelf_can_edit(v_uid) then
    raise exception '이용 기록은 대표님 · 운영진만 볼 수 있어요' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', v_days,
    'since', v_since,
    -- 영상으로 배우기를 본 회원 · 카드를 연 회원 (사람 수)
    'shelf_members', (select count(distinct user_id) from public.training_card_events
                       where member and day >= v_since and kind = 'shelf'),
    'members', (select count(distinct user_id) from public.training_card_events
                 where member and day >= v_since and kind in ('open', 'play') and item ~ '^[cm]:'),
    -- 항목마다: 연 회원 · 끝까지 본 회원 · 다시 본 회원(사람 수) · 연 횟수
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item', item, 'users', users, 'opens', opens, 'completes', completes, 'replays', replays)
               order by users desc, opens desc, item)
        from (select item,
                     count(distinct user_id) filter (where kind in ('open', 'play')) as users,
                     coalesce(sum(n) filter (where kind = 'open'), 0) as opens,
                     count(distinct user_id) filter (where kind = 'complete') as completes,
                     count(distinct user_id) filter (where kind = 'replay') as replays
                from public.training_card_events
               where member and day >= v_since and item <> 'shelf'
               group by item) x
       where users > 0 or completes > 0
    ), '[]'::jsonb));
end $$;
revoke all on function public.training_card_brief(integer) from public, anon;
grant execute on function public.training_card_brief(integer) to authenticated;

-- ── ④ 화이트 기술 카드 4장 ──────────────────────────────────
insert into public.training_exercises
  (id, category, name, summary, description, benefits, target, difficulty, cues, mistakes, level_min, sort_order, minutes)
select v.id, v.category, v.name, v.summary, v.description, '', v.target, '초급', v.cues, v.mistakes, v.level_min, v.sort_order, v.minutes
  from (values
    ('1530c4d0-0005-4a00-8000-000000001114'::uuid, '콤비네이션', '인앤아웃 잽 → 카운터',
     '들어가며 잽, 바로 뒷손 카운터 — 치고 나면 빠져나와요',
     '거리 밖에서 앞발과 함께 잽으로 들어가고, 이어서 뒷손을 직선으로 뻗어 카운터를 쳐요. 두 손이 모두 턱으로 돌아오면 뒷발부터 빠져 처음 거리로 돌아가요. 하나 · 둘 · 가드 박자로 천천히 정확하게 시작해요.',
     '거리 · 콤비',
     '["들어가서 하나 · 둘 · 가드", "잽은 앞발과 함께, 카운터는 뒤꿈치를 돌리며", "치고 나면 서 있지 말고 뒤로 빠져요"]'::jsonb,
     '["잽만 치고 카운터가 안 나가요 → 하나 · 둘을 한 묶음으로 소리 내어 세요", "치고 그 자리에 멈춰요 → 가드로 돌아오는 순간 뒷발부터 빠져요"]'::jsonb,
     4, 90, 5::smallint),
    ('1530c4d0-0006-4a00-8000-000000001114'::uuid, '콤비네이션', '원투 → 리드 피벗',
     '원투를 치고 앞발을 축으로 30~45도 작게 돌아 나와요',
     '잽 · 카운터를 치고 가드로 돌아오는 순간, 앞발은 그 자리에서 축이 되고 뒷발이 반원을 그리며 30~45도만 돌아요. 돌고 나면 새 각도에서 다시 스탠스와 가드를 만들어요. 크게 돌지 말고 작게, 천천히 시작해요.',
     '각도 · 콤비',
     '["원투 · 가드 · 피벗 순서예요", "앞발은 축, 뒷발로 반원을 그려 30~45도만", "돌고 나서도 가드는 턱 옆에"]'::jsonb,
     '["90도 넘게 크게 돌아요 → 30~45도만, 작게 돌아요", "허리만 비틀고 발은 그대로예요 → 뒷발이 반원을 그리며 몸 전체가 같이 돌아요"]'::jsonb,
     6, 92, 5::smallint),
    ('1530c4d0-0007-4a00-8000-000000001114'::uuid, '콤비네이션', '원투쓱빡',
     '원투 다음 몸통을 빠르게 「쓱」, 올라오며 얼굴을 「빡」',
     '잽 · 카운터를 친 뒤 무릎을 굽혀 낮아지며 몸통을 빠르게 한 번(쓱), 다시 올라오면서 얼굴을 정확하게 한 번(빡) 쳐요. 아래 · 위로 바뀌는 리듬이 핵심이에요. 네 번을 다 치면 바로 가드로 돌아와요.',
     '리듬 · 콤비',
     '["원 · 투 · 쓱 · 빡, 네 박자로 세요", "쓱은 몸통으로 빠르게 — 무릎으로 낮아져요", "빡은 올라오면서 정확하게, 치고 바로 가드"]'::jsonb,
     '["허리만 숙여 몸통을 쳐요 → 무릎을 굽혀 낮아진 채로 쳐요", "쓱에서 빡으로 바뀌는 게 늦어요 → 쓱 · 빡을 한 묶음으로 천천히 반복해요"]'::jsonb,
     8, 94, 5::smallint),
    ('1530c4d0-0008-4a00-8000-000000001114'::uuid, '카운터', '더킹 → 카운터',
     '무릎을 굽혀 머리를 낮췄다가, 올라오며 뒷손 카운터',
     '상대 주먹이 머리 쪽으로 온다고 생각하고 무릎을 굽혀 머리를 아래로 낮춰요. 다시 올라오는 힘으로 뒷손을 직선으로 뻗어 카운터를 쳐요. 내려갈 때도 올라올 때도 눈은 앞을 봐요.',
     '방어 · 카운터',
     '["무릎으로 내려가요 — 허리만 꺾지 않아요", "눈은 늘 앞을 봐요", "올라오면서 바로 카운터, 치고 가드"]'::jsonb,
     '["허리만 숙여 머리가 앞으로 쏠려요 → 무릎을 굽혀 곧게 내려가요", "내려가서 바닥을 봐요 → 눈은 앞, 상대를 보며 내려가요"]'::jsonb,
     9, 96, 5::smallint)
  ) as v(id, category, name, summary, description, target, cues, mistakes, level_min, sort_order, minutes)
 where not exists (select 1 from public.training_exercises t where t.id = v.id or t.name = v.name);
