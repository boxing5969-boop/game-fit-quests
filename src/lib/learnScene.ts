// 🖼 릴스 썸네일 — 153 동작 장면 + 제목 (2026-11-17 대표님 「릴스라고 표기하지말고 썸네일 관련된 정보로 썸네일 이미지 영상 사진과 글로
//   썸네일 만들자」 → 「153 동작 장면 + 제목」). 인스타 릴스는 첫 장면 그림이 없다(인스타 그림 주소는 기한이 있고 분석 릴스엔
//   경기 중계 화면이 있어 저장소에 베끼지 않는다) → 그 영상이 다루는 동작의 153 카드 첫 장면을 배경으로 쓰고, 제목을 크게 얹는다.
//   · 장면 = 영상 제목 · 꼬리표의 동작 말 → 그 동작 153 카드(첫 장면 그림이 있는 것) · 같은 말이 여러 영상이면 씨앗으로 돌려 가며
//   · 맞는 말이 없으면(경기 분석 등) 153 영상 장면 몇 장을 돌려 가며 · 장면이 하나도 없으면 null(글만)
//   · 제목 = 강조할 동작 말 하나를 노란 글씨로 — 화면 없는 계산만, 시험 learnScene.test.ts

export interface SceneCard {
  id: string;
  name: string;
}

/** 위에서부터 먼저 — 영상 글(제목 + 꼬리표)에 이 말이 있으면 이 카드들 중 하나 */
export const SCENE_RULES: readonly { re: RegExp; names: readonly string[] }[] = [
  { re: /어퍼/, names: ["어퍼컷"] },
  { re: /체크훅|숏훅|레프트 더블|훅/, names: ["훅", "왼손 훅 · 오른손 훅", "위빙-훅 연결", "훅 → 위빙"] },
  { re: /원투|스트레이트|따발총/, names: ["원투", "잽 · 스트레이트", "원투 · 훅 콤비네이션"] },
  { re: /잽|쨉/, names: ["잽", "잽 · 스트레이트"] },
  { re: /위빙|더킹|회피|슬립|거북이|살아남/, names: ["위빙", "위빙-훅 연결", "더킹 · 위빙 자세", "슬립"] },
  { re: /카운터/, names: ["더킹 → 카운터", "위빙-훅 연결", "위빙 연결 콤비"] },
  { re: /블로킹|패리|커버|가드|디펜스|방어/, names: ["블로킹 · 커버", "기본 가드 자세", "위빙"] },
  { re: /스텝|풋워크|피벗|무브먼트|아웃복싱|인파이팅|근접전|각도/, names: ["십자 스텝", "사이드 스텝", "전진·후진 스텝", "뛰는 스텝", "기본 스텝"] },
  { re: /미트|연타|콤비|플러리|시퀀스|빌드업/, names: ["위빙 연결 콤비", "원투 · 훅 · 더킹", "샌드백 구령"] },
  { re: /샌드백|스피드볼/, names: ["샌드백 구령", "아령 샌드백 터치"] },
  { re: /체력|컨디셔닝|피지컬|근지구력|몸 풀|파워/, names: ["아령 쉐도우 복싱", "밴드 쉐도우 복싱", "아령 샌드백 터치"] },
  { re: /밸런스|기본기|중심|임팩트|펀치|KO|한 방|타이밍/i, names: ["기본 스탠스", "기본 가드 자세", "원투"] },
];

/** 맞는 말이 없을 때 돌려 쓸 153 영상 장면 */
export const SCENE_FALLBACK: readonly string[] = [
  "위빙",
  "십자 스텝",
  "샌드백 구령",
  "밴드 쉐도우 복싱",
  "아령 쉐도우 복싱",
  "사이드 스텝",
  "위빙 연결 콤비",
  "전진·후진 스텝",
];

/** 같은 씨앗 = 같은 수 (FNV-1a) */
export function sceneHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * 영상 글 → 장면 카드. cards = 첫 장면 그림이 있는 카드만 넘긴다(회원에게 보이는 것).
 * seed = 영상 id — 같은 말을 쓰는 영상이 여러 개면 돌려 가며 고른다(늘 같은 영상은 늘 같은 장면).
 */
export function sceneCardFor<C extends SceneCard>(text: string, seed: string, cards: readonly C[]): C | null {
  if (!cards.length) return null;
  const byName = new Map<string, C>();
  for (const c of cards) if (!byName.has(c.name)) byName.set(c.name, c);
  const pick = (names: readonly string[]): C | null => {
    const have = names.map((n) => byName.get(n)).filter((c): c is C => !!c);
    return have.length ? have[sceneHash(seed) % have.length] : null;
  };
  const t = text ?? "";
  for (const r of SCENE_RULES) {
    if (!r.re.test(t)) continue;
    const c = pick(r.names);
    if (c) return c;
  }
  return pick(SCENE_FALLBACK);
}

/** 썸네일 제목에서 노란 글씨로 강조할 말 — 먼저 나오는 동작 말 하나 */
const HIGHLIGHT_WORDS = [
  "크로스 카운터",
  "스트레이트 카운터",
  "체크훅",
  "숏훅",
  "양어퍼",
  "레프트 더블",
  "리버샷",
  "리버 블로우",
  "근접전",
  "인파이팅",
  "아웃복싱",
  "원투쓰리",
  "원투",
  "어퍼컷",
  "잽",
  "훅",
  "카운터",
  "더킹",
  "위빙",
  "슬립",
  "회피",
  "피벗",
  "풋워크",
  "스텝",
  "미트",
  "샌드백",
  "스피드볼",
  "밸런스",
  "기본기",
  "중심이동",
  "타이밍",
  "파워",
  "체력",
  "근지구력",
  "빌드업",
  "KO",
];

/** 제목 → [앞, 강조, 뒤] — 강조할 말이 없으면 [제목, "", ""] */
export function splitHighlight(title: string): [string, string, string] {
  const s = (title ?? "").trim();
  let best: { i: number; w: string } | null = null;
  for (const w of HIGHLIGHT_WORDS) {
    const i = s.indexOf(w);
    if (i >= 0 && (!best || i < best.i || (i === best.i && w.length > best.w.length))) best = { i, w };
  }
  if (!best) return [s, "", ""];
  return [s.slice(0, best.i), best.w, s.slice(best.i + best.w.length)];
}
