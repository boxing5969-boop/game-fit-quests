-- 라이센스 카드에 보일 것(자동·사진·캐릭터)을 서버에 저장 (2026-10-15 대표님: "프로필 캐릭터 혹은 사진 설정하신 분들은 라이브보드에 반영되게")
--   예전엔 그 폰의 localStorage 에만 있어서 TV 가 몰랐다. 이제 회원이 고르면 여기 저장되고 TV(로그인 없음)가 읽는다.
--   auto = 사진 → 캐릭터 → 이니셜 (기본) · photo = 사진만 · character = 캐릭터만
create table if not exists public.member_card_display (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'auto' check (mode in ('auto', 'photo', 'character')),
  updated_at timestamptz not null default now()
);
alter table public.member_card_display enable row level security;
do $$ begin
  create policy "card display readable" on public.member_card_display for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "card display own insert" on public.member_card_display for insert to authenticated
    with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "card display own update" on public.member_card_display for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
grant select on public.member_card_display to anon, authenticated;
grant insert, update on public.member_card_display to authenticated;
