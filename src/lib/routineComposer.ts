// 수업 루틴 자동 구성 — 훈련 라이브러리에서 워밍업/본운동/마무리/쿨다운 4단계로 조합.
// 카테고리·난이도 규칙으로 균형 잡힌 루틴을 즉시 생성한다(기존 AI 코치 chat-assistant 경로는 건드리지 않음).

export interface LibEx {
  id: string; category: string; name: string; difficulty: string; target?: string;
}
export interface RoutineItem { exercise_id: string | null; name: string; category: string; minutes: number; note: string; }
export interface RoutinePhases { warmup: RoutineItem[]; main: RoutineItem[]; finish: RoutineItem[]; cooldown: RoutineItem[]; }

export const PHASE_META: { key: keyof RoutinePhases; label: string; emoji: string }[] = [
  { key: "warmup", label: "워밍업", emoji: "🔥" },
  { key: "main", label: "본운동", emoji: "🥊" },
  { key: "finish", label: "마무리 운동", emoji: "💦" },
  { key: "cooldown", label: "쿨다운", emoji: "🧘" },
];

export const emptyPhases = (): RoutinePhases => ({ warmup: [], main: [], finish: [], cooldown: [] });

export const phasesTotal = (p: RoutinePhases) =>
  PHASE_META.reduce((sum, m) => sum + (p[m.key] || []).reduce((s, it) => s + (it.minutes || 0), 0), 0);

const shufflePick = (arr: LibEx[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const mkItem = (e: LibEx, minutes: number, note = ""): RoutineItem => ({ exercise_id: e.id, name: e.name, category: e.category, minutes, note });

// 레벨↑ 이면 중·고급 포함
function allowedDifficulty(targetLevel?: number): string[] {
  const lv = targetLevel ?? 1;
  if (lv <= 10) return ["초급"];
  if (lv <= 20) return ["초급", "중급"];
  return ["초급", "중급", "고급"];
}

// 라이브러리 → 4단계 자동 조합. 카테고리가 비어도 폴백으로 채운다.
export function composeRoutine(lib: LibEx[], targetLevel?: number): RoutinePhases {
  const allow = allowedDifficulty(targetLevel);
  const inCat = (cat: string) => {
    const filtered = lib.filter((e) => e.category === cat && allow.includes(e.difficulty));
    return filtered.length ? filtered : lib.filter((e) => e.category === cat);
  };
  const jump = inCat("줄넘기");
  const foot = inCat("풋워크");
  const basic = inCat("기본기");
  const defense = inCat("방어");
  const mitt = inCat("미트");
  const cond = inCat("컨디셔닝");

  const warmup: RoutineItem[] = [];
  shufflePick(jump, 1).forEach((e) => warmup.push(mkItem(e, 5, "가볍게 몸 풀기")));
  shufflePick(foot, 1).forEach((e) => warmup.push(mkItem(e, 5, "리듬·스탠스 준비")));

  const main: RoutineItem[] = [];
  shufflePick(basic, 2).forEach((e) => main.push(mkItem(e, 5)));
  shufflePick(defense, 1).forEach((e) => main.push(mkItem(e, 5)));
  shufflePick(mitt.length ? mitt : foot, 1).forEach((e) => main.push(mkItem(e, 8, "콤비네이션 실전 감각")));

  const finish: RoutineItem[] = [];
  shufflePick(cond.length ? cond : basic, 1).forEach((e) => finish.push(mkItem(e, 8, "라운드 리듬으로 마무리")));

  const cooldown: RoutineItem[] = [
    { exercise_id: null, name: "정리 스트레칭·호흡", category: "쿨다운", minutes: 5, note: "가벼운 스트레칭과 심호흡으로 심박 안정" },
  ];

  return { warmup, main, finish, cooldown };
}
