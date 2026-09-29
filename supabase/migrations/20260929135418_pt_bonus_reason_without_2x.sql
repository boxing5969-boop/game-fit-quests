-- PT 보너스 기록 이름에서 '2배' 를 뺀다 (2026-09-29 대표님).
-- "PT 경험치 2배라는 글을 빼줘 — 일반 회원님들이 차별을 느낄 것 같아."
-- 회원카드의 'PT · 경험치 2배' 표시는 화면에서 뺐고, 경험치 내역(본인·코치 화면)에 찍히는 이름도
-- 'PT 2배 보너스' → 'PT 보너스', 'PT 2배 보너스 회수' → 'PT 보너스 회수' 로 바꾼다. 적립 규칙(같은 양 한 번 더)은 그대로.
-- 지금까지 쌓인 PT 보너스 줄은 0건이라(PT 회원 동기화 전) 옛 이름 기록을 고칠 것은 없다.
-- 옛 이름도 '보너스 줄 자신' 판정에 남겨 둔다 — 혹시 옛 이름으로 들어오는 줄이 있어도 다시 더하지 않게.
-- 새 이름은 왕좌 점수(_king_scores: '출석 체크'·'레벨업%'·'%타이틀매치 클리어%')·지점 통계('%레벨업%')·
-- 마이페이지 승급 기록('클리어'·'타이틀매치') 어느 패턴에도 걸리지 않는다.
create or replace function public.pt_xp_bonus_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 보너스 줄 자신은 다시 더하지 않는다 (옛 이름 포함)
  if new.reason in ('PT 보너스', 'PT 보너스 회수', 'PT 2배 보너스', 'PT 2배 보너스 회수') then return new; end if;
  -- 관리자 수동 지급·일괄 완료는 정한 숫자 그대로 (grant_manual_xp·bulk_complete_member 가 표시를 켠다)
  if coalesce(current_setting('app.skip_pt_bonus', true), '') = 'on' then return new; end if;
  if coalesce(new.amount, 0) = 0 then return new; end if;
  if not public.is_pt_active(new.user_id) then return new; end if;

  if new.amount > 0 then
    insert into public.xp_logs (user_id, amount, reason) values (new.user_id, new.amount, 'PT 보너스');
    update public.member_progress set total_xp = total_xp + new.amount where user_id = new.user_id;
  elsif new.reason = '체크인 취소 회수' or new.reason like '출석 정정%' then
    -- 취소·정정된 출석에 붙었던 보너스도 같이 회수 (총 경험치는 0 아래로 안 내려간다)
    insert into public.xp_logs (user_id, amount, reason) values (new.user_id, new.amount, 'PT 보너스 회수');
    update public.member_progress set total_xp = greatest(0, total_xp + new.amount) where user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.pt_xp_bonus_trg() from public, anon, authenticated;