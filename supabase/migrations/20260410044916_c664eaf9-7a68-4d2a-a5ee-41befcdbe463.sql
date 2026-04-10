
-- Function to auto-award badges based on member progress
CREATE OR REPLACE FUNCTION public.auto_award_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _badge_id uuid;
BEGIN
  -- white_clear: white rank boss cleared (moved past white)
  IF NEW.current_rank IN ('blue', 'red', 'black') THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'white_clear';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM member_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO member_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
    END IF;
  END IF;

  -- blue_belt: reached blue rank
  IF NEW.current_rank IN ('blue', 'red', 'black') THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'blue_belt';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM member_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO member_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
    END IF;
  END IF;

  -- champion: at least 1 boss cleared
  IF NEW.bosses_cleared >= 1 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'champion';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM member_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO member_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
    END IF;
  END IF;

  -- steady_fighter: 30+ streak days
  IF NEW.streak_days >= 30 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'steady_fighter';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM member_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO member_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
    END IF;
  END IF;

  -- streak_3: 3+ streak days
  IF NEW.streak_days >= 3 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'streak_3';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM member_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO member_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
    END IF;
  END IF;

  -- first_round: has any XP (total_xp > 0)
  IF NEW.total_xp > 0 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'first_round';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM member_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO member_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on member_progress updates
CREATE TRIGGER trg_auto_award_badges
AFTER UPDATE ON public.member_progress
FOR EACH ROW
EXECUTE FUNCTION public.auto_award_badges();
