/**
 * 153 — 라이브보드 mock 회원 생성기 (테스트 전용).
 *
 * DB 변경 없이 화면 시각효과만 검증하기 위한 가상 데이터.
 */

const MOCK_NAMES = [
  "코브라펀치", "잽마스터", "훅의달인", "어퍼킷킹", "스피드복서",
  "헤비웨잇", "라이트스피드", "그림자복서", "철벽수비", "카운터킹",
  "복싱IQ100", "원투쓰리", "파워펀처", "테크니션", "리듬복서",
  "더블잽", "바디블로우", "풋워크", "철주먹", "복싱천재",
  "잽잽잽", "킹콩훅", "라이트닝", "스톰브레이커", "아이언피스트",
  "복싱전사", "링위에코브라", "더파이터", "챔피언후보", "랭킹업1번",
  "153파이터", "복싱장인", "마스터펀처", "더블어퍼", "트리플잽",
];

const LEAGUE_WEIGHTS: { league: string; weight: number; maxLevel: number }[] = [
  { league: "white", weight: 50, maxLevel: 10 },
  { league: "blue", weight: 30, maxLevel: 10 },
  { league: "red", weight: 15, maxLevel: 10 },
  { league: "black", weight: 5, maxLevel: 10 },
];

const TOTAL_WEIGHT = LEAGUE_WEIGHTS.reduce((s, x) => s + x.weight, 0);

function randomLeague(): { league: string; level: number } {
  const r = Math.random() * TOTAL_WEIGHT;
  let acc = 0;
  for (const w of LEAGUE_WEIGHTS) {
    acc += w.weight;
    if (r < acc) {
      return {
        league: w.league,
        level: 1 + Math.floor(Math.random() * w.maxLevel),
      };
    }
  }
  return { league: "white", level: 1 };
}

function randomName(usedNames: Set<string>): string {
  // 충돌 회피 + pool 다 쓰면 숫자 suffix
  for (let i = 0; i < 10; i++) {
    const n = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
    if (!usedNames.has(n)) return n;
  }
  return `복서${Math.floor(Math.random() * 9999)}`;
}

export interface MockActiveMember {
  id: string;
  user_id: string;
  name: string;
  league: string;
  level: number;
  startedAt: number;
  avatar_url?: string | null;
}

let counter = 0;

export function generateMockMember(opts?: {
  fresh?: boolean;
  usedNames?: Set<string>;
}): MockActiveMember {
  counter += 1;
  const id = `mock-${Date.now()}-${counter}`;
  const { league, level } = randomLeague();
  const name = randomName(opts?.usedNames ?? new Set());
  // fresh = 0~30초 전, 일반 = 1~90분 전
  const ageMs = opts?.fresh
    ? Math.floor(Math.random() * 30_000)
    : Math.floor(Math.random() * 89 * 60_000) + 60_000;
  return {
    id,
    user_id: id,
    name,
    league,
    level,
    startedAt: Date.now() - ageMs,
    avatar_url: null,
  };
}

export function generateMockMembers(
  count: number,
  opts?: { fresh?: boolean },
): MockActiveMember[] {
  const used = new Set<string>();
  const out: MockActiveMember[] = [];
  for (let i = 0; i < count; i++) {
    const m = generateMockMember({ fresh: opts?.fresh, usedNames: used });
    used.add(m.name);
    out.push(m);
  }
  return out;
}
