-- 커뮤니티 1단계 켜기 (2026-10-27 23:45 대표님 "올려" — 미리보기 preview/community 확인 뒤 실제 앱에 합침)
--
-- 1) 출석 알림 — 오삼코치 칭찬이 없는 갈래: 누르면 커뮤니티로 (/myboxer/community — 맨 위 '오늘도 한 판')
--    · 앱에서 숨겨 둔 지점(branches.is_visible = false — 홈 '오늘 우리 체육관' 띠도 안 보이는 지점)은 예전 그대로
--      (링크 없음 · '홈에서 내 카드와 이번 주 순위를 확인하세요')
--    · 오삼코치 칭찬 갈래(/character-studio?coach=…) · 챔피언 머니 +100(하루 한 번) · 기본 운동 XP 는 그대로
--    · DB 의 지금 정의(10/27 23:50 KST 에 읽음) 위에 고침. create_notification(uuid,text,text) 은 링크 칸이 없어
--      같은 insert 를 직접 쓴다(create_notification 도 notifications 에 넣기만 한다)
-- 2) 153 · 댓글 · 월요일 숫자 알림 스위치 켜기 — internal_sync_config.community_notify_since = 켠 시각(UTC ISO)
--    켠 뒤에 눌린 153 · 남긴 댓글만 알림 대상 · 휴대폰은 평일 08~22시 · 하루 3번까지 (20261027231653_community_phase1.sql)
--    끄려면 value 를 'off' 로.

create or replace function public.attendance_base_xp_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  _base  int;
  _staff boolean;
  _rank  text;
  _level int;
  _rank_kr text;
  _coach_id uuid;
  _coach_body text;
  _nid uuid;
  _coach_done boolean := false;
  _community boolean := false;
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

    -- 🥊 오삼코치 출석 칭찬 (2026-10-15)
    begin
      select m.id, m.body into _coach_id, _coach_body
        from public.coach_messages m
       where m.user_id = new.user_id
         and m.kind = 'attendance_praise'
         and m.for_date = (new.checked_in_at at time zone 'Asia/Seoul')::date
         and m.status = 'approved'
       limit 1
       for update skip locked;
      if _coach_id is not null then
        _nid := gen_random_uuid();
        insert into public.notifications (id, user_id, title, body, link)
        values (_nid, new.user_id, '오늘 출석 완료! 🥊 챔피언 머니 +100', _coach_body,
                '/character-studio?coach=' || _coach_id);
        update public.coach_messages
           set status = 'sent', sent_at = now(), notification_id = _nid, updated_at = now()
         where id = _coach_id;
        _coach_done := true;
      end if;
    exception when others then
      _coach_done := false;
    end;

    if not _coach_done then
      select mp.current_rank::text, mp.current_level into _rank, _level
        from public.member_progress mp where mp.user_id = new.user_id;
      _rank_kr := case _rank when 'white' then '화이트' when 'blue' then '블루'
                             when 'red' then '레드' when 'black' then '블랙' else coalesce(_rank,'') end;
      -- 커뮤니티 1단계 (2026-10-27): 커뮤니티를 보여 주는 지점이면 누르면 커뮤니티 '오늘도 한 판'으로
      begin
        _community := coalesce(public.is_branch_visible(public._community_branch_of(new.user_id)), false);
      exception when others then
        _community := false;
      end;
      if _community then
        insert into public.notifications (user_id, title, body, link)
        values (new.user_id,
                '오늘 출석 완료! 🥊 챔피언 머니 +100',
                '현재 ' || _rank_kr || ' 리그 Lv.' || coalesce(_level, 1) ||
                ' — 오늘 같이 운동한 동료에게 153을 보내 보세요',
                '/myboxer/community');
      else
        perform public.create_notification(
          new.user_id,
          '오늘 출석 완료! 🥊 챔피언 머니 +100',
          '현재 ' || _rank_kr || ' 리그 Lv.' || coalesce(_level, 1) ||
          ' — 홈에서 내 카드와 이번 주 순위를 확인하세요');
      end if;
    end if;
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

-- 2) 알림 스위치 켜기
insert into public.internal_sync_config (key, value, updated_at)
values ('community_notify_since', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
on conflict (key) do update set value = excluded.value, updated_at = now();
