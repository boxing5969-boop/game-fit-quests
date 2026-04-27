import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Droplets, Footprints, Moon, Save, Sparkles, Utensils } from "lucide-react";

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
import { useRecordQuestEvent } from "@/hooks/useDietQuestEvents";
import { DIET_EVENT_TYPES } from "@/lib/diet/analytics";
import { DIET_STAGES } from "@/data/dietProgramData";
import { getDailyPlan } from "@/lib/diet/ruleEngine";
import {
  computeQuestScore,
  diffHabitsForEmission,
  gradeTiming,
  type QuestSourceKind,
} from "@/lib/diet/questEvents";
import {
  calcQuestScore,
  gradeTimingBySlot,
  type QuestSlotKey,
  type TimingGrade,
} from "@/lib/diet/questTimingEngine";
import {
  getQuestMessage,
  makeMessageSeed,
  type QuestMessageType,
} from "@/lib/diet/questMessageEngine";
import { syncQuestCheckin } from "@/services/challengeService";
import type { DietMissionTemplate } from "@/data/diet/missionTemplates";
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
  const recordQuestEvent = useRecordQuestEvent();
  const { logEvent } = useDietAnalytics();

  // ── 추가: 미션 완료 / slot / 점수 derived helpers ──────────────
  const isMissionCompleted = (
    m: DietMissionTemplate,
    h: DailyHabitsPayload,
  ): boolean => {
    const linked = m.linkedHabitColumn;
    const waterHit =
      m.waterMlThreshold !== undefined &&
      (h.water_ml ?? 0) >= m.waterMlThreshold;
    const habitHit = linked ? h[linked] === true : false;
    return waterHit || habitHit;
  };

  const inferSlotForMission = (m: DietMissionTemplate): QuestSlotKey => {
    if (m.waterMlThreshold !== undefined) return "water";
    if (m.linkedHabitColumn === "gym_attended") return "workout";
    if (m.linkedHabitColumn === "late_night_snack_avoided") return "dinner";
    if (m.linkedHabitColumn === "sugary_drink_avoided") return "water";
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    });
    const h = Number(
      fmt.formatToParts(new Date()).find((p) => p.type === "hour")?.value ??
        "0",
    );
    const hh = h === 24 ? 0 : h;
    if (hh < 11) return "breakfast";
    if (hh < 17) return "lunch";
    return "dinner";
  };

  // 추가: quest event insert 헬퍼 — 메인 흐름 절대 막지 않도록 try/catch
  const insertQuestEvent = (params: {
    sourceKind: QuestSourceKind;
    mission?: DietMissionTemplate | null;
    missionId?: string;
    missionLabel?: string;
    isCore?: boolean;
    mealSlot?: string | null;
    timingGrade?: TimingGrade;
    completedAt?: Date;
    allDone?: boolean;
    isComeback?: boolean;
    meta?: Record<string, unknown>;
  }) => {
    try {
      if (!user?.id || !enrollment) return;
      const completedAt = params.completedAt ?? new Date();
      const slotForGrade: QuestSlotKey = params.mission
        ? inferSlotForMission(params.mission)
        : (params.mealSlot as QuestSlotKey | null) ?? "snack";
      const grade =
        params.timingGrade ?? gradeTimingBySlot(slotForGrade, completedAt);
      const isCore =
        params.isCore ?? params.mission?.severity === "core" ?? false;
      const score = calcQuestScore({
        isCore,
        timingGrade: grade,
        allDone: params.allDone,
        isComeback: params.isComeback,
      });
      const missionId = params.missionId ?? params.mission?.id ?? "";
      const missionLabel = params.missionLabel ?? params.mission?.label ?? "";
      if (!missionId) return;
      recordQuestEvent.mutate({
        userId: user.id,
        enrollmentId: enrollment.id,
        logDate,
        dayNumber: currentDay,
        missionId,
        missionLabel,
        sourceKind: params.sourceKind,
        mealSlot: params.mealSlot ?? null,
        completedAt,
        timingGrade: grade,
        baseScore: score.baseScore,
        timingBonus: score.timingBonus,
        totalScore: score.total,
        meta: {
          ...(params.mission?.category
            ? { category: params.mission.category }
            : {}),
          ...(params.mission?.severity
            ? { severity: params.mission.severity }
            : {}),
          ...(params.mission?.linkedHabitColumn
            ? { linkedHabitColumn: params.mission.linkedHabitColumn }
            : {}),
          ...(params.meta ?? {}),
        },
      });
    } catch (err) {
      // 절대 메인 흐름을 막지 않음 — 콘솔만 남김
      // eslint-disable-next-line no-console
      console.warn("[DietTracker] insertQuestEvent failed", err);
    }
  };

  // ── 폼 상태 (habits + note) ────────────────────────────────
  const [habits, setHabits] = useState<DailyHabitsPayload>(emptyHabits);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // 추가: 진행률 / 점수 / 코치 메시지 (optimistic — habits 변경 즉시 반영)
  // habits useState 이후에 선언해야 TDZ 안 걸림.
  const completedCount = useMemo(() => {
    if (!todayPlan) return 0;
    return todayPlan.missions.reduce(
      (acc, m) => acc + (isMissionCompleted(m, habits) ? 1 : 0),
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayPlan, habits]);
  const totalCount = todayPlan?.missions.length ?? 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const todayQuestScore = useMemo(() => {
    if (!todayPlan) return 0;
    return todayPlan.missions.reduce((acc, m) => {
      if (!isMissionCompleted(m, habits)) return acc;
      const slot = inferSlotForMission(m);
      const grade = gradeTimingBySlot(slot);
      const s = calcQuestScore({
        isCore: m.severity === "core",
        timingGrade: grade,
      });
      return acc + s.total;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayPlan, habits]);

  const coachMessageType: QuestMessageType = (() => {
    if (totalCount === 0) return "morning_start";
    if (allDone) return "all_done";
    if (completedCount === 0) return "morning_start";
    if (completedCount === totalCount - 1) return "almost_done";
    return "incomplete_nudge";
  })();
  const coachMessage = useMemo(() => {
    const seed = makeMessageSeed(user?.id ?? null, coachMessageType);
    return getQuestMessage({
      type: coachMessageType,
      remainingCount: Math.max(0, totalCount - completedCount),
      todayScore: todayQuestScore,
      seed,
    });
  }, [user?.id, coachMessageType, totalCount, completedCount, todayQuestScore]);

  // 저장 후 all_done 토스트는 1회만 — 화면 갱신마다 반복 차단
  const [allDoneToastShown, setAllDoneToastShown] = useState(false);
  useEffect(() => {
    if (!allDone) setAllDoneToastShown(false);
  }, [allDone]);

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

  // 입력 변경 시 local draft 저장 — 자가 기록 모드에서는 제출 이후에도
  // 언제든 재수정 가능하므로 항상 드래프트를 유지한다.
  useEffect(() => {
    if (!hydrated || !user?.id) return;
    const payloadDraft: DietTrackerDraft = { habits, note };
    saveTrackerDraft(user.id, logDate, payloadDraft);
  }, [habits, note, hydrated, user?.id, logDate]);

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

      if (r.first_submit) {
        const bonus = r.bonus_gems ?? 0;
        const base = r.granted_gems ?? 0;
        const total = base + bonus;
        toast.success(
          bonus > 0
            ? `🥊 21일 완주! 파이트 머니 +${total} (기본 ${base} · 보너스 ${bonus})`
            : `🥊 기록 완료! 파이트 머니 +${total}`,
        );
      } else {
        toast.success("오늘 기록이 업데이트됐어요. 언제든 다시 수정 가능합니다.");
      }

      void logEvent(DIET_EVENT_TYPES.DAILY_CHECKIN_COMPLETED, {
        log_id: r.log_id,
        day_number: r.day_number,
        first_submit: r.first_submit,
      });

      // diet_quest_events emit — 새로 체크된 미션만 1행씩 시계열 적재.
      // 보호 함수(scoreEngine/ruleEngine)는 건들지 않고 신규 모듈에서 점수 산출.
      if (todayPlan && user?.id) {
        const diff = diffHabitsForEmission({
          prev: logRow,
          next: { ...habits, memo: note },
          missions: todayPlan.missions,
        });
        const completedAt = new Date();
        const grade = gradeTiming(completedAt);
        for (const entry of diff) {
          const score = computeQuestScore(entry.mission.severity, grade);
          recordQuestEvent.mutate({
            userId: user.id,
            enrollmentId: enrollment.id,
            logDate,
            dayNumber: r.day_number ?? currentDay,
            missionId: entry.mission.id,
            missionLabel: entry.mission.label,
            sourceKind: "habit",
            mealSlot: null,
            completedAt,
            timingGrade: grade,
            baseScore: score.base,
            timingBonus: score.bonus,
            totalScore: score.total,
            meta: {
              category: entry.mission.category,
              severity: entry.mission.severity,
              linkedHabitColumn: entry.mission.linkedHabitColumn ?? null,
            },
          });
        }
      }

      // 저장 후 — 전체 미션 완료 시 오삼 코치 all_done 메시지 1회 표시.
      if (allDone && !allDoneToastShown) {
        const seed = makeMessageSeed(user?.id ?? null, "all_done");
        const allDoneMsg = getQuestMessage({
          type: "all_done",
          todayScore: todayQuestScore,
          seed,
        });
        toast.success(`🏆 ${allDoneMsg}`);
        setAllDoneToastShown(true);
      }

      // 챌린지 동기화 — 새로 체크된 미션이 1개라도 있으면 mission 종류로 1회.
      // 하루 중복은 syncQuestCheckin 내부에서 dedup.
      if (user?.id && todayPlan) {
        const newlyChecked = diffHabitsForEmission({
          prev: logRow,
          next: { ...habits, memo: note },
          missions: todayPlan.missions,
        });
        if (newlyChecked.length > 0) {
          void syncQuestCheckin({
            userId: user.id,
            kind: "mission",
            points: 3,
          });
        }
      }
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

    // 추가: 사진 인증 quest event(source_kind='photo') + 오삼 코치 칭찬 토스트.
    // mealSlot 은 식사 슬롯명(breakfast/lunch/dinner/snack) 그대로 사용.
    const slotForGrade: QuestSlotKey =
      (slot as QuestSlotKey) ?? ("snack" as QuestSlotKey);
    const completedAt = new Date();
    const grade = gradeTimingBySlot(slotForGrade, completedAt);
    insertQuestEvent({
      sourceKind: "photo",
      missionId: `photo:${slot}`,
      missionLabel: `식단 사진 인증 (${slot})`,
      isCore: false,
      mealSlot: slot,
      timingGrade: grade,
      completedAt,
      meta: { from: "handlePhoto" },
    });
    const seed = makeMessageSeed(
      user.id,
      grade === "perfect" ? "perfect_complete" : "mission_complete",
      completedAt,
    );
    const praise = getQuestMessage({
      type: grade === "perfect" ? "perfect_complete" : "mission_complete",
      completedMissionLabel: `사진 인증 · ${slot}`,
      timingGrade: grade,
      seed,
    });
    toast.success(praise);

    // 챌린지 동기화 — active challenge 참여 중일 때만, 같은 kind/오늘 중복 skip.
    void syncQuestCheckin({
      userId: user.id,
      kind: "photo",
      points: 2,
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
  // 자가 기록 모드 — 이미 제출한 적 있는지 여부(UX 문구용). 수정은 언제든 허용.
  const hasRecord = !!logRow?.id;

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
            {hasRecord && (
              <span className="rounded-full bg-reward/15 px-2.5 py-1 text-[10px] font-black uppercase text-reward">
                기록 완료
              </span>
            )}
          </div>
        </div>

        {/* 추가: 퀘스트 진행 카드 — 완료수/전체 + 오늘 점수 + 오삼 코치 한 줄 */}
        {todayPlan && totalCount > 0 && (
          <div
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              allDone
                ? "border-emerald-400/50 bg-emerald-400/10"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between">
              <p
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em]",
                  allDone ? "text-emerald-600" : "text-primary",
                )}
              >
                오늘의 퀘스트
              </p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                  allDone
                    ? "bg-emerald-400/20 text-emerald-700"
                    : "bg-primary/10 text-primary",
                )}
              >
                {completedCount}/{totalCount} 완료
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  allDone ? "bg-emerald-500" : "bg-primary",
                )}
                style={{
                  width: `${
                    totalCount > 0
                      ? Math.round((completedCount / totalCount) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-[11.5px] leading-relaxed",
                  allDone ? "text-emerald-700" : "text-foreground",
                )}
              >
                <Sparkles className="mr-1 inline h-3 w-3 align-[-2px]" />
                {coachMessage}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold",
                  allDone
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-muted text-foreground",
                )}
                aria-label="오늘 퀘스트 점수"
              >
                {todayQuestScore}점
              </span>
            </div>
          </div>
        )}

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

        {/* 저장 / 임시저장 — 자가 기록 모드에서는 언제든 재수정 가능 */}
        <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraftOnly}
              className="h-11 rounded-2xl px-4"
            >
              <Save className="mr-1 h-4 w-4" />
              임시저장
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitBusy}
              className={cn(
                "ml-auto h-11 flex-1 rounded-2xl font-bold tracking-wide",
                "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
                "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
              )}
            >
              {submitBusy
                ? "저장 중..."
                : hasRecord
                  ? "오늘 기록 수정"
                  : "오늘 체크인 저장 · 🥊 +3"}
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
