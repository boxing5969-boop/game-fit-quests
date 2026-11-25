-- 🎥 스파링 영상 — 레벨 상관없이 「내 영상 · 우리 지점 영상」 (2026-11-25 대표님 「레벨이랑 상관없이 회원님들이 본인의 영상과 다른 회원님들의 영상을 볼수있도록하자」)
-- 문서: docs/features/64-스파링-영상.md
--
-- 새 함수 하나만 더한다(표 · 정책 · 기존 함수는 그대로):
--   sparvid_shared_videos  같은 지점 회원 누구나(레벨 · 리그 상관없이 · 승인된 회원 · 보호자 계정 제외) —
--                          영상에 나온 사람이 **모두** 공개에 동의한(member_video_people.share_ok) 영상만.
--                          이름은 닉네임 먼저. 코치 피드백은 영상에 나온 회원 · 코치진에게만(sparvid_video_comments 그대로).

create or replace function public.sparvid_shared_videos(_limit integer default 40)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_branch text;
  v_kind text;
  v_ok boolean;
  v_out jsonb;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  select p.branch_name, p.account_kind, coalesce(p.is_approved, false) into v_branch, v_kind, v_ok
    from public.profiles p where p.user_id = v_me
   order by (p.merged_into is null) desc limit 1;
  if coalesce(v_branch, '') = '' or coalesce(v_kind, '') = 'guardian'
     or not (coalesce(v_ok, false) or public.sparvid_staff_of(v_branch)) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(t.o order by t.rec desc), '[]'::jsonb) into v_out
    from (
      select coalesce(v.recorded_at, v.created_at) as rec,
             jsonb_build_object(
               'video_id', v.id, 'kind', v.kind, 'provider', v.provider, 'external_id', v.external_id,
               'title', v.title, 'recorded_at', coalesce(v.recorded_at, v.created_at),
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
       limit greatest(1, least(coalesce(_limit, 40), 100))
    ) t;
  return v_out;
end $$;

revoke all on function public.sparvid_shared_videos(integer) from public, anon;
grant execute on function public.sparvid_shared_videos(integer) to authenticated;

-- 알림 글: 훈련 탭 줄 이름이 「스파링 영상」(내 영상 · 우리 지점)으로 바뀌어 맞춤 — 나머지는 20261125195550 그대로
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
                                   '훈련 탭 「스파링 영상」에서 다시 보세요 · 코치님 피드백도 여기로 와요',
                                   '/missions?sparvid=' || v_vid::text)
       from (values (m.user_a), (m.user_b)) as u(uid);
  end if;
  return jsonb_build_object('video_id', v_vid, 'external_id', v_yt, 'new', v_new);
end $$;

revoke all on function public.sparvid_attach_video(uuid, text) from public, anon;
grant execute on function public.sparvid_attach_video(uuid, text) to authenticated;
