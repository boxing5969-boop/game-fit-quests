import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Droplets, Footprints, Moon, Save, Utensils } from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useAuth } from "@/contexts/AuthContext";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import {
  clearTrackerDraft,
  loadTrackerDraft,
  saveTrackerDraft,
  useDailyLogPhotos,
  useSubmitDailyLog,
  useTodayDailyLog,
  useUploadMealPhoto,
  type DietTrackerDraft,
} from "@/hooks/useDietDailyLog";
import { useAttendanceToday } from "@/hooks/useDietAttendance";
import { useDietAnalytics } from "@/hooks/useDietAnalytics";
import { DIET_EVENT_TYPES } from "@/lib/diet/analytics";
import { DIET_STAGES } from "@/data/dietProgramData";
import { getDailyPlan } from "@/lib/diet/ruleEngine";
import type { DailyHabitsPayload } from "@/services/dietService";
import type { DietMealSlot, DietTrack } from "@/lib/dietTrack";

import DailyHabitCheckList from "@/components/diet/DailyHabitCheckList";
import DailyMissionList from "@/components/diet/DailyMissionList";
import DietMoodPicker from "@/components/diet/DietMoodPicker";
import DietPhotoUpload from "@/components/diet/DietPhotoUpload";
import { cn } from "@/lib/utils";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyHabits: DailyHabitsPayload = {
  water_ml: null,
  step_count: null,
  sleep_hours: null,
  protein_first: null,
  veggies_natural: null,
  sugary_drink_avoided: null,
  late_night_snack_avoided: null,
  gym_attended: null,
  mood: null,
  memo: null,
};

/**
 * /diet/tracker — 오늘의 데일리 체크인.
 *
 * 플로우
 *   1. 오늘 로그 조회 (없으면 빈 상태)
 *   2. 로컬 드래프트 머지 (네트워크 없어도 입력 유지)
 *   3. 5 습관 체크 + 수치 3종 + 기분 + 메모
 *   4. "저장" → submit_diet_daily_log → 성공 시 사진 슬롯 활성화
 *   5. 사진 슬롯 → storage upload + add_diet_log_photo
 *   6. "임시저장" 은 로컬 한정
 */
const DietTrackerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const progressQuery = useDietProgress();

  const logDate = todayIso();
  const payload = progressQuery.data;
  const hasActive =
    payload && "success" in payload && payload.success && payload.has_active;
  const enrollment = hasActive ? payload.enrollment! : null;
  const track: DietTrack | null = enrollment?.track ?? null;
  const currentDay = enrollment?.current_day ?? 1;
  const isYouth = track === "youth_habit";

  const todayPlan = useMemo(
    () => (track ? getDailyPlan(track, currentDay) : null),
    [track, currentDay],
  );

  const todayLogQuery = useTodayDailyLog(enrollment?.id, logDate);
  const logRow = todayLogQuery.data ?? null;
  const photosQuery = useDailyLogPhotos(logRow?.id);
  const submitMutation = useSubmitDailyLog();
  const photoMutation = useUploadMealPhoto();
  const attendanceQuery = useAttendanceToday(user?.id, logDate);
  const { logEvent } = useDietAnalytics();

  // ── 폼 상태 (habits + note) ────────────────────────────────
  const [habits, setHabits] = useState<DailyHabitsPayload>(emptyHabits);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // 최초 hydrate: server 우선 → 없으면 localStorage 드래프트
  useEffect(() => {
    if (hydrated) return;
    if (!user?.id || progressQuery.isLoading || todayLogQuery.isLoading) return;

    if (logRow) {
      setHabits({
        water_ml: logRow.water_ml ?? null,
        step_count: logRow.step_count ?? null,
        sleep_hours: logRow.sleep_hours ?? null,
        protein_first: logRow.protein_first,
        veggies_natural: logRow.veggies_natural,
        sugary_drink_avoided: logRow.sugary_drink_avoided,
        late_night_snack_avoided: logRow.late_night_snack_avoided,
        gym_attended: logRow.gym_attended,
        mood: logRow.mood,
        memo: logRow.memo,
      });
      setNote(logRow.memo ?? "");
    } else {
      const draft = loadTrackerDraft(user.id, logDate);
      if (draft) {
        setHabits(draft.habits);
        setNote(draft.note);
      }
    }
    setHydrated(true);
  }, [hydrated, user?.id, progressQuery.isLoading, todayLogQuery.isLoading, logRow, logDate]);

  // 입력 변경 시 local draft 저장 (submit 전까지만)
  useEffect(() => {
    if (!hydrated || !user?.id) return;
    if (logRow?.status === "approved") return; // 승인된 이후엔 드래프트 비활성
    const payloadDraft: DietTrackerDraft = { habits, note };
    saveTrackerDraft(user.id, logDate, payloadDraft);
  }, [habits, note, hydrated, user?.id, logDate, logRow?.status]);

  // 출석 브릿지 — 오늘 attendance_logs 있으면 gym_attended 를 true 초기값으로
  //             한 번만 자동 반영. 사용자가 수동 off 한 뒤 재덮어쓰기 금지.
  const [attendanceApplied, setAttendanceApplied] = useState(false);
  useEffect(() => {
    if (attendanceApplied) return;
    if (!hydrated) return;
    if (attendanceQuery.isLoading) return;
    if (!attendanceQuery.data) {
      setAttendanceApplied(true);
      return;
    }
    // 이미 true 가 아니면 자동 true 반영
    setHabits((h) =>
      h.gym_attended === true ? h : { ...h, gym_attended: true },
    );
    setAttendanceApplied(true);
  }, [hydrated, attendanceQuery.isLoading, attendanceQuery.data, attendanceApplied]);

  const handleSave = async () => {
    if (!enrollment) return;
    try {
      const r = await submitMutation.mutateAsync({
        logDate,
        habits: { ...habits, memo: note },
        note,
      });
      if (!r.success) {
        toast.error(mapSubmitError(r.error));
        return;
      }
      if (user?.id) clearTrackerDraft(user.id, logDate);
      toast.success("오늘의 체크인이 저장됐어요. 한 번 놓쳐도 다음 끼니부터 다시 시작!");
      void logEvent(DIET_EVENT_TYPES.DAILY_CHECKIN_COMPLETED, {
        log_id: r.log_id,
        day_number: r.day_number,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "저장 실패. 네트워크 상태 확인 후 다시 시도해 주세요.",
      );
    }
  };

  const handleSaveDraftOnly = () => {
    if (!user?.id) return;
    saveTrackerDraft(user.id, logDate, { habits, note });
    toast.success("임시저장 완료. 다음 방문 때 이어서 작성할 수 있어요.");
  };

  const handlePhoto = async (slot: DietMealSlot, blob: Blob) => {
    if (!user?.id || !logRow?.id) {
      toast.error("먼저 체크인을 저장해 주세요.");
      return;
    }
    await photoMutation.mutateAsync({
      userId: user.id,
      logId: logRow.id,
      logDate,
      mealSlot: slot,
      file: blob,
    });
    void logEvent(DIET_EVENT_TYPES.MEAL_PHOTO_UPLOADED, {
      log_id: logRow.id,
      meal_slot: slot,
    });
  };

  const stageLabel =
    DIET_STAGES.find((s) => s.id === enrollment?.current_stage)?.label ?? "";

  // ── 렌더 분기 ────────────────────────────────────────────
  if (progressQuery.isLoading) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12px] text-muted-foreground">
          불러오는 중...
        </div>
      </Shell>
    );
  }

  if (!hasActive || !enrollment) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-[13px] text-foreground">
            아직 진행 중인 153 다이어트 프로그램이 없어요.
          </p>
          <Button
            className="mt-3"
            onClick={() => navigate("/diet/onboarding")}
          >
            온보딩 시작하기
          </Button>
        </div>
      </Shell>
    );
  }

  const submitBusy = submitMutation.isPending;
  const isApproved = logRow?.status === "approved";

  return (
    <Shell>
      <div className="space-y-4">
        {/* 헤더 요약 */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {stageLabel}
              </p>
              <h2 className="mt-0.5 text-display-sm text-foreground leading-tight">
                Day {currentDay} 체크인
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {logDate} · 하루 1~2분이면 충분해요.
              </p>
            </div>
            {isApproved && (
              <span className="rounded-full bg-reward/15 px-2.5 py-1 text-[10px] font-black uppercase text-reward">
                승인 완료
              </span>
            )}
          </div>
        </div>

        {/* 오늘의 미션 (요약) */}
        {todayPlan && (
          <Section title="오늘의 미션" subtitle="해당 항목이 체크되면 자동 반영돼요">
            <DailyMissionList
              missions={todayPlan.missions}
              responses={habits}
              limit={5}
            />
          </Section>
        )}

        {/* 5 습관 체크 */}
        <Section title="오늘의 습관" subtitle="탭 한 번이면 on/off">
          <DailyHabitCheckList
            value={habits}
            onChange={setHabits}
            isYouth={isYouth}
          />
        </Section>

        {/* 수치 입력 3종 */}
        <Section title="오늘의 수치 (선택)" subtitle="비워둬도 괜찮아요">
          <div className="grid grid-cols-1 gap-2">
            <NumberInput
              icon={<Droplets className="h-3.5 w-3.5 text-primary" />}
              label="물 섭취"
              suffix="ml"
              step={100}
              min={0}
              max={10000}
              value={habits.water_ml ?? null}
              onChange={(v) => setHabits((h) => ({ ...h, water_ml: v }))}
            />
            <NumberInput
              icon={<Footprints className="h-3.5 w-3.5 text-primary" />}
              label="걸음 수"
              suffix="보"
              step={500}
              min={0}
              max={100000}
              value={habits.step_count ?? null}
              onChange={(v) => setHabits((h) => ({ ...h, step_count: v }))}
            />
            <NumberInput
              icon={<Moon className="h-3.5 w-3.5 text-primary" />}
              label="수면"
              suffix="시간"
              step={0.5}
              min={0}
              max={24}
              value={habits.sleep_hours ?? null}
              onChange={(v) => setHabits((h) => ({ ...h, sleep_hours: v }))}
              decimal
            />
          </div>
        </Section>

        {/* 기분 + 한 줄 회고 */}
        <Section title="오늘의 마무리">
          <div className="space-y-2.5">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
              기분
            </p>
            <DietMoodPicker
              value={habits.mood ?? null}
              onChange={(v) => setHabits((h) => ({ ...h, mood: v }))}
            />
            <p className="mt-2 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
              한 줄 회고
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              placeholder="한 끼 놓쳤다면 다음 끼니부터 다시 시작 — 오늘 느낀 점 간단히"
              className="min-h-[68px] rounded-xl text-[13px]"
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {note.length} / 200
            </p>
          </div>
        </Section>

        {/* 사진 업로드 (로그 저장 후 활성화) */}
        <Section title="식단 사진 (선택)" subtitle="촬영 즉시 업로드됩니다">
          <DietPhotoUpload
            photos={photosQuery.data ?? []}
            onUpload={handlePhoto}
            disabled={!logRow?.id}
          />
        </Section>

        {/* 저장 / 임시저장 */}
        <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraftOnly}
              className="h-11 rounded-2xl px-4"
              disabled={isApproved}
            >
              <Save className="mr-1 h-4 w-4" />
              임시저장
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitBusy || isApproved}
              className={cn(
                "ml-auto h-11 flex-1 rounded-2xl font-bold tracking-wide",
                "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
                "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
              )}
            >
              {submitBusy
                ? "저장 중..."
                : isApproved
                  ? "이미 승인된 기록"
                  : "오늘 체크인 저장"}
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
};

// ──────────────────────────────────────────────────────────────────
// 보조 컴포넌트
// ──────────────────────────────────────────────────────────────────
const Shell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <AppPage
      header={
        <PageHeader
          title="데일리 체크인"
          subtitle="1~2분이면 충분해요"
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
      <div className="pt-2">{children}</div>
    </AppPage>
  );
};

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <div className="flex items-baseline justify-between">
      <h3 className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
        <Utensils className="h-3.5 w-3.5 text-primary" />
        {title}
      </h3>
      {subtitle && (
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      )}
    </div>
    {children}
  </section>
);

const NumberInput = ({
  icon,
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
  max = 100000,
  decimal = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix: string;
  step?: number;
  min?: number;
  max?: number;
  decimal?: boolean;
}) => (
  <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
      {icon}
    </span>
    <span className="w-16 text-[12px] font-bold text-foreground">{label}</span>
    <Input
      type="number"
      inputMode={decimal ? "decimal" : "numeric"}
      step={step}
      min={min}
      max={max}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(null);
        const n = decimal ? parseFloat(raw) : parseInt(raw, 10);
        if (Number.isNaN(n)) return;
        onChange(Math.max(min, Math.min(max, n)));
      }}
      placeholder="—"
      className="h-9 rounded-lg text-right text-[13px] font-bold"
    />
    <span className="w-10 text-[11px] text-muted-foreground">{suffix}</span>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// 에러 맵핑
// ──────────────────────────────────────────────────────────────────
function mapSubmitError(code: string): string {
  if (code === "no_active_enrollment")
    return "진행 중인 프로그램이 없어요. 온보딩을 먼저 완료해 주세요.";
  if (code === "not_authenticated") return "로그인 후 다시 시도해 주세요.";
  return `저장 실패: ${code}`;
}

export default DietTrackerPage;
