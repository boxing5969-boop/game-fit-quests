/**
 * 마이복서153 — 오삼이 홈 한마디 (단계 47).
 *
 * 짧은 한 줄로 오늘의 시작을 가볍게 정리.
 * 기존 OsamiDailyBriefingCard 와 톤은 통일하되 화면 차지 면적은 작게.
 *
 * 단계 50 업데이트: 🥊 이모지 → OsamMascot 미니 PNG (10표정 매핑).
 *   날짜 인덱스에 따라 5개 노트와 매칭되는 5개 표정이 매일 회전.
 *
 * 보호 규칙:
 *   · DB / API 호출 0
 *   · 표현 금지어 0
 */

import { useMemo } from "react";
import OsamMascot, { type OsamState } from "@/components/mascot/OsamMascot";

interface DailyNote {
  text: string;
  state: OsamState;
}

const NOTES: DailyNote[] = [
  { text: "오삼이가 오늘의 시작을 정리해드릴게요.", state: "smile" },
  { text: "오늘도 153복싱짐에 와줘서 고마워요.", state: "wink" },
  { text: "오늘은 한 가지만, 가볍게 시작해요.", state: "determined" },
  { text: "잘하려고 애쓰지 않아도 돼요. 한 번 해보면 돼요.", state: "shy" },
  { text: "153복싱짐에서 쌓은 기록은 나를 다시 세우는 증거가 됩니다.", state: "victory" },
];

function pickNoteByDay(now: Date = new Date()): DailyNote {
  // 같은 날에는 같은 한 줄 — 회원이 새로고침해도 메시지 안 흔들림
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return NOTES[dayOfYear % NOTES.length];
}

const OsamiHomeNote = () => {
  const note = useMemo(() => pickNoteByDay(), []);

  return (
    <section
      data-tour="home-osami-note"
      className="surface-card border border-border bg-card"
      aria-label="오삼이 한마디"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <OsamMascot size="xs" state={note.state} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            오삼이 한마디
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
            {note.text}
          </p>
        </div>
      </div>
    </section>
  );
};

export default OsamiHomeNote;
