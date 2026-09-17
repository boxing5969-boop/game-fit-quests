-- 153 커뮤니티 확장 RPC (2026-09-17)
--
-- 예외 메시지는 한국어로 직접 던진다 — approve_level_review 와 같은 방식.
-- (영문 코드를 던지고 프론트에서 매핑하는 방식은 매핑을 빠뜨리면 회원이 영문을 본다)
--
-- ⚠️ auth.uid() = profiles.user_id. profiles.id 로 조인하지 말 것.

-- ═══════════════ 오늘 파트너 구하기 ═══════════════

create or replace function public.create_partner_call(
  p_purpose text,
  p_slot_hour integer,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_rank text;
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;

  v_branch := public.boxing_community_my_branch();
  if v_branch is null or length(trim(v_branch)) = 0 then
    raise exception '지점 정보가 없어 모집 글을 올릴 수 없습니다 — 데스크에 문의해 주세요';
  end if;

  if p_purpose not in ('mitt','sparring','jump','together') then
    raise exception '모집 종류가 올바르지 않습니다';
  end if;
  if p_slot_hour is null or p_slot_hour < 5 or p_slot_hour > 23 then
    raise exception '시간은 오전 5시부터 오후 11시 사이로 골라주세요';
  end if;

  -- 스파링은 레드 리그부터. 맞대는 구간이 레드에서 열리기 때문에,
  -- 화이트·블루 회원이 스파링 상대를 모집하는 것은 서버에서 막는다.
  if p_purpose = 'sparring' then
    select current_rank::text into v_rank from public.member_progress where user_id = v_uid;
    if coalesce(v_rank, 'white') not in ('red','black') then
      raise exception '스파링 모집은 레드 리그(레벨 21)부터 가능합니다. 미트·줄넘기·같이 운동은 지금도 올릴 수 있습니다';
    end if;
  end if;

  insert into public.boxing_partner_calls (user_id, branch_name, call_date, slot_hour, purpose, note)
  values (v_uid, v_branch, v_today, p_slot_hour, p_purpose, nullif(btrim(coalesce(p_note,'')), ''))
  on conflict (user_id, call_date) do update
    set slot_hour = excluded.slot_hour,
        purpose   = excluded.purpose,
        note      = excluded.note,
        status    = 'open',
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('success', true, 'call_id', v_id);
end; $fn$;

create or replace function public.get_partner_calls()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_calls jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  if v_branch is null then
    return jsonb_build_object('success', true, 'calls', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'nickname', p.nickname,
           'isMine', c.user_id = v_uid,
           'slotHour', c.slot_hour,
           'purpose', c.purpose,
           'note', c.note,
           'rank', coalesce(mp.current_rank::text, 'white'),
           'joinCount', coalesce(j.cnt, 0),
           'joined', exists (
             select 1 from public.boxing_partner_call_joins x
             where x.call_id = c.id and x.user_id = v_uid
           )
         ) order by c.slot_hour, c.created_at), '[]'::jsonb)
    into v_calls
    from public.boxing_partner_calls c
    join public.profiles p on p.user_id = c.user_id
    left join public.member_progress mp on mp.user_id = c.user_id
    left join (
      select call_id, count(*)::int as cnt
      from public.boxing_partner_call_joins group by call_id
    ) j on j.call_id = c.id
   where c.branch_name = v_branch
     and c.call_date = v_today
     and c.status = 'open';

  return jsonb_build_object('success', true, 'branch', v_branch, 'calls', v_calls);
end; $fn$;

create or replace function public.join_partner_call(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_call record;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();

  select * into v_call from public.boxing_partner_calls
   where id = p_call_id and status = 'open'
     and call_date = (now() at time zone 'Asia/Seoul')::date;
  if not found then raise exception '이미 마감된 모집입니다'; end if;
  if v_call.branch_name is distinct from v_branch then
    raise exception '다른 지점의 모집에는 참여할 수 없습니다';
  end if;
  if v_call.user_id = v_uid then raise exception '본인이 올린 모집입니다'; end if;

  insert into public.boxing_partner_call_joins (call_id, user_id)
  values (p_call_id, v_uid)
  on conflict (call_id, user_id) do nothing;

  return jsonb_build_object('success', true);
end; $fn$;

create or replace function public.leave_partner_call(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.boxing_partner_call_joins
   where call_id = p_call_id and user_id = v_uid;
  return jsonb_build_object('success', true);
end; $fn$;

create or replace function public.close_partner_call(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  update public.boxing_partner_calls
     set status = 'closed', updated_at = now()
   where id = p_call_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception '본인이 올린 모집만 내릴 수 있습니다'; end if;
  return jsonb_build_object('success', true);
end; $fn$;

-- ═══════════════ 중고 장비 나눔 ═══════════════

create or replace function public.create_gear_post(
  p_kind text,
  p_gear_size text default null,
  p_condition text default 'good',
  p_deal text default 'free',
  p_note text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_open int;
  v_id uuid;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  if v_branch is null or length(trim(v_branch)) = 0 then
    raise exception '지점 정보가 없어 글을 올릴 수 없습니다 — 데스크에 문의해 주세요';
  end if;
  if p_kind not in ('glove','handwrap','shoes','rope','headgear','other') then
    raise exception '장비 종류가 올바르지 않습니다';
  end if;
  if coalesce(p_condition,'good') not in ('new','good','used') then
    raise exception '상태가 올바르지 않습니다';
  end if;
  if coalesce(p_deal,'free') not in ('free','transfer') then
    raise exception '나눔 또는 양도만 선택할 수 있습니다';
  end if;

  -- 한 사람이 올릴 수 있는 진행중 글은 3개까지
  select count(*) into v_open from public.boxing_gear_posts
   where user_id = v_uid and status = 'open';
  if v_open >= 3 then
    raise exception '진행중인 글이 3개입니다. 정리된 글을 먼저 완료로 바꿔주세요';
  end if;

  insert into public.boxing_gear_posts
    (user_id, branch_name, kind, gear_size, gear_condition, deal, note)
  values
    (v_uid, v_branch, p_kind,
     nullif(btrim(coalesce(p_gear_size,'')), ''),
     coalesce(p_condition,'good'), coalesce(p_deal,'free'),
     nullif(btrim(coalesce(p_note,'')), ''))
  returning id into v_id;

  return jsonb_build_object('success', true, 'post_id', v_id);
end; $fn$;

create or replace function public.get_gear_posts(p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_limit int := greatest(1, least(coalesce(p_limit,30), 100));
  v_posts jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  if v_branch is null then
    return jsonb_build_object('success', true, 'posts', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(t order by t->>'createdAt' desc), '[]'::jsonb)
    into v_posts
    from (
      select jsonb_build_object(
               'id', g.id,
               'nickname', p.nickname,
               'isMine', g.user_id = v_uid,
               'kind', g.kind,
               'size', g.gear_size,
               'condition', g.gear_condition,
               'deal', g.deal,
               'note', g.note,
               'createdAt', g.created_at
             ) as t
        from public.boxing_gear_posts g
        join public.profiles p on p.user_id = g.user_id
       where g.branch_name = v_branch and g.status = 'open'
       order by g.created_at desc
       limit v_limit
    ) s;

  return jsonb_build_object('success', true, 'branch', v_branch, 'posts', v_posts);
end; $fn$;

create or replace function public.close_gear_post(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  update public.boxing_gear_posts
     set status = 'done', updated_at = now()
   where id = p_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception '본인이 올린 글만 완료로 바꿀 수 있습니다'; end if;
  return jsonb_build_object('success', true);
end; $fn$;

-- ═══════════════ 타이틀매치 축하 피드 ═══════════════
-- 회원이 글을 쓰지 않아도 콘텐츠가 생긴다 — 승급 기록(level_status_history)을 읽는다.
-- 박수는 기존 send_boxing_cheer(cheer_type='clap', source_type='titlematch_feed') 를 쓴다.

create or replace function public.get_titlematch_feed(p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_limit int := greatest(1, least(coalesce(p_limit,20), 50));
  v_rows jsonb;
  v_order text[] := array['white','blue','red','black'];
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  if v_branch is null then
    return jsonb_build_object('success', true, 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(t order by t->>'at' desc), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
               'id', h.id,
               'userId', h.user_id,
               'nickname', p.nickname,
               'isMine', h.user_id = v_uid,
               'rank', h.rank_name::text,
               'globalLevel', (coalesce(array_position(v_order, h.rank_name::text), 1) - 1) * 10 + h.level_number,
               'at', h.created_at,
               'claps', (
                 select count(*) from public.boxing_cheers ch
                  where ch.source_type = 'titlematch_feed' and ch.source_id = h.id
               ),
               'clapped', exists (
                 select 1 from public.boxing_cheers ch
                  where ch.source_type = 'titlematch_feed' and ch.source_id = h.id
                    and ch.sender_user_id = v_uid
               )
             ) as t
        from public.level_status_history h
        join public.profiles p on p.user_id = h.user_id
       where h.new_status = 'boss_cleared'
         and h.created_at >= now() - interval '30 days'
         and p.branch_name = v_branch
         and coalesce(p.is_staff, false) = false
       order by h.created_at desc
       limit v_limit
    ) s;

  return jsonb_build_object('success', true, 'branch', v_branch, 'items', v_rows);
end; $fn$;

-- ═══════════════ 같은 시간대 팀 ═══════════════
-- 회원이 할 일이 없다 — 출석 시각으로 자동 계산한다.
-- 아침 회원과 저녁 회원이 서로를 모르는 단절을 푸는 것이 목적.

create or replace function public.get_time_crew()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_my_slot text;
  v_my_visits int := 0;
  v_slots jsonb;
  v_members jsonb;
  v_crew int := 0;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  if v_branch is null then
    return jsonb_build_object('success', true, 'slot', null, 'crewCount', 0);
  end if;

  -- 최근 60일, 하루 1회 인정된 출석만. 지점 회원별 '가장 많이 온 시간대'를 구한다.
  create temp table if not exists _crew_tmp (user_id uuid, slot text, visits int) on commit drop;
  delete from _crew_tmp;

  insert into _crew_tmp
  select user_id, slot, visits from (
    select a.user_id,
           case
             when h between 5 and 7   then 'dawn'
             when h between 8 and 11  then 'morning'
             when h between 12 and 14 then 'lunch'
             when h between 15 and 17 then 'afternoon'
             when h between 18 and 20 then 'evening'
             else 'night'
           end as slot,
           count(*)::int as visits,
           row_number() over (partition by a.user_id order by count(*) desc) as rn
      from (
        select al.user_id,
               extract(hour from (al.checked_in_at at time zone 'Asia/Seoul'))::int as h
          from public.attendance_logs al
          join public.profiles pr on pr.user_id = al.user_id
         where coalesce(al.is_duplicate, false) = false
           and al.checked_in_at >= now() - interval '60 days'
           and pr.branch_name = v_branch
           and coalesce(pr.is_staff, false) = false
      ) a
     group by a.user_id, 2
  ) ranked where rn = 1;

  select slot, visits into v_my_slot, v_my_visits from _crew_tmp where user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object('slot', slot, 'count', n) order by
           array_position(array['dawn','morning','lunch','afternoon','evening','night'], slot)), '[]'::jsonb)
    into v_slots
    from (select slot, count(*)::int as n from _crew_tmp group by slot) x;

  if v_my_slot is not null then
    select count(*)::int - 1 into v_crew from _crew_tmp where slot = v_my_slot;
    select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'visits', c.visits)
             order by c.visits desc), '[]'::jsonb)
      into v_members
      from _crew_tmp c
      join public.profiles p on p.user_id = c.user_id
     where c.slot = v_my_slot and c.user_id <> v_uid
     limit 1;
  end if;

  return jsonb_build_object(
    'success', true,
    'branch', v_branch,
    'slot', v_my_slot,
    'myVisits', coalesce(v_my_visits, 0),
    'crewCount', greatest(coalesce(v_crew, 0), 0),
    'members', coalesce(v_members, '[]'::jsonb),
    'slots', v_slots
  );
end; $fn$;

-- ═══════════════ 권한 ═══════════════
revoke execute on function public.create_partner_call(text, integer, text) from public;
revoke execute on function public.get_partner_calls() from public;
revoke execute on function public.join_partner_call(uuid) from public;
revoke execute on function public.leave_partner_call(uuid) from public;
revoke execute on function public.close_partner_call(uuid) from public;
revoke execute on function public.create_gear_post(text, text, text, text, text) from public;
revoke execute on function public.get_gear_posts(integer) from public;
revoke execute on function public.close_gear_post(uuid) from public;
revoke execute on function public.get_titlematch_feed(integer) from public;
revoke execute on function public.get_time_crew() from public;

grant execute on function public.create_partner_call(text, integer, text) to authenticated;
grant execute on function public.get_partner_calls() to authenticated;
grant execute on function public.join_partner_call(uuid) to authenticated;
grant execute on function public.leave_partner_call(uuid) to authenticated;
grant execute on function public.close_partner_call(uuid) to authenticated;
grant execute on function public.create_gear_post(text, text, text, text, text) to authenticated;
grant execute on function public.get_gear_posts(integer) to authenticated;
grant execute on function public.close_gear_post(uuid) to authenticated;
grant execute on function public.get_titlematch_feed(integer) to authenticated;
grant execute on function public.get_time_crew() to authenticated;
