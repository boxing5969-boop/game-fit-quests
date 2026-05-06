/**
 * 복싱인 루트 — 시각화 훈련 페이지.
 *
 * 153복싱짐으로 돌아온 성인 회원을 위한 3분 1라운드 시각화 훈련.
 *
 * 작업 범위:
 *   · 기존 RPG 게임탭 화면을 이 페이지로 교체.
 *   · 게임형 표현 0건. 성인 회원 톤 유지.
 *   · DB / API / wallet / 기존 공통 컴포넌트 변경 0.
 *   · 진행 기록은 localStorage 만 (mb153_viz_*).
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import VisualizationSession from "@/components/boxer-route/VisualizationSession";
import RoutinePickerCard from "@/components/boxer-route/RoutinePickerCard";
import { useVisualizationProgress } from "@/hooks/useVisualizationProgress";
import {
  VISUALIZATION_ROUTINES,
  pickTodayRoutine,
  type VisualizationRoutine,
} from "@/data/boxerRouteContent";

type View = "picker" | "session";

const BoxerRoutePage = () => {
  const [view, setView] = useState<View>("picker");
  const [activeRoutine, setActiveRoutine] = useState<VisualizationRoutine | null>(
    null,
  );
  const { state, todayCodes } = useVisualizationProgress();

  const todayRecommended = useMemo(() => pickTodayRoutine(), []);

  const handleStart = (routine: VisualizationRoutine) => {
    setActiveRoutine(routine);
    setView("session");
  };

  const handleExit = () => {
    setActiveRoutine(null);
    setView("picker");
  };

  const handlePickAnother = () => {
    setActiveRoutine(null);
    setView("picker");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-dvh bg-background pb-32"
    >
      <div className="mx-auto w-full max-w-md md:max-w-xl space-y-5 px-4 py-5">
        {/* 헤더 — 기능 제목 / 부제 */}
        <header className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">
            153마인드셋
          </p>
          <h1 className="text-2xl font-black leading-tight text-foreground">
            153복싱짐으로 돌아온 사람
          </h1>
          <p className="text-[12px] text-muted-foreground">
            오늘의 훈련을 시작하는 3분 시각화
          </p>
        </header>

        <AnimatePresence mode="wait">
          {view === "picker" && (
            <motion.section
              key="picker"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* 소개 카드 */}
              <div className="rounded-3xl border border-amber-500/15 bg-gradient-to-br from-amber-500/8 via-gray-950/60 to-gray-950/80 p-4">
                <p className="text-[11px] leading-relaxed text-foreground/85">
                  눈을 감고 153복싱짐의 공기를 떠올려 봅니다. 오랜만에 와도 괜찮습니다.
                  돌아온 것 자체가 오늘의 가장 큰 훈련입니다.
                </p>
              </div>

              {/* 진행 요약 */}
              {state.total_rounds > 0 && (
                <div className="flex items-center justify-around rounded-2xl border border-white/10 bg-gray-950/60 px-3 py-3">
                  <Stat label="이번 주 연속" value={`${state.streak}일`} />
                  <div className="h-7 w-px bg-white/10" />
                  <Stat label="누적 라운드" value={`${state.total_rounds}회`} />
                  <div className="h-7 w-px bg-white/10" />
                  <Stat
                    label="마지막"
                    value={state.last_completed_date ?? "—"}
                    small
                  />
                </div>
              )}

              {/* 오늘의 추천 */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  오늘의 라운드
                </p>
                <RoutinePickerCard
                  routine={todayRecommended}
                  recommended
                  doneToday={todayCodes.has(todayRecommended.code)}
                  onSelect={handleStart}
                />
              </div>

              {/* 전체 라운드 — 한 주 분량 */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  한 주의 라운드
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {VISUALIZATION_ROUTINES.filter(
                    (r) => r.code !== todayRecommended.code,
                  ).map((r) => (
                    <RoutinePickerCard
                      key={r.code}
                      routine={r}
                      doneToday={todayCodes.has(r.code)}
                      onSelect={handleStart}
                    />
                  ))}
                </div>
              </div>

              <p className="pt-2 text-center text-[10px] text-muted-foreground">
                진행 기록은 단말기에만 저장됩니다. 출석/공식 훈련과는 무관합니다.
              </p>
            </motion.section>
          )}

          {view === "session" && activeRoutine && (
            <motion.section
              key="session"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                라운드 목록으로
              </button>

              <VisualizationSession
                routine={activeRoutine}
                onExit={handleExit}
                onPickAnother={handlePickAnother}
              />

              <button
                type="button"
                onClick={handlePickAnother}
                className="mx-auto flex items-center gap-1.5 rounded-pill border border-white/10 bg-gray-900/40 px-3 py-1.5 text-[10px] text-muted-foreground active:scale-95"
              >
                <RefreshCcw className="h-3 w-3" />
                다른 라운드 골라 보기
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={
          small
            ? "mt-0.5 font-mono text-[11px] tabular-nums text-foreground"
            : "mt-0.5 text-base font-black tabular-nums text-amber-200"
        }
      >
        {value}
      </span>
    </div>
  );
}

export default BoxerRoutePage;
