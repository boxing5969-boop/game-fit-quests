-- ============================================================================
-- 타이틀매치 기준 확정 (2026-09-17 대표님 결정)
--
-- [결정 1] 리그를 넘기는 관문은 위로 갈수록 승인 권한을 엄하게 한다.
--   화이트 L10 → 담당 코치 / 블루 L10 → 지점장·관장 / 레드 L10 → 관장만
--   (블랙은 기존 그대로: L1~L9 지점장·관장, L10 관장만)
--   예전에는 화이트·블루·레드 관문 셋이 모두 담당 코치 한 명으로 열렸다.
--   블루 L10 승인은 사실상 접촉 스파링장 입장권이고, 레드 L10 은 남을
--   가르치는 리그로 들어가는 문인데 권한이 같았다.
--
-- [결정 2] 타이틀매치(L10)는 심사 항목을 전부 통과해야 승인된다.
--   예전에는 권한만 보고 버튼을 누르면 올라갔다 — 무엇을 보고 승인했는지
--   기록에 남지 않았다. 이제 레벨 미션마다 코치가 통과를 찍어야 하고,
--   누가 언제 찍었는지 남는다. 심사 항목이 아예 없는 레벨은 승인이 막힌다
--   (빈 리그로 회원을 올려보내는 것을 구조적으로 막는다).
--   L1~L9 는 출석 자동 승급이 정상 경로이므로 체크를 강제하지 않는다.
-- ============================================================================

alter table public.level_status
  add column if not exists checked_items jsonb not null default '{}'::jsonb;

comment on column public.level_status.checked_items is
  '타이틀매치 심사 항목별 통과 기록. {"<mission_id>": {"passed":bool,"by":uuid,"at":timestamptz,"note":text}}';

-- ── 관문별 필요 권한 — 한 곳에서만 정의한다 ─────────────────────────────
create or replace function public.level_gate_authority(_rank rank_name, _level int)
returns text language sql immutable set search_path to 'public' as $fn$
  select case
    when _level = 10 and _rank::text = 'white' then 'coach'
    when _level = 10 and _rank::text = 'blue'  then 'manager'
    when _level = 10 and _rank::text = 'red'   then 'owner'
    when _level = 10 and _rank::text = 'black' then 'owner'
    when _rank::text = 'black'                 then 'manager'
    else 'coach'
  end;
$fn$;

create or replace function public.can_clear_level_gate(
  _caller uuid, _member_id uuid, _rank rank_name, _level int
) returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select case public.level_gate_authority(_rank, _level)
    when 'owner'   then has_role(_caller,'super_admin')
    when 'manager' then has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id)
    else has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id)
         or is_coach_of(_caller,_member_id)
  end;
$fn$;

revoke execute on function public.level_gate_authority(rank_name, int) from public;
revoke execute on function public.can_clear_level_gate(uuid, uuid, rank_name, int) from public;
grant execute on function public.level_gate_authority(rank_name, int) to authenticated;
grant execute on function public.can_clear_level_gate(uuid, uuid, rank_name, int) to authenticated;

-- ── 코치 화면용: 이 회원 현재 레벨의 심사 항목과 통과 상태 ───────────────
create or replace function public.get_level_review_checklist(_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  _caller uuid := auth.uid();
  _p record; _checked jsonb; _need text; _items jsonb;
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  if not (has_role(_caller,'super_admin') or is_branch_manager_of(_caller,_member_id)
          or is_coach_of(_caller,_member_id) or _member_id = _caller) then
    raise exception 'Not authorized';
  end if;

  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  select coalesce(checked_items,'{}'::jsonb) into _checked from level_status
    where user_id=_member_id and rank_name=_p.current_rank and level_number=_p.current_level;
  _checked := coalesce(_checked, '{}'::jsonb);

  _need := public.level_gate_authority(_p.current_rank, _p.current_level);

  select coalesce(jsonb_agg(jsonb_build_object(
           'missionId', m.id,
           'title',     m.title,
           'keyPoints', (select jsonb_agg(k) from unnest(array[m.key_point_1, m.key_point_2, m.key_point_3]) k where k is not null),
           'passed',    coalesce((_checked -> m.id::text ->> 'passed')::boolean, false),
           'by',        _checked -> m.id::text ->> 'by',
           'at',        _checked -> m.id::text ->> 'at'
         ) order by m.sort_order), '[]'::jsonb)
    into _items
    from missions m join levels l on l.id = m.level_id
   where l.rank_name = _p.current_rank and l.level_number = _p.current_level and m.is_active = true;

  return jsonb_build_object(
    'rank', _p.current_rank::text,
    'level', _p.current_level,
    'isTitleMatch', (_p.current_level = 10),
    'requiredAuthority', _need,
    'canApprove', public.can_clear_level_gate(_caller, _member_id, _p.current_rank, _p.current_level),
    'items', _items,
    'total', jsonb_array_length(_items),
    'passedCount', (select count(*) from jsonb_array_elements(_items) e where (e->>'passed')::boolean)
  );
end; $fn$;

revoke execute on function public.get_level_review_checklist(uuid) from public;
grant execute on function public.get_level_review_checklist(uuid) to authenticated;

-- ── 코치가 심사 항목 하나를 통과/해제 ────────────────────────────────────
create or replace function public.set_level_review_check(
  _member_id uuid, _mission_id uuid, _passed boolean default true, _note text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  _caller uuid := auth.uid(); _p record; _ok boolean; _ls_id uuid;
begin
  if _caller is null then raise exception 'Not authorized'; end if;
  select * into _p from member_progress where user_id = _member_id;
  if not found then raise exception '회원 진행 정보 없음'; end if;

  -- 항목을 찍을 권한은 그 관문을 열 권한과 같다. 코치가 찍고 관장이 누르는
  -- 구조로 만들면 "누가 실제로 봤는지"가 흐려진다.
  if not public.can_clear_level_gate(_caller, _member_id, _p.current_rank, _p.current_level) then
    raise exception '%', case public.level_gate_authority(_p.current_rank, _p.current_level)
      when 'owner'   then '이 관문의 심사는 관장님만 할 수 있습니다'
      when 'manager' then '이 관문의 심사는 지점장·관장만 할 수 있습니다'
      else '담당 회원만 심사할 수 있습니다' end;
  end if;

  -- 이 레벨의 항목인지 확인 (다른 레벨 미션 id 를 밀어넣는 것을 막는다)
  select exists(
    select 1 from missions m join levels l on l.id = m.level_id
     where m.id = _mission_id and m.is_active = true
       and l.rank_name = _p.current_rank and l.level_number = _p.current_level
  ) into _ok;
  if not _ok then raise exception '이 레벨의 심사 항목이 아닙니다'; end if;

  insert into level_status (user_id, rank_name, level_number, status, checked_items)
  values (_member_id, _p.current_rank, _p.current_level, 'pending',
          jsonb_build_object(_mission_id::text, jsonb_build_object(
            'passed', _passed, 'by', _caller, 'at', now(), 'note', _note)))
  on conflict (user_id, rank_name, level_number) do update
    set checked_items = coalesce(level_status.checked_items,'{}'::jsonb)
          || jsonb_build_object(_mission_id::text, jsonb_build_object(
               'passed', _passed, 'by', _caller, 'at', now(), 'note', _note)),
        updated_at = now()
  returning id into _ls_id;

  return public.get_level_review_checklist(_member_id);
end; $fn$;

revoke execute on function public.set_level_review_check(uuid, uuid, boolean, text) from public;
grant execute on function public.set_level_review_check(uuid, uuid, boolean, text) to authenticated;
