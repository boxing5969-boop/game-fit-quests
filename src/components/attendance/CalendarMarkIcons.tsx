/**
 * 📅 운동 달력 2-3단계 아이콘 — 그날 한 일(PT 수업 · 153 PB · 타이틀매치 · 레벨업) · 코치 한마디 도장
 *   (2026-11-13 대표님 「다음」 · 칸 왼쪽 위 = 그날 한 일 하나 · 왼쪽 아래 = 코치 한마디 말풍선 — WorkoutCalendar DayCell · 그날 카드가 같이 쓴다)
 *   금색 = 타이틀매치 통과 · 153 PB 첫 기록 · 최고 기록 (lib/calendarMarks actIsGold).
 */
import { ChevronsUp, Dumbbell, MessageCircle, Timer, Trophy, type LucideIcon } from "lucide-react";
import { actIsGold, type ActKind, type CalAct } from "@/lib/calendarMarks";
import { cn } from "@/lib/utils";

const ICON: Record<ActKind, LucideIcon> = { pt: Dumbbell, pb: Timer, title: Trophy, level: ChevronsUp };
const TONE: Record<ActKind, string> = {
  pt: "text-sky-600 dark:text-sky-300",
  pb: "text-rose-600 dark:text-rose-300",
  title: "text-reward",
  level: "text-primary",
};

export const ActIcon = ({ act, className }: { act: CalAct; className?: string }) => {
  const I = ICON[act.kind];
  return <I className={cn(actIsGold(act) ? "text-reward" : TONE[act.kind], className)} strokeWidth={2.75} aria-hidden />;
};

export const NoteIcon = ({ className }: { className?: string }) => (
  <MessageCircle className={cn("text-primary", className)} fill="currentColor" strokeWidth={2} aria-hidden />
);
