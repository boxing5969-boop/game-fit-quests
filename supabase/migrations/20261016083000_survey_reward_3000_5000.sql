-- 설문 참여 보상: 만족도 조사 +300 → +3,000 · 고객의 소리 +100 → +5,000 챔피언 머니
--   (2026-10-16 대표님: "만족도 조사하면 챔파언 머니 3000원 5000원 줘")
--   종류별 한 달 한 번 · 지도진·관리자 제외는 그대로. 이미 받은 이번 달 보상은 다시 주지 않는다.

create or replace function public.claim_survey_reward(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
  _month date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  _amount integer;
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  if p_kind not in ('satisfaction', 'feedback') then
    return jsonb_build_object('granted', false, 'reason', 'bad_kind');
  end if;
  if exists (select 1 from profiles where user_id = _uid and is_staff is true)
     or exists (select 1 from user_roles where user_id = _uid
                  and role in ('super_admin', 'admin', 'branch_manager', 'coach')) then
    return jsonb_build_object('granted', false, 'reason', 'staff');
  end if;
  _amount := case p_kind when 'satisfaction' then 3000 else 5000 end;
  insert into survey_rewards (user_id, kind, month, amount)
  values (_uid, p_kind, _month, _amount)
  on conflict do nothing;
  if not found then
    return jsonb_build_object('granted', false, 'reason', 'already', 'amount', _amount);
  end if;
  perform public.grant_gems(_uid, _amount,
    case p_kind when 'satisfaction' then '만족도 조사 참여 보상' else '고객의 소리 참여 보상' end);
  return jsonb_build_object('granted', true, 'amount', _amount);
end;
$$;
