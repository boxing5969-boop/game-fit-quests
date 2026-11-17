-- 라이브보드 TV 2번 「수상자 축하」 — 끝난 런칭 이벤트 자리에 수상자 · 혜택 · 앱 가치를 한 장으로
-- (2026-11-17 대표님 「적용해」 · 보고서 https://claude.ai/artifact/3Sh1bLdd7x5LwCwJAh9Jqr)
--
-- board_launch_awards(지점, TV 열쇠) — TV 는 로그인하지 않는다. board_* 처럼 TV 열쇠(_board_branch_ok)로만 열린다.
--   · 이벤트가 끝났을 때만 수상자를 준다(get_launch_event_window 'ended'). 그 밖엔 status 만 → 화면은 예전 보드.
--   · 왕좌 3개마다 1~3위 = get_launch_event_board 와 같은 순위(_king_scores · 지점 회원만 · 동점이면 먼저 닿은 사람).
--   · 1위만: 캐릭터(리그 · 레벨 · 캐릭터 모양 — 사진 없음) · 받은 보상(mileage_ledger idem 'launch-top1-<왕좌>-…',
--     앱 활동왕은 11/9 에 먼저 드린 'app-top1-…' 도) — 받기 전이면 null.
--   · 40일 숫자(그 지점 회원만 · _is_rankable_member): 운동한 회원(얼굴 · 브로제이 출석) · 레벨업(마일리지 level_up 줄) ·
--     운동으로 쌓인 마일리지(출석 · 레벨업 · 출석 기념 · 153 레코드 · 타이틀매치 · PT — 따로 드린 adjust 는 뺀다) ·
--     지금 마일리지가 쌓인 회원 수.
--   · 마일리지 규칙(app_settings.mileage_rules) — 화면의 '오면 +300 · 레벨업 +300'.
--   · 이름을 빼 달라고 한 수상자: internal_sync_config 'launch_awards_hide' = JSON 배열(user_id 글자) → 이름 없이 hidden.
--   · user_id · 사진 · 전화번호는 내보내지 않는다. 새 표 없음 · 기존 함수 그대로.

create or replace function public.board_launch_awards(p_branch text, p_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_win jsonb := public.get_launch_event_window();
  v_since timestamptz := (v_win ->> 'since')::timestamptz;
  v_until timestamptz := (v_win ->> 'until')::timestamptz;
  v_status text := v_win ->> 'status';
  v_hide uuid[] := '{}'::uuid[];
  v_cat text;
  v_rows jsonb;
  v_items jsonb := '[]'::jsonb;
  v_stats jsonb;
  v_rules jsonb;
  v_head jsonb;
begin
  if v_name is null then
    return null;
  end if;

  v_head := jsonb_build_object(
    'branch', v_name, 'status', v_status,
    'start_date', v_win -> 'start_date', 'end_date', v_win -> 'end_date');

  if v_status is distinct from 'ended' or v_since is null or v_until is null then
    return v_head || jsonb_build_object('items', '[]'::jsonb);
  end if;

  -- 이름을 빼 달라고 한 수상자 (JSON 배열 — 틀린 값이면 아무도 빼지 않는다)
  begin
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_hide
      from jsonb_array_elements_text(coalesce(
        (select c.value::jsonb from public.internal_sync_config c where c.key = 'launch_awards_hide'),
        '[]'::jsonb)) x;
  exception when others then
    v_hide := '{}'::uuid[];
  end;

  foreach v_cat in array array['attendance', 'app', 'nickname'] loop
    with ranked as (
      select s.user_id, s.score,
             coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
             row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
        from public._king_scores(v_cat, v_since, v_until) s
        join public.profiles p on p.user_id = s.user_id
       where s.score > 0
         and p.branch_name = v_name
         and public._is_rankable_member(s.user_id)
    )
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'rank', r.rnk,
               'name', case when r.user_id = any(v_hide) then null else r.display_name end,
               'hidden', r.user_id = any(v_hide),
               'score', r.score
             ) || case when r.rnk = 1 then jsonb_build_object(
               'paid_points', (
                 select max(l.amount)
                   from public.mileage_ledger l
                  where l.user_id = r.user_id
                    and l.amount > 0
                    and l.created_at >= v_since
                    and (l.idem_key like 'launch-top1-' || v_cat || '-%'
                         or (v_cat = 'app' and l.idem_key like 'app-top1-%'))),
               'character', case when r.user_id = any(v_hide) then null else (
                 select jsonb_build_object(
                          'league', mp.current_rank::text,
                          'level', mp.current_level,
                          'parts', cp.parts_json)
                   from (select 1) one
                   left join public.member_progress mp on mp.user_id = r.user_id
                   left join lateral (
                     select ca.preset_id from public.member_character_assignments ca
                      where ca.user_id = r.user_id and ca.is_active
                      order by ca.updated_at desc nulls last
                      limit 1) ca on true
                   left join public.character_presets cp on cp.id = ca.preset_id) end
             ) else '{}'::jsonb end
             order by r.rnk), '[]'::jsonb)
      into v_rows
      from (select * from ranked where rnk <= 3) r;
    v_items := v_items || jsonb_build_object('category', v_cat, 'rows', v_rows);
  end loop;

  with mem as (
    select p.user_id
      from public.profiles p
     where p.branch_name = v_name
       and public._is_rankable_member(p.user_id)
  )
  select jsonb_build_object(
    'members_trained', (
      select count(distinct a.user_id)
        from public.attendance_logs a
       where a.user_id in (select m.user_id from mem m)
         and a.method in ('broj', 'face')
         and a.checked_in_at >= v_since and a.checked_in_at < v_until),
    'level_ups', (
      select count(*)
        from public.mileage_ledger l
       where l.user_id in (select m.user_id from mem m)
         and l.kind = 'level_up'
         and l.created_at >= v_since and l.created_at < v_until),
    'earned_points', (
      select coalesce(sum(l.amount), 0)
        from public.mileage_ledger l
       where l.user_id in (select m.user_id from mem m)
         and l.kind in ('attendance', 'level_up', 'milestone', 'record', 'title_match', 'pt')
         and l.amount > 0
         and l.created_at >= v_since and l.created_at < v_until),
    'members_with_points', (
      select count(*)
        from (select l.user_id
                from public.mileage_ledger l
               where l.user_id in (select m.user_id from mem m)
               group by l.user_id
              having sum(l.amount) > 0) z)
  ) into v_stats;

  select s.value::jsonb into v_rules from public.app_settings s where s.key = 'mileage_rules';
  v_rules := coalesce(v_rules, '{}'::jsonb);

  return v_head || jsonb_build_object(
    'items', v_items,
    'stats', v_stats,
    'rules', jsonb_build_object(
      'enabled', coalesce(v_rules ->> 'enabled', 'false') = 'true',
      'attendance', case when (v_rules ->> 'attendance') ~ '^\d{1,7}$' then (v_rules ->> 'attendance')::int end,
      'level_up', case when (v_rules ->> 'level_up') ~ '^\d{1,7}$' then (v_rules ->> 'level_up')::int end,
      'title_match', case when (v_rules ->> 'title_match') ~ '^\d{1,7}$' then (v_rules ->> 'title_match')::int end,
      'record', case when (v_rules ->> 'record') ~ '^\d{1,7}$' then (v_rules ->> 'record')::int end));
end;
$function$;

revoke all on function public.board_launch_awards(text, text) from public;
grant execute on function public.board_launch_awards(text, text) to anon, authenticated, service_role;
