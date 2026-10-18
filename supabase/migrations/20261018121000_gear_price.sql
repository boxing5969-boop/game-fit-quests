-- 중고 장비 나눔 — 금액 적기 (2026-10-18 대표님: "금액을 적어야할것같아 그래야 구매할지 말지 결정할수있으니까")
--   · boxing_gear_posts.price (원) — 양도 글만 적는다(적지 않아도 된다). 나눔 글은 늘 비워 둔다.
--   · create_gear_post_v2 — create_gear_post 와 같은 검사·한도(진행 중 3개) + 금액. 예전 앱은 create_gear_post 를 그대로 부른다.
--   · get_gear_posts — 글마다 'price' 를 같이 내려준다 (나머지 본문은 그대로).
--   · 주고받는 것은 여전히 데스크를 통한다 (화면 안내: src/components/engagement/GearShareSheet.tsx)

alter table public.boxing_gear_posts add column if not exists price integer;
do $$ begin
  alter table public.boxing_gear_posts
    add constraint boxing_gear_posts_price_chk check (price is null or (price >= 0 and price <= 10000000));
exception when duplicate_object then null; end $$;

create or replace function public.create_gear_post_v2(
  p_kind text,
  p_gear_size text default null,
  p_condition text default 'good',
  p_deal text default 'free',
  p_note text default null,
  p_price integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_open int;
  v_id uuid;
  v_price integer;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  if v_branch is null or length(trim(v_branch)) = 0 then
    raise exception '지점 정보가 없어 글을 올릴 수 없습니다 — 데스크에 문의해 주세요';
  end if;
  if p_kind not in ('glove','handwrap','shoes','rope','headgear','other') then
    raise exception '장비 종류가 올바르지 않습니다';
  end if;
  if coalesce(p_condition,'good') not in ('new','good','used') then
    raise exception '상태가 올바르지 않습니다';
  end if;
  if coalesce(p_deal,'free') not in ('free','transfer') then
    raise exception '나눔 또는 양도만 선택할 수 있습니다';
  end if;

  -- 금액 — 양도 글만 (나눔은 늘 비움). 0원 ~ 1,000만 원
  v_price := case when coalesce(p_deal,'free') = 'transfer' then p_price else null end;
  if v_price is not null and (v_price < 0 or v_price > 10000000) then
    raise exception '금액은 0원부터 1,000만 원까지 적을 수 있어요';
  end if;

  -- 한 사람이 올릴 수 있는 진행중 글은 3개까지
  select count(*) into v_open from public.boxing_gear_posts
   where user_id = v_uid and status = 'open';
  if v_open >= 3 then
    raise exception '진행중인 글이 3개입니다. 정리된 글을 먼저 완료로 바꿔주세요';
  end if;

  insert into public.boxing_gear_posts
    (user_id, branch_name, kind, gear_size, gear_condition, deal, note, price)
  values
    (v_uid, v_branch, p_kind,
     nullif(btrim(coalesce(p_gear_size,'')), ''),
     coalesce(p_condition,'good'), coalesce(p_deal,'free'),
     nullif(btrim(coalesce(p_note,'')), ''),
     v_price)
  returning id into v_id;

  return jsonb_build_object('success', true, 'post_id', v_id);
end; $function$;

revoke all on function public.create_gear_post_v2(text, text, text, text, text, integer) from public, anon;
grant execute on function public.create_gear_post_v2(text, text, text, text, text, integer) to authenticated;

create or replace function public.get_gear_posts(p_limit integer default 30)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_all boolean;
  v_limit int := greatest(1, least(coalesce(p_limit,30), 100));
  v_posts jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  v_branch := public.boxing_community_my_branch();
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  if v_branch is null and not v_all then
    return jsonb_build_object('success', true, 'posts', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(t order by t->>'createdAt' desc), '[]'::jsonb)
    into v_posts
    from (
      select jsonb_build_object(
               'id', g.id,
               'nickname', p.nickname,
               'branch', g.branch_name,
               'isMine', g.user_id = v_uid,
               'kind', g.kind,
               'size', g.gear_size,
               'condition', g.gear_condition,
               'deal', g.deal,
               'note', g.note,
               'price', g.price,
               'createdAt', g.created_at
             ) as t
        from public.boxing_gear_posts g
        join public.profiles p on p.user_id = g.user_id
       where ((v_all and public.is_branch_visible(g.branch_name)) or g.branch_name = v_branch) and g.status = 'open'
       order by g.created_at desc
       limit v_limit
    ) s;

  return jsonb_build_object('success', true, 'branch', v_branch, 'all_branches', v_all, 'posts', v_posts);
end;
$function$;
