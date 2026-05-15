/**
 * 7일 스타터 캠프 — 개발자 / 운영자 로컬 preview 패널 (단계 46).
 *
 * 노출 조건 (tutorialCampDevAccess.shouldShowDevPanel):
 *   · localhost / 127.0.0.1 / *.local
 *   · URL ?tutorialDev=1 (한 번 통과 시 localStorage 토글 ON)
 *   · localStorage `myboxer.tutorialCamp.dev.enabled === "true"`
 *
 * 정책:
 *   · Supabase / DB / RPC / 타 회원 상태 변경 0
 *   · 모든 변경은 현재 브라우저 localStorage 만
 *   · BottomNav / 메뉴 추가 X
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, ClipboardCopy, RotateCcw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  copyToClipboard,
  disableDevToggle,
  getPreviewProfileId,
  isAdminPreviewRole,
  setPreviewProfileId,
  shouldShowDevPanel,
} from "./tutorialCampDevAccess";
import {
  getTutorialCampState,
  saveTutorialCampState,
} from "./tutorialCampStorage";
import {
  appendTutorialCampEvent,
  getTutorialCampEvents,
} from "./tutorialCampEvents";
import {
  markTutorialCampCompleted,
  pauseTutorialCamp,
  resetTutorialCamp,
  setTutorialCampDayStep,
  startTutorialCamp,
} from "./tutorialCampUtils";
import {
  clearAllStepOverrides,
  clearStepOverride,
  getStep,
  getStepOverride,
  getStepsCountByDay,
  getOriginalStepNumber,
  setStepOverride,
  TUTORIAL_CAMP_STEPS,
  type TutorialStepOverridePartial,
} from "./tutorialCampSteps";
import type {
  TutorialCampState,
  TutorialCampStatus,
} from "./tutorialCampTypes";

const STATUS_OPTIONS: { value: TutorialCampStatus; label: string }[] = [
  { value: "active", label: "active" },
  { value: "paused", label: "paused" },
  { value: "completed", label: "completed" },
  { value: "skipped", label: "skipped" },
];

/** 외부 진입점 — Settings 등에서 modal 직접 열기 */
export const TUTORIAL_DEV_OPEN_EVENT = "tutorial-dev-open";

const TutorialDevPanel = () => {
  const { role } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const isAdmin = isAdminPreviewRole(role);

  // 64-C: role 변경 시 재평가 — 관리자 로그인 시 자동 노출
  useEffect(() => {
    setEligible(shouldShowDevPanel(role));
  }, [role]);

  // 64-G: 외부에서 modal 열기 — Settings 의 '관리자 미리보기' 버튼 등
  useEffect(() => {
    if (!eligible) return;
    if (typeof window === "undefined") return;
    const onOpen = () => setOpen(true);
    window.addEventListener(TUTORIAL_DEV_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TUTORIAL_DEV_OPEN_EVENT, onOpen);
  }, [eligible]);

  if (!eligible) return null;

  return (
    <>
      {/* 64-G: 관리자(role 기반) 진입은 Settings 에서만 — 홈/페이지 floating
          제거해 화면을 가리지 않음. dev 토글(localhost / query) 진입자만
          floating 버튼 노출. */}
      {!isAdmin && (
        <FloatingButton isAdmin={isAdmin} onClick={() => setOpen(true)} />
      )}
      <AnimatePresence>
        {open && <DevModal isAdmin={isAdmin} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Floating button — 화면 우하단
// ─────────────────────────────────────────────────────────────

function FloatingButton({
  isAdmin,
  onClick,
}: {
  isAdmin: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        isAdmin ? "관리자 — Day 미리보기 열기" : "튜토리얼 검수 모드 열기"
      }
      className={cn(
        "fixed bottom-20 right-3 z-[140] inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[10px] font-black tracking-widest text-white shadow-[0_4px_14px_rgba(0,0,0,0.45)] backdrop-blur-sm",
        isAdmin
          ? "border border-amber-300/60 bg-amber-600/90 hover:bg-amber-500"
          : "border border-rose-400/40 bg-rose-600/90 hover:bg-rose-500",
      )}
    >
      <Bug className="h-3 w-3" />
      {isAdmin ? "관리자 미리보기" : "DEV"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal — fixed center
// ─────────────────────────────────────────────────────────────

function DevModal({
  isAdmin,
  onClose,
}: {
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<TutorialCampState>(() =>
    getTutorialCampState(),
  );
  const [previewId, setPreviewIdState] = useState<string>(() =>
    getPreviewProfileId(),
  );
  const [day, setDay] = useState<number>(state.currentDay);
  const [step, setStep] = useState<number>(state.currentStep);
  const [statusValue, setStatusValue] = useState<TutorialCampStatus>(
    state.status,
  );
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const fresh = getTutorialCampState();
    setState(fresh);
    setDay(fresh.currentDay);
    setStep(fresh.currentStep);
    setStatusValue(fresh.status);
  }, []);

  const stepsInDay = useMemo(() => getStepsCountByDay(day), [day]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  // 액션
  const goToPosition = useCallback(() => {
    setTutorialCampDayStep(day, step);
    refresh();
    flash("이 위치로 이동했습니다.");
  }, [day, step, refresh]);

  const setStatus = useCallback(
    (next: TutorialCampStatus) => {
      const cur = getTutorialCampState();
      const ts = new Date().toISOString();
      let updated: TutorialCampState;
      if (next === "active") {
        updated = startTutorialCamp();
      } else if (next === "paused") {
        updated = pauseTutorialCamp();
      } else if (next === "completed") {
        updated = markTutorialCampCompleted();
      } else {
        // skipped — 직접 state 갱신
        updated = {
          ...cur,
          status: "skipped",
          skippedAt: ts,
          lastSeenAt: ts,
        };
        saveTutorialCampState(updated);
        appendTutorialCampEvent({
          eventType: "skipped",
          metadata: { source: "devPanel", scope: "all" },
        });
      }
      setState(updated);
      setStatusValue(updated.status);
      flash(`상태가 ${next} 로 변경되었습니다.`);
    },
    [],
  );

  const onResetCamp = useCallback(() => {
    const fresh = resetTutorialCamp();
    setState(fresh);
    setDay(fresh.currentDay);
    setStep(fresh.currentStep);
    setStatusValue(fresh.status);
    flash("내 튜토리얼이 초기화되었습니다.");
  }, []);

  const onMarkAllDone = useCallback(() => {
    const updated = markTutorialCampCompleted();
    setState(updated);
    setStatusValue(updated.status);
    flash("7일 완료 상태로 설정되었습니다.");
  }, []);

  const onCopyEvents = useCallback(async () => {
    const events = getTutorialCampEvents();
    const payload = JSON.stringify(
      { state: getTutorialCampState(), events },
      null,
      2,
    );
    const ok = await copyToClipboard(payload);
    flash(ok ? "이벤트 로그를 복사했습니다." : "복사 실패 — 콘솔에 출력");
    if (!ok && typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[tutorial-camp dev] events", payload);
    }
  }, []);

  const onPreviewIdChange = useCallback((value: string) => {
    setPreviewIdState(value);
    setPreviewProfileId(value);
  }, []);

  const onExitDevMode = useCallback(() => {
    disableDevToggle();
    flash("개발자 preview 가 종료되었습니다.");
    setTimeout(() => {
      onClose();
      // 브라우저 새로고침으로 dev panel 완전히 unmount
      try {
        window.location.reload();
      } catch {
        // ignore
      }
    }, 600);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 z-[141] flex items-center justify-center bg-black/70 px-3 py-4"
      role="dialog"
      aria-label="개발자 검수 모드"
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-rose-400/30 bg-[#0d1530] text-amber-50 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1530]/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black",
                isAdmin ? "bg-amber-600" : "bg-rose-600",
              )}
              aria-hidden
            >
              {isAdmin ? "A" : "D"}
            </span>
            <div>
              <p
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.3em]",
                  isAdmin ? "text-amber-300" : "text-rose-300",
                )}
              >
                {isAdmin ? "관리자 모드" : "DEV PREVIEW"}
              </p>
              <p className="text-[13px] font-bold text-amber-50">
                {isAdmin
                  ? "7일 캠프 미리보기 / 단계 고치기"
                  : "개발자 검수 모드"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full border border-white/15 bg-black/30 p-1.5 text-amber-200 hover:bg-black/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 경고 박스 */}
        <div className="border-b border-rose-400/20 bg-rose-950/30 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-rose-100/85">
            이 기능은 로컬 브라우저 검수용이며,
            <br />
            <strong className="text-rose-200">
              실제 회원 DB / 서버 상태는 변경되지 않습니다.
            </strong>
            <br />
            현재 브라우저의 localStorage 만 변경합니다.
          </p>
        </div>

        <div className="space-y-4 p-4">
          {/* 64-C: Day 빠른 점프 — Day 1~7 한 클릭으로 이동 (관리자 검수용) */}
          <Section title="Day 빠른 점프 — 미리보기">
            <div className="grid grid-cols-7 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const active = state.currentDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setTutorialCampDayStep(d, 0);
                      setDay(d);
                      setStep(0);
                      refresh();
                      flash(`Day ${d} 시작 위치로 이동`);
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[11px] font-black active:scale-[0.97]",
                      active
                        ? "border-amber-300 bg-amber-500/30 text-amber-100"
                        : "border-amber-400/30 bg-black/30 text-amber-200/80 hover:bg-black/50",
                    )}
                    aria-label={`Day ${d} 미리보기`}
                  >
                    Day {d}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-amber-200/65">
              각 Day 의 step 0 부터 진행. 아래 'Day · Step 직접 이동' 으로
              세부 step 까지 점프 가능.
            </p>
          </Section>

          {/* 64-T: 현재 step 편집 (admin override) */}
          <StepEditorSection
            day={state.currentDay}
            step={state.currentStep}
            onSaved={() => {
              flash("저장됨. 새로고침하면 적용됩니다.");
            }}
          />

          {/* 현재 상태 표시 */}
          <Section title="현재 localStorage 상태">
            <KeyValue label="status" value={state.status} />
            <KeyValue label="day" value={String(state.currentDay)} />
            <KeyValue label="step" value={String(state.currentStep)} />
            <KeyValue
              label="completedDays"
              value={
                state.completedDays.length
                  ? state.completedDays.join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="skippedDays"
              value={
                state.skippedDays.length
                  ? state.skippedDays.join(", ")
                  : "—"
              }
            />
            <KeyValue label="devPreviewMode" value={String(state.devPreviewMode)} />
            <KeyValue label="lastSeenAt" value={state.lastSeenAt ?? "—"} />
          </Section>

          {/* Day / Step 이동 */}
          <Section title="Day / Step 이동">
            <div className="space-y-2.5">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-amber-200/70">
                  Day (1~7)
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDay(d);
                        setStep(0);
                      }}
                      className={cn(
                        "h-9 rounded-md border text-[12px] font-bold tabular-nums",
                        day === d
                          ? "border-amber-400 bg-amber-500/20 text-amber-100"
                          : "border-white/10 bg-black/30 text-amber-200/60 hover:bg-black/50",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-amber-200/70">
                  Step (0~{Math.max(0, stepsInDay - 1)})
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: stepsInDay }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStep(i)}
                      className={cn(
                        "h-9 rounded-md border text-[12px] font-bold tabular-nums",
                        step === i
                          ? "border-amber-400 bg-amber-500/20 text-amber-100"
                          : "border-white/10 bg-black/30 text-amber-200/60 hover:bg-black/50",
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={goToPosition}
                className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-[12px] font-black text-amber-950 hover:from-amber-400 hover:to-amber-300"
              >
                이 위치로 이동 (Day {day} · Step {step})
              </Button>
            </div>
          </Section>

          {/* 상태 변경 */}
          <Section title="상태 변경">
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    "h-10 rounded-md border text-[12px] font-bold transition-colors",
                    statusValue === s.value
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                      : "border-white/10 bg-black/30 text-amber-200/70 hover:bg-black/50",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Section>

          {/* 액션 묶음 */}
          <Section title="액션">
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={onMarkAllDone}
                className="h-10 w-full rounded-xl border-amber-400/40 bg-amber-500/10 text-[12px] font-bold text-amber-100 hover:bg-amber-500/20"
              >
                <Trophy className="mr-1 h-3.5 w-3.5" />
                7일 완료 상태로 설정
              </Button>
              <Button
                variant="outline"
                onClick={onResetCamp}
                className="h-10 w-full rounded-xl border-white/15 bg-black/30 text-[12px] font-bold text-amber-200 hover:bg-black/50"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />내 튜토리얼 리셋
              </Button>
              <Button
                variant="outline"
                onClick={onCopyEvents}
                className="h-10 w-full rounded-xl border-white/15 bg-black/30 text-[12px] font-bold text-amber-200 hover:bg-black/50"
              >
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                이벤트 로그 복사
              </Button>
            </div>
          </Section>

          {/* preview profile id */}
          <Section title="Preview Profile ID (cosmetic)">
            <input
              type="text"
              value={previewId}
              onChange={(e) => onPreviewIdChange(e.target.value)}
              placeholder="라벨용 메모 — 실제 user_id 와 무관"
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-amber-50 placeholder:text-amber-200/30 focus:border-amber-400/50 focus:outline-none"
              spellCheck={false}
            />
            <p className="mt-1 text-[10px] text-amber-200/50">
              로컬 메모만 저장됩니다. 서버 사용자 데이터를 조회·변경하지 않습니다.
            </p>
          </Section>

          {/* dev mode 종료 */}
          <Section title="개발자 모드 종료">
            <Button
              variant="outline"
              onClick={onExitDevMode}
              className="h-10 w-full rounded-xl border-rose-400/40 bg-rose-500/10 text-[12px] font-bold text-rose-100 hover:bg-rose-500/20"
            >
              개발자 preview 종료 (페이지 새로고침)
            </Button>
            <p className="mt-1 text-[10px] text-amber-200/50">
              localStorage 토글이 OFF 되며 floating 버튼이 사라집니다.
              <br />
              ?tutorialDev=1 로 다시 활성 가능.
            </p>
          </Section>

          <p className="text-center text-[9px] text-amber-200/40">
            모든 변경은 이 브라우저의 localStorage 에만 적용됩니다.
          </p>
        </div>

        {/* toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed bottom-6 left-1/2 z-[142] -translate-x-1/2 rounded-full border border-amber-400/40 bg-black/85 px-4 py-2 text-[11px] font-bold text-amber-200 shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section / KeyValue helper
// ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-3">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-amber-300/80">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 64-U: selector → 한글 라벨 사전. 자주 쓰는 anchor 만 매핑.
//   모르는 selector 는 selector 그대로 표시.
// ─────────────────────────────────────────────────────────────
const SELECTOR_LABELS: Record<string, string> = {
  '[data-tour="missions-official-training"]': "훈련 화면 (전체 영역)",
  '[data-tour="missions-tab-control"]': "올리그 / 복싱 컨텐츠 토글",
  '[data-tour="missions-league-header-white"]':
    "복싱 컨텐츠 안 — 화이트 리그 헤더",
  '[data-tour="missions-tab-control"] button[aria-selected="false"]':
    "올리그/복싱 컨텐츠 — 비활성 토글",
  '[data-tour="white-league-tabs"]': "화이트 리그 — 탭 줄 (배우기/수업실행/심사)",
  '[data-tour="white-league-tab-learn"]': "📖 배우기 탭",
  '[data-tour="white-league-tab-session"]': "🥊 수업실행 탭",
  '[data-tour="white-league-tab-check"]': "✅ 심사 탭",
  '[data-tour="white-level-1-card"]': "Lv.1 스탠스·가드·잽 입문 카드",
  '[data-tour="boxing-iq-card"]': "복싱 IQ 카드 (153 QUEST)",
  '[data-tour="boxing-iq-question"]': "복싱 IQ 모달 — 문제 영역",
  '[data-tour="boxing-iq-options"]': "복싱 IQ 모달 — 선택지 영역",
  '[data-tour="boxing-iq-selected-option"]': "복싱 IQ 모달 — 선택한 답",
  '[data-tour="boxing-iq-result"]': "복싱 IQ 모달 — 결과 화면",
  '[data-tour="quest-mini-academy"]': "153 QUEST — 오늘의 퀴즈 카드",
  '[data-tour="quest-mini-challenge"]': "153 QUEST — 챌린지 미니 카드",
  '[data-tour="quest-mini-journal"]': "153 QUEST — 챔피언 일기 미니 카드",
  '[data-tour="champion-journal-card"]': "챔피언 일기 카드",
  '[data-tour="challenge-arena-card"]': "챌린지 아레나 카드",
  '[data-tour="challenge-arena-scroll"]': "챌린지 페이지 스크롤 영역",
  '[data-tour="journal-prompt-list"]': "일기 — 질문 목록",
  '[data-tour="journal-reflection-input"]': "일기 — 한 줄 입력칸",
  '[data-tour="journal-condition-options"]': "일기 — 컨디션 선택지",
  '[data-tour="journal-submit"]': "일기 — '기록 남기기' 버튼",
  '[data-tour="home-osami-note"]': "홈 — 오삼이 노트",
  '[data-tour="home-today-focus"]': "홈 — 오늘의 포커스",
  '[data-tour="home-quest-recommendation"]': "홈 — QUEST 추천 카드 (anchor 미존재)",
  '[data-tour="missions-master-road"]': "마스터로드 카드 (anchor 미존재)",
  '[data-tour="missions-submit-note"]': "공식 미션 제출 안내 (anchor 미존재)",
  '[data-tour="missions-coach-approval-note"]': "코치 승인 안내 (anchor 미존재)",
  '[data-tutorial-target="profile-photo-button"]': "마이페이지 — 카메라 아이콘",
  '[data-tutorial-target="guide-first-card"]': "가이드 페이지 — 첫 카드",
  '[data-tutorial-target="qr-checkin-button"]': "홈 — 'QR 체크인 하기' 버튼",
  '[data-tutorial-target="first-mission-card"]': "전체 미션 — 첫 카드",
  '[data-tutorial-target="first-challenge-card"]': "더 파이터 — 첫 챌린지 카드",
  // 65-F: 7일 캠프 재구성 — 새 커리큘럼 anchor
  '[data-tour="challenge153-page"]': "153 챌린지 — 페이지 전체",
  '[data-tour="challenge153-header"]': "153 챌린지 — 헤더",
  '[data-tour="challenge153-intro"]': "153 챌린지 — 안내 박스",
  '[data-tour="challenge153-leaderboard"]': "153 챌린지 — 회원 간 랭킹 카드",
  '[data-tour="return-round-banner"]': "153 챌린지 — 리턴 라운드 배너",
  '[data-tour="osami-briefing-card"]': "153 챌린지 — 오삼 코치 브리핑",
  '[data-tour="quest-mini-panel"]': "153 챌린지 — 보조 퀘스트 영역",
  '[data-tour="white-league-accordion"]': "훈련 — 화이트 리그 아코디언",
  '[data-tour="white-detail-hero"]': "훈련 — Lv 상세 캐릭터 카드",
  '[data-tour="white-detail-stats"]': "훈련 — Lv 상세 소요시간/보상",
  '[data-tour="white-learn-modules"]': "훈련 — 배우기: 학습 모듈",
  '[data-tour="white-learn-purpose"]': "훈련 — 배우기: 오늘의 목적",
  '[data-tour="white-learn-value"]': "훈련 — 배우기: 오늘 얻는 가치",
  '[data-tour="white-learn-coach"]': "훈련 — 배우기: 코치 포인트",
  '[data-tour="white-session-blocks"]': "훈련 — 수업실행: 50분 수업 구성",
  '[data-tour="white-session-start"]': "훈련 — 수업실행: 수업 시작 버튼",
  '[data-tour="white-session-xp"]': "훈련 — 수업실행: XP 규칙",
  '[data-tour="white-check-conditions"]': "훈련 — 심사: 단계 조건",
  '[data-tour="white-check-checklist"]': "훈련 — 심사: 체크테스트",
  '[data-tour="cert-hero"]': "단증혜택 — 단증이 열어주는 미래",
  '[data-tour="cert-carousel"]': "단증혜택 — 단증 종류별 카드",
  '[data-tour="cert-roadmap"]': "단증혜택 — 단증 로드맵",
  '[data-tour="cert-master-reward"]': "단증혜택 — 블랙 마스터 혜택",
  '[data-tour="cert-detail-accordions"]': "단증혜택 — 실제 가점 상세 정보",
  '[data-tour="cert-faq"]': "단증혜택 — 자주 묻는 질문",
  '[data-tour="mindset-session-picker"]': "153마인드셋 — 세션 선택 화면",
  '[data-tour="mindset-intro"]': "153마인드셋 — 소개 영역",
  '[data-tour="mindset-session-list"]': "153마인드셋 — 세션 목록",
  '[data-tour="mindset-session-card"]': "153마인드셋 — 첫 세션 카드",
  '[data-tour="mindset-start-button"]': "153마인드셋 — 세션 시작 버튼",
  '[data-tour="rankup-tabs"]': "랭크업 — 로드맵/가치맵 탭",
  '[data-tour="rankup-progress"]': "랭크업 — 현재 진행 카드",
  '[data-tour="rankup-levelmap"]': "랭크업 — 40단계 로드맵",
  '[data-tour="rankup-master-league"]': "랭크업 — 마스터 리그",
  '[data-tour="diet-subnav"]': "153다이어트 — 하위 메뉴",
  '[data-tour="diet-onboarding-cta"]': "153다이어트 — 프로그램 소개",
  '[data-tour="diet-onboarding-start"]': "153다이어트 — 3분 온보딩 시작 버튼",
  '[data-tour="diet-hero"]': "153다이어트 — Day/Stage 히어로",
  '[data-tour="diet-today-mission"]': "153다이어트 — 오늘의 미션 CTA",
  '[data-tour="guide-tab-switcher"]': "가이드 — 탭 줄",
  '[data-tour="guide-tab-science"]': "가이드 — 과학설계 탭",
  '[data-tour="guide-tab-valuemap"]': "가이드 — 가치맵 탭",
  '[data-tour="guide-tab-whitefaq"]': "가이드 — 화이트 FAQ 탭",
  '[data-tour="guide-tab-safety"]': "가이드 — 안전 탭",
  '[data-tour="guide-onboarding-replay"]': "가이드 — 온보딩 다시 보기 버튼",
};

function describeSelector(sel: string): string {
  if (!sel || sel.trim() === "") return "(선택 안 함 — 화면 가운데 큰 카드로 표시)";
  return SELECTOR_LABELS[sel.trim()] ?? "사용자 정의 selector — 정확히 매칭되는지 확인 필요";
}

// ─────────────────────────────────────────────────────────────
// 65-D: step 이 가리킬 페이지(route) 목록. 메뉴 이동/통합 시 admin 이
//   코드 수정 없이 step 의 페이지를 바꿀 수 있게 한다.
//   여기 없는 경로도 직접 입력 가능 (input 자유 입력 허용).
// ─────────────────────────────────────────────────────────────
const ROUTE_OPTIONS: { value: string; label: string }[] = [
  { value: "/home", label: "홈" },
  { value: "/missions", label: "훈련" },
  { value: "/myboxer/quest", label: "153 챌린지 (153 QUEST)" },
  { value: "/myboxer/community", label: "153 커뮤니티 (챔피언 일기·세컨드 응원)" },
  { value: "/myboxer/visualization", label: "153마인드셋" },
  { value: "/challenges", label: "더 다이어터 (챌린지)" },
  { value: "/halloffame", label: "랭킹" },
  { value: "/rank-up", label: "랭크업" },
  { value: "/cert-benefits", label: "단증혜택" },
  { value: "/rewards", label: "보상" },
  { value: "/character-studio", label: "캐릭터" },
  { value: "/guide", label: "가이드" },
  { value: "/mypage", label: "내정보" },
  { value: "/settings", label: "설정" },
];

function describeRoute(route: string): string {
  const r = (route ?? "").trim();
  if (!r) return "(페이지 지정 안 함 — 현재 화면 그대로)";
  return ROUTE_OPTIONS.find((o) => o.value === r)?.label ?? "사용자 정의 경로";
}

// 화면에서 element 찾아 1.5초 amber 외곽선 + scrollIntoView
function previewSelectorOnScreen(sel: string): {
  ok: boolean;
  message: string;
} {
  if (typeof document === "undefined") return { ok: false, message: "브라우저 외 환경" };
  if (!sel || sel.trim() === "")
    return { ok: false, message: "selector 가 비어있어요 (화면 가운데 큰 카드)" };
  let el: HTMLElement | null = null;
  try {
    el = document.querySelector(sel.trim()) as HTMLElement | null;
  } catch {
    return { ok: false, message: "selector 형식 오류 — 다시 확인해주세요" };
  }
  if (!el)
    return {
      ok: false,
      message: "지금 화면에 없어요. 해당 페이지로 먼저 이동해야 보여요.",
    };
  // amber outline 1.5s + scrollIntoView
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  const prevTransition = el.style.transition;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "outline 0.2s ease";
    el.style.outline = "3px solid #fbbf24";
    el.style.outlineOffset = "4px";
    window.setTimeout(() => {
      try {
        el!.style.outline = prevOutline;
        el!.style.outlineOffset = prevOffset;
        el!.style.transition = prevTransition;
      } catch {
        /* noop */
      }
    }, 1500);
  } catch {
    /* noop */
  }
  return { ok: true, message: "화면에서 1.5초 동안 강조 표시했어요" };
}

// ─────────────────────────────────────────────────────────────
// 64-T: StepEditorSection — admin 이 현재 step 의 selector / placement /
//   autoAdvance / autoNavigate / completionRule 등을 즉시 시범 변경.
//   localStorage override → getStep merge. 코드 변경 없이 시범 + 검증.
// ─────────────────────────────────────────────────────────────
function StepEditorSection({
  day,
  step,
  onSaved,
}: {
  day: number;
  step: number;
  onSaved: () => void;
}) {
  const baseStep = getStep(day, step);
  // 64-BA: override 는 original step number 로 저장/lookup (custom step 1000+).
  //   dev panel 의 step 은 reassigned 0-based — 변환 필수.
  const originalStep = getOriginalStepNumber(day, step);
  const existing = getStepOverride(day, originalStep);
  const [draft, setDraft] = useState<TutorialStepOverridePartial>(() => ({
    targetSelector: baseStep?.targetSelector ?? "",
    route: baseStep?.route ?? "",
    placement: baseStep?.placement ?? "bottom",
    autoAdvance: baseStep?.autoAdvance ?? false,
    autoNavigate: baseStep?.autoNavigate ?? false,
    requireTargetClick: baseStep?.requireTargetClick ?? false,
    blockNextUntilComplete: baseStep?.blockNextUntilComplete ?? false,
    completionRule: baseStep?.completionRule,
    helperMessage: baseStep?.helperMessage,
    successMessage: baseStep?.successMessage,
  }));

  // day/step 바뀌면 새 base 로 reload
  useEffect(() => {
    const fresh = getStep(day, step);
    setDraft({
      targetSelector: fresh?.targetSelector ?? "",
      route: fresh?.route ?? "",
      placement: fresh?.placement ?? "bottom",
      autoAdvance: fresh?.autoAdvance ?? false,
      autoNavigate: fresh?.autoNavigate ?? false,
      requireTargetClick: fresh?.requireTargetClick ?? false,
      blockNextUntilComplete: fresh?.blockNextUntilComplete ?? false,
      completionRule: fresh?.completionRule,
      helperMessage: fresh?.helperMessage,
      successMessage: fresh?.successMessage,
    });
  }, [day, step]);

  if (!baseStep) {
    return (
      <Section title="현재 step 편집 (admin)">
        <p className="text-[11px] text-amber-200/60">
          Day {day} · Step {step} — 정의된 step 없음
        </p>
      </Section>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-amber-400/20 bg-black/30 px-2 py-1 text-[11px] font-mono text-amber-100 focus:outline-none focus:border-amber-400/60";

  const update = (patch: TutorialStepOverridePartial) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const onSave = () => {
    setStepOverride(day, originalStep, draft);
    onSaved();
  };

  const onResetThisStep = () => {
    clearStepOverride(day, originalStep);
    const fresh = getStep(day, step);
    setDraft({
      targetSelector: fresh?.targetSelector ?? "",
      route: fresh?.route ?? "",
      placement: fresh?.placement ?? "bottom",
      autoAdvance: fresh?.autoAdvance ?? false,
      autoNavigate: fresh?.autoNavigate ?? false,
      requireTargetClick: fresh?.requireTargetClick ?? false,
      blockNextUntilComplete: fresh?.blockNextUntilComplete ?? false,
      completionRule: fresh?.completionRule,
      helperMessage: fresh?.helperMessage,
      successMessage: fresh?.successMessage,
    });
    onSaved();
  };

  return (
    <Section
      title={`이번 단계 고치기 (${day}일차 · ${step + 1}번째${existing ? " · 수정됨" : ""})`}
    >
      <div className="space-y-3">
        <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-100">
          💡 여기서 바꾸면 <strong>관리자 본인 화면</strong>에서만 보여요.
          다른 회원에게는 영향 없어요. 마음에 들면 코드에 적어달라고 알려주세요.
          <br />저장 후 화면을 새로고침해야 적용돼요.
        </p>

        <div className="block">
          <span className="text-[11px] font-bold text-amber-100">
            👉 어디를 가리킬까요?
          </span>
          <p className="mb-1 text-[10px] text-amber-200/60">
            화면에서 강조할 버튼/카드의 표식. 예: [data-tour="quest-mini-academy"]
          </p>
          <input
            type="text"
            value={draft.targetSelector ?? ""}
            onChange={(e) => update({ targetSelector: e.target.value })}
            placeholder='[data-tour="..."]'
            className={inputCls}
          />
          {/* 한글 라벨 — 어떤 메뉴인지 자동 표시 */}
          <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10.5px] font-bold text-amber-200">
            🏷️ {describeSelector(draft.targetSelector ?? "")}
          </p>
          {/* 화면에서 보기 버튼 */}
          <button
            type="button"
            onClick={() => {
              const result = previewSelectorOnScreen(draft.targetSelector ?? "");
              onSaved();
              // toast 는 onSaved 의 flash 가 받게
              if (!result.ok) {
                // ok=false 면 alert 대체로 console + toast 부족시 native
                if (typeof window !== "undefined") {
                  // 단순 inline 표시 — modal 의 toast 가 닫혀있으면 alert
                  // (modal 자체가 열려있으니 toast 안 보일 수 있음)
                  window.alert(`📍 ${result.message}`);
                }
              } else if (typeof window !== "undefined") {
                window.alert(`📍 ${result.message}\n(modal 닫고 보면 강조선이 보여요)`);
              }
            }}
            className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-400/40 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-black/50 active:scale-[0.98]"
          >
            📍 화면에서 위치 보기 (강조 표시)
          </button>
          <p className="mt-0.5 text-[9.5px] text-amber-200/55">
            ※ 누르면 1.5초 동안 노란 외곽선 + 자동 스크롤. 해당 페이지에 있어야
            보여요. modal 을 닫고 봐주세요.
          </p>
        </div>

        {/* 65-D: 어느 페이지(route) 에서 강조할지 — 메뉴 이동/통합 시 필수.
            '시작 시 페이지 자동 이동' 토글이 이 경로로 navigate 한다. */}
        <div className="block">
          <span className="text-[11px] font-bold text-amber-100">
            📍 어느 페이지에서 강조하나요?
          </span>
          <p className="mb-1 text-[10px] text-amber-200/60">
            메뉴를 옮겼다면 여기를 새 페이지로 바꾸세요. 아래 '시작 시 페이지
            자동 이동'을 켜면 이 페이지로 자동 이동해요.
          </p>
          <input
            type="text"
            list="tutorial-route-options"
            value={draft.route ?? ""}
            onChange={(e) => update({ route: e.target.value })}
            placeholder="/myboxer/community 등"
            className={inputCls}
          />
          <datalist id="tutorial-route-options">
            {ROUTE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </datalist>
          <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10.5px] font-bold text-amber-200">
            🏷️ {describeRoute(draft.route ?? "")}
          </p>
        </div>

        <label className="block">
          <span className="text-[11px] font-bold text-amber-100">
            💬 안내 카드 위치
          </span>
          <p className="mb-1 text-[10px] text-amber-200/60">
            오삼이 카드가 화면 어디에 보일지
          </p>
          <select
            value={draft.placement ?? "bottom"}
            onChange={(e) =>
              update({
                placement: e.target.value as TutorialStepOverridePartial["placement"],
              })
            }
            className={inputCls}
          >
            <option value="top">위쪽</option>
            <option value="bottom">아래쪽</option>
            <option value="left">왼쪽</option>
            <option value="right">오른쪽</option>
            <option value="center">가운데</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-bold text-amber-100">
            ✅ 어떻게 완료되나요?
          </span>
          <p className="mb-1 text-[10px] text-amber-200/60">
            회원이 무엇을 해야 이 단계가 끝나는지
          </p>
          <select
            value={draft.completionRule ?? ""}
            onChange={(e) =>
              update({
                completionRule:
                  (e.target.value || undefined) as TutorialStepOverridePartial["completionRule"],
              })
            }
            className={inputCls}
          >
            <option value="">(설정 안 함 — 회원이 '다음으로' 직접)</option>
            <option value="target_clicked">회원이 카드를 눌렀을 때</option>
            <option value="quiz_question_read">4초 동안 읽기 (자동 완료)</option>
            <option value="quiz_answer_selected">퀴즈에서 답을 골랐을 때</option>
            <option value="quiz_correct_answer_selected">정답을 골랐을 때</option>
            <option value="scrolled_to_bottom">맨 아래까지 스크롤했을 때</option>
            <option value="text_input_min_length">글을 일정 길이 이상 적었을 때</option>
            <option value="option_selected">옵션을 골랐을 때</option>
            <option value="toggle_selected">토글을 눌렀을 때</option>
            <option value="condition_checked">컨디션을 체크했을 때</option>
            <option value="modal_closed">모달이 닫혔을 때</option>
            <option value="manual_confirm">언제든 통과 (수동 확인용)</option>
          </select>
        </label>

        <div>
          <p className="mb-1.5 text-[11px] font-bold text-amber-100">
            ⚙️ 자동 진행 설정
          </p>
          <div className="grid grid-cols-1 gap-2">
            <ToggleRow
              label="완료되면 다음 단계로 자동 이동"
              hint="회원이 '다음으로'를 안 눌러도 자동 진행 (0.25초 후)"
              checked={!!draft.autoAdvance}
              onChange={(v) => update({ autoAdvance: v })}
            />
            <ToggleRow
              label="이 단계 시작할 때 페이지 자동 이동"
              hint="단계가 시작되면 정해진 화면으로 자동 이동"
              checked={!!draft.autoNavigate}
              onChange={(v) => update({ autoNavigate: v })}
            />
            <ToggleRow
              label="회원이 꼭 카드를 눌러야 함"
              hint="누르기 전에는 '다음으로' 비활성"
              checked={!!draft.requireTargetClick}
              onChange={(v) => update({ requireTargetClick: v })}
            />
            <ToggleRow
              label="완료 전에는 '다음으로' 잠그기"
              hint="조건 채울 때까지 다음으로 못 누름"
              checked={!!draft.blockNextUntilComplete}
              onChange={(v) => update({ blockNextUntilComplete: v })}
            />
          </div>
        </div>

        <label className="block">
          <span className="text-[11px] font-bold text-amber-100">
            🗨️ 안내 한 줄 (회원이 행동하기 전)
          </span>
          <p className="mb-1 text-[10px] text-amber-200/60">
            예: "👆 여기를 눌러보세요"
          </p>
          <input
            type="text"
            value={draft.helperMessage ?? ""}
            onChange={(e) => update({ helperMessage: e.target.value })}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-bold text-amber-100">
            🎉 칭찬 한 줄 (회원이 행동한 후)
          </span>
          <p className="mb-1 text-[10px] text-amber-200/60">
            예: "잘했어요! 다음으로 갈게요"
          </p>
          <input
            type="text"
            value={draft.successMessage ?? ""}
            onChange={(e) => update({ successMessage: e.target.value })}
            className={inputCls}
          />
        </label>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={onSave}
            className="h-9 flex-1 rounded-lg bg-amber-500 px-3 text-[12px] font-black text-amber-950 hover:bg-amber-400"
          >
            💾 저장하기 (새로고침 후 적용)
          </Button>
          <button
            type="button"
            onClick={onResetThisStep}
            className="rounded-lg border border-amber-400/30 bg-black/30 px-3 text-[11px] font-bold text-amber-200/85 hover:bg-black/50"
          >
            ↩️ 원래대로
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            clearAllStepOverrides();
            onSaved();
          }}
          className="w-full rounded-lg border border-rose-400/30 bg-rose-950/15 px-3 py-1.5 text-[10px] font-bold text-rose-200/85 hover:bg-rose-950/30"
        >
          🗑️ 내가 바꾼 모든 단계 한꺼번에 원래대로
        </button>
      </div>
    </Section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-2 rounded-lg border border-amber-400/15 bg-black/30 px-2.5 py-2 text-[11px] font-bold text-amber-100 active:scale-[0.99]">
      <div className="flex-1 min-w-0">
        <span className="block text-amber-100">{label}</span>
        {hint && (
          <span className="block text-[10px] font-normal text-amber-200/60">
            {hint}
          </span>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
      />
    </label>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[11px]">
      <span className="font-mono text-amber-200/60">{label}</span>
      <span className="max-w-[60%] truncate text-right font-mono text-amber-100">
        {value}
      </span>
    </div>
  );
}

// 빌드 시 미사용 import 제거 — TUTORIAL_CAMP_STEPS 는 향후 step 라벨용
void TUTORIAL_CAMP_STEPS;

export default TutorialDevPanel;
