

# 캐릭터 꾸미기 시스템 구현 플랜

## 개요
기존 153랭크업 시스템에 캐릭터 꾸미기 + 링젬 경제 시스템을 추가. DB 마이그레이션 → 링젬 자동 지급 → 꾸미기 UI 순서로 구현.

## 1단계: DB 마이그레이션 (6개 테이블 + 3개 함수)

### 새 테이블
- **avatar_item_categories** — 카테고리 (글러브, 헤어, 상의, 하의, 신발, 액세서리)
- **avatar_items** — 아이템 (카테고리, 이름, 희귀도, 가격, asset_url, thumb_url, league_requirement)
- **user_wallets** — 회원별 링젬 잔액 (user_id unique, gems_balance default 0)
- **wallet_transactions** — 링젬 이력 (amount, reason, meta_json)
- **user_owned_items** — 소유 아이템 (user_id + item_id unique)
- **user_avatar_equipment** — 현재 장착 (user_id + category_code unique → item_id)

### DB 함수
- **grant_gems(user_id, amount, reason)** — 젬 지급 + 트랜잭션 기록
- **purchase_avatar_item(item_id)** — 잔액 확인 → 차감 → 소유 추가
- **equip_avatar_item(item_id)** / **unequip_avatar_item(category_code)** — 장착/해제

### RLS 정책
- 회원: 자기 wallet/owned/equipment SELECT/INSERT/UPDATE
- branch_manager: 같은 지점 회원 wallet 조회 + grant_gems 호출 가능
- super_admin: 전체 관리
- avatar_items/categories: 전체 SELECT, admin만 관리

### handle_new_user 트리거 수정
- 신규 회원 가입 시 `user_wallets` row 자동 생성 (gems_balance = 0)

## 2단계: 링젬 자동 지급 연동

기존 DB 함수에 `grant_gems` 호출 추가:
- **approve_mission_submission** → +5 젬
- **approve_quest_submission** → +3 (main), +5 (sub), +10 (weekly), +50 (boss)
- **record_attendance** → +2 젬
- **pass_boss_battle** → +50 젬

## 3단계: 꾸미기 페이지 UI

### 새 파일
- **src/pages/AvatarPage.tsx** — `/avatar` 라우트
  - 중앙: 현재 장착 캐릭터 미리보기 (기존 boxer 이미지 + 장착 아이템 오버레이)
  - 하단: 카테고리 탭 (글러브/헤어/상의/하의/신발/액세서리)
  - 아이템 그리드 (소유=장착 가능, 미소유=가격 표시+구매)
  - 상단: 링젬 잔액 표시
  - 장착/해제/구매 버튼
  - 저장 버튼

### 기존 파일 수정
- **App.tsx** — `/avatar` 라우트 추가
- **BottomNav.tsx** — 전체 메뉴에 "내 복서 꾸미기" 항목 추가
- **HomePage.tsx** — 상단에 링젬 잔액 표시 (💎 아이콘 + 숫자)
- **MyPage.tsx** — "내 복서 꾸미기" 진입 버튼 추가

### 새 훅
- **src/hooks/useWallet.ts** — 잔액 조회, 구매 요청
- **src/hooks/useAvatarItems.ts** — 카테고리/아이템/소유/장착 조회

## 4단계: 관리자 수동 젬 지급

**MemberDetailPage.tsx**에 링젬 수동 지급/차감 UI 추가 (branch_manager/super_admin만)

## 기술 세부사항

- 아이템 asset은 사용자가 직접 업로드하므로, 1차 MVP에서는 카테고리와 빈 아이템 구조만 생성
- 기본 글러브 4개 (리그별 색상)를 seed 데이터로 삽입
- 꾸미기 미리보기는 기존 boxer 이미지 위에 장착 아이템을 CSS layer로 표시
- 라이브보드 연동은 2차에서 진행 (이번 MVP 범위 밖)

## 변경하지 않는 것
- 기존 라이브보드 구조/오른쪽 패널
- XP 시스템 (XP와 링젬은 완전 분리)
- 기존 프로필/member_progress 테이블
- 인증/RLS 구조

