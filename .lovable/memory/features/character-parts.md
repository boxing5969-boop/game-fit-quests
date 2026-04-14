---
name: 캐릭터 파츠 시스템
description: 치비 복서 캐릭터 프리셋 8종, 캐릭터 스튜디오, 명예의전당 레일, 회원별 할당
type: feature
---
- DB: character_part_categories, character_parts, character_presets, member_character_assignments
- 프리셋 8종: male 4 + female 4, 각각 다른 색상/스타일
- /character-studio 페이지에서 선택 & 저장
- HallOfFameShowcase에 CharacterRail 통합
- CharacterSprite: xs/sm/md/lg 사이즈 렌더링
- getCharacterByHash(): userId 기반 deterministic fallback
- 관리자/branch_manager가 회원에 캐릭터 할당 가능
- 추후 파츠 레이어 시스템으로 확장 예정 (현재는 prebuilt 캐릭터)
