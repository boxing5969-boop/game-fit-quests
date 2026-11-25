-- 🥊 스파링 영상 1차 (유튜브) — 2026-11-25 대표님 「일단 서비스를 빠르게 출시하기 위해선 유튜브를 필연적으로 하고 나중에 2차 플랜을 가동해야겠네」 → 「다음가자」
-- 문서: docs/features/64-스파링-영상.md
--
-- 추가만 한다(미리보기 단계 — 기존 함수 · 정책은 안 건드림):
--   sparring_consents 새 칸   영상 동의 v2 (촬영 · 유튜브 일부공개 보관 · 상대에게 제공 · 코치 피드백) · 커뮤니티 공개 기본값 · 14세 미만
--   sparring_matches          경기 하나 = 한 판(보통 3라운드). 코치가 타이머 「스파링 기록」으로 시작 → 경기 번호 = 파일 이름 = 유튜브 제목(실명 없음)
--   member_videos             회원 영상. 저장처(provider) youtube | r2 | device | gdrive | storage — 2차 플랜에서 저장처만 바꿔 끼운다
--   member_video_people       영상에 나온 회원. 커뮤니티 공개는 사람마다 따로(share_ok) — 모두 켜야 공개
--   member_video_comments     코치 피드백 = 영상 시각(t_sec) + 글. 오삼코치 초안(draft)은 코치가 승인해야 회원에게 보인다
--   sparring_recorder_keys    링 옆 녹화 노트북 열쇠 — 경기 번호 · 시각만 받는다(이름 · 동의 까닭 없음)
--
-- 쓰기는 모두 아래 함수로만(표에 직접 쓰기 정책 없음). 읽기 정책: 코치 · 지점장 = 그 지점 / 회원 = 내가 나온 영상만.
-- 촬영 원칙: 두 사람 모두 영상 동의 v2 + 14세 미만 아님 + 미성년은 보호자 칸 → film_ok. 아니면 녹화 노트북이 그 경기를 자르지 않고 원본도 지운다.

-- ── 동의서 v2 칸 ─────────────────────────────────────────────
alter table public.sparring_consents
  add column if not exists video_ok boolean not null default false,
  add column if not exists video_share_ok boolean not null default false,
  add column if not exists minor_under14 boolean not null default false,
  add column if not exists video_terms text,
  add column if not exists video_agreed_at timestamptz;

comment on column public.sparring_consents.video_ok is
  '스파링 영상 동의(v2): 링 촬영 · 유튜브 일부공개 보관(링크가 있으면 누구나 볼 수 있음, 해외 서버) · 같이 스파링한 상대에게 제공 · 코치 피드백';
comment on column public.sparring_consents.video_share_ok is '커뮤니티 공개 기본값 — 영상마다 다시 바꿀 수 있고, 같이 나온 사람도 모두 켜야 공개';
comment on column public.sparring_consents.minor_under14 is '만 14세 미만 — 1차(유튜브)에서는 촬영하지 않는다';

-- ── 표 ──────────────────────────────────────────────────────
create table if not exists public.sparring_matches (
  id uuid primary key default gen_random_uuid(),
  match_code text not null,
  branch_name text not null,
  match_date date not null,
  seq integer not null,
  user_a uuid not null,
  user_b uuid not null,
  film_ok boolean not null default false,
  film_block jsonb,                       -- 찍지 않는 까닭 {"a": "영상 동의 없음", "b": null} — 코치 화면에만
  rounds integer not null default 3,
  round_sec integer not null default 120,
  rest_sec integer not null default 60,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'live',
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  constraint sparring_matches_code_uniq unique (match_code),
  constraint sparring_matches_seq_uniq unique (branch_name, match_date, seq),
  constraint sparring_matches_pair_chk check (user_a <> user_b),
  constraint sparring_matches_status_chk check (status in ('live', 'done', 'cancelled'))
);
create index if not exists sparring_matches_branch_day_idx on public.sparring_matches (branch_name, match_date desc, seq);
create index if not exists sparring_matches_a_idx on public.sparring_matches (user_a, started_at desc);
create index if not exists sparring_matches_b_idx on public.sparring_matches (user_b, started_at desc);

create table if not exists public.member_videos (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'sparring',
  match_id uuid references public.sparring_matches (id) on delete set null,
  branch_name text not null,
  provider text not null,
  external_id text not null,              -- youtube = 영상 id · r2/storage = 경로 · device = 기기 안 키 · gdrive = 파일 id
  title text,
  duration_sec integer,
  recorded_at timestamptz,
  status text not null default 'ready',
  added_by uuid,
  added_via text not null default 'manual',  -- manual(코치가 링크 붙임) · youtube_sync(채널 자동) · upload
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_reason text,
  constraint member_videos_kind_chk check (kind in ('sparring', 'mitt', 'other')),
  constraint member_videos_provider_chk check (provider in ('youtube', 'r2', 'device', 'gdrive', 'storage')),
  constraint member_videos_status_chk check (status in ('ready', 'hidden', 'deleted')),
  constraint member_videos_ext_uniq unique (provider, external_id)
);
create index if not exists member_videos_match_idx on public.member_videos (match_id);
create index if not exists member_videos_branch_idx on public.member_videos (branch_name, created_at desc);

create table if not exists public.member_video_people (
  video_id uuid not null references public.member_videos (id) on delete cascade,
  user_id uuid not null,
  share_ok boolean not null default false,
  share_set_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create index if not exists member_video_people_user_idx on public.member_video_people (user_id, created_at desc);

create table if not exists public.member_video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.member_videos (id) on delete cascade,
  author_id uuid,
  t_sec numeric(8, 1),
  body text not null,
  kind text not null default 'coach',
  status text not null default 'published',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_video_comments_kind_chk check (kind in ('coach', 'ai_draft')),
  constraint member_video_comments_status_chk check (status in ('draft', 'published', 'hidden')),
  constraint member_video_comments_body_chk check (char_length(body) between 1 and 500)
);
create index if not exists member_video_comments_video_idx on public.member_video_comments (video_id, t_sec nulls first, created_at);

create table if not exists public.sparring_recorder_keys (
  token_sha256 text primary key,
  branch_name text not null,
  label text,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.sparring_matches enable row level security;
alter table public.member_videos enable row level security;
alter table public.member_video_people enable row level security;
alter table public.member_video_comments enable row level security;
alter table public.sparring_recorder_keys enable row level security;

revoke all on public.sparring_matches, public.member_videos, public.member_video_people,
              public.member_video_comments, public.sparring_recorder_keys from anon;
revoke all on public.sparring_recorder_keys from authenticated;
revoke insert, update, delete, truncate on public.sparring_matches, public.member_videos,
              public.member_video_people, public.member_video_comments from authenticated;
grant select on public.sparring_matches, public.member_videos, public.member_video_people,
                public.member_video_comments to authenticated;

-- ── 도우미 ──────────────────────────────────────────────────
-- 그 지점 코치 · 지점장인가 (전체관리자 · 관리자는 모든 지점). 정책에서 부르므로 authenticated 실행 권한.
create or replace function public.sparvid_staff_of(_branch text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_my text;
  v_staff boolean;
begin
  if v_me is null or coalesce(_branch, '') = '' then return false; end if;
  if public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin') then return true; end if;
  select p.branch_name, coalesce(p.is_staff, false) into v_my, v_staff
    from public.profiles p where p.user_id = v_me
   order by (p.merged_into is null) desc limit 1;
  if not (coalesce(v_staff, false) or public.has_role(v_me, 'branch_manager') or public.has_role(v_me, 'coach')) then
    return false;
  end if;
  return coalesce(v_my, '') = _branch;
end $$;

create or replace function public._sparvid_in_video(_vid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.member_video_people p where p.video_id = _vid and p.user_id = auth.uid());
$$;

create or replace function public._sparvid_video_branch(_vid uuid)
returns text language sql stable security definer set search_path = public as $$
  select v.branch_name from public.member_videos v where v.id = _vid;
$$;

create or replace function public._sparvid_my_branch()
returns text language sql stable security definer set search_path = public as $$
  select p.branch_name from public.profiles p where p.user_id = auth.uid()
   order by (p.merged_into is null) desc limit 1;
$$;

create or replace function public._sparvid_name(_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(nullif(trim(p.nickname), ''), nullif(trim(p.name), ''))
       from public.profiles p where p.user_id = _uid
      order by (p.merged_into is null) desc limit 1),
    '회원');
$$;

-- 코치 표기 "김OO 코치님"
create or replace function public._sparvid_staff_name(_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select trim(coalesce(nullif(trim(p.name), ''), nullif(trim(p.nickname), ''), '') || ' '
               || case when coalesce(nullif(trim(p.staff_title), ''), '코치') like '%님'
                       then coalesce(nullif(trim(p.staff_title), ''), '코치')
                       else coalesce(nullif(trim(p.staff_title), ''), '코치') || '님' end)
       from public.profiles p where p.user_id = _uid
      order by (p.merged_into is null) desc limit 1),
    '코치님');
$$;

-- 만 나이 (생년월일 YYYY-MM-DD · YYYYMMDD, 모르면 null)
create or replace function public._sparvid_age(_uid uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v text;
  d date;
begin
  select p.birth_date into v from public.profiles p where p.user_id = _uid
   order by (p.merged_into is null) desc limit 1;
  if v ~ '^\d{4}-\d{2}-\d{2}$' then d := v::date;
  elsif v ~ '^\d{8}$' then d := to_date(v, 'YYYYMMDD');
  else return null;
  end if;
  return extract(year from age((now() at time zone 'Asia/Seoul')::date, d))::int;
exception when others then
  return null;
end $$;

-- 찍어도 되는 회원인가 — null = 됨, 아니면 까닭
create or replace function public._sparvid_film_check(_uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  v_age int;
begin
  select s.status, s.video_ok, s.minor_under14, s.is_minor, s.guardian_name into c
    from public.sparring_consents s where s.user_id = _uid
   order by s.created_at desc limit 1;
  if not found then return '동의서 없음'; end if;
  if c.status = 'revoked' then return '동의 철회'; end if;
  if not coalesce(c.video_ok, false) then return '영상 동의 없음'; end if;
  if coalesce(c.minor_under14, false) then return '14세 미만'; end if;
  v_age := public._sparvid_age(_uid);
  if v_age is not null and v_age < 14 then return '14세 미만'; end if;
  if (coalesce(c.is_minor, false) or (v_age is not null and v_age < 18))
     and coalesce(trim(c.guardian_name), '') = '' then
    return '보호자 동의 없음';
  end if;
  return null;
end $$;

-- 지점 짧은 이름 (branches.code — 없으면 지점 이름에서 만든 6자)
create or replace function public._sparvid_branch_code(_branch text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(lower(regexp_replace(b.code, '[^a-zA-Z0-9]', '', 'g')), '')
       from public.branches b where b.name = _branch limit 1),
    'b' || substr(md5(coalesce(_branch, '')), 1, 6));
$$;

-- 알림함 + 휴대폰 (밤 10시 ~ 아침 8시는 알림함에만)
create or replace function public._sparvid_notify(_uid uuid, _title text, _body text, _link text)
returns void language plpgsql security definer set search_path = public as $$
declare v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
begin
  if _uid is null then return; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (_uid, left(_title, 120), left(coalesce(_body, ''), 300), _link,
          case when v_h >= 22 or v_h < 8 then now() end);
end $$;

-- 경기 끝 시각 (끝을 안 눌렀으면 라운드로 계산)
create or replace function public._sparvid_match_end_est(m public.sparring_matches)
returns timestamptz language sql immutable as $$
  select coalesce(m.ended_at,
                  m.started_at + make_interval(secs => m.rounds * m.round_sec + greatest(m.rounds - 1, 0) * m.rest_sec + 10));
$$;

-- ── 코치: 오늘 출석한 회원 (스파링 상대 고르기) · 이름 찾기 ─────────
-- _q 가 있으면 그 지점 회원 이름 찾기(출석 안 찍은 사람), 없으면 오늘 출석한 사람.
create or replace function public.sparvid_pick_list(_q text default null, _branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_branch text := coalesce(nullif(trim(_branch), ''), public._sparvid_my_branch());
  v_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
  v_q text := nullif(trim(coalesce(_q, '')), '');
  v_out jsonb;
begin
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 볼 수 있어요'; end if;
  with base as (
    select a.user_id as uid, min(a.checked_in_at) as at
      from public.attendance_logs a
     where v_q is null and a.branch_name = v_branch and a.checked_in_at >= v_start
       and not coalesce(a.is_duplicate, false)
     group by a.user_id
    union all
    select x.uid, null::timestamptz
      from (select distinct on (p.user_id) p.user_id as uid
              from public.profiles p
             where v_q is not null and p.branch_name = v_branch and p.merged_into is null
               and not coalesce(p.is_test_account, false)
               and (p.name ilike '%' || v_q || '%' or p.nickname ilike '%' || v_q || '%')
             order by p.user_id) x
     limit 40
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', b.uid,
           'name', public._sparvid_name(b.uid),
           'checked_in_at', b.at,
           'is_staff', coalesce((select p.is_staff from public.profiles p where p.user_id = b.uid limit 1), false),
           'consent', (select s.status from public.sparring_consents s where s.user_id = b.uid order by s.created_at desc limit 1),
           'film_block', public._sparvid_film_check(b.uid)
         ) order by b.at desc nulls last), '[]'::jsonb)
    into v_out
    from base b;
  return jsonb_build_object('branch', v_branch, 'people', v_out);
end $$;

-- ── 코치: 경기 시작 · 끝 ───────────────────────────────────────
create or replace function public.sparvid_match_start(
  _a uuid, _b uuid, _rounds integer default 3, _round_sec integer default 120, _rest_sec integer default 60,
  _branch text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_branch text := coalesce(nullif(trim(_branch), ''), public._sparvid_my_branch());
  v_date date := (now() at time zone 'Asia/Seoul')::date;
  v_seq int;
  v_code text;
  v_fa text;
  v_fb text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 스파링을 기록할 수 있어요'; end if;
  if _a is null or _b is null or _a = _b then raise exception '서로 다른 두 사람을 골라 주세요'; end if;
  perform pg_advisory_xact_lock(hashtext('sparvid:' || v_branch || ':' || v_date::text));
  select coalesce(max(m.seq), 0) + 1 into v_seq
    from public.sparring_matches m where m.branch_name = v_branch and m.match_date = v_date;
  v_code := public._sparvid_branch_code(v_branch) || '-' || to_char(v_date, 'YYMMDD') || '-' || lpad(v_seq::text, 2, '0');
  v_fa := public._sparvid_film_check(_a);
  v_fb := public._sparvid_film_check(_b);
  insert into public.sparring_matches
    (match_code, branch_name, match_date, seq, user_a, user_b, film_ok, film_block,
     rounds, round_sec, rest_sec, recorded_by)
  values
    (v_code, v_branch, v_date, v_seq, _a, _b, v_fa is null and v_fb is null,
     case when v_fa is null and v_fb is null then null else jsonb_build_object('a', v_fa, 'b', v_fb) end,
     greatest(1, least(coalesce(_rounds, 3), 20)),
     greatest(30, least(coalesce(_round_sec, 120), 600)),
     greatest(0, least(coalesce(_rest_sec, 60), 300)),
     auth.uid())
  returning id into v_id;
  return jsonb_build_object(
    'id', v_id, 'match_code', v_code, 'seq', v_seq, 'film_ok', v_fa is null and v_fb is null,
    'a_name', public._sparvid_name(_a), 'b_name', public._sparvid_name(_b),
    'a_block', v_fa, 'b_block', v_fb);
end $$;

-- _cancel = 이번 경기는 없던 일로(촬영도 안 함)
create or replace function public.sparvid_match_end(_match_id uuid, _cancel boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.sparring_matches;
begin
  select * into m from public.sparring_matches where id = _match_id for update;
  if not found then raise exception '경기를 찾지 못했어요'; end if;
  if not public.sparvid_staff_of(m.branch_name) then raise exception '코치님 · 지점장님만 바꿀 수 있어요'; end if;
  update public.sparring_matches
     set ended_at = coalesce(case when _cancel then now() end, ended_at, now()),
         status = case when _cancel then 'cancelled' else 'done' end,
         film_ok = case when _cancel then false else film_ok end
   where id = _match_id;
  return jsonb_build_object('id', _match_id, 'status', case when _cancel then 'cancelled' else 'done' end);
end $$;

-- ── 코치: 하루 경기 목록 ───────────────────────────────────────
create or replace function public.sparvid_day_matches(_date date default null, _branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_branch text := coalesce(nullif(trim(_branch), ''), public._sparvid_my_branch());
  v_date date := coalesce(_date, (now() at time zone 'Asia/Seoul')::date);
  v_out jsonb;
begin
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 볼 수 있어요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'match_code', m.match_code, 'seq', m.seq, 'status', m.status,
           'started_at', m.started_at, 'ended_at', m.ended_at, 'ends_at_est', public._sparvid_match_end_est(m),
           'rounds', m.rounds, 'round_sec', m.round_sec, 'rest_sec', m.rest_sec,
           'film_ok', m.film_ok, 'film_block', m.film_block,
           'a_id', m.user_a, 'a_name', public._sparvid_name(m.user_a),
           'b_id', m.user_b, 'b_name', public._sparvid_name(m.user_b),
           'video_id', v.id, 'video_provider', v.provider, 'video_external_id', v.external_id,
           'comment_count', (select count(*) from public.member_video_comments c
                              where c.video_id = v.id and c.status = 'published')
         ) order by m.seq desc), '[]'::jsonb)
    into v_out
    from public.sparring_matches m
    left join lateral (
      select x.* from public.member_videos x
       where x.match_id = m.id and x.status = 'ready' order by x.created_at desc limit 1
    ) v on true
   where m.branch_name = v_branch and m.match_date = v_date;
  return jsonb_build_object('branch', v_branch, 'date', v_date,
                            'branch_code', public._sparvid_branch_code(v_branch), 'matches', v_out);
end $$;

-- ── 코치: 경기에 유튜브 영상 붙이기 (자동 연결 전 · 시험용 손 연결) ─────────
create or replace function public.sparvid_attach_video(_match_id uuid, _ref text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  m public.sparring_matches;
  v_yt text;
  v_vid uuid;
  v_new boolean := false;
begin
  select * into m from public.sparring_matches where id = _match_id;
  if not found then raise exception '경기를 찾지 못했어요'; end if;
  if not public.sparvid_staff_of(m.branch_name) then raise exception '코치님 · 지점장님만 붙일 수 있어요'; end if;
  if m.status = 'cancelled' then raise exception '취소한 경기예요'; end if;
  if not m.film_ok then raise exception '촬영 동의가 안 된 경기예요 — 영상을 올리지 말고 지워 주세요'; end if;
  v_yt := coalesce(
    substring(coalesce(_ref, '') from '(?:v=|youtu\.be/|/shorts/|/live/|/video/|/embed/)([A-Za-z0-9_-]{11})'),
    substring(trim(coalesce(_ref, '')) from '^([A-Za-z0-9_-]{11})$'));
  if v_yt is null then raise exception '유튜브 주소를 알아보지 못했어요'; end if;
  if exists (select 1 from public.member_videos x where x.provider = 'youtube' and x.external_id = v_yt
               and x.match_id is distinct from _match_id) then
    raise exception '이 영상은 다른 경기에 붙어 있어요';
  end if;

  select x.id into v_vid from public.member_videos x
   where x.match_id = _match_id and x.status = 'ready' order by x.created_at desc limit 1;
  if v_vid is null then
    insert into public.member_videos (kind, match_id, branch_name, provider, external_id, title, recorded_at, added_by, added_via)
    values ('sparring', m.id, m.branch_name, 'youtube', v_yt, m.match_code, m.started_at, auth.uid(), 'manual')
    returning id into v_vid;
    v_new := true;
  else
    update public.member_videos set external_id = v_yt where id = v_vid;
  end if;

  insert into public.member_video_people (video_id, user_id, share_ok, share_set_at)
  select v_vid, u.uid,
         coalesce((select s.video_share_ok from public.sparring_consents s where s.user_id = u.uid
                    order by s.created_at desc limit 1), false),
         now()
    from (values (m.user_a), (m.user_b)) as u(uid)
  on conflict (video_id, user_id) do nothing;

  if v_new then
    perform public._sparvid_notify(u.uid, '🥊 오늘 스파링 영상이 올라왔어요',
                                   '훈련 탭 「내 스파링 영상」에서 다시 보세요 · 코치님 피드백도 여기로 와요',
                                   '/missions?sparvid=' || v_vid::text)
       from (values (m.user_a), (m.user_b)) as u(uid);
  end if;
  return jsonb_build_object('video_id', v_vid, 'external_id', v_yt, 'new', v_new);
end $$;

-- 코치: 영상 내리기 (동의 철회 · 잘못 올림). 유튜브 영상은 코치가 유튜브에서도 지운다.
create or replace function public.sparvid_video_remove(_video_id uuid, _reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := public._sparvid_video_branch(_video_id);
begin
  if v_branch is null then raise exception '영상을 찾지 못했어요'; end if;
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 내릴 수 있어요'; end if;
  update public.member_videos
     set status = 'deleted', deleted_at = now(), delete_reason = left(nullif(trim(coalesce(_reason, '')), ''), 200)
   where id = _video_id;
  return jsonb_build_object('video_id', _video_id, 'status', 'deleted');
end $$;

-- ── 회원: 내 영상 ─────────────────────────────────────────────
create or replace function public.sparvid_my_videos(_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_out jsonb;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(row_obj order by rec_at desc), '[]'::jsonb) into v_out
    from (
      select coalesce(v.recorded_at, v.created_at) as rec_at,
             jsonb_build_object(
               'video_id', v.id, 'kind', v.kind, 'provider', v.provider, 'external_id', v.external_id,
               'title', v.title, 'recorded_at', coalesce(v.recorded_at, v.created_at), 'branch', v.branch_name,
               'match_code', m.match_code, 'rounds', m.rounds,
               'opponent_name', (select string_agg(public._sparvid_name(o.user_id), ', ')
                                   from public.member_video_people o where o.video_id = v.id and o.user_id <> v_me),
               'my_share_ok', me.share_ok,
               'others_share_ok', (select bool_and(o.share_ok) from public.member_video_people o
                                    where o.video_id = v.id and o.user_id <> v_me),
               'comment_count', (select count(*) from public.member_video_comments c
                                  where c.video_id = v.id and c.status = 'published'),
               'last_comment_at', (select max(c.created_at) from public.member_video_comments c
                                    where c.video_id = v.id and c.status = 'published')
             ) as row_obj
        from public.member_video_people me
        join public.member_videos v on v.id = me.video_id and v.status = 'ready'
        left join public.sparring_matches m on m.id = v.match_id
       where me.user_id = v_me
       order by coalesce(v.recorded_at, v.created_at) desc
       limit greatest(1, least(coalesce(_limit, 30), 100))
    ) t;
  return v_out;
end $$;

-- 회원: 이 영상을 커뮤니티에 보여도 되는가 (같이 나온 사람도 모두 켜야 공개)
create or replace function public.sparvid_set_share(_video_id uuid, _ok boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  update public.member_video_people
     set share_ok = coalesce(_ok, false), share_set_at = now()
   where video_id = _video_id and user_id = auth.uid();
  if not found then raise exception '내가 나온 영상이 아니에요'; end if;
  return jsonb_build_object('video_id', _video_id, 'share_ok', coalesce(_ok, false));
end $$;

-- ── 피드백 (영상 시각 + 글) ────────────────────────────────────
create or replace function public.sparvid_video_comments(_video_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_branch text := public._sparvid_video_branch(_video_id);
  v_staff boolean := public.sparvid_staff_of(v_branch);
  v_out jsonb;
begin
  if v_branch is null then raise exception '영상을 찾지 못했어요'; end if;
  if not (v_staff or public._sparvid_in_video(_video_id)) then raise exception '내가 나온 영상만 볼 수 있어요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 't_sec', c.t_sec, 'body', c.body, 'kind', c.kind, 'status', c.status,
           'author', case when c.kind = 'ai_draft' then '오삼코치 초안' else public._sparvid_staff_name(c.author_id) end,
           'mine', c.author_id = auth.uid(), 'created_at', c.created_at
         ) order by c.t_sec nulls first, c.created_at), '[]'::jsonb)
    into v_out
    from public.member_video_comments c
   where c.video_id = _video_id
     and (c.status = 'published' or (v_staff and c.status = 'draft'));
  return jsonb_build_object('staff', v_staff, 'comments', v_out);
end $$;

create or replace function public.sparvid_comment_add(_video_id uuid, _t_sec numeric, _body text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_branch text := public._sparvid_video_branch(_video_id);
  v_body text := trim(coalesce(_body, ''));
  v_id uuid;
  v_t text;
begin
  if v_branch is null then raise exception '영상을 찾지 못했어요'; end if;
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 피드백을 남길 수 있어요'; end if;
  if char_length(v_body) < 1 then raise exception '피드백 글을 써 주세요'; end if;
  insert into public.member_video_comments (video_id, author_id, t_sec, body, kind, status)
  values (_video_id, auth.uid(), case when _t_sec is null or _t_sec < 0 then null else round(_t_sec, 1) end,
          left(v_body, 500), 'coach', 'published')
  returning id into v_id;
  v_t := case when _t_sec is null or _t_sec < 0 then '' else
           (floor(_t_sec / 60))::int::text || ':' || lpad((floor(_t_sec)::int % 60)::text, 2, '0') || ' · ' end;
  perform public._sparvid_notify(p.user_id, '🥊 코치님 스파링 피드백이 왔어요', v_t || left(v_body, 80),
                                 '/missions?sparvid=' || _video_id::text)
     from public.member_video_people p where p.video_id = _video_id;
  return jsonb_build_object('id', v_id);
end $$;

-- _action: approve(오삼코치 초안 → 회원에게 보이기) · hide
create or replace function public.sparvid_comment_set(_comment_id uuid, _action text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.member_video_comments;
begin
  select * into c from public.member_video_comments where id = _comment_id for update;
  if not found then raise exception '피드백을 찾지 못했어요'; end if;
  if not public.sparvid_staff_of(public._sparvid_video_branch(c.video_id)) then raise exception '코치님 · 지점장님만 바꿀 수 있어요'; end if;
  if _action = 'approve' then
    if c.status <> 'draft' then return jsonb_build_object('id', c.id, 'status', c.status); end if;
    update public.member_video_comments
       set status = 'published', approved_by = auth.uid(), approved_at = now(), updated_at = now()
     where id = c.id;
    perform public._sparvid_notify(p.user_id, '🥊 코치님 스파링 피드백이 왔어요', left(c.body, 80),
                                   '/missions?sparvid=' || c.video_id::text)
       from public.member_video_people p where p.video_id = c.video_id;
    return jsonb_build_object('id', c.id, 'status', 'published');
  elsif _action = 'hide' then
    update public.member_video_comments set status = 'hidden', updated_at = now() where id = c.id;
    return jsonb_build_object('id', c.id, 'status', 'hidden');
  end if;
  raise exception '알 수 없는 동작이에요';
end $$;

-- ── 녹화 노트북 ───────────────────────────────────────────────
-- 열쇠 만들기 — 한 번만 보여 준다(DB 에는 sha256 만)
create or replace function public.sparvid_recorder_key_create(_label text default null, _branch text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_branch text := coalesce(nullif(trim(_branch), ''), public._sparvid_my_branch());
  v_tok text;
begin
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 만들 수 있어요'; end if;
  v_tok := 'spk_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.sparring_recorder_keys (token_sha256, branch_name, label, created_by)
  values (encode(sha256(convert_to(v_tok, 'UTF8')), 'hex'), v_branch,
          left(coalesce(nullif(trim(coalesce(_label, '')), ''), '링 녹화 노트북'), 60), auth.uid());
  return jsonb_build_object('token', v_tok, 'branch', v_branch, 'branch_code', public._sparvid_branch_code(v_branch));
end $$;

-- 노트북이 하루 경기 번호 · 시각을 받는다(이름 · 동의 까닭 없음). 열쇠만 있으면 된다(로그인 없음).
create or replace function public.sparvid_recorder_feed(_token text, _date date default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  k public.sparring_recorder_keys;
  v_date date := coalesce(_date, (now() at time zone 'Asia/Seoul')::date);
  v_out jsonb;
begin
  if coalesce(char_length(_token), 0) < 20 then raise exception 'bad key'; end if;
  select * into k from public.sparring_recorder_keys
   where token_sha256 = encode(sha256(convert_to(_token, 'UTF8')), 'hex') and revoked_at is null;
  if not found then raise exception 'bad key'; end if;
  if v_date < (now() at time zone 'Asia/Seoul')::date - 14 then raise exception 'too old'; end if;
  update public.sparring_recorder_keys set last_used_at = now() where token_sha256 = k.token_sha256;
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.match_code, 'seq', m.seq, 'status', m.status, 'film_ok', m.film_ok and m.status <> 'cancelled',
           'start', m.started_at, 'end', public._sparvid_match_end_est(m), 'ended', m.ended_at is not null
         ) order by m.seq), '[]'::jsonb)
    into v_out
    from public.sparring_matches m
   where m.branch_name = k.branch_name and m.match_date = v_date;
  return jsonb_build_object('branch_code', public._sparvid_branch_code(k.branch_name), 'date', v_date, 'matches', v_out);
end $$;

-- ── 밤 11시 「오늘의 스파링」 (코치 · 지점장 · 전체관리자) ─────────────
create or replace function public.sparvid_daily_summary()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_date date := (now() at time zone 'Asia/Seoul')::date;
  r record;
  v_sent int := 0;
  v_n int;
  v_lines text[] := '{}';
begin
  -- 끝을 안 누른 경기 정리
  update public.sparring_matches m
     set status = 'done', ended_at = public._sparvid_match_end_est(m)
   where m.status = 'live' and m.started_at < now() - interval '2 hours';

  for r in
    select m.branch_name,
           count(*) filter (where m.status <> 'cancelled') as n,
           count(*) filter (where m.status <> 'cancelled' and not m.film_ok) as n_nofilm,
           count(v.id) as n_video,
           count(v.id) filter (where not exists (select 1 from public.member_video_comments c
                                                  where c.video_id = v.id and c.status = 'published')) as n_wait
      from public.sparring_matches m
      left join public.member_videos v on v.match_id = m.id and v.status = 'ready'
     where m.match_date = v_date
     group by m.branch_name
  loop
    continue when r.n = 0;
    insert into public.notifications (user_id, title, body, link)
    select s.user_id, '🥊 오늘의 스파링',
           format('경기 %s · 영상 %s · 피드백 기다림 %s%s', r.n, r.n_video, r.n_wait,
                  case when r.n_nofilm > 0 then format(' · 촬영 안 함 %s(원본도 지우기)', r.n_nofilm) else '' end),
           '/missions?timer=spar'
      from public._strategy_branch_staff(r.branch_name) s
     where not public.has_role(s.user_id, 'super_admin');
    get diagnostics v_n = row_count;
    v_sent := v_sent + v_n;
    v_lines := v_lines || format('%s 경기 %s · 영상 %s', replace(r.branch_name, '153복싱짐 ', ''), r.n, r.n_video);
  end loop;

  if array_length(v_lines, 1) > 0 then
    insert into public.notifications (user_id, title, body, link)
    select distinct ur.user_id, '🥊 오늘의 스파링 (전 지점)', array_to_string(v_lines, ' / '), '/missions?timer=spar'
      from public.user_roles ur where ur.role = 'super_admin';
    get diagnostics v_n = row_count;
    v_sent := v_sent + v_n;
  end if;
  return v_sent;
end $$;

-- ── 읽기 정책 ─────────────────────────────────────────────────
do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sparring_matches'
                   and policyname = 'sparring_matches_staff_read') then
    create policy sparring_matches_staff_read on public.sparring_matches
      for select to authenticated using (public.sparvid_staff_of(branch_name));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_videos'
                   and policyname = 'member_videos_read') then
    create policy member_videos_read on public.member_videos
      for select to authenticated
      using (public.sparvid_staff_of(branch_name) or (status <> 'deleted' and public._sparvid_in_video(id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_video_people'
                   and policyname = 'member_video_people_read') then
    create policy member_video_people_read on public.member_video_people
      for select to authenticated
      using (user_id = (select auth.uid()) or public._sparvid_in_video(video_id)
             or public.sparvid_staff_of(public._sparvid_video_branch(video_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_video_comments'
                   and policyname = 'member_video_comments_read') then
    create policy member_video_comments_read on public.member_video_comments
      for select to authenticated
      using (public.sparvid_staff_of(public._sparvid_video_branch(video_id))
             or (status = 'published' and public._sparvid_in_video(video_id)));
  end if;
end
$p$;

-- ── 실행 권한 ─────────────────────────────────────────────────
-- 안쪽 도우미: 정책에서 부르는 셋만 authenticated
revoke all on function public._sparvid_my_branch() from public, anon, authenticated;
revoke all on function public._sparvid_name(uuid) from public, anon, authenticated;
revoke all on function public._sparvid_staff_name(uuid) from public, anon, authenticated;
revoke all on function public._sparvid_age(uuid) from public, anon, authenticated;
revoke all on function public._sparvid_film_check(uuid) from public, anon, authenticated;
revoke all on function public._sparvid_branch_code(text) from public, anon, authenticated;
revoke all on function public._sparvid_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._sparvid_match_end_est(public.sparring_matches) from public, anon, authenticated;
revoke all on function public.sparvid_daily_summary() from public, anon, authenticated;

revoke all on function public.sparvid_staff_of(text) from public, anon;
revoke all on function public._sparvid_in_video(uuid) from public, anon;
revoke all on function public._sparvid_video_branch(uuid) from public, anon;
grant execute on function public.sparvid_staff_of(text) to authenticated;
grant execute on function public._sparvid_in_video(uuid) to authenticated;
grant execute on function public._sparvid_video_branch(uuid) to authenticated;

-- 화면이 부르는 함수: 로그인한 사람(안에서 코치 · 회원을 가린다)
revoke all on function public.sparvid_pick_list(text, text) from public, anon;
revoke all on function public.sparvid_match_start(uuid, uuid, integer, integer, integer, text) from public, anon;
revoke all on function public.sparvid_match_end(uuid, boolean) from public, anon;
revoke all on function public.sparvid_day_matches(date, text) from public, anon;
revoke all on function public.sparvid_attach_video(uuid, text) from public, anon;
revoke all on function public.sparvid_video_remove(uuid, text) from public, anon;
revoke all on function public.sparvid_my_videos(integer) from public, anon;
revoke all on function public.sparvid_set_share(uuid, boolean) from public, anon;
revoke all on function public.sparvid_video_comments(uuid) from public, anon;
revoke all on function public.sparvid_comment_add(uuid, numeric, text) from public, anon;
revoke all on function public.sparvid_comment_set(uuid, text) from public, anon;
revoke all on function public.sparvid_recorder_key_create(text, text) from public, anon;
grant execute on function public.sparvid_pick_list(text, text) to authenticated;
grant execute on function public.sparvid_match_start(uuid, uuid, integer, integer, integer, text) to authenticated;
grant execute on function public.sparvid_match_end(uuid, boolean) to authenticated;
grant execute on function public.sparvid_day_matches(date, text) to authenticated;
grant execute on function public.sparvid_attach_video(uuid, text) to authenticated;
grant execute on function public.sparvid_video_remove(uuid, text) to authenticated;
grant execute on function public.sparvid_my_videos(integer) to authenticated;
grant execute on function public.sparvid_set_share(uuid, boolean) to authenticated;
grant execute on function public.sparvid_video_comments(uuid) to authenticated;
grant execute on function public.sparvid_comment_add(uuid, numeric, text) to authenticated;
grant execute on function public.sparvid_comment_set(uuid, text) to authenticated;
grant execute on function public.sparvid_recorder_key_create(text, text) to authenticated;

-- 녹화 노트북: 로그인 없이 열쇠로
revoke all on function public.sparvid_recorder_feed(text, date) from public;
grant execute on function public.sparvid_recorder_feed(text, date) to anon, authenticated;

-- ── 밤 11시(한국) = 14:00 UTC ─────────────────────────────────
do $c$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sparvid-daily-summary', '0 14 * * *', 'select public.sparvid_daily_summary()');
  end if;
end
$c$;
