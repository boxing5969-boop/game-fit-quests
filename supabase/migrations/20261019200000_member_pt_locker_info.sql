-- 수강권 화면: PT 남은 횟수 · 락카 번호 (2026-10-19 대표님
--   "PT 회원님들 수강권 들어가면 몇회 남았는지 락카번호 몇번인지 확인할수있게 해줘")
--
-- PT: 원본은 브로제이 PT 수업권. 153OS 워커가 회원별 이용권을 확인할 때(매시 :40 UTC 한 지점 18명씩 —
--     회원마다 24~48시간에 한 번) member_snapshots.pt_* 에 적고, sync-pt-members(매시 40분)가 전화번호로 옮긴다.
--     · pt_end_date   = 수업권 실제 기한 (pt_until 은 '배지 유효일' = min(기한, 확인일+7일) 이라 화면 기한으로 못 쓴다)
--     · pt_checked_at = 브로제이에서 확인한 시각 — 화면에 '언제 기준'으로 보인다 (하루쯤 늦을 수 있어서)
-- 락카: 153OS 도 브로제이 락카 번호를 읽지 않는다(2026-10-19 확인 — 6월 엑셀 한 번뿐). 그래서 지금은
--     코치님·지점장이 회원 상세 화면에서 넣는다(set_member_locker). 브로제이에서 가져오게 되면 같은 칸을 채운다.
--     락카 번호는 본인·지도진만 본다(profiles RLS 그대로 — 다른 회원은 못 읽는다).

alter table public.profiles
  add column if not exists pt_end_date date,
  add column if not exists pt_checked_at timestamptz,
  add column if not exists locker_label text,
  add column if not exists locker_updated_at timestamptz,
  add column if not exists locker_updated_by uuid;

comment on column public.profiles.pt_end_date is '대표 PT 수업권 실제 기한 (브로제이, 표시용). pt_until 은 배지 유효일이라 다르다. sync-pt-members 만 쓴다';
comment on column public.profiles.pt_checked_at is 'PT 수업권(남은 횟수)을 153OS 가 브로제이에서 확인한 시각 — 수강권 화면에 "언제 기준"으로 보인다';
comment on column public.profiles.locker_label is '락카 (예: 개인락카 / 11) — 본인·지도진만 본다. set_member_locker 로만 바꾼다';
comment on column public.profiles.locker_updated_at is '락카를 넣거나 바꾼 시각';
comment on column public.profiles.locker_updated_by is '락카를 넣거나 바꾼 지도진 user_id';

-- 회원이 자기 프로필을 고칠 때 새 항목도 못 바꾸게 (PT 는 동기화만, 락카는 set_member_locker 만)
create or replace function public.guard_profile_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return new; end if;
  if new.is_test_account is distinct from old.is_test_account
     and not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')) then
    raise exception '체험용 계정 표시는 관리자만 바꿀 수 있습니다';
  end if;
  -- 2026-10-13: 지점장은 자기 소속 지점을 직접 바꿀 수 없다 — 같은 지점 판정(is_same_branch)으로
  -- 회원 정보·수강권 신청·병원 서류 접근이 갈린다. 지점장 이동은 본사(관리자)가 처리한다.
  if new.user_id = auth.uid()
     and public.has_role(auth.uid(), 'branch_manager')
     and not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
     and coalesce(btrim(old.branch_name), '') <> ''
     and new.branch_name is distinct from old.branch_name then
    raise exception '지점장 계정의 소속 지점은 전체관리자만 바꿀 수 있습니다';
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
  if new.is_staff is distinct from old.is_staff
     or new.staff_title is distinct from old.staff_title
     or new.staff_source is distinct from old.staff_source
     or new.membership_end is distinct from old.membership_end
     or new.payment_total is distinct from old.payment_total
     or new.must_change_credentials is distinct from old.must_change_credentials
     or new.pt_until is distinct from old.pt_until
     or new.pt_ticket is distinct from old.pt_ticket
     or new.pt_remaining is distinct from old.pt_remaining
     or new.pt_end_date is distinct from old.pt_end_date
     or new.pt_checked_at is distinct from old.pt_checked_at then
    raise exception '이 항목은 직접 변경할 수 없습니다';
  end if;
  -- 락카는 set_member_locker(지도진 확인) 안에서만 바뀐다 — 그 함수가 이 거래에만 표시를 켠다
  if (new.locker_label is distinct from old.locker_label
      or new.locker_updated_at is distinct from old.locker_updated_at
      or new.locker_updated_by is distinct from old.locker_updated_by)
     and coalesce(current_setting('app.locker_update', true), '') <> '1' then
    raise exception '락카 번호는 데스크에서 바꿔 드려요';
  end if;
  if coalesce(btrim(old.branch_name), '') <> ''
     and new.branch_name is distinct from old.branch_name then
    raise exception '소속 지점은 직접 바꿀 수 없습니다. 설정의 지점 이전 요청을 이용해 주세요';
  end if;
  if new.nickname is distinct from old.nickname
     and char_length(btrim(coalesce(new.nickname, ''))) > 12 then
    raise exception '닉네임은 12자 이내로 정해 주세요';
  end if;
  if old.phone_number is not null and new.phone_number is distinct from old.phone_number then
    raise exception '전화번호는 직접 변경할 수 없습니다. 지점에 문의해 주세요';
  end if;
  if old.gym_reg_date is not null and new.gym_reg_date is distinct from old.gym_reg_date then
    raise exception '등록일은 직접 변경할 수 없습니다';
  end if;
  return new;
end;
$function$;

-- 지도진이 회원 락카를 넣거나 바꾼다 (비우면 지운다).
--   전체관리자·관리자 = 모든 지점 · 지점장·코치(역할 또는 지도진 표시) = 자기 지점 회원만
create or replace function public.set_member_locker(p_user_id uuid, p_label text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  _me uuid := auth.uid();
  _my_branch text;
  _my_staff boolean;
  _target_branch text;
  _label text := nullif(btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')), '');
begin
  if _me is null then raise exception '로그인이 필요합니다'; end if;
  select branch_name into _target_branch from public.profiles where user_id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없습니다'; end if;
  if not (public.has_role(_me, 'super_admin') or public.has_role(_me, 'admin')) then
    select branch_name, coalesce(is_staff, false) into _my_branch, _my_staff from public.profiles where user_id = _me;
    if not (public.has_role(_me, 'branch_manager') or public.has_role(_me, 'coach') or _my_staff) then
      raise exception '지도진만 락카 번호를 넣을 수 있습니다';
    end if;
    if coalesce(_my_branch, '') = '' or _my_branch is distinct from _target_branch then
      raise exception '같은 지점 회원의 락카만 넣을 수 있습니다';
    end if;
  end if;
  if _label is not null and char_length(_label) > 30 then
    raise exception '락카는 30자 이내로 적어 주세요';
  end if;
  perform set_config('app.locker_update', '1', true);
  update public.profiles
     set locker_label = _label,
         locker_updated_at = case when _label is null then null else now() end,
         locker_updated_by = case when _label is null then null else _me end
   where user_id = p_user_id;
  perform set_config('app.locker_update', '', true);
  return jsonb_build_object('success', true, 'locker_label', _label);
end;
$function$;

revoke all on function public.set_member_locker(uuid, text) from public, anon;
grant execute on function public.set_member_locker(uuid, text) to authenticated;
