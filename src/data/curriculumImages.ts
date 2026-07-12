// 153랭크업 레벨별 교육 다이어그램 이미지 매핑
// ─────────────────────────────────────────────────────────────
// 이미지 파일은 public/assets/curriculum/ 에 배치한다.
//   (Vite public → 런타임 절대경로 /assets/curriculum/ 로 서빙)
// 파일명 규칙:
//   히어로(레벨 대표 1장)  = L{globalLevel}.png        (예: L1.png ~ L40.png)
//   세부(핵심동작/클로즈업/실수교정) = L{globalLevel}-A.png · -B.png · -C.png
// 파일이 아직 없으면 <img onError> 로 조용히 숨긴다(무해한 폴백).
//
// 원본 자산 매핑(레벨↔job_id↔URL)은 커리큘럼 패키지의
//   153_BOXING_MASTER_CURRICULUM/03_MEDIA/MEDIA_MANIFEST.md 참고.

export const CURRICULUM_IMG_BASE = "/assets/curriculum";

/** 레벨 대표(히어로) 교육 다이어그램 경로 */
export function levelHeroImage(globalLevel: number): string {
  return `${CURRICULUM_IMG_BASE}/L${globalLevel}.png`;
}

/** 레벨 세부 컷 3장 경로 (A=핵심동작, B=클로즈업/탑뷰, C=실수 vs 교정) */
export function levelDetailImages(globalLevel: number): string[] {
  return ["A", "B", "C"].map((s) => `${CURRICULUM_IMG_BASE}/L${globalLevel}-${s}.png`);
}
