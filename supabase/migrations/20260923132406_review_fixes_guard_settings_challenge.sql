-- 2026-09-23 BOXER 풀파워 검수 후속 ② — 프로필 가드 · 설정 키 · 챌린지 기록 검증 · KST 경계
-- 확정 발견: H6 회원이 자기 branch_name 을 직접 PATCH · M1 staff_source 우회 · H7 버피/체력 자기신고 무제한
--           app_settings 임의 키 · get_branch_stats UTC 주/일 경계 · 지도진 해제 안내 시각 오류
--
-- 1) guard_profile_privileged_columns v3 : staff_source · 소속 지점(처음 정한 뒤) · 닉네임 12자 제한
-- 2) set_app_setting v2 : 키 허용 목록(launch_event · welcome_letters) + 웰컴 편지 형식 검사
-- 3) submit_boxing_fun_challenge_attempt v2 : 기록 범위·정수 검사(NaN/Infinity 거부), 하루 30회, 보상 한도 KST 0시 기준
-- 4) get_branch_stats : 이번 주 레벨업·오늘 제출을 KST 기준으로
-- 5) set_staff_designation : 153OS 명단 지도진 해제 안내 문구 (매시 25분 동기화)

-- ── 1) 프로필 가드 v3 ──────────────────────────────────────────
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- auth.uid() 가 없으면 service_role/서버 경로(동기화·결제 콜백·자격 변경 함수) → 그대로.
  if auth.uid() is null then return new; end if;
  if public.has_role(auth.uid(), 'admin')
     or public.has_role(auth.uid(), 'super_admin')
     or public.has_role(auth.uid(), 'branch_manager') then
    return new;
  end if;
  if new.is_approved is distinct from old.is_approved
     and coalesce(new.is_approved, false) = true then
    raise exception '승인 상태는 직접 변경할 수 없습니다';
  end if;
  -- 2026-09-22: 지도진 표기·이용권·결제 누적은 회원이 직접 바꿀 수 없다.
  -- 2026-09-23 검수: staff_source(명단 출처)도 막는다 — '153os' 로 바꾸면 앱 해제가 막히고 동기화도 안 건드린다.
  if new.is_staff is distinct from old.is_staff
     or new.staff_title is distinct from old.staff_title
     or new.staff_source is distinct from old.staff_source
     or new.membership_end is distinct from old.membership_end
     or new.payment_total is distinct from old.payment_total
     or new.must_change_credentials is distinct from old.must_change_credentials then
    raise exception '이 항목은 직접 변경할 수 없습니다';
  end if;
  -- 2026-09-23 검수: 소속 지점은 처음 정할 때만(가입·지점 선택). 이후 이동은 '지점 이전 요청' → 지점장 승인.
  -- 지점별 TV 순위 · 같은 지점 1인 1좋아요 · 지점 커뮤니티가 모두 branch_name 을 믿는다.
  if coalesce(btrim(old.branch_name), '') <> ''
     and new.branch_name is distinct from old.branch_name then
    raise exception '소속 지점은 직접 바꿀 수 없습니다. 설정의 지점 이전 요청을 이용해 주세요';
  end if;
  -- 닉네임은 TV·순위에 그대로 나간다 — 바꿀 때 12자 이내.
  if new.nickname is distinct from old.nickname
     and char_length(btrim(coalesce(new.nickname, ''))) > 12 then
    raise exception '닉네임은 12자 이내로 정해 주세요';
  end if;
  -- 전화번호·등록일은 처음 채울 때만 (카톡/구글 가입 뒤 번호 입력 경로). 이후 변경은 데스크/연동 절차로.
  if old.phone_number is not null and new.phone_number is distinct from old.phone_number then
    raise exception '전화번호는 직접 변경할 수 없습니다. 지점에 문의해 주세요';
  end if;
  if old.gym_reg_date is not null and new.gym_reg_date is distinct from old.gym_reg_date then
    raise exception '등록일은 직접 변경할 수 없습니다';
  end if;
  return new;
end;
$function$;

-- ── 2) 앱 설정 저장 v2 ─────────────────────────────────────────
create or replace function public.set_app_setting(_key text, _value jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_aud text;
  v_field text;
  v_letter jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    raise exception '권한이 없습니다';
  end if;
  -- app_settings 는 TV(anon)도 읽는다 → 정해진 키만 쓴다.
  if _key is null or _key not in ('launch_event', 'welcome_letters') then
    raise exception '알 수 없는 설정입니다';
  end if;
  if _value is null or jsonb_typeof(_value) <> 'object' then
    raise exception '설정 형식이 올바르지 않습니다';
  end if;

  if _key = 'launch_event' then
    -- start_date 필수(YYYY-MM-DD), end_date 는 없거나 start 이후
    if (_value ->> 'start_date') is null or (_value ->> 'start_date')::date is null then
      raise exception '시작일이 필요합니다';
    end if;
    if (_value ->> 'end_date') is not null and (_value ->> 'end_date')::date < (_value ->> 'start_date')::date then
      raise exception '종료일은 시작일 이후여야 합니다';
    end if;
  elsif _key = 'welcome_letters' then
    -- { member?: {title, body, sign, cta}, coach?: {...} } — 빠진 대상은 앱 기본 편지를 쓴다.
    for v_aud in select jsonb_object_keys(_value) loop
      if v_aud not in ('member', 'coach') then
        raise exception '편지 대상은 회원(member)·코치(coach)만 가능합니다';
      end if;
      v_letter := _value -> v_aud;
      if jsonb_typeof(v_letter) <> 'object' then
        raise exception '편지 형식이 올바르지 않습니다';
      end if;
      for v_field in select jsonb_object_keys(v_letter) loop
        if v_field not in ('title', 'body', 'sign', 'cta') then
          raise exception '알 수 없는 편지 항목입니다: %', v_field;
        end if;
        if jsonb_typeof(v_letter -> v_field) <> 'string' then
          raise exception '편지 항목은 글자로 입력해 주세요: %', v_field;
        end if;
      end loop;
      if btrim(coalesce(v_letter ->> 'body', '')) = '' then
        raise exception '편지 본문을 입력해 주세요';
      end if;
      if char_length(coalesce(v_letter ->> 'title', '')) > 80
         or char_length(coalesce(v_letter ->> 'body', '')) > 3000
         or char_length(coalesce(v_letter ->> 'sign', '')) > 80
         or char_length(coalesce(v_letter ->> 'cta', '')) > 30 then
        raise exception '편지가 너무 깁니다 (제목 80자 · 본문 3000자 · 서명 80자 · 버튼 30자 이내)';
      end if;
    end loop;
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), v_uid)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'key', _key, 'value', _value);
end;
$function$;

-- ── 3) 챌린지 아레나 기록 v2 ───────────────────────────────────
create or replace function public.submit_boxing_fun_challenge_attempt(p_challenge_id uuid, p_difficulty text, p_submitted_value numeric, p_pain_check_passed boolean default true, p_note text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_c public.boxing_fun_challenges%rowtype;
  v_target numeric;
  v_cap numeric;
  v_status text;
  v_xp integer := 0;
  v_gems integer := 0;
  v_today_count integer;
  v_today_limit integer;
  v_daily_limit_reached boolean := false;
  v_today_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
  v_idem text;
  v_attempt_id uuid := gen_random_uuid();
  v_pain_required boolean;
  v_msg text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  if p_difficulty is null or p_difficulty not in ('beginner', 'normal', 'advanced') then
    raise exception '난이도를 다시 골라 주세요';
  end if;

  select * into v_c from public.boxing_fun_challenges where id = p_challenge_id;
  if not found or v_c.active = false then
    raise exception '지금은 도전할 수 없는 챌린지예요';
  end if;

  -- 2026-09-23 검수: 자기 신고 기록의 범위를 서버에서 막는다 (버피왕·체력왕 조작, NaN/Infinity 방지).
  --   rounds 는 15, minutes 는 60, 그 밖(개수·콤보)은 상급 목표 × 3 까지. 개수·콤보·라운드는 정수만.
  v_cap := case v_c.target_metric
             when 'rounds'  then 15
             when 'minutes' then 60
             else greatest(coalesce((v_c.difficulty_targets ->> 'advanced')::numeric, 0) * 3, 1)
           end;
  if p_submitted_value is null or not (p_submitted_value > 0 and p_submitted_value <= v_cap) then
    raise exception '기록은 0보다 크고 % 이하로 입력해 주세요', v_cap;
  end if;
  if v_c.target_metric in ('count', 'combos', 'rounds') and p_submitted_value <> trunc(p_submitted_value) then
    raise exception '개수는 정수로 입력해 주세요';
  end if;
  -- 하루 기록 30회 (연타·스크립트 방지). 정상 이용은 종목 9개 × 몇 번이면 충분하다.
  if (select count(*) from public.boxing_fun_challenge_attempts a
       where a.user_id = v_uid and a.created_at >= v_today_start) >= 30 then
    raise exception '오늘은 기록을 충분히 남겼어요. 내일 다시 도전해 주세요';
  end if;

  perform public.ensure_boxing_engagement_profile(v_uid);

  v_target := coalesce((v_c.difficulty_targets ->> p_difficulty)::numeric, 0);

  v_pain_required := array_length(v_c.pain_check_required, 1) is not null;

  -- pain check 실패 시 보상 0, status=rejected
  if v_pain_required and p_pain_check_passed = false then
    v_status := 'rejected';
    v_xp := 0; v_gems := 0;
    v_msg := '통증 체크 실패. 안전을 위해 오늘은 보상이 지급되지 않습니다.';
  else
    if p_submitted_value >= v_target and v_target > 0 then
      v_status := 'completed';
    else
      v_status := 'failed';
    end if;

    -- daily reward limit (KST 0시 기준)
    v_today_limit := case when v_c.high_intensity then 1 else 3 end;

    select count(*) into v_today_count
    from public.boxing_fun_challenge_attempts a
    where a.user_id = v_uid
      and a.challenge_id = p_challenge_id
      and a.status = 'completed'
      and a.quest_xp_granted > 0
      and a.created_at >= v_today_start;

    if v_today_count >= v_today_limit then
      v_daily_limit_reached := true;
    end if;

    if v_status = 'completed' and not v_daily_limit_reached then
      v_xp := coalesce(((v_c.rewards_by_difficulty -> p_difficulty) ->> 'quest_xp')::integer, 0);
      v_gems := coalesce(((v_c.rewards_by_difficulty -> p_difficulty) ->> 'gems')::integer, 0);
      v_msg := '챌린지 클리어! 오늘의 라운드가 기록되었습니다.';
    elsif v_status = 'completed' and v_daily_limit_reached then
      v_xp := 0; v_gems := 0;
      v_msg := '오늘 이 챌린지의 보상 한도를 모두 채웠습니다. 기록은 저장됩니다.';
    else
      v_xp := 0; v_gems := 0;
      v_msg := '아직 목표에 못 미쳤어요. 다시 한 번!';
    end if;
  end if;

  -- attempt insert
  insert into public.boxing_fun_challenge_attempts (
    id, user_id, challenge_id, difficulty, status,
    submitted_value, target_value, pain_check_passed, note,
    quest_xp_granted, gems_granted
  ) values (
    v_attempt_id, v_uid, p_challenge_id, p_difficulty, v_status,
    p_submitted_value, v_target, p_pain_check_passed, p_note,
    v_xp, v_gems
  );

  if v_xp > 0 or v_gems > 0 then
    v_idem := concat(
      'fun_challenge:',
      v_uid::text, ':',
      p_challenge_id::text, ':',
      v_attempt_id::text
    );

    insert into public.boxing_engagement_events (
      user_id, event_type, source_type, source_id, action,
      quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
    ) values (
      v_uid,
      'reward',
      'boxing_fun_challenge',
      p_challenge_id,
      'fun_challenge_completed',
      v_xp, v_gems, 0, v_idem,
      jsonb_build_object(
        'difficulty', p_difficulty,
        'attempt_id', v_attempt_id,
        'submitted_value', p_submitted_value,
        'target_value', v_target
      )
    )
    on conflict (user_id, idempotency_key) do nothing;

    if v_gems > 0 then
      perform public.grant_gems(v_uid, v_gems, concat('재미 챌린지: ', v_c.title));
    end if;
  end if;

  -- profile 누적
  update public.boxing_engagement_profiles
  set challenge_attempt_count = challenge_attempt_count + 1,
      challenge_clear_count = challenge_clear_count + case when v_status = 'completed' then 1 else 0 end,
      quest_xp = quest_xp + v_xp
  where user_id = v_uid;

  return jsonb_build_object(
    'success', true,
    'status', v_status,
    'target_value', v_target,
    'submitted_value', p_submitted_value,
    'daily_limit_reached', v_daily_limit_reached,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'message', v_msg
  );
end;
$function$;

-- ── 4) 지점 통계 (KST 주·일) ───────────────────────────────────
create or replace function public.get_branch_stats(_branch_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  _total_members int;
  _pending_count int;
  _weekly_levelups int;
  _today_submissions int;
  _week_start timestamptz := (date_trunc('week', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  _today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select count(*) into _total_members from profiles where branch_name = _branch_name and is_staff is not true;

  select count(*) into _pending_count
  from mission_submissions ms join profiles p on p.user_id = ms.user_id
  where p.branch_name = _branch_name and ms.status = 'pending';

  _pending_count := _pending_count + (
    select count(*) from quest_submissions qs join profiles p on p.user_id = qs.user_id
    where p.branch_name = _branch_name and qs.status::text = 'pending'
  );

  select count(*) into _weekly_levelups
  from xp_logs xl join profiles p on p.user_id = xl.user_id
  where p.branch_name = _branch_name and xl.created_at >= _week_start
    and xl.reason like '%레벨업%';

  select count(*) into _today_submissions
  from mission_submissions ms join profiles p on p.user_id = ms.user_id
  where p.branch_name = _branch_name and (ms.requested_at at time zone 'Asia/Seoul')::date = _today;

  return jsonb_build_object(
    'total_members', _total_members, 'pending_count', _pending_count,
    'weekly_levelups', _weekly_levelups, 'today_submissions', _today_submissions
  );
end;
$function$;

-- ── 5) 지도진 지정/해제 (안내 문구) ─────────────────────────────
create or replace function public.set_staff_designation(_user_id uuid, _is_staff boolean, _title text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _caller uuid := auth.uid();
  _p public.profiles%rowtype;
  _title_clean text := nullif(btrim(coalesce(_title, '')), '');
  _final_title text;
begin
  if _caller is null then
    raise exception '로그인이 필요합니다';
  end if;
  select * into _p from public.profiles where user_id = _user_id;
  if not found then
    raise exception '회원을 찾을 수 없습니다';
  end if;
  if not (public.has_role(_caller, 'super_admin') or public.has_role(_caller, 'admin')
          or (public.has_role(_caller, 'branch_manager') and public.is_same_branch(_user_id))) then
    raise exception '권한이 없습니다';
  end if;
  if length(coalesce(_title_clean, '')) > 20 then
    raise exception '직함은 20자 이내로 입력해 주세요';
  end if;

  if _is_staff then
    _final_title := coalesce(_title_clean, _p.staff_title, '코치');
    update public.profiles
       set is_staff = true,
           staff_title = _final_title,
           staff_source = coalesce(staff_source, 'manual'),
           membership_end = null,          -- 지도진 이용권은 무제한
           updated_at = now()
     where user_id = _user_id;
  else
    if _p.staff_source = '153os' then
      raise exception '153OS 직원 명단에 있는 지도진입니다. 153OS 명단에서 빼거나 비활성으로 바꾸면 매시 25분 동기화 때 자동 해제됩니다';
    end if;
    update public.profiles
       set is_staff = false,
           staff_title = null,
           staff_source = null,
           updated_at = now()
     where user_id = _user_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'user_id', _user_id, 'is_staff', _is_staff,
    'staff_title', case when _is_staff then _final_title else null end
  );
end;
$function$;
