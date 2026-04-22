import { cn } from "@/lib/utils";

interface CoachBotProps {
  /** 말풍선에 들어갈 짧은 멘트. */
  message: string;
  /** 좌측에 붙이는 캐릭터 크기. */
  size?: "sm" | "md";
  /** 하단 "코치봇" 네임 표시 여부 — 기본 true. */
  showName?: boolean;
  className?: string;
}

/**
 * "코치봇" — 랭킹업 입단식 NPC 가이드.
 *
 * 디자인 의도
 *   • 왼쪽 아바타 (🥊 이모지 + primary gradient glow) + 우측 말풍선.
 *   • 아바타 하단에 "코치봇" 네임 라벨 — 게임 RPG 대화창 느낌.
 *   • 말풍선은 좌측 tail 삼각형 + 미묘한 primary tint 로 강조.
 *   • 모든 요소가 토큰 색상 + CSS only — 외부 asset 0.
 */
export const CoachBot = ({
  message,
  size = "md",
  showName = true,
  className,
}: CoachBotProps) => {
  const avatarClass = size === "sm" ? "h-10 w-10 text-2xl" : "h-12 w-12 text-3xl";

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      {/* ── 아바타 + 네임 ── */}
      <div className="relative flex shrink-0 flex-col items-center gap-1">
        <div
          className={cn(
            "relative flex items-center justify-center rounded-2xl",
            "bg-gradient-to-br from-primary/30 via-primary/15 to-card",
            "border border-primary/40 shadow-[0_0_18px_rgba(217,54,32,0.25)]",
            "animate-emote-idle",
            avatarClass,
          )}
          aria-hidden
        >
          {/* 뒤쪽 soft glow */}
          <span className="absolute inset-0 rounded-2xl bg-primary/10 blur-md" />
          <span className="relative">🥊</span>
        </div>
        {showName && (
          <span className="rounded-full bg-primary/15 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-primary">
            코치봇
          </span>
        )}
      </div>

      {/* ── 말풍선 ── */}
      <div
        className={cn(
          "relative max-w-[220px] rounded-2xl rounded-tl-sm",
          "border border-primary/25 bg-gradient-to-br from-card to-card/95",
          "px-3 py-2.5 text-[12px] leading-relaxed text-foreground",
          "shadow-[0_2px_12px_rgba(0,0,0,0.15)]",
        )}
      >
        {/* Tail */}
        <span
          className={cn(
            "absolute -left-[6px] top-2 h-3 w-3 rotate-45",
            "border-l border-b border-primary/25 bg-card",
          )}
          aria-hidden
        />
        <span className="relative whitespace-pre-line">{message}</span>
      </div>
    </div>
  );
};

export default CoachBot;
