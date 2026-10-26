-- 칠금점 다짐의 락카 · 운동복 기간 + 락카 번호 → 앱 (매일 밤) — 2026-10-27 대표님 보고서 「앱 결제 장바구니」 진행 순서 5번
--   "라이브 — 칠금점은 다짐의 락카 · 운동복 기간도 매일 밤 같이 옮깁니다"
--
--  · 153OS app_rental_ends()(다짐 회원 이용권의 rentalLocker · rentalSportsWear 끝나는 날 + 회원 '락커정보' 번호)를
--    Edge Function sync-rental-ends 가 서버 키로 읽어 이 함수에 넘긴다(매일 23:40 KST — 다짐 동기화 22:49 뒤).
--  · 칠금점은 앱 결제를 쓰지 않으니(데스크 결제) 다짐 값이 정본 — 값이 있으면 그대로 맞춘다. 다짐에 값이 없으면 건드리지 않는다.
--  · 락카 번호도 다짐 '락커정보'(예: "153복싱짐 칠금점 락카-27" → "27")로 맞춘다. 지도진이 앱에서 넣은 번호보다 다짐이 우선.
--  · 다른 지점 회원 · 예전 계정(merged_into) · 체험용 계정은 건드리지 않는다.
create or replace function public.apply_rental_ends(p_branch text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locker integer := 0;
  v_sw integer := 0;
  v_no integer := 0;
begin
  if coalesce(btrim(p_branch), '') = '' then
    raise exception 'branch required';
  end if;

  with r as (
    select distinct on ((x->>'app_user_id')::uuid)
           (x->>'app_user_id')::uuid as uid, nullif(x->>'locker_end', '')::date as le
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
     where coalesce(x->>'app_user_id', '') ~ '^[0-9a-fA-F-]{36}$'
  )
  update public.profiles p set locker_end = r.le
    from r
   where p.user_id = r.uid and r.le is not null and p.locker_end is distinct from r.le
     and p.branch_name = p_branch and p.merged_into is null and coalesce(p.is_test_account, false) = false;
  get diagnostics v_locker = row_count;

  with r as (
    select distinct on ((x->>'app_user_id')::uuid)
           (x->>'app_user_id')::uuid as uid, nullif(x->>'sportswear_end', '')::date as se
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
     where coalesce(x->>'app_user_id', '') ~ '^[0-9a-fA-F-]{36}$'
  )
  update public.profiles p set sportswear_end = r.se
    from r
   where p.user_id = r.uid and r.se is not null and p.sportswear_end is distinct from r.se
     and p.branch_name = p_branch and p.merged_into is null and coalesce(p.is_test_account, false) = false;
  get diagnostics v_sw = row_count;

  with r as (
    select distinct on ((x->>'app_user_id')::uuid)
           (x->>'app_user_id')::uuid as uid, left(nullif(btrim(coalesce(x->>'locker_no', '')), ''), 40) as ln
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
     where coalesce(x->>'app_user_id', '') ~ '^[0-9a-fA-F-]{36}$'
  )
  update public.profiles p set locker_label = r.ln, locker_updated_at = now(), locker_updated_by = null
    from r
   where p.user_id = r.uid and r.ln is not null and p.locker_label is distinct from r.ln
     and p.branch_name = p_branch and p.merged_into is null and coalesce(p.is_test_account, false) = false;
  get diagnostics v_no = row_count;

  return jsonb_build_object('ok', true, 'rows', jsonb_array_length(coalesce(p_rows, '[]'::jsonb)),
                            'locker_end', v_locker, 'sportswear_end', v_sw, 'locker_no', v_no);
end;
$$;
revoke all on function public.apply_rental_ends(text, jsonb) from public, anon, authenticated;

-- 매일 23:40 KST (14:40 UTC) — 칠금 다짐 동기화(월~토 22:49) 뒤. 같은 이름이면 덮어쓴다.
select cron.schedule(
  'sync-rental-ends',
  '40 14 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/sync-rental-ends',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 60000
  );
  $cron$
);
