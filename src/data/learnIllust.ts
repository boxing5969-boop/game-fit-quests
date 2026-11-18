// 🎨 영상으로 배우기 — 레벨 미션 영상 · 153 PB 시범 영상의 2컷 동작 그림 (2026-11-18 대표님
//   「영상으로 배우기탭에 이렇게 그림으로 2개 이미지로 설명해줘 모든 영상에 … 모든 동작은 영상 밑에 이미지 소개글」)
//   · 동작 카드는 DB(training_exercises.image_url)에 그림이 있다. 레벨 미션(missions)에는 그림 칸이 없어 여기 한 곳에 둔다
//   · 열쇠 = 미션 id 또는 153 PB 타일 id(pbExtraId) — 같은 영상을 쓰는 미션(레벨 7 = 레벨 1 영상 다시 쓰기)과
//     같은 동작의 다른 버전(실사 · 애니)은 모두 같은 그림
//   · 그림 파일 = public/assets/learn-illust/<이름>.webp (카드 그림과 같은 폴더 · 같은 모양 1200×896 · 「스트레이트(원투)」 그림 기준)
//   · 같은 동작의 카드 그림이 있으면 그 그림을 같이 쓴다 (새로 그리지 않는다)
//   · 여기 없는 영상은 예전 그대로 — 그림 자리 없이 영상 · 설명만
//   플레이어(VideoPlayer)는 영상 바로 아래 · 설명 바로 위에 그린다.
import { pbExtraId } from "@/lib/learnExtras";

const file = (name: string) => `/assets/learn-illust/${name}.webp`;

/** 같은 동작이라 카드 그림을 같이 쓰는 것 */
const CARD = {
  /** 제자리 스텝 */
  stepInPlace: "2d305d98-107b-4a6a-a1cd-43c7f7fd7598",
  /** 십자 스텝 */
  crossStep: "1530c4d0-0001-4a00-8000-000000001112",
  /** 원투 · 훅 콤비네이션 */
  oneTwoHook: "1530c4d0-001b-4a00-8000-000000001116",
} as const;

/** 미션 id · 153 PB 타일 id → 그림 */
export const LEARN_ILLUST: Readonly<Record<string, string>> = {
  // ── 화이트 리그 레벨 미션 ──
  // L1 제자리 스텝(거울 앞 대각선 위아래 바운스) = 카드 「제자리 스텝」
  "171fa9f5-226e-4781-aaf8-170b95bcb8be": file(CARD.stepInPlace),
  // L3 십자스텝(앞·뒤·좌·우) = 카드 「십자 스텝」
  "37567036-f753-4fda-9145-a01a3a33d106": file(CARD.crossStep),
  // L8 스텝 원투쓰리(원투로 세우고 앞손 훅) = 카드 「원투 · 훅 콤비네이션」
  "c745e1af-6af4-4648-a1f9-ba1dbc5b81f6": file(CARD.oneTwoHook),
};

/** 153 PB 종목 번호(1~8) → 타일 id — 그림을 넣을 때 LEARN_ILLUST 의 열쇠로 */
export const pbIllustKey = (n: number): string => pbExtraId(n);

/** 이 영상(미션 · 153 PB)의 동작 그림 — 여러 id(같은 동작의 다른 버전)를 주면 처음 맞는 것 · 없으면 null */
export function learnIllustOf(ids: ReadonlyArray<string | null | undefined>): string | null {
  for (const id of ids) {
    const key = (id ?? "").trim().toLowerCase();
    if (key && LEARN_ILLUST[key]) return LEARN_ILLUST[key];
  }
  return null;
}
