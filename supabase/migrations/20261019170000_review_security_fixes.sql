-- 검수 반영 (2026-10-19 대표님: "최고성능으로 검수하자" — 독립 검수 6명 + 교차 확인)
--   1) 승인된 회원만 — 지점 명단 · 피드 · 회원 카드 · 환영 인사 · 초대 · 장비 나눔 · 일지 · 지점 목표 함수에 서버 확인 추가
--      (지금까지는 앱 화면만 승인을 확인해서, 아무나 가입하면서 지점을 고르면 그 지점 명단 · 글을 함수로 바로 읽을 수 있었다)
--   2) 초대 보상 — 승인된 계정만 · 전화번호로 찾은 초대는 초대 뒤에 새로 만든 계정만 · 한 달 20번을 동시에 넘지 않게
--   3) 지점 목표(짐 레이드) — 진행 중 3개까지 · 운영진이 아니면 목표 20 이상 · 머니 100 이하 · 목표 시작 전 기록은 안 셈 ·
--      한 사람 하루 10번까지 · 코치님·운영진은 보상 없음 (목표를 마구 만들어 머니를 찍어 내지 못하게)
--   4) 직원 카드 직책 — profiles.staff_title 도 돌려준다 (다른 화면 · TV 와 같은 기준)
--   5) 자동 등록 알림 — 10분 안에 또 오면 새 알림(푸시) 대신 '○○님 등 여러 명'으로 묶기 · '승인됐어요' 대신 정확한 문구
--   6) 메달 이름 연결 — 본인이 이름을 바꿔서는 남의 메달을 가져가지 못하게 (가입 · 운영진 수정 때만)
--   7) 추격 목표 — 본인 · 코치님·운영진 · 순위 밖 계정은 못 고르게
--   8) 글 사진 주소 — 우리 저장소의 '내 폴더' 사진만
--   9) 의견·신고 — 정해진 칸만 넣기 · 하루 10번 · 상태/처리자/시각을 꾸며 넣지 못하게
--  10) 내부 확인 함수 — 앱에서 직접 부르지 못하게 (다른 사람의 첫 방문일 · 권한 · 지점을 캐낼 수 없게)

-- 1) 승인된 회원인지 ────────────────────────────────────────────
create or replace function public._is_active_member(p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p_uid is not null and (
    exists (select 1 from public.profiles p where p.user_id = p_uid and coalesce(p.is_approved, false))
    or exists (select 1 from public.user_roles r
                where r.user_id = p_uid and r.role in ('super_admin', 'admin', 'branch_manager', 'coach'))
  );
$$;
revoke all on function public._is_active_member(uuid) from public, anon, authenticated;

do $do$
declare
  v_gate constant text := E'\n  if not public._is_active_member(auth.uid()) then raise exception ''승인된 회원만 쓸 수 있어요'' using errcode = ''42501''; end if;';
  v_lc constant text := 'if v_uid is null then raise exception ''로그인이 필요합니다''; end if;';
  v_ar constant text := 'if v_uid is null then raise exception ''auth required''; end if;';
  v_up constant text := E'IF v_uid IS NULL THEN\n    RAISE EXCEPTION ''auth required'';\n  END IF;';
  v_au constant text := 'if auth.uid() is null then raise exception ''auth required''; end if;';
  v_targets text[] := array[
    'public.search_cornerman_candidates(text,integer)|ar',
    'public.get_cornerman_candidates(integer)|up',
    'public.get_cornerman_people(integer)|ar',
    'public.search_cornerman_people(text,integer)|ar',
    'public.send_member_invite(uuid)|lc',
    'public.send_community_welcome(uuid,text)|lc',
    'public.get_community_welcomes(uuid)|lc',
    'public.create_gear_post_v2(text,text,text,text,text,integer)|lc',
    'public.create_gear_post(text,text,text,text,text)|lc',
    'public.get_gear_posts(integer)|lc',
    'public.get_branch_gym_raids(text)|ar',
    'public.get_community_feed(integer)|lc',
    'public.submit_champion_journal_entry(text,text,text)|up',
    'public.submit_champion_journal_entry_v2(text,text,text,text)|au',
    'public.get_member_license(uuid)|lc',
    'public.contribute_to_gym_raid(text,uuid)|up',
    'public.claim_gym_raid_reward(uuid)|up'
  ];
  v_item text; v_sig text; v_pat text; v_def text; v_cnt int;
begin
  foreach v_item in array v_targets loop
    v_sig := split_part(v_item, '|', 1);
    v_pat := case split_part(v_item, '|', 2) when 'lc' then v_lc when 'ar' then v_ar when 'up' then v_up else v_au end;
    v_def := pg_get_functiondef(v_sig::regprocedure);
    if position('_is_active_member' in v_def) > 0 then continue; end if;
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'gate patch % : pattern matched % times', v_sig, v_cnt; end if;
    execute replace(v_def, v_pat, v_pat || v_gate);
  end loop;
end $do$;

-- 2) 초대 보상 ──────────────────────────────────────────────────
create or replace function public.claim_invite_reward()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_created timestamptz;
  v_first public.member_invites%rowtype;
  v_cnt int;
  v_rewarded boolean := false;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if v_uid is null then return jsonb_build_object('success', true, 'rewarded', false); end if;
  -- 승인된 회원만 (아무나 만든 계정이 초대 보상을 가로채지 못하게)
  if not public._is_active_member(v_uid) then return jsonb_build_object('success', true, 'rewarded', false); end if;
  select nullif(regexp_replace(coalesce(p.phone_number, ''), '[^0-9]', '', 'g'), ''), u.created_at
    into v_phone, v_created
    from public.profiles p join auth.users u on u.id = p.user_id
   where p.user_id = v_uid;

  -- 초대받은 계정 그대로이거나, 전화번호가 같으면서 초대 뒤에 새로 만든 계정만
  select i.* into v_first
    from public.member_invites i
   where i.joined_at is null and i.inviter_user_id <> v_uid
     and (i.invitee_user_id = v_uid
          or (v_phone is not null and i.invitee_phone = v_phone and v_created > i.created_at))
   order by i.created_at asc
   limit 1
   for update;
  if not found then return jsonb_build_object('success', true, 'rewarded', false); end if;

  update public.member_invites i
     set joined_at = now(), joined_user_id = v_uid
   where i.joined_at is null
     and (i.invitee_user_id = v_uid
          or (v_phone is not null and i.invitee_phone = v_phone and v_created > i.created_at));

  -- 한 달 20번 — 동시에 여러 명이 들어와도 넘지 않게 초대한 사람마다 줄 세운다
  perform pg_advisory_xact_lock(hashtext('invite_reward:' || v_first.inviter_user_id::text));

  if exists (select 1 from public.profiles p where p.user_id = v_first.inviter_user_id) then
    select count(*) into v_cnt from public.member_invites i
     where i.inviter_user_id = v_first.inviter_user_id and i.rewarded and i.joined_at >= v_month_start;
    if v_cnt < 20 then
      perform public.grant_gems(v_first.inviter_user_id, 1000, '친구 초대 보상');
      update public.member_invites set rewarded = true, reward_amount = 1000 where id = v_first.id;
      insert into public.notifications (user_id, title, body, link)
      values (v_first.inviter_user_id,
              '🎉 ' || coalesce(public._community_display_name(v_uid), '회원') || '님이 앱에 들어왔어요',
              '초대 보상으로 챔피언 머니 +1,000을 받았어요. 운동 짝꿍도 신청해 보세요!',
              '/myboxer/community');
      v_rewarded := true;
    end if;
  end if;

  return jsonb_build_object('success', true, 'rewarded', v_rewarded,
                            'inviter', public._community_display_name(v_first.inviter_user_id));
end $function$;

-- 3) 지점 목표 · 4) 직원 직책 ─────────────────────────────────────
do $do$
declare
  v_def text;
  v_pat text;
  v_cnt int;
  procedure_patch text;
begin
  -- 3-a) create_gym_raid: 진행 중 3개까지 · 운영진이 아니면 목표 20 이상 · 머니 100 이하
  v_def := pg_get_functiondef('public.create_gym_raid(text,text,text,text,integer,date,date,integer,integer,integer)'::regprocedure);
  if position('진행 중인 지점 목표는 3개까지' in v_def) = 0 then
    v_pat := E'  if coalesce(p_reward_respect, 0) not between 0 and 100 then raise exception ''리스펙트 보상은 0~100 사이예요''; end if;\n';
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'create_gym_raid patch matched % times', v_cnt; end if;
    execute replace(v_def, v_pat, v_pat ||
      E'  -- 2026-10-19 검수: 목표를 마구 만들어 보상을 찍어 내지 못하게\n'
      || E'  perform pg_advisory_xact_lock(hashtext(''gym_raid:'' || v_branch));\n'
      || E'  if (select count(*) from public.boxing_gym_raids g where g.branch_name = v_branch and g.status = ''active'') >= 3 then\n'
      || E'    raise exception ''진행 중인 지점 목표는 3개까지예요. 하나를 끝내고 만들어 주세요'';\n'
      || E'  end if;\n'
      || E'  if not (public.has_role(v_uid, ''super_admin'') or public.has_role(v_uid, ''admin'')) then\n'
      || E'    if p_target < 20 then raise exception ''목표 숫자는 20 이상으로 적어 주세요''; end if;\n'
      || E'    if coalesce(p_reward_gems, 0) > 100 then raise exception ''챔피언 머니 보상은 100까지예요. 더 크게는 운영진에게 요청해 주세요''; end if;\n'
      || E'  end if;\n');
  end if;

  -- 3-b) claim_gym_raid_reward: 코치님·운영진은 보상 없음
  v_def := pg_get_functiondef('public.claim_gym_raid_reward(uuid)'::regprocedure);
  if position('지점 목표 보상을 받지 않아요' in v_def) = 0 then
    v_pat := E'  PERFORM public.boxing_gym_raid_lazy_expire();\n\n  SELECT * INTO v_raid FROM public.boxing_gym_raids WHERE id = p_raid_id;';
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'claim_gym_raid_reward patch matched % times', v_cnt; end if;
    execute replace(v_def, v_pat,
      E'  IF public._dm_kind(v_uid) IN (''coach'', ''hq'') THEN\n    RAISE EXCEPTION ''코치님·운영진은 지점 목표 보상을 받지 않아요'';\n  END IF;\n\n' || v_pat);
  end if;

  -- 3-c) contribute_to_gym_raid: 목표 시작 전 기록은 안 셈 · 한 사람 하루 10번
  v_def := pg_get_functiondef('public.contribute_to_gym_raid(text,uuid)'::regprocedure);
  if position('v_source_at' in v_def) = 0 then
    v_pat := E'  v_inserted_count integer := 0;\nBEGIN';
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'contribute decl patch matched % times', v_cnt; end if;
    v_def := replace(v_def, v_pat, E'  v_inserted_count integer := 0;\n  v_source_at timestamptz;\nBEGIN');

    v_pat := '  -- 회원의 branch + 매칭되는 active raid 찾기';
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'contribute source patch matched % times', v_cnt; end if;
    v_def := replace(v_def, v_pat,
      E'  -- 2026-10-19 검수: 목표가 생기기 전에 쓴 글·응원은 세지 않는다 (예전 기록을 다시 보내 혼자 채우지 못하게)\n'
      || E'  v_source_at := CASE p_source_type\n'
      || E'    WHEN ''boxing_quiz_attempt'' THEN (SELECT created_at FROM public.boxing_quiz_attempts WHERE id = v_resolved_source_id)\n'
      || E'    WHEN ''boxing_fun_challenge_attempt'' THEN (SELECT created_at FROM public.boxing_fun_challenge_attempts WHERE id = v_resolved_source_id)\n'
      || E'    WHEN ''champion_journal_entry'' THEN (SELECT created_at FROM public.champion_journal_entries WHERE id = v_resolved_source_id)\n'
      || E'    WHEN ''boxing_cheer'' THEN (SELECT created_at FROM public.boxing_cheers WHERE id = v_resolved_source_id)\n'
      || E'  END;\n\n' || v_pat);

    v_pat := '    -- contribution insert (UNIQUE 충돌 시 무시)';
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'contribute loop patch matched % times', v_cnt; end if;
    v_def := replace(v_def, v_pat,
      E'    IF v_source_at IS NOT NULL AND v_source_at < v_raid.created_at THEN\n      CONTINUE;\n    END IF;\n'
      || E'    IF (SELECT count(*) FROM public.boxing_gym_raid_contributions c\n'
      || E'         WHERE c.raid_id = v_raid.id AND c.user_id = v_uid AND c.contributed_at > now() - interval ''1 day'') >= 10 THEN\n'
      || E'      CONTINUE;\n    END IF;\n' || v_pat);
    execute v_def;
  end if;

  -- 4) get_member_license: 직원 직책(staff_title)도 돌려준다
  v_def := pg_get_functiondef('public.get_member_license(uuid)'::regprocedure);
  if position('''staff_title''' in v_def) = 0 then
    v_pat := E'    ''staff_role'', v_staff\n  );';
    v_cnt := (length(v_def) - length(replace(v_def, v_pat, ''))) / length(v_pat);
    if v_cnt <> 1 then raise exception 'get_member_license patch matched % times', v_cnt; end if;
    execute replace(v_def, v_pat,
      E'    ''staff_role'', v_staff,\n    ''staff_title'', case when v_staff is not null then nullif(btrim(v_t.staff_title), '''') end\n  );');
  end if;
end $do$;

-- 5) 자동 등록 알림 ─────────────────────────────────────────────
create or replace function public.notify_auto_member_joined(_member uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_branch text;
  v_name text;
  v_title text := '🎉 새 회원 · 자동 등록';
  v_tail text := ' — 브로제이에 등록된 회원이라 앱 계정이 자동으로 만들어졌어요. 보통은 따로 승인할 것이 없어요 (승인 대기에 보이면 승인만 눌러 주세요)';
  r record;
begin
  select p.branch_name, coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원')
    into v_branch, v_name
    from public.profiles p where p.user_id = _member;

  for r in
    select x.uid from (
      select ur.user_id as uid from public.user_roles ur where ur.role = 'super_admin'
      union
      select ur.user_id
        from public.user_roles ur
        join public.profiles sp on sp.user_id = ur.user_id
       where ur.role in ('branch_manager', 'coach') and v_branch is not null and sp.branch_name = v_branch
    ) x
    where x.uid <> _member
  loop
    -- 10분 안에 같은 알림이 있으면 새 알림(푸시) 대신 그 알림을 '○○님 등 여러 명'으로 — 한꺼번에 등록할 때 알림 폭탄 방지
    update public.notifications n
       set body = v_name || '님 등 여러 명' || v_tail
     where n.id = (select n2.id from public.notifications n2
                    where n2.user_id = r.uid and n2.title = v_title and n2.created_at > now() - interval '10 minutes'
                    order by n2.created_at desc limit 1);
    if not found then
      insert into public.notifications (user_id, title, body, link)
      values (r.uid, v_title, v_name || '님' || v_tail, '/manager');
    end if;
  end loop;
exception when others then
  null;
end $function$;

-- 6) 메달 이름 연결 ─────────────────────────────────────────────
create or replace function public.link_member_medals_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- 본인이 이름을 바꾼 때는 연결하지 않는다 — 남의 이름으로 바꿔 메달을 가져가지 못하게 (가입 · 운영진 수정 때만)
  if tg_op = 'UPDATE' and auth.uid() is not null and auth.uid() = new.user_id then
    return new;
  end if;
  if new.name is not null and btrim(new.name) <> '' then
    update public.member_medals
       set user_id = new.user_id
     where user_id is null
       and person_name = btrim(new.name)
       and (branch_name is null or branch_name = new.branch_name);
  end if;
  return new;
exception when others then return new;
end $function$;

-- 7) 추격 목표 ─────────────────────────────────────────────────
create or replace function public.set_rival(_rival_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  -- 본인 · 코치님·운영진 · 순위 밖 계정은 추격 목표로 고를 수 없다
  if _rival_id is not null and (
       _rival_id = auth.uid()
       or not public._is_rankable_member(_rival_id)
       or public._dm_kind(_rival_id) in ('coach', 'hq')) then
    raise exception '추격 목표로 정할 수 없는 회원이에요';
  end if;
  update public.member_progress set rival_id = _rival_id where user_id = auth.uid();
end $function$;

-- 8) 글 사진 주소 ──────────────────────────────────────────────
create or replace function public.set_journal_entry_options(p_entry_id uuid, p_visibility text, p_photo_url text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_visibility not in ('branch', 'partners', 'private') then raise exception '공개 범위가 올바르지 않습니다'; end if;
  -- 우리 저장소의 '내 폴더' 사진만 (다른 사이트 사진으로 보는 사람을 추적하거나 남의 사진을 쓰지 못하게)
  if p_photo_url is not null
     and p_photo_url !~ ('^https://whnczhxyjmyywhlfbgsd\.supabase\.co/storage/v1/object/public/community/' || v_uid::text || '/[A-Za-z0-9._-]+$') then
    raise exception '사진 주소가 올바르지 않습니다';
  end if;
  update public.champion_journal_entries
     set visibility = p_visibility, photo_url = p_photo_url
   where id = p_entry_id and user_id = v_uid;
  if not found then raise exception '내 글만 바꿀 수 있습니다'; end if;
  return jsonb_build_object('success', true);
end $function$;
revoke execute on function public.set_journal_entry_options(uuid, text, text) from public, anon;
grant execute on function public.set_journal_entry_options(uuid, text, text) to authenticated;

-- 9) 의견·신고 ─────────────────────────────────────────────────
revoke insert, update on public.app_feedback from anon, authenticated;
grant insert (user_id, category, content, page_path, device_info) on public.app_feedback to authenticated;
alter table public.app_feedback add constraint app_feedback_category_chk check (category in ('오류', '불편', '제안')) not valid;

create or replace function public.app_feedback_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.status := 'new';
  new.handled_by := null;
  new.handled_at := null;
  new.created_at := now();
  new.content := left(coalesce(new.content, ''), 2000);
  new.page_path := left(new.page_path, 300);
  new.device_info := left(new.device_info, 300);
  if (select count(*) from public.app_feedback f
       where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 10 then
    raise exception '오늘은 의견을 충분히 보내 주셨어요. 내일 다시 보내 주세요';
  end if;
  return new;
end $function$;
revoke all on function public.app_feedback_guard() from public, anon, authenticated;
create or replace trigger app_feedback_guard
  before insert on public.app_feedback
  for each row execute function public.app_feedback_guard();

-- 10) 내부 확인 함수 ────────────────────────────────────────────
revoke execute on function
  public._first_attendance_date(uuid),
  public._is_hq_user(uuid),
  public._community_sees_branch_all(uuid),
  public._staff_has_perm(uuid, text),
  public._can_manage_branch_goals(uuid, text),
  public.community_can_view_entry(uuid, uuid),
  public._community_branch_of(uuid),
  public._community_display_name(uuid)
from public, anon, authenticated;
revoke execute on function public.notify_app_feedback(), public.profile_signup_alert_trg() from public, anon, authenticated;
