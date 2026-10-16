-- 본사(전체관리자·관리자)는 회원 활동을 모두 본다 (2026-10-16 대표님:
--   "회원이 쓴 커뮤니티 글 내가 확인할수있나? 나는 모든 활동을 확인할수있게해줘")
--
-- 지금까지: 커뮤니티 피드는 '내 지점'만, 글은 '지점 공개' 또는 '짝꿍만'(짝꿍에게만) — 본사 계정(153본사)에는 거의 아무것도 안 보였다.
--           그런데 숨기기 권한은 본사에 있어 보이지 않는 글을 관리해야 하는 상태였다.
-- 바뀐 것:
--   1) community_can_view_entry — 본사는 모든 글 (짝꿍만 · 숨긴 글 포함) → 댓글 보기·달기 · 153 · 신고가 같이 열린다
--   2) toggle_community_153 — 본사는 다른 지점 출석·승급 카드에도 153
--   3) get_community_feed — 본사는 모든 지점: 글 30일(지점 회원은 그대로 14일) · 짝꿍만 · 숨긴 글까지, 항목마다 지점·숨김 표시
--   4) admin_member_activity(회원) — 회원 한 명의 앱·커뮤니티 활동을 시간순으로 (본사만, 회원 상세 '출석·활동' 탭)
-- 지키는 것:
--   · DM(메시지) 내용은 그대로 비공개 — 신고된 대화의 사본만 본사가 본다 (20260930073749_dm_direct_messages.sql 약속)
--   · 만족도 조사·고객의 소리는 익명 — 참여 여부만 보이고 내용은 회원과 잇지 않는다
--   · 지점 회원·코치님에게 보이는 범위는 그대로
-- 본사 판별은 _dm_kind(uid) = 'hq' (super_admin · admin) — 메시지·전략 회의실과 같은 기준.

-- 1) 글 보기 권한 — 본사는 모든 글
create or replace function public.community_can_view_entry(p_viewer uuid, p_entry_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  e record;
  v_branch text;
begin
  if p_viewer is null then return false; end if;
  select user_id, visibility, hidden_at into e from public.champion_journal_entries where id = p_entry_id;
  if not found then return false; end if;
  if e.user_id = p_viewer then return true; end if;
  -- 본사(전체관리자·관리자)는 짝꿍만 · 숨긴 글까지 모두 (2026-10-16)
  if public._dm_kind(p_viewer) = 'hq' then return true; end if;
  if e.hidden_at is not null then return false; end if;
  if e.visibility = 'branch' then
    v_branch := public._community_branch_of(p_viewer);
    if v_branch is not null and v_branch = public._community_branch_of(e.user_id) then return true; end if;
  end if;
  return public.is_journal_partner(p_viewer, e.user_id);
end $$;

-- 2) 153 — 본사는 다른 지점 출석·승급 카드에도
create or replace function public.toggle_community_153(p_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_owner uuid;
  v_ok boolean := false;
  v_reacted boolean;
  v_hq boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_type not in ('journal', 'checkin', 'promotion') then raise exception '잘못된 대상입니다'; end if;
  v_branch := public._community_branch_of(v_uid);
  v_hq := public._dm_kind(v_uid) = 'hq';

  if p_type = 'journal' then
    select user_id into v_owner from public.champion_journal_entries where id = p_id;
    v_ok := public.community_can_view_entry(v_uid, p_id);
  elsif p_type = 'checkin' then
    select user_id into v_owner from public.attendance_logs where id = p_id;
    v_ok := v_owner is not null and (v_hq or (v_branch is not null and v_branch = public._community_branch_of(v_owner)));
  else
    select user_id into v_owner from public.level_status_history where id = p_id;
    v_ok := v_owner is not null and (v_hq or (v_branch is not null and v_branch = public._community_branch_of(v_owner)));
  end if;

  if not v_ok then raise exception '볼 수 없는 글입니다'; end if;
  if v_owner = v_uid then raise exception '내 글에는 153을 누를 수 없어요'; end if;

  if exists (select 1 from public.community_reactions where target_type = p_type and target_id = p_id and user_id = v_uid) then
    delete from public.community_reactions where target_type = p_type and target_id = p_id and user_id = v_uid;
    v_reacted := false;
  else
    insert into public.community_reactions (target_type, target_id, user_id, branch_name)
    values (p_type, p_id, v_uid, v_branch);
    v_reacted := true;
  end if;

  return jsonb_build_object('success', true, 'reacted', v_reacted,
    'count153', (select count(*) from public.community_reactions where target_type = p_type and target_id = p_id));
end $$;

-- 3) 피드 — 본사는 모든 지점 · 모든 글 (지점 회원은 예전과 같다)
create or replace function public.get_community_feed(p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_limit int;
  v_days int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_items jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public._community_branch_of(v_uid);
  v_all := public._dm_kind(v_uid) = 'hq';
  v_limit := greatest(1, least(coalesce(p_limit, 40), case when v_all then 200 else 80 end));
  v_days := case when v_all then 30 else 14 end;
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'branch', null, 'all_branches', false,
                              'is_staff', public._community_is_staff(v_uid), 'items', '[]'::jsonb);
  end if;

  with
  goal as (
    -- 지점마다 이번 주 가장 최근 목표 하나 (지점 회원은 자기 지점 하나)
    select distinct on (p.branch_name)
           'goal'::text as type, e.id, e.user_id, e.created_at as at, true as pinned, 1 as pin_order,
           e.prompt, e.content, null::text as mood, e.photo_url, e.visibility, false as newbie,
           null::text as rank_name, null::int as level_number, e.hidden_at
      from public.champion_journal_entries e
      join public.profiles p on p.user_id = e.user_id
     where e.kind = 'weekly_goal' and (e.hidden_at is null or v_all)
       and e.created_at >= v_week_start and (v_all or p.branch_name = v_branch)
     order by p.branch_name, e.created_at desc
  ),
  promo as (
    select 'promotion'::text, h.id, h.user_id, h.created_at, true, 2,
           null::text, null::text, null::text, null::text, null::text, false,
           h.rank_name::text, h.level_number, null::timestamptz
      from public.level_status_history h
      join public.profiles p on p.user_id = h.user_id
     where h.new_status = 'boss_cleared' and h.created_at >= now() - interval '7 days'
       and (v_all or p.branch_name = v_branch)
       and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
  ),
  posts as (
    select 'journal'::text, e.id, e.user_id, e.created_at, false, 9,
           e.prompt, e.content, e.mood, e.photo_url, e.visibility, false,
           null::text, null::int, e.hidden_at
      from public.champion_journal_entries e
      join public.profiles p on p.user_id = e.user_id
     where e.kind = 'journal' and e.created_at >= now() - make_interval(days => v_days)
       and (v_all
            or e.user_id = v_uid
            or (e.hidden_at is null and e.visibility = 'branch' and p.branch_name = v_branch)
            or (e.hidden_at is null and e.visibility = 'partners' and public.is_journal_partner(v_uid, e.user_id)))
  ),
  checkins as (
    select distinct on (a.user_id) 'checkin'::text, a.id, a.user_id, a.checked_in_at, false, 9,
           null::text, null::text, null::text, null::text, null::text,
           not exists (select 1 from public.attendance_logs b
                        where b.user_id = a.user_id and coalesce(b.is_duplicate, false) = false
                          and (b.checked_in_at at time zone 'Asia/Seoul')::date < v_today),
           null::text, null::int, null::timestamptz
      from public.attendance_logs a
      join public.profiles p on p.user_id = a.user_id
     where (a.checked_in_at at time zone 'Asia/Seoul')::date = v_today
       and a.checked_in_at <= now()
       and coalesce(a.is_duplicate, false) = false
       and (v_all or p.branch_name = v_branch)
       and coalesce(p.community_auto_post, true)
       and not coalesce(p.is_staff, false) and not coalesce(p.is_test_account, false)
     order by a.user_id, a.checked_in_at
  ),
  allx as (
    select * from goal union all select * from promo union all select * from posts
  ),
  ranked as (
    (select * from allx order by pinned desc, pin_order, at desc limit v_limit) union all (select * from checkins)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', r.type,
           'id', r.id,
           'userId', r.user_id,
           'nickname', coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '회원'),
           'avatarUrl', p.avatar_url,
           'isStaff', coalesce(p.is_staff, false),
           'staffTitle', p.staff_title,
           'league', coalesce(mp.current_rank::text, 'white'),
           'level', (coalesce(array_position(v_order, mp.current_rank::text), 1) - 1) * 10 + coalesce(mp.current_level, 1),
           'at', r.at,
           'pinned', r.pinned,
           'prompt', r.prompt,
           'content', r.content,
           'mood', r.mood,
           'photoUrl', r.photo_url,
           'visibility', r.visibility,
           'newbie', r.newbie,
           'promoRank', r.rank_name,
           'promoLevel', case when r.rank_name is null then null
                              else (coalesce(array_position(v_order, r.rank_name), 1) - 1) * 10 + r.level_number end,
           'isMine', r.user_id = v_uid,
           'branch', p.branch_name,
           'hidden', r.hidden_at is not null,
           'comments', case when r.type in ('journal', 'goal')
                            then (select count(*) from public.champion_journal_comments c where c.entry_id = r.id) else 0 end,
           'count153', (select count(*) from public.community_reactions x
                         where x.target_type = case when r.type = 'goal' then 'journal' else r.type end and x.target_id = r.id),
           'reacted', exists (select 1 from public.community_reactions x
                               where x.target_type = case when r.type = 'goal' then 'journal' else r.type end
                                 and x.target_id = r.id and x.user_id = v_uid)
         ) order by r.pinned desc, r.pin_order, r.at desc), '[]'::jsonb)
    into v_items
    from ranked r
    left join public.profiles p on p.user_id = r.user_id
    left join public.member_progress mp on mp.user_id = r.user_id;

  return jsonb_build_object('success', true, 'branch', v_branch, 'all_branches', v_all,
                            'is_staff', public._community_is_staff(v_uid), 'items', v_items);
end $$;

-- 4) 회원 한 명의 앱·커뮤니티 활동 (본사만) — 회원 상세 '출석·활동' 탭
--    출석·XP 는 그 탭에 이미 따로 있어서 여기서는 뺀다. DM 내용 · 설문 답변은 넣지 않는다.
create or replace function public.admin_member_activity(p_user_id uuid, p_limit integer default 150)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 150), 300));
  v_order text[] := array['white', 'blue', 'red', 'black'];
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq' then raise exception '본사만 볼 수 있어요'; end if;
  if p_user_id is null then return jsonb_build_object('items', '[]'::jsonb); end if;

  with
  nm as (
    select user_id, coalesce(nullif(btrim(nickname), ''), nullif(btrim(name), ''), '회원') as n from public.profiles
  ),
  ev as (
    -- 커뮤니티 글 · 이번 주 목표
    (select 'post'::text as t, e.created_at as at,
            case when e.kind = 'weekly_goal' then '이번 주 목표를 올렸어요' else '커뮤니티에 글을 올렸어요' end as title,
            e.content as detail,
            jsonb_build_object('visibility', e.visibility, 'hidden', e.hidden_at is not null,
                               'photo', e.photo_url, 'prompt', e.prompt, 'mood', e.mood) as meta
       from public.champion_journal_entries e
      where e.user_id = p_user_id
      order by e.created_at desc limit 60)
    union all
    -- 댓글
    (select 'comment', c.created_at, coalesce((select n from nm where nm.user_id = e.user_id), '회원') || '님 글에 댓글',
            c.content, '{}'::jsonb
       from public.champion_journal_comments c
       join public.champion_journal_entries e on e.id = c.entry_id
      where c.commenter_user_id = p_user_id
      order by c.created_at desc limit 60)
    union all
    -- 153 보냄
    (select '153', x.created_at,
            case x.target_type when 'journal' then '글에 153' when 'checkin' then '출석 카드에 153' else '승급 카드에 153' end
            || coalesce(' · ' || (select n from nm where nm.user_id = coalesce(
                 (select j.user_id from public.champion_journal_entries j where j.id = x.target_id),
                 (select a.user_id from public.attendance_logs a where a.id = x.target_id),
                 (select h.user_id from public.level_status_history h where h.id = x.target_id))) || '님', ''),
            null, '{}'::jsonb
       from public.community_reactions x
      where x.user_id = p_user_id
      order by x.created_at desc limit 60)
    union all
    -- 응원 보냄 · 받음
    (select 'cheer_sent', ch.created_at, coalesce((select n from nm where nm.user_id = ch.receiver_user_id), '회원') || '님에게 응원',
            ch.message, '{}'::jsonb
       from public.boxing_cheers ch where ch.sender_user_id = p_user_id
      order by ch.created_at desc limit 40)
    union all
    (select 'cheer_got', ch.created_at, coalesce((select n from nm where nm.user_id = ch.sender_user_id), '회원') || '님의 응원을 받았어요',
            ch.message, '{}'::jsonb
       from public.boxing_cheers ch where ch.receiver_user_id = p_user_id
      order by ch.created_at desc limit 40)
    union all
    -- 생일 축하 보냄 · 받음
    (select 'birthday_sent', b.created_at, coalesce((select n from nm where nm.user_id = b.receiver_id), '회원') || '님에게 생일 축하',
            b.message, '{}'::jsonb
       from public.birthday_congrats b where b.sender_id = p_user_id
      order by b.created_at desc limit 20)
    union all
    (select 'birthday_got', b.created_at, coalesce((select n from nm where nm.user_id = b.sender_id), '회원') || '님의 생일 축하를 받았어요',
            b.message, '{}'::jsonb
       from public.birthday_congrats b where b.receiver_id = p_user_id
      order by b.created_at desc limit 20)
    union all
    -- 운동 짝꿍(코너맨)
    (select 'cornerman', coalesce(cp.accepted_at, cp.requested_at, cp.created_at),
            coalesce((select n from nm where nm.user_id =
                       case when cp.requester_user_id = p_user_id then cp.receiver_user_id else cp.requester_user_id end), '회원')
            || case cp.status when 'active' then '님과 운동 짝꿍이 됐어요'
                              when 'pending' then case when cp.requester_user_id = p_user_id then '님에게 짝꿍 신청' else '님이 짝꿍 신청' end
                              else '님과 짝꿍 (' || cp.status || ')' end,
            null, '{}'::jsonb
       from public.boxing_cornerman_pairs cp
      where p_user_id in (cp.requester_user_id, cp.receiver_user_id)
      order by cp.created_at desc limit 20)
    union all
    -- 같이 운동할 사람 찾기 · 참여
    (select 'partner_call', pc.created_at, '같이 운동할 사람 찾기를 올렸어요',
            concat_ws(' · ', to_char(pc.call_date, 'MM/DD') || ' ' || pc.slot_hour || '시', nullif(btrim(pc.purpose), ''), nullif(btrim(pc.note), '')),
            '{}'::jsonb
       from public.boxing_partner_calls pc where pc.user_id = p_user_id
      order by pc.created_at desc limit 20)
    union all
    (select 'partner_join', j.created_at, coalesce((select n from nm where nm.user_id = pc.user_id), '회원') || '님 운동 모집에 참여',
            null, '{}'::jsonb
       from public.boxing_partner_call_joins j
       join public.boxing_partner_calls pc on pc.id = j.call_id
      where j.user_id = p_user_id
      order by j.created_at desc limit 20)
    union all
    -- 하트 보냄
    (select 'heart', l.created_at, coalesce((select n from nm where nm.user_id = l.target_id), '회원') || '님에게 하트',
            null, '{}'::jsonb
       from public.nickname_likes l where l.liker_id = p_user_id
      order by l.created_at desc limit 30)
    union all
    -- 복싱 IQ 퀴즈
    (select 'quiz', a.created_at, '복싱 IQ 퀴즈 ' || case when a.is_correct then '정답' else '오답' end,
            q.title, '{}'::jsonb
       from public.boxing_quiz_attempts a
       left join public.boxing_quiz_questions q on q.id = a.question_id
      where a.user_id = p_user_id
      order by a.created_at desc limit 30)
    union all
    -- 컨디션 기록 (코칭용 — 아픈 곳 · 메모)
    (select 'condition', c.created_at, '컨디션 기록',
            concat_ws(' · ', nullif(btrim(c.condition_type), ''),
                      case when c.energy_level is not null then '에너지 ' || c.energy_level end,
                      nullif(array_to_string(c.pain_area, ', '), ''),
                      nullif(btrim(c.note), '')),
            '{}'::jsonb
       from public.boxing_condition_logs c where c.user_id = p_user_id
      order by c.created_at desc limit 30)
    union all
    -- 반응속도 게임
    (select 'game', m.played_at, '반응속도 게임 ' || m.score || '점', nullif(btrim(m.tier), ''), '{}'::jsonb
       from public.minigame_records m where m.user_id = p_user_id
      order by m.played_at desc limit 30)
    union all
    -- 챌린지 도전
    (select 'challenge', a.created_at, coalesce(ch.title, '챌린지') || ' 도전',
            concat_ws(' · ', nullif(a.difficulty, ''), nullif(a.status, ''), a.submitted_value::text), '{}'::jsonb
       from public.boxing_fun_challenge_attempts a
       left join public.boxing_fun_challenges ch on ch.id = a.challenge_id
      where a.user_id = p_user_id
      order by a.created_at desc limit 30)
    union all
    -- 153 TEST
    (select 'test153', t.measured_at, '153 TEST ' || case when t.finished then '완주' else '측정' end,
            case when t.total_ms is not null then to_char((t.total_ms / 1000) * interval '1 second', 'MI:SS') end,
            '{}'::jsonb
       from public.test153_records t where t.user_id = p_user_id
      order by t.measured_at desc limit 20)
    union all
    -- 집에서 붕대 감기 연습
    (select 'handwrap', h.created_at, '집에서 붕대 감기 연습', null, '{}'::jsonb
       from public.handwrap_practice_logs h where h.user_id = p_user_id
      order by h.created_at desc limit 20)
    union all
    -- 레벨 · 승급
    (select 'level', h.created_at,
            '레벨 ' || ((coalesce(array_position(v_order, h.rank_name::text), 1) - 1) * 10 + h.level_number) || ' · '
            || case h.new_status::text when 'boss_cleared' then '타이틀매치 통과'
                                       when 'approved' then '완료'
                                       when 'pending' then '승인 대기'
                                       when 'in_progress' then '진행 시작'
                                       when 'revision_requested' then '보완 요청'
                                       when 'rejected' then '반려'
                                       else h.new_status::text end,
            nullif(btrim(h.change_reason), ''), '{}'::jsonb
       from public.level_status_history h where h.user_id = p_user_id
      order by h.created_at desc limit 40)
    union all
    -- 설문 참여 — 답변은 익명이라 참여만
    (select 'survey', s.granted_at,
            case s.kind when 'satisfaction' then '만족도 조사 참여' else '고객의 소리 참여' end, null, '{}'::jsonb
       from public.survey_rewards s where s.user_id = p_user_id
      order by s.granted_at desc limit 12)
    union all
    -- 마일리지 — 출석·레벨업 적립은 위 기록과 겹쳐서 뺀다 (전체 내역은 개요 탭 마일리지 칸, get_member_mileage)
    (select 'mileage', m.created_at,
            '마일리지 ' || case when m.amount > 0 then '+' else '' end || to_char(m.amount, 'FM999,999,990') || '점',
            m.reason, '{}'::jsonb
       from public.mileage_ledger m
      where m.user_id = p_user_id and m.kind not in ('attendance', 'level_up')
      order by m.created_at desc limit 30)
  )
  select coalesce(jsonb_agg(jsonb_build_object('type', z.t, 'at', z.at, 'title', z.title, 'detail', z.detail, 'meta', z.meta)
                            order by z.at desc), '[]'::jsonb)
    into v_out
    from (select * from ev where ev.at is not null order by ev.at desc limit v_limit) z;

  return jsonb_build_object('items', v_out);
end $$;

revoke all on function public.admin_member_activity(uuid, integer) from public, anon;
grant execute on function public.admin_member_activity(uuid, integer) to authenticated;
