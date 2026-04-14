---
name: 캐릭터 파츠 시스템
description: SVG 레이어 렌더러 + 81개 파츠 + 프리셋/파츠 듀얼 모드 스튜디오, 블랙 리그 레인보우 후광
type: feature
---
- DB: character_part_categories (13종), character_parts (81개 실제 레코드), character_presets, member_character_assignments
- 프리셋 12종: male 6 + female 6, PNG full-body 이미지
- 파츠 81개: skin(5), hair_back(8), hair_front(8), eyebrows(6), eyes(8), mouth(6), gloves(8), top(8), shorts(8), shoes(6), accessory(6), effect(4)
- SVG 기반 LayeredCharacterRenderer: 프로그래매틱 렌더링, 레이어 정렬 보장
- CharacterStudioPage: 프리셋 선택 모드 + 파츠 조합 모드 (탭 전환)
- CharacterSprite: partsJson.parts 존재 시 SVG, partsJson.style 존재 시 PNG 자동 선택
- CharacterRail: partsJson prop 지원, 커스텀+프리셋 혼합 렌더링
- BlackLeagueAura: CSS conic-gradient 레인보우 후광 (compact/detail/master 모드)
- getCharacterByHash(): userId 기반 deterministic fallback
- 관리자/branch_manager가 회원에 캐릭터 할당 가능
- prefers-reduced-motion 지원
