---
name: 캐릭터 통합 경험 시스템
description: CharacterStudio를 메인 허브로 통합 (만들기+꾸미기+성장+효과), AvatarPage는 아이템상점으로 재배치
type: feature
---
- CharacterStudioPage: 5탭 통합 허브 (내 캐릭터 / 프리셋 / 꾸미기 / 성장 / 효과)
- 상단: 라이브 프리뷰 + 리그/레벨 표시 + 저장 버튼
- 중단: iOS 세그먼트 탭
- 하단: 탭별 컨텐츠
- 성장 탭: characterUnlockData.ts — 리그/레벨별 파츠 해금 마일스톤 9단계
  - White 1-3: 기본 19개 파츠
  - White 4-7: 추가 글러브/의상 13개
  - White 8-10: 추가 8개
  - Blue 1-5: 블랙/퍼플 글러브, 특별 헤어 11개
  - Blue 6-10: 액세서리 해금 8개
  - Red 1-5: 이펙트 해금, 프리미엄 스타일 13개
  - Red 6-10: 전설 로브/골드 8개
  - Black 1-5: 블랙 후광 자동
  - Black 10: 마스터 레인보우 프레스티지
- 효과 탭: 오라 상태 + 이펙트 파티클 + 리그별 프레스티지 표시
- AvatarPage: "아이템 상점"으로 리네임, 캐릭터 빌더 중복 제거
- MyPage: 대형 캐릭터 프리뷰 + 캐릭터 스튜디오 바로가기 통합
- HallOfFameShowcase: 이미 character assignment 연동 완료 (변경 없음)
- 기존 프리셋 12종, 파츠 81개, Black 후광 모두 유지
