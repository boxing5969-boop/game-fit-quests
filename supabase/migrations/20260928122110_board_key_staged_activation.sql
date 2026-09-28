-- TV 보드 키 단계 적용 (2026-09-28)
-- 지금까지 보드 키가 등록된 지점이 없어, 로그인하지 않은 누구나 어느 지점의 현재 QR 코드든 받아 가
-- 체육관 밖에서 출석할 수 있었다. 지점별 키를 'board_key_pending:<지점명>' 으로 먼저 등록해 두고,
-- 그 지점 TV 가 /tv/<코드>?k=<키> 로 처음 요청하는 순간 'board_key:<지점명>' 으로 바뀌어 잠긴다.
-- → TV 주소를 바꾸기 전까지는 기존처럼 QR 이 나오고(끊김 없음), 바꾼 뒤로는 키를 가진 TV 에만 나온다.
-- 키 값은 비밀이라 이 파일에 두지 않는다(운영 DB 에만 등록).
create or replace function public.get_board_qr_token(p_branch text, p_key text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _name text;
  _code text;
  _required text;
  _pending text;
  _epoch bigint;
  _bucket bigint;
begin
  select b.name, b.code into _name, _code
    from public.branches b
   where b.name = p_branch or (b.code is not null and b.code = p_branch)
   limit 1;
  if _name is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_branch');
  end if;

  select value into _required from public.internal_sync_config where key = 'board_key:' || _name;

  -- 대기 키로 처음 요청하면 그 순간 잠금으로 바꾼다.
  if coalesce(_required, '') = '' and coalesce(p_key, '') <> '' then
    select value into _pending from public.internal_sync_config where key = 'board_key_pending:' || _name;
    if coalesce(_pending, '') <> '' and p_key = _pending then
      insert into public.internal_sync_config (key, value, updated_at)
      values ('board_key:' || _name, _pending, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
      delete from public.internal_sync_config where key = 'board_key_pending:' || _name;
      _required := _pending;
    end if;
  end if;

  -- 지점 키가 잠겨 있으면 검사. 대기 키만 있으면 아직 열림.
  if _required is not null and _required <> '' and (p_key is null or p_key <> _required) then
    return jsonb_build_object('ok', false, 'error', 'board_key_required', 'branch', _name);
  end if;

  _epoch  := floor(extract(epoch from now()))::bigint;
  _bucket := _epoch / 300;

  return jsonb_build_object(
    'ok', true,
    'branch', _name,
    'code', _code,
    'token', public._board_qr_token_for(_name, _bucket),
    'expires_in_sec', 300 - (_epoch % 300),
    'rotate_sec', 300,
    'locked', _required is not null and _required <> ''
  );
end;
$function$;