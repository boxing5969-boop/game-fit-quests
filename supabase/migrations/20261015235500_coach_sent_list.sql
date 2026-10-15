-- 🥊 오삼코치가 회원에게 보낸 메시지 기록 — 메시지 탭 '오삼코치'
--    (2026-10-15 대표님: "api가 회원님들에게 보낸 메세지는 메세지 탭에서 지점장이랑 내가 확인할수있게 해줘")
--
--   · coach_sent_list(커서, 개수) — 보낸 것(status = 'sent')만, 최근 보낸 순. 보기 전용.
--   · 본사(super_admin·admin)는 전 지점, 지점장(branch_manager)은 자기 지점만. 코치·회원은 볼 수 없다.
--   · 회원이 실제로 받은 글을 보여 준다 — 알림 제목·본문은 notifications 에서 (출석 칭찬은 제목이 출석 알림 제목),
--     '내 카드' 문장(detail)은 오늘의 목표·복귀 응원만 (출석 칭찬의 detail 은 회원 화면에 나오지 않는다).
--   · coach_dispatch 가 한 번에 여러 건을 보내 sent_at 이 같을 수 있다 → 더 보기 커서는 (sent_at, id).
--   · 첫 페이지에만 오늘(KST) 보낸 수 · 알림을 눌러 연 수를 붙인다.

create index if not exists coach_messages_sent_idx
  on public.coach_messages (sent_at desc, id desc)
  where status = 'sent';

create or replace function public.coach_sent_list(
  _before_at timestamptz default null,
  _before_id uuid default null,
  _limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _scope text;
  _n integer := least(greatest(coalesce(_limit, 30), 1), 100);
  _items jsonb;
  _more boolean;
  _today jsonb := null;
  _day_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  -- '*' = 전 지점, 지점 이름 = 그 지점만, null = 권한 없음
  _scope := case
    when public.has_role(_uid, 'super_admin') or public.has_role(_uid, 'admin') then '*'
    when public.has_role(_uid, 'branch_manager')
      then (select nullif(btrim(p.branch_name), '') from public.profiles p where p.user_id = _uid)
  end;
  if _scope is null then raise exception 'Not authorized'; end if;

  with page as (
    select m.id, m.sent_at,
           jsonb_build_object(
             'id', m.id,
             'kind', m.kind,
             'source', m.source,
             'title', coalesce(n.title, m.title),
             'body', coalesce(n.body, m.body),
             'card', case when m.kind in ('daily_goal', 'comeback') then m.detail end,
             'member', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
             'member_name', nullif(btrim(p.name), ''),
             'level_label', m.facts ->> 'level_label',
             'branch', m.branch_name,
             'sent_at', m.sent_at,
             'opened_at', m.opened_at,
             'reviewer', coalesce(nullif(btrim(r.nickname), ''), nullif(btrim(r.name), ''))
           ) as j
      from public.coach_messages m
      left join public.notifications n on n.id = m.notification_id
      left join public.profiles p on p.user_id = m.user_id
      left join public.profiles r on r.user_id = m.reviewed_by
     where m.status = 'sent'
       and m.sent_at is not null
       and (_scope = '*' or m.branch_name = _scope)
       and (_before_at is null
            or (m.sent_at, m.id) < (_before_at, coalesce(_before_id, '00000000-0000-0000-0000-000000000000'::uuid)))
     order by m.sent_at desc, m.id desc
     limit _n + 1
  ), numbered as (
    select page.*, row_number() over (order by page.sent_at desc, page.id desc) as rn
      from page
  )
  select coalesce(jsonb_agg(numbered.j order by numbered.rn) filter (where numbered.rn <= _n), '[]'::jsonb),
         coalesce(max(numbered.rn), 0) > _n
    into _items, _more
    from numbered;

  if _before_at is null then
    select jsonb_build_object('sent', count(*), 'opened', count(*) filter (where m.opened_at is not null))
      into _today
      from public.coach_messages m
     where m.status = 'sent'
       and m.sent_at >= _day_start
       and (_scope = '*' or m.branch_name = _scope);
  end if;

  return jsonb_build_object(
    'scope', case when _scope = '*' then 'all' else _scope end,
    'items', _items,
    'has_more', _more,
    'today', _today);
end;
$$;

revoke all on function public.coach_sent_list(timestamptz, uuid, integer) from public, anon;
grant execute on function public.coach_sent_list(timestamptz, uuid, integer) to authenticated;
