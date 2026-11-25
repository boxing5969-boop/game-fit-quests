-- 🎥 훈련 영상 — 회원이 직접 올리기(인스타처럼) · 신고 (2026-11-25 23:58 대표님 「다음가자」)
--   대표님 「일단은 인스타그램처럼 회원님들 스스로가 직접 올리는 기능만 활성화해놓고 노트북 카메라 등등 준비되면 시작하자」
-- 문서: docs/features/64-스파링-영상.md
--
-- 추가만 한다:
--   저장소 member-videos   비공개 · 50MB · 영상 + 포스터(jpg). 경로 = <올린 회원 id>/<이름>. 올리기 · 지우기는 내 폴더만,
--                          보기는 sparvid_can_view_object(올린 사람 · 나온 사람 · 그 지점 코치진 · 공개면 같은 지점 회원)
--   member_videos 새 칸     caption · poster_path · want_feedback(코치 피드백 받기) · others_ok(나온 회원 허락 확인) · expires_at(90일) · hidden_*
--   member_video_reports   신고 — 처음 신고가 들어오면 바로 가리고(status hidden) 그 지점 코치진에게 알림, 코치가 다시 보이기 · 내리기
--   함수                    sparvid_upload_register · sparvid_report · sparvid_moderate · sparvid_reported · sparvid_my_delete ·
--                          sparvid_my_videos_v2 · sparvid_shared_videos_v2 (v1 은 그대로 둔다 — 지금 앱이 쓰는 중)
--   고침(더 엄격하게만)       sparvid_set_share — 만 14세 미만은 「나만 보기」만
-- 공개 규칙은 카메라 영상과 같다: 영상에 나온 사람(member_video_people)이 모두 share_ok 여야 「우리 지점」에 보인다.
-- 회원이 올린 영상은 올린 사람 한 명이 나온 사람 — share_ok = 「우리 지점에 공개」 단추.

-- ── 저장소 ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-videos', 'member-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ── member_videos 새 칸 · 신고 표 ─────────────────────────────────
alter table public.member_videos
  add column if not exists caption text,
  add column if not exists poster_path text,
  add column if not exists want_feedback boolean not null default false,
  add column if not exists others_ok boolean not null default false,
  add column if not exists expires_at timestamptz,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_reason text;
create index if not exists member_videos_poster_idx on public.member_videos (poster_path) where poster_path is not null;
create index if not exists member_videos_added_by_idx on public.member_videos (added_by, created_at desc);

create table if not exists public.member_video_reports (
  video_id uuid not null references public.member_videos (id) on delete cascade,
  reporter_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (video_id, reporter_id),
  constraint member_video_reports_reason_chk check (char_length(reason) between 1 and 200)
);
alter table public.member_video_reports enable row level security;
revoke all on public.member_video_reports from anon, authenticated;

-- ── 도우미 ───────────────────────────────────────────────────
-- 보는 사람의 지점 (승인 회원 · 코치진만, 보호자 계정은 null)
create or replace function public._sparvid_viewer_branch()
returns text language sql stable security definer set search_path = public as $$
  select case when coalesce(p.account_kind, '') = 'guardian' then null
              when coalesce(p.is_approved, false) or coalesce(p.is_staff, false) then nullif(p.branch_name, '')
         end
    from public.profiles p where p.user_id = auth.uid()
   order by (p.merged_into is null) desc limit 1;
$$;

-- 저장소 보기 정책에서 부른다 → authenticated 실행 권한 (CLAUDE.md: 저장소 정책엔 실행 가능한 함수만)
create or replace function public.sparvid_can_view_object(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.member_videos v
     where v.provider = 'storage' and (v.external_id = _name or v.poster_path = _name)
       and v.status <> 'deleted'
       and (v.added_by = auth.uid()
            or public._sparvid_in_video(v.id)
            or public.sparvid_staff_of(v.branch_name)
            or (v.status = 'ready'
                and v.branch_name = public._sparvid_viewer_branch()
                and exists (select 1 from public.member_video_people p where p.video_id = v.id)
                and not exists (select 1 from public.member_video_people p where p.video_id = v.id and not p.share_ok))));
$$;

do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'member_videos_insert_own') then
    create policy member_videos_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'member-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'member_videos_select') then
    create policy member_videos_select on storage.objects for select to authenticated
      using (bucket_id = 'member-videos'
             and ((storage.foldername(name))[1] = (select auth.uid())::text or public.sparvid_can_view_object(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'member_videos_delete_own') then
    create policy member_videos_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'member-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end
$p$;

-- ── 올리기 (파일은 앱이 먼저 내 폴더에 올리고, 여기서 등록) ─────────────────
create or replace function public.sparvid_upload_register(
  _path text, _poster text, _kind text, _caption text, _share boolean, _want_feedback boolean, _others_ok boolean,
  _duration numeric default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_branch text := public._sparvid_viewer_branch();
  v_age int;
  v_share boolean := coalesce(_share, false);
  v_poster text := _poster;
  v_id uuid;
  v_n int;
  v_name text;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if v_branch is null then raise exception '승인된 회원만 올릴 수 있어요'; end if;
  if not coalesce(_others_ok, false) then raise exception '영상에 나온 다른 회원에게 허락받았는지 확인해 주세요'; end if;
  if coalesce(_kind, '') not in ('sparring', 'mitt', 'other') then raise exception '영상 종류를 골라 주세요'; end if;
  if coalesce(_path, '') !~ ('^' || v_me::text || '/[A-Za-z0-9_.-]+$') then raise exception '올린 파일 경로가 맞지 않아요'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'member-videos' and o.name = _path) then
    raise exception '영상이 아직 다 올라가지 않았어요 — 다시 눌러 주세요';
  end if;
  if v_poster is not null and (v_poster !~ ('^' || v_me::text || '/[A-Za-z0-9_.-]+$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'member-videos' and o.name = v_poster)) then
    v_poster := null;
  end if;
  select count(*) into v_n from public.member_videos
   where added_by = v_me and added_via = 'upload' and created_at > now() - interval '1 day';
  if v_n >= 10 then raise exception '하루에 10편까지 올릴 수 있어요'; end if;
  v_age := public._sparvid_age(v_me);
  if v_age is not null and v_age < 14 then v_share := false; end if;

  insert into public.member_videos
    (kind, branch_name, provider, external_id, caption, poster_path, duration_sec, recorded_at, status,
     added_by, added_via, want_feedback, others_ok, expires_at)
  values
    (_kind, v_branch, 'storage', _path, nullif(left(trim(coalesce(_caption, '')), 100), ''), v_poster,
     case when _duration is null then null else greatest(0, least(round(_duration)::int, 600)) end, now(), 'ready',
     v_me, 'upload', coalesce(_want_feedback, false), true, now() + interval '90 days')
  returning id into v_id;
  insert into public.member_video_people (video_id, user_id, share_ok, share_set_at) values (v_id, v_me, v_share, now());

  if coalesce(_want_feedback, false) then
    v_name := public._sparvid_name(v_me);
    perform public._sparvid_notify(s.user_id, '🎥 영상 피드백 요청',
              v_name || ' 회원 · ' || case _kind when 'sparring' then '스파링' when 'mitt' then '미트' else '훈련' end || ' 영상',
              '/missions?sparvid=' || v_id::text)
       from public._strategy_branch_staff(v_branch) s;
  end if;
  return jsonb_build_object('video_id', v_id, 'share_ok', v_share, 'under14', coalesce(v_age < 14, false));
end $$;

-- 내가 올린 영상 지우기 (파일은 앱이 내 폴더에서 지운다)
create or replace function public.sparvid_my_delete(_video_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v public.member_videos;
begin
  select * into v from public.member_videos where id = _video_id;
  if not found or v.added_by is distinct from auth.uid() or v.added_via <> 'upload' then
    raise exception '내가 올린 영상만 지울 수 있어요';
  end if;
  update public.member_videos set status = 'deleted', deleted_at = now(), delete_reason = '올린 회원이 지움' where id = _video_id;
  return jsonb_build_object('video_id', _video_id, 'external_id', v.external_id, 'poster_path', v.poster_path);
end $$;

-- ── 신고 · 코치 확인 ───────────────────────────────────────────
create or replace function public.sparvid_report(_video_id uuid, _reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v public.member_videos;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select * into v from public.member_videos where id = _video_id;
  if not found or v.status = 'deleted' then raise exception '영상을 찾지 못했어요'; end if;
  if not (v.branch_name = public._sparvid_viewer_branch() or public._sparvid_in_video(v.id)) then
    raise exception '우리 지점 영상만 신고할 수 있어요';
  end if;
  insert into public.member_video_reports (video_id, reporter_id, reason)
  values (_video_id, auth.uid(), left(coalesce(nullif(trim(coalesce(_reason, '')), ''), '그 밖'), 200))
  on conflict (video_id, reporter_id) do update set reason = excluded.reason, created_at = now();
  if v.status = 'ready' then
    update public.member_videos set status = 'hidden', hidden_at = now(), hidden_reason = 'report' where id = _video_id;
    perform public._sparvid_notify(s.user_id, '🚩 영상 신고가 들어왔어요',
                                   '영상을 가려 두었어요 · 훈련 영상 「신고」 칸에서 확인해 주세요', '/missions?sparvid=1')
       from public._strategy_branch_staff(v.branch_name) s;
    if v.added_by is not null and v.added_by <> auth.uid() then
      perform public._sparvid_notify(v.added_by, '🎥 올린 영상이 잠시 가려졌어요',
                                     '신고가 들어와 코치님이 확인하고 있어요', '/missions?sparvid=' || _video_id::text);
    end if;
  end if;
  return jsonb_build_object('video_id', _video_id, 'hidden', true);
end $$;

-- _action: restore(다시 보이기 · 신고 지움) · remove(내리기)
create or replace function public.sparvid_moderate(_video_id uuid, _action text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v public.member_videos;
begin
  select * into v from public.member_videos where id = _video_id;
  if not found then raise exception '영상을 찾지 못했어요'; end if;
  if not public.sparvid_staff_of(v.branch_name) then raise exception '코치님 · 지점장님만 할 수 있어요'; end if;
  if _action = 'restore' then
    update public.member_videos set status = 'ready', hidden_at = null, hidden_reason = null where id = _video_id;
    delete from public.member_video_reports where video_id = _video_id;
    return jsonb_build_object('video_id', _video_id, 'status', 'ready');
  elsif _action = 'remove' then
    update public.member_videos set status = 'deleted', deleted_at = now(), delete_reason = '신고 확인 뒤 코치가 내림'
     where id = _video_id;
    return jsonb_build_object('video_id', _video_id, 'status', 'deleted');
  end if;
  raise exception '알 수 없는 동작이에요';
end $$;

create or replace function public.sparvid_reported(_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_branch text := coalesce(nullif(trim(_branch), ''), public._sparvid_my_branch());
  v_out jsonb;
begin
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 볼 수 있어요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'video_id', v.id, 'kind', v.kind, 'provider', v.provider, 'external_id', v.external_id,
           'poster_path', v.poster_path, 'caption', v.caption, 'recorded_at', coalesce(v.recorded_at, v.created_at),
           'names', (select string_agg(public._sparvid_name(p.user_id), ' · ') from public.member_video_people p where p.video_id = v.id),
           'reasons', (select jsonb_agg(r.reason order by r.created_at) from public.member_video_reports r where r.video_id = v.id),
           'hidden_at', v.hidden_at
         ) order by v.hidden_at desc nulls last), '[]'::jsonb)
    into v_out
    from public.member_videos v
   where v.branch_name = v_branch and v.status = 'hidden';
  return v_out;
end $$;

-- ── 목록 v2 (올린 영상 칸 · 포스터 · 글) — v1 은 지금 앱이 쓰므로 그대로 ──────────────
create or replace function public.sparvid_my_videos_v2(_limit integer default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_out jsonb;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(t.o order by t.rec desc), '[]'::jsonb) into v_out
    from (
      select coalesce(v.recorded_at, v.created_at) as rec,
             jsonb_build_object(
               'video_id', v.id, 'kind', v.kind, 'provider', v.provider, 'external_id', v.external_id,
               'poster_path', v.poster_path, 'caption', v.caption, 'title', v.title,
               'recorded_at', coalesce(v.recorded_at, v.created_at), 'status', v.status,
               'is_upload', v.added_via = 'upload' and v.added_by = v_me, 'want_feedback', v.want_feedback,
               'match_code', m.match_code,
               'opponent_name', (select string_agg(public._sparvid_name(o.user_id), ', ')
                                   from public.member_video_people o where o.video_id = v.id and o.user_id <> v_me),
               'my_share_ok', me.share_ok,
               'others_share_ok', (select bool_and(o.share_ok) from public.member_video_people o
                                    where o.video_id = v.id and o.user_id <> v_me),
               'comment_count', (select count(*) from public.member_video_comments c
                                  where c.video_id = v.id and c.status = 'published')
             ) as o
        from public.member_video_people me
        join public.member_videos v on v.id = me.video_id and v.status in ('ready', 'hidden')
        left join public.sparring_matches m on m.id = v.match_id
       where me.user_id = v_me
       order by coalesce(v.recorded_at, v.created_at) desc
       limit greatest(1, least(coalesce(_limit, 60), 100))
    ) t;
  return v_out;
end $$;

create or replace function public.sparvid_shared_videos_v2(_limit integer default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_branch text;
  v_out jsonb;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  v_branch := public._sparvid_viewer_branch();
  if v_branch is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(t.o order by t.rec desc), '[]'::jsonb) into v_out
    from (
      select coalesce(v.recorded_at, v.created_at) as rec,
             jsonb_build_object(
               'video_id', v.id, 'kind', v.kind, 'provider', v.provider, 'external_id', v.external_id,
               'poster_path', v.poster_path, 'caption', v.caption, 'title', v.title,
               'recorded_at', coalesce(v.recorded_at, v.created_at), 'is_upload', v.added_via = 'upload',
               'names', coalesce(
                 (select public._sparvid_name(m.user_a) || ' vs ' || public._sparvid_name(m.user_b)
                    from public.sparring_matches m where m.id = v.match_id),
                 (select string_agg(public._sparvid_name(p.user_id), ' · ') from public.member_video_people p
                   where p.video_id = v.id)),
               'is_mine', exists (select 1 from public.member_video_people p where p.video_id = v.id and p.user_id = v_me),
               'my_share_ok', (select p.share_ok from public.member_video_people p where p.video_id = v.id and p.user_id = v_me)
             ) as o
        from public.member_videos v
       where v.branch_name = v_branch
         and v.status = 'ready'
         and exists (select 1 from public.member_video_people p where p.video_id = v.id)
         and not exists (select 1 from public.member_video_people p where p.video_id = v.id and not p.share_ok)
       order by coalesce(v.recorded_at, v.created_at) desc
       limit greatest(1, least(coalesce(_limit, 60), 100))
    ) t;
  return v_out;
end $$;

-- ── 공개 켜기/끄기: 만 14세 미만은 「나만 보기」만 (나머지는 20261125195550 그대로) ──────────
create or replace function public.sparvid_set_share(_video_id uuid, _ok boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_age int;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if coalesce(_ok, false) then
    v_age := public._sparvid_age(auth.uid());
    if v_age is not null and v_age < 14 then raise exception '만 14세 미만은 「나만 보기」로만 둘 수 있어요'; end if;
  end if;
  update public.member_video_people
     set share_ok = coalesce(_ok, false), share_set_at = now()
   where video_id = _video_id and user_id = auth.uid();
  if not found then raise exception '내가 나온 영상이 아니에요'; end if;
  return jsonb_build_object('video_id', _video_id, 'share_ok', coalesce(_ok, false));
end $$;

-- ── 실행 권한 ─────────────────────────────────────────────────
revoke all on function public._sparvid_viewer_branch() from public, anon, authenticated;
revoke all on function public.sparvid_can_view_object(text) from public, anon;
grant execute on function public.sparvid_can_view_object(text) to authenticated;
revoke all on function public.sparvid_upload_register(text, text, text, text, boolean, boolean, boolean, numeric) from public, anon;
revoke all on function public.sparvid_my_delete(uuid) from public, anon;
revoke all on function public.sparvid_report(uuid, text) from public, anon;
revoke all on function public.sparvid_moderate(uuid, text) from public, anon;
revoke all on function public.sparvid_reported(text) from public, anon;
revoke all on function public.sparvid_my_videos_v2(integer) from public, anon;
revoke all on function public.sparvid_shared_videos_v2(integer) from public, anon;
revoke all on function public.sparvid_set_share(uuid, boolean) from public, anon;
grant execute on function public.sparvid_upload_register(text, text, text, text, boolean, boolean, boolean, numeric) to authenticated;
grant execute on function public.sparvid_my_delete(uuid) to authenticated;
grant execute on function public.sparvid_report(uuid, text) to authenticated;
grant execute on function public.sparvid_moderate(uuid, text) to authenticated;
grant execute on function public.sparvid_reported(text) to authenticated;
grant execute on function public.sparvid_my_videos_v2(integer) to authenticated;
grant execute on function public.sparvid_shared_videos_v2(integer) to authenticated;
grant execute on function public.sparvid_set_share(uuid, boolean) to authenticated;
