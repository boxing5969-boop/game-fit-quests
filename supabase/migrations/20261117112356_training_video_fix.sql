-- 🎬 영상으로 배우기 — 영상 고쳐 주세요 (2026-11-17 대표님 「복덩이네앱에 설치한 편집 프로그램을 여기도 설치해서 앱안에서
--   내가 너에게 이영상은 어떤 동작인지 간략하게 설명을 할게 그럼 니가 편집을 다시해줘」)
--   드라이브에서 가져온 동작 영상 15편에 카드와 다른 동작이 많았다(어퍼컷 카드 = 훅 영상 · 슬립 …) → 하나씩 고르는 대신
--   복덩이네 가족 앱의 「이 장면 고쳐 달라기」처럼 카드 시트 안에서 대표님이 말하고, 클로드가 다시 편집해서 올린다.
--
--   ① training_video_fixes — 대표님 · 운영진이 카드 영상을 보다가 「이 장면 고쳐 달라기」:
--      재생 시각 · 실제 동작(칩) · 쓸 구간 · 한 줄 · 「고칠 때까지 회원에게 숨기기」
--      (숨기기 = 카드의 회원용 영상 · 첫 장면 경로를 이 줄로 옮겨 둔다 — 회원은 글 · 설명 듣기만 · 「다시 보이기」로 되돌림)
--   ② training_video_candidates — 클로드가 다시 만든 영상(저장소 member/ 에 먼저 올림 · card-video-intake)
--      → 대표님이 카드 시트에서 보고 「이대로 붙이기」(카드 영상이 바뀐다) · 「다시 고쳐 주세요」
--   클로드 쪽(SQL)은 _training_video_fix_reply · _training_video_candidate_add 로 답 · 새 영상을 넣고 대표님 · 운영진께 알린다.
--   보는 사람 = 대표님 · 운영진(_training_shelf_can_edit — 정리 편집과 같은 사람). 회원 · 코치진은 표 · 함수 모두 못 본다.
--   알림은 밤(22~07시 한국)이면 알림함에만. 줄을 지우는 문장이 없다(그만두기 = state 'canceled').

create table if not exists public.training_video_fixes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.training_exercises(id) on delete cascade,
  video_path text,
  at_sec numeric(7,2) not null default 0 check (at_sec between 0 and 3600),
  from_sec numeric(7,2) check (from_sec is null or from_sec between 0 and 3600),
  to_sec numeric(7,2) check (to_sec is null or to_sec between 0 and 3600),
  motion text not null default '' check (char_length(motion) <= 20),
  cat text not null check (cat in ('motion', 'cut', 'text', 'sound', 'other')),
  body text not null default '' check (char_length(body) <= 300),
  held boolean not null default false,
  held_video_path text check (held_video_path is null or held_video_path ~ '^member/[A-Za-z0-9._-]{1,120}\.mp4$'),
  held_poster_path text check (held_poster_path is null or held_poster_path ~ '^member/[A-Za-z0-9._-]{1,120}\.(webp|jpg|jpeg|png)$'),
  state text not null default 'requested' check (state in ('requested', 'doing', 'done', 'skip', 'canceled')),
  reply text not null default '' check (char_length(reply) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  check (from_sec is null or to_sec is null or from_sec < to_sec)
);
create index if not exists training_video_fixes_card_idx on public.training_video_fixes (card_id, created_at desc);
create index if not exists training_video_fixes_open_idx on public.training_video_fixes (state) where state in ('requested', 'doing');
alter table public.training_video_fixes enable row level security;
revoke all on public.training_video_fixes from public, anon, authenticated;

create table if not exists public.training_video_candidates (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.training_exercises(id) on delete cascade,
  video_path text not null check (video_path ~ '^member/[A-Za-z0-9._-]{1,120}\.mp4$'),
  poster_path text check (poster_path is null or poster_path ~ '^member/[A-Za-z0-9._-]{1,120}\.(webp|jpg|jpeg|png)$'),
  note text not null default '' check (char_length(note) <= 300),
  fix_ids uuid[] not null default '{}',
  state text not null default 'review' check (state in ('review', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decided_note text not null default '' check (char_length(decided_note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists training_video_candidates_card_idx on public.training_video_candidates (card_id, created_at desc);
alter table public.training_video_candidates enable row level security;
revoke all on public.training_video_candidates from public, anon, authenticated;

-- ── 목록 (대표님 · 운영진) — 열린 요청 · 숨긴 영상 · 지난 60일 + 새 영상(확인 기다림 · 지난 60일) ──
create or replace function public.training_video_fix_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._training_shelf_can_edit(v_uid) then return jsonb_build_object('can_edit', false); end if;
  return jsonb_build_object(
    'can_edit', true,
    'fixes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'card_id', f.card_id, 'card_name', e.name, 'video_path', f.video_path,
               'at_sec', f.at_sec, 'from_sec', f.from_sec, 'to_sec', f.to_sec, 'motion', f.motion, 'cat', f.cat, 'body', f.body,
               'held', f.held, 'held_video_path', f.held_video_path, 'held_poster_path', f.held_poster_path,
               'state', f.state, 'reply', f.reply, 'by_name', coalesce(nullif(btrim(p.name), ''), '운영진'),
               'created_at', f.created_at, 'updated_at', f.updated_at, 'done_at', f.done_at)
             order by f.created_at desc)
        from (select * from public.training_video_fixes x
               where x.state in ('requested', 'doing') or x.held or x.updated_at > now() - interval '60 days'
               order by x.created_at desc
               limit 300) f
        join public.training_exercises e on e.id = f.card_id
        left join public.profiles p on p.user_id = f.created_by), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'card_id', c.card_id, 'card_name', e.name, 'video_path', c.video_path, 'poster_path', c.poster_path,
               'note', c.note, 'fix_ids', to_jsonb(c.fix_ids), 'state', c.state, 'created_at', c.created_at,
               'decided_at', c.decided_at, 'decided_note', c.decided_note)
             order by c.created_at desc)
        from (select * from public.training_video_candidates y
               where y.state = 'review' or y.created_at > now() - interval '60 days'
               order by y.created_at desc
               limit 200) c
        join public.training_exercises e on e.id = c.card_id), '[]'::jsonb));
end $$;
revoke all on function public.training_video_fix_list() from public, anon;
grant execute on function public.training_video_fix_list() to authenticated;

-- ── 이 장면 고쳐 달라기 (대표님 · 운영진) ──
create or replace function public.training_video_fix_add(
  p_card uuid, p_at numeric, p_from numeric, p_to numeric, p_motion text, p_cat text, p_body text, p_hold boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  v_motion text := btrim(regexp_replace(coalesce(p_motion, ''), '\s+', ' ', 'g'));
  e public.training_exercises%rowtype;
  v_id uuid;
  v_held boolean := false;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._training_shelf_can_edit(v_uid) then raise exception '대표님 · 운영진만 할 수 있어요' using errcode = '42501'; end if;
  if p_cat is null or p_cat not in ('motion', 'cut', 'text', 'sound', 'other') then
    raise exception '고칠 곳 종류가 맞지 않아요' using errcode = '22023';
  end if;
  if char_length(v_body) > 300 then raise exception '300자까지 써 주세요' using errcode = '22023'; end if;
  if char_length(v_motion) > 20 then raise exception '동작 이름이 너무 길어요' using errcode = '22023'; end if;
  if v_body = '' and v_motion = '' then raise exception '무엇을 고칠지 한 줄 써 주세요' using errcode = '22023'; end if;
  if (p_at is not null and (p_at < 0 or p_at > 3600)) or (p_from is not null and (p_from < 0 or p_from > 3600))
     or (p_to is not null and (p_to < 0 or p_to > 3600)) then
    raise exception '시간이 맞지 않아요' using errcode = '22023';
  end if;
  if p_from is not null and p_to is not null and p_from >= p_to then raise exception '구간이 맞지 않아요' using errcode = '22023'; end if;
  if (select count(*) from public.training_video_fixes x where x.created_by = v_uid and x.created_at > now() - interval '1 day') >= 100 then
    raise exception '오늘은 여기까지 — 내일 더 보내 주세요' using errcode = '22023';
  end if;
  select * into e from public.training_exercises where id = p_card for update;
  if not found then raise exception '그 카드를 찾지 못했어요' using errcode = 'P0002'; end if;
  insert into public.training_video_fixes (card_id, video_path, at_sec, from_sec, to_sec, motion, cat, body, created_by)
  values (e.id, e.video_path, round(coalesce(p_at, 0), 2), round(p_from, 2), round(p_to, 2), v_motion, p_cat, v_body, v_uid)
  returning id into v_id;
  -- 고칠 때까지 회원에게 숨기기 — 회원용 영상 · 첫 장면을 이 줄로 옮긴다(파일은 저장소에 그대로)
  if coalesce(p_hold, false) and e.video_path is not null then
    update public.training_video_fixes
       set held = true, held_video_path = e.video_path, held_poster_path = e.poster_path
     where id = v_id;
    update public.training_exercises set video_path = null, poster_path = null, updated_at = now() where id = e.id;
    v_held := true;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'held', v_held);
end $$;
revoke all on function public.training_video_fix_add(uuid, numeric, numeric, numeric, text, text, text, boolean) from public, anon;
grant execute on function public.training_video_fix_add(uuid, numeric, numeric, numeric, text, text, text, boolean) to authenticated;

-- ── 숨긴 영상 다시 보이기 (대표님 · 운영진) — 카드에 다른 영상이 아직 없을 때만 ──
create or replace function public.training_video_fix_restore(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  f public.training_video_fixes%rowtype;
  e public.training_exercises%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._training_shelf_can_edit(v_uid) then raise exception '대표님 · 운영진만 할 수 있어요' using errcode = '42501'; end if;
  select * into f from public.training_video_fixes where id = p_id for update;
  if not found then raise exception '그 요청을 찾지 못했어요' using errcode = 'P0002'; end if;
  if not f.held or f.held_video_path is null then raise exception '숨긴 영상이 없어요' using errcode = '22023'; end if;
  select * into e from public.training_exercises where id = f.card_id for update;
  if e.video_path is not null then raise exception '이미 다른 영상이 붙어 있어요' using errcode = '22023'; end if;
  update public.training_exercises
     set video_path = f.held_video_path, poster_path = f.held_poster_path, updated_at = now()
   where id = e.id;
  update public.training_video_fixes set held = false, updated_at = now() where id = f.id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.training_video_fix_restore(uuid) from public, anon;
grant execute on function public.training_video_fix_restore(uuid) to authenticated;

-- ── 요청 그만두기 (대표님 · 운영진) — 숨긴 영상이 있으면 카드에 되돌린다(다른 영상이 없을 때) ──
create or replace function public.training_video_fix_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  f public.training_video_fixes%rowtype;
  v_back boolean := false;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._training_shelf_can_edit(v_uid) then raise exception '대표님 · 운영진만 할 수 있어요' using errcode = '42501'; end if;
  select * into f from public.training_video_fixes where id = p_id for update;
  if not found then raise exception '그 요청을 찾지 못했어요' using errcode = 'P0002'; end if;
  if f.state not in ('requested', 'doing') then raise exception '이미 끝난 요청이에요' using errcode = '22023'; end if;
  if f.held and f.held_video_path is not null then
    update public.training_exercises
       set video_path = f.held_video_path, poster_path = f.held_poster_path, updated_at = now()
     where id = f.card_id and video_path is null;
    v_back := found;
  end if;
  update public.training_video_fixes
     set state = 'canceled', held = false, updated_at = now(), done_at = now()
   where id = f.id;
  return jsonb_build_object('ok', true, 'restored', v_back);
end $$;
revoke all on function public.training_video_fix_cancel(uuid) from public, anon;
grant execute on function public.training_video_fix_cancel(uuid) to authenticated;

-- ── 새 영상 정하기 (대표님 · 운영진) — 붙이면 카드 영상이 바뀌고 그 요청들은 끝, 다시면 요청이 다시 열린다 ──
create or replace function public.training_video_candidate_decide(p_id uuid, p_ok boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_note text := btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g'));
  c public.training_video_candidates%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._training_shelf_can_edit(v_uid) then raise exception '대표님 · 운영진만 할 수 있어요' using errcode = '42501'; end if;
  if p_ok is null then raise exception '붙일지 다시 고칠지 골라 주세요' using errcode = '22023'; end if;
  if char_length(v_note) > 300 then raise exception '300자까지 써 주세요' using errcode = '22023'; end if;
  select * into c from public.training_video_candidates where id = p_id for update;
  if not found then raise exception '그 영상을 찾지 못했어요' using errcode = 'P0002'; end if;
  if c.state <> 'review' then raise exception '이미 정한 영상이에요' using errcode = '22023'; end if;
  if p_ok then
    update public.training_exercises
       set video_path = c.video_path, poster_path = c.poster_path, updated_at = now()
     where id = c.card_id;
    -- 이 카드의 숨긴 영상은 숨김을 푼다(새 영상으로 바뀌었으니 — 경로는 기록으로 남김) · 이 영상이 답한 요청은 끝
    update public.training_video_fixes set held = false, updated_at = now() where card_id = c.card_id and held;
    update public.training_video_fixes
       set state = 'done', done_at = now(), updated_at = now(),
           reply = case when reply = '' then '새 영상으로 바꿨어요' else reply end
     where id = any (c.fix_ids) and state in ('requested', 'doing');
  else
    update public.training_video_fixes
       set state = 'requested', updated_at = now()
     where id = any (c.fix_ids) and state = 'doing';
  end if;
  update public.training_video_candidates
     set state = case when p_ok then 'approved' else 'rejected' end,
         decided_by = v_uid, decided_at = now(), decided_note = v_note
   where id = c.id;
  return jsonb_build_object('ok', true, 'state', case when p_ok then 'approved' else 'rejected' end);
end $$;
revoke all on function public.training_video_candidate_decide(uuid, boolean, text) from public, anon;
grant execute on function public.training_video_candidate_decide(uuid, boolean, text) to authenticated;

-- ── 클로드 쪽(SQL · 서버 키만) — 요청에 답하기 ──
create or replace function public._training_video_fix_reply(p_id uuid, p_state text, p_reply text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reply text := btrim(regexp_replace(coalesce(p_reply, ''), '\s+', ' ', 'g'));
  v_quiet boolean := extract(hour from (now() at time zone 'Asia/Seoul')) not between 7 and 21;
  f public.training_video_fixes%rowtype;
  v_name text;
begin
  if p_state is null or p_state not in ('doing', 'done', 'skip') then raise exception '상태가 맞지 않아요' using errcode = '22023'; end if;
  if char_length(v_reply) > 300 then raise exception '300자까지 써 주세요' using errcode = '22023'; end if;
  select * into f from public.training_video_fixes where id = p_id for update;
  if not found then raise exception '그 요청을 찾지 못했어요' using errcode = 'P0002'; end if;
  if f.state = 'canceled' then raise exception '그만둔 요청이에요' using errcode = '22023'; end if;
  update public.training_video_fixes
     set state = p_state, reply = case when v_reply = '' then reply else v_reply end, updated_at = now(),
         done_at = case when p_state in ('done', 'skip') then now() else null end
   where id = f.id;
  if p_state in ('done', 'skip') and v_reply <> '' and f.created_by is not null then
    select name into v_name from public.training_exercises where id = f.card_id;
    insert into public.notifications (user_id, title, body, link, pushed_at)
    values (f.created_by, '🎬 영상 고쳐 주세요 — 답이 왔어요', '‘' || coalesce(v_name, '카드') || '’ · ' || left(v_reply, 80),
            '/missions?learn=1&card=' || f.card_id, case when v_quiet then now() end);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public._training_video_fix_reply(uuid, text, text) from public, anon, authenticated;

-- ── 클로드 쪽(SQL · 서버 키만) — 다시 만든 영상 넣기(파일은 먼저 저장소에) → 대표님 · 운영진께 알림 ──
create or replace function public._training_video_candidate_add(p_card uuid, p_video text, p_poster text, p_note text, p_fix_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_note text := btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g'));
  v_quiet boolean := extract(hour from (now() at time zone 'Asia/Seoul')) not between 7 and 21;
  v_name text;
  v_id uuid;
  v_fix uuid[];
begin
  select name into v_name from public.training_exercises where id = p_card;
  if not found then raise exception '그 카드를 찾지 못했어요' using errcode = 'P0002'; end if;
  if char_length(v_note) > 300 then raise exception '300자까지 써 주세요' using errcode = '22023'; end if;
  -- 이 카드의 요청만 잇는다
  select coalesce(array_agg(x.id), '{}') into v_fix
    from public.training_video_fixes x
   where x.id = any (coalesce(p_fix_ids, '{}')) and x.card_id = p_card;
  insert into public.training_video_candidates (card_id, video_path, poster_path, note, fix_ids)
  values (p_card, p_video, p_poster, v_note, v_fix)
  returning id into v_id;
  update public.training_video_fixes set state = 'doing', updated_at = now()
   where id = any (v_fix) and state = 'requested';
  insert into public.notifications (user_id, title, body, link, pushed_at)
  select r.user_id, '🎬 새 영상을 확인해 주세요', '‘' || v_name || '’' || case when v_note <> '' then ' · ' || left(v_note, 80) else '' end,
         '/missions?learn=1&card=' || p_card, case when v_quiet then now() end
    from (select distinct ur.user_id from public.user_roles ur where ur.role in ('super_admin'::public.app_role, 'admin'::public.app_role)) r;
  return jsonb_build_object('ok', true, 'id', v_id, 'fixes', coalesce(array_length(v_fix, 1), 0));
end $$;
revoke all on function public._training_video_candidate_add(uuid, text, text, text, uuid[]) from public, anon, authenticated;
