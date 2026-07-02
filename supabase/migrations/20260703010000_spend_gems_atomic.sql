-- 원자적 젬 차감 RPC — 동시 요청(중복탭/연타)에도 잔액 초과 사용 방지.
-- auth.uid() 기준이라 본인 지갑만 차감 가능. 조건부 UPDATE(잔액 >= amount)로
-- 처리하고, 차감이 일어나지 않으면(-1) 잔액 부족으로 간주한다.
-- ※ 이미 라이브 DB(whnczhxyjmyywhlfbgsd)에 적용됨. CREATE OR REPLACE 라 재적용 무해.
create or replace function public.spend_gems(_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _new integer;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _amount is null or _amount <= 0 then
    raise exception 'invalid amount';
  end if;

  update public.user_wallets
     set gems_balance = gems_balance - _amount,
         total_spent  = coalesce(total_spent, 0) + _amount
   where user_id = _uid
     and gems_balance >= _amount
  returning gems_balance into _new;

  if not found then
    return -1;  -- 잔액 부족 또는 지갑 없음
  end if;
  return _new;
end;
$$;

grant execute on function public.spend_gems(integer) to authenticated;
