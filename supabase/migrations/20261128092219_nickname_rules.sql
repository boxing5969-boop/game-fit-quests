-- 닉네임 규칙 — 앱 카드 · 체육관 TV(사이니지)에 보이는 이름 (2026-11-28 대표님
-- 「회원님들 내정보에서 이름 바꿀수있도록 … 앱카드나 사이니지에 올라가는 아이디 이름」 · docs/features/72)
--
-- 화면에 보이는 이름 = profiles.nickname(비면 실명). 내정보에서 바로 바꿀 수 있게 하면서, 모두가 보는 TV 에
-- 욕설 · 운영진처럼 보이는 이름이 올라가지 않게 서버가 마지막에 한 번 막는다.
--   1) nickname_problem(닉네임, 지도진 여부) — 막는 이유(한글 한 줄) 또는 null. 12자 · 욕설(누구나) · 운영진처럼 보이는 말(회원만).
--      낱말 목록 · 문구는 src/lib/nicknameRules.ts 와 같다(src/lib/nicknameRules.test.ts 가 이 파일과 대조).
--   2) guard_profile_privileged_columns — 예전 12자 검사 자리에서 nickname_problem 을 부른다. 나머지는 DB 의 지금 정의
--      (20261119104803 과 같음) 그대로. 닉네임이 바뀔 때만 보므로 지금 있는 닉네임은 그대로 둔다.
--      관리자 · 지점장 · 서버 키(동기화)는 예전처럼 이 검사 앞에서 돌아간다.

create or replace function public.nickname_problem(p_nick text, p_is_staff boolean default false)
 returns text
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select case
    when char_length(btrim(coalesce(p_nick, ''))) > 12
      then '닉네임은 12자 이내로 정해 주세요'
    when n.s = '' then null
    when exists (
      select 1
        from unnest(array[ -- NICKNAME_BLOCK_WORDS
          '씨발', '시발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ',
          '병신', '븅신', 'ㅂㅅ', '좆', '존나', '지랄', 'ㅈㄹ',
          '개새끼', '개색기', '개세끼', '미친놈', '미친년', '썅', '쌍년',
          '느금마', '니애미', '엠창', '창녀', '섹스', '야동',
          'fuck', 'shit', 'bitch', 'pussy', 'asshole', 'nigger', 'nigga'
        ]::text[]) w
       where position(w in n.s) > 0)
      then '다른 회원도 보는 이름이라 쓸 수 없는 낱말이 들어 있어요'
    when not coalesce(p_is_staff, false) and exists (
      select 1
        from unnest(array[ -- NICKNAME_STAFF_WORDS
          '관장', '관리자', '운영자', '운영진', '지점장', '코치님', '대표님', '본사'
        ]::text[]) w
       where position(w in n.s) > 0)
      then '운영진으로 보일 수 있는 이름은 쓸 수 없어요'
  end
  from (select regexp_replace(lower(btrim(coalesce(p_nick, ''))), '[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]', '', 'g') as s) n
$function$;

revoke all on function public.nickname_problem(text, boolean) from public, anon;
grant execute on function public.nickname_problem(text, boolean) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nick_problem text;
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
  -- 2026-11-28: 닉네임 = 앱 카드 · 체육관 TV 이름 — 12자 + 욕설 + 운영진처럼 보이는 말(회원만) · nickname_problem
  if new.nickname is distinct from old.nickname then
    v_nick_problem := public.nickname_problem(new.nickname, coalesce(new.is_staff, false));
    if v_nick_problem is not null then
      raise exception '%', v_nick_problem;
    end if;
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
