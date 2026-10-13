-- ─────────────────────────────────────────────────────────────
-- 부상·질병 홀딩 보강 (2026-10-13 검수 반영)
--  1) 신청은 앱 화면 규칙과 별개로 서버에서도 막는다 — 대기(pending)로만, 홀딩 일수 1~30일(부상·질병 1~90일),
--     대기 중 홀딩은 1건, 회원이 만들 수 있는 종류는 홀딩·양도·환불만.
--  2) 건강정보 동의 시각(med_consent_at) 기록 — 부상·질병 신청이면 반드시 있어야 한다.
--  3) 서류 삭제 기록(doc_deleted_at) + 실제 삭제를 확인한 뒤에만 기록하는 함수 — 관장 화면이 못 지운 서류를 다시 지운다.
--  4) 처리 함수 행 잠금 — 지점장·본사가 동시에 승인해도 만료일이 두 번 늘지 않게.
--  5) 지점장은 자기 소속 지점을 직접 못 바꾼다 — 같은 지점 판정으로 회원 정보·병원 서류 접근이 갈리기 때문.
-- ─────────────────────────────────────────────────────────────

-- 1·2·3) 컬럼
alter table public.membership_requests
  add column if not exists med_consent_at timestamptz,
  add column if not exists doc_deleted_at timestamptz;

do $$ begin
  alter table public.membership_requests
    add constraint membership_requests_hold_days_chk
    check (hold_days is null
           or (hold_days >= 1 and hold_days <= case when hold_kind = 'medical' then 90 else 30 end));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.membership_requests
    add constraint membership_requests_medical_consent_chk
    check (hold_kind <> 'medical' or med_consent_at is not null);
exception when duplicate_object then null; end $$;

-- 대기 중 홀딩 신청은 회원당 1건
create unique index if not exists membership_requests_one_pending_hold
  on public.membership_requests (user_id)
  where type = 'hold' and status = 'pending';

-- 회원 신청: 본인 것 · 대기 상태로만 · 처리 칸은 비워서 · 홀딩/양도/환불만
drop policy if exists "own requests insert" on public.membership_requests;
create policy "own requests insert" on public.membership_requests
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and processed_at is null
    and processed_by is null
    and type in ('hold', 'transfer', 'refund')
  );

-- 4) 처리 함수 — 행 잠금 추가(나머지 동작은 그대로)
create or replace function public.process_membership_request(_request_id uuid, _approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r public.membership_requests;
begin
  select * into r from public.membership_requests where id = _request_id for update;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'already processed'; end if;
  if not (has_role(auth.uid(),'admin') or has_role(auth.uid(),'super_admin') or is_same_branch(r.user_id)) then
    raise exception 'no permission';
  end if;
  update public.membership_requests
     set status = case when _approve then 'approved' else 'rejected' end,
         processed_at = now(), processed_by = auth.uid()
   where id = _request_id;
  if _approve and r.type in ('hold','postpone') and coalesce(r.hold_days,0) > 0 then
    update public.profiles
       set membership_end = coalesce(membership_end, current_date) + r.hold_days
     where user_id = r.user_id;
  end if;
end;
$function$;

-- 3) 서류 삭제 기록 — 버킷에서 실제로 지워진 것을 확인한 뒤에만 남긴다
create or replace function public.mark_hold_doc_deleted(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.membership_requests;
begin
  select * into r from public.membership_requests where id = _request_id;
  if not found then raise exception 'request not found'; end if;
  if not (auth.uid() = r.user_id
          or has_role(auth.uid(), 'admin')
          or has_role(auth.uid(), 'super_admin')
          or is_same_branch(r.user_id)) then
    raise exception 'no permission';
  end if;
  if r.doc_path is null then return; end if;
  if exists (select 1 from storage.objects where bucket_id = 'hold-docs' and name = r.doc_path) then
    raise exception 'document still exists';
  end if;
  update public.membership_requests
     set doc_deleted_at = coalesce(doc_deleted_at, now())
   where id = _request_id;
end;
$$;

revoke all on function public.mark_hold_doc_deleted(uuid) from public, anon;
grant execute on function public.mark_hold_doc_deleted(uuid) to authenticated;

-- 5) 프로필 보호 트리거 — 지점장 본인 소속 지점 변경 차단 추가(나머지 규칙은 그대로)
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
  -- 2026-10-13: 지점장은 자기 소속 지점을 직접 바꿀 수 없다 — 같은 지점 판정(is_same_branch)으로
  -- 회원 정보·수강권 신청·병원 서류 접근이 갈린다. 지점장 이동은 본사(관리자)가 처리한다.
  if new.user_id = auth.uid()
     and public.has_role(auth.uid(), 'branch_manager')
     and not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
     and coalesce(btrim(old.branch_name), '') <> ''
     and new.branch_name is distinct from old.branch_name then
    raise exception '지점장 계정의 소속 지점은 본사만 바꿀 수 있습니다';
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
