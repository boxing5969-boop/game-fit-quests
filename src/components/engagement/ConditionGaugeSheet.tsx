/**
 * 153 QUEST v1.5 14단계 — 컨디션 선택 바텀시트.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정 (읽기도 안 함)
 *   · 보상 amount 처리 0 — submit_boxing_condition RPC 가 보상 0 반환
 *   · grant_gems 직접 호출 0건
 *   · ChatAssistant 미참조 / 새 AI 챗박스 0건
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss 적용
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X } from "lucide-react";
import { toast } from "sonner";

import {
  CONDITION_OPTIONS,
  PAIN_AREA_OPTIONS,
  getConditionRecommendation,
} from "@/data/boxingConditionMessages";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useSubmitBoxingCondition } from "@/hooks/useBoxingCondition";
import type { BoxingConditionType } from "@/services/boxingEngagementService";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ConditionGaugeSheet = ({ open, onClose }: Props) => {
  const submit = useSubmitBoxingCondition();
  useModalDismiss(open, onClose);

  const [selected, setSelected] = useState<BoxingConditionType | null>(null);
  const [painArea, setPainArea] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setPainArea([]);
      setNote("");
      setPending(false);
      setDone(false);
    }
  }, [open]);

  const showPainArea = selected === "pain";
  const canSubmit = !!selected && !pending;

  const togglePainArea = (value: string) => {
    setPainArea((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    setPending(true);
    try {
      await submit.mutateAsync({
        conditionType: selected,
        painArea: showPainArea ? painArea : [],
        note: note.trim().length > 0 ? note.trim() : null,
      });
      setDone(true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "컨디션 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const recommendation = selected ? getConditionRecommendation(selected) : null;

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘의 라운드 점검
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            컨디션 게이지
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            오늘 상태에 맞춰 보조 퀘스트 추천만 조정됩니다.
          </p>
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

  const renderResult = () => (
    <div className="space-y-3">
      <div className="rounded-card border border-emerald-400/40 bg-emerald-400/10 p-3.5">
        <p className="text-[13.5px] font-bold text-foreground">
          기록 완료. 오늘은 {recommendation?.osamiMessage}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {recommendation?.hint}
        </p>
      </div>

      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
          오삼 코치
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-foreground">
          몸을 읽는 복서가 오래 갑니다. 오늘 컨디션은 기록되었습니다.
        </p>
      </div>

      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 컨디션 선택 자체에는 보상이 없습니다. 공식 훈련 리스트 / 공식 XP /
        공식 레벨업과 무관합니다.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
      >
        닫기
      </button>
    </div>
  );

  const renderForm = () => (
    <div className="space-y-3">
      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
          오늘의 질문
        </p>
        <p className="mt-1 text-[13.5px] font-bold text-foreground">
          오늘 컨디션은 어때요?
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          정직하게 골라주세요. 무리하지 않을 권리는 복서의 기본기입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {CONDITION_OPTIONS.map((o) => {
          const active = selected === o.type;
          return (
            <button
              key={o.type}
              type="button"
              onClick={() => setSelected(o.type)}
              className={`flex items-center gap-3 rounded-card border px-3.5 py-3 text-left transition-all active:scale-[0.99] ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="text-2xl">{o.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-foreground">
                  {o.label}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {o.desc}
                </p>
              </div>
              {active && (
                <span className="text-[11px] font-bold text-primary">
                  선택됨
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showPainArea && (
        <div>
          <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
            통증 부위{" "}
            <span className="font-normal text-muted-foreground">(선택)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PAIN_AREA_OPTIONS.map((p) => {
              const active = painArea.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePainArea(p.value)}
                  className={`rounded-pill border px-2.5 py-1.5 text-[11px] transition-all active:scale-[0.98] ${
                    active
                      ? "border-primary bg-primary/10 text-foreground font-bold"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
            ※ 통증이 있으면 무리하지 마세요. 코치와 상담을 권장합니다.
          </p>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          한 줄 메모{" "}
          <span className="font-normal text-muted-foreground">(선택)</span>
        </p>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 120))}
          placeholder="오늘의 컨디션을 간단히…"
          className="w-full rounded-card border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {recommendation && (
        <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            오삼 코치 미리보기
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground">
            {recommendation.osamiMessage}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {recommendation.hint}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full rounded-card py-3 text-[14px] font-bold transition-all ${
          canSubmit
            ? "bg-primary text-primary-foreground active:scale-[0.98]"
            : "cursor-not-allowed bg-primary/50 text-primary-foreground opacity-60"
        }`}
      >
        {pending
          ? "기록 중…"
          : !selected
            ? "컨디션을 선택해주세요"
            : "오늘 컨디션 기록"}
      </button>

      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 컨디션 선택 자체에는 QUEST XP / 파이트 머니 / RP 보상이 없습니다.
        공식 1~40 레벨업과 무관합니다.
      </p>
    </div>
  );

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
            aria-label="컨디션 게이지"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {done ? renderResult() : renderForm()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConditionGaugeSheet;
