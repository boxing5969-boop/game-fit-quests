/**
 * 153 QUEST — 챌린지 아레나: 제출 폼 + 결과 화면.
 *
 * RPC submit_boxing_fun_challenge_attempt 호출 결과를 그대로 노출한다.
 * 보상 amount 는 RPC 반환값(quest_xp_granted/gems_granted)만 사용.
 * 공식 XP / member_progress / user_wallets 일절 미수정.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useSubmitBoxingFunChallengeAttempt } from "@/hooks/useBoxingFunChallenges";
import type {
  BoxingFunChallenge,
  FunChallengeAttemptResult,
  QuizDifficulty,
} from "@/services/boxingEngagementService";

import SafetyCheckPanel, { type PainChecks } from "./SafetyCheckPanel";

const DIFFICULTY_LABEL: Record<QuizDifficulty, string> = {
  beginner: "초급",
  normal: "중급",
  advanced: "고급",
};

const METRIC_UNIT: Record<string, string> = {
  count: "회",
  rounds: "라운드",
  minutes: "분",
  combos: "콤보",
};

export interface FunChallengeSubmitFormProps {
  challenge: BoxingFunChallenge;
  onBack: () => void;
  onClose: () => void;
}

const FunChallengeSubmitForm = ({
  challenge,
  onBack,
  onClose,
}: FunChallengeSubmitFormProps) => {
  const submit = useSubmitBoxingFunChallengeAttempt();

  const [difficulty, setDifficulty] = useState<QuizDifficulty>("beginner");
  const [submittedValue, setSubmittedValue] = useState("");
  const [note, setNote] = useState("");
  const [painChecks, setPainChecks] = useState<PainChecks>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<FunChallengeAttemptResult | null>(null);

  const unit = METRIC_UNIT[challenge.target_metric] ?? "";
  const targetValue =
    challenge.difficulty_targets?.[difficulty] ?? 0;
  const rewardPreview = challenge.rewards_by_difficulty?.[difficulty];

  // pain_check_required 가 매 렌더 새 reference 가 되지 않도록 안정화.
  const requiredPainAreas = useMemo(
    () => challenge.pain_check_required ?? [],
    [challenge.pain_check_required],
  );

  // 챌린지 또는 난이도 변경 시 통증 체크 초기화.
  useEffect(() => {
    setPainChecks({});
  }, [challenge.id, difficulty]);

  const allPainChecked = useMemo(() => {
    if (requiredPainAreas.length === 0) return true;
    return requiredPainAreas.every((area) => painChecks[area] === "none");
  }, [requiredPainAreas, painChecks]);

  const hasPain = useMemo(
    () => requiredPainAreas.some((area) => painChecks[area] === "pain"),
    [requiredPainAreas, painChecks],
  );

  const numericValue = Number(submittedValue);
  const isNumberValid =
    submittedValue.length > 0 &&
    Number.isFinite(numericValue) &&
    numericValue > 0;

  const canSubmit =
    isNumberValid && allPainChecked && !hasPain && !pending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      const data = await submit.mutateAsync({
        challengeId: challenge.id,
        difficulty,
        submittedValue: numericValue,
        painCheckPassed: allPainChecked && !hasPain,
        note: note.trim() || null,
      });
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "챌린지 제출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setSubmittedValue("");
    setNote("");
    setPainChecks({});
  };

  // 통증 체크 누락된 영역 — 안내 표시용
  const missingPainAreas = requiredPainAreas.filter(
    (area) => painChecks[area] !== "none",
  );
  const PART_LABEL_KO: Record<string, string> = {
    wrist: "손목",
    shoulder: "어깨",
    knee: "무릎",
    back: "허리",
    ankle: "발목",
    elbow: "팔꿈치",
    hip: "고관절",
  };
  const missingPainLabel = missingPainAreas
    .map((a) => PART_LABEL_KO[a] ?? a)
    .join(", ");

  if (result) {
    const { status, daily_limit_reached } = result;
    const isCompleted = status === "completed" && !daily_limit_reached;

    let banner = {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      tone: "border-emerald-400/40 bg-emerald-400/10",
      title: "챌린지 클리어! 오늘의 라운드가 기록되었습니다.",
    };
    if (status === "completed" && daily_limit_reached) {
      banner = {
        icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        tone: "border-amber-400/40 bg-amber-400/10",
        title: "오늘 이 챌린지 보상은 모두 받았습니다. 기록은 남길 수 있어요.",
      };
    } else if (status === "rejected") {
      banner = {
        icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        tone: "border-amber-400/40 bg-amber-400/10",
        title: "통증 체크가 통과되지 않아 보상이 지급되지 않았습니다.",
      };
    } else if (status !== "completed") {
      banner = {
        icon: <XCircle className="h-5 w-5 text-destructive" />,
        tone: "border-destructive/40 bg-destructive/10",
        title: "이번 라운드는 데이터로 저장되었습니다. 다시 도전할 수 있어요.",
      };
    }

    return (
      <div className="space-y-3">
        <div className={`rounded-card border p-3.5 ${banner.tone}`}>
          <div className="flex items-center gap-2">
            {banner.icon}
            <p className="text-[13.5px] font-bold text-foreground">
              {banner.title}
            </p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {result.message}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              내 기록
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              {result.submitted_value} {unit}
            </p>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              목표
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              {result.target_value} {unit}
            </p>
          </div>
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

        {challenge.high_intensity && (
          <p className="text-[10.5px] leading-relaxed text-amber-600">
            ※ 고강도 챌린지는 하루 1회만 보상이 지급됩니다.
          </p>
        )}

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ QUEST XP 는 보조 경험치로, 공식 1~40 레벨업과 무관합니다. 파이트
          머니는 기존 지갑에 합산됩니다.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center justify-center gap-1.5 rounded-card bg-secondary py-3 text-[13px] font-bold text-secondary-foreground active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" /> 한 번 더 도전
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
          >
            {isCompleted ? "닫기" : "닫기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] text-muted-foreground active:scale-95"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 챌린지 목록
      </button>

      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
          오늘의 라운드
        </p>
        <p className="mt-1 text-[13.5px] font-bold text-foreground">
          {challenge.title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
          {challenge.description}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          정확한 자세가 빠른 기록보다 먼저입니다.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">난이도</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["beginner", "normal", "advanced"] as QuizDifficulty[]).map((d) => {
            const active = difficulty === d;
            const t = challenge.difficulty_targets?.[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-card border px-2 py-2 text-center text-[11.5px] transition-all active:scale-[0.99] ${
                  active
                    ? "border-primary bg-primary/10 text-foreground font-bold"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <p>{DIFFICULTY_LABEL[d]}</p>
                <p className="number-font mt-0.5 text-[10.5px]">
                  {t ?? "-"} {unit}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 flex items-center justify-between text-[11.5px] font-bold text-foreground">
          내 기록
          <span className="text-[10px] font-medium text-muted-foreground">
            목표 {targetValue} {unit}
            {rewardPreview &&
              ` · 보상 +${rewardPreview.quest_xp} XP / +${rewardPreview.gems}`}
          </span>
        </p>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={challenge.target_metric === "minutes" ? "0.1" : "1"}
          value={submittedValue}
          onChange={(e) => setSubmittedValue(e.target.value)}
          placeholder={`예: ${targetValue} ${unit}`}
          className="w-full rounded-card border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <SafetyCheckPanel
        required={requiredPainAreas}
        values={painChecks}
        onChange={setPainChecks}
      />

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          메모 <span className="text-muted-foreground font-normal">(선택)</span>
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="오늘의 라운드 한 줄 메모"
          rows={2}
          className="w-full resize-none rounded-card border border-border bg-card px-3 py-2 text-[12.5px] text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {requiredPainAreas.length > 0 && !allPainChecked && !hasPain && (
        <p className="text-[11px] text-amber-600">
          보상 지급을 위해 {missingPainLabel} 통증 없음 확인이 필요합니다.
        </p>
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
          ? "제출 중…"
          : !isNumberValid
            ? "기록 입력 필요"
            : hasPain
              ? "통증 있음 — 제출 불가"
              : !allPainChecked
                ? "통증 체크 필요"
                : "제출하기"}
      </button>
    </div>
  );
};

export default FunChallengeSubmitForm;
