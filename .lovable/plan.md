

# 캐릭터 파츠 실제 구현 플랜

## 현재 상태
- `character_part_categories`: 13개 카테고리 있음 (base, skin, hair_back, top, shorts, shoes, hair_front, eyebrows, eyes, mouth, gloves, accessory, effect)
- `character_parts` 테이블: **완전히 비어있음** — 실제 파츠 레코드 0개
- `character_presets`: 8개 템플릿 (12개 중 첫 8개만 DB에 있음)
- CharacterStudioPage: 프리셋 선택만 가능, 파츠 조합 불가
- 이미지: 12개 프리빌트 full-body PNG만 존재

## 구현 전략

개별 투명 PNG 레이어를 AI로 완벽하게 정렬해서 생성하는 것은 현실적으로 불가능합니다. 대신:

1. **SVG 기반 프로그래매틱 캐릭터 렌더러** 생성 — 색상/형태 변형이 코드로 제어됨
2. **각 파츠별 썸네일 아이콘**은 AI 이미지 생성으로 만들어 선택 UI에 사용
3. **조합된 캐릭터는 SVG 컴포넌트**로 렌더링 — 레이어 정렬 문제 없음
4. 기존 12 프리빌트 프리셋은 그대로 유지

## 영향받는 파일

### 새 파일
- `src/components/LayeredCharacterRenderer.tsx` — SVG 기반 레이어 렌더러
- `src/data/characterPartsData.ts` — 80+ 파츠 정의 (색상, 형태, SVG path 데이터)

### 수정 파일
- `src/pages/CharacterStudioPage.tsx` — 프리셋 모드 + 파츠 조합 모드 탭 추가
- `src/components/CharacterSprite.tsx` — `partsJson` prop 추가, 레이어 렌더러 연동
- `src/hooks/useCharacterData.ts` — `useSaveCustomPreset` 추가
- `src/components/CharacterRail.tsx` — 커스텀 프리셋 지원
- `src/components/HallOfFameShowcase.tsx` — 변경 없음 (CharacterSprite가 자동 처리)

### DB 변경
- `character_parts` 테이블에 80+ 레코드 INSERT (마이그레이션 아님, 데이터 삽입)
- 나머지 4개 프리셋도 `character_presets`에 INSERT
- 스키마 변경 없음

## 파츠 수량 (최소 80개)

| 카테고리 | 수량 | 구현 방식 |
|---------|------|----------|
| skin (피부톤) | 5 | SVG fill 색상 변형 |
| hair_back (뒷머리) | 8 | SVG path + 색상 변형 |
| hair_front (앞머리) | 8 | SVG path + 색상 변형 |
| eyebrows (눈썹) | 6 | SVG path 변형 |
| eyes (눈) | 8 | SVG 컴포넌트 변형 |
| mouth (표정) | 6 | SVG path 변형 |
| gloves (글러브) | 8 | SVG + 색상 변형 |
| top (상의) | 8 | SVG + 색상 변형 |
| shorts (하의) | 8 | SVG + 색상 변형 |
| shoes (신발) | 6 | SVG + 색상 변형 |
| accessory (액세서리) | 6 | SVG 오버레이 |
| effect (이펙트) | 4 | CSS 애니메이션 |
| **합계** | **81** | |

## CharacterStudioPage 업데이트

```text
┌─────────────────────────────┐
│  ← 캐릭터 스튜디오    🎲랜덤  │
├─────────────────────────────┤
│  [프리셋 선택] [파츠 조합]     │  ← 모드 전환 탭
├─────────────────────────────┤
│                             │
│     ┌───────────────┐       │
│     │  라이브 미리보기  │       │  ← SVG 렌더러 or 프리셋 이미지
│     └───────────────┘       │
│                             │
│  [💎저장] 버튼               │
├─────────────────────────────┤
│  파츠 조합 모드:              │
│  피부톤 | 앞머리 | 뒷머리 | ... │  ← 카테고리 탭 (스크롤)
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │  │ │  │ │  │ │  │       │  ← 파츠 그리드 (실제 선택 가능)
│  └──┘ └──┘ └──┘ └──┘       │
└─────────────────────────────┘
```

## 렌더링 흐름

1. 프리셋 캐릭터 → 기존 PNG 이미지 사용 (변경 없음)
2. 커스텀 캐릭터 → `parts_json`에 각 카테고리별 선택 파츠 키 저장 → `LayeredCharacterRenderer`가 SVG로 렌더링
3. CharacterSprite가 `parts_json.style` 존재 시 PNG, `parts_json.parts` 존재 시 SVG 렌더러 자동 선택
4. Hall of Fame 레일에서 동일하게 작동 — 크기/아우라 호환 유지

## Black League 후광 호환
- `LayeredCharacterRenderer`는 `CharacterSprite` 안에서 렌더링됨
- 아우라는 `CharacterSprite` 레벨에서 이미 처리됨 → 변경 불필요

## 미변경 사항
- 기존 12 프리빌트 프리셋
- Hall of Fame 구조
- CharacterRail 구조
- Black League 아우라
- 기존 라우트/네비게이션
- AvatarPage (링젬 상점 — 별도 시스템)
- RLS/역할 구조

