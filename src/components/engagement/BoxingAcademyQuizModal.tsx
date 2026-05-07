/**
 * 153 QUEST — 오삼이 복싱 아카데미 퀴즈 모달 (MVP).
 *
 * 보호 원칙:
 *   · 공식 XP / member_progress / levels / missions 일절 미수정
 *   · 보상 amount 는 RPC 반환값만 사용 — 클라이언트가 amount 계산 안 함
 *   · grant_gems 직접 호출 0건. submit_boxing_quiz_attempt 내부 grant_gems 만 사용
 *   · ChatAssistant/스트리밍 호출 0건
 *
 * UX:
 *   · 카테고리·난이도 배지 + 보상 미리보기
 *   · lesson_text → question → options → submit
 *   · 정답/오답/이미 보상 받음 3가지 분기 + RPC 메시지/해설 노출
 *   · 다음 문제 / 닫기
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  useBoxingAcademyQuestions,
  useSubmitBoxingQuizAttempt,
} from "@/hooks/useBoxingAcademy";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type {
  BoxingQuizAttemptResult,
  BoxingQuizQuestion,
} from "@/services/boxingEngagementService";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "초급",
  normal: "중급",
  advanced: "고급",
};

const SUPPORTED_TYPES = new Set(["multiple_choice", "ox"]);

const BoxingAcademyQuizModal = ({ open, onClose }: Props) => {
  // open=false 일 때는 RPC 가 발사되지 않도록 enabled gate.
  const { data: questions, isLoading } = useBoxingAcademyQuestions(open);
  const submit = useSubmitBoxingQuizAttempt();
  useModalDismiss(open, onClose);

  const playable: BoxingQuizQuestion[] = useMemo(
    () => (questions ?? []).filter((q) => SUPPORTED_TYPES.has(q.question_type)),
    [questions],
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<BoxingQuizAttemptResult | null>(null);
  const [pending, setPending] = useState(false);

  // 모달 새로 열릴 때 0번 문제부터.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setSelected(null);
      setResult(null);
      setPending(false);
    }
  }, [open]);

  // playable 이 줄어들면 index 가 범위 밖일 수 있음 → 클램프.
  const safeIndex =
    playable.length === 0 ? 0 : Math.min(index, playable.length - 1);
  const current = playable[safeIndex];

  const handleSubmit = async () => {
    if (!current || !selected || pending) return;
    setPending(true);
    try {
      const data = await submit.mutateAsync({
        questionId: current.id,
        selectedAnswer: selected,
      });
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "퀴즈 제출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const handleNext = () => {
    if (playable.length === 0) {
      onClose();
      return;
    }
    const nextIdx = (index + 1) % playable.length;
    setIndex(nextIdx);
    setSelected(null);
    setResult(null);
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Brain className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오삼이 복싱 아카데미
          </p>
          <h2 className="mt-0.5 truncate text-[15px] font-bold text-foreground">
            복싱 IQ 퀴즈
          </h2>
          {current && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="badge-pill bg-primary/10 text-primary">
                {current.category}
              </span>
              <span className="badge-pill bg-secondary text-secondary-foreground">
                {DIFFICULTY_LABEL[current.difficulty] ?? current.difficulty}
              </span>
              <span className="badge-pill bg-reward/15 text-reward">
                +{current.reward_quest_xp} XP · +{current.reward_gems}
              </span>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-sm text-muted-foreground">
          퀴즈를 불러오고 있어요…
        </div>
      );
    }
    if (playable.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm font-bold text-foreground">
            지금 풀 수 있는 퀴즈가 없습니다
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            준비되는 대로 새 문제를 올려두겠습니다.
          </p>
        </div>
      );
    }
    if (!current) return null;

    if (!result) {
      // 문제 풀이 화면
      const options = Array.isArray(current.options)
        ? (current.options as string[])
        : [];
      return (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              오늘의 복싱 카드
            </p>
            <p className="mt-1 text-[12.5px] font-bold text-foreground">
              {current.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {current.lesson_text}
            </p>
          </div>

          <div data-tour="boxing-iq-question">
            <p className="text-[13px] font-bold leading-relaxed text-foreground">
              {current.question}
            </p>
          </div>

          <div className="space-y-2" data-tour="boxing-iq-options">
            {options.map((opt) => {
              const active = selected === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  data-tutorial-answer="true"
                  onClick={() => setSelected(opt)}
                  className={`w-full rounded-card border px-3.5 py-3 text-left text-[13px] transition-all active:scale-[0.99] ${
                    active
                      ? "border-primary bg-primary/10 text-foreground font-bold"
                      : "border-border bg-card text-foreground/90 hover:border-primary/40"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <p className="pt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            ※ 본 퀴즈 보상은 보조 경험치(QUEST XP)와 파이트 머니입니다. 공식
            레벨 XP가 아니며, 1~40 레벨업과 무관합니다.
          </p>
        </div>
      );
    }

    // 결과 화면
    const isCorrect = result.is_correct;
    const isAlreadyRewarded = result.already_rewarded;

    return (
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div
          className={`rounded-card border p-4 ${
            isCorrect
              ? "border-emerald-400/40 bg-emerald-400/10"
              : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <div className="flex items-center gap-2">
            {isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <p className="text-[14px] font-bold text-foreground">
              {isCorrect
                ? isAlreadyRewarded
                  ? "이미 클리어한 퀴즈입니다. 복습으로 기록됩니다."
                  : "정답! 알고 치는 펀치는 더 강합니다."
                : "아쉽지만 괜찮아요. 복싱은 틀리면서 몸에 들어오는 운동입니다."}
            </p>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {result.message}
          </p>
        </div>

        <div className="rounded-card border border-border bg-background/40 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            정답
          </p>
          <p className="mt-1 text-[13px] font-bold text-foreground">
            {result.correct_answer}
          </p>
          {result.explanation && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {result.explanation}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              QUEST XP
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              +{result.quest_xp_granted}
            </p>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-reward">
              파이트 머니
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-reward">
              +{result.gems_granted.toLocaleString()}
            </p>
          </div>
        </div>

        {!isCorrect && (
          <div className="rounded-card border border-border bg-muted/40 p-3">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              한 번 더 가볍게 풀어볼까요? 정답을 안 다음 다시 풀면 진짜 내
              것이 됩니다. (재도전 정답 시 +{current.retry_reward_quest_xp} XP
              · +{current.retry_reward_gems})
            </p>
          </div>
        )}

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ QUEST XP 는 보조 경험치이며, 공식 1~40 레벨업과 무관합니다.
          파이트 머니는 기존 지갑에 합산됩니다.
        </p>
      </div>
    );
  };

  const renderFooter = () => {
    if (playable.length === 0) {
      return (
        <div className="border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-card bg-secondary py-3 text-sm font-bold text-secondary-foreground active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      );
    }

    if (!result) {
      const submitEnabled = !!selected && !pending;
      return (
        <div className="border-t border-border px-5 py-3">
          <button
            onClick={handleSubmit}
            disabled={!submitEnabled}
            className={`w-full rounded-card py-3 text-sm font-bold transition-all ${
              submitEnabled
                ? "bg-primary text-primary-foreground active:scale-[0.98]"
                : "cursor-not-allowed bg-primary/50 text-primary-foreground opacity-60"
            }`}
          >
            {pending
              ? "제출 중…"
              : !selected
                ? "답을 선택해주세요"
                : "제출하기"}
          </button>
        </div>
      );
    }

    const isCorrect = result.is_correct;
    return (
      <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-3">
        {!isCorrect ? (
          <button
            onClick={() => {
              setSelected(null);
              setResult(null);
            }}
            className="flex items-center justify-center gap-1.5 rounded-card bg-secondary py-3 text-sm font-bold text-secondary-foreground active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" /> 재도전
          </button>
        ) : (
          <button
            onClick={onClose}
            className="rounded-card bg-secondary py-3 text-sm font-bold text-secondary-foreground active:scale-[0.98]"
          >
            닫기
          </button>
        )}
        <button
          onClick={handleNext}
          className="rounded-card bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]"
        >
          다음 문제 →
        </button>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="복싱 IQ 퀴즈"
            data-tour="boxing-iq-modal"
            className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            {renderBody()}
            {renderFooter()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BoxingAcademyQuizModal;
