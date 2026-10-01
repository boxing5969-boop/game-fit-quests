-- 📋 레벨별 일차 수업 매뉴얼 (2026-09-30 대표님)
--
-- 화이트 리그는 출석 3번 = 한 레벨 = 수업 3일. 대표님이 정한 일차별 수업 내용을 앱에 저장한다.
--   레벨 1 = 1~3일차, 레벨 2 = 4~6일차 (일단 6일차까지 — 이후 일차는 같은 표에 이어서 넣는다).
-- 회원은 '수업 루틴' 화면·훈련 탭에서 오늘(또는 다음) 수업을, 코치님은 전 일차 매뉴얼을 본다.
--
-- steps (jsonb 배열) 한 칸 = 수업 한 단계:
--   kind(warmup·step·punch·sandbag·strength) · name · amount(라운드·세트 — 대표님 표현 그대로)
--   · is_new(새로 배우는 동작) · how[](동작 설명) · watch[](주의할 점) · tip · video_mission_id(153 영상)
-- repeat_of_day: "2일차는 1일차 반복" 처럼 그날 내용을 앞날로 가리킨다 (그날 steps 는 비운다).
--
-- 오늘 몇 일차인지는 get_lesson_today() 가 서버에서 계산한다:
--   이번 레벨에서 출석한 날 수(get_level_cycle_progress 의 days 와 같은 식) → 오늘 왔으면 그날, 아직이면 다음 날.
--   3번째 출석은 체크인하는 순간 자동 승급되므로(auto_advance_from_attendance),
--   오늘 체크인으로 방금 올라갔다면 오늘 수업은 지난 레벨의 마지막 날로 본다.
-- 읽기는 로그인한 누구나(활성 행), 쓰기는 본사(super_admin·admin)만.

create table if not exists public.level_lesson_days (
  id uuid primary key default gen_random_uuid(),
  level smallint not null check (level between 1 and 40),
  day_in_level smallint not null check (day_in_level between 1 and 30),
  day_no smallint not null check (day_no between 1 and 1000),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  goal text not null default '' check (char_length(goal) <= 200),
  repeat_of_day smallint check (repeat_of_day is null or (repeat_of_day >= 1 and repeat_of_day < day_no)),
  steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 30),
  note text not null default '' check (char_length(note) <= 500),
  is_active boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_lesson_days_level_day_key unique (level, day_in_level),
  constraint level_lesson_days_day_no_key unique (day_no),
  constraint level_lesson_days_steps_or_repeat
    check (jsonb_array_length(steps) > 0 or repeat_of_day is not null)
);

comment on table public.level_lesson_days is
  '레벨별 일차 수업 매뉴얼 (대표님 원문). level=전역 레벨 1~40, day_no=전체 일차, repeat_of_day=그날 내용이 앞날 반복';

create or replace function public._lesson_days_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists level_lesson_days_touch on public.level_lesson_days;
create trigger level_lesson_days_touch
  before insert or update on public.level_lesson_days
  for each row execute function public._lesson_days_touch();

alter table public.level_lesson_days enable row level security;

drop policy if exists lesson_days_read on public.level_lesson_days;
create policy lesson_days_read on public.level_lesson_days
  for select to authenticated
  using (
    is_active
    or public.has_role((select auth.uid()), 'super_admin'::app_role)
    or public.has_role((select auth.uid()), 'admin'::app_role)
  );

drop policy if exists lesson_days_hq_write on public.level_lesson_days;
create policy lesson_days_hq_write on public.level_lesson_days
  for all to authenticated
  using (
    public.has_role((select auth.uid()), 'super_admin'::app_role)
    or public.has_role((select auth.uid()), 'admin'::app_role)
  )
  with check (
    public.has_role((select auth.uid()), 'super_admin'::app_role)
    or public.has_role((select auth.uid()), 'admin'::app_role)
  );

revoke all on public.level_lesson_days from anon;

-- 오늘(또는 다음) 수업 — 회원 본인, 또는 그 회원을 보는 본사·지점장·담당 코치
create or replace function public.get_lesson_today(_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _caller uuid := auth.uid();
  _rank rank_name;
  _cur int;
  _since timestamptz;
  _level int;
  _today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  _first_today timestamptz;
  _days int := 0;
  _promoted boolean := false;
  _lesson_level int;
  _want int;
  _day_in_level int;
  _day_no int;
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  if _user_id is null then raise exception 'no user'; end if;
  if _user_id is distinct from _caller
     and not (has_role(_caller, 'super_admin') or is_branch_manager_of(_caller, _user_id) or is_coach_of(_caller, _user_id)) then
    raise exception 'Not authorized';
  end if;

  select mp.current_rank, mp.current_level, mp.level_started_at
    into _rank, _cur, _since
    from member_progress mp
   where mp.user_id = _user_id;
  _rank := coalesce(_rank, 'white'::rank_name);
  _cur := least(greatest(coalesce(_cur, 1), 1), 10);
  _level := (case _rank::text when 'blue' then 10 when 'red' then 20 when 'black' then 30 else 0 end) + _cur;

  -- 오늘(KST) 첫 정식 출석 — 얼굴 인식·QR 모두 attendance_logs, 하루 1회(is_duplicate=false)
  select min(a.checked_in_at) into _first_today
    from attendance_logs a
   where a.user_id = _user_id
     and coalesce(a.is_duplicate, false) = false
     and a.checked_in_at >= _today_start;

  -- 이번 레벨에서 출석한 날 수 (get_level_cycle_progress 의 days 와 같은 식)
  select count(distinct ((a.checked_in_at at time zone 'Asia/Seoul')::date))::int into _days
    from attendance_logs a
   where a.user_id = _user_id
     and coalesce(a.is_duplicate, false) = false
     and a.checked_in_at >= coalesce(_since, now() - interval '3650 days');

  if _first_today is not null and _since is not null
     and _since >= _today_start and _first_today < _since and _level > 1 then
    -- 오늘 체크인으로 방금 승급 → 오늘 수업은 지난 레벨의 마지막 날
    _promoted := true;
    _lesson_level := _level - 1;
    _want := 1000;
  else
    _lesson_level := _level;
    _want := case when _first_today is not null then greatest(_days, 1) else _days + 1 end;
  end if;

  -- 그날이 저장돼 있으면 그날, 아니면 그 레벨에 저장된 가장 가까운 앞날 (그것도 없으면 첫날)
  select d.day_in_level, d.day_no into _day_in_level, _day_no
    from level_lesson_days d
   where d.level = _lesson_level and d.is_active and d.day_in_level <= _want
   order by d.day_in_level desc
   limit 1;
  if _day_no is null then
    select d.day_in_level, d.day_no into _day_in_level, _day_no
      from level_lesson_days d
     where d.level = _lesson_level and d.is_active
     order by d.day_in_level
     limit 1;
  end if;

  return jsonb_build_object(
    'current_level', _level,
    'level', case when _day_no is not null then _lesson_level end,
    'day_in_level', _day_in_level,
    'day_no', _day_no,
    'attended_today', _first_today is not null,
    'promoted_today', _promoted,
    'days_in_level', _days
  );
end;
$$;

revoke all on function public.get_lesson_today(uuid) from public, anon;
grant execute on function public.get_lesson_today(uuid) to authenticated;

-- 대표님 매뉴얼 1~6일차. 153 영상 연결은 제목으로 찾는다 (없으면 영상 버튼만 빠진다).
with v as (
  select
    coalesce((select to_jsonb(m.id::text) from public.missions m
               where m.title = '[복싱/잽] 4스텝 잽ㅣ리듬 스텝 위에서 옆 각도로 찌르는 잽' and m.is_active
               order by m.created_at limit 1), 'null'::jsonb)::text as v_4step,
    coalesce((select to_jsonb(m.id::text) from public.missions m
               where m.title = '[복싱/잽] 스텝 사이드 잽·방향전환ㅣ스텝으로 각 여는 잽' and m.is_active
               order by m.created_at limit 1), 'null'::jsonb)::text as v_side,
    coalesce((select to_jsonb(m.id::text) from public.missions m
               where m.title = '[복싱/잽] 백스텝 잽ㅣ잽 치고 빠졌다가 다시 찌르기' and m.is_active
               order by m.created_at limit 1), 'null'::jsonb)::text as v_back
),
src (level, day_in_level, day_no, title, goal, repeat_of_day, steps_text, note) as (
  values
  (1::smallint, 1::smallint, 1::smallint,
   '첫 수업 · 스텝·가드·잽·뒷손 카운터',
   '거울 앞에서 스텝 밸런스를 잡고, 가드·잽·뒷손 카운터를 정확한 자세로 배워요',
   null::smallint,
   $j$[
  {
    "kind": "warmup",
    "name": "워밍업 · 줄넘기",
    "amount": "2분 × 3라운드",
    "how": [
      "관절을 풀고 스트레칭한 뒤 줄넘기로 몸을 데워요",
      "코치님 지시에 따라 다른 워밍업으로 바꿀 수 있어요"
    ]
  },
  {
    "kind": "step",
    "name": "제자리 스텝",
    "amount": "2라운드 (최대 3라운드)",
    "how": [
      "거울 앞에서 대각선으로 서서 위아래로 스텝을 뛰어요",
      "처음 코치님에게 배운 대로, 어깨보다 조금 더 넓은 넓이로 뛰어요"
    ],
    "watch": [
      "다리 밸런스가 깨지면 안 돼요"
    ],
    "tip": "보통 2라운드 진행해요. 사람마다 운동신경이 달라 더 필요하면 최대 3라운드까지 해요"
  },
  {
    "kind": "step",
    "name": "4스텝",
    "amount": "1라운드 정도",
    "how": [
      "다리 밸런스가 잡히면 제자리에서 하나·둘·셋·넷, 네 번 뛰어요",
      "다리 밸런스를 유지한 채 대각선 방향으로 짧게 나갔다가 제자리로 돌아와요",
      "스텝은 하나·둘·셋·넷·다섯·여섯 — 여섯 동작이에요"
    ],
    "tip": "안정되면 복싱 가드로 넘어가요"
  },
  {
    "kind": "punch",
    "name": "가드 · 잽 (팔 동작)",
    "amount": "1라운드",
    "is_new": true,
    "how": [
      "가드 — 앞손은 가볍고 편안하게, 거울에 보이는 내 입 부분까지 올려요",
      "뒷손은 팔꿈치를 몸에 밀착해서 안쪽으로 올려요",
      "잽 — 앞손을 예비 동작 없이 직선으로 뻗고, 다시 제자리로 돌아와요",
      "주먹 너클 부분이 타격점에 맞도록 주먹 각도를 살짝 맞춰요"
    ],
    "tip": "이 라운드는 팔 동작만 연습해요"
  },
  {
    "kind": "punch",
    "name": "4스텝 잽",
    "amount": "2라운드",
    "is_new": true,
    "how": [
      "앞에서 배운 4스텝을 하고, 앞으로 스텝할 때 잽을 동시에 뻗어요",
      "4스텝 잽이 자연스럽게 될 때까지 연습해요"
    ],
    "video_mission_id": "@v_4step"
  },
  {
    "kind": "punch",
    "name": "제자리 스텝 잽",
    "amount": "2라운드",
    "is_new": true,
    "how": [
      "걷는 스텝 연습이에요 — 제자리에서 앞발과 앞손만 5cm 정도, 거의 제자리를 찍듯이 동시에 나갔다 들어와요",
      "앞손은 길게 뻗고, 앞발은 살짝만 찍고 와요"
    ],
    "watch": [
      "몸의 중심이 앞으로 너무 쏠리기 쉬워요 — 중심은 유지하고 주먹만 뻗어요",
      "연습하다 밸런스가 무너지면 거울 앞 선을 보면서 밸런스를 다시 잡고, 다시 뻗어요"
    ],
    "tip": "밸런스 잡고 → 다시 뻗기를 반복해요"
  },
  {
    "kind": "punch",
    "name": "뒷손 카운터",
    "amount": "3~5라운드",
    "is_new": true,
    "how": [
      "제자리에서 처음 배운 스탠스로 밸런스를 잡아요",
      "어깨와 허리, 뒷다리 앞꿈치를 들어 지면에 중심을 잡은 상태에서 빠르게 회전하며 뒷손을 직선으로 뻗어요",
      "뻗은 뒤 다시 제자리로 돌아와요"
    ],
    "watch": [
      "중심이 앞으로 쏠리면 안 돼요",
      "허리와 다리가 같이 회전해야 해요",
      "팔꿈치가 벌어지면 안 돼요 — 팔꿈치를 안쪽으로 모아 최소 동작으로 직선으로 뻗어요"
    ],
    "tip": "거울을 보면서, 강하게 치려고 하지 말고 자세를 정확하게. 자세가 안정될 때까지, 안정되면 숙달될 때까지 반복해요"
  },
  {
    "kind": "strength",
    "name": "기초 근력",
    "amount": "20개 × 3세트",
    "how": [
      "윗몸일으키기 20개 × 3세트",
      "푸시업 20개 × 3세트 (여성은 반동 푸시업)"
    ]
  }
]$j$,
   ''),
  (1::smallint, 2::smallint, 2::smallint,
   '1일차 반복 · 몸에 익히기',
   '1일차 수업을 같은 순서로 한 번 더 — 스텝과 잽·카운터를 몸에 익혀요',
   1::smallint,
   $j$[]$j$,
   ''),
  (1::smallint, 3::smallint, 3::smallint,
   '4라운드씩 다지기 + 샌드백',
   '4스텝 잽·제자리 스텝 잽·뒷손 카운터를 4라운드씩 반복하고, 배운 동작을 샌드백에서 연습해요',
   null::smallint,
   $j$[
  {
    "kind": "warmup",
    "name": "워밍업 · 줄넘기",
    "amount": "2분 × 3라운드",
    "how": [
      "관절을 풀고 스트레칭한 뒤 줄넘기로 몸을 데워요",
      "코치님 지시에 따라 다른 워밍업으로 바꿀 수 있어요"
    ]
  },
  {
    "kind": "punch",
    "name": "4스텝 잽",
    "amount": "4라운드",
    "how": [
      "4스텝 후 앞으로 스텝할 때 잽을 동시에 뻗어요"
    ],
    "video_mission_id": "@v_4step"
  },
  {
    "kind": "punch",
    "name": "제자리 스텝 잽",
    "amount": "4라운드",
    "how": [
      "앞발과 앞손만 5cm 정도 동시에 나갔다 들어와요",
      "중심은 유지하고 주먹만 뻗어요"
    ]
  },
  {
    "kind": "punch",
    "name": "뒷손 카운터",
    "amount": "4라운드",
    "how": [
      "허리와 다리를 회전하며 뒷손을 직선으로 뻗고 제자리로",
      "팔꿈치는 안쪽으로 모으고, 중심이 앞으로 쏠리지 않게"
    ]
  },
  {
    "kind": "sandbag",
    "name": "샌드백",
    "amount": "4라운드",
    "how": [
      "지금까지 배운 동작을 샌드백에서 연습해요"
    ]
  },
  {
    "kind": "strength",
    "name": "기초 근력",
    "amount": "20개 × 3세트",
    "how": [
      "윗몸일으키기 20개 × 3세트",
      "푸시업 20개 × 3세트 (여성은 반동 푸시업)"
    ]
  }
]$j$,
   '레벨 1 수업 끝 — 이렇게 3일 훈련하면 레벨 2로 넘어가요'),
  (2::smallint, 1::smallint, 4::smallint,
   '사이드 스텝 잽 · 백스텝 잽 배우기',
   '153 영상의 사이드 스텝 잽을 새로 배우고, 익숙해지면 백스텝 잽까지 연습해요',
   null::smallint,
   $j$[
  {
    "kind": "warmup",
    "name": "워밍업 · 줄넘기",
    "amount": "2분 × 3라운드",
    "how": [
      "관절을 풀고 스트레칭한 뒤 줄넘기로 몸을 데워요",
      "코치님 지시에 따라 다른 워밍업으로 바꿀 수 있어요"
    ]
  },
  {
    "kind": "punch",
    "name": "4스텝 잽",
    "amount": "3라운드",
    "how": [
      "4스텝 후 앞으로 스텝할 때 잽을 동시에 뻗어요"
    ],
    "video_mission_id": "@v_4step"
  },
  {
    "kind": "punch",
    "name": "제자리 스텝 잽",
    "amount": "3라운드",
    "how": [
      "앞발과 앞손만 5cm 정도 동시에 나갔다 들어와요",
      "중심은 유지하고 주먹만 뻗어요"
    ]
  },
  {
    "kind": "punch",
    "name": "사이드 스텝 잽",
    "amount": "4라운드",
    "is_new": true,
    "how": [
      "우리 153 영상에 나오는 사이드 스텝 잽을 새로 배워요"
    ],
    "video_mission_id": "@v_side"
  },
  {
    "kind": "punch",
    "name": "백스텝 잽",
    "amount": "2라운드",
    "is_new": true,
    "how": [
      "사이드 스텝 잽이 익숙해지면 백스텝 잽을 연습해요"
    ],
    "video_mission_id": "@v_back"
  },
  {
    "kind": "sandbag",
    "name": "자율 샌드백",
    "amount": "4라운드",
    "how": [
      "배운 동작으로 자유롭게 샌드백을 쳐요"
    ]
  },
  {
    "kind": "strength",
    "name": "기초 근력",
    "amount": "20개 × 3세트",
    "how": [
      "스쿼트 20개 × 3세트",
      "푸시업 20개 × 3세트 (여성은 반동 푸시업)",
      "윗몸일으키기 20개 × 3세트"
    ]
  }
]$j$,
   ''),
  (2::smallint, 2::smallint, 5::smallint,
   '4일차 반복 · 사이드 스텝 잽 익히기',
   '4일차 프로그램을 똑같이 한 번 더 — 사이드 스텝 잽과 백스텝 잽을 몸에 익혀요',
   4::smallint,
   $j$[]$j$,
   ''),
  (2::smallint, 3::smallint, 6::smallint,
   '원투 배우기 + 샌드백 5라운드',
   '원투를 한 동작처럼 — 중심은 가운데. 배운 잽·카운터를 모두 복습해요',
   null::smallint,
   $j$[
  {
    "kind": "warmup",
    "name": "워밍업 · 줄넘기",
    "amount": "2분 × 3라운드",
    "how": [
      "관절을 풀고 스트레칭한 뒤 줄넘기로 몸을 데워요",
      "코치님 지시에 따라 다른 워밍업으로 바꿀 수 있어요"
    ]
  },
  {
    "kind": "punch",
    "name": "4스텝 잽",
    "amount": "2라운드",
    "how": [
      "4스텝 후 앞으로 스텝할 때 잽을 동시에 뻗어요"
    ],
    "video_mission_id": "@v_4step"
  },
  {
    "kind": "punch",
    "name": "제자리 스텝 잽",
    "amount": "2라운드",
    "how": [
      "앞발과 앞손만 5cm 정도 동시에 나갔다 들어와요",
      "중심은 유지하고 주먹만 뻗어요"
    ]
  },
  {
    "kind": "punch",
    "name": "사이드 스텝 잽",
    "amount": "2라운드",
    "how": [
      "4일차에 배운 사이드 스텝 잽 — 영상 동작 그대로"
    ],
    "video_mission_id": "@v_side"
  },
  {
    "kind": "punch",
    "name": "백스텝 잽",
    "amount": "2라운드",
    "how": [
      "4일차에 배운 백스텝 잽 — 영상 동작 그대로"
    ],
    "video_mission_id": "@v_back"
  },
  {
    "kind": "punch",
    "name": "뒷손 카운터",
    "amount": "2라운드",
    "how": [
      "허리와 다리를 회전하며 뒷손을 직선으로 뻗고 제자리로",
      "팔꿈치는 안쪽으로 모으고, 중심이 앞으로 쏠리지 않게"
    ]
  },
  {
    "kind": "punch",
    "name": "원투",
    "amount": "4라운드",
    "is_new": true,
    "how": [
      "원투는 스텝을 사용해요 — 원(잽)이 상대에게 맞으면 바로 투를 뻗어요",
      "하나·둘 동작을 한 동작처럼 하는 게 포인트예요"
    ],
    "watch": [
      "중심은 가운데 — 과도하게 앞으로 쏠리거나 뒤로 쏠리면 안 돼요"
    ],
    "tip": "중심에 있어야 상대가 안 맞아도 다시 공격하고, 주먹이 날아오면 피할 수 있어요"
  },
  {
    "kind": "sandbag",
    "name": "샌드백",
    "amount": "5라운드",
    "how": [
      "배운 펀치 동작을 샌드백에서 연습해요"
    ]
  },
  {
    "kind": "strength",
    "name": "기초 근력",
    "amount": "20개 × 3세트",
    "how": [
      "스쿼트 20개 × 3세트",
      "푸시업 20개 × 3세트 (여성은 반동 푸시업)",
      "윗몸일으키기 20개 × 3세트"
    ]
  }
]$j$,
   '레벨 2 수업 끝 — 이렇게 3일 훈련하면 레벨 3으로 넘어가요')
)
insert into public.level_lesson_days (level, day_in_level, day_no, title, goal, repeat_of_day, steps, note)
select s.level, s.day_in_level, s.day_no, s.title, s.goal, s.repeat_of_day,
       replace(replace(replace(s.steps_text,
         '"@v_4step"', v.v_4step),
         '"@v_side"', v.v_side),
         '"@v_back"', v.v_back)::jsonb,
       s.note
  from src s
 cross join v
on conflict (level, day_in_level) do nothing;