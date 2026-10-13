-- 🥊 붕대 감기 — 집 연습 미션 + 훈련 라이브러리 '복싱 붕대 감기' 항목 (2026-10-13 대표님)
--
-- 신규 회원 첫날: 코치님은 한 손만 빠르게 감아 주고, 다른 손은 회원이 앱(붕대 감기 화면)을 보며 직접 감는다.
-- 그리고 '집에서 혼자 감아 보기' 미션 — 감아 본 날 '오늘 감아 봤어요'(하루 한 번, 한국 날짜).
-- 목표 일수를 채우면 챔피언 머니를 한 번만 준다. 목표·보상 숫자는 아래 두 함수가 정본 (앱 화면은 받은 값만 보여 준다).
--
-- 지갑은 grant_gems() 로만 움직인다 (직접 update 금지 규칙). 기록 테이블은 함수로만 쓴다 (insert 정책 없음).
-- 지도진(profiles.is_staff)은 기록은 되지만 보상은 0 — 신규 회원용 미션이다.

-- ── 숫자 정본 ─────────────────────────────────────────────
create or replace function public.handwrap_practice_goal()
returns integer
language sql
immutable
set search_path = public
as $$ select 3 $$;

create or replace function public.handwrap_practice_reward()
returns integer
language sql
immutable
set search_path = public
as $$ select 300 $$;

-- ── 기록 ─────────────────────────────────────────────────
-- auth.users 와 FK 를 걸지 않는다 — 출석 기록(attendance_logs)처럼 계정 삭제를 막지 않는 기록 테이블이고,
-- 쓰기는 아래 함수가 auth.uid() 로만 한다.
create table if not exists public.handwrap_practice_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  practiced_on date not null,
  created_at timestamptz not null default now(),
  constraint handwrap_practice_logs_user_day_key unique (user_id, practiced_on)
);

alter table public.handwrap_practice_logs enable row level security;

do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'handwrap_practice_logs'
                   and policyname = 'handwrap_practice_logs_own_read') then
    create policy handwrap_practice_logs_own_read on public.handwrap_practice_logs
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$p$;

-- 보상은 사람당 한 번 — user_id 가 기본키라 두 번 들어갈 수 없다 (동시에 눌러도 한 번)
create table if not exists public.handwrap_practice_rewards (
  user_id uuid primary key,
  amount integer not null,
  granted_at timestamptz not null default now()
);

alter table public.handwrap_practice_rewards enable row level security;

do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'handwrap_practice_rewards'
                   and policyname = 'handwrap_practice_rewards_own_read') then
    create policy handwrap_practice_rewards_own_read on public.handwrap_practice_rewards
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$p$;

-- 이 회원이 받을 보상 — 지도진이면 0
create or replace function public.handwrap_practice_reward_for(_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from profiles where user_id = _user_id and is_staff is true) then 0
    else handwrap_practice_reward()
  end
$$;

revoke all on function public.handwrap_practice_reward_for(uuid) from public, anon, authenticated;

-- ── 내 기록 ───────────────────────────────────────────────
create or replace function public.get_my_handwrap_practice()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_days integer;
  v_has_today boolean;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select count(*)::integer, coalesce(bool_or(practiced_on = v_today), false)
    into v_days, v_has_today
    from handwrap_practice_logs
   where user_id = v_uid;

  return jsonb_build_object(
    'success', true,
    'days', v_days,
    'today', v_has_today,
    'goal', handwrap_practice_goal(),
    'reward', handwrap_practice_reward_for(v_uid),
    'rewarded', exists (select 1 from handwrap_practice_rewards where user_id = v_uid)
  );
end;
$$;

-- ── '오늘 감아 봤어요' ────────────────────────────────────
create or replace function public.log_handwrap_practice()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_goal integer := handwrap_practice_goal();
  v_reward integer := handwrap_practice_reward_for(auth.uid());
  v_inserted boolean;
  v_granted boolean;
  v_days integer;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  -- 하루 한 번 — 같은 날 다시 누르면 RETURNING 이 비어 v_inserted 가 NULL
  insert into handwrap_practice_logs (user_id, practiced_on)
  values (v_uid, v_today)
  on conflict (user_id, practiced_on) do nothing
  returning true into v_inserted;

  select count(*)::integer into v_days from handwrap_practice_logs where user_id = v_uid;

  if v_goal > 0 and v_reward > 0 and v_days >= v_goal then
    insert into handwrap_practice_rewards (user_id, amount)
    values (v_uid, v_reward)
    on conflict (user_id) do nothing
    returning true into v_granted;

    if v_granted then
      perform grant_gems(v_uid, v_reward, '붕대 감기 집 연습 완료');
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_today', v_inserted is null,
    'days', v_days,
    'goal', v_goal,
    'reward', v_reward,
    'granted', coalesce(v_granted, false),
    'rewarded', exists (select 1 from handwrap_practice_rewards where user_id = v_uid)
  );
end;
$$;

-- ── 코치·관장 — 회원 한 명의 기록 (회원 상세 화면) ─────────────
-- 본인 · 관리자 · 담당 코치 · 같은 지점의 코치/지점장만. 아니면 success:false.
create or replace function public.get_member_handwrap_practice(_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_days integer;
  v_last date;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if _member_id is null then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if not coalesce((
    v_uid = _member_id
    or has_role(v_uid, 'super_admin')
    or has_role(v_uid, 'admin')
    or is_coach_of(v_uid, _member_id)
    or (
      (has_role(v_uid, 'branch_manager') or has_role(v_uid, 'coach'))
      and exists (
        select 1
          from profiles me
          join profiles m on m.branch_name = me.branch_name
         where me.user_id = v_uid
           and m.user_id = _member_id
           and me.branch_name is not null
      )
    )
  ), false) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select count(*)::integer, max(practiced_on)
    into v_days, v_last
    from handwrap_practice_logs
   where user_id = _member_id;

  return jsonb_build_object(
    'success', true,
    'days', v_days,
    'goal', handwrap_practice_goal(),
    'last_on', v_last,
    'rewarded', exists (select 1 from handwrap_practice_rewards where user_id = _member_id)
  );
end;
$$;

revoke all on function public.get_my_handwrap_practice() from public, anon;
revoke all on function public.log_handwrap_practice() from public, anon;
revoke all on function public.get_member_handwrap_practice(uuid) from public, anon;
grant execute on function public.get_my_handwrap_practice() to authenticated;
grant execute on function public.log_handwrap_practice() to authenticated;
grant execute on function public.get_member_handwrap_practice(uuid) to authenticated;

-- ── 훈련 라이브러리 '준비' 칸 — 영상 URL 은 코치·관장이 화면에서 넣는다 ──
-- 앱의 붕대 감기 화면이 이 이름으로 영상을 찾는다 (src/data/handWrapGuide.ts HANDWRAP_EXERCISE_NAME).
insert into public.training_exercises
  (category, name, summary, description, benefits, target, difficulty, cues, mistakes, sort_order, is_active)
select
  '준비',
  '복싱 붕대 감기',
  '수업 전 손목과 주먹 마디를 지키는 붕대 감는 법 — 그림 8단계는 메뉴 ‘붕대 감기’',
  E'① 엄지에 고리를 걸고 손등 쪽으로 넘겨 시작\n② 손목 3바퀴\n③ 손등을 비스듬히 올라가 주먹 마디 3바퀴 (손가락을 편 채로)\n④ 손등을 반대로 내려와 손목 1바퀴 — 손등에 X자\n⑤ 손가락 사이 3곳(새끼–약지, 약지–중지, 중지–검지)을 지나 매번 손목으로\n⑥ 엄지 뿌리를 한 바퀴 감아 고정\n⑦ 주먹 마디 1~2바퀴 더\n⑧ 남은 붕대는 손목에 감고 벨크로로 마무리\n\n그림으로 따라 하기와 집 연습 미션은 전체 메뉴 → ‘붕대 감기’에서 볼 수 있어요.',
  '손목이 꺾이지 않게 받치고, 주먹 마디에 오는 충격을 덜어 줘요.',
  '손목·주먹 마디 보호',
  '초급',
  '["손가락을 쫙 편 채로 감기", "손목은 단단하게 — 손끝이 저리면 풀고 다시", "첫날 코치는 한 손만 빠르게, 다른 손은 회원이 앱을 보며 직접", "다음 수업 때 혼자 감는지 확인"]'::jsonb,
  '["주먹을 쥔 채로 마디를 감음", "너무 세게 감아 손끝이 저림", "손목을 한두 바퀴만 감음", "붕대가 꼬이거나 주름진 채로 감음"]'::jsonb,
  0,
  true
where not exists (select 1 from public.training_exercises where name = '복싱 붕대 감기');
