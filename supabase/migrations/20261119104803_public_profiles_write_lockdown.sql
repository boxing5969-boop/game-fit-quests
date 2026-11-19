-- 2026-11-19 보안 긴급 — 대표님 「둘 다 지금 막기」 (마이복서153 영상 기준 5대 점검 중 발견 · 작업판 myboxer:db:public_profiles · myboxer:db:guard_profile_privileged_columns)
--
-- ① public.public_profiles 뷰 쓰기 권한 회수
--    이 뷰는 만든 사람(postgres — RLS 를 거치지 않음) 권한으로 profiles 를 읽고, 열 하나짜리 단순 뷰라 저절로 고칠 수 있는 뷰다
--    (pg_relation_is_updatable = 28 · 넣기/고치기/지우기). Supabase 기본 권한(anon · authenticated 에 insert/update/delete)이 그대로 남아
--    있어서 로그인한 계정 누구나(승인 전 새 계정 포함) API 로 남의 profiles 줄을 지우거나 닉네임 · 사진 · user_id 를 바꿀 수 있었다
--    (2026-11-19 authenticated 역할로 EXPLAIN — 'Delete on profiles' 에 RLS 거르기 없음 / profiles 직접은 'One-Time Filter: false').
--    2026-10-19 live_board_revoke_anon 은 anon 의 select 만 거뒀다. 앱은 이 뷰를 읽기만 한다(LiveBoardPage · useDailyOpsReport).
--    → 모든 권한을 거두고 로그인한 사람의 읽기만 다시 준다(한 거래 — 읽기가 끊기는 틈 없음). service_role 은 그대로.
--
-- ② guard_profile_privileged_columns 에 pt_tickets(PT 수업권 목록) 보호 추가
--    회원은 자기 profiles 줄을 고칠 수 있고(RLS 'Users update own profile'), 이 트리거가 고치면 안 되는 칸을 막는다.
--    pt_until · pt_ticket · pt_remaining · pt_end_date · pt_checked_at 는 막혀 있었는데 11/06 에 생긴 pt_tickets 가 빠져 있었다 —
--    회원이 자기 수업권 목록을 바꾸면 ops_pt_capture 트리거가 PT 차감 기록(ops_pt_events)을 만들어 코치 PT 수당 자료가 꼬일 수 있다.
--    pt_tickets 를 쓰는 곳은 sync-pt-members(서버 키 — auth.uid() 가 비어 이 트리거를 지나감)뿐이고, 대표님 · 관리자 · 지점장은 예전처럼 지나간다.
--    본문 = 2026-11-19 운영 DB 지금 정의(md5 f52edf19f9a4a93d37c45d460ab76ab5) + pt_tickets 한 줄.

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

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
     -- 2026-11-19: PT 수업권 목록(153OS 동기화가 서버 키로만 쓴다)도 — 바뀌면 ops_pt_capture 가 PT 차감 기록을 만든다
     or new.pt_tickets is distinct from old.pt_tickets
     -- 2026-10-26: 쓰지 않는 예전 계정 표시도 지점장·관리자만
     or new.merged_into is distinct from old.merged_into then
    raise exception '이 항목은 직접 변경할 수 없습니다';
  end if;
  -- 2026-10-27: 락카 · 운동복 끝나는 날은 결제 반영(서버 키) 또는 set_member_rental_ends(지도진 확인) 안에서만
  if (new.locker_end is distinct from old.locker_end
      or new.sportswear_end is distinct from old.sportswear_end)
     and coalesce(current_setting('app.rental_update', true), '') <> '1' then
    raise exception '락카 · 운동복 기간은 데스크에서 바꿔 드려요';
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
-- 실행 권한은 그대로(create or replace 는 권한을 바꾸지 않는다 — 20261019183000 이후 postgres · service_role 만).
