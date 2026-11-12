-- 전체 메뉴 편집 · 내 바로가기 — 사람마다 메뉴 배치 저장
--   (2026-11-08 대표님 「바로가기 기능 만들어줘 … 현재 있는 바로가기 메뉴들도 옮기고 빼고 수정할수있게해줘
--    회원님들도 나도 가능하게 아이폰이나 안드로이드 처럼」)
--
--   user_menu_layouts            계정마다 한 줄 — layout = 앱이 만든 배치(v · updatedAt · entries · known), 서버는 내용을 풀어 보지 않는다
--   get_my_menu_layout()         내 배치 (없으면 null)
--   save_my_menu_layout(jsonb)   내 줄만 넣거나 바꾼다 — 객체만 · 32KB 까지
--
--   표는 RLS 를 켜고 정책을 두지 않는다 — 직접 읽기 · 쓰기 없이 위 두 함수로만(본인 것만).
--   앱은 이 함수가 없어도(PGRST202) 이 기기에만 저장하며 그대로 돈다 → 화면과 DB 적용 순서는 상관없다.
--   새 표 1 · 새 함수 2 — 기존 함수 · 표는 그대로.

create table if not exists public.user_menu_layouts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  layout     jsonb not null check (jsonb_typeof(layout) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.user_menu_layouts enable row level security;
revoke all on table public.user_menu_layouts from anon, authenticated;

create or replace function public.get_my_menu_layout()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select l.layout
    from public.user_menu_layouts l
   where l.user_id = auth.uid();
$function$;

create or replace function public.save_my_menu_layout(_layout jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if _layout is null or jsonb_typeof(_layout) <> 'object' then
    raise exception '메뉴 배치 모양이 올바르지 않아요' using errcode = '22023';
  end if;
  if octet_length(_layout::text) > 32768 then
    raise exception '메뉴 배치가 너무 커요' using errcode = '22023';
  end if;

  insert into public.user_menu_layouts (user_id, layout, updated_at)
  values (v_uid, _layout, now())
  on conflict (user_id) do update
     set layout = excluded.layout,
         updated_at = now();

  return jsonb_build_object('ok', true);
end $function$;

revoke all on function public.get_my_menu_layout() from public, anon;
revoke all on function public.save_my_menu_layout(jsonb) from public, anon;
grant execute on function public.get_my_menu_layout() to authenticated, service_role;
grant execute on function public.save_my_menu_layout(jsonb) to authenticated, service_role;
