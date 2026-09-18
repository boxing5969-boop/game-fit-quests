-- 가입폼의 전화번호 중복 확인을 서버 함수로 옮긴다.
--
-- 배경: 가입폼은 profiles 를 직접 조회해 중복을 확인했는데,
--       비로그인(anon)은 profiles 를 한 줄도 볼 수 없다(회원 개인정보 보호 정책상 당연).
--       그래서 중복 검사가 항상 "중복 없음"으로 통과했고, 같은 번호로 가입이 시도될 수 있었다.
--       (지금까지 사고가 없던 이유는 상품이 0건이라 가입 자체가 진행되지 못했기 때문이다.)
--
-- 설계: 회원 정보는 한 줄도 돌려주지 않는다. 오직 "쓸 수 있다/없다" 만 돌려준다.
--       이름·지점 등이 새어나가지 않으므로 profiles 를 여는 것보다 훨씬 좁은 노출이다.
create or replace function public.check_phone_available(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    -- 형식이 아닌 입력에는 판정하지 않는다(번호 긁어보기 방지 최소 방어).
    when length(regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')) not between 10 and 11
      then false
    else not exists (
      select 1 from public.profiles p
      where regexp_replace(coalesce(p.phone_number,''), '[^0-9]', '', 'g')
          = regexp_replace(p_phone, '[^0-9]', '', 'g')
    )
  end;
$$;

comment on function public.check_phone_available(text) is
  '신규가입용 전화번호 사용 가능 여부. true=사용 가능. 회원 정보는 일절 반환하지 않는다.';

revoke all on function public.check_phone_available(text) from public;
grant execute on function public.check_phone_available(text) to anon, authenticated;
