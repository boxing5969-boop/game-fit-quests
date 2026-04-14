

# 캐릭터 꾸미기 최소 작동 루프 구현 계획

## 핵심 문제 진단
- 81개 파츠는 SVG `LayeredCharacterRenderer`용으로 정의됨
- 승인된 캐릭터는 PNG 프리셋 12종 (고정 이미지)
- PNG 이미지 위에 SVG 파츠를 합성하는 것은 불가능 → 꾸미기가 "준비 중"으로 숨겨진 이유
- 해결: PNG 프리셋을 유지하면서 **CSS 기반 시각 오버레이**로 꾸미기 효과 구현

## 구현 방향: CSS 오버레이 커스터마이징

PNG 프리셋 이미지는 그대로 유지하고, 그 위에 실제로 보이는 효과를 CSS/HTML로 덧씌움:

1. **글러브 컬러** → 캐릭터 하단에 컬러 배지 표시 + 이름 옆 컬러 태그
2. **이펙트** → CSS 파티클 애니메이션 (반짝이, 불꽃, 하트 등) 캐릭터 주변에 렌더링
3. **액세서리** → 작은 아이콘/이모지를 캐릭터 위에 절대 위치로 오버레이
4. **의상 컬러** → 캐릭터 프레임/배경 컬러 변경으로 표현

## 구현할 카테고리 (5개, 기본 전부 해금)

| 카테고리 | 표현 방식 | 파츠 수 |
|---------|----------|--------|
| 글러브 | 컬러 배지 + 네임태그 | 8 |
| 이펙트 | CSS 파티클 애니메이션 | 4 |
| 액세서리 | 이모지 오버레이 | 6 |
| 프레임 | 캐릭터 프레임 컬러/스타일 | 4 (신규) |
| 칭호 | 텍스트 라벨 | 4 (신규) |

## 작동 루프

```text
프리셋 선택 → 꾸미기 탭 진입 → 카테고리 선택 → 
파츠 선택 → 프리뷰 즉시 반영 → 저장 →
프로필/명예의전당에 반영
```

## 변경 파일

1. **`CharacterStudioPage.tsx`**
   - TABS에 "꾸미기" 탭 추가 (기존 "준비 중" 배너 대체)
   - CustomizeTab 컴포넌트: 카테고리 탭 + 파츠 썸네일 그리드
   - 프리뷰에 선택한 이펙트/액세서리 오버레이 반영

2. **`CharacterSprite.tsx`**
   - `customization` prop 추가: `{ gloveColor?, effect?, accessory?, frame? }`
   - CSS 파티클 렌더링 (이펙트)
   - 이모지 오버레이 렌더링 (액세서리)
   - 프레임 스타일 렌더링

3. **`useCharacterData.ts`**
   - 저장 시 `parts_json`에 `{ style: "male_01", customization: { gloveColor: "gold", effect: "sparkle", ... } }` 형태로 저장
   - 기존 `style` 키 유지 → PNG 렌더링 호환
   - 기존 Hall of Fame / 프로필 연동 유지

4. **신규: `src/data/characterCustomizationData.ts`**
   - 실제로 시각 표현 가능한 커스터마이징 옵션 정의
   - 각 옵션에 CSS/이모지 렌더링 설정 포함

## 저장 구조 (DB 변경 없음)

```json
{
  "style": "male_01",
  "customization": {
    "gloveColor": "gold",
    "effect": "sparkle", 
    "accessory": "headband_red",
    "frame": "fire"
  }
}
```

기존 `character_presets.parts_json` 컬럼에 저장 (jsonb). 스키마 변경 불필요.

## Hall of Fame / Black Aura 호환

- PNG 프리셋 렌더링 로직 변경 없음
- 이펙트/액세서리 오버레이는 CharacterSprite 내부에서 조건부 렌더링
- 미니 사이즈(xs/sm)에서는 이펙트만 표시, 액세서리는 숨김
- Black aura 로직 그대로 유지

## 숨기는 카테고리 (시각 품질 미달)

skin, hair_back, hair_front, eyebrows, eyes, mouth, top, shorts, shoes — 이 9개는 PNG 이미지를 실제로 변경할 수 없으므로 노출하지 않음. SVG 전용 파츠로 남겨두되 사용자에게 보이지 않음.

