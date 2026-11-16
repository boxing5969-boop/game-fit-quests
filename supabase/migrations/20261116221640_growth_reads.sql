-- 🌱 오늘의 1분 성장 — 읽음 기록 (1단계 · 2026-11-16 대표님 「다음」)
--   보고서 https://claude.ai/artifact/5tVEQmxgmzABfNwZaHibtq — 결정 ④ 「읽기 보상 없이 누적 도장 · 축하 편지만」
--
--   새 표 1 · 새 함수 1 — 기존 표 · 함수 · 예약은 건드리지 않는다. 줄을 지우는 문장은 없다.
--   홈 카드(GrowthLessonCard)가 보이지 않게 부른다:
--     글을 열 때 open · O/X 를 고를 때 quiz · 「오늘 하나 해 볼게요」 act · 좋아요 heart_on / heart_off
--   답 = {ok, hearts} — hearts 는 그 글에 좋아요를 누른 회원 수, **5명이 넘을 때만**(작은 숫자는 서버 밖으로 안 나간다).
--   보상이 없어서 O/X 를 맞혔는지는 화면이 보낸 값을 그대로 적는다(글과 정답은 앱 안에만 있다).
--   읽는 함수(내 누적 도장 · 운동 달력 저절로 체크 · 월요일 요약)는 2단계에서 만든다.
--   화면은 이 함수가 없는 DB(적용 전 · 옛 DB 미리보기)에서도 그대로 돈다 — 기록만 안 남는다.

create table if not exists public.growth_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 글 이름 (앱 src/data/growth/*.ts 의 id)
  lesson_id text not null,
  -- 그 글이 '오늘의 글'인 날 (앱의 from)
  lesson_date date not null,
  -- 처음 연 날 · 연 날 수(하루에 여러 번 열어도 1) · 마지막으로 연 날 — 한국 날짜
  opened_on date not null,
  open_days integer not null default 1,
  last_opened_on date not null,
  -- O/X 에서 처음 고른 답 (다시 골라도 처음 것만 남는다)
  quiz_pick text,
  quiz_right boolean,
  quiz_at timestamptz,
  -- 「오늘 하나 해 볼게요」를 처음 누른 날
  acted_on date,
  -- 좋아요
  heart boolean not null default false,
  heart_at timestamptz,
  -- 처음 남길 때의 회원 여부(코치님 · 운영진 · 체험 계정은 false) · 지점 — 합계는 회원 줄만 센다
  member boolean not null default false,
  branch_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_reads_pkey primary key (user_id, lesson_id),
  constraint growth_reads_lesson_id_chk check (lesson_id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  constraint growth_reads_open_days_chk check (open_days between 1 and 1000),
  constraint growth_reads_quiz_chk check (quiz_pick is null or quiz_pick in ('O', 'X'))
);

create index if not exists growth_reads_lesson_idx on public.growth_reads (lesson_date, lesson_id);
-- 좋아요 수(회원 줄만) 세기
create index if not exists growth_reads_heart_idx on public.growth_reads (lesson_id) where heart and member;

comment on table public.growth_reads is '오늘의 1분 성장 읽음 기록 — 사람 · 글마다 한 줄. growth_mark 로만 쓴다.';

alter table public.growth_reads enable row level security;
revoke all on table public.growth_reads from public, anon, authenticated;

create or replace function public.growth_mark(
  p_lesson text,
  p_date date,
  p_kind text,
  p_pick text default null,
  p_right boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_lesson text := btrim(coalesce(p_lesson, ''));
  v_kind text := btrim(coalesce(p_kind, ''));
  v_pick text := upper(btrim(coalesce(p_pick, '')));
  v_no constant jsonb := jsonb_build_object('ok', false);
  v_n integer;
  v_has_row boolean := true;
begin
  if v_uid is null then return v_no; end if;
  if v_kind not in ('open', 'quiz', 'act', 'heart_on', 'heart_off') then return v_no; end if;
  if v_lesson !~ '^[a-z0-9][a-z0-9-]{1,39}$' then return v_no; end if;
  -- 글의 날: 첫 글(2026-10-27)부터 내일까지 (기기 시계가 조금 달라도 받게 하루 여유)
  if p_date is null or p_date < date '2026-10-27' or p_date > v_today + 1 then return v_no; end if;
  if v_kind = 'quiz' and v_pick not in ('O', 'X') then return v_no; end if;
  if not public._is_active_member(v_uid) then return v_no; end if;

  -- ① 줄이 없으면 만든다 (좋아요 취소만으로는 새 줄을 만들지 않는다)
  if not exists (select 1 from public.growth_reads r where r.user_id = v_uid and r.lesson_id = v_lesson) then
    if v_kind = 'heart_off' then
      v_has_row := false;
    else
      -- 새 줄 한도 — 하루 40줄 · 사람마다 2,000줄 (오늘 글 + 지난 7일이면 하루 8줄)
      select count(*) into v_n from public.growth_reads r
       where r.user_id = v_uid and r.created_at >= now() - interval '24 hours';
      if v_n >= 40 then return v_no; end if;
      select count(*) into v_n from public.growth_reads r where r.user_id = v_uid;
      if v_n >= 2000 then return v_no; end if;

      insert into public.growth_reads (user_id, lesson_id, lesson_date, opened_on, last_opened_on, member, branch_name)
      values (v_uid, v_lesson, p_date, v_today, v_today, public._is_rankable_member(v_uid),
              (select p.branch_name from public.profiles p where p.user_id = v_uid))
      on conflict (user_id, lesson_id) do nothing;
    end if;
  end if;

  -- ② 그 줄에 적는다 (방금 만든 줄은 last_opened_on = 오늘이라 연 날 수가 늘지 않는다)
  if v_has_row then
    update public.growth_reads r set
        open_days = case when v_kind = 'open' and r.last_opened_on < v_today then least(r.open_days + 1, 1000) else r.open_days end,
        last_opened_on = case when v_kind = 'open' and r.last_opened_on < v_today then v_today else r.last_opened_on end,
        quiz_pick = case when v_kind = 'quiz' and r.quiz_pick is null then v_pick else r.quiz_pick end,
        quiz_right = case when v_kind = 'quiz' and r.quiz_pick is null then p_right else r.quiz_right end,
        quiz_at = case when v_kind = 'quiz' and r.quiz_pick is null then now() else r.quiz_at end,
        acted_on = case when v_kind = 'act' then coalesce(r.acted_on, v_today) else r.acted_on end,
        heart = case when v_kind = 'heart_on' then true when v_kind = 'heart_off' then false else r.heart end,
        heart_at = case when v_kind in ('heart_on', 'heart_off') then now() else r.heart_at end,
        updated_at = now()
     where r.user_id = v_uid and r.lesson_id = v_lesson;
  end if;

  -- 좋아요 수 — 회원 줄만 · 5명이 넘을 때만 (그 아래는 null)
  select count(*) into v_n from public.growth_reads r where r.lesson_id = v_lesson and r.heart and r.member;
  return jsonb_build_object('ok', true, 'hearts', case when v_n > 5 then v_n end);
end $$;

comment on function public.growth_mark(text, date, text, text, boolean) is
  '오늘의 1분 성장 읽음 기록 — 본인 줄만(open · quiz · act · heart_on · heart_off). 답 {ok, hearts(5명 넘을 때만)}. 보상 없음.';

revoke all on function public.growth_mark(text, date, text, text, boolean) from public, anon;
grant execute on function public.growth_mark(text, date, text, text, boolean) to authenticated;
