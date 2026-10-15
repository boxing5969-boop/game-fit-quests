-- 대회 메달 (2026-10-15 대표님: "생활체육대회 수상한 회원은 이름 옆에 금·은·동 메달을")
--   선릉역점 오픈 첫 생활체육대회 — 우승(금): 강건형 · 심민지 · 서희량 · 이설아 · 박종운 · 신동윤 / 준우승(은): 이혁민
--   앱 계정이 아직 없는 수상자(이설아)는 이름만 적어 두고, 같은 지점에 같은 이름으로 가입하면 자동으로 이어 붙인다.
--   이름 옆 메달은 TV(로그인 없음)에서도 보여야 하므로 get_member_medals 는 anon 도 부를 수 있다 (이름·메달·대회명만).

create table if not exists public.member_medals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  person_name text not null,
  branch_name text,
  medal text not null check (medal in ('gold', 'silver', 'bronze')),
  event_title text not null,
  event_date date,
  created_at timestamptz not null default now()
);
create unique index if not exists member_medals_uniq on public.member_medals (person_name, branch_name, event_title, medal);
create index if not exists member_medals_user_idx on public.member_medals (user_id);

alter table public.member_medals enable row level security;
do $$ begin
  create policy "member medals readable" on public.member_medals for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admins manage member medals" on public.member_medals for all to authenticated
    using (public.has_role((select auth.uid()), 'super_admin'::app_role) or public.has_role((select auth.uid()), 'admin'::app_role))
    with check (public.has_role((select auth.uid()), 'super_admin'::app_role) or public.has_role((select auth.uid()), 'admin'::app_role));
exception when duplicate_object then null; end $$;

/** 이름 옆 메달 — user_id 가 이어진 것만. 한 사람이 여러 개면 가장 좋은 메달이 먼저 */
create or replace function public.get_member_medals()
returns table(user_id uuid, medal text, event_title text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.medal, m.event_title
    from public.member_medals m
   where m.user_id is not null
   order by m.user_id, case m.medal when 'gold' then 0 when 'silver' then 1 else 2 end, m.event_date desc nulls last;
$$;
revoke all on function public.get_member_medals() from public;
grant execute on function public.get_member_medals() to anon, authenticated;

/** 가입하면 같은 지점·같은 이름의 수상 기록을 이어 붙인다 */
create or replace function public.link_member_medals_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is not null and btrim(new.name) <> '' then
    update public.member_medals
       set user_id = new.user_id
     where user_id is null
       and person_name = btrim(new.name)
       and (branch_name is null or branch_name = new.branch_name);
  end if;
  return new;
exception when others then return new;
end $$;

do $$ begin
  create trigger link_member_medals after insert or update of name, branch_name on public.profiles
    for each row execute function public.link_member_medals_trg();
exception when duplicate_object then null; end $$;

-- 선릉역점 오픈 첫 생활체육대회
insert into public.member_medals (user_id, person_name, branch_name, medal, event_title)
select p.user_id, v.person_name, '153복싱짐 선릉역점', v.medal, '선릉역점 오픈 첫 생활체육대회'
  from (values ('강건형', 'gold'), ('심민지', 'gold'), ('서희량', 'gold'), ('이설아', 'gold'),
               ('박종운', 'gold'), ('신동윤', 'gold'), ('이혁민', 'silver')) as v(person_name, medal)
  left join lateral (
    select pr.user_id from public.profiles pr
     where pr.name = v.person_name and pr.branch_name = '153복싱짐 선릉역점'
     order by pr.created_at asc limit 1
  ) p on true
on conflict (person_name, branch_name, event_title, medal) do nothing;
