/**
 * 레벨업 안내 — 아래에서 올라오는 창 (2026-11-27 · 새 튜토리얼 · 화면 속은 LevelGuideSteps)
 *   · 위: 다섯 칸 진행 막대 + 「건너뛰기」 · 아래: 「이전」 + 한 가지 큰 단추 (2장에서는 그 단추가 연습 「1일차 트레이닝 해 보기」)
 *   · 옆으로 밀어 넘기기 · 휴대폰 뒤로가기 = 닫기 · 바깥을 눌러도 닫히지 않는다(처음 보는 회원이 실수로 놓치지 않게)
 *   · 닫을 때 { finished, step } — 기록(member_guide_mark)은 LevelGuideHost 가 한다
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useLevelupRules } from "@/hooks/useLevelupRules";
import { useMileageRules } from "@/hooks/useMileage";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { GUIDE_COPY, GUIDE_STEPS, GUIDE_STEP_COUNT, demoActionLabel } from "@/lib/levelGuide";
import { cn } from "@/lib/utils";
import { StepDays, StepLeagues, StepRewards, StepStart, StepWhy } from "./LevelGuideSteps";

export interface GuideCloseResult {
  /** 마지막 장의 단추로 닫았다 (끝까지 봄) */
  finished: boolean;
  /** 가장 멀리 본 장 (0 ~ 4) */
  step: number;
  /** 마지막 장에서 알림 켜기를 눌렀다 */
  pushAsked: boolean;
}

interface Props {
  open: boolean;
  /** 인사에 넣을 이름 (없으면 「반가워요」) */
  name: string | null;
  onClose: (r: GuideCloseResult) => void;
}

const LevelGuideSheet = ({ open, name, onClose }: Props) => (
  <AnimatePresence>{open && <GuideBody name={name} onClose={onClose} />}</AnimatePresence>
);

const SWIPE = 70;

const GuideBody = ({ name, onClose }: Omit<Props, "open">) => {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [demo, setDemo] = useState(0);
  const maxRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);
  const reduce = useReducedMotion();
  const rulesQ = useLevelupRules(true);
  const mileageQ = useMileageRules(true);
  const push = usePushNotifications();

  const close = useCallback(
    (finished: boolean, pushAsked = false) => {
      if (closedRef.current) return;
      closedRef.current = true;
      onClose({ finished, step: maxRef.current, pushAsked });
    },
    [onClose],
  );
  useModalDismiss(true, () => close(false), { back: true });

  const last = GUIDE_STEP_COUNT - 1;
  const go = (to: number) => {
    const t = Math.max(0, Math.min(last, to));
    if (t === step) return;
    setDir(t > step ? 1 : -1);
    setStep(t);
    maxRef.current = Math.max(maxRef.current, t);
  };

  // 장이 바뀌면 맨 위부터
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const key = GUIDE_STEPS[step];
  const demoLabel = key === "days" ? demoActionLabel(demo) : null;
  const pushOff = push.state?.kind === "off";
  const showPush = key === "start" && pushOff;
  const pushReward =
    push.rewardClaimable && push.reward && push.reward.amount > 0 ? `챔피언 머니 +${push.reward.amount.toLocaleString("ko-KR")}` : null;

  const primary: { label: string; onClick: () => void } = demoLabel
    ? {
        label: demoLabel,
        onClick: () => {
          setDemo((d) => d + 1);
          try {
            navigator.vibrate?.(18);
          } catch {
            /* 진동이 없는 기기 */
          }
        },
      }
    : key === "start"
      ? showPush
        ? {
            label: GUIDE_COPY.start.pushOn,
            onClick: () => {
              push.enable();
              close(true, true);
            },
          }
        : { label: GUIDE_COPY.start.go, onClick: () => close(true) }
      : { label: "다음", onClick: () => go(step + 1) };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE || info.velocity.x < -500) go(step + 1);
    else if (info.offset.x > SWIPE || info.velocity.x > 500) go(step - 1);
  };

  const slide = reduce ? 0 : 36;

  return (
    <motion.div
      data-level-guide
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[118] flex items-end justify-center bg-black/40 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        role="dialog"
        aria-modal="true"
        aria-label="레벨업 안내"
        className="flex h-[min(46rem,92dvh)] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-elev-3 sm:rounded-3xl"
      >
        {/* 진행 막대 · 건너뛰기 */}
        <div className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-4">
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={GUIDE_STEP_COUNT} aria-valuenow={step + 1} aria-label={`레벨업 안내 ${step + 1} / ${GUIDE_STEP_COUNT}`}>
            {GUIDE_STEPS.map((s, i) => (
              <span key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
          {step < last ? (
            <button
              type="button"
              onClick={() => close(false)}
              className="-mr-2 h-10 shrink-0 rounded-full px-3 text-label font-bold text-muted-foreground active:bg-muted"
            >
              건너뛰기
            </button>
          ) : (
            <span className="h-10 w-px shrink-0" aria-hidden />
          )}
        </div>

        {/* 화면 속 — 옆으로 밀면 넘어간다 */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 pt-2">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={key}
              custom={dir}
              initial={{ x: dir * slide, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -dir * slide, opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.22, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragDirectionLock
              onDragEnd={onDragEnd}
              style={{ touchAction: "pan-y" }}
            >
              {key === "why" && <StepWhy name={name} />}
              {key === "days" && <StepDays done={demo} mileage={mileageQ.data} />}
              {key === "leagues" && <StepLeagues rules={rulesQ.data} />}
              {key === "rewards" && <StepRewards mileage={mileageQ.data} />}
              {key === "start" && <StepStart showPush={showPush} pushReward={pushReward} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 단추 — 이전 + 한 가지 큰 단추 · 마지막 장에 알림을 안 켠 분은 「알림 없이 시작하기」 */}
        <div className="shrink-0 border-t border-border/70 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(step - 1)}
                aria-label="이전"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground active:scale-[0.98]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={primary.onClick}
              disabled={key === "start" && !!push.busy}
              className="h-12 min-w-0 flex-1 rounded-xl bg-primary px-3 text-body font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {primary.label}
            </button>
          </div>
          {showPush && (
            <button
              type="button"
              onClick={() => close(true)}
              className="mt-1.5 h-10 w-full rounded-xl text-label font-bold text-muted-foreground active:bg-muted"
            >
              {GUIDE_COPY.start.pushSkip}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LevelGuideSheet;
