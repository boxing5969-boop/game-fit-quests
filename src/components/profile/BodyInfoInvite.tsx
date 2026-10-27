/**
 * ✨ 신체 정보를 아직 안 넣은 회원에게 — 눈에 띄게 권하기 (2026-10-27 대표님: "신체정보 입력칸 입력 안 한 사람은
 *   더 화려하게 보이게 해 주고 입력하라고 권유해 줘")
 *   무지개 테두리가 천천히 흐르고(움직임 줄이기 설정이면 멈춤) · 넣으면 오르는 정확도.
 *   2026-10-28 리디자인(글 줄이기): 한 줄 단추로 — 설명 문장 · 항목별 +% 칩은 신체 정보 시트 안에서 본다. 화려한 테두리는 그대로.
 *   쓰는 곳: 내 운동 기록 '153과 함께하며' — 키 · 몸무게를 하나도 안 넣었을 때만(bodyInfoEmpty).
 */
import { ChevronRight, Sparkles } from "lucide-react";
import { ACCURACY_POINTS } from "@/lib/fitnessProfile153";
import { cn } from "@/lib/utils";

const TOTAL = ACCURACY_POINTS.weight + ACCURACY_POINTS.gender + ACCURACY_POINTS.age + ACCURACY_POINTS.bodyFat + ACCURACY_POINTS.height;

const BodyInfoInvite = ({ onClick, className, accuracyPct }: { onClick: () => void; className?: string; accuracyPct?: number }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="신체 정보 넣기 — 내 몸 기준으로 정확하게"
    className={cn(
      "group relative block w-full rounded-2xl bg-[linear-gradient(110deg,#10b981,#f59e0b,#ec4899,#8b5cf6,#10b981)] bg-[length:200%_100%] p-[2px] text-left shadow-[0_8px_24px_-12px_rgba(236,72,153,0.5)] transition-transform active:scale-[0.99] motion-safe:animate-sheen",
      className,
    )}
  >
    <span className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3.5">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-violet-500 text-white shadow-md">
        <Sparkles className="h-5 w-5" aria-hidden />
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-pink-500 ring-2 ring-card" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-black leading-snug text-foreground">내 몸 기준으로 바꿔 보세요</span>
        <span className="mt-0.5 block text-label font-bold text-pink-600 dark:text-pink-400">
          30초면 끝 · 정확도 +{TOTAL}%{accuracyPct != null ? ` (지금 ${accuracyPct}%)` : ""}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </span>
  </button>
);

export default BodyInfoInvite;
