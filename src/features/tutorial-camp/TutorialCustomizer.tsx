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
import { motion, AnimatePresence } from "framer-motion";
import { Pointer, Settings2, Save, X, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  isAdminPreviewRole,
  shouldShowDevPanel,
} from "./tutorialCampDevAccess";
import {
  getStep,
  getStepOverride,
  setStepOverride,
  type TutorialStepOverridePartial,
} from "./tutorialCampSteps";
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

  // step 변경 시 draft 동기화
  const day = camp.state.currentDay;
  const step = camp.state.currentStep;
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
      toast.success(`선택됨: ${describeSelector(sel)}`, {
        description: sel,
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
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ duration: 0.25 }}
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

              {/* element picker */}
              <div>
                <p className="mb-1 text-[11px] font-bold text-amber-100">
                  👉 어디를 가리킬까요?
                </p>
                <button
                  type="button"
                  onClick={() => setPicking((p) => !p)}
                  className={`mb-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black transition-all ${
                    picking
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-amber-500 text-amber-950 hover:bg-amber-400"
                  }`}
                >
                  <Pointer className="h-3.5 w-3.5" />
                  {picking
                    ? "클릭 모드 끄기 (ESC)"
                    : "🎯 화면에서 element 선택"}
                </button>
                <input
                  type="text"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder='[data-tour="..."] 또는 빈 값'
                  className="w-full rounded-lg border border-amber-400/20 bg-black/30 px-2 py-1.5 text-[11px] font-mono text-amber-100 focus:border-amber-400/60 focus:outline-none"
                />
                <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10.5px] font-bold text-amber-200">
                  🏷️ {describeSelector(selector)}
                </p>
              </div>

              {/* 자동 진행 토글 */}
              <div>
                <p className="mb-1.5 text-[11px] font-bold text-amber-100">
                  ⚙️ 자동 진행
                </p>
                <div className="space-y-1.5">
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
              </div>

              {/* 저장 / 새로고침 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-[11px] font-black text-amber-950 hover:bg-amber-400 active:scale-[0.98]"
                >
                  <Save className="h-3.5 w-3.5" />
                  저장
                </button>
                <button
                  type="button"
                  onClick={handleReload}
                  className="rounded-lg border border-amber-400/40 bg-black/30 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-black/50"
                >
                  🔄 새로고침
                </button>
              </div>

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
