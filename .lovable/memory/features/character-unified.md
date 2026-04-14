---
name: 캐릭터 통합 경험 시스템
description: CharacterStudio를 메인 허브로 통합, PNG 프리셋 스타일 고정, SVG 커스터마이징은 숨김
type: feature
---
- CharacterStudioPage: 4탭 통합 허브 (내 캐릭터 / 프리셋 선택 / 성장 / 효과)
- **스타일 고정 원칙**: 12개 승인된 PNG 프리셋이 항상 표시됨
- SVG LayeredCharacterRenderer는 사용자에게 노출되지 않음 (스타일 불일치로 숨김)
- 프리뷰는 항상 PNG 프리셋, 절대 SVG로 전환되지 않음
- 꾸미기 기능: "준비 중" 상태 — 프리셋 위에 오버레이하는 방식으로 추후 구현 예정
- 성장 탭: characterUnlockData.ts — 리그/레벨별 해금 마일스톤 9단계
- 효과 탭: 오라 상태 + 리그별 프레스티지 표시
- AvatarPage: "아이템 상점"으로 역할 분리, 캐릭터 빌더 중복 제거됨
- 기존 프리셋 12종, Black 후광 모두 유지
- Hall of Fame: PNG 프리셋 기반으로 동작, 변경 없음
- 저장: 항상 style 키로 저장, parts 키는 사용하지 않음
