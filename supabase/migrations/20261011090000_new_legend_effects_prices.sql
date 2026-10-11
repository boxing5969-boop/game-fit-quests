-- 신규 전설급 이펙트 6종 가격 (2026-10-11 고퀄 VFX 자산 추가와 함께)
-- 적용: mcp apply_migration 으로 2026-10-11 운영 반영 완료. 이 파일은 기록용.
-- 프런트: src/data/effectArt.ts (35종 VFX PNG) + characterCustomizationData EFFECT_OPTIONS 신규 6종.
insert into public.customization_prices (category, item_key, price) values
  ('effect', 'gold_confetti', 8000),
  ('effect', 'aurora', 12000),
  ('effect', 'fire_ring', 15000),
  ('effect', 'galaxy_ring', 25000),
  ('effect', 'champion_glory', 35000),
  ('effect', 'ko_impact', 50000)
on conflict (category, item_key) do update set price = excluded.price, updated_at = now();
