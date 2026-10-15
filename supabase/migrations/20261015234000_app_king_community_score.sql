-- 앱활동왕 점수 바꾸기 (2026-10-15 대표님)
--   "QR 출석 · 운동 종료 누르기 · 장비 나눔 글은 빼 줘. 챌린지 아레나 · 복싱 퀴즈는 기능에서 빠졌으니 점수에서도 빼고
--    커뮤니티 활용을 점수로 하자. 설문·소리함을 쓰면 한 달에 한 번 점수가 올라가게."
--   앱활동 = (행동 종류, 날) 수 — 종류별 하루 1점. 이제 11종:
--     ① 앱 출석 체크(그날 처음 앱 열기)  ② 커뮤니티 '오늘 운동 한 줄' 글  ③ 커뮤니티 댓글  ④ 커뮤니티 '153' 반응
--     ⑤ 응원 보내기  ⑥ '오늘 같이 해요' 모집·참여  ⑦ 운동 짝꿍 신청·수락  ⑧ 하트 보내기
--     ⑨ 복싱 트레이닝 게임 플레이(대표님 추가)  ⑩ 만족도 조사(한 달 1번)  ⑪ 고객의 소리(한 달 1번)
--   점수는 그때그때 계산하므로 런칭 이벤트 기간(10/1~) 전체가 새 기준으로 다시 매겨진다.
--   나머지 왕좌(출석·연속·얼리버드·레벨업·닉네임·버피·체력)는 그대로.
CREATE OR REPLACE FUNCTION public._king_scores(p_category text, p_since timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(user_id uuid, score numeric, tie_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_sql text;
begin
  -- $1 = since (null = 하한 없음 · streak 은 최근 400일), $2 = until (null = 상한 없음)
  -- v4 (2026-10-15): 앱활동 = 커뮤니티 중심 11종 (위 마이그레이션 머리말). 나머지는 v3 그대로.
  --   출석·얼리버드·연속 = 얼굴 인식 출석(method broj/face)만. QR 은 체육관 밖에서도 찍힐 수 있어 왕좌에서 뺀다.
  --   얼리버드 = 새벽 5시~오전 9시(KST)에 들어온 날 수.
  --   레벨업 = '레벨업…' + '… 타이틀매치 클리어' XP 기록.
  --   버피 = 하루 최고 기록의 합 (한 번 기록 상한 = 상급 목표 × 3, NaN/Infinity 제외).
  --   체력 = 목표를 채운 (종목, 날) 수.
  --   닉네임 = 지금 받고 있는 좋아요(_counted_nickname_likes). 누른 좋아요는 취소 전까지 유효 → since 무시.
  v_sql := case p_category
    when 'attendance' then $q$
      with d as (
        select a.user_id as uid, (a.checked_in_at at time zone 'Asia/Seoul')::date as kd, min(a.checked_in_at) as first_at
          from public.attendance_logs a
         where a.method in ('broj', 'face')
           and a.checked_in_at <= now()
           and ($1::timestamptz is null or a.checked_in_at >= $1)
           and ($2::timestamptz is null or a.checked_in_at < $2)
         group by 1, 2)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'early_bird' then $q$
      with d as (
        select a.user_id as uid, (a.checked_in_at at time zone 'Asia/Seoul')::date as kd, min(a.checked_in_at) as first_at
          from public.attendance_logs a
         where a.method in ('broj', 'face')
           and a.checked_in_at <= now()
           and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') >= 5
           and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') < 9
           and ($1::timestamptz is null or a.checked_in_at >= $1)
           and ($2::timestamptz is null or a.checked_in_at < $2)
         group by 1, 2)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'streak' then $q$
      with days as (
        select distinct a.user_id as uid, (a.checked_in_at at time zone 'Asia/Seoul')::date as kd
          from public.attendance_logs a
         where a.method in ('broj', 'face')
           and a.checked_in_at <= now()
           and a.checked_in_at >= coalesce($1::timestamptz, now() - interval '400 days')
           and ($2::timestamptz is null or a.checked_in_at < $2)),
      runs as (
        select days.uid, days.kd, days.kd - (row_number() over (partition by days.uid order by days.kd))::int as grp
          from days),
      agg as (
        select runs.uid, runs.grp, count(*)::numeric as len, max(runs.kd) as last_d, min(runs.kd) as first_d
          from runs group by runs.uid, runs.grp)
      select agg.uid, agg.len, (agg.first_d::timestamp at time zone 'Asia/Seoul')
        from agg
       where agg.last_d >= (least(coalesce($2::timestamptz, now()), now()) at time zone 'Asia/Seoul')::date - 1 $q$
    when 'levelup' then $q$
      select x.user_id, count(*)::numeric, max(x.created_at)
        from public.xp_logs x
       where (x.reason like '레벨업%' or x.reason like '%타이틀매치 클리어%')
         and x.created_at <= now()
         and ($1::timestamptz is null or x.created_at >= $1)
         and ($2::timestamptz is null or x.created_at < $2)
       group by x.user_id $q$
    when 'burpee' then $q$
      with best as (
        select a.user_id as uid, (a.created_at at time zone 'Asia/Seoul')::date as kd,
               max(least(a.submitted_value,
                         greatest(coalesce((c.difficulty_targets ->> 'advanced')::numeric, 0) * 3, 1))) as v,
               max(a.created_at) as last_at
          from public.boxing_fun_challenge_attempts a
          join public.boxing_fun_challenges c on c.id = a.challenge_id
         where c.category = 'burpee'
           and a.status <> 'rejected'
           and a.submitted_value > 0
           and a.submitted_value < 'Infinity'::numeric
           and a.created_at <= now()
           and ($1::timestamptz is null or a.created_at >= $1)
           and ($2::timestamptz is null or a.created_at < $2)
         group by 1, 2)
      select best.uid, sum(best.v)::numeric, max(best.last_at) from best group by best.uid $q$
    when 'fitness' then $q$
      with d as (
        select a.user_id as uid, a.challenge_id, (a.created_at at time zone 'Asia/Seoul')::date as kd,
               min(a.created_at) as first_at
          from public.boxing_fun_challenge_attempts a
          join public.boxing_fun_challenges c on c.id = a.challenge_id
         where a.status = 'completed'
           and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
           and a.created_at <= now()
           and ($1::timestamptz is null or a.created_at >= $1)
           and ($2::timestamptz is null or a.created_at < $2)
         group by 1, 2, 3)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'app' then $q$
      with ev as (
        -- ① 앱 출석 체크 (그날 처음 앱 열기)
        select x.user_id as uid, 'open'::text as src, x.created_at as ts
          from public.xp_logs x where x.reason = '출석 체크'
        union all
        -- ② 커뮤니티 '오늘 운동 한 줄' 글 (숨김 처리된 글 제외)
        select j.user_id, 'post', j.created_at from public.champion_journal_entries j
         where j.kind = 'journal' and j.hidden_at is null
        union all
        -- ③ 커뮤니티 댓글
        select jc.commenter_user_id, 'comment', jc.created_at from public.champion_journal_comments jc
        union all
        -- ④ 커뮤니티 '153' 반응
        select r.user_id, 'react153', r.created_at from public.community_reactions r
        union all
        -- ⑤ 응원 보내기
        select ch.sender_user_id, 'cheer', ch.created_at from public.boxing_cheers ch
        union all
        -- ⑥ '오늘 같이 해요' 모집 · 참여
        select pc.user_id, 'partner', pc.created_at from public.boxing_partner_calls pc
        union all
        select pj.user_id, 'partner', pj.created_at from public.boxing_partner_call_joins pj
        union all
        -- ⑦ 운동 짝꿍 신청 · 수락
        select cp.requester_user_id, 'buddy', cp.requested_at from public.boxing_cornerman_pairs cp
        union all
        select cp.receiver_user_id, 'buddy', cp.accepted_at from public.boxing_cornerman_pairs cp
         where cp.accepted_at is not null
        union all
        -- ⑧ 하트 보내기
        select l.liker_id, 'like', l.created_at from public.nickname_likes l
        union all
        -- ⑨ 복싱 트레이닝 게임 플레이 (2026-10-15 대표님 추가 — 어느 게임이든 하루 1점)
        select mg.user_id, 'game', mg.played_at from public.minigame_records mg
        union all
        -- ⑩ 만족도 조사 · ⑩ 고객의 소리 — 종류별 한 달에 한 번 (보상 기록 기준, 그 달 첫 번째만)
        select sr.user_id, case when sr.kind = 'satisfaction' then 'survey' else 'voice' end, min(sr.granted_at)
          from public.survey_rewards sr
         where sr.kind in ('satisfaction', 'feedback')
         group by sr.user_id, sr.kind, sr.month
      ),
      d as (
        select ev.uid, ev.src, (ev.ts at time zone 'Asia/Seoul')::date as kd, min(ev.ts) as first_at
          from ev
         where ev.uid is not null and ev.ts is not null and ev.ts <= now()
           and ($1::timestamptz is null or ev.ts >= $1)
           and ($2::timestamptz is null or ev.ts < $2)
         group by 1, 2, 3)
      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'nickname' then $q$
      select c.target_id, count(*)::numeric, max(c.created_at)
        from public._counted_nickname_likes($2::timestamptz) c
       group by c.target_id $q$
    else null
  end;
  if v_sql is null then
    raise exception 'invalid category';
  end if;
  return query execute v_sql using p_since, p_until;
end;
$function$;
