-- 꾸미기 아이템 보유 테이블
CREATE TABLE IF NOT EXISTS user_owned_customizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category, item_key)
);

ALTER TABLE user_owned_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customizations"
  ON user_owned_customizations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customizations"
  ON user_owned_customizations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 꾸미기 아이템 구매 RPC
CREATE OR REPLACE FUNCTION purchase_customization(
  p_category TEXT,
  p_item_key TEXT,
  p_price INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_already BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_owned_customizations
    WHERE user_id = v_user_id AND category = p_category AND item_key = p_item_key
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'already_owned', true);
  END IF;

  SELECT gems_balance INTO v_balance
  FROM user_wallets WHERE user_id = v_user_id;

  IF v_balance IS NULL THEN
    v_balance := 0;
  END IF;

  IF p_price > 0 AND v_balance < p_price THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_gems', 'current', v_balance);
  END IF;

  IF p_price > 0 THEN
    UPDATE user_wallets
    SET gems_balance = gems_balance - p_price,
        total_spent = total_spent + p_price
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO user_owned_customizations (user_id, category, item_key)
  VALUES (v_user_id, p_category, p_item_key);

  RETURN json_build_object(
    'success', true,
    'remaining_gems', GREATEST(v_balance - p_price, 0)
  );
END;
$$;
