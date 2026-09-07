-- 블랙 리그는 권위의 상징 — 승인 권한을 위로 올린다.
--
--   화이트 · 블루 · 레드 (레벨 1~30) : 코치도 승인 가능 (기존 그대로)
--   블랙 레벨 31~39                  : 지점장 · 관장만 승인
--   블랙 타이틀매치 레벨 40          : 관장(super_admin)만 승인
--
-- 나머지 로직은 기존 approve_level_review 와 동일하다 (권한 게이트만 추가).

CREATE OR REPLACE FUNCTION public.approve_level_review(_member_id uuid, _approve boolean DEFAULT true, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _caller uuid := auth.uid(); _caller_name text; _p record;
  _rank_order text[] := array['white','blue','red','black']; _idx int; _next_rank rank_name;
  _new_level int; _new_rank rank_name; _ranked_up boolean := false; _ls_id uuid; _old level_status_type;
begin
  if not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id) or is_coach_of(_caller,_member_id)) then
    raise exception 'Not authorized';
  end if;
  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  -- ── 블랙 리그 승인 권한 게이트 ────────────────────────────────────
  if _approve and _p.current_rank = 'black'::rank_name then
    if _p.current_level = 10 then
      if not has_role(_caller,'super_admin') then
        raise exception '블랙 타이틀매치(레벨 40)는 관장님만 승인할 수 있습니다';
      end if;
    elsif not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id)) then
      raise exception '블랙 리그 승급은 지점장·관장만 승인할 수 있습니다';
    end if;
  end if;

  select nickname into _caller_name from profiles where user_id = _caller;
  select status, id into _old, _ls_id from level_status
    where user_id=_member_id and rank_name=_p.current_rank and level_number=_p.current_level;

  if not _approve then
    insert into level_status (user_id, rank_name, level_number, status, approved_by, approval_note)
    values (_member_id, _p.current_rank, _p.current_level, 'revision_requested', _caller, _note)
    on conflict (user_id, rank_name, level_number)
    do update set status='revision_requested', approved_by=_caller, approval_note=_note, updated_at=now()
    returning id into _ls_id;
    insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
    values (_ls_id, _member_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'), 'revision_requested', _caller, _note);
    perform create_notification(_member_id, coalesce(_caller_name,'코치')||'님이 레벨업 보완을 요청했습니다', coalesce(_note,''));
    return jsonb_build_object('approved', false, 'status','revision_requested');
  end if;

  insert into level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
  values (_member_id, _p.current_rank, _p.current_level,
          case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end, now(), _caller, _note)
  on conflict (user_id, rank_name, level_number)
  do update set status = case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end,
                completed_at=now(), approved_by=_caller, approval_note=_note, updated_at=now()
  returning id into _ls_id;
  insert into level_status_history (level_status_id, user_id, rank_name, level_number, previous_status, new_status, changed_by, change_reason)
  values (_ls_id, _member_id, _p.current_rank, _p.current_level, coalesce(_old,'locked'),
          case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end, _caller, coalesce(_note,'레벨업 승인'));

  if _p.current_level < 10 then
    _new_level := _p.current_level + 1; _new_rank := _p.current_rank;
    update member_progress set current_level=_new_level, level_started_at=now(), updated_at=now() where user_id=_member_id;
  else
    _idx := array_position(_rank_order, _p.current_rank::text);
    if _idx is null or _idx >= 4 then
      _new_level := 10; _new_rank := _p.current_rank;
      update member_progress set bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
    else
      _next_rank := _rank_order[_idx+1]::rank_name; _ranked_up := true; _new_level := 1; _new_rank := _next_rank;
      update member_progress set current_rank=_next_rank, current_level=1, bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
      insert into level_status (user_id, rank_name, level_number, status)
      values (_member_id, _next_rank, 1, 'in_progress')
      on conflict (user_id, rank_name, level_number) do update set status='in_progress';
    end if;
  end if;

  insert into xp_logs (user_id, amount, reason) values (_member_id, 50, '레벨업 승인 보상');
  update member_progress set total_xp = total_xp + 50 where user_id=_member_id;
  perform grant_gems(_member_id, 10, '레벨업 승인 보상');
  perform create_notification(_member_id, coalesce(_caller_name,'코치')||'님이 레벨업을 승인했습니다! 🎉',
    case when _ranked_up then '다음 리그로 승급! XP +50, 💎 +10' else '레벨 '||_new_level||' 달성! XP +50, 💎 +10' end);
  return jsonb_build_object('approved', true, 'ranked_up', _ranked_up, 'new_rank', _new_rank::text, 'new_level', _new_level);
end; $function$;
