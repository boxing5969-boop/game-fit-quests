-- 패스트 트랙 — 오래 다니신 회원의 관문 직행 (2026-09-17 대표님 결정)
--
-- 정상 경로: 화이트 L10 통과 → 블루 L1 → 출석 5회씩 아홉 번 → 블루 L10(L20)
-- 패스트 트랙: 화이트 L10 통과 → 블루 L10 으로 직행 → 통과 → 레드 L10 으로 직행
--
--   3단(L10·L20·L30) = 직행권 2장 · 누적 출석 80회 이상
--   2단(L10·L20)     = 직행권 1장 · 재적 1년 이상 그리고 누적 출석 30회 이상
--
-- 왜 출석으로 판정하나: 재적 기간(gym_reg_date)은 CRM 동기화 시점에 채워진 값이라
--   실제보다 짧게 찍힌 회원이 섞여 있다(최솟값 2025-01-06). 반면 출석 80회는
--   정상 경로로 화이트(30회)+블루(50회)를 채우는 분량이라 그 자체가 증명이 된다.
--   기간만 보면 출석 129회 회원이 82회 회원보다 불리해지는 역전이 생긴다.
--
-- 직행해도 관문 심사는 면제되지 않는다. 심사 항목을 전부 통과해야 넘어가고,
-- 미션이 등록되지 않은 리그는 애초에 승인이 막힌다(빈 리그 진입 방지).

alter table public.member_progress
  add column if not exists fast_track_gates integer not null default 0;

comment on column public.member_progress.fast_track_gates is
  '패스트 트랙 관문 직행권 잔여 수. 타이틀매치를 통과할 때 1장 쓰여 다음 리그의 L10 으로 바로 간다. 0 이면 정상 경로(다음 리그 L1).';

create or replace function public.approve_level_review(_member_id uuid, _approve boolean default true, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _caller uuid := auth.uid(); _caller_name text; _p record;
  _rank_order text[] := array['white','blue','red','black']; _idx int; _next_rank rank_name;
  _new_level int; _new_rank rank_name; _ranked_up boolean := false; _ls_id uuid; _old level_status_type;
  _checked jsonb; _need_cnt int; _done_cnt int; _global_lv int; _need text; _fast boolean := false;
begin
  -- 담당 관계 — 이 회원을 볼 수 있는 사람인가
  if not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id) or is_coach_of(_caller,_member_id)) then
    raise exception 'Not authorized';
  end if;
  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  _idx := array_position(_rank_order, _p.current_rank::text);
  _global_lv := (coalesce(_idx,1) - 1) * 10 + _p.current_level;
  _need := public.level_gate_authority(_p.current_rank, _p.current_level);

  -- ── 관문별 승인 권한 게이트 ──────────────────────────────────────────
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

  -- ── 보완 요청 — 체크는 건드리지 않는다 (통과시킨 항목은 그대로 남는다) ──
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

  -- ── 타이틀매치(L10): 심사 항목을 전부 통과해야 한다 ─────────────────────
  if _p.current_level = 10 then
    select count(*) into _need_cnt
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true;

    if _need_cnt = 0 then
      raise exception '레벨 % 타이틀매치에 심사 항목이 없습니다 — 레벨 미션을 먼저 등록해야 승급을 승인할 수 있습니다', _global_lv;
    end if;

    select count(*) into _done_cnt
      from missions m join levels l on l.id = m.level_id
     where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true
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
      -- 블랙 타이틀매치 — 다음 리그가 없다
      _new_level := 10; _new_rank := _p.current_rank;
      update member_progress set bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
    else
      _next_rank := _rank_order[_idx+1]::rank_name; _ranked_up := true; _new_rank := _next_rank;

      if coalesce(_p.fast_track_gates,0) > 0 then
        -- ── 패스트 트랙: 다음 리그의 타이틀매치로 직행, 직행권 1장 사용 ──
        _fast := true; _new_level := 10;
        update member_progress
           set current_rank = _next_rank, current_level = 10,
               bosses_cleared = bosses_cleared + 1,
               fast_track_gates = greatest(0, coalesce(fast_track_gates,0) - 1),
               level_started_at = now(), updated_at = now()
         where user_id = _member_id;

        -- 다음 관문 심사를 바로 연다 (출석 요건을 다시 채우게 하지 않는다)
        insert into level_status (user_id, rank_name, level_number, status, approval_note)
        values (_member_id, _next_rank, 10, 'pending', '패스트 트랙 — 다음 타이틀매치 도전')
        on conflict (user_id, rank_name, level_number)
        do update set status = 'pending',
                      approval_note = '패스트 트랙 — 다음 타이틀매치 도전',
                      updated_at = now();
      else
        _new_level := 1;
        update member_progress set current_rank=_next_rank, current_level=1, bosses_cleared=bosses_cleared+1, level_started_at=now(), updated_at=now() where user_id=_member_id;
        insert into level_status (user_id, rank_name, level_number, status)
        values (_member_id, _next_rank, 1, 'in_progress')
        on conflict (user_id, rank_name, level_number) do update set status='in_progress';
      end if;
    end if;
  end if;

  insert into xp_logs (user_id, amount, reason) values (_member_id, 50, '레벨업 승인 보상');
  update member_progress set total_xp = total_xp + 50 where user_id=_member_id;
  perform grant_gems(_member_id, 10, '레벨업 승인 보상');
  perform create_notification(_member_id, coalesce(_caller_name,'코치')||'님이 레벨업을 승인했습니다! 🎉',
    case when _fast then '다음 타이틀매치가 바로 열렸습니다! XP +50, 💎 +10'
         when _ranked_up then '다음 리그로 승급! XP +50, 💎 +10'
         else '레벨 '||_new_level||' 달성! XP +50, 💎 +10' end);
  return jsonb_build_object('approved', true, 'ranked_up', _ranked_up, 'fast_track', _fast,
                            'new_rank', _new_rank::text, 'new_level', _new_level);
end; $function$;

revoke execute on function public.approve_level_review(uuid, boolean, text) from public;
grant execute on function public.approve_level_review(uuid, boolean, text) to authenticated;
