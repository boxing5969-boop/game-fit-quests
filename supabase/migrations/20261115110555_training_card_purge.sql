-- 🧹 영상으로 배우기 — 1년 지난 기록 지우기 (4단계 · 결정 8번 「이용 기록 보관 1년」 · 개인정보 처리방침 보유 기간 1년)
--   2026-11-15 대표님 「다음 4단계진행」 — 1단계 때 「1년 지난 줄을 지우는 예약은 4단계에서」(2027-11-14 전)로 미뤄 둔 것.
--
--   매일 03:41 KST 에 1년(365일)이 지난 줄을 지운다:
--     · 이용 기록 training_card_events — 그날(day)이 1년 전보다 앞선 줄
--     · 담기 기록 training_card_saves — 마지막으로 담은 때(last_at)가 1년 전보다 앞선 줄 (내 수업 자체는 그대로)
--     · 찾기 · 영상 요청 training_card_asks — 마지막으로 남긴 때(last_at)가 1년 전보다 앞선 줄
--   반응(♥ · 느낌) · 의견 · 내 수업 · 월요일 요약 기록은 지우지 않는다(본인이 지울 때까지 · 요약은 합계만).
--
--   이 파일에만 줄을 지우는 문장이 있다 — 운영에 넣을 때 MCP 승인 창이 뜬다(대표님 승인 · 데이터 화면 파일과 따로 넣는다).

create or replace function public._training_card_purge()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cut date := (now() at time zone 'Asia/Seoul')::date - 365;
  v_ts timestamptz := now() - interval '365 days';
  v_e integer := 0;
  v_s integer := 0;
  v_a integer := 0;
begin
  delete from public.training_card_events where day < v_cut;
  get diagnostics v_e = row_count;
  delete from public.training_card_saves where last_at < v_ts;
  get diagnostics v_s = row_count;
  delete from public.training_card_asks where last_at < v_ts;
  get diagnostics v_a = row_count;
  return jsonb_build_object('before', v_cut, 'events', v_e, 'saves', v_s, 'asks', v_a);
end $$;
revoke all on function public._training_card_purge() from public, anon, authenticated;

-- 매일 03:41 KST = 18:41 UTC
select cron.schedule('training-card-purge', '41 18 * * *', $$select public._training_card_purge()$$);
