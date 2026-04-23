import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Apple,
  Calendar,
  ChevronLeft,
  Droplets,
  Flame,
  Footprints,
  Moon,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/contexts/AuthContext";
import {
  useDietProgress,
  useEnrollDietProgram,
  useRecordSafetyScreening,
} from "@/hooks/useDietEnrollment";
import { useDietAnalytics } from "@/hooks/useDietAnalytics";
import { DIET_EVENT_TYPES } from "@/lib/diet/analytics";
import {
  DIET_CONSENT_VERSION,
  DIET_HABITS,
  DIET_STAGES,
  DIET_TRACK_HINT,
  DIET_TRACK_LABEL,
} from "@/data/dietProgramData";
import {
  computeAge,
  resolveTrackFromBirthDate,
  type DietTrack,
} from "@/lib/dietTrack";
import {
  hasAnyRisk,
  sanitizeTrackSelection,
  type DietRiskFlags,
} from "@/lib/diet/ruleEngine";
import DietOnboardingStep from "@/components/diet/DietOnboardingStep";
import DietConsentGate from "@/components/diet/DietConsentGate";
import DietTrackBadge from "@/components/diet/DietTrackBadge";
import DietRiskWarningBanner from "@/components/diet/DietRiskWarningBanner";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────
// 드래프트 타입 (로컬 저장 + 최종 제출 전 통합 상태)
// ──────────────────────────────────────────────────────────────────
type FrequencyLevel = "daily" | "weekly" | "rarely" | "never";
type CurrentGoal =
  | "habit_reset"
  | "weight_care"
  | "rhythm_recovery"
  | "performance";

interface DietOnboardingDraft {
  stepIndex: number; // 0..4
  // Screening
  goal?: CurrentGoal;
  exerciseDaysPerWeek?: number; // 0..7
  sleepHoursGoal?: number;      // 6..10
  sugaryDrinkFreq?: FrequencyLevel;
  lateSnackFreq?: FrequencyLevel;
  eatOutFreq?: FrequencyLevel;
  // Health flags
  pregnancyBreastfeeding?: boolean;
  takingOtherMedication?: boolean;       // UI 전용 (db: other_conditions 에 합쳐짐)
  diabetesMedication?: boolean;
  eatingDisorderRisk?: boolean;
  otherConditionsText?: string;
  // Consent
  consentAccepted?: boolean;
  // Start settings
  startDate?: string; // YYYY-MM-DD
}

const DRAFT_KEY_PREFIX = "diet_onboarding_draft_v1";
const TOTAL_STEPS = 5;

const GOAL_OPTIONS: { id: CurrentGoal; label: string; hint: string }[] = [
  { id: "habit_reset", label: "습관 리셋", hint: "무너진 식사 리듬 되돌리기" },
  { id: "weight_care", label: "체중 관리", hint: "극단 감량 아닌 지속 가능한 페이스" },
  { id: "rhythm_recovery", label: "생활 리듬 회복", hint: "수면·활동·식사 밸런스" },
  { id: "performance", label: "운동 퍼포먼스", hint: "복싱·근력을 위한 식단 정비" },
];

const FREQ_OPTIONS: { id: FrequencyLevel; label: string }[] = [
  { id: "daily", label: "거의 매일" },
  { id: "weekly", label: "주 1~3회" },
  { id: "rarely", label: "월 1~3회" },
  { id: "never", label: "거의 없음" },
];

function loadDraft(userId: string): DietOnboardingDraft {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // 파싱 실패 시 기본값으로 fallback
  }
  return { stepIndex: 0 };
}

function saveDraft(userId: string, draft: DietOnboardingDraft) {
  try {
    localStorage.setItem(
      `${DRAFT_KEY_PREFIX}_${userId}`,
      JSON.stringify(draft),
    );
  } catch {
    // storage quota 초과 등 — 무시 (UI 는 state 로 유지됨)
  }
}

function clearDraft(userId: string) {
  try {
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}_${userId}`);
  } catch {
    // storage 접근 실패 시 무시 — draft 없어도 온보딩은 정상 종료
  }
}

const todayIso = () => {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

const DietOnboardingPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const progressQuery = useDietProgress();
  const recordScreening = useRecordSafetyScreening();
  const enroll = useEnrollDietProgram();
  const { logEvent } = useDietAnalytics();

  const [draft, setDraft] = useState<DietOnboardingDraft>({ stepIndex: 0 });
  const [submitting, setSubmitting] = useState(false);

  // 드래프트 로드 (최초 마운트)
  useEffect(() => {
    if (!user?.id) return;
    const loaded = loadDraft(user.id);
    setDraft((prev) => ({ ...prev, ...loaded }));
  }, [user?.id]);

  // 드래프트 저장 (변경 시)
  useEffect(() => {
    if (!user?.id) return;
    saveDraft(user.id, draft);
  }, [draft, user?.id]);

  // 이미 active enrollment 가 있으면 허브로 이동
  useEffect(() => {
    const payload = progressQuery.data;
    if (payload && "success" in payload && payload.success && payload.has_active) {
      navigate("/diet", { replace: true });
    }
  }, [progressQuery.data, navigate]);

  // 나이·트랙 자동 계산
  const age = useMemo(
    () => computeAge(profile?.birth_date ?? null),
    [profile?.birth_date],
  );
  const autoTrack: DietTrack | null = useMemo(
    () => resolveTrackFromBirthDate(profile?.birth_date ?? null),
    [profile?.birth_date],
  );
  const isYouth = autoTrack === "youth_habit";

  const riskFlags: DietRiskFlags = useMemo(
    () => ({
      pregnancyBreastfeeding: !!draft.pregnancyBreastfeeding,
      diabetesMedication: !!draft.diabetesMedication,
      eatingDisorderRisk: !!draft.eatingDisorderRisk,
      otherConditions: buildOtherConditions(draft),
    }),
    [draft],
  );

  // 최종 트랙 (서버가 또 한번 강제하지만 UI 에서 미리 표시)
  const finalTrack: DietTrack | null = useMemo(() => {
    if (!autoTrack) return null;
    return sanitizeTrackSelection(autoTrack, {
      isYouth,
      risk: riskFlags,
      coachApproved: false,
      consentAccepted: !!draft.consentAccepted,
    });
  }, [autoTrack, isYouth, riskFlags, draft.consentAccepted]);

  const goToStep = useCallback(
    (next: number) =>
      setDraft((d) => ({ ...d, stepIndex: Math.max(0, Math.min(TOTAL_STEPS - 1, next)) })),
    [],
  );

  const handleBack = () => goToStep(draft.stepIndex - 1);

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      // 1) Screening 기록
      const screen = await recordScreening.mutateAsync({
        pregnancyBreastfeeding: !!draft.pregnancyBreastfeeding,
        diabetesMedication: !!draft.diabetesMedication,
        eatingDisorderRisk: !!draft.eatingDisorderRisk,
        otherConditions: buildOtherConditions(draft),
        consentAccepted: !!draft.consentAccepted,
        consentVersion: DIET_CONSENT_VERSION,
      });
      if (!screen.success) {
        toast.error(mapScreeningError(screen.error));
        return;
      }
      // 2) Enrollment
      const enrolled = await enroll.mutateAsync({
        screeningId: screen.screening_id,
      });
      if (!enrolled.success) {
        toast.error(mapEnrollError(enrolled.error));
        return;
      }
      // 3) 분석 이벤트 (best-effort)
      void logEvent(DIET_EVENT_TYPES.ENROLLMENT_STARTED, {
        enrollment_id: enrolled.enrollment_id,
        track: enrolled.track,
        is_youth: screen.is_youth,
      });
      void logEvent(DIET_EVENT_TYPES.ONBOARDING_COMPLETED, {
        enrollment_id: enrolled.enrollment_id,
      });
      // 4) 드래프트 정리 + 완료 이동
      clearDraft(user.id);
      toast.success("153 다이어트 프로그램 시작! 첫 체크인을 기록해보세요.");
      navigate("/diet", { replace: true });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "온보딩 제출에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 스텝별 검증
  // 규칙: UI 에 "이미 기본값이 보이는" 필드는 별도 터치 없이도 통과시킨다.
  //      (NumberPicker 는 ?? 3 · ?? 7, startDate 는 ?? todayIso 로 화면에 값이 이미 있음.)
  //      사용자 혼란 방지: "보이는 값을 또 눌러야 다음으로 가는" 문제 해소.
  const canNextFromStep = useCallback(
    (idx: number) => {
      if (idx === 0) return true;
      if (idx === 1) return true;
      if (idx === 2) {
        // 명시 선택이 필요한 것만 검증 — 목표 + 3개 빈도
        return (
          !!draft.goal &&
          !!draft.sugaryDrinkFreq &&
          !!draft.lateSnackFreq &&
          !!draft.eatOutFreq
        );
      }
      if (idx === 3) return !!draft.consentAccepted;
      if (idx === 4) return true; // 시작일은 오늘이 기본 — 변경 없이도 진행 가능
      return false;
    },
    [draft],
  );

  // 스텝 진입 시 "보이는 기본값" 을 실제 state 에 하이드레이션 — submit payload 일관성 유지.
  useEffect(() => {
    if (draft.stepIndex === 2) {
      setDraft((d) => ({
        ...d,
        exerciseDaysPerWeek: d.exerciseDaysPerWeek ?? 3,
        sleepHoursGoal: d.sleepHoursGoal ?? 7,
      }));
    }
    if (draft.stepIndex === 4) {
      setDraft((d) => ({
        ...d,
        startDate: d.startDate ?? todayIso(),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.stepIndex]);

  return (
    <AppPage
      header={
        <PageHeader
          title="153 다이어트 온보딩"
          subtitle="3분이면 시작 준비 완료"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="돌아가기"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="pt-2">
        {draft.stepIndex === 0 && (
          <StepIntro
            onNext={() => goToStep(1)}
          />
        )}

        {draft.stepIndex === 1 && (
          <StepStages
            onBack={handleBack}
            onNext={() => goToStep(2)}
          />
        )}

        {draft.stepIndex === 2 && (
          <StepScreening
            draft={draft}
            age={age}
            isYouth={isYouth}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onBack={handleBack}
            onNext={() => goToStep(3)}
            canNext={canNextFromStep(2)}
          />
        )}

        {draft.stepIndex === 3 && (
          <StepConsent
            consentAccepted={!!draft.consentAccepted}
            isYouth={isYouth}
            riskFlags={riskFlags}
            onChange={(v) => setDraft((d) => ({ ...d, consentAccepted: v }))}
            onBack={handleBack}
            onNext={() => goToStep(4)}
            canNext={canNextFromStep(3)}
          />
        )}

        {draft.stepIndex === 4 && (
          <StepStart
            draft={draft}
            finalTrack={finalTrack}
            submitting={submitting}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onBack={handleBack}
            onSubmit={handleSubmit}
            canNext={canNextFromStep(4)}
          />
        )}
      </div>
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// Step 1 — 소개
// ──────────────────────────────────────────────────────────────────
const StepIntro = ({ onNext }: { onNext: () => void }) => (
  <DietOnboardingStep
    stepIndex={0}
    totalSteps={TOTAL_STEPS}
    title="체지방을 제거하는 몸 습관, 21일"
    subtitle="숫자로 살을 재는 21일이 아니라, 체지방이 잘 붙지 않는 몸을 만드는 습관 프로그램입니다."
    onNext={onNext}
  >
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-[13px] font-bold text-foreground">단 하나의 목표</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            체중 숫자보다 식사 리듬·출석·회복 습관을 꾸준히 쌓기.
          </p>
        </div>
      </div>
    </div>

    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        매일 지킬 5 습관
      </p>
      <ul className="space-y-1.5">
        {DIET_HABITS.map((h) => (
          <li
            key={h.key}
            className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2"
          >
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
              {h.order}
            </span>
            <div>
              <p className="text-[13px] font-bold text-foreground">{h.label}</p>
              <p className="text-[11.5px] text-muted-foreground">{h.prompt}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>

    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        3단계 × 7일 = 21일
      </p>
      <div className="grid grid-cols-3 gap-2">
        {DIET_STAGES.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-border bg-card p-2.5 text-center"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              {s.label}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
              Day {s.dayRange[0]}~{s.dayRange[1]}
            </p>
          </div>
        ))}
      </div>
    </div>
  </DietOnboardingStep>
);

// ──────────────────────────────────────────────────────────────────
// Step 2 — 단계 안내 + 랭킹 철학
// ──────────────────────────────────────────────────────────────────
const StepStages = ({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) => (
  <DietOnboardingStep
    stepIndex={1}
    totalSteps={TOTAL_STEPS}
    title="단계별 무엇을 하나요?"
    subtitle="체중 랭킹이 아니라 습관 수행률로 함께 갑니다."
    onBack={onBack}
    onNext={onNext}
  >
    <ul className="space-y-3">
      {DIET_STAGES.map((s) => (
        <li
          key={s.id}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
              {s.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Day {s.dayRange[0]}~{s.dayRange[1]}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] font-bold text-foreground">
            {s.tagline}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {stageBody(s.id)}
          </p>
        </li>
      ))}
    </ul>

    <div className="rounded-2xl border border-accent/25 bg-accent/5 p-3">
      <p className="text-[12px] font-bold text-accent">랭킹 철학</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        체중 숫자는 공개되지 않습니다. 코치 승인 기반 <b>습관 수행률</b>·연속일·최고 스트릭만 랭킹에 반영됩니다.
      </p>
    </div>
  </DietOnboardingStep>
);

function stageBody(stage: string): string {
  if (stage === "reset") return "식사 시간 고정·당 음료 줄이기·저녁 과식 멈춤·가벼운 걷기부터 시작합니다.";
  if (stage === "burning") return "단백질+채소 한 끼, 걸음·근력 목표로 생활 활동량을 올립니다.";
  return "외식·무너진 끼니 이후 바로 복귀 연습. 21일 이후 유지 플랜을 고릅니다.";
}

// ──────────────────────────────────────────────────────────────────
// Step 3 — 사전 체크 (Screening + baseline)
// ──────────────────────────────────────────────────────────────────
const StepScreening = ({
  draft,
  age,
  isYouth,
  onChange,
  onBack,
  onNext,
  canNext,
}: {
  draft: DietOnboardingDraft;
  age: number | null;
  isYouth: boolean;
  onChange: (patch: Partial<DietOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) => (
  <DietOnboardingStep
    stepIndex={2}
    totalSteps={TOTAL_STEPS}
    title="현재 내 모습 알려주세요"
    subtitle="체중 입력은 없습니다. 체크박스 중심 1분."
    onBack={onBack}
    onNext={onNext}
    nextDisabled={!canNext}
  >
    {/* 연령 요약 */}
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UserCheck className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-muted-foreground">자동 판정</p>
        <p className="truncate text-[13px] font-bold text-foreground">
          {age === null ? "생년월일 미등록" : `만 ${age}세`}
          {isYouth && <span className="ml-1 text-primary">· 청소년 트랙</span>}
          {!isYouth && age !== null && <span className="ml-1 text-primary">· 성인 트랙</span>}
        </p>
      </div>
    </div>

    {age === null && (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-foreground">
        생년월일이 프로필에 등록되어 있지 않습니다. 마이페이지 → 프로필 수정에서 먼저 입력해 주세요.
      </div>
    )}

    {/* 목표 */}
    <FieldLabel icon={<Flame className="h-3.5 w-3.5" />} label="이번 21일의 목표" />
    <RadioGroup
      value={draft.goal}
      onValueChange={(v) => onChange({ goal: v as CurrentGoal })}
      className="grid grid-cols-2 gap-2"
    >
      {GOAL_OPTIONS.map((g) => (
        <PickCard
          key={g.id}
          active={draft.goal === g.id}
          title={g.label}
          hint={g.hint}
          control={<RadioGroupItem value={g.id} className="sr-only" id={`goal-${g.id}`} />}
          labelFor={`goal-${g.id}`}
        />
      ))}
    </RadioGroup>

    {/* 운동 요일 */}
    <FieldLabel icon={<Footprints className="h-3.5 w-3.5" />} label="운동 가능 요일 수 / 주" />
    <NumberPicker
      min={0}
      max={7}
      value={draft.exerciseDaysPerWeek ?? 3}
      onChange={(v) => onChange({ exerciseDaysPerWeek: v })}
      suffix="일"
    />

    {/* 수면 목표 */}
    <FieldLabel icon={<Moon className="h-3.5 w-3.5" />} label="수면 목표 시간" />
    <NumberPicker
      min={6}
      max={10}
      value={draft.sleepHoursGoal ?? 7}
      onChange={(v) => onChange({ sleepHoursGoal: v })}
      suffix="시간"
    />

    {/* 빈도 3종 */}
    <FieldLabel icon={<Droplets className="h-3.5 w-3.5" />} label="당 음료 빈도" />
    <FrequencyRow
      value={draft.sugaryDrinkFreq}
      onChange={(v) => onChange({ sugaryDrinkFreq: v })}
    />
    <FieldLabel icon={<Moon className="h-3.5 w-3.5" />} label="늦은 야식 빈도" />
    <FrequencyRow
      value={draft.lateSnackFreq}
      onChange={(v) => onChange({ lateSnackFreq: v })}
    />
    <FieldLabel icon={<Apple className="h-3.5 w-3.5" />} label="외식 빈도" />
    <FrequencyRow
      value={draft.eatOutFreq}
      onChange={(v) => onChange({ eatOutFreq: v })}
    />

    {/* 건강 주의 */}
    <FieldLabel icon={<Sparkles className="h-3.5 w-3.5" />} label="건강 주의 사항" />
    <div className="space-y-1.5">
      <HealthCheckRow
        checked={!!draft.pregnancyBreastfeeding}
        onChange={(v) => onChange({ pregnancyBreastfeeding: v })}
        label="임신 또는 수유 중"
      />
      <HealthCheckRow
        checked={!!draft.takingOtherMedication}
        onChange={(v) => onChange({ takingOtherMedication: v })}
        label="약을 복용 중 (감기약·영양제 제외)"
      />
      <HealthCheckRow
        checked={!!draft.diabetesMedication}
        onChange={(v) => onChange({ diabetesMedication: v })}
        label="당뇨·혈당 관련해 관리 또는 복약 중"
      />
      <HealthCheckRow
        checked={!!draft.eatingDisorderRisk}
        onChange={(v) => onChange({ eatingDisorderRisk: v })}
        label="섭식장애 또는 식사 관련 치료 경험이 있음"
      />
      <div className="rounded-xl border border-border bg-card p-2.5">
        <p className="text-[12px] text-muted-foreground mb-1.5">기타 건강상 주의</p>
        <Input
          placeholder="예: 고혈압 관리 중 (없으면 비워두세요)"
          value={draft.otherConditionsText ?? ""}
          onChange={(e) => onChange({ otherConditionsText: e.target.value })}
          className="rounded-xl text-[13px]"
        />
      </div>
    </div>
  </DietOnboardingStep>
);

// ──────────────────────────────────────────────────────────────────
// Step 4 — 동의 및 안내
// ──────────────────────────────────────────────────────────────────
const StepConsent = ({
  consentAccepted,
  isYouth,
  riskFlags,
  onChange,
  onBack,
  onNext,
  canNext,
}: {
  consentAccepted: boolean;
  isYouth: boolean;
  riskFlags: DietRiskFlags;
  onChange: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) => (
  <DietOnboardingStep
    stepIndex={3}
    totalSteps={TOTAL_STEPS}
    title="안내와 동의"
    subtitle="의료 진단·치료 앱이 아닌 일반 건강관리용 습관 프로그램입니다."
    onBack={onBack}
    onNext={onNext}
    nextDisabled={!canNext}
  >
    {(hasAnyRisk(riskFlags) || isYouth) && (
      <DietRiskWarningBanner risk={riskFlags} isYouth={isYouth} />
    )}
    <DietConsentGate
      accepted={consentAccepted}
      onChange={onChange}
      isYouth={isYouth}
    />
  </DietOnboardingStep>
);

// ──────────────────────────────────────────────────────────────────
// Step 5 — 시작 설정
// ──────────────────────────────────────────────────────────────────
const StepStart = ({
  draft,
  finalTrack,
  submitting,
  onChange,
  onBack,
  onSubmit,
  canNext,
}: {
  draft: DietOnboardingDraft;
  finalTrack: DietTrack | null;
  submitting: boolean;
  onChange: (patch: Partial<DietOnboardingDraft>) => void;
  onBack: () => void;
  onSubmit: () => void;
  canNext: boolean;
}) => {
  const startLabel = draft.startDate ?? todayIso();

  return (
    <DietOnboardingStep
      stepIndex={4}
      totalSteps={TOTAL_STEPS}
      title="시작 준비 완료"
      subtitle="시작일을 골라 주세요. 코치 배정은 자동으로 진행됩니다."
      onBack={onBack}
      onNext={onSubmit}
      nextLabel="시작하기"
      nextDisabled={!canNext || submitting}
      nextPending={submitting}
    >
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {/* 트랙 표시 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              배정된 트랙
            </p>
            <p className="mt-0.5 text-[13px] font-bold text-foreground">
              {finalTrack ? DIET_TRACK_LABEL[finalTrack] : "결정 중"}
            </p>
          </div>
          <DietTrackBadge track={finalTrack} />
        </div>
        {finalTrack && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {DIET_TRACK_HINT[finalTrack]}
          </p>
        )}
        <div className="rounded-xl bg-muted/50 p-2.5 text-[11.5px] text-muted-foreground">
          코치는 지점 기준으로 자동 배정됩니다. 지점 변경 또는 수동 매칭이 필요하면 설정에서 요청해 주세요.
        </div>
      </div>

      {/* 시작일 */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <p className="text-[13px] font-bold text-foreground">시작일</p>
        </div>
        <Input
          type="date"
          value={startLabel}
          min={todayIso()}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className="rounded-xl"
        />
        <p className="text-[11px] text-muted-foreground">
          선택한 날부터 Day 1 이 시작됩니다.
        </p>
      </div>
    </DietOnboardingStep>
  );
};

// ──────────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────────
const FieldLabel = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => (
  <Label className="mt-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
    {icon}
    {label}
  </Label>
);

const PickCard = ({
  active,
  title,
  hint,
  control,
  labelFor,
}: {
  active: boolean;
  title: string;
  hint: string;
  control: React.ReactNode;
  labelFor: string;
}) => (
  <label
    htmlFor={labelFor}
    className={cn(
      "cursor-pointer rounded-xl border p-3 transition-colors",
      active
        ? "border-primary bg-primary/10 shadow-[0_0_0_2px_rgba(217,54,32,0.15)]"
        : "border-border bg-card hover:border-primary/50",
    )}
  >
    {control}
    <p className="text-[13px] font-bold text-foreground">{title}</p>
    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
      {hint}
    </p>
  </label>
);

const NumberPicker = ({
  min,
  max,
  value,
  onChange,
  suffix,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) => (
  <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 w-9 rounded-full p-0"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
    >
      −
    </Button>
    <div className="flex-1 text-center text-[15px] font-bold text-foreground">
      {value}
      <span className="ml-0.5 text-[12px] text-muted-foreground">{suffix}</span>
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 w-9 rounded-full p-0"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
    >
      +
    </Button>
  </div>
);

const FrequencyRow = ({
  value,
  onChange,
}: {
  value: FrequencyLevel | undefined;
  onChange: (v: FrequencyLevel) => void;
}) => (
  <div className="grid grid-cols-4 gap-1.5">
    {FREQ_OPTIONS.map((f) => (
      <button
        key={f.id}
        type="button"
        onClick={() => onChange(f.id)}
        className={cn(
          "rounded-xl border px-2 py-2 text-[12px] font-bold transition-colors",
          value === f.id
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground hover:border-primary/40",
        )}
      >
        {f.label}
      </button>
    ))}
  </div>
);

const HealthCheckRow = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
  <label
    className={cn(
      "flex cursor-pointer items-start gap-2.5 rounded-xl border bg-card p-3 transition-colors",
      checked ? "border-destructive/40 bg-destructive/5" : "border-border",
    )}
  >
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      className="mt-0.5"
    />
    <span className="text-[13px] text-foreground leading-relaxed">{label}</span>
  </label>
);

// ──────────────────────────────────────────────────────────────────
// Mappers
// ──────────────────────────────────────────────────────────────────

/**
 * UI 의 "약 복용 중" (일반) 체크와 "기타 건강 주의" 텍스트를
 * 단일 other_conditions 문자열로 합쳐 서버 RPC 로 전달.
 */
function buildOtherConditions(d: DietOnboardingDraft): string | null {
  const parts: string[] = [];
  if (d.takingOtherMedication && !d.diabetesMedication) {
    parts.push("복용 중인 약이 있음");
  }
  const extra = (d.otherConditionsText ?? "").trim();
  if (extra) parts.push(extra);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function mapScreeningError(code: string): string {
  if (code === "consent_required") return "동의 항목을 체크해 주세요.";
  if (code === "birth_date_missing")
    return "생년월일을 먼저 프로필에 등록해 주세요.";
  if (code === "not_authenticated") return "로그인 후 다시 시도해 주세요.";
  return `사전 체크 저장 실패: ${code}`;
}

function mapEnrollError(code: string): string {
  if (code === "already_enrolled")
    return "이미 진행 중인 다이어트 프로그램이 있습니다.";
  if (code === "consent_not_accepted") return "동의를 완료해 주세요.";
  if (code === "screening_not_found") return "사전 체크 정보를 찾지 못했습니다.";
  if (code === "not_authenticated") return "로그인 후 다시 시도해 주세요.";
  return `프로그램 시작 실패: ${code}`;
}

export default DietOnboardingPage;
