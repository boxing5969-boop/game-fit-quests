# 레벨 교육 다이어그램 이미지

153랭크업 레벨 상세(`WhiteLeagueTab` → 레벨 상세 뷰)에 표시되는 교육 다이어그램.
`src/data/curriculumImages.ts` 가 이 폴더를 참조한다. 파일이 없으면 `<img onError>` 로 조용히 숨겨진다.

## 파일명 규칙 (globalLevel = 1~40)
- 히어로(대표 1장): `L{n}.png`  → 예: `L1.png` … `L40.png`
- 세부 3장: `L{n}-A.png`(핵심동작) · `L{n}-B.png`(클로즈업/탑뷰) · `L{n}-C.png`(실수 vs 교정)

## globalLevel 매핑
- 화이트 L1~L10 → `L1`~`L10`
- 블루  L11~L20 → `L11`~`L20`
- 레드  L21~L30 → `L21`~`L30`
- 블랙  L31~L40 → `L31`~`L40`

## 원본 이미지 위치
- 총 148장(히어로 40 + 세부 108)을 nano_banana(Higgsfield)로 생성함.
- 레벨↔job_id↔CDN URL 매핑: 커리큘럼 패키지의 `153_BOXING_MASTER_CURRICULUM/03_MEDIA/MEDIA_MANIFEST.md`.
- 채우는 법: Higgsfield 히스토리(또는 매니페스트의 CDN URL)에서 각 이미지를 내려받아 위 규칙대로 이름을 바꿔 이 폴더에 넣으면 즉시 표시됨.
  (심사 레벨 L10·L20·L30·L40 은 히어로 배치도만 있음 — 세부 3장은 없어도 정상.)

## 대안
- 파일을 직접 넣는 대신 CDN URL 을 바로 참조하려면 `src/data/curriculumImages.ts` 를 URL 맵 방식으로 교체하면 됨(외부 의존이라 파일 호스팅 권장).
