-- 쓰지 않는 예전 계정 표시 — profiles.merged_into (2026-10-26 대표님: "이사람들은 우리기존회원이야?")
--
-- 왜: 칠금점 회원 4명은 8/03 에 CRM(다짐) 번호로 앱 계정이 자동으로 만들어졌는데, 회원님은 10/23 에 다른 번호로 직접 가입했다.
--     예전 계정을 랭킹에서 빼려고 승인만 껐더니(is_approved=false) 승인 대기 목록에 '가입 요청'으로 떴다.
--     '반려'(reject_member)도 승인을 끄기만 해서 목록에서 빠지지 않는다.
-- 어떻게: 예전 계정에 "이 사람이 실제로 쓰는 계정" 을 적어 둔다(merged_into). 지우지 않는다.
--     merged_into 가 있는 계정은 승인함 · 미승인 수 · 회원 목록 · 회원 수에서 빠진다(화면 쪽 .is("merged_into", null)).
--     회원 본인은 바꿀 수 없다(guard_profile_privileged_columns) — 지점장 · 관리자만.
-- 표시는 마이그레이션이 아니라 운영에서 계정별로 넣는다(회원 계정 번호를 공개 저장소에 남기지 않는다).

alter table public.profiles
  add column if not exists merged_into uuid references auth.users(id) on delete set null;

comment on column public.profiles.merged_into is
  '쓰지 않는 예전 계정이면 그 회원이 실제로 쓰는 계정(user_id). 있으면 승인함·회원 목록·회원 수에서 뺀다. 지우지 않고 남겨 둔다 (2026-10-26).';

create index if not exists idx_profiles_merged_into on public.profiles (merged_into) where merged_into is not null;

-- 운영 DB 의 지금 정의(20261019200000 락카 줄까지) 위에 merged_into 한 줄만 더한다.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     or new.pt_checked_at is distinct from old.pt_checked_at
     -- 2026-10-26: 쓰지 않는 예전 계정 표시도 지점장·관리자만
     or new.merged_into is distinct from old.merged_into then
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
