---
name: 캐릭터 커스터마이징 v3 — PNG 이미지 오버레이
description: 프리셋별 앵커 맵 + 투명 PNG 오버레이 에셋으로 액세서리/글러브 렌더링
type: feature
---
- v3 아키텍처: emoji/CSS 오버레이 → 실제 투명 PNG 이미지 오버레이로 전면 교체
- 에셋 위치: src/assets/overlays/ (acc_crown_only, acc_sunglasses_only, acc_headband_red/black_only, glove_red/blue/gold/black)
- 프리셋별 앵커 시스템: getPresetAnchors(presetStyle) — head_top, eye_line, forehead, hands 존
- PRESET_ANCHOR_OVERRIDES: 프리셋별 미세 좌표 조정 지원
- ACCESSORY_ANCHOR_ZONE: 액세서리 키 → 앵커 존 매핑 (crown→head_top, sunglasses→eye_line, headband→forehead)
- 글러브: hands 존에 mixBlendMode: multiply로 렌더링
- 옵션 썸네일: CUSTOMIZATION_CATEGORIES 각 옵션에 thumb 필드로 실제 PNG 썸네일
- CharacterSprite: AccessoryImageOverlay, GloveImageOverlay 컴포넌트 — 이미지 기반
- Character Studio: 꾸미기 탭 편집 시 모션 비활성화 (animate={activeTab !== "customize"})
- 유지 카테고리: accessory(4), gloveStyle(4), effect(4), frame(4), title(4) = 총 20개 옵션
- 제거된 가짜 옵션: star_mark(emoji), 이전 CSS circle 글러브
- 저장: character_presets.parts_json.customization에 {gloveStyle, accessory, effect, frame, title} 저장
- Hall of Fame / Profile / Black aura 호환 유지
