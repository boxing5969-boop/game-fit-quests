/**
 * 📅 운동 달력 2-3단계 아이콘 — 그날 한 일(PT 수업 · 153 PB · 타이틀매치 · 레벨업) · 코치 한마디 도장
 *   (2026-11-13 대표님 「다음」 · 칸 왼쪽 위 = 그날 한 일 하나 · 왼쪽 아래 = 코치 한마디 말풍선 — WorkoutCalendar DayCell · 그날 카드가 같이 쓴다)
 *   금색 = 타이틀매치 통과 · 153 PB 첫 기록 · 최고 기록 (lib/calendarMarks actIsGold).
 *   (3-5 날씨 도장 · 2026-11-14) 칸 위 가운데 = 비 · 눈 · 폭염 · 한파인 날 왔다는 도장 — 우산 · 눈송이 · 불꽃 · 온도계.
 *     스티커(땀 💦 = 물방울 그림)와 헷갈리지 않게 이모지가 아니라 이 아이콘으로 그린다.
 */
import {
  ChevronsUp,
  Dumbbell,
  Flame,
  MessageCircle,
  Snowflake,
  ThermometerSnowflake,
  Timer,
  Trophy,
  Umbrella,
  type LucideIcon,
} from "lucide-react";
import { actIsGold, type ActKind, type CalAct } from "@/lib/calendarMarks";
import type { WeatherKind } from "@/lib/calendarWeather";
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

const WX_ICON: Record<WeatherKind, LucideIcon> = { rain: Umbrella, snow: Snowflake, heat: Flame, cold: ThermometerSnowflake };
/** 도장 그림 색 — 그날 카드 칭찬 한 줄의 글자 색(WEATHER_TEXT)과 같은 갈래 */
const WX_TONE: Record<WeatherKind, string> = {
  rain: "text-blue-600 dark:text-blue-300",
  snow: "text-sky-500 dark:text-sky-300",
  heat: "text-orange-500 dark:text-orange-300",
  cold: "text-indigo-600 dark:text-indigo-300",
};
/** 그날 카드 칭찬 한 줄 글자 색 (흰 · 회색 바탕에서 읽히게 한 단계 진하게) */
export const WEATHER_TEXT: Record<WeatherKind, string> = {
  rain: "text-blue-700 dark:text-blue-300",
  snow: "text-sky-700 dark:text-sky-300",
  heat: "text-orange-700 dark:text-orange-300",
  cold: "text-indigo-700 dark:text-indigo-300",
};

export const WeatherIcon = ({ kind, className }: { kind: WeatherKind; className?: string }) => {
  const I = WX_ICON[kind];
  return <I className={cn(WX_TONE[kind], className)} strokeWidth={2.75} aria-hidden />;
};
