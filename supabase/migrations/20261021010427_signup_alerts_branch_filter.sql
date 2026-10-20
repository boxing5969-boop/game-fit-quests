-- 회원가입 알림 — 선릉역점만 켜고 나머지 지점(역삼점 · 잠실점 · 칠금점 …)은 끈다
--   (2026-10-21 대표님: "일단 역삼점 회원가입 알림, 선릉역점 빼고는 모두 꺼 줘")
--
--   대상 알림 2가지 (가입할 때 profiles AFTER INSERT → profile_signup_alert_trg):
--     · 🎉 새 회원 · 자동 등록  — 브로제이 등록 회원 계정이 자동으로 만들어졌을 때 (notify_auto_member_joined)
--     · 🔔 승인 요청 · 가입     — 직접 가입해서 승인을 기다릴 때 (notify_approval_request '가입')
--   받는 사람(대표 · 그 지점 관장/코치) 모두에게 같이 적용된다. 승인 대기 숫자 · 받은 함은 그대로 보인다.
--   회원 본인에게 가는 알림(가입이 승인되었습니다 · 153 레코드)은 건드리지 않는다.
--
--   설정은 app_settings 'signup_alerts' 한 줄:
--     {"branches": ["153복싱짐 선릉역점"]}  → 이 목록에 있는 지점만 알림
--     지점을 다시 켜려면 branches 에 지점 이름을 넣고, 이 줄을 지우면 예전처럼 전 지점 알림.

insert into public.app_settings (key, value, updated_at)
values (
  'signup_alerts',
  jsonb_build_object(
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'note', '회원가입 알림(새 회원 · 자동 등록 / 승인 요청 · 가입)을 받을 지점. 2026-10-21 대표님: 선릉역점만. 다시 켜려면 지점 이름 추가 · 줄을 지우면 전 지점'
  ),
  now()
)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 이 지점의 회원가입 알림이 켜져 있나 — 설정이 없거나 목록 모양이 아니면 예전처럼 켜짐
create or replace function public.signup_alert_on(_branch text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when s.v is null or jsonb_typeof(s.v -> 'branches') is distinct from 'array' then true
    else exists (
      select 1 from jsonb_array_elements_text(s.v -> 'branches') b(name)
       where btrim(b.name) = btrim(coalesce(_branch, ''))
    )
  end
  from (select (select a.value from public.app_settings a where a.key = 'signup_alerts') as v) s
$function$;

revoke all on function public.signup_alert_on(text) from public, anon, authenticated;

create or replace function public.profile_signup_alert_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_auto boolean;
begin
  if new.is_approved is distinct from false then return new; end if;
  -- 회원가입 알림을 끈 지점이면 아무것도 보내지 않는다 (app_settings 'signup_alerts')
  if not public.signup_alert_on(new.branch_name) then return new; end if;
  -- 브로제이 등록 회원: 동기화가 계정을 만들고 곧바로 승인한다 → 승인 요청 대신 안내만
  select u.email ~ '^01[0-9]{8,9}@153rankup\.app$' into v_auto from auth.users u where u.id = new.user_id;
  if coalesce(v_auto, false) then
    perform public.notify_auto_member_joined(new.user_id);
    return new;
  end if;
  perform public.notify_approval_request(new.user_id, '가입', '새로 가입했어요. 가입 승인을 기다려요');
  return new;
exception when others then return new;
end $function$;
