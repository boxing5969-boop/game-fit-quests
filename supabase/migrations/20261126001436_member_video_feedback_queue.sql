-- 🎥 훈련 영상 — 코치 「피드백 요청」 목록 (2026-11-26 · docs/features/64-스파링-영상.md)
--   회원이 올리면서 「코치님 피드백 받기」를 켠 영상을 그 지점 코치진이 찾는 곳.
--   「나만 보기」로 올린 영상은 우리 지점 목록에 안 나오고 코치에게도 알림 하나뿐이라, 알림을 놓치면 찾을 길이 없었다.
--   · 그 지점 코치 · 지점장(sparvid_staff_of)만 · 가려진(신고) 영상은 sparvid_reported 쪽에서 본다
--   · 피드백이 아직 없는 영상이 먼저, 그다음 최근 순
--   새 함수만 (미리보기 단계 규칙 — 기존 함수는 그대로).

create or replace function public.sparvid_feedback_requests(_branch text default null, _limit integer default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_branch text := coalesce(nullif(trim(_branch), ''), public._sparvid_my_branch());
  v_out jsonb;
begin
  if not public.sparvid_staff_of(v_branch) then raise exception '코치님 · 지점장님만 볼 수 있어요'; end if;
  select coalesce(jsonb_agg(t.o order by t.answered, t.rec desc), '[]'::jsonb) into v_out
    from (
      select coalesce(v.recorded_at, v.created_at) as rec,
             exists (select 1 from public.member_video_comments c
                      where c.video_id = v.id and c.status = 'published') as answered,
             jsonb_build_object(
               'video_id', v.id, 'kind', v.kind, 'provider', v.provider, 'external_id', v.external_id,
               'poster_path', v.poster_path, 'caption', v.caption,
               'recorded_at', coalesce(v.recorded_at, v.created_at),
               'names', (select string_agg(public._sparvid_name(p.user_id), ' · ')
                           from public.member_video_people p where p.video_id = v.id),
               'share_ok', exists (select 1 from public.member_video_people p where p.video_id = v.id)
                           and not exists (select 1 from public.member_video_people p
                                            where p.video_id = v.id and not p.share_ok),
               'comment_count', (select count(*) from public.member_video_comments c
                                  where c.video_id = v.id and c.status = 'published')
             ) as o
        from public.member_videos v
       where v.branch_name = v_branch and v.status = 'ready' and v.want_feedback
       order by coalesce(v.recorded_at, v.created_at) desc
       limit greatest(1, least(coalesce(_limit, 60), 100))
    ) t;
  return v_out;
end $$;

revoke all on function public.sparvid_feedback_requests(text, integer) from public, anon;
grant execute on function public.sparvid_feedback_requests(text, integer) to authenticated;
