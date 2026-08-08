-- =====================================================================
-- pt-consult-app / DISASTER-RECOVERY SCHEMA DUMP -- 03_functions.sql
-- =====================================================================
--   생성일       : 2026-08-08  (오늘 마이그레이션 5건 반영 후 재덤프)
--   소스 프로젝트: Supabase project ref  tbxdrfowanyksgdicryl
--   추출 방법    : pg_get_functiondef(p.oid) 원문 그대로 (verbatim).
--                  요약·재작성·축약 없음.
--
-- ★★ 이 파일은 **자동 덤프**다. 손으로 고치지 말 것. ★★
--    함수를 바꿔야 하면 DB 에서 CREATE OR REPLACE 를 실행한 뒤
--    이 파일을 통째로 다시 덤프한다. 여기서 직접 수정하면
--    라이브 DB 와 백업이 조용히 어긋난다.
--
--   포함 범위 (public 스키마):
--     - proname LIKE '_pt_%'      ......  6개 (내부 헬퍼. 반드시 먼저 실행)
--     - proname LIKE 'dashboard%' ......  4개 (대시보드 로그인/가입/승인)
--     - proname LIKE 'pt_%'       ...... 34개 (앱 공개 RPC 전부)
--   합계 44개.
--
-- ---------------------------------------------------------------------
-- 시크릿 검사 결과
-- ---------------------------------------------------------------------
--   44개 함수 본문 전체를 자동 스캔했다. **리터럴 시크릿/토큰/비밀번호/해시
--   문자열은 단 한 건도 없다.** 따라서 이 파일에는 redaction(가림 처리)이 없다.
--   인증 방식은 전부 "호출자가 p_secret 을 넘기면 _pt_admin_ok() 가
--   pt_admin_secret 테이블 값과 대조" 하는 구조다 -- 값이 아니라 참조다.
--   비밀번호도 crypt(p_pw, gen_salt('bf')) 해시만 저장하며 코드에는 없다.
--   _pt_phone_key() 는 pt_admin_secret 의 값을 hmac 키로 **읽어 쓸 뿐** 코드에
--   담고 있지 않다.
-- ---------------------------------------------------------------------
--
-- 실행 순서 주의: 이 파일은 01_tables.sql 이후에 실행한다.
--                 파일 위에서 아래로 그대로 실행하면 의존 순서가 맞는다
--                 (_pt_* 헬퍼가 맨 앞에 온다).
--
-- CREATE OR REPLACE 함정: 시그니처(인자 목록)가 바뀐 함수를 OR REPLACE 하면
--   옛 버전이 지워지지 않고 **오버로드로 남는다**. PostgREST 가
--   PGRST203 을 뱉거나 옛 버전이 계속 호출된다. 시그니처를 바꿀 때는
--   반드시 DROP FUNCTION 으로 옛 시그니처를 먼저 지운다.
--   (2026-08-08 기준 중복 오버로드 0건 확인)
-- =====================================================================


-- =====================================================================
-- (A) 내부 헬퍼 _pt_*  -- 반드시 먼저 실행한다
-- =====================================================================

-- ---------------------------------------------------------------------
-- _pt_admin_ok
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pt_admin_ok(p_secret text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from pt_admin_secret where id = 1 and secret = p_secret);
$function$;

-- ---------------------------------------------------------------------
-- _pt_branch_id
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pt_branch_id(p_branch text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from branches
   where name ilike case coalesce(nullif(btrim(p_branch),''),'sunreung')
      when 'sunreung' then '%선릉%' when 'chilgeum' then '%칠금%'
      when 'munhwa' then '%문화%'  when 'yongsan' then '%용산%'
      else '%' || replace(replace(replace(coalesce(p_branch,''),'\','\\'),'%','\%'),'_','\_') || '%' end
   order by name limit 1;
$function$;

-- ---------------------------------------------------------------------
-- _pt_is_pt_product
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pt_is_pt_product(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from regexp_split_to_table(coalesce(p,''), '[+,&/·]') tok
    where tok ~* '(퍼스널|퍼스날|프라이빗|듀엣|듀오|(^|[^지])피티|(^|[^a-z])p\.?t\.?([^a-z]|$)|personal|개인\s*(레슨|수업|강습|지도|트레이닝|트레이닝권|피티)|(^|[^0-9])[12]\s*:\s*1([^0-9]|$)|일대일)'
      and tok !~* '(락커|라커|locker|운동복|수건|타월|글러브|붕대|밴드|음료|물품)'
  );
$function$;

-- ---------------------------------------------------------------------
-- _pt_member_in_scope
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pt_member_in_scope(p_member_id bigint, p_branch text, p_actor_coach_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from pt_members m
     where m.id = p_member_id
       and m.deleted_at is null
       and m.branch = coalesce(nullif(btrim(p_branch),''),'sunreung')
       and (p_actor_coach_id is null or m.coach_id = p_actor_coach_id)
  );
$function$;

-- ---------------------------------------------------------------------
-- _pt_name_phone
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pt_name_phone(p_bid uuid, p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER COST 500
 SET search_path TO 'public'
AS $function$
  select case when count(distinct ph) = 1 then min(ph) else null end
  from (
    select nullif(regexp_replace(coalesce(mm.phone,''),'[^0-9]','','g'),'') ph
      from members mm
     where mm.branch_id = p_bid and mm.deleted_at is null and mm.name = p_name
  ) t
  where ph is not null;
$function$;

-- ---------------------------------------------------------------------
-- _pt_phone_key
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pt_phone_key(p_phone text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select case when coalesce(p_phone,'') = '' then null
              else encode(hmac(p_phone, (select secret from pt_admin_secret where id=1), 'sha256'),'hex') end;
$function$;

-- =====================================================================
-- (B) dashboard_*  -- 대시보드 계정/로그인
-- =====================================================================

-- ---------------------------------------------------------------------
-- dashboard_approve
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_approve(p_user text, p_approve boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_approve then
    update dashboard_users set approved=true where username=p_user and role<>'owner';
  else
    delete from dashboard_users where username=p_user and role<>'owner';
  end if;
  return json_build_object('ok',true);
end;$function$;

-- ---------------------------------------------------------------------
-- dashboard_login
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_login(p_user text, p_pw text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare u public.dashboard_users%rowtype;
begin
  select * into u from dashboard_users where lower(username)=lower(trim(p_user));
  if not found then
    return json_build_object('ok',false,'reason','invalid');
  end if;

  -- 대입 잠금 (pt_coach_login 과 동일 정책: 5회 실패 → 10분)
  if u.locked_until is not null and u.locked_until > now() then
    return json_build_object('ok',false,'reason','locked',
      'error','비밀번호를 여러 번 틀렸어요. 잠시 후 다시 시도해 주세요.');
  end if;

  if u.pw_hash <> crypt(p_pw, u.pw_hash) then
    update dashboard_users
       set fail_count = fail_count + 1,
           locked_until = case when fail_count + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where username = u.username;
    return json_build_object('ok',false,'reason','invalid');
  end if;

  if u.fail_count <> 0 or u.locked_until is not null then
    update dashboard_users set fail_count = 0, locked_until = null where username = u.username;
  end if;

  if not u.approved then return json_build_object('ok',false,'reason','pending'); end if;

  return json_build_object('ok',true,'username',u.username,'branch',u.branch,'role',u.role,
                           'pt_access', coalesce(u.pt_access,false));
end;$function$;

-- ---------------------------------------------------------------------
-- dashboard_signup
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_signup(p_user text, p_pw text, p_branch text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if length(coalesce(trim(p_user),''))<3 or length(coalesce(p_pw,''))<4 then
    return json_build_object('ok',false,'error','아이디는 3자, 비밀번호는 4자 이상이어야 해요');
  end if;
  if p_branch not in ('sunreung','chilgeum','munhwa','yongsan') then
    return json_build_object('ok',false,'error','지점을 선택해 주세요');
  end if;
  if exists(select 1 from dashboard_users where lower(username)=lower(trim(p_user))) then
    return json_build_object('ok',false,'error','이미 사용 중인 아이디예요');
  end if;
  insert into dashboard_users(username,pw_hash,branch,role,approved)
  values(trim(p_user), crypt(p_pw, gen_salt('bf')), p_branch, 'manager', false);
  return json_build_object('ok',true);
end;$function$;

-- ---------------------------------------------------------------------
-- dashboard_users_list
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_users_list()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(json_build_object(
    'username',username,'branch',branch,'role',role,'approved',approved,
    'created',to_char(created_at at time zone 'Asia/Seoul','MM-DD HH24:MI')
  ) order by approved asc, created_at desc),'[]'::json) from dashboard_users;
$function$;

-- =====================================================================
-- (C) pt_*  -- 앱 공개 RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- pt_attend_card
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_attend_card(p_secret text, p_member_id bigint, p_limit integer DEFAULT 60, p_branch text DEFAULT 'sunreung'::text, p_actor_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  if not _pt_member_in_scope(p_member_id, p_branch, p_actor_coach_id) then
    return jsonb_build_object('ok', false, 'error','이 회원을 볼 권한이 없습니다');
  end if;
  return pt_member_attendance(p_secret, p_member_id, p_limit);
end $function$;

-- ---------------------------------------------------------------------
-- pt_auto_import_all
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_auto_import_all()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s text; r jsonb; res jsonb := '[]'::jsonb; b text; fails int := 0; oks int := 0;
begin
  select secret into s from pt_admin_secret where id = 1;
  for b in
    select distinct branch from (
      select branch from pt_members where branch is not null and deleted_at is null
      union
      select branch from pt_coaches where branch is not null and approved
    ) t
    where _pt_branch_id(branch) is not null   -- 경영리포트에 없는 지점 문자열은 무시 (주입 방어)
    order by 1
  loop
    begin
      r := pt_import_from_os(s, b, true);
    exception when others then
      r := jsonb_build_object('ok', false, 'branch', b, 'error', left(SQLERRM, 200));
    end;
    res := res || jsonb_build_array(r);
    if coalesce((r->>'ok')::boolean,false) then oks := oks + 1; else fails := fails + 1; end if;
  end loop;
  -- 실패해도 예외를 던지지 않는다. 성공한 지점의 결과를 롤백시키지 않기 위해서다.
  return jsonb_build_object('ok', fails = 0, 'branches', jsonb_array_length(res),
                            'succeeded', oks, 'failed', fails, 'results', res);
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_approve
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_approve(p_secret text, p_id bigint, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int; k int := 0;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  if p_approve then
    update pt_coaches set approved = true, active = true where id = p_id;
  else
    update pt_coaches set approved = false, active = false where id = p_id;
  end if;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error','해당 코치를 찾을 수 없습니다'); end if;
  if p_approve then
    update pt_tg_recipients set active = true where coach_id = p_id and not active;
  else
    update pt_tg_recipients set active = false where coach_id = p_id and active;
  end if;
  get diagnostics k = row_count;
  return jsonb_build_object('ok', true, 'alerts_changed', k);
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_delete
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_delete(p_secret text, p_id bigint, p_branch text DEFAULT 'sunreung'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int; k int;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  update pt_coaches set active = false, approved = false
   where id = p_id and branch = coalesce(nullif(btrim(p_branch),''),'sunreung');
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error','해당 코치를 찾을 수 없습니다'); end if;
  update pt_tg_recipients set active = false where coach_id = p_id and active;
  get diagnostics k = row_count;
  return jsonb_build_object('ok', true, 'alerts_off', k);
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_home
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_home(p_secret text, p_branch text, p_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; v_br text; d date;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  d := (now() at time zone 'Asia/Seoul')::date;
  select jsonb_build_object(
    'today',    (select count(*) from pt_logs l join pt_members mm on mm.id=l.member_id and mm.deleted_at is null where l.branch=v_br and (p_coach_id is null or l.coach_id=p_coach_id) and l.session_date = d),
    'week',     (select count(*) from pt_logs l join pt_members mm on mm.id=l.member_id and mm.deleted_at is null where l.branch=v_br and (p_coach_id is null or l.coach_id=p_coach_id) and l.session_date > d - 7),
    'month',    (select count(*) from pt_logs l join pt_members mm on mm.id=l.member_id and mm.deleted_at is null where l.branch=v_br and (p_coach_id is null or l.coach_id=p_coach_id) and l.session_date > d - 30),
    'members',  (select count(*) from pt_members m where m.branch=v_br and m.deleted_at is null and (p_coach_id is null or m.coach_id=p_coach_id) and m.status='active'),
    'remain',   (select coalesce(sum(greatest(m.total_sessions - m.used_sessions,0)),0) from pt_members m where m.branch=v_br and m.deleted_at is null and (p_coach_id is null or m.coach_id=p_coach_id) and m.status='active'),
    'low',      (select count(*) from pt_members m where m.branch=v_br and m.deleted_at is null and (p_coach_id is null or m.coach_id=p_coach_id) and m.status='active' and m.total_sessions > 0 and (m.total_sessions - m.used_sessions) between 0 and 3),
    'low_threshold', 3,
    'pending_coaches', (select count(*) from pt_coaches c where c.branch=v_br and not c.approved and p_coach_id is null),
    'newleads', (select count(*) from pt_consults c where c.branch=v_br and c.status='new' and c.purged_at is null
                   and (p_coach_id is null or c.coach_id = p_coach_id or c.coach_id is null)),
    'trend',    (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(dd,'MM-DD'), 'n', cnt) order by dd), '[]'::jsonb)
                 from (select g::date dd, (select count(*) from pt_logs l join pt_members mm on mm.id=l.member_id and mm.deleted_at is null
                        where l.branch=v_br and (p_coach_id is null or l.coach_id=p_coach_id) and l.session_date=g::date) cnt
                       from generate_series(d-13, d, interval '1 day') g) t)
  ) into v;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_list
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_list(p_secret text, p_branch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'title',title,'phone',phone,
    'intro',intro,'photo_url',photo_url,'active',active,'sort_order',sort_order,
    'login_id',login_id,'approved',approved,
    'signup_at', to_char(signup_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI'),
    'last_login', to_char(last_login_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI'),
    'members', (select count(*) from pt_members m where m.coach_id = pt_coaches.id and m.deleted_at is null and m.status='active')
    ) order by approved, sort_order, id), '[]'::jsonb)
    into v from pt_coaches where branch = coalesce(nullif(btrim(p_branch),''),'sunreung');
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_login
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_login(p_login_id text, p_pw text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r record;
begin
  select * into r from pt_coaches where login_id = lower(btrim(coalesce(p_login_id,'')));
  if not found or r.pw_hash is null then return jsonb_build_object('ok', false); end if;
  if r.locked_until is not null and r.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  -- 잠금이 만료됐으면 카운터를 리셋해 '오답 1회에 즉시 재잠금' 방지
  if r.locked_until is not null and r.locked_until <= now() then
    update pt_coaches set fail_count = 0, locked_until = null where id = r.id;
    r.fail_count := 0;
  end if;
  if r.pw_hash <> crypt(p_pw, r.pw_hash) then
    update pt_coaches
       set fail_count = fail_count + 1,
           locked_until = case when fail_count + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where id = r.id;
    return jsonb_build_object('ok', false);
  end if;
  if not r.approved then return jsonb_build_object('ok', false, 'reason', 'pending'); end if;
  if not coalesce(r.active, true) then return jsonb_build_object('ok', false, 'reason', 'disabled'); end if;
  update pt_coaches set last_login_at = now(), fail_count = 0, locked_until = null where id = r.id;
  return jsonb_build_object('ok', true, 'id', r.id, 'name', r.name, 'branch', r.branch, 'title', r.title);
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_set_login
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_set_login(p_secret text, p_id bigint, p_login_id text, p_pw text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare n int;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  if p_login_id is null or length(btrim(p_login_id)) < 3 then
    return jsonb_build_object('ok', false, 'error', '아이디는 3자 이상이어야 합니다');
  end if;
  if p_pw is null or length(p_pw) < 6 then
    return jsonb_build_object('ok', false, 'error', '비밀번호는 6자 이상이어야 합니다');
  end if;
  if exists (select 1 from pt_coaches where login_id = lower(btrim(p_login_id)) and id <> p_id) then
    return jsonb_build_object('ok', false, 'error', '이미 사용 중인 아이디입니다');
  end if;
  update pt_coaches
     set login_id = lower(btrim(p_login_id)), pw_hash = crypt(p_pw, gen_salt('bf')),
         fail_count = 0, locked_until = null
   where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error','해당 코치를 찾을 수 없습니다'); end if;
  return jsonb_build_object('ok', true);
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_signup
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_signup(p_branch text, p_name text, p_phone text, p_login_id text, p_pw text, p_title text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_id bigint; v_br text; v_login text; v_recent int;
begin
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  if _pt_branch_id(v_br) is null then
    return jsonb_build_object('ok', false, 'error', '지점을 선택해 주세요');
  end if;
  v_login := lower(btrim(coalesce(p_login_id,'')));
  if p_name is null or length(btrim(p_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', '이름을 정확히 입력해 주세요');
  end if;
  if length(v_login) < 4 or v_login !~ '^[a-z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'error', '아이디는 영문·숫자 4자 이상이어야 합니다');
  end if;
  if p_pw is null or length(p_pw) < 6 then
    return jsonb_build_object('ok', false, 'error', '비밀번호는 6자 이상이어야 합니다');
  end if;
  if exists (select 1 from pt_coaches where login_id = v_login) then
    return jsonb_build_object('ok', false, 'error', '이미 사용 중인 아이디입니다');
  end if;
  select count(*) into v_recent from pt_coaches where signup_at > now() - interval '1 hour';
  if v_recent >= 10 then
    return jsonb_build_object('ok', false, 'error', '잠시 후 다시 시도해 주세요');
  end if;
  insert into pt_coaches (branch, name, title, phone, login_id, pw_hash, active, approved, signup_at, sort_order)
  values (v_br, btrim(p_name), left(nullif(btrim(coalesce(p_title,'')),''),40),
          regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),
          v_login, crypt(p_pw, gen_salt('bf')), false, false, now(), 99)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- ---------------------------------------------------------------------
-- pt_coach_upsert
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_coach_upsert(p_secret text, p_branch text, p_id bigint, p_name text, p_title text, p_phone text, p_intro text, p_photo_url text, p_active boolean DEFAULT true, p_sort integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_br text;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  if p_name is null or btrim(p_name) = '' then return jsonb_build_object('ok', false, 'error','이름 필요'); end if;
  if p_id is null or p_id <= 0 then
    insert into pt_coaches (branch, name, title, phone, intro, photo_url, active, sort_order)
    values (v_br, btrim(p_name), p_title, p_phone, p_intro, p_photo_url,
            coalesce(p_active,true), coalesce(p_sort,0))
    returning id into v_id;
  else
    update pt_coaches set name=btrim(p_name), title=p_title, phone=p_phone, intro=p_intro,
      photo_url=p_photo_url, active=coalesce(p_active,true), sort_order=coalesce(p_sort,0)
    where id = p_id and branch = v_br returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'error','해당 코치를 찾을 수 없습니다'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- ---------------------------------------------------------------------
-- pt_consult_notified
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_consult_notified(p_secret text, p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  update pt_consults set notified_at = now() where id = p_id and notified_at is null;
  return jsonb_build_object('ok', found);
end $function$;

-- ---------------------------------------------------------------------
-- pt_consult_purge
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_consult_purge(p_secret text, p_id bigint, p_branch text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text; n int;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  update pt_consults set
    name = '(파기됨)',
    phone = 'ERASED-' || id::text,
    injury = null, fitness_level = null, experience = null,
    note = null, admin_memo = null,
    partner_name = null, partner_phone = null,
    gender = null, age_band = null, source = null,
    goal = null, pref_days = null, pref_time = null, interest = null,
    purged_at = now()
  where id = p_id and branch = v_br and purged_at is null;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error','대상을 찾을 수 없거나 이미 파기됨'); end if;
  return jsonb_build_object('ok', true);
end $function$;

-- ---------------------------------------------------------------------
-- pt_counts
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_counts(p_secret text, p_branch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v
  from (select status, count(*) n from pt_consults
        where branch = coalesce(nullif(btrim(p_branch),''),'sunreung') and purged_at is null
        group by status) t;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_datacenter
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_datacenter(p_secret text, p_branch text, p_coach_id bigint DEFAULT NULL::bigint, p_role text DEFAULT 'coach'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text; v_bid uuid; d date; v jsonb; v_money boolean;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  v_bid := _pt_branch_id(v_br);
  if v_bid is null then
    return jsonb_build_object('error','branch_unmapped',
      'message','경영리포트에서 이 지점을 찾지 못했습니다. 매출·출석을 계산할 수 없습니다.');
  end if;
  d := (now() at time zone 'Asia/Seoul')::date;
  v_money := coalesce(nullif(lower(btrim(p_role)),''),'coach') in ('owner','manager');

  with mem as (
    select m.*, nullif(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),'') ph
      from pt_members m
     where m.branch = v_br and m.deleted_at is null
       and (p_coach_id is null or m.coach_id = p_coach_id)
  ), att as (
    select mem.id,
      (select max(a.attend_date) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid
         and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g') = mem.ph) as last_visit,
      (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid
         and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g') = mem.ph and a.attend_date > d-30) as v30,
      (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id <> v_bid
         and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g') = mem.ph and a.attend_date > d-30) as v30_other
    from mem
  ), ticket as (
    select regexp_replace(coalesce(mm.phone,''),'[^0-9]','','g') ph, count(*) n
      from memberships ms join members mm on mm.id=ms.member_id
     where ms.branch_id=v_bid and ms.deleted_at is null and _pt_is_pt_product(ms.plan_name)
       and regexp_replace(coalesce(mm.phone,''),'[^0-9]','','g') in (select ph from mem where ph is not null)
     group by 1
  ), nm as (
    select distinct m.name, _pt_name_phone(v_bid, m.name) as ph from mem m
  ), sale as (
    select s.amount, _pt_is_pt_product(s.product) as is_pt, (nm.ph is null) as amb
      from sales_entries s join nm on nm.name = s.member_name
     where s.branch_id = v_bid
  ), ptall as (
    select coalesce(sum(s.amount),0) amt, count(*) cnt
      from sales_entries s where s.branch_id = v_bid and _pt_is_pt_product(s.product)
  )
  select jsonb_build_object(
    'members_total',  (select count(*) from mem),
    'members_people', (select count(distinct coalesce(ph, 'id:'||id::text)) from mem),
    'members_active', (select count(*) from mem where status='active'),
    'members_done',   (select count(*) from mem where status='done'),
    'attend_rate',    (select case when count(*) filter (where m.status='active')=0 then 0
                        else round(100.0 * count(*) filter (where m.status='active' and a.v30 > 0)
                             / count(*) filter (where m.status='active')) end
                       from mem m join att a on a.id=m.id),
    'avg_visits30',   (select coalesce(round(avg(a.v30)::numeric,1),0) from mem m join att a on a.id=m.id where m.status='active'),
    'other_branch_30', (select coalesce(sum(a.v30_other),0) from mem m join att a on a.id=m.id),
    'risk',           (select count(*) from mem m join att a on a.id=m.id
                        where m.status='active' and (a.last_visit is null or a.last_visit < d-14)),
    'low_sessions',   (select count(*) from mem where status='active' and (total_sessions-used_sessions) between 0 and 3),
    'renew_rate',     (select case when count(*)=0 then 0 else round(100.0*count(*) filter (where n>1)/count(*)) end from ticket),
    'renew_members',  (select count(*) filter (where n>1) from ticket),
    'ticket_members', (select count(*) from ticket),
    'money_visible',  v_money,
    'pt_revenue',     case when v_money then (select coalesce(sum(amount),0) from sale where is_pt and not amb) else 0 end,
    'pt_revenue_cnt', case when v_money then (select count(*) from sale where is_pt and not amb) else 0 end,
    'pay_total',      case when v_money then (select coalesce(sum(amount),0) from sale where not amb) else 0 end,
    'pay_avg',        case when v_money then (select case when (select count(distinct coalesce(ph,'id:'||id::text)) from mem)=0 then 0
                        else round((select coalesce(sum(amount),0) from sale where is_pt and not amb)::numeric
                                   / (select count(distinct coalesce(ph,'id:'||id::text)) from mem)) end) else 0 end,
    'pay_unsure_cnt', case when v_money then (select count(*) from sale where amb) else 0 end,
    'pay_unsure_amt', case when v_money then (select coalesce(sum(amount),0) from sale where amb) else 0 end,
    'pt_branch_total', case when v_money then (select amt from ptall) else 0 end,
    'pt_unlinked_amt', case when v_money then greatest((select amt from ptall)
                        - (select coalesce(sum(amount),0) from sale where is_pt), 0) else 0 end,
    'pt_unlinked_cnt', case when v_money then greatest((select cnt from ptall)
                        - (select count(*) from sale where is_pt), 0) else 0 end,
    'sessions_done',  (select count(*) from pt_logs l join pt_members mm on mm.id=l.member_id and mm.deleted_at is null
                        where l.branch=v_br and (p_coach_id is null or l.coach_id=p_coach_id)),
    'sessions_30d',   (select count(*) from pt_logs l join pt_members mm on mm.id=l.member_id and mm.deleted_at is null
                        where l.branch=v_br and (p_coach_id is null or l.coach_id=p_coach_id) and l.session_date > d-30),
    'risk_list',      coalesce((select jsonb_agg(jsonb_build_object(
                          'id', m.id, 'name', m.name, 'phone', m.phone,
                          'remain', greatest(m.total_sessions-m.used_sessions,0),
                          'last_visit', to_char(a.last_visit,'YYYY-MM-DD'),
                          'days', case when a.last_visit is null then null else (d - a.last_visit) end)
                        order by a.last_visit nulls first)
                       from mem m join att a on a.id=m.id
                      where m.status='active' and (a.last_visit is null or a.last_visit < d-14)), '[]'::jsonb)
  ) into v;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_import_from_os
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_import_from_os(p_secret text, p_branch text, p_include_expired boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text; v_bid uuid; ins int := 0; upd int := 0; skp int := 0; r record; v_ph text; v_coach bigint; v_key text;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  v_bid := _pt_branch_id(v_br);
  if v_bid is null then
    return jsonb_build_object('ok', false, 'error', '경영리포트에서 지점을 찾지 못했습니다', 'branch', v_br);
  end if;

  select case when count(*) = 1 then min(id) else null end into v_coach
    from pt_coaches where branch = v_br and active and approved;

  for r in
    select ms.id as mid, mm.name, mm.phone, ms.plan_name, ms.start_date, ms.status,
           coalesce(ms.max_sessions, 0) as total, coalesce(ms.used_sessions, 0) as used
      from memberships ms join members mm on mm.id = ms.member_id
     where ms.branch_id = v_bid and ms.deleted_at is null and mm.deleted_at is null
       and _pt_is_pt_product(ms.plan_name)
       and (p_include_expired or ms.status = 'active')
  loop
    v_ph := regexp_replace(coalesce(r.phone,''),'[^0-9]','','g');
    v_key := _pt_phone_key(nullif(v_ph,''));

    -- 삭제/파기된 사람은 다시 만들지 않는다 (3중 대조: OS키 · 파기해시 · 평문번호)
    if exists (select 1 from pt_members where branch = v_br and deleted_at is not null
                 and (os_membership_id = r.mid
                      or (v_key is not null and purge_key = v_key)
                      or (purged_at is null and os_membership_id is null and v_ph <> '' and phone = v_ph))) then
      skp := skp + 1;
      continue;
    end if;

    if exists (select 1 from pt_members where os_membership_id = r.mid and deleted_at is null) then
      update pt_members set
        name    = case when manual_edited then name    else r.name end,
        phone   = case when manual_edited then phone   else v_ph end,
        product = case when manual_edited then product else left(r.plan_name, 60) end,
        total_sessions = greatest(total_sessions, r.total),   -- 수기 연장분을 줄이지 않는다
        start_date = coalesce(start_date, r.start_date),
        coach_id = coalesce(coach_id, v_coach),
        status = case when r.status = 'active' then status
                      when r.status in ('expired','canceled') then 'done'
                      when status = 'done' then 'done'        -- 소진 처리는 되돌리지 않는다
                      else 'paused' end,
        updated_at = now()
      where os_membership_id = r.mid and deleted_at is null
        -- 실제로 바뀌는 게 있을 때만 건드린다 (updated_at 정렬이 매일 새벽 초기화되던 문제)
        and ( (not manual_edited and (name is distinct from r.name
                                   or phone is distinct from v_ph
                                   or product is distinct from left(r.plan_name,60)))
              or total_sessions < r.total
              or start_date is null
              or (coach_id is null and v_coach is not null)
              or status is distinct from (case when r.status = 'active' then status
                                               when r.status in ('expired','canceled') then 'done'
                                               when status = 'done' then 'done'
                                               else 'paused' end) );
      if found then upd := upd + 1; else skp := skp + 1; end if;
    else
      insert into pt_members (branch, coach_id, name, phone, product, total_sessions, used_sessions,
                              start_date, status, memo, os_membership_id)
      values (v_br, v_coach, r.name, v_ph, left(r.plan_name, 60), greatest(r.total, 0), greatest(r.used, 0),
              r.start_date,
              case when r.status = 'active' then 'active'
                   when r.status in ('expired','canceled') then 'done' else 'paused' end,
              '경영리포트에서 자동 연동', r.mid);
      ins := ins + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'branch', v_br, 'inserted', ins, 'updated', upd,
                            'skipped_deleted', skp, 'auto_coach', v_coach);
end $function$;

-- ---------------------------------------------------------------------
-- pt_list
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_list(p_secret text, p_branch text, p_status text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; v_digits text; v_like text; v_br text; v_total int;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  v_digits := nullif(regexp_replace(coalesce(p_q,''),'[^0-9]','','g'), '');
  v_like := replace(replace(replace(btrim(coalesce(p_q,'')),'\','\\'),'%','\%'),'_','\_');

  select count(*) into v_total from pt_consults c
   where c.branch = v_br
     and (p_coach_id is null or c.coach_id = p_coach_id or c.coach_id is null)
     and (p_status is null or p_status = '' or c.status = p_status)
     and (p_q is null or btrim(p_q) = ''
          or c.name ilike '%' || v_like || '%' escape '\'
          or (v_digits is not null and c.phone like '%' || v_digits || '%'));

  select coalesce(jsonb_agg(x order by ord desc), '[]'::jsonb) into v from (
    select c.created_at as ord, jsonb_build_object(
      'id', c.id, 'name', c.name, 'phone', c.phone, 'gender', c.gender, 'age_band', c.age_band,
      'goal', c.goal, 'fitness_level', c.fitness_level, 'experience', c.experience, 'injury', c.injury,
      'pref_days', c.pref_days, 'pref_time', c.pref_time, 'interest', c.interest, 'source', c.source,
      'note', c.note, 'status', c.status, 'admin_memo', c.admin_memo,
      'partner_name', c.partner_name, 'partner_phone', c.partner_phone,
      'coach_id', c.coach_id, 'coach_name', ch.name,
      'purged', (c.purged_at is not null),
      'notified', (c.notified_at is not null),
      'member_linked', exists (select 1 from pt_members m where m.consult_id = c.id and m.deleted_at is null),
      'created_at', to_char(c.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
    ) as x
    from pt_consults c left join pt_coaches ch on ch.id = c.coach_id
    where c.branch = v_br
      and (p_coach_id is null or c.coach_id = p_coach_id or c.coach_id is null)
      and (p_status is null or p_status = '' or c.status = p_status)
      and (p_q is null or btrim(p_q) = ''
           or c.name ilike '%' || v_like || '%' escape '\'
           or (v_digits is not null and c.phone like '%' || v_digits || '%'))
    order by c.created_at desc
    limit greatest(1, least(coalesce(p_limit,50), 200)) offset greatest(0, coalesce(p_offset,0))
  ) t;

  return jsonb_build_object('ok', true, 'total', v_total, 'rows', v);
end $function$;

-- ---------------------------------------------------------------------
-- pt_log_add
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_log_add(p_secret text, p_member_id bigint, p_coach_id bigint, p_date date, p_duration integer, p_content text, p_condition text, p_next text, p_weight numeric DEFAULT NULL::numeric, p_fat numeric DEFAULT NULL::numeric, p_branch text DEFAULT NULL::text, p_actor_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m record; v_no int; v_id bigint; v_dt date;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_dt := coalesce(p_date, (now() at time zone 'Asia/Seoul')::date);

  select * into m from pt_members
   where id = p_member_id and deleted_at is null
     and (p_branch is null or branch = coalesce(nullif(btrim(p_branch),''),'sunreung'))
     and (p_actor_coach_id is null or coach_id = p_actor_coach_id)
   for update;
  if not found then return jsonb_build_object('ok',false,'error','회원을 찾을 수 없거나 권한이 없습니다'); end if;

  -- 총 회차가 설정되지 않은 회원은 무한 차감되지 않도록 먼저 막는다
  if coalesce(m.total_sessions,0) <= 0 then
    return jsonb_build_object('ok', false, 'error', '총 회차가 설정되어 있지 않습니다. 회원 정보에서 총 회차를 먼저 입력해 주세요.');
  end if;
  if m.used_sessions >= m.total_sessions then
    return jsonb_build_object('ok', false, 'error', '남은 회차가 없습니다. 회차를 먼저 연장해 주세요.');
  end if;

  -- 더블탭 멱등: 같은 회원·같은 날짜에 60초 안에 들어온 중복 저장은 기존 건을 돌려준다
  select id, session_no into v_id, v_no from pt_logs
   where member_id = p_member_id and session_date = v_dt and created_at > now() - interval '60 seconds'
   order by id desc limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'session_no', v_no, 'duplicate', true,
      'remain', greatest(m.total_sessions - v_no, 0));
  end if;

  update pt_members
     set used_sessions = used_sessions + 1,
         status = case when used_sessions + 1 >= total_sessions then 'done' else status end,
         updated_at = now()
   where id = p_member_id
   returning used_sessions into v_no;
  insert into pt_logs (member_id, coach_id, branch, session_no, session_date, duration_min, content, condition, next_plan, weight_kg, body_fat)
  values (p_member_id, coalesce(p_actor_coach_id, p_coach_id, m.coach_id), m.branch, v_no, v_dt,
          p_duration, left(p_content,2000), left(p_condition,500), left(p_next,1000), p_weight, p_fat)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'session_no', v_no,
    'remain', greatest(m.total_sessions - v_no, 0));
end $function$;

-- ---------------------------------------------------------------------
-- pt_log_list
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_log_list(p_secret text, p_member_id bigint DEFAULT NULL::bigint, p_branch text DEFAULT 'sunreung'::text, p_coach_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  select coalesce(jsonb_agg(x order by ord desc), '[]'::jsonb) into v from (
    select l.session_date as ord, jsonb_build_object(
      'id', l.id, 'member_id', l.member_id, 'member_name', m.name,
      'session_no', l.session_no, 'date', to_char(l.session_date,'YYYY-MM-DD'),
      'duration', l.duration_min, 'content', l.content, 'condition', l.condition,
      'next', l.next_plan, 'weight', l.weight_kg, 'fat', l.body_fat,
      'coach_name', ch.name
    ) as x
    from pt_logs l join pt_members m on m.id = l.member_id
    left join pt_coaches ch on ch.id = l.coach_id
    where m.deleted_at is null
      and (p_member_id is null or l.member_id = p_member_id)
      and (p_member_id is not null or l.branch = coalesce(nullif(btrim(p_branch),''),'sunreung'))
      and (p_coach_id is null or l.coach_id = p_coach_id)
    order by l.session_date desc, l.id desc
    limit greatest(1, least(coalesce(p_limit,100), 300))
  ) t;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_attendance
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_attendance(p_secret text, p_member_id bigint, p_limit integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ph text; v_bid uuid; v jsonb; d date;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  select regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'), _pt_branch_id(m.branch)
    into v_ph, v_bid
    from pt_members m where m.id = p_member_id and m.deleted_at is null;
  if v_bid is null then
    return jsonb_build_object('ok', false, 'error','지점이 경영리포트와 연결되지 않아 출석을 볼 수 없습니다');
  end if;
  if v_ph is null or v_ph = '' then
    return jsonb_build_object('ok', true, 'summary', jsonb_build_object('total',0,'d7',0,'d30',0,'d90',0,'other',0), 'rows', '[]'::jsonb);
  end if;
  d := (now() at time zone 'Asia/Seoul')::date;
  select jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'total', (select count(*) from attendance_logs a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit and a.branch_id = v_bid),
      'd7',    (select count(*) from attendance_logs a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit and a.branch_id = v_bid and a.attend_date > d - 7),
      'd30',   (select count(*) from attendance_logs a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit and a.branch_id = v_bid and a.attend_date > d - 30),
      'd90',   (select count(*) from attendance_logs a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit and a.branch_id = v_bid and a.attend_date > d - 90),
      'other', (select count(*) from attendance_logs a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit and a.branch_id <> v_bid),
      'last',  (select to_char(max(a.attend_date),'YYYY-MM-DD') from attendance_logs a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit and a.branch_id = v_bid)
    ),
    'rows', coalesce((
      select jsonb_agg(x order by x->>'date' desc) from (
        select jsonb_build_object(
          'date', to_char(a.attend_date,'YYYY-MM-DD'),
          'time', to_char(a.attended_at at time zone 'Asia/Seoul','HH24:MI'),
          'device', a.device_name,
          'ticket', a.ticket_name
        ) as x
        from attendance_logs a
        where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.counts_as_visit
          and a.branch_id = v_bid
        order by a.attend_date desc, a.attended_at desc
        limit greatest(1, least(coalesce(p_limit,60), 200))
      ) t), '[]'::jsonb)
  ) into v;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_card
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_card(p_secret text, p_member_id bigint, p_role text DEFAULT 'coach'::text, p_branch text DEFAULT 'sunreung'::text, p_actor_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  if not _pt_member_in_scope(p_member_id, p_branch, p_actor_coach_id) then
    return jsonb_build_object('ok', false, 'error','이 회원을 볼 권한이 없습니다');
  end if;
  return pt_member_profile(p_secret, p_member_id, p_role);
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_delete
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_delete(p_secret text, p_id bigint, p_branch text DEFAULT 'sunreung'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int; nm text;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  select name into nm from pt_members
   where id = p_id and branch = coalesce(nullif(btrim(p_branch),''),'sunreung') and deleted_at is null;
  if nm is null then return jsonb_build_object('ok', false, 'error','회원을 찾을 수 없습니다'); end if;
  update pt_members set deleted_at = now(), updated_at = now() where id = p_id;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0, 'name', nm);
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_list
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_list(p_secret text, p_branch text, p_coach_id bigint DEFAULT NULL::bigint, p_status text DEFAULT 'active'::text, p_q text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; v_br text; v_bid uuid; v_digits text; v_like text; d date;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  v_bid := _pt_branch_id(v_br);
  v_digits := nullif(regexp_replace(coalesce(p_q,''),'[^0-9]','','g'),'');
  v_like := replace(replace(replace(btrim(coalesce(p_q,'')),'\','\\'),'%','\%'),'_','\_');
  d := (now() at time zone 'Asia/Seoul')::date;
  select coalesce(jsonb_agg(x order by ord desc), '[]'::jsonb) into v from (
    select m.updated_at as ord, jsonb_build_object(
      'id', m.id, 'name', m.name, 'phone', m.phone, 'product', m.product,
      'total', m.total_sessions, 'used', m.used_sessions,
      'remain', greatest(m.total_sessions - m.used_sessions, 0),
      'status', m.status, 'memo', m.memo,
      'coach_id', m.coach_id, 'coach_name', ch.name,
      'start_date', to_char(m.start_date,'YYYY-MM-DD'),
      'last_log', (select to_char(max(l.session_date),'YYYY-MM-DD') from pt_logs l where l.member_id = m.id),
      'last_visit', (select to_char(max(a.attend_date),'YYYY-MM-DD') from attendance_logs a
                      where a.counts_as_visit and a.branch_id = v_bid
                        and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g') = regexp_replace(coalesce(m.phone,''),'[^0-9]','','g') and coalesce(m.phone,'') <> ''),
      'visits30', (select count(*) from attendance_logs a
                      where a.counts_as_visit and a.branch_id = v_bid and a.attend_date > d - 30
                        and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g') = regexp_replace(coalesce(m.phone,''),'[^0-9]','','g') and coalesce(m.phone,'') <> '')
    ) as x
    from pt_members m left join pt_coaches ch on ch.id = m.coach_id
    where m.branch = v_br and m.deleted_at is null
      and (p_coach_id is null or m.coach_id = p_coach_id)
      and (p_status is null or p_status = '' or m.status = p_status)
      and (p_q is null or btrim(p_q)='' or m.name ilike '%'||v_like||'%' escape '\'
           or (v_digits is not null and m.phone like '%'||v_digits||'%'))
    order by m.updated_at desc limit 300
  ) t;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_profile
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_profile(p_secret text, p_member_id bigint, p_role text DEFAULT 'coach'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m record; v_ph text; v_bid uuid; d date; v jsonb; v_money boolean; v_amb boolean;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  select * into m from pt_members where id = p_member_id and deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'error','회원을 찾을 수 없습니다'); end if;
  v_ph := nullif(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),'');
  v_bid := _pt_branch_id(m.branch);
  d := (now() at time zone 'Asia/Seoul')::date;
  v_money := coalesce(nullif(lower(btrim(p_role)),''),'coach') in ('owner','manager');
  v_amb := (v_bid is null) or (_pt_name_phone(v_bid, m.name) is null) or (v_ph is null)
           or (_pt_name_phone(v_bid, m.name) <> v_ph);

  select jsonb_build_object(
    'ok', true, 'money_visible', v_money, 'branch_mapped', (v_bid is not null),
    'member', jsonb_build_object(
      'id', m.id, 'name', m.name, 'phone', m.phone, 'product', m.product,
      'total', m.total_sessions, 'used', m.used_sessions,
      'remain', greatest(m.total_sessions - m.used_sessions,0),
      'status', m.status, 'memo', m.memo,
      'start_date', to_char(m.start_date,'YYYY-MM-DD'),
      'coach_name', (select name from pt_coaches c where c.id = m.coach_id)
    ),
    'attend', jsonb_build_object(
      'last',  (select to_char(max(a.attend_date),'YYYY-MM-DD') from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph),
      'days_since', (select (d - max(a.attend_date)) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph),
      'd7',    (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.attend_date > d-7),
      'd30',   (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.attend_date > d-30),
      'd90',   (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph and a.attend_date > d-90),
      'total', (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph),
      'other', (select count(*) from attendance_logs a where a.counts_as_visit and a.branch_id <> v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph),
      'first', (select to_char(min(a.attend_date),'YYYY-MM-DD') from attendance_logs a where a.counts_as_visit and a.branch_id = v_bid and v_ph is not null and regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=v_ph)
    ),
    'pay', jsonb_build_object(
      'unsure', (v_money and v_amb),
      'pt',    case when v_money and not v_amb then (select coalesce(sum(s.amount),0) from sales_entries s where s.branch_id=v_bid and s.member_name=m.name and _pt_is_pt_product(s.product)) else 0 end,
      'total', case when v_money and not v_amb then (select coalesce(sum(s.amount),0) from sales_entries s where s.branch_id=v_bid and s.member_name=m.name) else 0 end,
      'count', case when v_money and not v_amb then (select count(*) from sales_entries s where s.branch_id=v_bid and s.member_name=m.name) else 0 end,
      'last',  case when v_money and not v_amb then (select to_char(max(s.sale_date),'YYYY-MM-DD') from sales_entries s where s.branch_id=v_bid and s.member_name=m.name) else null end,
      'rows',  case when v_money and not v_amb then coalesce((select jsonb_agg(jsonb_build_object(
                  'date', to_char(s.sale_date,'YYYY-MM-DD'), 'product', s.product, 'category', s.category,
                  'amount', s.amount, 'method', s.payment_method, 'is_pt', _pt_is_pt_product(s.product)) order by s.sale_date desc)
                from sales_entries s where s.branch_id=v_bid and s.member_name=m.name), '[]'::jsonb) else '[]'::jsonb end
    ),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
                  'plan', ms.plan_name, 'start', to_char(ms.start_date,'YYYY-MM-DD'),
                  'end', to_char(ms.end_date,'YYYY-MM-DD'), 'status', ms.status, 'sessions', ms.max_sessions) order by ms.start_date desc)
                from memberships ms join members mm on mm.id=ms.member_id
                where ms.branch_id=v_bid and ms.deleted_at is null
                  and v_ph is not null and regexp_replace(coalesce(mm.phone,''),'[^0-9]','','g')=v_ph), '[]'::jsonb),
    'logs', coalesce((select jsonb_agg(x order by ord desc) from (
                  select l.session_date ord, jsonb_build_object(
                    'date', to_char(l.session_date,'YYYY-MM-DD'), 'no', l.session_no,
                    'content', l.content, 'condition', l.condition, 'next', l.next_plan,
                    'weight', l.weight_kg, 'fat', l.body_fat) x
                  from pt_logs l where l.member_id = m.id
                  order by l.session_date desc, l.id desc limit 20) t), '[]'::jsonb),
    'logs_total', (select count(*) from pt_logs l where l.member_id = m.id),
    'consult', (select jsonb_build_object('goal', c.goal, 'injury', c.injury, 'fitness', c.fitness_level,
                  'pref', concat_ws(' / ', c.pref_days, c.pref_time), 'source', c.source, 'note', c.note,
                  'date', to_char(c.created_at at time zone 'Asia/Seoul','YYYY-MM-DD'))
                from pt_consults c where c.id = m.consult_id)
  ) into v;
  return v;
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_purge
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_purge(p_secret text, p_id bigint, p_branch text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text; n int; v_consult bigint; v_ph text; cr jsonb;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  select consult_id, regexp_replace(coalesce(phone,''),'[^0-9]','','g')
    into v_consult, v_ph
    from pt_members
   where id = p_id and branch = v_br and deleted_at is not null and purged_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error','먼저 회원을 삭제한 뒤 파기할 수 있습니다');
  end if;

  -- 연결된 상담이 있으면 먼저 파기하고, 실패하면 전체를 되돌린다.
  if v_consult is not null then
    cr := public.pt_consult_purge(p_secret, v_consult, v_br);
    if coalesce((cr->>'ok')::boolean, false) = false then
      raise exception '연결된 상담 파기에 실패했습니다: %', coalesce(cr->>'error','알 수 없음');
    end if;
  end if;

  update pt_members set
    name = '(파기됨#' || id::text || ')',
    phone = 'ERASED-' || id::text,
    purge_key = _pt_phone_key(v_ph),   -- 파기 후에도 재유입을 막기 위한 단방향 대조키
    memo = null, product = null,
    consult_id = null,
    purged_at = now()
    -- os_membership_id 는 남긴다. 이게 사라지면 매일 새벽 임포트가 회원을 되살린다.
  where id = p_id and branch = v_br and deleted_at is not null and purged_at is null;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error','먼저 회원을 삭제한 뒤 파기할 수 있습니다'); end if;

  update pt_logs set content = null, condition = null, next_plan = null,
                     weight_kg = null, body_fat = null
   where member_id = p_id;
  return jsonb_build_object('ok', true, 'consult_purged', (v_consult is not null));
end $function$;

-- ---------------------------------------------------------------------
-- pt_member_upsert
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_member_upsert(p_secret text, p_branch text, p_id bigint, p_name text, p_phone text, p_product text, p_total integer, p_used integer, p_coach_id bigint, p_start date, p_status text, p_memo text, p_consult_id bigint DEFAULT NULL::bigint, p_actor_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_br text; v_total int; v_used int;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  if p_name is null or btrim(p_name) = '' then return jsonb_build_object('ok',false,'error','이름을 입력하세요'); end if;
  v_total := greatest(coalesce(p_total,0),0);
  v_used  := greatest(coalesce(p_used,0),0);
  if v_total > 0 then v_used := least(v_used, v_total); end if;

  if p_id is null or p_id <= 0 then
    if p_consult_id is not null and exists (
         select 1 from pt_members where consult_id = p_consult_id and deleted_at is null) then
      return jsonb_build_object('ok',false,'error','이미 이 상담으로 등록된 회원이 있습니다');
    end if;
    insert into pt_members (branch, coach_id, consult_id, name, phone, product, total_sessions, used_sessions, start_date, status, memo)
    values (v_br, p_coach_id, p_consult_id, btrim(p_name), regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),
            left(p_product,60), v_total, v_used,
            p_start, coalesce(nullif(p_status,''),'active'), left(p_memo,1000))
    returning id into v_id;
  else
    if not _pt_member_in_scope(p_id, v_br, p_actor_coach_id) then
      return jsonb_build_object('ok',false,'error','이 회원을 수정할 권한이 없습니다');
    end if;
    update pt_members set
      coach_id = case when p_actor_coach_id is null then p_coach_id else p_actor_coach_id end,
      name = btrim(p_name),
      phone = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),
      product = left(p_product,60),
      total_sessions = v_total,
      used_sessions  = v_used,
      start_date = p_start, status = coalesce(nullif(p_status,''),'active'),
      memo = left(p_memo,1000),
      manual_edited = true,          -- 새벽 자동 임포트가 사람이 고친 값을 덮지 않게 한다
      updated_at = now()
    where id = p_id and branch = v_br and deleted_at is null returning id into v_id;
    if v_id is null then return jsonb_build_object('ok',false,'error','회원을 찾을 수 없습니다'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- ---------------------------------------------------------------------
-- pt_public_coaches
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_public_coaches(p_branch text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'title', title, 'phone', phone, 'intro', intro, 'photo_url', photo_url
    ) order by sort_order, id), '[]'::jsonb)
  from pt_coaches
  where branch = coalesce(nullif(btrim(p_branch),''),'sunreung') and active;
$function$;

-- ---------------------------------------------------------------------
-- pt_submit
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_submit(p_branch text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_name text; v_phone text; v_recent int; v_global int;
        v_pphone text; v_health boolean; v_br text;
begin
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  v_name  := btrim(coalesce(p_data->>'name',''));
  v_phone := regexp_replace(coalesce(p_data->>'phone',''), '[^0-9]', '', 'g');
  v_pphone := nullif(regexp_replace(coalesce(p_data->>'partner_phone',''), '[^0-9]', '', 'g'), '');
  v_health := (coalesce(p_data->>'consent_health','') = 'true');

  if length(v_name) < 1 or length(v_name) > 30 then
    return jsonb_build_object('ok', false, 'error', '이름을 확인해 주세요');
  end if;
  if length(v_phone) < 9 or length(v_phone) > 11 then
    return jsonb_build_object('ok', false, 'error', '연락처를 확인해 주세요');
  end if;
  if coalesce(p_data->>'consent','') <> 'true' then
    return jsonb_build_object('ok', false, 'error', '개인정보 수집·이용 동의가 필요합니다');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_phone));

  select count(*) into v_recent from pt_consults
   where phone = v_phone and created_at > now() - interval '10 minutes';
  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'error', '잠시 후 다시 시도해 주세요');
  end if;

  select count(*) into v_global from pt_consults
   where branch = v_br and created_at > now() - interval '10 minutes';
  if v_global >= 20 then
    return jsonb_build_object('ok', false, 'error', '접수가 몰리고 있어요. 잠시 후 다시 시도해 주세요.');
  end if;

  insert into pt_consults (branch, name, phone, gender, age_band, goal, fitness_level,
    experience, injury, pref_days, pref_time, interest, source, note,
    partner_name, partner_phone, consent_at, consent_health)
  values (v_br, v_name, v_phone,
    left(p_data->>'gender',10), left(p_data->>'age_band',20), left(p_data->>'goal',200),
    case when v_health then left(p_data->>'fitness_level',40) else null end,
    left(p_data->>'experience',200),
    case when v_health then left(p_data->>'injury',300) else null end,
    left(p_data->>'pref_days',100), left(p_data->>'pref_time',100), left(p_data->>'interest',60),
    left(p_data->>'source',60), left(p_data->>'note',600),
    left(nullif(btrim(coalesce(p_data->>'partner_name','')),''),30), v_pphone,
    now(), v_health)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- ---------------------------------------------------------------------
-- pt_tg_add
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_tg_add(p_secret text, p_branch text, p_chat_id text, p_label text DEFAULT ''::text, p_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_was boolean; v_br text; v_label text;
begin
  if not public._pt_admin_ok(p_secret) then raise exception 'unauthorized'; end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  if coalesce(trim(p_chat_id),'') = '' then return jsonb_build_object('ok',false,'msg','chat_id 없음'); end if;
  v_label := left(coalesce(nullif(btrim(regexp_replace(p_label,'[[:space:]]+',' ','g')),''),'이름없음'), 40);
  if p_coach_id is not null and not exists (select 1 from pt_coaches where id = p_coach_id and branch = v_br) then
    return jsonb_build_object('ok', false, 'error', '다른 지점 코치는 지정할 수 없습니다');
  end if;
  select active into v_was from pt_tg_recipients where branch = v_br and chat_id = trim(p_chat_id);
  insert into pt_tg_recipients (branch, chat_id, label, coach_id)
  values (v_br, trim(p_chat_id), v_label, p_coach_id)
  on conflict (branch, chat_id) do update
    set label = excluded.label,
        coach_id = coalesce(pt_tg_recipients.coach_id, excluded.coach_id)
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'active',coalesce(v_was,true));
end $function$;

-- ---------------------------------------------------------------------
-- pt_tg_del
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_tg_del(p_secret text, p_id bigint, p_branch text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public._pt_admin_ok(p_secret) then raise exception 'unauthorized'; end if;
  delete from pt_tg_recipients
   where id = p_id and (p_branch is null or branch = coalesce(nullif(btrim(p_branch),''),'sunreung'));
  return jsonb_build_object('ok', found);
end $function$;

-- ---------------------------------------------------------------------
-- pt_tg_link
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_tg_link(p_secret text, p_id bigint, p_coach_id bigint, p_branch text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text;
begin
  if not public._pt_admin_ok(p_secret) then raise exception 'unauthorized'; end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  if p_coach_id is not null and not exists (select 1 from pt_coaches where id = p_coach_id and branch = v_br) then
    return jsonb_build_object('ok', false, 'error', '다른 지점 코치는 지정할 수 없습니다');
  end if;
  update pt_tg_recipients set coach_id = p_coach_id
   where id = p_id and (p_branch is null or branch = v_br);
  return jsonb_build_object('ok', found);
end $function$;

-- ---------------------------------------------------------------------
-- pt_tg_list
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_tg_list(p_secret text, p_branch text DEFAULT 'sunreung'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text;
begin
  if not public._pt_admin_ok(p_secret) then raise exception 'unauthorized'; end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'chat_id', r.chat_id, 'label', r.label,
      'active', r.active, 'coach_id', r.coach_id, 'coach_name', c.name,
      'coach_off', (r.coach_id is not null and not (c.active and c.approved)),
      'needs_reactivate', (r.coach_id is not null and c.active and c.approved and not r.active),
      'unlinked', (r.coach_id is null),
      'created_at', r.created_at
    ) order by r.id)
    from pt_tg_recipients r left join pt_coaches c on c.id = r.coach_id
    where r.branch = v_br
  ), '[]'::jsonb);
end $function$;

-- ---------------------------------------------------------------------
-- pt_tg_targets
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_tg_targets(p_secret text, p_branch text DEFAULT 'sunreung'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_br text;
begin
  if not public._pt_admin_ok(p_secret) then raise exception 'unauthorized'; end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  return coalesce((
    select jsonb_agg(r.chat_id order by r.id)
    from pt_tg_recipients r left join pt_coaches c on c.id = r.coach_id
    where r.branch = v_br and r.active
      and (r.coach_id is null or (c.active and c.approved))
  ), '[]'::jsonb);
end $function$;

-- ---------------------------------------------------------------------
-- pt_tg_toggle
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_tg_toggle(p_secret text, p_id bigint, p_active boolean, p_branch text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public._pt_admin_ok(p_secret) then raise exception 'unauthorized'; end if;
  update pt_tg_recipients set active = p_active
   where id = p_id and (p_branch is null or branch = coalesce(nullif(btrim(p_branch),''),'sunreung'));
  return jsonb_build_object('ok', found);
end $function$;

-- ---------------------------------------------------------------------
-- pt_update
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_update(p_secret text, p_id bigint, p_status text DEFAULT NULL::text, p_memo text DEFAULT NULL::text, p_coach_id bigint DEFAULT NULL::bigint, p_branch text DEFAULT 'sunreung'::text, p_actor_coach_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int; v_br text; v_coach bigint;
begin
  if not _pt_admin_ok(p_secret) then return jsonb_build_object('error','forbidden'); end if;
  v_br := coalesce(nullif(btrim(p_branch),''),'sunreung');
  if p_status is not null and p_status <> ''
     and p_status not in ('new','contacted','consulted','joined','hold') then
    return jsonb_build_object('ok', false, 'error', '알 수 없는 상태값');
  end if;
  -- 코치는 자기 자신에게만 배정할 수 있다
  v_coach := case when p_actor_coach_id is not null then p_actor_coach_id else p_coach_id end;
  if v_coach is not null and v_coach > 0
     and not exists (select 1 from pt_coaches where id = v_coach and branch = v_br) then
    return jsonb_build_object('ok', false, 'error', '다른 지점 코치는 배정할 수 없습니다');
  end if;

  update pt_consults set
    status = case when p_status is null or p_status = '' then status else p_status end,
    admin_memo = case when p_memo is null then admin_memo else left(p_memo, 1000) end,
    coach_id = case when v_coach is null then coach_id when v_coach < 0 then null else v_coach end,
    updated_at = now()
  where id = p_id and branch = v_br
    and purged_at is null
    -- 코치는 자기 담당이거나 미배정 상담만 손댈 수 있다
    and (p_actor_coach_id is null or coach_id is null or coach_id = p_actor_coach_id);
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', '해당 상담을 찾을 수 없거나 권한이 없습니다'); end if;
  return jsonb_build_object('ok', true);
end $function$;

-- (끝)
