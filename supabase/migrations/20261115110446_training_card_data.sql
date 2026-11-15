-- 📊 영상으로 배우기 4단계 — 대표님 데이터 화면 · 월요일 요약 · 회원 「많이 담은 동작」
--   2026-11-15 대표님 「다음 4단계진행」 — 보고서 「영상으로 배우기 — 대표님 정리 편집 · 내 수업 · 반응 데이터」
--   https://claude.ai/artifact/F9QW5nn9N51k5wqZmGKVdE 의 4단계 칸(편집 화면 「데이터 보기」 · 줄 세우기 · 다음 촬영 목록 ·
--   월요일 요약 · 회원 「많이 담은 동작」) · 결정 5번(담기 숫자는 5명 넘을 때만) · 결정 8번(이용 기록 1년 — 지우기는 다음 파일)
--
--   ① _training_card_stats(시작, 끝, 지점) (안쪽) — 1~3단계 기록을 카드마다 사람 수로 합친다:
--      본 회원(카드 시트를 열거나 영상이 돈 회원) · 연 횟수 · 영상 본 회원 · 끝까지 본 회원 · 다시 본 회원 ·
--      담은 회원 · ♥ · 쉬워요/딱 좋아요/어려워요 · 의견(답 기다림) · 영상 요청 + 리그별(담기 · 느낌 — 지금 리그) +
--      찾았는데 없는 동작 · 영상 요청 검색어 순위(wishes) + 기록이 있는 지점 목록.
--      회원 줄만 센다(member — 코치진 · 운영진 · 체험 계정 빼고) · 이름 · 아이디는 내보내지 않는다(사람 수만 · 보고서 「개인정보」).
--      기간은 한국 날짜 [시작, 끝) — 이용 기록은 그날, 담기 · 찾기 · 요청은 마지막으로 남긴 때, ♥ · 느낌은 누른 때, 의견은 쓴 때.
--   ② training_card_stats(일, 지점) — 대표님 · 운영진(_training_shelf_can_edit — 정리 편집과 같은 사람)만 · 1 ~ 365일 · 오늘까지.
--   ③ training_card_popular() — 회원 화면 「많이 담은 동작」: 담은 회원이 5명을 넘는 카드 열쇠만(숫자 없음 · 로그인한 사람).
--   ④ 월요일 요약 _training_card_weekly() — 월요일 08:17 KST, 지난주(월 ~ 일) 숫자를 대표님 · 운영진(super_admin · admin)께 알림 한 통:
--      많이 본 · 많이 담은 · 어려워요 많은 · 새 의견 · 찾았는데 없는 동작(있는 것만) → /missions?learn=1&data=1 (데이터 창).
--      숫자가 하나도 없으면 안 보낸다 · 주마다 한 번(training_card_weekly_log — 다시 불러도 그대로).
--
--   새 표 1 · 새 함수 4(안쪽 2) · 예약 1 · 기존 표 · 함수는 그대로. 1년 지난 기록 지우기는 다음 파일(…_training_card_purge.sql).

-- ── 월요일 요약 기록 (주마다 한 줄 — 합계만) ─────────────────
create table if not exists public.training_card_weekly_log (
  week date primary key,                       -- 요약한 주의 월요일(한국)
  sent_at timestamptz not null default now(),
  recipients integer not null default 0,
  summary jsonb not null default '{}'::jsonb
);
alter table public.training_card_weekly_log enable row level security;
revoke all on public.training_card_weekly_log from public, anon, authenticated;

-- ── ① 합계 (안쪽) ───────────────────────────────────────────
create or replace function public._training_card_stats(p_since date, p_until date, p_branch text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  t as (select (p_since::timestamp at time zone 'Asia/Seoul') as t0, (p_until::timestamp at time zone 'Asia/Seoul') as t1),
  ev as (
    select e.user_id, e.item, e.kind, e.n
      from public.training_card_events e
     where e.member and e.day >= p_since and e.day < p_until
       and (p_branch is null or e.branch_name = p_branch)
  ),
  sv as (
    select s.user_id, s.item
      from public.training_card_saves s, t
     where s.member and s.last_at >= t.t0 and s.last_at < t.t1
       and (p_branch is null or s.branch_name = p_branch)
  ),
  rx as (
    select x.user_id, x.item,
           (x.heart and x.heart_at >= t.t0 and x.heart_at < t.t1) as heart,
           case when x.feel_at >= t.t0 and x.feel_at < t.t1 then x.feel end as feel
      from public.training_card_reactions x, t
     where x.member and (p_branch is null or x.branch_name = p_branch)
  ),
  op as (
    select o.item, o.reply is null as waiting
      from public.training_card_opinions o, t
     where o.member and o.removed_at is null and o.created_at >= t.t0 and o.created_at < t.t1
       and (p_branch is null or o.branch_name = p_branch)
  ),
  ak as (
    select a.user_id, a.kind, a.key, a.query, a.last_at
      from public.training_card_asks a, t
     where a.member and a.last_at >= t.t0 and a.last_at < t.t1
       and (p_branch is null or a.branch_name = p_branch)
  ),
  lg as (select m.user_id, m.current_rank::text as league from public.member_progress m where m.current_rank is not null),
  e_agg as (
    select ev.item,
           count(distinct ev.user_id) filter (where ev.kind in ('open', 'play')) as viewers,
           coalesce(sum(ev.n) filter (where ev.kind = 'open'), 0) as opens,
           count(distinct ev.user_id) filter (where ev.kind = 'play') as players,
           count(distinct ev.user_id) filter (where ev.kind = 'complete') as completers,
           count(distinct ev.user_id) filter (where ev.kind = 'replay') as replayers
      from ev where ev.item ~ '^[cm]:' group by ev.item
  ),
  s_agg as (select sv.item, count(*) as savers from sv group by sv.item),
  r_agg as (
    select rx.item,
           count(*) filter (where rx.heart) as hearts,
           count(*) filter (where rx.feel = 'easy') as easy,
           count(*) filter (where rx.feel = 'ok') as ok,
           count(*) filter (where rx.feel = 'hard') as hard
      from rx group by rx.item
  ),
  o_agg as (select op.item, count(*) as opinions, count(*) filter (where op.waiting) as waiting from op group by op.item),
  f_agg as (select ak.key as item, count(distinct ak.user_id) as film from ak where ak.kind = 'film' and ak.key ~ '^[cm]:' group by ak.key),
  l_agg as (
    select z.item, z.league,
           count(*) filter (where z.src = 's') as s,
           count(*) filter (where z.src = 'r' and z.feel = 'easy') as e,
           count(*) filter (where z.src = 'r' and z.feel = 'ok') as o,
           count(*) filter (where z.src = 'r' and z.feel = 'hard') as h
      from (select 's' as src, sv.item, lg.league, null::text as feel from sv join lg on lg.user_id = sv.user_id
            union all
            select 'r', rx.item, lg.league, rx.feel from rx join lg on lg.user_id = rx.user_id where rx.feel is not null) z
     group by z.item, z.league
  ),
  keys as (
    select e_agg.item from e_agg
    union select s_agg.item from s_agg
    union select r_agg.item from r_agg where r_agg.hearts + r_agg.easy + r_agg.ok + r_agg.hard > 0
    union select o_agg.item from o_agg
    union select f_agg.item from f_agg
  ),
  w_agg as (
    select ak.key,
           (array_agg(ak.query order by ak.last_at desc) filter (where ak.query is not null))[1] as query,
           count(distinct ak.user_id) filter (where ak.kind = 'miss') as miss,
           count(distinct ak.user_id) filter (where ak.kind = 'film') as film,
           count(distinct ak.user_id) as users,
           max(ak.last_at) as last_at
      from ak where ak.key like 'q:%' group by ak.key
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'shelf_members', (select count(distinct ev.user_id) from ev where ev.kind = 'shelf'),
      'members', (select count(distinct ev.user_id) from ev where ev.kind in ('open', 'play') and ev.item ~ '^[cm]:'),
      'players', (select count(distinct ev.user_id) from ev where ev.kind = 'play'),
      'completers', (select count(distinct ev.user_id) from ev where ev.kind = 'complete'),
      'savers', (select count(distinct sv.user_id) from sv),
      'reactors', (select count(distinct rx.user_id) from rx where rx.heart or rx.feel is not null),
      'opinions', (select count(*) from op),
      'waiting', (select count(*) from op where op.waiting),
      'askers', (select count(distinct ak.user_id) from ak),
      'leagues', coalesce((
        select jsonb_object_agg(v.league, v.n)
          from (select lg.league, count(distinct ev.user_id) as n
                  from ev join lg on lg.user_id = ev.user_id
                 where ev.kind in ('open', 'play') and ev.item ~ '^[cm]:'
                 group by lg.league) v), '{}'::jsonb)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item', k.item,
               'viewers', coalesce(e.viewers, 0), 'opens', coalesce(e.opens, 0), 'players', coalesce(e.players, 0),
               'completers', coalesce(e.completers, 0), 'replayers', coalesce(e.replayers, 0),
               'savers', coalesce(s.savers, 0), 'hearts', coalesce(r.hearts, 0),
               'easy', coalesce(r.easy, 0), 'ok', coalesce(r.ok, 0), 'hard', coalesce(r.hard, 0),
               'opinions', coalesce(o.opinions, 0), 'waiting', coalesce(o.waiting, 0), 'film', coalesce(f.film, 0),
               'leagues', coalesce((select jsonb_object_agg(l.league, jsonb_build_object('s', l.s, 'e', l.e, 'o', l.o, 'h', l.h))
                                      from l_agg l where l.item = k.item), '{}'::jsonb))
               order by coalesce(e.viewers, 0) desc, coalesce(s.savers, 0) desc, k.item)
        from keys k
        left join e_agg e on e.item = k.item
        left join s_agg s on s.item = k.item
        left join r_agg r on r.item = k.item
        left join o_agg o on o.item = k.item
        left join f_agg f on f.item = k.item), '[]'::jsonb),
    'wishes', coalesce((
      select jsonb_agg(jsonb_build_object('key', w.key, 'query', coalesce(w.query, substr(w.key, 3)),
                                          'miss', w.miss, 'film', w.film, 'users', w.users, 'last_at', w.last_at)
                       order by w.film desc, w.users desc, w.last_at desc)
        from (select * from w_agg order by w_agg.film desc, w_agg.users desc, w_agg.last_at desc limit 40) w), '[]'::jsonb),
    'branches', coalesce((
      select jsonb_agg(b.branch_name order by b.branch_name)
        from (select distinct e2.branch_name from public.training_card_events e2
               where e2.member and e2.branch_name is not null and e2.day >= p_until - 366) b), '[]'::jsonb));
$$;
revoke all on function public._training_card_stats(date, date, text) from public, anon, authenticated;

-- ── ② 대표님 데이터 화면 (대표님 · 운영진) ───────────────────
create or replace function public.training_card_stats(p_days integer default 28, p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 28), 365));
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_since date := v_today - (v_days - 1);
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
begin
  if not public._training_shelf_can_edit(auth.uid()) then
    raise exception '데이터는 대표님 · 운영진만 볼 수 있어요' using errcode = '42501';
  end if;
  return jsonb_build_object('days', v_days, 'since', v_since, 'branch', v_branch)
      || public._training_card_stats(v_since, v_today + 1, v_branch);
end $$;
revoke all on function public.training_card_stats(integer, text) from public, anon;
grant execute on function public.training_card_stats(integer, text) to authenticated;

-- ── ③ 회원 화면 「많이 담은 동작」 — 담은 회원이 5명을 넘는 카드 열쇠만 ──
create or replace function public.training_card_popular()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.item order by x.savers desc, x.item), '[]'::jsonb)
    from (select s.item, count(*) as savers
            from public.training_card_saves s
           where s.member and auth.uid() is not null
           group by s.item
          having count(*) > 5) x;
$$;
revoke all on function public.training_card_popular() from public, anon;
grant execute on function public.training_card_popular() to authenticated;

-- ── ④ 월요일 요약 (예약 · 안쪽) — 지난주(월 ~ 일) 숫자를 대표님 · 운영진께 한 통 ──
create or replace function public._training_card_weekly()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_monday date := v_today - (extract(isodow from v_today)::integer - 1);
  v_since date := v_monday - 7;
  s jsonb;
  v_items jsonb;
  v_top jsonb;
  v_parts text[] := '{}';
  v_members integer;
  v_title text;
  v_body text;
  v_sent integer := 0;
begin
  -- 주마다 한 번 — 같은 주를 다시 부르면 그대로 끝
  insert into public.training_card_weekly_log (week) values (v_since) on conflict (week) do nothing;
  if not found then return jsonb_build_object('ok', true, 'week', v_since, 'skipped', true); end if;

  s := public._training_card_stats(v_since, v_monday, null);
  v_items := coalesce(s->'items', '[]'::jsonb);
  v_members := coalesce((s->'totals'->>'members')::integer, 0);

  select x into v_top from jsonb_array_elements(v_items) x
   where (x->>'viewers')::integer > 0
   order by (x->>'viewers')::integer desc, (x->>'opens')::integer desc, x->>'item' limit 1;
  if v_top is not null then v_parts := v_parts || ('많이 본 ‘' || public._card_item_name(v_top->>'item') || '’'); end if;
  v_top := null;
  select x into v_top from jsonb_array_elements(v_items) x
   where (x->>'savers')::integer > 0
   order by (x->>'savers')::integer desc, (x->>'viewers')::integer desc, x->>'item' limit 1;
  if v_top is not null then v_parts := v_parts || ('많이 담은 ‘' || public._card_item_name(v_top->>'item') || '’'); end if;
  v_top := null;
  select x into v_top from jsonb_array_elements(v_items) x
   where (x->>'hard')::integer >= 2 and (x->>'easy')::integer + (x->>'ok')::integer + (x->>'hard')::integer >= 3
   order by (x->>'hard')::numeric / ((x->>'easy')::integer + (x->>'ok')::integer + (x->>'hard')::integer) desc,
            (x->>'hard')::integer desc, x->>'item' limit 1;
  if v_top is not null then v_parts := v_parts || ('어려워요 많은 ‘' || public._card_item_name(v_top->>'item') || '’'); end if;
  if coalesce((s->'totals'->>'opinions')::integer, 0) > 0 then
    v_parts := v_parts || ('새 의견 ' || (s->'totals'->>'opinions') || '개');
  end if;
  v_top := null;
  select x into v_top from jsonb_array_elements(coalesce(s->'wishes', '[]'::jsonb)) x
   order by (x->>'users')::integer desc, (x->>'film')::integer desc limit 1;
  if v_top is not null then v_parts := v_parts || ('찾았는데 없는 ‘' || (v_top->>'query') || '’'); end if;

  if v_members = 0 and coalesce(array_length(v_parts, 1), 0) = 0 then
    update public.training_card_weekly_log set summary = jsonb_build_object('empty', true, 'totals', s->'totals') where week = v_since;
    return jsonb_build_object('ok', true, 'week', v_since, 'sent', 0, 'empty', true);
  end if;

  v_title := '📊 지난주 영상으로 배우기' || case when v_members > 0 then ' · 회원 ' || v_members || '명이 봤어요' else '' end;
  v_body := coalesce(nullif(array_to_string(v_parts, ' · '), ''), '데이터 창에서 지난주 숫자를 볼 수 있어요');
  insert into public.notifications (user_id, title, body, link)
  select distinct ur.user_id, v_title, v_body, '/missions?learn=1&data=1'
    from public.user_roles ur
   where ur.role in ('super_admin', 'admin');
  get diagnostics v_sent = row_count;
  update public.training_card_weekly_log
     set recipients = v_sent, summary = jsonb_build_object('title', v_title, 'body', v_body, 'totals', s->'totals')
   where week = v_since;
  return jsonb_build_object('ok', true, 'week', v_since, 'sent', v_sent, 'title', v_title, 'body', v_body);
end $$;
revoke all on function public._training_card_weekly() from public, anon, authenticated;

-- 월요일 08:17 KST = 일요일 23:17 UTC
select cron.schedule('training-card-weekly', '17 23 * * 0', $$select public._training_card_weekly()$$);
