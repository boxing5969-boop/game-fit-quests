-- 다음 리그 시작 레벨 지정 (2026-11-14 대표님 — 「타이틀매치 통과하면 레벨 15로」 회원마다 정해 두기)
--
-- 타이틀매치(L10)를 통과해 다음 리그로 갈 때 보통은 그 리그 L1 에서 시작한다(패스트 트랙 직행권이 있으면 L10).
-- 대표님이 회원마다 출석 · 실력을 보고 「다음 리그는 L○부터」를 미리 정해 둘 수 있게 한다.
--   member_progress.next_league_start_level — null = 예전처럼 L1 · 2~10 = 그 레벨에서 시작(한 번 쓰면 비움)
--   직행권(fast_track_gates)이 있으면 직행권이 먼저(L10) — 그때도 지정 값은 비운다.
-- 앱 영상 심사(record_title_match_attempt_v2)도 이 함수로 승급하므로 같은 규칙을 따른다.
-- 회원 · 코치 화면에는 아직 표시하지 않는다(승인 알림 글에만 시작 레벨).
--
-- approve_level_review 는 DB 의 지금 정의(= 20261009150000_champion_money_economy.sql) 위에
-- 다음 리그로 가는 두 갈래(직행권 · 보통)와 알림 글만 고쳤다 — 권한 · 심사 항목 · 보상은 그대로.

alter table public.member_progress
  add column if not exists next_league_start_level smallint
    check (next_league_start_level between 1 and 10);

comment on column public.member_progress.next_league_start_level is
  '다음 리그 시작 레벨(1~10) — 타이틀매치를 통과해 다음 리그로 갈 때 L1 대신 이 레벨에서 시작하고 비운다. null = L1. 직행권이 있으면 직행권(L10)이 먼저.';

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
  _checked jsonb; _need_cnt int; _done_cnt int; _global_lv int; _need text; _fast boolean := false;
begin
  if not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id) or is_coach_of(_caller,_member_id)) then
    raise exception 'Not authorized';
  end if;
  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  _idx := array_position(_rank_order, _p.current_rank::text);
  _global_lv := (coalesce(_idx,1) - 1) * 10 + _p.current_level;
  _need := public.level_gate_authority(_p.current_rank, _p.current_level);

  if _approve and not public.can_clear_level_gate(_caller, _member_id, _p.current_rank, _p.current_level) then
    raise exception '%',
      case
        when _need = 'owner' and _p.current_level = 10 then
          '레벨 ' || _global_lv || ' 타이틀매치는 관장님만 승인할 수 있습니다'
        when _need = 'owner' then
          '블랙 리그 승급은 관장님만 승인할 수 있습니다'
        when _need = 'manager' and _p.current_level = 10 then
          '레벨 ' || _global_lv || ' 타이틀매치는 지점장·관장만 승인할 수 있습니다'
        else
          '블랙 리그 승급은 지점장·관장만 승인할 수 있습니다'
      end;
  end if;

  select nickname into _caller_name from profiles where user_id = _caller;
  select status, id, coalesce(checked_items,'{}'::jsonb)
    into _old, _ls_id, _checked
    from level_status
   where user_id=_member_id and rank_name=_p.current_rank and level_number=_p.current_level;
  _checked := coalesce(_checked, '{}'::jsonb);

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

  if _p.current_level = 10 then
    select count(*) into _need_cnt
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true and m.category <> 'warmup';

    if _need_cnt = 0 then
      raise exception '레벨 % 타이틀매치에 심사 항목이 없습니다 — 레벨 미션을 먼저 등록해야 승급을 승인할 수 있습니다', _global_lv;
    end if;

    select count(*) into _done_cnt
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true and m.category <> 'warmup'
       and coalesce((_checked -> m.id::text ->> 'passed')::boolean, false);

    if _done_cnt < _need_cnt then
      raise exception '심사 항목 %개 중 %개만 통과했습니다 — 전부 확인해야 승급됩니다', _need_cnt, _done_cnt;
    end if;
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
          case when _p.current_level=10 then 'boss_cleared'::level_status_type else 'approved'::level_status_type end, _caller,
          coalesce(_note, case when _p.current_level=10
            then '레벨 '||_global_lv||' 타이틀매치 승인 (심사 항목 '||coalesce(_need_cnt,0)||'개 전부 통과)'
            else '레벨업 승인' end));

  if _p.current_level < 10 then
    _new_level := _p.current_level + 1; _new_rank := _p.current_rank;
    update member_progress set current_level=_new_level, level_started_at=now(), updated_at=now() where user_id=_member_id;
  else
    if _idx is null or _idx >= 4 then
      _new_level := 10; _new_rank := _p.current_rank;
      update member_progress set bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
    else
      _next_rank := _rank_order[_idx+1]::rank_name; _ranked_up := true; _new_rank := _next_rank;

      if coalesce(_p.fast_track_gates,0) > 0 then
        _fast := true; _new_level := 10;
        update member_progress
           set current_rank = _next_rank, current_level = 10,
               bosses_cleared = bosses_cleared + 1,
               fast_track_gates = greatest(0, coalesce(fast_track_gates,0) - 1),
               next_league_start_level = null,
               level_started_at = now(), updated_at = now()
         where user_id = _member_id;

        insert into level_status (user_id, rank_name, level_number, status, approval_note)
        values (_member_id, _next_rank, 10, 'pending', '패스트 트랙 — 다음 타이틀매치 도전')
        on conflict (user_id, rank_name, level_number)
        do update set status = 'pending',
                      approval_note = '패스트 트랙 — 다음 타이틀매치 도전',
                      updated_at = now();
      else
        -- 대표님이 정해 둔 다음 리그 시작 레벨이 있으면 그 레벨부터(한 번 쓰고 비움), 없으면 L1
        _new_level := least(10, greatest(1, coalesce(_p.next_league_start_level, 1)));
        update member_progress
           set current_rank = _next_rank, current_level = _new_level,
               bosses_cleared = bosses_cleared + 1,
               next_league_start_level = null,
               level_started_at = now(), updated_at = now()
         where user_id = _member_id;
        if _new_level = 10 then
          insert into level_status (user_id, rank_name, level_number, status, approval_note)
          values (_member_id, _next_rank, 10, 'pending', '지정 시작 레벨 — 다음 타이틀매치 도전')
          on conflict (user_id, rank_name, level_number)
          do update set status = 'pending',
                        approval_note = '지정 시작 레벨 — 다음 타이틀매치 도전',
                        updated_at = now();
        else
          insert into level_status (user_id, rank_name, level_number, status, approval_note)
          values (_member_id, _next_rank, _new_level, 'in_progress',
                  case when _new_level > 1 then '지정 시작 레벨 — 레벨 ' || (_idx * 10 + _new_level) end)
          on conflict (user_id, rank_name, level_number) do update set status='in_progress';
        end if;
      end if;
    end if;
  end if;

  insert into xp_logs (user_id, amount, reason) values (_member_id, 50, '레벨업 승인 보상');
  update member_progress set total_xp = total_xp + 50 where user_id=_member_id;
  perform grant_gems(_member_id, 1000, '레벨업 승인 보상');
  perform create_notification(_member_id, coalesce(_caller_name,'코치')||'님이 레벨업을 승인했습니다! 🎉',
    case when _fast then '다음 타이틀매치가 바로 열렸습니다! XP +50, 챔피언 머니 +1,000'
         when _ranked_up and _new_level > 1 then '다음 리그 레벨 ' || (_idx * 10 + _new_level) || '부터 시작해요! XP +50, 챔피언 머니 +1,000'
         when _ranked_up then '다음 리그로 승급! XP +50, 챔피언 머니 +1,000'
         else '레벨 '||_new_level||' 달성! XP +50, 챔피언 머니 +1,000' end);
  return jsonb_build_object('approved', true, 'ranked_up', _ranked_up, 'fast_track', _fast,
                            'new_rank', _new_rank::text, 'new_level', _new_level);
end; $function$;
