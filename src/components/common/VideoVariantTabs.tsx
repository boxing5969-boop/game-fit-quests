/**
 * 🎬 영상 버전 고르기 — '실사 | 애니메이션' (2026-10-01 대표님: 애니메이션 영상을 원본이랑 같이).
 * 같은 동작의 다른 버전을 영상 바로 아래에서 바꿔 본다. 버전이 하나뿐이면 아무것도 그리지 않는다.
 *   · light — 밝은 전체 화면 플레이어(VideoPlayer)
 *   · dark  — 어두운 영상 모달(VideoOverlay · 153플레이)
 */
import { cn } from "@/lib/utils";

interface Props {
  labels: ReadonlyArray<string>;
  value: number;
  onChange: (index: number) => void;
  tone?: "light" | "dark";
  className?: string;
}

const VideoVariantTabs = ({ labels, value, onChange, tone = "light", className }: Props) => {
  if (labels.length < 2) return null;
  const dark = tone === "dark";
  return (
    <div
      role="tablist"
      aria-label="영상 버전"
      // 어두운 모달은 뒤 화면 글자가 비치지 않게 반투명 대신 꽉 찬 회색
      className={cn("flex gap-1 rounded-full p-1", dark ? "bg-neutral-800 ring-1 ring-white/10" : "bg-secondary", className)}
    >
      {labels.map((label, i) => {
        const on = i === value;
        return (
          <button
            key={`${i}-${label}`}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(i)}
            className={cn(
              "h-10 min-w-0 flex-1 truncate rounded-full px-3 text-[13.5px] font-bold transition-colors active:scale-[0.97]",
              on
                ? dark
                  ? "bg-white text-black"
                  : "bg-card text-foreground shadow-elev-1 dark:bg-white/[0.14]"
                : dark
                  ? "text-white/70"
                  : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default VideoVariantTabs;
