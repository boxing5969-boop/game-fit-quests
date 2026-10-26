/**
 * ✨ 신체 정보를 아직 안 넣은 회원에게 — 눈에 띄게 권하기 (2026-10-27 대표님: "신체정보 입력칸 입력 안 한 사람은
 *   더 화려하게 보이게 해 주고 입력하라고 권유해 줘")
 *   무지개 테두리가 천천히 흐르고(움직임 줄이기 설정이면 멈춤) · 넣으면 오르는 정확도 · 큰 '신체 정보 넣기' 버튼.
 *   쓰는 곳: 내정보 '지금까지 이룬 것' 아래 · 홈 '153과 함께하며' 정확도 자리 — 키 · 몸무게를 하나도 안 넣었을 때만(bodyInfoEmpty).
 */
import { ChevronRight, Sparkles } from "lucide-react";
import { ACCURACY_POINTS } from "@/lib/fitnessProfile153";
import { cn } from "@/lib/utils";

const CHIPS: ReadonlyArray<{ label: string; points: number }> = [
  { label: "몸무게", points: ACCURACY_POINTS.weight },
  { label: "성별", points: ACCURACY_POINTS.gender },
  { label: "나이", points: ACCURACY_POINTS.age },
  { label: "체지방률", points: ACCURACY_POINTS.bodyFat },
  { label: "키", points: ACCURACY_POINTS.height },
];
const TOTAL = CHIPS.reduce((s, c) => s + c.points, 0);

const BodyInfoInvite = ({ onClick, className, accuracyPct }: { onClick: () => void; className?: string; accuracyPct?: number }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="신체 정보 넣기 — 내 몸 기준으로 정확하게"
    className={cn(
      "group relative block w-full rounded-2xl bg-[linear-gradient(110deg,#10b981,#f59e0b,#ec4899,#8b5cf6,#10b981)] bg-[length:200%_100%] p-[2px] text-left shadow-[0_8px_24px_-10px_rgba(236,72,153,0.55)] transition-transform active:scale-[0.99] motion-safe:animate-sheen",
      className,
    )}
  >
    <span className="block rounded-[14px] bg-card px-4 pb-3.5 pt-3.5">
      <span className="flex items-start gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-violet-500 text-white shadow-md">
          <Sparkles className="h-5 w-5" aria-hidden />
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-pink-500 ring-2 ring-card" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-black tracking-wide text-pink-600 dark:text-pink-400">
            30초면 끝 · 정확도 최대 +{TOTAL}%{accuracyPct != null ? ` (지금 ${accuracyPct}%)` : ""}
          </span>
          <span className="mt-0.5 block text-[16.5px] font-black leading-snug text-foreground">내 몸 기준으로 바꿔 보세요</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
            몸무게 · 키 · 성별 · 나이를 넣으면 칼로리와 건강 효과가 평균이 아니라 내 몸에 딱 맞게 계산돼요
          </span>
        </span>
      </span>
      <span className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
        {CHIPS.map((c) => (
          <span key={c.label} className="rounded-full bg-gradient-to-r from-pink-500/10 to-amber-500/10 px-2 py-0.5 text-[11.5px] font-bold text-foreground ring-1 ring-inset ring-pink-500/20">
            {c.label} <b className="text-pink-600 dark:text-pink-400">+{c.points}%</b>
          </span>
        ))}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-bold text-muted-foreground">하루 평균 운동 시간</span>
      </span>
      <span className="mt-3 flex h-11 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-[14.5px] font-black text-white shadow-sm">
        신체 정보 넣기 <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </span>
  </button>
);

export default BodyInfoInvite;
