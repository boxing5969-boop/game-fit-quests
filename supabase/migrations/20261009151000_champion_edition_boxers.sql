-- 챔피언 에디션 복서 6종 가격 등록 (2026-10-09)
-- src/data/characterPresets.ts 의 champ_01~06 과 쌍을 이룬다.
INSERT INTO public.customization_prices (category, item_key, price) VALUES
  ('boxer','champ_02',3000),
  ('boxer','champ_03',5000),
  ('boxer','champ_04',7000),
  ('boxer','champ_01',10000),
  ('boxer','champ_05',12000),
  ('boxer','champ_06',15000)
ON CONFLICT (category, item_key) DO UPDATE SET price = EXCLUDED.price, updated_at = now();
