-- 앱활동왕 — 휴대폰 알림 켜기 10점, 한 사람 한 번 (2026-10-15 대표님: "알람 켜면 10점, 1회만 가능")
--   처음 알림을 켠 날(push_subscriptions 가장 이른 created_at)에 10점. 나중에 껐다 켜도 다시 받지 않는다.
--   나머지 행동은 그대로 종류별 하루 1점. 20261015234000_app_king_community_score.sql 의 _king_scores v4 를 고친다.
do $patch$
declare
  d text;
  a1 constant text := $a$        select sr.user_id, case when sr.kind = 'satisfaction' then 'survey' else 'voice' end, min(sr.granted_at)$a$;
  b1 constant text := $b$        select ps.user_id, 'push', min(ps.created_at) from public.push_subscriptions ps group by ps.user_id
        union all
        select sr.user_id, case when sr.kind = 'satisfaction' then 'survey' else 'voice' end, min(sr.granted_at)$b$;
  a2 constant text := $a$      select d.uid, count(*)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'nickname'$a$;
  b2 constant text := $b$      select d.uid, sum(case when d.src = 'push' then 10 else 1 end)::numeric, max(d.first_at) from d group by d.uid $q$
    when 'nickname'$b$;
begin
  select pg_get_functiondef('public._king_scores(text, timestamptz, timestamptz)'::regprocedure) into d;
  if position(a1 in d) = 0 or position(a2 in d) = 0 then
    raise exception '_king_scores v4 본문이 예상과 달라요 — 수동 확인 필요';
  end if;
  if position($x$'push'$x$ in d) > 0 then
    return; -- 이미 적용됨
  end if;
  d := replace(replace(d, a1, b1), a2, b2);
  execute d;
end
$patch$;
