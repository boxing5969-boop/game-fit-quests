-- 출석 직후 알림 (2026-10-10 대표님): 체육관 출석(도어)이 기록되면
-- 알림함 + 웹푸시(무료)로 "오늘 출석 완료" 알림. 챔피언 머니 일일 지급 블록과
-- 같은 조건이라 하루 1회만 간다. 알림을 누르면 앱(내 카드)이 열린다.
-- (mcp apply_migration 으로 운영 DB 적용 완료 — 이 파일은 기록용)
CREATE OR REPLACE FUNCTION public.attendance_base_xp_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  _base  int;
  _staff boolean;
  _rank  text;
  _level int;
  _rank_kr text;
begin
  if new.user_id is null then return null; end if;
  if new.checked_in_at is null or new.checked_in_at < now() - interval '3 days' then return null; end if;
  -- 중복 출석(짧은 간격 재태깅)은 보상 대상이 아니다
  if coalesce(new.is_duplicate, false) then return null; end if;

  select coalesce(is_staff, false) into _staff from public.profiles where user_id = new.user_id;
  if coalesce(_staff, false) then return null; end if;
  if not exists (select 1 from public.member_progress where user_id = new.user_id) then return null; end if;

  -- 챔피언 머니 +100: KST 기준 하루 1회 (XP 와 별개로 지급) + 출석 알림(웹푸시)
  if not exists (
    select 1 from public.wallet_transactions
     where user_id = new.user_id
       and reason = '체육관 출석 보상'
       and (created_at at time zone 'Asia/Seoul')::date
           = (new.checked_in_at at time zone 'Asia/Seoul')::date
  ) then
    perform public.grant_gems(new.user_id, 100, '체육관 출석 보상');

    select mp.current_rank::text, mp.current_level into _rank, _level
      from public.member_progress mp where mp.user_id = new.user_id;
    _rank_kr := case _rank when 'white' then '화이트' when 'blue' then '블루'
                           when 'red' then '레드' when 'black' then '블랙' else coalesce(_rank,'') end;
    perform public.create_notification(
      new.user_id,
      '오늘 출석 완료! 🥊 챔피언 머니 +100',
      '현재 ' || _rank_kr || ' 리그 Lv.' || coalesce(_level, 1) ||
      ' — 홈에서 내 카드와 이번 주 순위를 확인하세요');
  end if;

  -- 기본 운동 XP (기존 로직 그대로: 행당 1회, xp_granted 가드)
  if coalesce(new.xp_granted, 0) > 0 then return null; end if;

  _base := public.workout_xp(public.workout_default_minutes());
  if _base <= 0 then return null; end if;

  insert into public.xp_logs (user_id, amount, reason)
  values (new.user_id, _base, '운동 출석 (기본 ' || public.workout_default_minutes() || '분)');
  update public.member_progress set total_xp = total_xp + _base where user_id = new.user_id;
  update public.attendance_logs set xp_granted = _base where id = new.id;
  return null;
end;
$function$;
