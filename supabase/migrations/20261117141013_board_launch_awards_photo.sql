-- 라이브보드 TV 2번 「수상자 축하」 — 이름 옆 프로필 사진 · 레벨 (2026-11-17 14시 대표님 「이름옆에 프로필 사진 있는 사람은
-- 프로필 사진 넣어줘 레벨이랑」) · 20261117122327_board_launch_awards.sql 의 운영 정의(본문 md5 d751cf31…) 위에.
--
-- 바뀐 것은 왕좌마다 1~3위 줄(rows) 하나뿐:
--   · 모든 줄(1~3위)에 league · level(지금 리그 · 리그마다 1~10 — 화면이 누적 Lv 로) · photo(프로필 사진 주소).
--   · photo = profiles.avatar_url(공개 저장소 avatars, board_people 이 TV 에 주는 것과 같은 값) — https 주소일 때만.
--     이름을 빼 달라고 한 분(launch_awards_hide)은 사진 · 레벨 · 리그도 null.
--     '카드에 보일 것'(member_card_display.mode)을 캐릭터로 고르고 캐릭터가 있는 분은 사진 null — 라이브보드 카드와 같은 규칙
--     (이 화면은 캐릭터를 그리지 않으니 그분은 그림 없이 이름만).
--   · 1위의 character(캐릭터 모양)는 뺐다 — 13시부터 화면이 읽지 않는다(대표님 「캐릭터는 안보이게」).
--   · paid_points(1위가 받은 마일리지) · 40일 숫자 · 규칙 · TV 열쇠 · 이벤트가 끝났을 때만 — 그대로.
-- 새 표 없음 · 권한 그대로.

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
             p.avatar_url,
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
               'name', case when r.hidden then null else r.display_name end,
               'hidden', r.hidden,
               'score', r.score,
               -- 지금 리그 · 레벨(리그마다 1~10 — 화면이 누적 Lv 로 바꾼다)
               'league', case when r.hidden then null else mp.current_rank::text end,
               'level', case when r.hidden then null else mp.current_level end,
               -- 프로필 사진(공개 저장소 avatars — board_people 과 같은 값) · 없거나 이름을 뺀 분은 null ·
               -- '카드에 보일 것'을 캐릭터로 고르고 캐릭터가 있는 분도 null (라이브보드 카드와 같은 규칙)
               'photo', case
                          when r.hidden then null
                          when r.avatar_url is null or r.avatar_url !~ '^https://' then null
                          when d.mode = 'character' and exists (
                                 select 1
                                   from public.member_character_assignments ca
                                   join public.character_presets cp on cp.id = ca.preset_id
                                  where ca.user_id = r.user_id and ca.is_active and cp.parts_json is not null) then null
                          else r.avatar_url end
             ) || case when r.rnk = 1 then jsonb_build_object(
               'paid_points', (
                 select max(l.amount)
                   from public.mileage_ledger l
                  where l.user_id = r.user_id
                    and l.amount > 0
                    and l.created_at >= v_since
                    and (l.idem_key like 'launch-top1-' || v_cat || '-%'
                         or (v_cat = 'app' and l.idem_key like 'app-top1-%')))
             ) else '{}'::jsonb end
             order by r.rnk), '[]'::jsonb)
      into v_rows
      from (select k.*, k.user_id = any(v_hide) as hidden from ranked k where k.rnk <= 3) r
      left join public.member_progress mp on mp.user_id = r.user_id
      left join public.member_card_display d on d.user_id = r.user_id;
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
