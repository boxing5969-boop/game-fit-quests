-- 마일리지 규칙을 저장하면 '153 레코드' 금액이 빠지던 문제 고침 (2026-10-28)
--   10/24 관리자 설정 화면에서 마일리지 규칙을 저장하자 set_app_setting 이 화면에 있는 네 칸(사용 · 출석 · 레벨업 · 타이틀매치)만
--   남기고 'record'(153 레코드 최초 기록 10,000 — 2026-10-16 대표님 "최초 레코드 달성 시 마일리지 지급")를 지웠다.
--   그 뒤로 새로 새겨지는 153 레코드에는 마일리지도 알림도 나가지 않았다(records_153_reward_trg 가 금액 0 이면 아무것도 안 함).
--   · set_app_setting: mileage_rules 에 'record'(0 ~ 100,000 정수, 보내지 않아도 됨) 허용 + 보내지 않은 칸은 앞 값을 그대로 둔다
--   · 빠진 'record' 10,000 을 되살린다 (2026-10-16 대표님 결정 그대로 — 20261016010000 과 같은 줄)
--   · 설정 화면(MileageSettingsCard)에 '153 레코드' 칸을 더해 금액이 보이고 바꿀 수 있게 한다 (같은 커밋)
-- DB 의 지금 정의(10/28 00:4x KST 에 읽음) 위에 mileage_rules 갈래만 고쳤다 — launch_event · welcome_letters 는 그대로.

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
  v_prev jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    raise exception '권한이 없습니다';
  end if;
  -- app_settings 는 TV(anon)도 읽는다 → 정해진 키만 쓴다.
  if _key is null or _key not in ('launch_event', 'welcome_letters', 'mileage_rules') then
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
  elsif _key = 'mileage_rules' then
    -- { enabled: bool, attendance: 정수, level_up: 정수, title_match: 정수, record?: 정수 } — since 는 서버가 정한다.
    for v_field in select jsonb_object_keys(_value) loop
      if v_field not in ('enabled', 'attendance', 'level_up', 'title_match', 'record', 'since') then
        raise exception '알 수 없는 마일리지 항목입니다: %', v_field;
      end if;
    end loop;
    if jsonb_typeof(_value -> 'enabled') is distinct from 'boolean' then
      raise exception '마일리지 적립 사용 여부를 정해 주세요';
    end if;
    foreach v_field in array array['attendance', 'level_up', 'title_match', 'record'] loop
      if v_field = 'record' and not (_value ? 'record') then
        continue;
      end if;
      if jsonb_typeof(_value -> v_field) is distinct from 'number'
         or (_value ->> v_field)::numeric <> trunc((_value ->> v_field)::numeric)
         or (_value ->> v_field)::numeric < 0
         or (_value ->> v_field)::numeric > 100000 then
        raise exception '마일리지는 0 ~ 100,000 사이의 정수로 입력해 주세요 (%)', v_field;
      end if;
    end loop;
    -- 켜져 있던 동안의 시작 시각은 유지하고, 꺼져 있다가 켜면 지금부터 적립한다(소급 없음).
    -- 보내지 않은 칸(예: 예전 화면이 모르는 record)은 앞 값을 그대로 둔다 (2026-10-28).
    select s.value into v_prev from public.app_settings s where s.key = 'mileage_rules';
    _value := (coalesce(v_prev, '{}'::jsonb) - 'since') || (_value - 'since') || jsonb_build_object('since',
      coalesce(case when coalesce((v_prev ->> 'enabled')::boolean, false) then v_prev ->> 'since' end,
               to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), v_uid)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'key', _key, 'value', _value);
end;
$function$;

-- 빠진 153 레코드 마일리지 10,000 되살리기 (2026-10-16 대표님 결정)
update public.app_settings
   set value = value || jsonb_build_object('record', 10000), updated_at = now()
 where key = 'mileage_rules' and not (value ? 'record');
