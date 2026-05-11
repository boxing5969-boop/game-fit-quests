/**
 * 7일 캠프 — 화면 위 customizer (단계 64-V).
 *
 * 관리자가 modal 을 닫고도 앱 화면을 보면서 듀토리얼 step 을 즉시 커스텀.
 * 핵심:
 *   · 우측 중간 floating 버튼 — 클릭 시 작은 sidebar 펼침
 *   · '🎯 element 선택' — picker 활성 → 화면 element click → selector 자동 캡처
 *   · 핵심 토글 (autoAdvance / autoNavigate / requireTargetClick)
 *   · '💾 저장' — localStorage override + 페이지 새로고침
 *   · '🔧 전체 편집' — TutorialDevPanel modal 열기
 *
 * 보호:
 *   · admin role 만 마운트
 *   · 모든 변경은 admin 본인 브라우저 localStorage — 회원/server 0
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pointer,
  Settings2,
  Save,
  X,
  Wrench,
  ArrowUp,
  ArrowDown,
  Play,
  RotateCcw,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  isAdminPreviewRole,
  shouldShowDevPanel,
} from "./tutorialCampDevAccess";
import {
  addCustomStep,
  clearStepOrderForDay,
  clearStepOverride,
  ensureFullOrderForDay,
  getCustomStepsForDay,
  getHiddenStepsForDay,
  getStep,
  getStepOrderForDay,
  getStepOverride,
  getStepsByDay,
  removeCustomStep,
  setStepOrderForDay,
  setStepOverride,
  TUTORIAL_CAMP_STEPS,
  type TutorialStepOverridePartial,
} from "./tutorialCampSteps";
import type { TutorialCampStep } from "./tutorialCampSteps";
import { useTutorialCamp } from "./useTutorialCamp";
import { TUTORIAL_DEV_OPEN_EVENT } from "./TutorialDevPanel";

const SELECTOR_LABELS_LITE: Record<string, string> = {
  '[data-tour="missions-official-training"]': "훈련 화면 (전체)",
  '[data-tour="missions-tab-control"]': "올리그/복싱 컨텐츠 토글",
  '[data-tour="missions-league-header-white"]': "화이트 리그 헤더",
  '[data-tour="white-league-tabs"]': "화이트 — 탭 줄",
  '[data-tour="white-league-tab-learn"]': "📖 배우기 탭",
  '[data-tour="white-league-tab-session"]': "🥊 수업실행 탭",
  '[data-tour="white-league-tab-check"]': "✅ 심사 탭",
  '[data-tour="white-level-1-card"]': "Lv.1 스탠스·가드·잽 입문",
  '[data-tour="boxing-iq-card"]': "복싱 IQ 카드",
  '[data-tour="quest-mini-academy"]': "153 QUEST — 오늘의 퀴즈",
  '[data-tour="quest-mini-challenge"]': "153 QUEST — 챌린지 미니",
  '[data-tour="quest-mini-journal"]': "153 QUEST — 일기 미니",
  '[data-tour="champion-journal-card"]': "챔피언 일기 카드",
  '[data-tour="challenge-arena-card"]': "챌린지 아레나 카드",
  '[data-tour="challenge-arena-scroll"]': "챌린지 스크롤 영역",
  '[data-tutorial-target="profile-photo-button"]': "마이페이지 — 카메라",
  '[data-tutorial-target="qr-checkin-button"]': "홈 — QR 체크인 버튼",
  '[data-tutorial-target="guide-first-card"]': "가이드 — 첫 카드",
};

function describeSelector(sel: string): string {
  const trimmed = sel.trim();
  if (!trimmed) return "선택 안 함 (큰 카드 가운데)";
  return SELECTOR_LABELS_LITE[trimmed] ?? "사용자 selector — 매칭 확인 필요";
}

// ─────────────────────────────────────────────────────────────
// 64-AF: usePicker hook — element picker (마우스 오버 강조 + click 캡처)
//   여러 곳에서 재사용. customizer sidebar + InlineRowEditor 의 ✏️ 패널
// ─────────────────────────────────────────────────────────────
function usePicker(onCapture: (selector: string) => void): {
  picking: boolean;
  start: () => void;
  stop: () => void;
} {
  const [picking, setPicking] = useState(false);
  const lastOutlinedRef = useRef<{
    el: Element;
    outline: string;
    outlineOffset: string;
  } | null>(null);
  const clearOutline = useCallback(() => {
    const last = lastOutlinedRef.current;
    if (last) {
      try {
        (last.el as HTMLElement).style.outline = last.outline;
        (last.el as HTMLElement).style.outlineOffset = last.outlineOffset;
      } catch {
        /* noop */
      }
      lastOutlinedRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!picking) {
      clearOutline();
      return;
    }
    if (typeof document === "undefined") return;

    const onMove = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (el.closest("[data-tutorial-customizer]")) return;
      clearOutline();
      try {
        const html = el as HTMLElement;
        lastOutlinedRef.current = {
          el,
          outline: html.style.outline,
          outlineOffset: html.style.outlineOffset,
        };
        html.style.outline = "3px dashed #fbbf24";
        html.style.outlineOffset = "2px";
      } catch {
        /* noop */
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (el.closest("[data-tutorial-customizer]")) return;
      e.preventDefault();
      e.stopPropagation();
      const sel = buildSelectorFor(el);
      setPicking(false);
      clearOutline();
      onCapture(sel);
      toast.success(`✅ 선택됨: ${describeSelector(sel)}`, {
        description: sel,
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPicking(false);
        clearOutline();
      }
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      clearOutline();
    };
  }, [picking, onCapture, clearOutline]);

  return {
    picking,
    start: () => setPicking(true),
    stop: () => setPicking(false),
  };
}

/** 64-AC: 화면에서 selector 매칭 element 를 1.5초 amber 외곽선 + scrollIntoView. */
function previewSelector(sel: string): { ok: boolean; message: string } {
  if (typeof document === "undefined")
    return { ok: false, message: "브라우저 외 환경" };
  const trimmed = sel.trim();
  if (!trimmed)
    return {
      ok: false,
      message: "selector 가 비어있어요 — 큰 카드가 가운데 표시됩니다",
    };
  let el: HTMLElement | null = null;
  try {
    el = document.querySelector(trimmed) as HTMLElement | null;
  } catch {
    return { ok: false, message: "selector 형식 오류 — 다시 확인해주세요" };
  }
  if (!el)
    return {
      ok: false,
      message: "지금 화면에 없어요. 해당 페이지로 먼저 이동해야 보여요.",
    };
  const prev = {
    outline: el.style.outline,
    offset: el.style.outlineOffset,
    transition: el.style.transition,
  };
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "outline 0.2s ease";
    el.style.outline = "3px solid #fbbf24";
    el.style.outlineOffset = "4px";
    window.setTimeout(() => {
      try {
        el!.style.outline = prev.outline;
        el!.style.outlineOffset = prev.offset;
        el!.style.transition = prev.transition;
      } catch {
        /* noop */
      }
    }, 1500);
  } catch {
    /* noop */
  }
  return {
    ok: true,
    message: "화면에서 1.5초 동안 노란 외곽선으로 강조됐어요",
  };
}

/**
 * Element 의 안정적인 selector 추출.
 * 우선순위: data-tour > data-tutorial-target > id > stable className > 단순 tag.
 */
function buildSelectorFor(el: Element): string {
  const dt = el.getAttribute("data-tour");
  if (dt) return `[data-tour="${dt}"]`;
  const dtt = el.getAttribute("data-tutorial-target");
  if (dtt) return `[data-tutorial-target="${dtt}"]`;
  // 부모 또는 closest 에 anchor 있으면 그것
  const ancestor = el.closest("[data-tour],[data-tutorial-target]");
  if (ancestor && ancestor !== el) {
    const adt = ancestor.getAttribute("data-tour");
    if (adt) return `[data-tour="${adt}"]`;
    const adtt = ancestor.getAttribute("data-tutorial-target");
    if (adtt) return `[data-tutorial-target="${adtt}"]`;
  }
  if (el.id) return `#${el.id}`;
  // class 후보 — 너무 많은 utility class 제외
  const stable = Array.from(el.classList).find(
    (c) =>
      /^[a-z][a-z0-9_-]*$/i.test(c) &&
      !/^(css-|chunk-|grid-|flex-|w-|h-|p-|m-|text-|bg-|border-|rounded-|shadow-|absolute|relative|fixed|sticky)/i.test(
        c,
      ),
  );
  if (stable) return `${el.tagName.toLowerCase()}.${stable}`;
  return el.tagName.toLowerCase();
}

const TutorialCustomizer = () => {
  const { role } = useAuth();
  const eligible = shouldShowDevPanel(role);
  const isAdmin = isAdminPreviewRole(role);

  const camp = useTutorialCamp();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hoverEl, setHoverEl] = useState<Element | null>(null);
  const [selector, setSelector] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [requireTargetClick, setRequireTargetClick] = useState(false);
  // 64-AE: 캡처 직후 selector 영역 amber pulse 강조
  const [justCaptured, setJustCaptured] = useState(false);

  // 64-AA: 미리보기 / 편집할 일차 — '지금 진행 중' 과 별개로 admin 이 선택
  //   1~7 button 으로 선택만 함. 실제 시작은 '시작' 버튼 클릭 시.
  const [previewDay, setPreviewDay] = useState<number>(
    camp.state.currentDay,
  );

  // 64-AD: 외부에서 customizer 닫기 요청 (전체 편집기 진입 등)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onClose = () => setOpen(false);
    window.addEventListener(CUSTOMIZER_CLOSE_EVENT, onClose);
    return () => window.removeEventListener(CUSTOMIZER_CLOSE_EVENT, onClose);
  }, []);

  // 64-AG: customizer 흐리게 / 선명 토글 — 회원이 홈 화면 잘 보이도록.
  //   · DIM_EVENT (예: 위치 보기 click) → 흐려짐
  //   · customizer 위 클릭/마우스다운 → 다시 선명
  //   · customizer 외부 클릭 → 흐려짐 (포커스 잃음)
  const [dimmed, setDimmed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDim = () => setDimmed(true);
    window.addEventListener(CUSTOMIZER_DIM_EVENT, onDim);
    return () => window.removeEventListener(CUSTOMIZER_DIM_EVENT, onDim);
  }, []);
  useEffect(() => {
    if (!open) {
      setDimmed(false);
      return;
    }
    if (typeof document === "undefined") return;
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (el.closest("[data-tutorial-customizer]")) {
        // customizer 안 클릭 → 선명
        setDimmed(false);
      } else {
        // 외부 클릭 → 흐려짐
        setDimmed(true);
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [open]);
  // 활성 day 가 외부에서 바뀌면 동기화 (camp.start 후 등)
  useEffect(() => {
    setPreviewDay(camp.state.currentDay);
  }, [camp.state.currentDay]);

  // step 변경 시 draft 동기화 — previewDay 가 currentDay 와 같을 때만 currentStep
  //   참조. 다른 day 보고 있으면 0 부터 (편집기 시작점).
  const day = previewDay;
  const step =
    previewDay === camp.state.currentDay ? camp.state.currentStep : 0;
  useEffect(() => {
    const s = getStep(day, step);
    setSelector(s?.targetSelector ?? "");
    setAutoAdvance(!!s?.autoAdvance);
    setAutoNavigate(!!s?.autoNavigate);
    setRequireTargetClick(!!s?.requireTargetClick);
  }, [day, step]);

  // ── element picker ──
  const lastOutlinedRef = useRef<{
    el: Element;
    outline: string;
    outlineOffset: string;
  } | null>(null);
  const clearHoverOutline = useCallback(() => {
    const last = lastOutlinedRef.current;
    if (last) {
      try {
        (last.el as HTMLElement).style.outline = last.outline;
        (last.el as HTMLElement).style.outlineOffset = last.outlineOffset;
      } catch {
        /* noop */
      }
      lastOutlinedRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!picking) {
      clearHoverOutline();
      return;
    }
    if (typeof document === "undefined") return;

    const onMove = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      // customizer 자체는 picker 대상에서 제외
      if (el.closest("[data-tutorial-customizer]")) return;
      if (el === hoverEl) return;
      clearHoverOutline();
      try {
        const html = el as HTMLElement;
        lastOutlinedRef.current = {
          el,
          outline: html.style.outline,
          outlineOffset: html.style.outlineOffset,
        };
        html.style.outline = "3px dashed #fbbf24";
        html.style.outlineOffset = "2px";
      } catch {
        /* noop */
      }
      setHoverEl(el);
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (el.closest("[data-tutorial-customizer]")) return;
      e.preventDefault();
      e.stopPropagation();
      const sel = buildSelectorFor(el);
      setSelector(sel);
      setPicking(false);
      clearHoverOutline();
      setHoverEl(null);
      // 64-AE: 캡처 직후 amber pulse 강조 — 회원이 시각적으로 인지
      setJustCaptured(true);
      window.setTimeout(() => setJustCaptured(false), 1500);
      toast.success(`✅ 선택됨: ${describeSelector(sel)}`, {
        description: sel + " — 아래에서 설정 변경 후 저장",
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPicking(false);
        clearHoverOutline();
        setHoverEl(null);
      }
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      clearHoverOutline();
    };
  }, [picking, hoverEl, clearHoverOutline]);

  const handleSave = () => {
    const patch: TutorialStepOverridePartial = {
      targetSelector: selector,
      autoAdvance,
      autoNavigate,
      requireTargetClick,
    };
    setStepOverride(day, step, patch);
    toast.success("저장됨 — 새로고침하면 적용", {
      description: `${day}일차 · ${step + 1}번째 단계`,
    });
  };

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleOpenFullEditor = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(TUTORIAL_DEV_OPEN_EVENT));
    }
  };

  if (!eligible || !isAdmin) return null;

  return (
    <div data-tutorial-customizer="true">
      {/* picker 활성 시 화면 상단 안내 */}
      <AnimatePresence>
        {picking && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed left-1/2 top-3 z-[120] -translate-x-1/2 rounded-full border border-amber-300/60 bg-amber-500/95 px-4 py-2 text-[12px] font-black text-amber-950 shadow-2xl"
          >
            🎯 화면에서 강조할 곳을 클릭하세요 (ESC: 취소)
          </motion.div>
        )}
      </AnimatePresence>

      {/* floating button */}
      {!open && (
        <motion.button
          type="button"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setOpen(true)}
          aria-label="듀토리얼 커스텀 도구 열기"
          className="fixed right-3 top-1/2 z-[96] -translate-y-1/2 inline-flex flex-col items-center gap-1 rounded-l-2xl border border-amber-400/40 bg-amber-600/95 px-2 py-3 text-[10px] font-black tracking-wider text-amber-50 shadow-2xl backdrop-blur-sm hover:bg-amber-500"
        >
          <Wrench className="h-4 w-4" />
          <span style={{ writingMode: "vertical-rl" }}>커스텀</span>
        </motion.button>
      )}

      {/* sidebar panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{
              /* 64-AE: picker 시 0.35 / 64-AG: dimmed 시 0.25 / 평소 1 */
              opacity: picking ? 0.35 : dimmed ? 0.25 : 1,
              x: 0,
            }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ duration: 0.25 }}
            onMouseDown={() => setDimmed(false)}
            className="fixed right-0 top-12 z-[96] flex max-h-[80dvh] w-[320px] flex-col overflow-y-auto rounded-l-2xl border border-amber-400/40 bg-[#0a1024]/97 text-amber-50 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
          >
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-400/20 bg-[#0a1024]/98 px-3 py-2.5 backdrop-blur-md">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-300">
                  관리자 커스텀 도구
                </p>
                <p className="text-[12px] font-bold text-amber-50">
                  {day}일차 · {step + 1}번째 단계
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPicking(false);
                }}
                className="rounded-full border border-amber-400/30 bg-black/30 p-1 text-amber-200 hover:bg-black/50"
                aria-label="닫기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 p-3">
              {/* 안내 */}
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-amber-100">
                💡 화면을 보면서 빠르게 단계를 고치는 도구예요.
                바꾼 내용은 <strong>관리자 본인 화면</strong>에만 적용돼요.
              </p>

              {/* 64-AH: 상단 picker / 토글 / 저장 영역 제거.
                  각 단계 row 의 ✏️ 수정 패널에서 동일 기능 가능 (중복 제거).
                  필요 시 git 히스토리 9c18865 참조. */}

              {/* 64-W: 단계 순서 정하기 */}
              <StepOrderPanel
                day={day}
                onChanged={() => {
                  /* 변경은 localStorage 즉시. 미리보기 위해 새로고침 권장 */
                }}
              />

              {/* 미리보기 — 1~7 일차 선택 (커스텀만) + 별도 시작 버튼 */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-amber-100">
                  📅 어느 일차를 편집할까요?
                </p>
                <p className="text-[10px] text-amber-200/65">
                  버튼을 누르면 그 일차의 단계 순서 / 설정이 아래에 표시돼요.
                  <br />
                  실제 화면 미리보기는 ▶ '시작' 버튼 누른 뒤 진행됩니다.
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                    const isPreview = previewDay === d;
                    const isRunning =
                      camp.state.currentDay === d &&
                      camp.state.status === "active";
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setPreviewDay(d);
                          toast.success(`📅 ${d}일차 편집 모드`, {
                            description:
                              "단계 순서 / 설정이 아래에 표시됩니다",
                            id: `preview-day-${d}`,
                          });
                        }}
                        className={`relative flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-[10px] font-black transition-all active:scale-95 ${
                          isPreview
                            ? "border-amber-300 bg-amber-500/30 text-amber-50"
                            : "border-amber-400/30 bg-black/30 text-amber-100/80 hover:bg-black/50"
                        }`}
                      >
                        <span className="text-[8px] font-bold opacity-70">
                          DAY
                        </span>
                        <span>{d}</span>
                        {isRunning && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* 시작 버튼 — 별도 큰 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    camp.goToDayStep(previewDay, 0);
                    if (camp.state.status !== "active") camp.start();
                    setOpen(false);
                    toast.success(
                      `🎬 ${previewDay}일차 미리보기 시작 — 화면을 따라가보세요`,
                      {
                        description:
                          "다시 customizer 를 열려면 우측 'Wrench 커스텀' 버튼",
                      },
                    );
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2.5 text-[12px] font-black text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-[0.98]"
                >
                  <Play className="h-4 w-4 fill-emerald-950" />▶ {previewDay}
                  일차 처음부터 시작
                </button>
                <p className="text-[9.5px] text-amber-200/55">
                  ※ 1~7 일차 버튼은 편집/설정만 전환. 실제 진행은 위 ▶ 버튼.
                  회원에게는 영향 없어요.
                </p>
              </div>

              {/* 최종 저장 + 새로고침 */}
              <button
                type="button"
                onClick={() => {
                  toast.success("저장 완료 — 새로고침 후 반영", {
                    description: "변경 사항은 본인 화면에만 적용됩니다",
                  });
                  setTimeout(() => {
                    if (typeof window !== "undefined") window.location.reload();
                  }, 800);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2.5 text-[12px] font-black text-amber-50 hover:bg-amber-500"
              >
                <Save className="h-4 w-4" />
                💾 최종 저장 + 새로고침 (바로 반영)
              </button>

              {/* 전체 편집 (modal) */}
              <button
                type="button"
                onClick={handleOpenFullEditor}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20"
              >
                <Settings2 className="h-3.5 w-3.5" />
                전체 편집기 열기 (모든 필드)
              </button>

              <p className="text-[9px] leading-relaxed text-amber-200/55">
                ※ 더 자세한 편집 (helper / success 메시지, completionRule 등)은
                전체 편집기에서.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 64-W: StepOrderPanel — 현재 day 의 step 순서 reorder
// ─────────────────────────────────────────────────────────────
function StepOrderPanel({
  day,
  onChanged,
}: {
  day: number;
  onChanged: () => void;
}) {
  const [bump, setBump] = useState(0); // re-read trigger
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // 현재 보이는 순서 (order 적용된 step list)
  const list = getStepsByDay(day);
  // 현재 빠진 (hidden) step list
  const hiddenList = getHiddenStepsForDay(day);
  const customOrder = getStepOrderForDay(day);

  // base step 의 original step 번호로 표시된 order (없으면 자동 생성)
  const orderedOriginalSteps =
    customOrder ?? list.map((s) => s.step);

  // 64-AB: list idx → original step 번호 (base 또는 custom).
  //   targetKey 로 lookup — order reassign 후에도 정확히 매핑.
  const allOriginalSteps: TutorialCampStep[] = [
    ...TUTORIAL_CAMP_STEPS.filter((s) => s.day === day),
    ...getCustomStepsForDay(day),
  ];
  const findOriginalStepNo = (s: TutorialCampStep): number => {
    const found = allOriginalSteps.find((o) => o.targetKey === s.targetKey);
    return found?.step ?? s.step;
  };

  // ↑ ↓ 핸들러 — order 가 없으면 먼저 ensure
  const move = (idx: number, delta: -1 | 1) => {
    if (!customOrder) ensureFullOrderForDay(day);
    const current = getStepOrderForDay(day) ?? orderedOriginalSteps;
    const next = [...current];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setStepOrderForDay(day, next);
    setBump((b) => b + 1);
    onChanged();
  };

  // 🗑️ 빼기 — order 에서 해당 step 제거
  const removeAt = (idx: number) => {
    if (!customOrder) ensureFullOrderForDay(day);
    const current = getStepOrderForDay(day) ?? orderedOriginalSteps;
    const next = current.filter((_, i) => i !== idx);
    setStepOrderForDay(day, next);
    setBump((b) => b + 1);
    onChanged();
  };

  // ➕ 다시 넣기 — hidden step 을 order 끝에 추가
  const addStep = (originalStep: number) => {
    const current =
      getStepOrderForDay(day) ?? list.map((s) => s.step);
    if (current.includes(originalStep)) return;
    setStepOrderForDay(day, [...current, originalStep]);
    setBump((b) => b + 1);
    onChanged();
  };

  const reset = () => {
    clearStepOrderForDay(day);
    setBump((b) => b + 1);
    onChanged();
  };

  void bump; // re-render trigger

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-amber-100">
          📋 단계 순서 / 추가·빼기 ({day}일차)
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-0.5 rounded-md border border-amber-400/30 bg-black/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 hover:bg-black/50"
          title="원래대로"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          원래대로
        </button>
      </div>

      {/* 보이는 단계 (회원이 진행) */}
      <div>
        <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-emerald-300/80">
          ✓ 보이는 단계 ({list.length}개)
        </p>
        <div className="space-y-1.5 rounded-lg border border-amber-400/15 bg-black/20 p-1.5">
          {list.map((s, idx) => {
            const isEditing = editingIdx === idx;
            const originalStepNo = findOriginalStepNo(s);
            return (
              <div
                key={`v-${day}-${idx}-${s.title}`}
                className="rounded-md bg-black/30 px-2 py-1.5 text-[10.5px]"
              >
                {/* 1행: 번호 + 제목 + 버튼 */}
                <div className="flex items-center gap-1">
                  <span className="number-font w-5 shrink-0 text-center font-black text-amber-300">
                    {idx + 1}
                  </span>
                  <p className="flex-1 truncate text-amber-100 font-bold">
                    {s.title || "(제목 없음)"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingIdx(isEditing ? null : idx)}
                    className={`rounded border p-0.5 ${
                      isEditing
                        ? "border-amber-300 bg-amber-500/30 text-amber-100"
                        : "border-amber-400/30 bg-black/30 text-amber-200 hover:bg-black/50"
                    }`}
                    aria-label="수정"
                    title="기능 수정"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="rounded border border-amber-400/30 bg-black/30 p-0.5 text-amber-200 disabled:opacity-30 hover:bg-black/50"
                    aria-label="위로"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === list.length - 1}
                    className="rounded border border-amber-400/30 bg-black/30 p-0.5 text-amber-200 disabled:opacity-30 hover:bg-black/50"
                    aria-label="아래로"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="rounded border border-rose-400/40 bg-rose-950/30 p-0.5 text-rose-200 hover:bg-rose-950/50"
                    aria-label="빼기"
                    title="이 단계 빼기"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {/* 2행: 효과 / 기능 badge */}
                <StepBadges step={s} />
                {/* 3행: 편집 패널 (✏️ 클릭 시) */}
                {isEditing && (
                  <InlineRowEditor
                    day={day}
                    originalStep={originalStepNo}
                    listIdx={idx}
                    currentStep={s}
                    onSaved={() => {
                      setEditingIdx(null);
                      setBump((b) => b + 1);
                      onChanged();
                    }}
                    onCancel={() => setEditingIdx(null)}
                  />
                )}
              </div>
            );
          })}
          {list.length === 0 && (
            <p className="px-2 py-3 text-center text-[10px] text-amber-200/50">
              보이는 단계가 없어요. 아래에서 다시 넣어보세요.
            </p>
          )}
        </div>
      </div>

      {/* 빠진 단계 (hidden) — 항상 표시. 0개일 때 안내. */}
      <div>
        <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-rose-300/80">
          ✗ 빠진 단계 ({hiddenList.length}개)
        </p>
        <div className="space-y-1 rounded-lg border border-rose-400/15 bg-rose-950/10 p-1.5">
          {hiddenList.length === 0 ? (
            <p className="px-2 py-2.5 text-center text-[10px] leading-relaxed text-rose-200/55">
              빠진 단계가 없어요.
              <br />
              <span className="text-amber-200/65">위에서 🗑️ 빼기</span> 누르면
              여기로 이동합니다.
              <br />
              여기에서 <span className="text-emerald-300/85">➕ 다시</span> 누르면
              보이는 단계로 복귀.
            </p>
          ) : (
            hiddenList.map((s) => (
              <div
                key={`h-${day}-${s.step}-${s.title}`}
                className="flex items-center gap-1 rounded-md bg-black/30 px-2 py-1.5 text-[10.5px] opacity-80"
              >
                <p className="flex-1 truncate text-rose-100/85 line-through">
                  {s.title || "(제목 없음)"}
                </p>
                <button
                  type="button"
                  onClick={() => addStep(s.step)}
                  className="inline-flex items-center gap-0.5 rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-200 hover:bg-emerald-500/25"
                  title="다시 넣기"
                >
                  <Plus className="h-2.5 w-2.5" />
                  다시
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 새 단계 만들기 */}
      <NewStepForm
        day={day}
        onCreated={() => {
          setBump((b) => b + 1);
          onChanged();
        }}
      />

      <p className="text-[9.5px] text-amber-200/55">
        ↑↓ 순서 변경 · 🗑️ 빼기 · ➕ 다시 넣기 · ✨ 새 단계 만들기. '미리보기' /
        '최종 저장' 으로 적용.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 64-Y: NewStepForm — 관리자가 새 step 직접 생성
// ─────────────────────────────────────────────────────────────
function NewStepForm({
  day,
  onCreated,
}: {
  day: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("/home");
  const [targetSelector, setTargetSelector] = useState("");
  const [helperMessage, setHelperMessage] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [requireTargetClick, setRequireTargetClick] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setRoute("/home");
    setTargetSelector("");
    setHelperMessage("");
    setAutoAdvance(true);
    setAutoNavigate(false);
    setRequireTargetClick(false);
  };

  const onSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("제목을 입력해주세요");
      return;
    }
    // 보이는 단계로 자동 등록 위해 order 보장
    ensureFullOrderForDay(day);
    addCustomStep(day, {
      title: trimmed,
      body: body.trim(),
      route: route.trim() || "/home",
      targetSelector: targetSelector.trim(),
      helperMessage: helperMessage.trim() || undefined,
      autoAdvance,
      autoNavigate,
      requireTargetClick,
      completionRule: requireTargetClick ? "target_clicked" : "quiz_question_read",
      blockNextUntilComplete: requireTargetClick,
    });
    toast.success(`✨ 새 단계 추가됨: "${trimmed}"`, {
      description: `${day}일차 끝에 추가됨. ↑↓ 로 위치 조정 가능.`,
    });
    reset();
    setOpen(false);
    onCreated();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-amber-400/40 bg-amber-500/5 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-500/15 active:scale-[0.98]"
      >
        <Plus className="h-3.5 w-3.5" />✨ 새 단계 만들기
      </button>
    );
  }

  const inputCls =
    "w-full rounded-md border border-amber-400/20 bg-black/30 px-2 py-1 text-[10.5px] font-mono text-amber-100 focus:outline-none focus:border-amber-400/60";

  return (
    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-500/5 p-2.5">
      <p className="text-[11px] font-bold text-amber-100">✨ 새 단계 만들기</p>

      <label className="block">
        <span className="text-[10px] font-bold text-amber-200/85">제목 *</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 오늘의 보상 확인하기"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold text-amber-200/85">
          안내 본문 (선택)
        </span>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="회원에게 보여줄 설명 한 줄"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold text-amber-200/85">
          어느 페이지에서? (route)
        </span>
        <input
          type="text"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          placeholder="/home / /missions / /myboxer/quest 등"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold text-amber-200/85">
          가리킬 element (선택)
        </span>
        <input
          type="text"
          value={targetSelector}
          onChange={(e) => setTargetSelector(e.target.value)}
          placeholder='[data-tour="..."] 또는 비워두면 가운데 카드'
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold text-amber-200/85">
          👆 안내 한 줄 (helper, 선택)
        </span>
        <input
          type="text"
          value={helperMessage}
          onChange={(e) => setHelperMessage(e.target.value)}
          placeholder="예: 여기를 눌러보세요"
          className={inputCls}
        />
      </label>

      <div className="space-y-1">
        <CompactToggle
          label="완료 시 자동 다음으로"
          checked={autoAdvance}
          onChange={setAutoAdvance}
        />
        <CompactToggle
          label="시작 시 페이지 자동 이동"
          checked={autoNavigate}
          onChange={setAutoNavigate}
        />
        <CompactToggle
          label="회원이 꼭 카드 클릭"
          checked={requireTargetClick}
          onChange={setRequireTargetClick}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-amber-500 px-2 py-1.5 text-[11px] font-black text-amber-950 hover:bg-amber-400"
        >
          ✨ 추가하기
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-md border border-amber-400/30 bg-black/30 px-2 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-black/50"
        >
          취소
        </button>
      </div>

      <p className="text-[9px] leading-relaxed text-amber-200/55">
        ※ 만든 단계는 {day}일차 끝에 추가돼요. ↑↓ 로 원하는 위치로 옮길 수 있어요.
      </p>
    </div>
  );
}

// 64-AD: customizer sidebar 닫기 — window event 로 깊은 prop drilling 회피
const CUSTOMIZER_CLOSE_EVENT = "tutorial-customizer-close";
// 64-AG: customizer 흐리게 (닫지 않고 dim) — 회원이 화면 작업 가능, focus 시 복귀
const CUSTOMIZER_DIM_EVENT = "tutorial-customizer-dim";

// ─────────────────────────────────────────────────────────────
// 64-AD: PreviewLocationButton — selector 가 다른 페이지면 navigate 후 강조
// ─────────────────────────────────────────────────────────────
function PreviewLocationButton({
  selector,
  stepRoute,
  day,
  listIdx,
}: {
  selector: string;
  stepRoute: string;
  day?: number;
  listIdx?: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const camp = useTutorialCamp();

  const onClick = () => {
    const trimmed = selector.trim();

    // 0) selector 비어있음 → 화면 가운데 큰 카드. 실제 step 으로 jump 해서
    //    회원이 보는 그대로 시뮬레이션 (Day 완료 confetti 화면 등).
    if (!trimmed) {
      if (typeof day === "number" && typeof listIdx === "number") {
        window.dispatchEvent(new Event(CUSTOMIZER_DIM_EVENT));
        camp.goToDayStep(day, listIdx);
        if (camp.state.status !== "active") camp.start();
        toast.success("🎬 이 단계 직접 시뮬레이션", {
          description:
            "selector 가 비어있어 화면 가운데 큰 카드로 표시됩니다 (확인 후 다시 customizer 열기)",
        });
      } else {
        toast.error("📍 위치 확인 실패", {
          description:
            "selector 가 비어있어요 — 화면 가운데 큰 카드로 표시됩니다",
        });
      }
      return;
    }

    // 1) 현재 페이지에서 element 찾기
    let el: HTMLElement | null = null;
    try {
      el = document.querySelector(trimmed) as HTMLElement | null;
    } catch {
      toast.error("📍 위치 확인 실패", {
        description: "selector 형식 오류 — 다시 확인해주세요",
      });
      return;
    }

    // 2) 현재 페이지에 있으면 즉시 강조 (customizer 닫음)
    if (el) {
      window.dispatchEvent(new Event(CUSTOMIZER_DIM_EVENT));
      window.setTimeout(() => {
        const r = previewSelector(trimmed);
        if (r.ok) {
          toast.success("📍 강조 표시 (1.5초)", { description: r.message });
        } else {
          toast.error("📍 위치 확인 실패", { description: r.message });
        }
      }, 200);
      return;
    }

    // 3) 매칭 실패 → 무조건 customizer 닫고 stepRoute 로 navigate.
    //    같은 라우트라도 customizer 가림이 사라져 회원이 화면 조작 가능.
    //    1초 / 2.5초 두 번 재시도 — 동적 mount (탭 토글 등) 대응.
    window.dispatchEvent(new Event(CUSTOMIZER_DIM_EVENT));
    if (stepRoute && location.pathname !== stepRoute) {
      toast.success("📍 페이지로 이동 후 강조", {
        description: `${stepRoute} 로 이동 → 자동 강조 시도`,
      });
      navigate(stepRoute);
    } else {
      toast.success("📍 화면에서 찾는 중", {
        description:
          stepRoute === location.pathname
            ? "같은 페이지 — 보이는 영역으로 스크롤 후 강조 시도"
            : "selector 매칭 시도",
      });
    }
    const tryHighlight = () => previewSelector(trimmed);
    window.setTimeout(() => {
      if (tryHighlight().ok) return;
      // 동적 mount 대비 — 추가 1.5초 후 재시도
      window.setTimeout(() => {
        const r2 = tryHighlight();
        if (!r2.ok) {
          toast.error("📍 element 못 찾음", {
            description:
              "selector 다시 확인하거나 해당 탭/메뉴를 직접 눌러 mount 시켜주세요",
          });
        }
      }, 1500);
    }, 1000);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-amber-400/40 bg-black/30 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-black/50"
    >
      📍 화면에서 위치 보기 (페이지 자동 이동)
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 64-AB: InlineRowEditor — row 안에서 직접 그 step 의 효과/기능 수정
// ─────────────────────────────────────────────────────────────
function InlineRowEditor({
  day,
  originalStep,
  listIdx,
  currentStep,
  onSaved,
  onCancel,
}: {
  day: number;
  originalStep: number;
  listIdx: number;
  currentStep: TutorialCampStep;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TutorialStepOverridePartial>(() => ({
    title: currentStep.title ?? "",
    body: currentStep.body ?? "",
    targetSelector: currentStep.targetSelector ?? "",
    placement: currentStep.placement ?? "bottom",
    autoAdvance: !!currentStep.autoAdvance,
    autoNavigate: !!currentStep.autoNavigate,
    requireTargetClick: !!currentStep.requireTargetClick,
    blockNextUntilComplete: !!currentStep.blockNextUntilComplete,
    completionRule: currentStep.completionRule,
    helperMessage: currentStep.helperMessage,
    successMessage: currentStep.successMessage,
  }));

  const update = (patch: TutorialStepOverridePartial) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  // 64-AF: InlineRowEditor 안 element picker
  const picker = usePicker((sel) => {
    update({ targetSelector: sel });
  });

  const onSave = () => {
    setStepOverride(day, originalStep, draft);
    toast.success(`✏️ "${currentStep.title}" 수정 저장됨`, {
      description: "새로고침 후 회원에게도 반영하려면 코드 영구 반영",
    });
    onSaved();
  };

  const onResetThis = () => {
    clearStepOverride(day, originalStep);
    toast.success("이 단계 원래 설정으로 복귀");
    onSaved();
  };

  const inputCls =
    "w-full rounded-md border border-amber-400/20 bg-black/40 px-2 py-1 text-[10.5px] font-mono text-amber-100 focus:outline-none focus:border-amber-400/60";

  return (
    <div className="mt-2 space-y-2 rounded-md border border-amber-400/30 bg-amber-500/5 p-2">
      <p className="text-[10px] font-bold text-amber-200">
        ✏️ 이 단계 기능 수정
      </p>

      {/* title */}
      <label className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          📌 단계 제목
        </span>
        <input
          type="text"
          value={draft.title ?? ""}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="예: 훈련 화면, 배우기 탭, 수업실행 탭"
          className={inputCls}
        />
      </label>

      {/* body */}
      <label className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          📝 안내 본문 (회원이 카드에서 보는 설명)
        </span>
        <input
          type="text"
          value={draft.body ?? ""}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="예: 여기가 마이복서153의 훈련 메인 화면이에요."
          className={inputCls}
        />
      </label>

      {/* selector */}
      <div className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          🎯 가리킬 element
        </span>
        {/* picker 버튼 — 화면 element click 으로 자동 캡처 */}
        <button
          type="button"
          onClick={() => (picker.picking ? picker.stop() : picker.start())}
          className={`mb-1 inline-flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-black transition-all ${
            picker.picking
              ? "bg-rose-500 text-white animate-pulse"
              : "bg-amber-500 text-amber-950 hover:bg-amber-400"
          }`}
        >
          <Pointer className="h-3 w-3" />
          {picker.picking
            ? "취소 (ESC)"
            : "🎯 화면에서 element 선택"}
        </button>
        <input
          type="text"
          value={draft.targetSelector ?? ""}
          onChange={(e) => update({ targetSelector: e.target.value })}
          placeholder='[data-tour="..."] 또는 비워두면 가운데'
          className={inputCls}
        />
        {/* 한글 라벨 — 어디인지 자동 표시 */}
        <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">
          🏷️ {describeSelector(draft.targetSelector ?? "")}
        </p>
        {/* 화면에서 위치 보기 버튼 — 다른 페이지면 자동 navigate 후 강조 */}
        <PreviewLocationButton
          selector={draft.targetSelector ?? ""}
          stepRoute={currentStep.route}
          day={day}
          listIdx={listIdx}
        />
        <p className="mt-0.5 text-[9px] text-amber-200/55">
          ※ 다른 페이지에 있으면 자동으로 이동 + customizer 닫음 → 강조 표시
        </p>
      </div>

      {/* placement */}
      <label className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          💬 카드 위치
        </span>
        <select
          value={draft.placement ?? "bottom"}
          onChange={(e) =>
            update({
              placement:
                e.target.value as TutorialStepOverridePartial["placement"],
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

      {/* completion rule */}
      <label className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          ✅ 어떻게 완료되나요?
        </span>
        <select
          value={draft.completionRule ?? ""}
          onChange={(e) =>
            update({
              completionRule:
                (e.target.value ||
                  undefined) as TutorialStepOverridePartial["completionRule"],
            })
          }
          className={inputCls}
        >
          <option value="">(설정 안 함 — 다음으로 직접)</option>
          <option value="target_clicked">회원이 카드를 눌렀을 때</option>
          <option value="quiz_question_read">4초 동안 읽기 (자동)</option>
          <option value="quiz_answer_selected">퀴즈 답 골랐을 때</option>
          <option value="quiz_correct_answer_selected">정답 골랐을 때</option>
          <option value="scrolled_to_bottom">맨 아래까지 스크롤</option>
          <option value="text_input_min_length">글 일정 길이 입력</option>
          <option value="option_selected">옵션 골랐을 때</option>
          <option value="toggle_selected">토글 눌렀을 때</option>
          <option value="condition_checked">컨디션 체크</option>
          <option value="modal_closed">모달 닫혔을 때</option>
          <option value="manual_confirm">언제든 통과</option>
        </select>
      </label>

      {/* 토글 4개 */}
      <div className="space-y-1">
        <CompactToggle
          label="완료 시 자동 다음으로"
          checked={!!draft.autoAdvance}
          onChange={(v) => update({ autoAdvance: v })}
        />
        <CompactToggle
          label="시작 시 페이지 자동 이동"
          checked={!!draft.autoNavigate}
          onChange={(v) => update({ autoNavigate: v })}
        />
        <CompactToggle
          label="회원이 꼭 카드 클릭"
          checked={!!draft.requireTargetClick}
          onChange={(v) => update({ requireTargetClick: v })}
        />
        <CompactToggle
          label="완료 전에 '다음으로' 잠그기"
          checked={!!draft.blockNextUntilComplete}
          onChange={(v) => update({ blockNextUntilComplete: v })}
        />
      </div>

      {/* helper / success */}
      <label className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          🗨️ 안내 한 줄 (행동 전)
        </span>
        <input
          type="text"
          value={draft.helperMessage ?? ""}
          onChange={(e) => update({ helperMessage: e.target.value })}
          placeholder="예: 👆 여기를 눌러보세요"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-[9.5px] font-bold text-amber-200/85">
          🎉 칭찬 한 줄 (행동 후)
        </span>
        <input
          type="text"
          value={draft.successMessage ?? ""}
          onChange={(e) => update({ successMessage: e.target.value })}
          placeholder="예: 잘했어요!"
          className={inputCls}
        />
      </label>

      {/* 저장 / 원래대로 / 닫기 */}
      <div className="flex gap-1.5 pt-1">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-amber-500 px-2 py-1.5 text-[10.5px] font-black text-amber-950 hover:bg-amber-400"
        >
          💾 저장
        </button>
        <button
          type="button"
          onClick={onResetThis}
          className="rounded-md border border-amber-400/30 bg-black/30 px-2 py-1.5 text-[10.5px] font-bold text-amber-200 hover:bg-black/50"
          title="이 단계 원래 설정으로"
        >
          ↩️
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-amber-400/30 bg-black/30 px-2 py-1.5 text-[10.5px] font-bold text-amber-200 hover:bg-black/50"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 64-Z: StepBadges — 단계의 효과 / 기능을 작은 chip 으로 시각화
// ─────────────────────────────────────────────────────────────
const COMPLETION_RULE_LABEL: Record<string, string> = {
  target_clicked: "👆 클릭",
  quiz_question_read: "⏱️ 4초 자동",
  quiz_answer_selected: "✅ 답 선택",
  quiz_correct_answer_selected: "🎯 정답",
  scrolled_to_bottom: "⬇️ 스크롤",
  text_input_min_length: "✏️ 입력",
  option_selected: "🔘 옵션",
  toggle_selected: "🔘 토글",
  condition_checked: "☑️ 체크",
  modal_closed: "✖️ 모달닫힘",
  manual_confirm: "↪️ 수동",
};

const PLACEMENT_LABEL: Record<string, string> = {
  top: "📍위",
  bottom: "📍아래",
  left: "📍왼쪽",
  right: "📍오른쪽",
  center: "📍가운데",
};

interface BadgeStep {
  targetSelector: string;
  placement: string;
  completionRule?: string;
  autoAdvance?: boolean;
  autoNavigate?: boolean;
  requireTargetClick?: boolean;
  blockNextUntilComplete?: boolean;
  helperMessage?: string;
  successMessage?: string;
}

function StepBadges({ step }: { step: BadgeStep }) {
  const sel = (step.targetSelector ?? "").trim();
  const targetLabel = sel ? SELECTOR_LABELS_LITE[sel] ?? "사용자 selector" : "🌐 화면 가운데";
  const placement = PLACEMENT_LABEL[step.placement] ?? `📍${step.placement}`;
  const rule = step.completionRule
    ? COMPLETION_RULE_LABEL[step.completionRule] ?? `📋 ${step.completionRule}`
    : null;
  const isCustom = step.targetSelector?.includes("custom_") ||
    (typeof (step as { step?: number }).step === "number" &&
      (step as unknown as { step: number }).step >= 1000);

  return (
    <div className="mt-1 flex flex-wrap gap-1 pl-6">
      {isCustom && (
        <span className="rounded-full bg-purple-500/25 px-1.5 py-0.5 text-[9px] font-bold text-purple-200">
          ✨ 새 단계
        </span>
      )}
      <span
        className="max-w-[180px] truncate rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-200"
        title={sel || "selector 비어있음"}
      >
        🎯 {targetLabel}
      </span>
      <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200">
        {placement}
      </span>
      {rule && (
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-200">
          {rule}
        </span>
      )}
      {step.autoAdvance && (
        <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-200">
          ⏩ 자동 다음
        </span>
      )}
      {step.autoNavigate && (
        <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-200">
          🚀 페이지 자동
        </span>
      )}
      {step.requireTargetClick && (
        <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-200">
          🔒 클릭 필수
        </span>
      )}
      {step.blockNextUntilComplete && (
        <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-200">
          🔐 다음 잠금
        </span>
      )}
      {step.helperMessage && (
        <span
          className="max-w-[200px] truncate rounded-full bg-amber-300/10 px-1.5 py-0.5 text-[9px] italic text-amber-200/80"
          title={step.helperMessage}
        >
          🗨️ {step.helperMessage}
        </span>
      )}
    </div>
  );
}

function CompactToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-black/30 px-2.5 py-1.5 text-[10.5px] font-bold text-amber-100">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-amber-400"
      />
    </label>
  );
}

export default TutorialCustomizer;
