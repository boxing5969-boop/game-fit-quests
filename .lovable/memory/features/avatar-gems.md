---
name: Avatar & Ring Gem System
description: 2D layered SD boxer character customization + Ring Gem economy system
type: feature
---
## 캐릭터 꾸미기 + 링젬 시스템

### DB 테이블
- avatar_item_categories: 6개 카테고리 (글러브/헤어/상의/하의/신발/액세서리)
- avatar_items: 아이템 (rarity, price_gems, league_requirement)
- user_wallets: 회원별 링젬 잔액
- wallet_transactions: 링젬 거래 이력
- user_owned_items: 소유 아이템
- user_avatar_equipment: 장착 아이템

### 링젬 자동 지급
- 미션 승인: +5
- 퀘스트 승인: main +3, sub +5, weekly +10, boss +50
- 출석 체크: +2
- 보스전 합격: +50

### 페이지
- /avatar: 꾸미기 페이지 (AvatarPage.tsx)
- HomePage 헤더에 링젬 잔액 표시
- MyPage에 꾸미기 진입 버튼
- MemberDetailPage에 관리자 링젬 지급/차감

### 다음 단계 (미구현)
- 라이브보드에 장착 캐릭터 반영
- 아이템 에셋 업로드
- 상점 고도화 (희귀도, 한정판 등)
