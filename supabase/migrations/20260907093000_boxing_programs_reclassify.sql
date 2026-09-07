-- 153플레이 · 권리 등급과 노출 상태가 어긋난 행 정리
--
-- rights_tier 는 채워져 있었지만 visibility 에 반영되지 않아
-- reupload/archive 인데 공개 상태인 행이 32건 남아 있었다. 등급을 기준으로 맞춘다.
-- (멱등: 이미 정리된 DB 에서는 0 row)

update public.boxing_programs
   set visibility = 'admin'
 where is_active = true
   and visibility = 'public'
   and (rights_tier is null or rights_tier in ('reupload','archive'));

-- 결과(2026-09-07 기준, is_active = true 2,705건)
--   public : youtube official 678 / youtube creator 1,233 / instagram creator 327  = 2,238
--   admin  : youtube reupload 312 / youtube archive 154 / youtube creator 1        =   467
