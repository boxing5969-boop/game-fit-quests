import { cn } from "@/lib/utils";

interface CoachBotProps {
  /** 말풍선에 들어갈 짧은 멘트. */
  message: string;
  /** 좌측에 붙이는 캐릭터 크기. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * "코치봇" — 튜토리얼 NPC 가이드.
 *
 * 외부 그래픽 자산 없이 이모지 + 토큰 색상만으로 캐릭터를 구성해
 * 첫 로드 비용 0. idle bob 애니메이션은 기존 emote-idle 키프레임
 * (index.css) 을 재사용한다.
 *
 * 말풍선은 우측에 살짝 띄워 카드의 흐름을 끊지 않도록 inline-flex.
 */
export const CoachBot = ({ message, size = "md", className }: CoachBotProps) => {
  const px = size === "sm" ? "h-10 w-10 text-2xl" : "h-12 w-12 text-3xl";
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl",
          "bg-gradient-to-br from-primary/25 via-primary/10 to-card",
          "border border-primary/30 shadow-[0_0_18px_rgba(217,54,32,0.18)]",
          "animate-emote-idle",
          px,
        )}
        aria-hidden
      >
        🥊
      </div>
      <div className="relative max-w-[220px] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-[12px] leading-relaxed text-foreground">
        <span className="absolute -left-1.5 top-2 h-3 w-3 rotate-45 border-l border-b border-border bg-card" />
        <span className="relative">{message}</span>
      </div>
    </div>
  );
};

export default CoachBot;
