-- PT(퍼스널 트레이닝) 회원 — 회원카드 파란 배지 + 경험치 2배 (2026-09-29 대표님).
-- "PT 회원님들은 1시간 동안 퍼스널 트레이닝을 받기 때문에 회원님들이 받는 경험치의 2배".
--
-- PT 여부는 브로제이 PT 수업권이 원본이다: 153OS 워커가 회원별 이용권을 확인할 때 PT 수업권(잔여 횟수 남음·기간 안 끝남)을
-- member_snapshots.pt_* 에 기록하고, 앱 크론(sync-pt-members, 매시 40분)이 전화번호로 앱 계정에 pt_until 을 맞춘다.
-- pt_until 이 오늘(KST) 이후면 PT 회원 — 기간이 끝나거나 횟수를 다 쓰면 동기화가 지우고 배지·2배도 같이 꺼진다.
--
-- 2배는 xp_logs 에 경험치가 쌓이는 순간 같은 양을 'PT 2배 보너스' 한 줄로 더 적립한다(모든 경험치 — 출석·운동시간·레벨업 보상·미션 등).
--   · 관리자 수동 지급(grant_manual_xp)·전체 관리자 일괄 완료(bulk_complete_member)는 정한 숫자 그대로 — 2배 안 함.
--   · 출석 취소(체크인 취소 회수)·출석 정정으로 경험치가 빠지면 붙었던 보너스도 같이 뺀다.
--   · 보너스 이유 문구에 원래 사유를 넣지 않는다 — 153 챌린지 킹 보드·지점 통계가 사유 글자('출석 체크'·'레벨업'·'타이틀매치 클리어')로
--     세는 곳이 있어, 넣으면 보너스 줄이 한 번 더 세어진다.

-- 1) 앱 계정의 PT 상태 (동기화 전용 — 회원이 직접 못 바꾼다)
alter table public.profiles
  add column if not exists pt_until date,
  add column if not exists pt_ticket text,
  add column if not exists pt_remaining integer;

comment on column public.profiles.pt_until is 'PT 회원 유효일(KST). 오늘 이후면 PT 회원 — 회원카드 파란 배지 + 경험치 2배. 브로제이 PT 수업권 기준, sync-pt-members 만 쓴다';
comment on column public.profiles.pt_ticket is '대표 PT 수업권 이름 (브로제이 원본, 표시용)';
comment on column public.profiles.pt_remaining is '대표 PT 수업권 잔여 횟수 (표시용)';

-- 2) 회원이 자기 프로필을 고칠 때 PT 항목은 못 바꾸게 (지도진 표기·이용권과 같은 취급)
create or replace function public.guard_profile_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- auth.uid() 가 없으면 service_role/서버 경로(동기화·결제 콜백·자격 변경 함수) → 그대로.
  if auth.uid() is null then return new; end if;
  -- 2026-09-28: 체험용 계정 표시는 전체 관리자·관리자만 바꾼다(켜면 레벨 테스트·공개 순위 제외가 따라온다).
  if new.is_test_account is distinct from old.is_test_account
     and not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')) then
    raise exception '체험용 계정 표시는 관리자만 바꿀 수 있습니다';
  end if;
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
  -- 2026-09-29: PT 회원 항목(pt_until 등)도 막는다 — 경험치 2배가 걸려 있다.
  if new.is_staff is distinct from old.is_staff
     or new.staff_title is distinct from old.staff_title
     or new.staff_source is distinct from old.staff_source
     or new.membership_end is distinct from old.membership_end
     or new.payment_total is distinct from old.payment_total
     or new.must_change_credentials is distinct from old.must_change_credentials
     or new.pt_until is distinct from old.pt_until
     or new.pt_ticket is distinct from old.pt_ticket
     or new.pt_remaining is distinct from old.pt_remaining then
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

-- 3) 지금 PT 회원인가 (KST 오늘 기준)
create or replace function public.is_pt_active(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select p.pt_until >= (now() at time zone 'Asia/Seoul')::date
       from public.profiles p where p.user_id = _user_id limit 1),
    false);
$$;
revoke execute on function public.is_pt_active(uuid) from public, anon, authenticated;

-- 4) 경험치 2배 — xp_logs 에 적립되는 순간 같은 양을 한 줄 더
create or replace function public.pt_xp_bonus_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 보너스 줄 자신은 다시 2배 하지 않는다
  if new.reason in ('PT 2배 보너스', 'PT 2배 보너스 회수') then return new; end if;
  -- 관리자 수동 지급·일괄 완료는 정한 숫자 그대로 (grant_manual_xp·bulk_complete_member 가 표시를 켠다)
  if coalesce(current_setting('app.skip_pt_bonus', true), '') = 'on' then return new; end if;
  if coalesce(new.amount, 0) = 0 then return new; end if;
  if not public.is_pt_active(new.user_id) then return new; end if;

  if new.amount > 0 then
    insert into public.xp_logs (user_id, amount, reason) values (new.user_id, new.amount, 'PT 2배 보너스');
    update public.member_progress set total_xp = total_xp + new.amount where user_id = new.user_id;
  elsif new.reason = '체크인 취소 회수' or new.reason like '출석 정정%' then
    -- 취소·정정된 출석에 붙었던 보너스도 같이 회수 (총 경험치는 0 아래로 안 내려간다)
    insert into public.xp_logs (user_id, amount, reason) values (new.user_id, new.amount, 'PT 2배 보너스 회수');
    update public.member_progress set total_xp = greatest(0, total_xp + new.amount) where user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.pt_xp_bonus_trg() from public, anon, authenticated;

drop trigger if exists trg_pt_xp_bonus on public.xp_logs;
create trigger trg_pt_xp_bonus
  after insert on public.xp_logs
  for each row execute function public.pt_xp_bonus_trg();

-- 5) 관리자 수동 지급·일괄 완료는 2배 제외 표시 (함수 본문에서 xp_logs 적립 바로 앞에 한 줄)
do $$
declare
  _fn regprocedure;
  _def text;
  _new text;
begin
  foreach _fn in array array[
    'public.grant_manual_xp(uuid,integer,text)'::regprocedure,
    'public.bulk_complete_member(uuid,text,boolean,jsonb)'::regprocedure
  ] loop
    _def := pg_get_functiondef(_fn);
    if position('app.skip_pt_bonus' in _def) > 0 then continue; end if;
    if (length(_def) - length(replace(_def, 'INSERT INTO xp_logs', ''))) / length('INSERT INTO xp_logs') <> 1 then
      raise exception '% : xp_logs 적립 위치가 1곳이 아닙니다', _fn;
    end if;
    _new := replace(_def, 'INSERT INTO xp_logs',
      'PERFORM set_config(''app.skip_pt_bonus'', ''on'', true);  -- PT 2배 제외 (관리자가 정한 숫자 그대로)' || chr(10) || '    INSERT INTO xp_logs');
    if length(_new) <= length(_def) then raise exception '% : 수정 실패', _fn; end if;
    execute _new;
  end loop;
end $$;

-- 6) 매시 40분 — 153OS(브로제이 PT 수업권) → 앱 pt_until 동기화
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-pt-members') then
    perform cron.unschedule('sync-pt-members');
  end if;
  perform cron.schedule('sync-pt-members', '40 * * * *', $cmd$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/sync-pt-members',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 60000
  );
  $cmd$);
end $$;