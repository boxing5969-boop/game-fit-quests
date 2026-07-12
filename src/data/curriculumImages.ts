// 153랭크업 레벨별 교육 다이어그램 이미지 매핑
// ─────────────────────────────────────────────────────────────
// 1순위: 아래 HERO_CDN 맵의 URL(nano_banana/Higgsfield 생성물, 즉시 표시).
// 2순위: 맵에 없으면 public/assets/curriculum/L{n}.png 로 폴백(파일 넣으면 표시).
//   (Vite public → 런타임 /assets/curriculum/). 파일도 없으면 <img onError> 로 숨김.
// 세부 컷은 파일 방식만 사용: L{n}-A.png(핵심동작)·-B.png(클로즈업/탑뷰)·-C.png(실수vs교정).
//
// 원본 매핑(레벨↔job_id↔URL) 정본: 커리큘럼 패키지 03_MEDIA/MEDIA_MANIFEST.md.
// ⚠️ CDN URL 은 생성 계정 자산 — 안정 운영 시 파일 방식(public/)으로 이관 권장.
// 현재 히어로 39/40 매핑(L29만 폴백 — 재생성 후 백필 예정).

export const CURRICULUM_IMG_BASE = "/assets/curriculum";

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD";

// globalLevel(1~40) → 히어로 이미지 CDN URL.
const HERO_CDN: Record<number, string> = {
  1: `${CDN}/hf_20260712_111314_a21853fa-7630-424b-a671-7879fd8097fa.png`,
  2: `${CDN}/hf_20260712_111319_f6d3dec0-ca20-4493-88fe-0e414cc2d704.png`,
  3: `${CDN}/hf_20260712_111323_1f5f50fd-bc27-4f8c-9ea5-7c74d5ecac47.png`,
  4: `${CDN}/hf_20260712_111328_2ed4b0ba-de51-4cc3-93d5-b03dfe5fd88d.png`,
  5: `${CDN}/hf_20260712_124716_1f98e8f1-4fbb-408e-a9c3-f61f435df50d.png`,
  6: `${CDN}/hf_20260712_124729_7d368cbf-975a-4cd1-89f4-db95b517fe17.png`,
  7: `${CDN}/hf_20260712_124739_fba242ca-c4ce-4197-b4c7-9bd4c55ef931.png`,
  8: `${CDN}/hf_20260712_111523_10b06e49-54ce-4d1c-b552-2303029aa6fb.png`,
  9: `${CDN}/hf_20260712_111533_4eeeb390-6d23-462a-8c9d-cc646809659f.png`,
  10: `${CDN}/hf_20260712_111548_6e4cbcbb-3127-4769-8f3c-856445b44d43.png`,
  11: `${CDN}/hf_20260712_113357_d344e418-cbee-4172-abe6-4f0474a30c35.png`,
  12: `${CDN}/hf_20260712_113408_8a4a31c9-daff-4806-91b1-0476840aa606.png`,
  13: `${CDN}/hf_20260712_124749_4ffad105-735f-457c-bc10-79ed62872688.png`,
  14: `${CDN}/hf_20260712_113427_46da331f-c921-42fd-9930-331d53da7a7d.png`,
  15: `${CDN}/hf_20260712_113439_eb20f42a-bad1-4a10-a17f-6b62f2ab187f.png`,
  16: `${CDN}/hf_20260712_113449_adac9308-df3a-4c64-bb81-4aa566b5e64b.png`,
  17: `${CDN}/hf_20260712_113541_239cdbf1-8de3-48cd-8104-bfa916a3216e.png`,
  18: `${CDN}/hf_20260712_113552_283b75c8-c295-4b57-ae63-1eb4368e1bec.png`,
  19: `${CDN}/hf_20260712_113608_2ee0a6d3-9afb-4d94-b0fb-7fb5aad8b91f.png`,
  20: `${CDN}/hf_20260712_113622_159fd865-59fd-4c5f-a0c1-51c15da8f96b.png`,
  21: `${CDN}/hf_20260712_124758_597d7b63-67f9-4ecf-8222-9db2a8b59151.png`,
  22: `${CDN}/hf_20260712_124807_291307bd-1499-49b8-bb7f-9f9b27b90b9d.png`,
  23: `${CDN}/hf_20260712_124818_5ebfe924-1139-449b-8cbe-eb2278bd977a.png`,
  24: `${CDN}/hf_20260712_124827_1352cfa2-5a46-4530-b116-d6f7c1a2e0a3.png`,
  25: `${CDN}/hf_20260712_124837_a296839f-1c0a-468f-9aa7-73a796434c31.png`,
  26: `${CDN}/hf_20260712_124848_5afaca1e-3a0f-4420-9a74-c2b895cff4ca.png`,
  27: `${CDN}/hf_20260712_124858_51329fc9-53b0-4670-9e90-25e76c8f6ea6.png`,
  28: `${CDN}/hf_20260712_124906_fcc6ff3e-b59f-494e-a427-911a5e4f89d9.png`,
  // 29: 재생성 후 백필 (현재 public 폴백)
  30: `${CDN}/hf_20260712_113910_ff652575-677c-4e31-a9aa-a5c750b15db3.png`,
  31: `${CDN}/hf_20260712_114004_5194184f-ae70-4f47-8e59-23583a6ff608.png`,
  32: `${CDN}/hf_20260712_114017_331a69ac-48d1-4e8c-aea7-e3e99d493753.png`,
  33: `${CDN}/hf_20260712_114030_edfec68e-0dc6-443c-8f56-14814cdb7c71.png`,
  34: `${CDN}/hf_20260712_114042_5c511027-25ed-4f34-8536-2986743b046c.png`,
  35: `${CDN}/hf_20260712_114057_5b8b6114-d909-4a0b-b8c5-bea442005c53.png`,
  36: `${CDN}/hf_20260712_114109_f592e92e-502b-41fe-aed0-effb81ee8680.png`,
  37: `${CDN}/hf_20260712_114121_b48db5fa-3662-476d-8228-a454600ab1a7.png`,
  38: `${CDN}/hf_20260712_114132_8a2b1c29-30c3-4413-af78-10bab55b8262.png`,
  39: `${CDN}/hf_20260712_114144_203af31d-99da-4728-ab92-53977db99d15.png`,
  40: `${CDN}/hf_20260712_114157_4da09635-4287-4e47-af35-ea51bc5104b0.png`,
};

/** 레벨 대표(히어로) 교육 다이어그램 URL — CDN 우선, 없으면 public 파일 경로 */
export function levelHeroImage(globalLevel: number): string {
  return HERO_CDN[globalLevel] ?? `${CURRICULUM_IMG_BASE}/L${globalLevel}.png`;
}

/** 레벨 세부 컷 3장 경로 (A=핵심동작, B=클로즈업/탑뷰, C=실수 vs 교정) */
export function levelDetailImages(globalLevel: number): string[] {
  return ["A", "B", "C"].map((s) => `${CURRICULUM_IMG_BASE}/L${globalLevel}-${s}.png`);
}
