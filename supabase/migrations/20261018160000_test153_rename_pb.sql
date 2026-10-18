-- 153 TEST → 153 PB (Personal Best · 내 최고 기록) — 이름만 바꾼다 (2026-10-18 대표님: "153 PB (Personal Best)(내 최고 기록) 이렇게 표현하자")
--   코드 식별자(test153 · first_test153 · test153_records)는 그대로. 화면·알림에 나가는 글자만.
--   · record_153_label('first_test153') : '최초 153 TEST 완주' → '최초 153 PB 완주' (153 레코드 알림·마일리지 내역 이름표)
--   · admin_member_activity            : 회원 활동 '153 TEST 완주/측정' → '153 PB 완주/측정'
--   지금 DB 에 있는 함수 정의에서 글자만 바꿔 다시 만든다(지우는 것 없음). 바꿀 곳이 정확히 1군데가 아니면 멈춘다.
do $$
declare
  f record;
  v_def text;
  v_new text;
  v_hits int;
begin
  for f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('record_153_label', 'admin_member_activity')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_hits := (length(v_def) - length(replace(v_def, '153 TEST', ''))) / length('153 TEST');
    if v_hits = 0 then
      continue; -- 이미 바뀜
    end if;
    if v_hits <> 1 then
      raise exception '% 에서 153 TEST 가 % 군데 — 확인 필요', f.proname, v_hits;
    end if;
    v_new := replace(v_def, '153 TEST', '153 PB');
    execute v_new;
  end loop;
end $$;
