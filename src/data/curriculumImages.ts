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
  29: `${CDN}/hf_20260712_124917_d2b27be6-de42-41ff-b2c9-58eee5cbf027.png`,
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

// globalLevel → 세부 컷 3장(A=핵심동작·B=클로즈업/탑뷰·C=실수 vs 교정) CDN URL.
// 심사 레벨(10·20·30·40)은 세부 컷 없음. 레벨26 및 미수집 슬롯은 폴백(public/assets/curriculum)으로 처리.
const DETAIL_CDN: Record<number, Partial<Record<"A" | "B" | "C", string>>> = {
  1: {
    A: `${CDN}/hf_20260712_115335_5d2a879b-6d2e-4353-80da-52a49986cf3b.png`,
    B: `${CDN}/hf_20260712_115339_f64af0d6-0d19-4f40-a388-a3343f8e022b.png`,
    C: `${CDN}/hf_20260712_115344_a31d7801-6260-478c-b8cd-c8a68ea56f68.png`,
  },
  2: {
    A: `${CDN}/hf_20260712_115347_b974a43d-53f9-4bc0-a206-baaea351bf7c.png`,
    B: `${CDN}/hf_20260712_115353_2b40b598-1d04-4372-93b9-bc833553bd4c.png`,
    C: `${CDN}/hf_20260712_115356_7d39f1e2-812b-49b6-8d53-bcb138555f2d.png`,
  },
  3: {
    A: `${CDN}/hf_20260712_115400_f86f3b37-c964-45c4-b077-29aa9b1ad5e5.png`,
    B: `${CDN}/hf_20260712_115403_ec61de0d-0179-4c8d-87b6-e3a723cab3eb.png`,
    C: `${CDN}/hf_20260712_115407_dd4abef4-dfbe-4ec9-b38a-e7db9f4b5963.png`,
  },
  4: {
    A: `${CDN}/hf_20260712_115411_30a7c20f-83e9-4b99-a8ef-6fae842aec96.png`,
    B: `${CDN}/hf_20260712_115414_72362f99-516f-442b-b5e7-ce6a19cc7ff4.png`,
    C: `${CDN}/hf_20260712_115417_25c2b714-05f5-4889-876d-c92120264694.png`,
  },
  5: {
    A: `${CDN}/hf_20260712_115917_fb8d02ba-563f-4b96-8fea-34ac5f69a011.png`,
    B: `${CDN}/hf_20260712_115927_a3e73c4e-5e77-41da-8b6c-bbc2f004afef.png`,
    C: `${CDN}/hf_20260712_115937_441bfd53-c5ec-4e3b-a129-92d94c9e1482.png`,
  },
  6: {
    A: `${CDN}/hf_20260712_115949_68460160-1ef0-4aca-a559-ca70d41bf600.png`,
    B: `${CDN}/hf_20260712_115959_4ca62909-1160-40b4-a343-d249d4cf3deb.png`,
    C: `${CDN}/hf_20260712_120007_a9e47e41-eb48-4bb8-b714-5b12d521464f.png`,
  },
  7: {
    A: `${CDN}/hf_20260712_120015_d95de66f-2b28-43db-96e8-1f6f84f52b61.png`,
    B: `${CDN}/hf_20260712_120024_2e8c96ad-02fd-441f-8849-d8ee10002518.png`,
    C: `${CDN}/hf_20260712_120032_c924850f-47a8-4a14-8cf6-cbdec58c217b.png`,
  },
  8: {
    A: `${CDN}/hf_20260712_120045_738e4aa2-c847-4f59-bca8-524ba8579d74.png`,
    B: `${CDN}/hf_20260712_120053_385c61da-aa0b-4d2d-99f1-05d8895745a3.png`,
    C: `${CDN}/hf_20260712_120102_b75b8943-31f1-46e5-8a8f-7373d74f4d79.png`,
  },
  9: {
    A: `${CDN}/hf_20260712_120111_73cae3f3-194a-47a7-badf-92b2e7c20752.png`,
    B: `${CDN}/hf_20260712_120119_9af1c946-8862-4f5d-8abf-2bc8baf6ad2a.png`,
    C: `${CDN}/hf_20260712_120129_7979a5f3-f9ac-48c7-b8fe-4a070d15f42e.png`,
  },
  11: {
    A: `${CDN}/hf_20260712_120339_009a33d3-5ba6-4166-96a1-72d6b5a06d70.png`,
    B: `${CDN}/hf_20260712_120350_1ae01ff8-defa-4d3b-aae4-d36c25b480bf.png`,
    C: `${CDN}/hf_20260712_120400_a1b05300-291a-440c-a0cb-6c79799df2eb.png`,
  },
  12: {
    A: `${CDN}/hf_20260712_120408_f684ceb2-0a2a-4e1c-a012-01fcb2250c66.png`,
    B: `${CDN}/hf_20260712_120421_7cb17a5f-d6e0-4155-b66b-dffa65a68f52.png`,
    C: `${CDN}/hf_20260712_120429_07df307a-583a-4405-ab84-77134a1ecd8a.png`,
  },
  13: {
    A: `${CDN}/hf_20260712_120439_ae1a19e5-9eab-4582-b2b0-d04ddede732a.png`,
    B: `${CDN}/hf_20260712_120448_bdff0275-1942-4850-8065-927e55fd38dc.png`,
    C: `${CDN}/hf_20260712_120456_3e4ca319-3ee9-43e3-8fc0-066d5bf9c239.png`,
  },
  14: {
    A: `${CDN}/hf_20260712_120504_d26c84e7-5405-4851-8d40-56caaf0670dd.png`,
    B: `${CDN}/hf_20260712_120513_d6a14c93-8678-4b01-9ed3-027914d8afa1.png`,
    C: `${CDN}/hf_20260712_120520_a755d6c0-d51f-4962-920b-be4eabecbcef.png`,
  },
  15: {
    A: `${CDN}/hf_20260712_120530_73cc99e7-a6e5-4880-b6f7-6968b051dc95.png`,
    B: `${CDN}/hf_20260712_120537_ffb317cd-230d-4009-b7cb-7c1b876491d3.png`,
    C: `${CDN}/hf_20260712_120545_f249520b-e95f-4ee5-97ff-29c6a1bd81c6.png`,
  },
  16: {
    A: `${CDN}/hf_20260712_120715_53470f33-37f6-436a-b65b-1790b0e69391.png`,
    B: `${CDN}/hf_20260712_120726_be3a5677-ddbc-43b4-b4d8-dfc87dd86006.png`,
    C: `${CDN}/hf_20260712_120736_af051562-10dc-494f-96bc-81a8d18b58c0.png`,
  },
  17: {
    A: `${CDN}/hf_20260712_120748_5aa232b1-2875-4225-9771-aaf9c9803189.png`,
    B: `${CDN}/hf_20260712_120758_e9433d59-6213-49b1-b2ab-112a93e004ae.png`,
    C: `${CDN}/hf_20260712_120804_97d3f7ce-49bf-48f2-8bc8-d86d8119bd73.png`,
  },
  18: {
    A: `${CDN}/hf_20260712_120814_95ca8e35-4d65-45e7-a074-ba64c3715b89.png`,
    B: `${CDN}/hf_20260712_120826_3e5ff245-39a5-417f-84b5-2c87a6be1236.png`,
    C: `${CDN}/hf_20260712_120832_2f474adb-de0b-4a6b-9357-04284a856010.png`,
  },
  19: {
    A: `${CDN}/hf_20260712_120843_d6f488a9-7ce9-4088-a1bf-69ddc1be25e1.png`,
    B: `${CDN}/hf_20260712_120852_c7d6b90d-77f0-4c0c-8935-588245999079.png`,
    C: `${CDN}/hf_20260712_120858_207b3f89-99be-4031-bd4d-ca64477f71f4.png`,
  },
  21: {
    A: `${CDN}/hf_20260712_121050_13613b52-54f2-4839-9a5a-cb5ecc7a02ed.png`,
    B: `${CDN}/hf_20260712_121100_1cf376f0-48be-4c91-9c4f-9b6dd3bfe8a2.png`,
    C: `${CDN}/hf_20260712_121412_5b6148e8-c265-4de4-98a9-f0ae52bd94bc.png`,
  },
  22: {
    A: `${CDN}/hf_20260712_121123_daadad59-c316-4d31-9800-685b5d524e78.png`,
    B: `${CDN}/hf_20260712_121132_a56dc740-95cd-4313-9440-06cadf4bdb04.png`,
    C: `${CDN}/hf_20260712_121140_85224991-8578-42ad-89eb-fb6bda39f52d.png`,
  },
  23: {
    A: `${CDN}/hf_20260712_121152_32849537-f27f-40c1-aea1-ae5829996860.png`,
    B: `${CDN}/hf_20260712_121201_496f1533-303a-42e6-9078-ef00c10a04fb.png`,
    C: `${CDN}/hf_20260712_121208_ed9c1ce2-31a3-431f-96df-5218cecd5a29.png`,
  },
  24: {
    A: `${CDN}/hf_20260712_121219_21e32f40-fc08-4bf3-bc8f-e5cd5c7debcf.png`,
    B: `${CDN}/hf_20260712_121227_52ec1ff5-60fc-4bd9-80cd-99f20e5c4432.png`,
    C: `${CDN}/hf_20260712_121236_d84253ef-e405-4707-ab38-350af87ad607.png`,
  },
  25: {
    A: `${CDN}/hf_20260712_121424_4830516f-16c7-4933-91a6-c82f5ae4a6e6.png`,
    B: `${CDN}/hf_20260712_121433_85398998-7d0e-4a2d-a581-760b98250278.png`,
    C: `${CDN}/hf_20260712_121441_0cf6e9f6-ed2f-430d-8ee9-5d9b5e9cfe81.png`,
  },
  26: {
    A: `${CDN}/hf_20260712_143251_fea3df2f-d81f-43a2-b4f9-2465ea145f70.png`,
    B: `${CDN}/hf_20260712_143304_d2b9a1be-1391-4712-8705-2a122ee655a2.png`,
    C: `${CDN}/hf_20260712_143314_1128a0f8-863e-45c6-b8e6-c7b8e5503813.png`,
  },
  27: {
    A: `${CDN}/hf_20260712_121451_6f0da62c-0354-479c-87ef-ca6f0699d28c.png`,
    B: `${CDN}/hf_20260712_121500_d3eb24a1-ab86-4a77-ae08-5d23a824e61d.png`,
    C: `${CDN}/hf_20260712_121508_0cbbfa1f-8d95-4566-ae75-b4f6d6bddec8.png`,
  },
  28: {
    A: `${CDN}/hf_20260712_121516_d4fa0baf-7ce4-4999-8a89-686cd2872918.png`,
    B: `${CDN}/hf_20260712_121524_3e220b03-f78c-4afa-8f76-683c2dde8df6.png`,
    C: `${CDN}/hf_20260712_121531_526344e4-5843-4269-9391-435bad823958.png`,
  },
  29: {
    A: `${CDN}/hf_20260712_121540_bb8a24f7-e110-4913-ad31-6f09250769da.png`,
    B: `${CDN}/hf_20260712_121549_551c4655-f391-411a-8fbf-dcde677a003d.png`,
    C: `${CDN}/hf_20260712_121557_910eb478-8e2e-4b1e-95b8-d19f92c0d80e.png`,
  },
  31: {
    A: `${CDN}/hf_20260712_121638_fc7c27ef-3802-46a0-a8a9-13d72e204c64.png`,
    B: `${CDN}/hf_20260712_121648_127790fb-adc4-4b08-ae15-823b4cc4513d.png`,
    C: `${CDN}/hf_20260712_121656_3312fb36-0f85-4cb6-85be-eb011f3a77eb.png`,
  },
  32: {
    A: `${CDN}/hf_20260712_121705_1a5f77fb-d705-4ccd-81a7-72b72b5a6db9.png`,
    B: `${CDN}/hf_20260712_121716_5b7ab52b-4cea-42ba-b5a0-10a7c3a11764.png`,
    C: `${CDN}/hf_20260712_121726_8e4b55af-2a9e-4cad-bc9e-09056f742066.png`,
  },
  33: {
    A: `${CDN}/hf_20260712_121736_b0fd826f-6e2a-4a66-b58a-66ebdfd48cb7.png`,
    B: `${CDN}/hf_20260712_121745_12fe0f5e-4e5e-4796-9cfb-82f86aba632b.png`,
    C: `${CDN}/hf_20260712_121753_617e3748-88bc-49b9-91e1-d74a9e287a9e.png`,
  },
  34: {
    A: `${CDN}/hf_20260712_121802_ea9e910e-e534-4fa8-a66e-9e24d50164bc.png`,
    B: `${CDN}/hf_20260712_121811_a90cf181-af54-4c6c-82a0-9ce86450dc2a.png`,
    C: `${CDN}/hf_20260712_121818_2cfe58bb-cfff-4ad5-96ce-c25264a656c1.png`,
  },
  35: {
    A: `${CDN}/hf_20260712_121858_88a00ff0-52a8-4de3-b920-75efd208edb2.png`,
    B: `${CDN}/hf_20260712_121907_be947350-4f75-4c20-a3f6-19fb10a56ac3.png`,
    C: `${CDN}/hf_20260712_121917_e31335c4-e486-4ac2-ab4c-d3a3af12b2ce.png`,
  },
  36: {
    A: `${CDN}/hf_20260712_121927_42ac1a6a-0368-49c7-af46-2a07ab2945cc.png`,
    B: `${CDN}/hf_20260712_121936_1f133d3b-3069-4d4d-a901-e36d15e2ab5f.png`,
    C: `${CDN}/hf_20260712_121946_260e54d1-1ad9-452d-a25a-075e5c7c0247.png`,
  },
  37: {
    A: `${CDN}/hf_20260712_121955_6c1d491d-9975-445d-be4e-05260de7041a.png`,
    B: `${CDN}/hf_20260712_122005_c0f38ed4-61a4-48f7-a1e7-7a81c2883e48.png`,
    C: `${CDN}/hf_20260712_122012_460bc1bf-e08e-4f30-a20e-db65f0206d1b.png`,
  },
  38: {
    A: `${CDN}/hf_20260712_122022_de4d65fb-5c90-4753-8b6a-26dcb65ef136.png`,
    B: `${CDN}/hf_20260712_122030_fff8e92a-e5ca-44aa-9f24-6181edb4e8da.png`,
    C: `${CDN}/hf_20260712_122038_98272fa6-055f-42ae-b90a-5157960fba2b.png`,
  },
  39: {
    A: `${CDN}/hf_20260712_122047_26ce4940-b8de-4ffd-8915-9ba4d055dc6c.png`,
    B: `${CDN}/hf_20260712_122055_3835db0c-5605-42f8-885d-77dacee75621.png`,
    C: `${CDN}/hf_20260712_122104_2aaae3dd-4aa0-42ff-a013-ab2871467785.png`,
  },
};

/** 레벨 대표(히어로) 교육 다이어그램 URL — CDN 우선, 없으면 public 파일 경로 */
export function levelHeroImage(globalLevel: number): string {
  return HERO_CDN[globalLevel] ?? `${CURRICULUM_IMG_BASE}/L${globalLevel}.png`;
}

/** 레벨 세부 컷 3장 경로 (A=핵심동작, B=클로즈업/탑뷰, C=실수 vs 교정) — CDN 우선, 없으면 public 파일 경로 */
export function levelDetailImages(globalLevel: number): string[] {
  return (["A", "B", "C"] as const).map(
    (s) => DETAIL_CDN[globalLevel]?.[s] ?? `${CURRICULUM_IMG_BASE}/L${globalLevel}-${s}.png`
  );
}
