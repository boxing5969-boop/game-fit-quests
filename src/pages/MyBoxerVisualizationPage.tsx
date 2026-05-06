/**
 * 153마인드셋 — 시각화 훈련 페이지 wrapper.
 *
 * 라우트 마운트 지점. 단기 / 장기 두 세션을 선택해서 같은 플레이어로 실행.
 * 세션 본 화면 로직은 MyBoxerVisualizationSession 컴포넌트가 담당.
 *
 * 보호 원칙: DB / API / wallet / 기존 공통 컴포넌트 0 변경.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, Telescope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MyBoxerVisualizationSession from "@/features/myboxer-visualization/MyBoxerVisualizationSession";
import {
  VISUALIZATION_SESSION,
  LONG_TERM_VISUALIZATION_SESSION,
  type VisualizationSession as VisualizationSessionData,
} from "@/features/myboxer-visualization/visualizationContent";

interface SessionChoice {
  data: VisualizationSessionData;
  badge: string;
  description: string;
  icon: typeof Sparkles;
}

const CHOICES: SessionChoice[] = [
  {
    data: VISUALIZATION_SESSION,
    badge: "오늘 한 라운드",
    description:
      "오늘 153복싱짐으로 돌아온 사람의 마음을 다시 세웁니다.\n오늘의 마음 → 마음가짐 → 약속 → 3분 라운드.",
    icon: Sparkles,
  },
  {
    data: LONG_TERM_VISUALIZATION_SESSION,
    badge: "장기 시각화",
    description:
      "1년 뒤, 153복싱짐에 꾸준히 돌아온 내가 어떤 사람이 되어 있는지\n실제 감정으로 미리 만나봅니다.",
    icon: Telescope,
  },
];

const MyBoxerVisualizationPage = () => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (activeIdx !== null) {
    const choice = CHOICES[activeIdx];
    return (
      <MyBoxerVisualizationSession
        session={choice.data}
        onClose={() => setActiveIdx(null)}
      />
    );
  }

  return (
    <div
      data-tour="mindset-session-picker"
      className="relative min-h-dvh w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0a1024 0%, #0d1530 50%, #0a1024 100%)",
      }}
    >
      {/* amber glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #fdb85c 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mx-auto w-full max-w-md px-5 pb-24 pt-10 text-amber-50"
      >
        <header className="space-y-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-300/70">
            MYBOXER 153
          </p>
          <h1 className="text-3xl font-black leading-tight text-amber-50">
            153마인드셋
          </h1>
          <p className="text-[12px] text-amber-200/60">
            오늘의 한 라운드와, 1년 뒤의 나를 함께 마음에 둡니다.
          </p>
        </header>

        <div className="mt-8 rounded-xl border-l-2 border-rose-500/60 bg-rose-950/15 px-4 py-3 text-left">
          <p className="text-[11px] leading-relaxed text-rose-100/80">
            복싱은 강해지는 시간이기도 하지만,
            <br />
            나를 다시 좋아하게 되는 시간이기도 합니다.
          </p>
        </div>

        <AnimatePresence>
          <div className="mt-6 space-y-3">
            {CHOICES.map((c, i) => (
              <motion.button
                key={c.data.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={cn(
                  "group flex w-full flex-col items-start gap-2 overflow-hidden rounded-2xl border border-amber-200/15 bg-black/30 p-5 text-left transition-all hover:border-amber-300/40 hover:bg-black/40 active:scale-[0.99]",
                )}
              >
                <div className="flex items-center gap-2">
                  <c.icon className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">
                    {c.badge}
                  </span>
                </div>

                <h2 className="text-lg font-black leading-tight text-amber-50">
                  {c.data.title}
                </h2>
                <p className="text-[11px] text-amber-200/60">{c.data.subtitle}</p>

                <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-amber-100/85">
                  {c.description}
                </p>

                <div className="mt-3 flex w-full items-center justify-between">
                  <span className="font-mono text-[10px] tabular-nums text-amber-200/40">
                    {Math.floor(c.data.durationSeconds / 60)}분 1라운드 ·{" "}
                    {c.data.segments.length}세그먼트
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 transition-transform group-hover:translate-x-0.5">
                    시작
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </AnimatePresence>

        <p className="mt-8 text-center text-[10px] text-amber-200/40">
          진행 기록은 단말기에만 저장됩니다.
          <br />
          출석 / 공식 훈련과는 무관합니다.
        </p>
      </motion.section>
    </div>
  );
};

// 향후 다른 곳에서 단기/장기 세션 직접 마운트도 가능하도록 import 헬퍼 노출
export { VISUALIZATION_SESSION, LONG_TERM_VISUALIZATION_SESSION };

export default MyBoxerVisualizationPage;

// (참고)
// 페이지 wrapper 안에서 뒤로가기 인디케이션 — 세션 진행 중 ArrowLeft 아이콘은
// 컴포넌트 내부 onClose 로 제어. 외부에서 별도 navigate 처리 불필요.
void ArrowLeft;
