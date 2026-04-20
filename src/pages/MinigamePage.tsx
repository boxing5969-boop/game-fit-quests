import { useNavigate } from "react-router-dom";
import { Gamepad2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * 외부 미니게임 임베드 페이지.
 *
 * speed-strike-trainer.lovable.app 을 iframe 으로 표시하고, 로그인된
 * 유저의 user_id 를 `?uid=` 쿼리로 전달해 외부 앱이 점수 집계/연동에
 * 사용할 수 있게 한다. 로그인되지 않은 상태에서는 로그인 유도 화면을
 * 보여주어 빈 iframe 이 그대로 노출되지 않도록 한다.
 */
const MINIGAME_URL = "https://speed-strike-trainer.lovable.app";

const MinigamePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-primary/20" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Gamepad2 className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-bold text-foreground">로그인이 필요합니다</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          미니게임은 로그인 후 이용할 수 있어요. 점수는 내 계정에 연동됩니다.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
        >
          로그인 하러가기
        </button>
      </div>
    );
  }

  const src = `${MINIGAME_URL}?uid=${encodeURIComponent(user.id)}`;

  return (
    <div className="min-h-screen w-full bg-background">
      <iframe
        src={src}
        width="100%"
        height="100%"
        style={{ border: "none", minHeight: "100vh" }}
        title="미니게임 — Speed Strike Trainer"
        allow="accelerometer; gyroscope; fullscreen"
      />
    </div>
  );
};

export default MinigamePage;
