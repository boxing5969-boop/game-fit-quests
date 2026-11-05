-- 153 코치 성향 카드 · 맞춤 피드백 (2026-11-05 대표님 「코치님들의 mbti와 심리 상세한 정보를 먼저 획득한 뒤에 … 이런 식으로 남기면
--   코치님들이 알아들을 수 있도록 피드백해 주는 기능」) — 153운영본부 › 전략 회의 › 153 기준 칸
--
--   · coach_mind_profiles — 코치님이 직접 답한 성향 카드(MBTI · 피드백 받는 법 · 힘이 나는 것 …) + 오삼코치 '전달 설명서'(summary)
--       보는 사람: 본인 · 대표님(_strategy_hq). 지점장님은 '카드 있음/없음'만 — 맞춤 글은 Edge Function coach-mind 가 서버 키로 읽어 만든다
--       동의(consent_at) 없이는 저장하지 않는다 · 지우기 = 내용을 모두 비움(cleared_at, 본인 또는 대표님) · 평가 · 급여 · 근무에 쓰지 않는다(화면 안내)
--   · coach_notes · coach_note_deliveries — 피드백 한 번 = 공통 기준(core) 하나 + 코치님마다 맞춘 글(body, 카드가 없으면 null = 공통 기준 그대로)
--       코치님은 본인 몫만 · 확인했어요 · 한마디(보낸 분께 알림) · 원래 기준(core)도 늘 같이 보인다
--       맞춘 글 · 한마디는 보낸 분과 대표님만(같은 지점의 다른 지시권자는 확인 현황만)
--   · coach_mind_asks — '성향 카드 부탁하기' 알림은 사람마다 20시간에 한 번
--   · 표는 직접 읽기 · 쓰기를 막고 SECURITY DEFINER 함수로만 (RLS 켬 · 정책 없음) · 기존 함수는 하나도 바꾸지 않는다
--   · 문항 값은 _coach_mind_allowed() — supabase/functions/_shared/coachMind.ts MIND_QUESTIONS 와 같다(테스트 src/lib/coachMind.test.ts)
--   · 지우기는 줄을 없애지 않고 내용을 비우거나 deleted_at 을 남긴다
--   · 알림 링크: /office?tab=strategy&s=std (153 기준) · 카드 부탁은 &mind=1

-- ───────────────────────── 표 ─────────────────────────

create table if not exists public.coach_mind_profiles (
  coach_id uuid primary key,
  branch_name text,
  answers jsonb not null default '{}'::jsonb,
  mbti text check (mbti is null or mbti ~ '^[EI][SN][TF][JP]$'),
  mbti_source text check (mbti_source is null or mbti_source in ('test', 'guess')),
  note_power text check (note_power is null or char_length(note_power) <= 120),
  note_know text check (note_know is null or char_length(note_know) <= 200),
  summary jsonb,
  summary_at timestamptz,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid
);

create table if not exists public.coach_mind_asks (
  coach_id uuid primary key,
  asked_by uuid not null,
  asked_at timestamptz not null default now()
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  author_id uuid not null,
  core jsonb not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists coach_notes_branch_idx on public.coach_notes (branch_name, created_at desc) where deleted_at is null;

create table if not exists public.coach_note_deliveries (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.coach_notes (id),
  coach_id uuid not null,
  body jsonb,
  seen_at timestamptz,
  acked_at timestamptz,
  reply text check (reply is null or char_length(reply) <= 300),
  reply_at timestamptz,
  created_at timestamptz not null default now(),
  unique (note_id, coach_id)
);
create index if not exists coach_note_deliveries_coach_idx on public.coach_note_deliveries (coach_id, created_at desc);

alter table public.coach_mind_profiles enable row level security;
alter table public.coach_mind_asks enable row level security;
alter table public.coach_notes enable row level security;
alter table public.coach_note_deliveries enable row level security;
revoke all on table public.coach_mind_profiles, public.coach_mind_asks, public.coach_notes, public.coach_note_deliveries from anon, authenticated;

-- ───────────────────────── 안쪽 도우미 ─────────────────────────

-- 성향 카드 문항 · 값 — _shared/coachMind.ts mindAllowedSpec() 과 같은 모양
create or replace function public._coach_mind_allowed()
returns jsonb language sql immutable set search_path to 'public' as $$
  select '{
    "energy": {"kind": "one", "v": ["people", "alone"]},
    "learn": {"kind": "one", "v": ["detail", "big"]},
    "hear": {"kind": "one", "v": ["logic", "heart"]},
    "plan": {"kind": "one", "v": ["plan", "flex"]},
    "order": {"kind": "one", "v": ["conclusion", "reason"]},
    "tone": {"kind": "one", "v": ["direct", "soft"]},
    "shape": {"kind": "many", "max": 2, "v": ["demo", "steps", "scene", "why"]},
    "timing": {"kind": "one", "v": ["now", "after", "nextday"]},
    "power": {"kind": "many", "max": 2, "v": ["members", "skill", "recog", "team", "autonomy", "reward"]},
    "drain": {"kind": "many", "max": 6, "v": ["compare", "public", "noreason", "emotion", "toomuch", "onlyfix"]},
    "stress": {"kind": "one", "v": ["quiet", "harder", "sharp", "talk"]},
    "helps": {"kind": "one", "v": ["time", "talk", "solution", "okay"]},
    "strong": {"kind": "many", "max": 2, "v": ["demo", "mood", "detail", "fitness", "newbie", "timing"]},
    "grow": {"kind": "many", "max": 2, "v": ["demo", "mood", "detail", "fitness", "newbie", "timing"]},
    "box_years": {"kind": "one", "v": ["lt1", "1to3", "3to5", "gt5"]},
    "teach_years": {"kind": "one", "v": ["lt1", "1to3", "3to5", "gt5"]}
  }'::jsonb;
$$;

-- 아는 문항 · 아는 값만 — 많이 고르는 문항은 앞에서부터 max 개 (화면 · Edge Function 의 cleanMindAnswers 와 같은 규칙)
create or replace function public._coach_mind_clean(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare
  v_out jsonb := '{}'::jsonb;
  k text;
  spec jsonb;
  val jsonb;
  arr jsonb;
  x text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return v_out; end if;
  for k, spec in select e.key, e.value from jsonb_each(public._coach_mind_allowed()) e loop
    val := p -> k;
    continue when val is null;
    if spec ->> 'kind' = 'one' then
      if jsonb_typeof(val) = 'string' and (spec -> 'v') ? (val #>> '{}') then
        v_out := v_out || jsonb_build_object(k, val #>> '{}');
      end if;
    elsif jsonb_typeof(val) = 'array' then
      arr := '[]'::jsonb;
      for x in select t.e from jsonb_array_elements_text(val) with ordinality t(e, i) order by t.i loop
        if (spec -> 'v') ? x and not (arr ? x) and jsonb_array_length(arr) < coalesce((spec ->> 'max')::int, 1) then
          arr := arr || to_jsonb(x);
        end if;
      end loop;
      if jsonb_array_length(arr) > 0 then v_out := v_out || jsonb_build_object(k, arr); end if;
    end if;
  end loop;
  return v_out;
end $$;

-- 카드 한 장 → 화면 모양
create or replace function public._coach_mind_view(r public.coach_mind_profiles)
returns jsonb language sql stable set search_path to 'public' as $$
  select jsonb_build_object('mbti', r.mbti, 'mbti_source', r.mbti_source, 'answers', r.answers,
                            'note_power', r.note_power, 'note_know', r.note_know,
                            'summary', r.summary, 'summary_at', r.summary_at,
                            'consent_at', r.consent_at, 'updated_at', r.updated_at);
$$;

-- 공통 기준 정리 · 검사 (손으로 고친 글도 여기를 지난다)
create or replace function public._coach_note_core(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare
  v_title text;
  v_why text;
  v_points jsonb := '[]'::jsonb;
  v_checks jsonb := '[]'::jsonb;
  e jsonb;
  h text;
  b text;
  c text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception '피드백 내용이 비었어요'; end if;
  v_title := left(btrim(coalesce(p ->> 'title', '')), 60);
  v_why := left(btrim(coalesce(p ->> 'why', '')), 240);
  if v_title = '' then raise exception '피드백 제목을 써 주세요'; end if;
  if jsonb_typeof(p -> 'points') = 'array' then
    for e in select t.value from jsonb_array_elements(p -> 'points') t loop
      continue when jsonb_typeof(e) <> 'object';
      h := left(btrim(coalesce(e ->> 'head', '')), 40);
      b := left(btrim(coalesce(e ->> 'body', '')), 200);
      if h <> '' or b <> '' then v_points := v_points || jsonb_build_array(jsonb_build_object('head', h, 'body', b)); end if;
    end loop;
  end if;
  if jsonb_array_length(v_points) = 0 then raise exception '기준을 한 가지 이상 써 주세요'; end if;
  if jsonb_array_length(v_points) > 8 then raise exception '기준은 8가지까지예요'; end if;
  if jsonb_typeof(p -> 'checks') = 'array' then
    for c in select t.value from jsonb_array_elements_text(p -> 'checks') t loop
      c := left(btrim(coalesce(c, '')), 100);
      if c <> '' and jsonb_array_length(v_checks) < 4 then v_checks := v_checks || to_jsonb(c); end if;
    end loop;
  end if;
  return jsonb_build_object('title', v_title, 'points', v_points, 'why', v_why, 'checks', v_checks);
end $$;

-- 코치님마다 맞춘 글 정리 — 줄이 없으면 null(공통 기준 그대로 보냄)
create or replace function public._coach_note_body(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare
  v_lines jsonb := '[]'::jsonb;
  l text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if jsonb_typeof(p -> 'lines') = 'array' then
    for l in select t.value from jsonb_array_elements_text(p -> 'lines') t loop
      l := left(btrim(coalesce(l, '')), 200);
      if l <> '' and jsonb_array_length(v_lines) < 10 then v_lines := v_lines || to_jsonb(l); end if;
    end loop;
  end if;
  if jsonb_array_length(v_lines) = 0 then return null; end if;
  return jsonb_build_object('greeting', left(btrim(coalesce(p ->> 'greeting', '')), 160),
                            'lines', v_lines,
                            'try_today', left(btrim(coalesce(p ->> 'try_today', '')), 160),
                            'closing', left(btrim(coalesce(p ->> 'closing', '')), 120));
end $$;

-- ───────────────────────── 화면이 부르는 함수 ─────────────────────────

-- 한 번에 — 내 카드 · 받은 피드백 / 지시권자면 코치님들 카드 현황(대표님은 카드 내용까지) · 보낸 피드백
create or replace function public.coach_mind_state(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_dir boolean;
  v_hq boolean;
  v_mine jsonb := null;
  v_notes jsonb;
  v_team jsonb := null;
  v_sent jsonb := null;
  r public.coach_mind_profiles%rowtype;
begin
  if not public._strategy_staff(v_uid) then return jsonb_build_object('staff', false); end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_dir := public._strategy_can_direct(v_uid);
  v_hq := public._strategy_hq(v_uid);

  select * into r from public.coach_mind_profiles where coach_id = v_uid and consent_at is not null;
  if r.coach_id is not null then v_mine := public._coach_mind_view(r); end if;

  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v_notes
    from (select n.created_at,
                 jsonb_build_object('id', d.id, 'note_id', n.id, 'created_at', n.created_at,
                                    'from', public._strategy_display(n.author_id),
                                    'core', n.core, 'body', d.body, 'tailored', d.body is not null,
                                    'seen_at', d.seen_at, 'acked_at', d.acked_at,
                                    'reply', d.reply, 'reply_at', d.reply_at) as j
            from public.coach_note_deliveries d
            join public.coach_notes n on n.id = d.note_id
           where d.coach_id = v_uid and n.deleted_at is null
           order by n.created_at desc
           limit 12) x;

  if v_dir then
    select coalesce(jsonb_agg(t.j order by t.has_mind, t.nm), '[]'::jsonb) into v_team
      from (select (mp.coach_id is not null) as has_mind,
                   (select coalesce(nullif(btrim(pr.name), ''), pr.nickname) from public.profiles pr where pr.user_id = s.user_id) as nm,
                   jsonb_build_object('person', public._strategy_display(s.user_id),
                                      'has_mind', mp.coach_id is not null,
                                      'mind_at', mp.updated_at,
                                      'asked_at', a.asked_at)
                   || case when v_hq and mp.coach_id is not null then jsonb_build_object('mind', public._coach_mind_view(mp)) else '{}'::jsonb end as j
              from public._strategy_branch_staff(v_branch) s
              left join public.coach_mind_profiles mp on mp.coach_id = s.user_id and mp.consent_at is not null
              left join public.coach_mind_asks a on a.coach_id = s.user_id
             where s.user_id <> v_uid and not public._strategy_hq(s.user_id)) t;

    select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v_sent
      from (select n.created_at,
                   jsonb_build_object(
                     'id', n.id, 'created_at', n.created_at, 'title', n.core ->> 'title',
                     'author', public._strategy_display(n.author_id),
                     'mine', n.author_id = v_uid,
                     'core', case when n.author_id = v_uid or v_hq then n.core else null end,
                     'items', (select coalesce(jsonb_agg(jsonb_build_object(
                                 'id', d.id, 'person', public._strategy_display(d.coach_id),
                                 'tailored', d.body is not null,
                                 'body', case when n.author_id = v_uid or v_hq then d.body else null end,
                                 'seen_at', d.seen_at, 'acked_at', d.acked_at,
                                 'reply', case when n.author_id = v_uid or v_hq then d.reply else null end,
                                 'reply_at', d.reply_at) order by d.created_at), '[]'::jsonb)
                                 from public.coach_note_deliveries d where d.note_id = n.id)) as j
              from public.coach_notes n
             where n.branch_name = v_branch and n.deleted_at is null
             order by n.created_at desc
             limit 10) x;
  end if;

  return jsonb_build_object(
    'staff', true,
    'hq', v_hq,
    'can_direct', v_dir,
    'branch', v_branch,
    'ai', exists (select 1 from public.internal_sync_config c where c.key = 'coach_feedback_ai' and c.value = 'on'),
    'mine', v_mine,
    'asked_at', (select a.asked_at from public.coach_mind_asks a where a.coach_id = v_uid),
    'notes', v_notes,
    'unseen', (select count(*) from public.coach_note_deliveries d join public.coach_notes n on n.id = d.note_id
                where d.coach_id = v_uid and d.seen_at is null and n.deleted_at is null),
    'team', v_team,
    'sent', v_sent
  );
end $$;

-- 내 성향 카드 저장 — 동의 · 순서 · 말투는 꼭. 저장하면 요약은 비워 두고(Edge Function 이 다시 만든다)
create or replace function public.coach_mind_save(
  p_answers jsonb, p_mbti text default null, p_mbti_source text default null,
  p_note_power text default null, p_note_know text default null, p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_ans jsonb := public._coach_mind_clean(p_answers);
  v_mbti text := upper(nullif(btrim(coalesce(p_mbti, '')), ''));
  v_src text := nullif(btrim(coalesce(p_mbti_source, '')), '');
  v_branch text;
  r public.coach_mind_profiles%rowtype;
begin
  if not public._strategy_staff(v_uid) then raise exception '코치진만 쓸 수 있어요'; end if;
  if not coalesce(p_consent, false) then raise exception '안내를 읽고 동의해 주세요'; end if;
  if not (v_ans ? 'order') or not (v_ans ? 'tone') then raise exception '「피드백은 이렇게」의 순서와 말투는 꼭 골라 주세요'; end if;
  if v_mbti is not null and v_mbti !~ '^[EI][SN][TF][JP]$' then raise exception 'MBTI 값이 잘못됐어요'; end if;
  if v_mbti is null then
    v_src := null;
  elsif v_src is null or v_src not in ('test', 'guess') then
    v_src := 'guess';
  end if;
  select branch_name into v_branch from public.profiles where user_id = v_uid;

  insert into public.coach_mind_profiles as m (coach_id, branch_name, answers, mbti, mbti_source, note_power, note_know,
                                               summary, summary_at, consent_at, created_at, updated_at, cleared_at, cleared_by)
  values (v_uid, v_branch, v_ans, v_mbti, v_src,
          nullif(left(btrim(coalesce(p_note_power, '')), 120), ''),
          nullif(left(btrim(coalesce(p_note_know, '')), 200), ''),
          null, null, now(), now(), now(), null, null)
  on conflict (coach_id) do update
     set branch_name = excluded.branch_name, answers = excluded.answers, mbti = excluded.mbti, mbti_source = excluded.mbti_source,
         note_power = excluded.note_power, note_know = excluded.note_know, summary = null, summary_at = null,
         consent_at = coalesce(m.consent_at, now()), updated_at = now(), cleared_at = null, cleared_by = null
  returning * into r;
  return public._coach_mind_view(r);
end $$;

-- 카드 지우기 — 본인(p_coach 없이) 또는 대표님(근무가 끝난 분 등). 줄은 남기고 내용만 모두 비운다
create or replace function public.coach_mind_clear(p_coach uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := coalesce(p_coach, v_uid);
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_target <> v_uid and not public._strategy_hq(v_uid) then raise exception '다른 분의 카드는 대표님만 지울 수 있어요'; end if;
  update public.coach_mind_profiles
     set answers = '{}'::jsonb, mbti = null, mbti_source = null, note_power = null, note_know = null,
         summary = null, summary_at = null, consent_at = null, cleared_at = now(), cleared_by = v_uid, updated_at = now()
   where coach_id = v_target;
end $$;

-- 성향 카드 부탁하기 — 카드가 없는 그 지점 코치님께 알림(사람마다 20시간에 한 번). 보낸 수를 돌려준다
create or replace function public.coach_mind_ask(p_branch text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_by jsonb;
  v_n integer := 0;
  r record;
begin
  if not public._strategy_can_direct(v_uid) then raise exception '성향 카드 부탁은 대표님 · 지점장님만 보낼 수 있어요'; end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_by := public._strategy_display(v_uid);
  for r in
    select s.user_id
      from public._strategy_branch_staff(v_branch) s
     where s.user_id <> v_uid and not public._strategy_hq(s.user_id)
       and not exists (select 1 from public.coach_mind_profiles m where m.coach_id = s.user_id and m.consent_at is not null)
       and not exists (select 1 from public.coach_mind_asks a where a.coach_id = s.user_id and a.asked_at > now() - interval '20 hours')
  loop
    insert into public.notifications (user_id, title, body, link)
    values (r.user_id, '🧭 코치 성향 카드를 부탁드려요',
            coalesce(v_by ->> 'name', '') || ' ' || coalesce(v_by ->> 'title', '') || '님이 코치님께 맞는 방식으로 피드백을 전하고 싶어 해요 · 5분',
            '/office?tab=strategy&s=std&mind=1');
    insert into public.coach_mind_asks (coach_id, asked_by, asked_at) values (r.user_id, v_uid, now())
    on conflict (coach_id) do update set asked_by = excluded.asked_by, asked_at = excluded.asked_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 피드백 보내기 — 공통 기준 하나 + 코치님마다 {coach, body|null}. 받는 분께 알림
create or replace function public.coach_note_send(p_branch text, p_core jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_core jsonb;
  v_id uuid;
  v_by jsonb;
  it jsonb;
  v_coach uuid;
  v_done uuid[] := '{}'::uuid[];
begin
  if not public._strategy_can_direct(v_uid) then raise exception '피드백은 대표님 · 지점장님만 보낼 수 있어요'; end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_core := public._coach_note_core(p_core);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '받을 코치님을 골라 주세요';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception '한 번에 30명까지 보낼 수 있어요'; end if;

  insert into public.coach_notes (branch_name, author_id, core) values (v_branch, v_uid, v_core) returning id into v_id;
  v_by := public._strategy_display(v_uid);

  for it in select t.value from jsonb_array_elements(p_items) t loop
    if jsonb_typeof(it) <> 'object' or coalesce(it ->> 'coach', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception '코치님 값이 잘못됐어요';
    end if;
    v_coach := (it ->> 'coach')::uuid;
    continue when v_coach = any (v_done);
    if public._coach_target_branch(v_uid, v_coach) is distinct from v_branch then raise exception '다른 지점 코치님이 섞여 있어요'; end if;
    v_done := v_done || v_coach;
    insert into public.coach_note_deliveries (note_id, coach_id, body) values (v_id, v_coach, public._coach_note_body(it -> 'body'));
    insert into public.notifications (user_id, title, body, link)
    values (v_coach, '💬 피드백이 왔어요 · ' || coalesce(v_by ->> 'name', '') || ' ' || coalesce(v_by ->> 'title', ''),
            left(v_core ->> 'title', 60), '/office?tab=strategy&s=std');
  end loop;
  return v_id;
end $$;

create or replace function public.coach_note_seen(p_ids uuid[])
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  update public.coach_note_deliveries
     set seen_at = now()
   where id = any (coalesce(p_ids, '{}'::uuid[])) and coach_id = v_uid and seen_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 확인했어요 (+ 한마디) — 한마디가 있으면 보낸 분께 알림
create or replace function public.coach_note_ack(p_id uuid, p_reply text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  d public.coach_note_deliveries%rowtype;
  v_author uuid;
  v_reply text := nullif(left(btrim(coalesce(p_reply, '')), 300), '');
  v_me jsonb;
begin
  select * into d from public.coach_note_deliveries where id = p_id and coach_id = v_uid;
  if d.id is null then raise exception '피드백을 찾을 수 없어요'; end if;
  select author_id into v_author from public.coach_notes where id = d.note_id and deleted_at is null;
  if v_author is null then raise exception '지워진 피드백이에요'; end if;
  update public.coach_note_deliveries
     set seen_at = coalesce(seen_at, now()),
         acked_at = coalesce(acked_at, now()),
         reply = coalesce(v_reply, reply),
         reply_at = case when v_reply is not null then now() else reply_at end
   where id = p_id;
  if v_reply is not null and v_author <> v_uid then
    v_me := public._strategy_display(v_uid);
    insert into public.notifications (user_id, title, body, link)
    values (v_author, '💬 ' || coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', '') || '님이 피드백에 답했어요',
            left(v_reply, 80), '/office?tab=strategy&s=std');
  end if;
end $$;

-- 보낸 피드백 지우기 — 보낸 분 또는 대표님 (deleted_at 만 남긴다)
create or replace function public.coach_note_remove(p_note uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.coach_notes n
                  where n.id = p_note and n.deleted_at is null
                    and (n.author_id = v_uid or public._strategy_hq(v_uid))) then
    raise exception '지울 수 없는 피드백이에요';
  end if;
  update public.coach_notes set deleted_at = now() where id = p_note;
end $$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public._coach_mind_allowed() from public, anon, authenticated;
revoke all on function public._coach_mind_clean(jsonb) from public, anon, authenticated;
revoke all on function public._coach_mind_view(public.coach_mind_profiles) from public, anon, authenticated;
revoke all on function public._coach_note_core(jsonb) from public, anon, authenticated;
revoke all on function public._coach_note_body(jsonb) from public, anon, authenticated;

revoke all on function public.coach_mind_state(text) from public, anon;
revoke all on function public.coach_mind_save(jsonb, text, text, text, text, boolean) from public, anon;
revoke all on function public.coach_mind_clear(uuid) from public, anon;
revoke all on function public.coach_mind_ask(text) from public, anon;
revoke all on function public.coach_note_send(text, jsonb, jsonb) from public, anon;
revoke all on function public.coach_note_seen(uuid[]) from public, anon;
revoke all on function public.coach_note_ack(uuid, text) from public, anon;
revoke all on function public.coach_note_remove(uuid) from public, anon;

grant execute on function public.coach_mind_state(text) to authenticated;
grant execute on function public.coach_mind_save(jsonb, text, text, text, text, boolean) to authenticated;
grant execute on function public.coach_mind_clear(uuid) to authenticated;
grant execute on function public.coach_mind_ask(text) to authenticated;
grant execute on function public.coach_note_send(text, jsonb, jsonb) to authenticated;
grant execute on function public.coach_note_seen(uuid[]) to authenticated;
grant execute on function public.coach_note_ack(uuid, text) to authenticated;
grant execute on function public.coach_note_remove(uuid) to authenticated;
