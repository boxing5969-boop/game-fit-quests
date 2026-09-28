-- 기존회원 연동 데이터 병합 (2026-09-28)
-- 소셜(카카오/구글) 가입 계정(to)이 전화번호로 일괄등록 계정(from)을 연동할 때 from 의 기록을 전부 to 로 옮긴다.
-- 예전 link-imported-by-phone 은 from 을 바로 삭제해 레벨·XP·배지가 cascade 로 사라지고, 출석 기록은 고아가 되어
-- 라이브보드에 같은 회원이 두 명(Lv.10 / Lv.1)으로 떴다.
--  · public 스키마의 uuid 컬럼 중 from 의 id 를 담은 행을 모두 to 로 옮긴다(카탈로그 기반 — 새 테이블도 자동 포함).
--    uuid 는 전역 유일이라 from 의 id 와 같은 값은 곧 from 계정 참조다.
--  · 1인 1행 테이블: member_progress(레벨 높은 쪽 기준 + XP 합산, overall_level 은 생성 컬럼), user_wallets(젬 합산),
--    level_status(더 진행된 심사 상태), profiles(to 유지 — 지점·수강권·생년월일 등만 가져오고 전화번호 이전),
--    user_roles(member 만 — 지도진·관리자 권한 계정은 병합 거부).
--  · 그 밖의 유니크 충돌은 to 의 행을 남기고, 본인끼리의 좋아요·응원 같은 not-self 위반 행은 지운다.
--  · 같은 날(KST) 인정 출석은 1건 — 이른 것만 남기고 나머지는 is_duplicate.
--    to 쪽 출석의 낮은 레벨 스냅샷은 병합 레벨로 보정(라이브보드가 오늘 마지막 출석 스냅샷을 보여준다).
--  · 감사 테이블(admin_bulk_actions)은 건드리지 않는다. 결과는 account_link_events 에 남긴다.
--  · 서비스 롤 전용 — link-imported-by-phone 에지 함수가 호출한다.
create or replace function public.merge_linked_account(p_from uuid, p_to uuid, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_a        public.profiles%rowtype;
  v_mp_a     public.member_progress%rowtype;
  v_mp_b     public.member_progress%rowtype;
  v_base     public.member_progress%rowtype;
  v_other    public.member_progress%rowtype;
  v_w_a      public.user_wallets%rowtype;
  v_w_b      public.user_wallets%rowtype;
  v_phone    text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_b_att    uuid[];
  v_moved    jsonb := '{}'::jsonb;
  v_dropped  jsonb := '{}'::jsonb;
  v_dedup    integer := 0;
  v_resnap   integer := 0;
  v_event_id bigint;
  v_result   jsonb;
  t          record;
  r          record;
  n          bigint;
  d          bigint;
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'merge_linked_account: 잘못된 계정 지정';
  end if;

  -- 같은 계정을 두 요청이 동시에 병합하지 않도록 두 id 를 정해진 순서로 잠근다.
  perform pg_advisory_xact_lock(hashtext('merge_linked_account:' || least(p_from, p_to)::text));
  perform pg_advisory_xact_lock(hashtext('merge_linked_account:' || greatest(p_from, p_to)::text));

  if not exists (select 1 from auth.users where id = p_to) then
    raise exception 'merge_linked_account: 대상 계정이 없습니다';
  end if;
  perform 1 from public.profiles where user_id = p_to for update;
  if not found then
    raise exception 'merge_linked_account: 대상 프로필이 없습니다';
  end if;
  if exists (select 1 from public.profiles where user_id = p_to and must_change_credentials is true) then
    raise exception 'merge_linked_account: 대상이 아직 넘겨받지 않은 일괄등록 계정입니다';
  end if;

  select * into v_a from public.profiles where user_id = p_from for update;
  if found and v_a.must_change_credentials is not true then
    raise exception 'merge_linked_account: 이미 사용 중인 계정은 병합할 수 없습니다';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_from and role <> 'member') then
    raise exception 'merge_linked_account: 지도진·관리자 권한이 있는 계정은 병합할 수 없습니다';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_b_att
    from public.attendance_logs where user_id = p_to;

  -- 1) 프로필: to 를 유지하고 등록 정보만 가져온다. 전화번호는 from 에서 떼어 to 에 붙인다.
  --    닉네임은 가져오지 않는다(일괄등록 닉네임은 이름이 없으면 전화번호라 TV 에 노출될 수 있다).
  if v_a.user_id is not null then
    v_phone := coalesce(v_phone, nullif(regexp_replace(coalesce(v_a.phone_number, ''), '[^0-9]', '', 'g'), ''));
    update public.profiles set phone_number = null where user_id = p_from and phone_number is not null;
    update public.profiles b set
      phone_number            = coalesce(b.phone_number, v_phone),
      branch_name             = coalesce(nullif(btrim(v_a.branch_name), ''), b.branch_name),
      gym_reg_date            = coalesce(v_a.gym_reg_date, b.gym_reg_date),
      membership_end          = greatest(v_a.membership_end, b.membership_end),
      birth_date              = coalesce(nullif(btrim(v_a.birth_date), ''), b.birth_date),
      is_approved             = coalesce(v_a.is_approved, true) or coalesce(b.is_approved, false),
      payment_total           = greatest(v_a.payment_total, b.payment_total),
      gender                  = coalesce(b.gender, v_a.gender),
      name                    = coalesce(nullif(btrim(b.name), ''), v_a.name),
      avatar_url              = coalesce(b.avatar_url, v_a.avatar_url),
      is_staff                = coalesce(b.is_staff, false) or coalesce(v_a.is_staff, false),
      staff_title             = coalesce(b.staff_title, v_a.staff_title),
      staff_source            = coalesce(b.staff_source, v_a.staff_source),
      last_unlock_check_level = greatest(b.last_unlock_check_level, v_a.last_unlock_check_level),
      fitness_goal            = coalesce(b.fitness_goal, v_a.fitness_goal),
      health_notes            = coalesce(b.health_notes, v_a.health_notes)
    where b.user_id = p_to;
  elsif v_phone is not null then
    update public.profiles set phone_number = v_phone where user_id = p_to and phone_number is null;
  end if;

  -- 2) 역할: member 만 옮긴다(지도진·관리자 권한 계정은 위에서 거부).
  delete from public.user_roles x
   where x.user_id = p_from and x.role = 'member'
     and exists (select 1 from public.user_roles y where y.user_id = p_to and y.role = 'member');
  update public.user_roles set user_id = p_to where user_id = p_from and role = 'member';

  -- 3) 레벨·XP: 레벨이 높은 쪽을 기준으로, XP 는 합산한다(xp_logs 도 합쳐지므로 합계가 맞는다).
  select * into v_mp_a from public.member_progress where user_id = p_from for update;
  select * into v_mp_b from public.member_progress where user_id = p_to for update;
  if v_mp_a.user_id is not null then
    if v_mp_b.user_id is null then
      update public.member_progress set user_id = p_to where user_id = p_from;
    else
      if (v_mp_a.current_rank, v_mp_a.current_level) >= (v_mp_b.current_rank, v_mp_b.current_level) then
        v_base := v_mp_a; v_other := v_mp_b;
      else
        v_base := v_mp_b; v_other := v_mp_a;
      end if;
      delete from public.member_progress where user_id = p_from;
      update public.member_progress set
        current_rank          = v_base.current_rank,
        current_level         = v_base.current_level,
        level_started_at      = v_base.level_started_at,
        fast_track_gates      = v_base.fast_track_gates,
        total_xp              = coalesce(v_mp_a.total_xp, 0) + coalesce(v_mp_b.total_xp, 0),
        streak_days           = greatest(coalesce(v_mp_a.streak_days, 0), coalesce(v_mp_b.streak_days, 0)),
        bosses_cleared        = greatest(coalesce(v_mp_a.bosses_cleared, 0), coalesce(v_mp_b.bosses_cleared, 0)),
        master_track_unlocked = coalesce(v_mp_a.master_track_unlocked, false) or coalesce(v_mp_b.master_track_unlocked, false),
        master_level          = greatest(coalesce(v_mp_a.master_level, 0), coalesce(v_mp_b.master_level, 0)),
        rival_id              = coalesce(v_base.rival_id, v_other.rival_id)
      where user_id = p_to;
    end if;
  end if;

  -- 4) 젬 지갑: 합산한다(wallet_transactions 도 합쳐지므로 잔액과 거래 합계가 맞는다).
  select * into v_w_a from public.user_wallets where user_id = p_from for update;
  select * into v_w_b from public.user_wallets where user_id = p_to for update;
  if v_w_a.user_id is not null then
    if v_w_b.user_id is null then
      update public.user_wallets set user_id = p_to where user_id = p_from;
    else
      update public.user_wallets set
        gems_balance = coalesce(v_w_b.gems_balance, 0) + coalesce(v_w_a.gems_balance, 0),
        total_earned = coalesce(v_w_b.total_earned, 0) + coalesce(v_w_a.total_earned, 0),
        total_spent  = coalesce(v_w_b.total_spent, 0) + coalesce(v_w_a.total_spent, 0),
        updated_at   = now()
      where user_id = p_to;
      delete from public.user_wallets where user_id = p_from;
    end if;
  end if;

  -- 5) 레벨 심사 상태: 같은 레벨 행이 둘이면 더 진행된 상태를 남기고, 이력은 남는 행으로 잇는다.
  for r in
    select x.id as a_id, y.id as b_id,
           case x.status when 'boss_cleared' then 7 when 'approved' then 6 when 'pending' then 5
                         when 'revision_requested' then 4 when 'rejected' then 3 when 'in_progress' then 2
                         when 'locked' then 1 else 0 end as a_pri,
           case y.status when 'boss_cleared' then 7 when 'approved' then 6 when 'pending' then 5
                         when 'revision_requested' then 4 when 'rejected' then 3 when 'in_progress' then 2
                         when 'locked' then 1 else 0 end as b_pri
      from public.level_status x
      join public.level_status y
        on y.user_id = p_to and y.rank_name = x.rank_name and y.level_number = x.level_number
     where x.user_id = p_from
  loop
    if r.a_pri > r.b_pri then
      update public.level_status_history set level_status_id = r.a_id where level_status_id = r.b_id;
      delete from public.level_status where id = r.b_id;
    else
      update public.level_status_history set level_status_id = r.b_id where level_status_id = r.a_id;
      delete from public.level_status where id = r.a_id;
    end if;
  end loop;
  update public.level_status set user_id = p_to where user_id = p_from;

  -- 6) 나머지 전부: from 의 id 를 담은 uuid 컬럼을 to 로 바꾼다.
  --    유니크 충돌이 나면 행 단위로 옮기고, 충돌 행은 to 의 것을 남긴다.
  --    자기 자신을 가리키게 되는 행(본인 좋아요·응원·코너맨 짝 — not-self 체크 위반)은 지운다.
  for t in
    select format('%I.%I', ns.nspname, cl.relname) as tbl, cl.relname::text as relname, a.attname::text as col
      from pg_class cl
      join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
      join pg_attribute a on a.attrelid = cl.oid and a.attnum > 0 and not a.attisdropped
     where cl.relkind = 'r'
       and a.atttypid = 'uuid'::regtype
       and a.attname <> 'id'
       and cl.relname not in ('profiles', 'user_roles', 'user_wallets', 'account_link_events', 'admin_bulk_actions')
       and not (cl.relname in ('member_progress', 'level_status') and a.attname = 'user_id')
       and not exists (
             select 1 from pg_constraint c
              where c.conrelid = cl.oid and c.contype = 'f' and a.attnum = any (c.conkey)
                and c.confrelid <> 'auth.users'::regclass)
     order by cl.relname, a.attname
  loop
    n := 0;
    d := 0;
    begin
      execute format('update %s set %I = $1 where %I = $2', t.tbl, t.col, t.col) using p_to, p_from;
      get diagnostics n = row_count;
    exception when unique_violation or check_violation then
      n := 0;
      for r in execute format('select ctid as rid from %s where %I = $1', t.tbl, t.col) using p_from loop
        begin
          execute format('update %s set %I = $1 where ctid = $2', t.tbl, t.col) using p_to, r.rid;
          n := n + 1;
        exception when unique_violation or check_violation then
          execute format('delete from %s where ctid = $1', t.tbl) using r.rid;
          d := d + 1;
        end;
      end loop;
    end;
    if n > 0 then v_moved := v_moved || jsonb_build_object(t.relname || '.' || t.col, n); end if;
    if d > 0 then v_dropped := v_dropped || jsonb_build_object(t.relname || '.' || t.col, d); end if;
  end loop;

  -- 7) 자기 자신을 라이벌로 가리키게 된 참조 정리
  update public.member_progress set rival_id = null where user_id = p_to and rival_id in (p_from, p_to);

  -- 8) 같은 날(KST) 인정 출석은 1건 — 이른 것만 남기고 나머지는 중복 표시.
  with ranked as (
    select id,
           row_number() over (partition by (checked_in_at at time zone 'Asia/Seoul')::date
                              order by checked_in_at, id) as rn
      from public.attendance_logs
     where user_id = p_to and coalesce(is_duplicate, false) = false
  )
  update public.attendance_logs x set is_duplicate = true
    from ranked where x.id = ranked.id and ranked.rn > 1;
  get diagnostics v_dedup = row_count;

  -- 9) to 쪽 출석의 레벨 스냅샷이 병합 레벨보다 낮으면 보정한다.
  select * into v_mp_b from public.member_progress where user_id = p_to;
  if v_mp_b.user_id is not null and cardinality(v_b_att) > 0 then
    update public.attendance_logs x set
      league_snapshot = v_mp_b.current_rank::text,
      level_snapshot  = v_mp_b.current_level
     where x.id = any (v_b_att)
       and (case x.league_snapshot when 'white' then 0 when 'blue' then 1 when 'red' then 2 when 'black' then 3 else -1 end,
            coalesce(x.level_snapshot, 0))
         < (case v_mp_b.current_rank::text when 'white' then 0 when 'blue' then 1 when 'red' then 2 when 'black' then 3 else -1 end,
            v_mp_b.current_level);
    get diagnostics v_resnap = row_count;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'moved', v_moved,
    'dropped', v_dropped,
    'attendance_deduped', v_dedup,
    'attendance_resnapshotted', v_resnap,
    'progress', (select jsonb_build_object('rank', current_rank, 'level', current_level, 'total_xp', total_xp)
                   from public.member_progress where user_id = p_to),
    'gems', (select gems_balance from public.user_wallets where user_id = p_to));

  update public.account_link_events set merged_at = now(), merge_result = v_result
   where id = (select e.id from public.account_link_events e
                where e.from_user_id = p_from and e.to_user_id = p_to and e.merged_at is null
                order by e.id limit 1)
  returning id into v_event_id;
  if v_event_id is null then
    insert into public.account_link_events (from_user_id, to_user_id, merged_at, merge_result)
    values (p_from, p_to, now(), v_result)
    returning id into v_event_id;
  end if;

  return v_result || jsonb_build_object('event_id', v_event_id);
end;
$function$;

revoke all on function public.merge_linked_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_linked_account(uuid, uuid, text) to service_role;