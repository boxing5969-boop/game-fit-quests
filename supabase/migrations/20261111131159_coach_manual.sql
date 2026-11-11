-- 153 매뉴얼 — 153운영본부 「매뉴얼」 탭 (2026-11-11 대표님 「넘어가자」 · 보고서 「153 매뉴얼 책 · 운영본부 「153 매뉴얼」 탭 보고서」
--   https://claude.ai/artifact/NohTXPmYbxKD4j5vSkx4Hj · 원고 https://claude.ai/artifact/54TyMyWDtkt9c1jBUa6Mex)
--
--   · coach_manual_books — 책 내용(장 · 카드 · 확인 문제 · 판 번호) JSON. **책 글은 이 표에만** — 저장소가 공개라
--       대표님 이야기 · 지점 운영 숫자가 든 글을 코드에 넣지 않는다(2026-11-11 대표님 「DB에만 두기」). 코치진만 coach_manual_book() 으로 받는다.
--       글을 고치면 그 장의 version 을 올린다(→ 그 장은 다시 서명) · 앱을 다시 올리지 않아도 바로 바뀐다 · 고치기는 SQL(클로드)
--       앱 코드에는 일반 장(프롤로그~9장) 예시만 — src/lib/coachManual/book1Sample.ts (이 표가 비었거나 함수가 없는 미리보기에서 보임)
--       화면은 받은 JSON 을 src/lib/coachManual/normalize.ts 로 거른다(모르는 블록 · 틀린 이름은 버림)
--   · coach_manual_reads — 코치님이 장마다 남긴 「읽고 이해했어요」 서명. 판(version)마다 한 줄 — 내용을 고쳐 판이 오르면 그 장은 다시 서명
--       확인 문제는 앱이 채점하고(3개 다 맞혀야 서명 단추가 열림) 몇 번 만에 맞혔는지(quiz_tries)만 남긴다
--   · coach_manual_nudges — 안 읽은 코치님께 보내는 '읽어 주세요' 알림, 사람마다 · 책마다 20시간에 한 번
--   · 보는 사람: 읽기 · 서명 = 코치진(_strategy_staff — 전략 회의와 같은 기준)
--               현황 · 알림 = 대표님 · 지점장님(_strategy_can_direct), 지점은 _strategy_scope(대표님은 고른 지점, 지점장님은 내 지점)
--   · 표는 직접 읽기 · 쓰기를 막고 SECURITY DEFINER 함수로만 (RLS 켬 · 정책 없음) · 기존 함수 · 표는 하나도 바꾸지 않는다
--   · 알림 링크: /office?tab=manual

-- ───────────────────────── 표 ─────────────────────────

create table if not exists public.coach_manual_books (
  book text primary key check (book ~ '^[a-z0-9_]{1,24}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.coach_manual_reads (
  user_id uuid not null,
  book text not null check (book ~ '^[a-z0-9_]{1,24}$'),
  chapter text not null check (chapter ~ '^[a-z0-9_]{1,24}$'),
  version int not null check (version between 1 and 999),
  quiz_tries int not null default 0 check (quiz_tries between 0 and 999),
  signed_at timestamptz not null default now(),
  primary key (user_id, book, chapter, version)
);
create index if not exists coach_manual_reads_book_idx on public.coach_manual_reads (book, user_id);

create table if not exists public.coach_manual_nudges (
  user_id uuid not null,
  book text not null check (book ~ '^[a-z0-9_]{1,24}$'),
  nudged_by uuid not null,
  nudged_at timestamptz not null default now(),
  primary key (user_id, book)
);

alter table public.coach_manual_books enable row level security;
alter table public.coach_manual_reads enable row level security;
alter table public.coach_manual_nudges enable row level security;
revoke all on table public.coach_manual_books, public.coach_manual_reads, public.coach_manual_nudges from anon, authenticated;

-- ───────────────────────── 함수 ─────────────────────────

-- 한 사람의 서명 목록 (내부용)
create or replace function public._coach_manual_reads_json(p_user uuid, p_book text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('chapter', r.chapter, 'version', r.version,
                                               'quiz_tries', r.quiz_tries, 'signed_at', r.signed_at)
                            order by r.signed_at), '[]'::jsonb)
    from public.coach_manual_reads r
   where r.user_id = p_user and r.book = p_book;
$$;

-- 책 내용 — 코치진만. 표에 그 책이 없으면 null (화면은 앱 안 예시를 보인다)
create or replace function public.coach_manual_book(p_book text default 'book1')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._strategy_staff(auth.uid()) then
    raise exception '153 매뉴얼은 코치진만 볼 수 있어요';
  end if;
  return (select b.data from public.coach_manual_books b where b.book = coalesce(p_book, 'book1'));
end $$;

-- 내 서명 · 권한 — 코치진이 아니면 {staff:false}
create or replace function public.coach_manual_me(p_book text default 'book1')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public._strategy_staff(v_uid) then
    return jsonb_build_object('staff', false);
  end if;
  return jsonb_build_object(
    'staff', true,
    'hq', public._strategy_hq(v_uid),
    'can_direct', public._strategy_can_direct(v_uid),
    'reads', public._coach_manual_reads_json(v_uid, coalesce(p_book, 'book1'))
  );
end $$;

-- 「읽고 이해했어요」 서명 — 같은 판에 다시 눌러도 처음 서명 시각을 남긴다. 돌려주는 값 = 내 서명 목록
--   표에 그 책이 있으면 그 책에 있는 장 · 지금 판 이하만 받는다 (없으면 — 내용을 넣기 전 — 모양만 확인)
create or replace function public.coach_manual_sign(p_book text, p_chapter text, p_version int, p_quiz_tries int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_data jsonb;
  v_ver int;
begin
  if not public._strategy_staff(v_uid) then
    raise exception '매뉴얼 서명은 코치진만 할 수 있어요';
  end if;
  if p_book is null or p_book !~ '^[a-z0-9_]{1,24}$'
     or p_chapter is null or p_chapter !~ '^[a-z0-9_]{1,24}$'
     or p_version is null or p_version not between 1 and 999 then
    raise exception '서명할 장을 찾을 수 없어요';
  end if;
  select b.data into v_data from public.coach_manual_books b where b.book = p_book;
  if v_data is not null then
    select case when jsonb_typeof(c -> 'version') = 'number' then greatest((c ->> 'version')::numeric::int, 1) else 1 end
      into v_ver
      from jsonb_array_elements(case when jsonb_typeof(v_data -> 'chapters') = 'array' then v_data -> 'chapters' else '[]'::jsonb end) c
     where c ->> 'id' = p_chapter
     limit 1;
    if v_ver is null or p_version > v_ver then
      raise exception '서명할 장을 찾을 수 없어요 · 목차에서 다시 열어 주세요';
    end if;
  end if;
  insert into public.coach_manual_reads (user_id, book, chapter, version, quiz_tries)
  values (v_uid, p_book, p_chapter, p_version, least(greatest(coalesce(p_quiz_tries, 0), 0), 999))
  on conflict (user_id, book, chapter, version) do nothing;
  return public._coach_manual_reads_json(v_uid, p_book);
end $$;

-- 현황 — 대표님 · 지점장님. 그 지점 코치진(대표님 계정은 빼고)의 서명 목록 · 마지막 '읽어 주세요' 알림
create or replace function public.coach_manual_board(p_book text default 'book1', p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_book text := coalesce(p_book, 'book1');
  v_branch text;
  v_hq boolean;
begin
  if not public._strategy_can_direct(v_uid) then
    raise exception '읽음 현황은 대표님 · 지점장님만 볼 수 있어요';
  end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_hq := public._strategy_hq(v_uid);
  return jsonb_build_object(
    'branch', v_branch,
    'branches', case
                  when v_hq then coalesce((select jsonb_agg(b.name order by b.name) from public.branches b where b.is_visible), '[]'::jsonb)
                  else jsonb_build_array(v_branch)
                end,
    'people', coalesce((
      select jsonb_agg(public._strategy_display(s.user_id)
                       || jsonb_build_object(
                            'me', s.user_id = v_uid,
                            'reads', public._coach_manual_reads_json(s.user_id, v_book),
                            'nudged_at', (select n.nudged_at from public.coach_manual_nudges n
                                           where n.user_id = s.user_id and n.book = v_book))
                       order by (select coalesce(nullif(btrim(pr.name), ''), pr.nickname)
                                   from public.profiles pr where pr.user_id = s.user_id))
        from public._strategy_branch_staff(v_branch) s
       where not public._strategy_hq(s.user_id)), '[]'::jsonb)
  );
end $$;

-- '읽어 주세요' 알림 — 대표님 · 지점장님이 같은 지점 코치님께. 사람마다 · 책마다 20시간에 한 번 ('sent' | 'too_soon')
create or replace function public.coach_manual_nudge(p_book text, p_user uuid, p_left int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_by jsonb;
  v_last timestamptz;
begin
  if not public._strategy_can_direct(v_uid) then
    raise exception '알림은 대표님 · 지점장님만 보낼 수 있어요';
  end if;
  if p_book is null or p_book !~ '^[a-z0-9_]{1,24}$' then
    raise exception '책을 찾을 수 없어요';
  end if;
  -- 같은 지점 코치님만 · 대표님 계정과 본인은 대상이 아님
  perform public._coach_target_branch(v_uid, p_user);

  perform pg_advisory_xact_lock(hashtext('coach_manual_nudge:' || p_user::text || ':' || p_book));
  select n.nudged_at into v_last from public.coach_manual_nudges n where n.user_id = p_user and n.book = p_book;
  if v_last is not null and v_last > now() - interval '20 hours' then
    return 'too_soon';
  end if;

  insert into public.coach_manual_nudges (user_id, book, nudged_by, nudged_at)
  values (p_user, p_book, v_uid, now())
  on conflict (user_id, book) do update set nudged_by = excluded.nudged_by, nudged_at = excluded.nudged_at;

  v_by := public._strategy_display(v_uid);
  insert into public.notifications (user_id, title, body, link)
  values (p_user,
          '📘 153 매뉴얼을 읽어 주세요',
          coalesce(v_by ->> 'name', '') || ' ' || coalesce(v_by ->> 'title', '') || '님이 보냈어요'
            || case when p_left is not null and p_left > 0 then ' · 남은 장 ' || least(p_left, 99) || '개' else '' end
            || ' · 한 장에 3–6분',
          '/office?tab=manual');
  return 'sent';
end $$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public._coach_manual_reads_json(uuid, text) from public, anon, authenticated;

revoke all on function public.coach_manual_book(text) from public, anon;
revoke all on function public.coach_manual_me(text) from public, anon;
revoke all on function public.coach_manual_sign(text, text, int, int) from public, anon;
revoke all on function public.coach_manual_board(text, text) from public, anon;
revoke all on function public.coach_manual_nudge(text, uuid, int) from public, anon;

grant execute on function public.coach_manual_book(text) to authenticated;
grant execute on function public.coach_manual_me(text) to authenticated;
grant execute on function public.coach_manual_sign(text, text, int, int) to authenticated;
grant execute on function public.coach_manual_board(text, text) to authenticated;
grant execute on function public.coach_manual_nudge(text, uuid, int) to authenticated;
