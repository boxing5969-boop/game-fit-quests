-- 🥊 153 수업 템플릿 — 순서마다 참고 영상 (2026-11-12 대표님 「수업 탬플릿에 … 각 순서마다 참고할수있는 영상을 첨부해서 알기 쉽게 만들어줘」)
--
--   · 템플릿 내용은 앱 코드 한 곳(src/lib/classTemplates.ts) — 여기에는 영상 자리만: (템플릿 id, 순서) → 비공개 저장소 strategy-videos 의 파일
--   · 순서(step): 0 = 전체 흐름(그 템플릿으로 한 실제 수업 요약) · 1~ = 블록 순서(1부터). 코드에서 블록 순서를 바꾸면 영상 자리도 같이 옮긴다
--   · 보기: 코치진 모두(_strategy_staff — 모든 지점. 템플릿이 모든 지점 공통이라 영상도 공통) → 화면이 서명 주소(1시간)로 재생
--     (저장소 정책 'strategy videos staff read' 가 코치진에게 이 버킷 읽기를 이미 열어 둠 — 정책은 그대로)
--   · 넣기 · 바꾸기 · 빼기: 대표님(_strategy_hq)만. 파일은 넣는 분 폴더(<내 id>/…)에만 — 'strategy videos staff upload' 정책 그대로
--   · 빼기는 지우지 않고 removed_at 만 남긴다(파일도 그대로 — 되돌리기 쉽게)
--   · 새 표 1 · 새 함수 3 — 기존 표 · 함수 · 정책은 그대로

create table if not exists public.class_template_videos (
  template_id text not null check (template_id ~ '^[a-z0-9-]{1,40}$'),
  step smallint not null check (step between 0 and 20),
  storage_path text not null check (char_length(storage_path) between 3 and 300),
  title text check (title is null or char_length(title) <= 80),
  seconds integer check (seconds is null or seconds between 1 and 3600),
  uploader_id uuid not null,
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (template_id, step)
);
alter table public.class_template_videos enable row level security;
revoke all on public.class_template_videos from public, anon, authenticated;

-- 코치진 — 지금 붙어 있는 영상 목록 (뺀 것 제외)
create or replace function public.class_template_videos_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._strategy_staff(v_uid) then
    raise exception '코치진만 볼 수 있어요';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
            'template_id', v.template_id, 'step', v.step, 'storage_path', v.storage_path,
            'title', v.title, 'seconds', v.seconds, 'updated_at', v.updated_at) order by v.template_id, v.step)
           from public.class_template_videos v where v.removed_at is null), '[]'::jsonb);
end $$;

-- 대표님 — 영상 넣기 · 바꾸기 (같은 자리는 새 파일로 바뀐다)
create or replace function public.class_template_video_set(
  p_template text, p_step integer, p_storage_path text, p_title text default null, p_seconds integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_path text := btrim(coalesce(p_storage_path, ''));
begin
  if not public._strategy_hq(v_uid) then
    raise exception '템플릿 영상은 대표님만 넣을 수 있어요';
  end if;
  if p_template is null or p_template !~ '^[a-z0-9-]{1,40}$' then
    raise exception '템플릿 이름이 잘못됐어요';
  end if;
  if p_step is null or p_step < 0 or p_step > 20 then
    raise exception '순서가 잘못됐어요';
  end if;
  if char_length(v_path) < 3 or char_length(v_path) > 300 or split_part(v_path, '/', 1) <> v_uid::text or position('..' in v_path) > 0 then
    raise exception '영상 파일 경로가 잘못됐어요';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'strategy-videos' and o.name = v_path) then
    raise exception '올린 영상 파일을 찾지 못했어요 — 다시 올려 주세요';
  end if;
  insert into public.class_template_videos (template_id, step, storage_path, title, seconds, uploader_id, updated_at, removed_at)
  values (p_template, p_step, v_path, nullif(left(btrim(coalesce(p_title, '')), 80), ''),
          case when p_seconds between 1 and 3600 then p_seconds end, v_uid, now(), null)
  on conflict (template_id, step) do update
     set storage_path = excluded.storage_path, title = excluded.title, seconds = excluded.seconds,
         uploader_id = excluded.uploader_id, updated_at = now(), removed_at = null;
  return jsonb_build_object('ok', true, 'template_id', p_template, 'step', p_step);
end $$;

-- 대표님 — 영상 빼기 (줄 · 파일은 남김)
create or replace function public.class_template_video_clear(p_template text, p_step integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if not public._strategy_hq(v_uid) then
    raise exception '템플릿 영상은 대표님만 뺄 수 있어요';
  end if;
  update public.class_template_videos set removed_at = now(), uploader_id = v_uid
   where template_id = p_template and step = p_step and removed_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'removed', v_n);
end $$;

revoke all on function public.class_template_videos_list() from public, anon;
revoke all on function public.class_template_video_set(text, integer, text, text, integer) from public, anon;
revoke all on function public.class_template_video_clear(text, integer) from public, anon;
grant execute on function public.class_template_videos_list() to authenticated;
grant execute on function public.class_template_video_set(text, integer, text, text, integer) to authenticated;
grant execute on function public.class_template_video_clear(text, integer) to authenticated;
