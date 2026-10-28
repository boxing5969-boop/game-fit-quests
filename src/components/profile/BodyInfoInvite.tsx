/**
 * ✨ 신체 정보를 아직 안 넣은 회원에게 — 눈에 띄게 권하기 (2026-10-27 대표님: "신체정보 입력칸 입력 안 한 사람은
 *   더 화려하게 보이게 해 주고 입력하라고 권유해 줘")
 *   무지개 테두리가 천천히 흐르고(움직임 줄이기 설정이면 멈춤) · 넣으면 오르는 정확도.
 *   2026-10-28 리디자인(글 줄이기): 한 줄 단추로 — 설명 문장 · 항목별 +% 칩은 신체 정보 시트 안에서 본다. 화려한 테두리는 그대로.
 *   쓰는 곳: 내 운동 기록 '153과 함께하며' — 키 · 몸무게를 하나도 안 넣었을 때만(bodyInfoEmpty).
 *
 * 💬 BodyInfoCoachNote — 정확도 칩을 누르면 오삼코치가 카톡 메시지처럼 (2026-10-28 대표님: "정확도 80% 이라고만 표기되어있어서
 *   사람들이 정보입력해야하는건지 모를것같아 버튼에 홀로그램 임펙트 효과 넣어주고 클릭해서 정보입력하라는 카톡 메시지 같이 팝업뜨게하자")
 *   대화방 하늘색 바탕 · 네모난 프로필 · 흰 말풍선(첫 줄에 꼬리)이 '쓰는 중 …' 뒤에 하나씩 · 마지막 말풍선 옆 시각 · 아래 노란 단추.
 *   말은 lib/fitnessProfile153 accuracyNote 한 곳 — 무엇을 넣으면 몇 %까지 오르는지(넣을 게 없으면 운동 끝 얼굴 인식 안내).
 *   대답 칸이 없는 안내 창이다(채팅 박스 아님). 움직임 줄이기 설정이면 말풍선이 한 번에 다 뜬다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { ACCURACY_POINTS, type AccuracyNote } from "@/lib/fitnessProfile153";
import { cn } from "@/lib/utils";

const TOTAL = ACCURACY_POINTS.weight + ACCURACY_POINTS.gender + ACCURACY_POINTS.age + ACCURACY_POINTS.bodyFat + ACCURACY_POINTS.height;

const BodyInfoInvite = ({ onClick, className, accuracyPct }: { onClick: () => void; className?: string; accuracyPct?: number }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="신체 정보 넣기 — 내 몸 기준으로 정확하게"
    className={cn(
      "group relative block w-full rounded-2xl bg-[linear-gradient(110deg,#10b981,#f59e0b,#ec4899,#8b5cf6,#10b981)] bg-[length:200%_100%] p-[2px] text-left shadow-[0_8px_24px_-12px_rgba(236,72,153,0.5)] transition-transform active:scale-[0.99] motion-safe:animate-sheen",
      className,
    )}
  >
    <span className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3.5">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-violet-500 text-white shadow-md">
        <Sparkles className="h-5 w-5" aria-hidden />
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-pink-500 ring-2 ring-card" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-black leading-snug text-foreground">내 몸 기준으로 바꿔 보세요</span>
        <span className="mt-0.5 block text-label font-bold text-pink-600 dark:text-pink-400">
          30초면 끝 · 정확도 +{TOTAL}%{accuracyPct != null ? ` (지금 ${accuracyPct}%)` : ""}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </span>
  </button>
);

export default BodyInfoInvite;

/** '오전 10:08' — 카톡 말풍선 옆 시각 */
const NOTE_TIME = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
/** 첫 말풍선 · 다음 말풍선 사이 (쓰는 중 … 이 보이는 시간) */
const FIRST_MS = 450;
const NEXT_MS = 650;

export const BodyInfoCoachNote = ({ open, note, onClose, onFill }: { open: boolean; note: AccuracyNote; onClose: () => void; onFill: () => void }) => {
  useModalDismiss(open, onClose);
  const total = note.lines.length;
  const [shown, setShown] = useState(0);
  const mainRef = useRef<HTMLButtonElement>(null);
  const time = useMemo(() => (open ? NOTE_TIME.format(new Date()) : ""), [open]);

  useEffect(() => {
    if (!open) {
      setShown(0);
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    let still = false;
    try {
      still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* 옛 브라우저 — 움직이게 둔다 */
    }
    if (still) {
      setShown(total);
      return;
    }
    const timers = Array.from({ length: total }, (_, i) => window.setTimeout(() => setShown(i + 1), FIRST_MS + i * NEXT_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open, total]);

  if (!open || typeof document === "undefined") return null;
  // 넣을 정보가 있으면 '지금 넣기' · 없으면(운동 끝 얼굴 인식 안내) '알겠어요' + '내 정보'
  const canFill = note.target != null;
  const typing = shown < total;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="body-info-coach-note"
        aria-describedby="body-info-coach-note-text"
        onClick={(e) => e.stopPropagation()}
        className="kakao-panel-in w-full max-w-[360px] overflow-hidden rounded-[28px] bg-[#B2C7DA] shadow-2xl"
      >
        {/* 화면 읽기 프로그램은 말풍선을 기다리지 않고 한 번에 */}
        <p id="body-info-coach-note-text" className="sr-only">
          {note.lines.join(" ")}
        </p>
        {/* 대화방 머리 */}
        <div className="flex h-14 items-center pl-5 pr-2">
          <p id="body-info-coach-note" className="min-w-0 flex-1 truncate text-body font-bold text-[#191919]">
            오삼코치
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#191919]/70 active:bg-black/10"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* 메시지 — 프로필 · 이름 · 말풍선 (아직 안 뜬 말풍선도 자리는 미리 잡아 창이 움직이지 않게) */}
        <div className="flex items-start gap-2.5 px-4 pb-6" aria-hidden>
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[16px] bg-[#FFE4E8]" aria-hidden>
            <img
              src="/assets/mascot/osami_wink.png"
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: "170%", left: "-43%", top: "-5%" }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label text-[#3E4A57]">오삼코치</p>
            <ul className="mt-1 space-y-1.5">
              {note.lines.map((line, i) => (
                <li key={i} className="relative flex items-end gap-1.5">
                  <span
                    className={cn(
                      "relative max-w-[236px] break-keep rounded-[16px] bg-white px-3.5 py-2.5 text-body leading-snug text-[#191919]",
                      i === 0 && "rounded-tl-[4px]",
                      i < shown ? "kakao-bubble-in" : "invisible",
                    )}
                  >
                    {i === 0 && <BubbleTail />}
                    {/* '95%까지'가 '95%' · '까지'로 갈라지지 않게 (글자 사이 줄바꿈 막는 보이지 않는 표시) */}
                    {line.replace(/%(?=[가-힣])/g, "%⁠")}
                  </span>
                  {/* 쓰는 중 … — 다음 말풍선 자리에 */}
                  {typing && i === shown && (
                    <span
                      className={cn(
                        "kakao-bubble-in absolute left-0 top-0 inline-flex h-[44px] items-center gap-1 rounded-[16px] bg-white px-4",
                        i === 0 && "rounded-tl-[4px]",
                      )}
                    >
                      {i === 0 && <BubbleTail />}
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="kakao-dot h-1.5 w-1.5 rounded-full bg-[#8A949E]" style={{ animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </span>
                  )}
                  {i === total - 1 && <span className={cn("shrink-0 pb-0.5 text-micro text-[#4F5B67]", typing && "invisible")}>{time}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 단추 — 카톡 입력창 자리 */}
        <div className="grid grid-cols-[1fr_1.5fr] gap-2 bg-white p-3">
          <button
            type="button"
            onClick={canFill ? onClose : onFill}
            className="h-12 rounded-2xl bg-[#F1F2F4] text-body font-bold text-[#191919] transition-transform active:scale-[0.98]"
          >
            {canFill ? "다음에" : "내 정보"}
          </button>
          <button
            ref={mainRef}
            type="button"
            onClick={canFill ? onFill : onClose}
            className="h-12 rounded-2xl bg-[#FEE500] text-body font-bold text-[#191919] transition-transform active:scale-[0.98]"
          >
            {canFill ? "지금 넣기" : "알겠어요"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** 첫 말풍선 왼쪽 위 꼬리 */
const BubbleTail = () => (
  <svg viewBox="0 0 8 11" className="absolute -left-[7px] top-0 h-[11px] w-2 fill-white" aria-hidden>
    <path d="M8 0H1.6C0.3 0-0.3 1.4 0.6 2.3L8 10.5Z" />
  </svg>
);
