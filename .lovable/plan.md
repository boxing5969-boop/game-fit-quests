
# 153랭크업 시스템 대규모 업데이트 계획

## Phase 1: 데이터베이스 스키마 변경
1. **역할 시스템 변경**: `app_role` enum을 `member`, `branch_manager`, `super_admin`으로 변경
2. **branches 테이블 업데이트**: `code` 컬럼 추가
3. **profiles 테이블 업데이트**: `branch_id` 추가 (branches FK), 기존 `branch_name` 텍스트에서 FK 관계로 전환
4. **새 테이블 생성**:
   - `level_status`: 회원별 40레벨 각각의 상태 추적 (locked/in_progress/pending/approved/revision_requested/rejected/boss_cleared)
   - `manager_notes`: 관장님 메모 (internal/visible 타입)
   - `notifications`: 인앱 알림
5. **mission_submissions 업데이트**: `revision_requested` 상태 추가를 위해 status 타입 변경
6. **RLS 정책 전면 재작성**: branch_manager는 자기 지점만, super_admin은 전체

## Phase 2: 브랜드 및 용어 변경
- 앱 전체에서 "벨트" 표현 제거
- "화이트 레벨 1" 형식으로 통일
- 브랜드명 "153랭크업 시스템"으로 변경
- 모든 컴포넌트/페이지에서 표기 수정

## Phase 3: 관장님(branch_manager) 페이지 구현
1. **BranchManagerHome**: 지점 회원 리스트 + 통계 대시보드
2. **MemberDetailPage**: 회원 상세 관리 (5개 탭)
   - 개요 탭
   - 미션 승인 탭
   - 계급도 체크 탭
   - 활동기록 탭
   - 관리자 메모 탭
3. **회원 앱 보기 모드** 토글

## Phase 4: 라우팅 및 인증 분기
- 로그인 후 역할별 리다이렉트
- member → /home
- branch_manager → /manager
- super_admin → /admin

## Phase 5: 더미 데이터 생성
- 지점 2개, 각 지점 회원 10명, branch_manager 2명

## 기술적 고려사항
- 기존 `coach` 역할 → `branch_manager`로 마이그레이션
- 기존 `admin` 역할 → `super_admin`으로 마이그레이션
- 기존 security definer 함수들 업데이트 필요
- 반응형: 모바일 1단, 태블릿/PC 2단 레이아웃
