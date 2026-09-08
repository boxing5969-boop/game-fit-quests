-- 커스터마이징 가격표를 서버로 옮긴다. 지금까지는 클라이언트가 보낸 p_price 를 그대로 믿었다.
-- (2026-09-08 풀파워 검수 — 앱이 아닌 도구로 p_price=0 을 보내면 어떤 아이템이든 공짜였다)
create table if not exists public.customization_prices (
  category   text    not null,
  item_key   text    not null,
  price      integer not null check (price >= 0),
  updated_at timestamptz not null default now(),
  primary key (category, item_key)
);

alter table public.customization_prices enable row level security;

drop policy if exists customization_prices_read on public.customization_prices;
create policy customization_prices_read on public.customization_prices
  for select to authenticated using (true);

drop policy if exists customization_prices_admin_write on public.customization_prices;
create policy customization_prices_admin_write on public.customization_prices
  for all to authenticated
  using (has_role(auth.uid(),'super_admin') or has_role(auth.uid(),'admin'))
  with check (has_role(auth.uid(),'super_admin') or has_role(auth.uid(),'admin'));

revoke insert, update, delete, truncate, references on public.customization_prices from anon;

-- 시드: src/data/characterCustomizationData.ts 의 price 를 그대로 옮긴 것 (123종)
-- ※ 프론트 가격을 바꾸면 이 표도 같이 바꿔야 한다.
insert into public.customization_prices (category, item_key, price) values
('effect','sparkle',0),('effect','stars',0),('effect','flame',300),('effect','hearts',300),('effect','wind',200),('effect','clover',400),('effect','daisy',300),('effect','sunflower',400),('effect','lightning',800),('effect','snow',800),('effect','cherry',1000),('effect','tulip',1000),('effect','hibiscus',1200),('effect','music',1000),('effect','firework',1200),('effect','tornado',3000),('effect','comet',3000),('effect','rainbow',3500),('effect','rose',3000),('effect','bouquet',4000),('effect','explosion',3500),('effect','ghost',4000),('effect','star_shoot',4000),('effect','crown_effect',5000),('effect','dragon',8000),('effect','phoenix',10000),('effect','skull',12000),('effect','diamond_rain',15000),('effect','inferno_dual',18000),('effect','thunder_god',20000),('effect','cosmic_dust',22000),('effect','sword_aura',25000),('effect','dark_flame',30000),('effect','lotus',10000),('effect','sakura_storm',15000),('effect','rose_gold',20000),('frame','none',0),('frame','basic_white',0),('frame','fire',300),('frame','ice',300),('frame','moon',500),('frame','lightning',800),('frame','cherry',800),('frame','electric',1000),('frame','ocean',1000),('frame','emerald',1200),('frame','sakura',1500),('frame','diamond',1800),('frame','gold',2500),('frame','rainbow',2500),('frame','blood',3000),('frame','dark_red',3000),('frame','purple',3000),('frame','neon',3500),('frame','crystal',3500),('frame','storm',4000),('frame','neon_green',4500),('frame','shadow',5000),('frame','galaxy',6000),('frame','rainbow_frame',7000),('frame','holy',7000),('frame','inferno',8000),('frame','void',10000),('frame','eternal',15000),('title','rookie',0),('title','rookie_challenger',0),('title','beginner',0),('title','trainee',300),('title','goal_getter',400),('title','attendance_king',500),('title','fighter',800),('title','warrior',1000),('title','speedster',1200),('title','iron_fist',1500),('title','fire_fighter',1800),('title','night_hunter',2000),('title','champion',2500),('title','destroyer',3000),('title','thunder',3500),('title','thunder_king',3500),('title','phoenix_title',4000),('title','beast',4500),('title','diamond_fighter',4500),('title','153_star',5000),('title','legend',5000),('title','dragon',8000),('title','shadow_king',10000),('title','god_of_war',12000),('title','immortal',15000),('title','eternal_153',120000),('title','king_of_ring',150000),('title','god_fist',180000),('aura','none',0),('aura','soft_glow',300),('aura','aura_mint',400),('aura','aura_fire',800),('aura','aura_ice',800),('aura','aura_sakura',1000),('aura','aura_ocean',1200),('aura','aura_lightning',1500),('aura','aura_emerald',1500),('aura','aura_blood',3000),('aura','aura_sunset',3500),('aura','aura_rainbow',4000),('aura','aura_neon',5000),('aura','aura_galaxy',8000),('aura','aura_dark',10000),('aura','aura_infernal',12000),('aura','aura_phantom',12000),('aura','halo_black_gold',15000),('aura','aura_void',18000),('aura','halo_rainbow_master',240000),('aura','divine',280000),('aura','aura_celestial',320000),('halo','none',0),('halo','halo_rainbow',0),('halo','halo_saiyan',30000),('halo','halo_frost',32000),('halo','halo_eclipse',35000),('halo','halo_phoenix',40000),('halo','halo_cosmic',45000),('halo','halo_emperor',50000),('halo','halo_champion',55000)
on conflict (category, item_key) do update set price = excluded.price, updated_at = now();

create or replace function public.get_customization_price(_category text, _item_key text)
returns integer language sql stable security definer set search_path to 'public' as $fn$
  select price from public.customization_prices
   where category = _category and item_key = _item_key;
$fn$;

revoke execute on function public.get_customization_price(text, text) from public;
grant execute on function public.get_customization_price(text, text) to authenticated;
