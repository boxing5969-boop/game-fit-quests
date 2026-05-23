# 마이복서153 (MY BOXER 153)

> 153복싱짐 회원을 위한 스포츠 RPG 피트니스 앱.
> 출석·훈련·다이어트·커뮤니티를 게임화해서 "복서로 성장하는 여정"으로 만든다.

브랜드:
- 앱 이름: **마이복서153**
- 영문 로고: **MY BOXER 153**
- 시스템명: **153 QUEST**
- 공식 훈련 과정: **마스터 로드**
- 시즌/이벤트: **더 다이어터**

---

## ✨ 주요 기능

- **🥊 챔피언 로드(스토리 RPG)** — 챔피언 게이트~타이틀전까지 단계별 스토리·일러스트·미션
- **📅 7일 튜토리얼 캠프** — 첫 일주일 동안 73단계 가이드로 핵심 기능 학습
- **🎯 마스터 로드(공식 훈련)** — 체계화된 훈련 과정과 인증/뱃지 시스템
- **🥗 더 다이어터(21일 다이어트 챌린지)** — 식단·체중·운동 로그 + 챌린지 페이지
- **📲 QR 출입 체크인** — Supabase Edge Function 기반 1회용 토큰 QR
- **🤖 AI 코치봇** — Groq `llama-3.1-8b-instant` 스트리밍, 153 시스템 프롬프트로 컨텍스트화
- **👥 마이복서 커뮤니티 + 명예의 전당** — 동료 복서·코치와 소셜 활동
- **🏪 지점 운영자 도구** — 코치 대시보드, 회원 관리, 라이브 보드, 출석 보드
- **🎨 캐릭터 스튜디오** — 아바타 커스터마이즈, 보상/젬 시스템

## 🧱 기술 스택

### Frontend
- **React 18 + Vite + TypeScript**
- **Tailwind CSS + shadcn/ui + lucide-react** — 디자인 시스템
- **TanStack React Query** — 서버 상태 캐시
- **React Router v6** (lazy routing)
- **Framer Motion** — 애니메이션
- **Recharts** — 차트
- **Zod + react-hook-form** — 폼/검증
- 배포: **Cloudflare Pages**

### Backend
- **Supabase** — Postgres + Row Level Security (RLS) + RPC(SECURITY DEFINER) + Storage
- **Edge Functions (Deno)** — `chat-assistant`, `qr-checkin`, `qr-token-refresh`, `delete-user`, `verify-identity-reset` 등 8개
- **AI 추론**: Groq → Cerebras → SambaNova → DeepSeek 순 폴백

### 별도 시스템 (외부)
- **네이버 톡톡 자동 상담 봇** (`external/naver-talktalk/`, `supabase/functions/talktalk-*`) — 마이복서153 앱과 별도

---

## 🚀 빠른 시작

### 사전 요구사항
- [Bun](https://bun.sh) (lockfile: `bun.lock`)
- Node 18+ (호환용)
- Supabase 프로젝트 (무료 tier 가능)

### 설치 & 실행

```bash
bun install
cp .env.example .env       # 그리고 실제 키 값 입력
bun run dev                # http://localhost:8080 (vite)
```

### 자주 쓰는 명령

```bash
bun run dev           # 개발 서버
bun run build         # 프로덕션 빌드 (타입체크 포함) — 푸시 전 필수
bun run test          # vitest
bun run lint          # ESLint
npx tsc --noEmit      # 타입만 빠르게 확인
```

### 환경 변수

`.env.example` 참고. 클라이언트는 `VITE_SUPABASE_*` 세 개만 필요하고, 나머지 시크릿(GROQ_API_KEY 등)은 Supabase Edge Function 시크릿으로 등록한다.

---

## 📂 디렉터리 구조

```
src/
  pages/           # 라우트별 페이지 (Home, MasterTrack, MyBoxerCommunity, …)
  components/      # 재사용 컴포넌트 (shadcn/ui 기반 + ChatAssistant 등)
  features/        # 기능별 도메인 로직
  contexts/        # React Context (인증, 테마 등)
  hooks/           # 커스텀 훅
  services/        # Supabase 호출 추상화
  integrations/
    supabase/      # createClient + 자동 생성 타입
  assets/          # 복서 캐릭터 일러스트 등
  data/            # 정적 데이터 (스토리, 미션 정의)
  types/           # 공용 타입
supabase/
  migrations/      # YYYYMMDDhhmmss_*.sql — 85+ 개 마이그레이션
  functions/       # Edge Functions (Deno)
public/
  assets/          # 스토리 RPG 배경/맵/타이틀 일러스트
external/
  naver-talktalk/  # 네이버 톡톡 봇 (별도 시스템)
docs/              # 기획/실행 문서
```

자세한 아키텍처와 절대 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참고.

---

## 🤝 기여

이 프로젝트는 153복싱짐 운영 도구로 시작했지만, 피트니스·운동 게임화에 관심 있는 누구나 기여 환영.

- 이슈/PR 모두 환영합니다.
- 변경 전 [`CLAUDE.md`](./CLAUDE.md) 의 "절대 규칙(Always-On)" 을 한 번 읽어주세요 — UI 일관성·AI 코치봇 단일 경로 등 제약이 있습니다.
- 커밋 메시지: `feat(영역): …`, `fix(영역): …`, `chore(talktalk): …` 형식.
- PR 전 `bun run build` 통과 확인 필수.

## 📜 라이선스

MIT License — 자세한 내용은 [LICENSE](./LICENSE) 참고.

## 🙏 크레딧

- 초기 스캐폴딩: [Lovable.dev](https://lovable.dev)
- 디자인 시스템: [shadcn/ui](https://ui.shadcn.com)
- 호스팅: [Cloudflare Pages](https://pages.cloudflare.com) + [Supabase](https://supabase.com)
- AI 추론: [Groq](https://groq.com), Cerebras, SambaNova, DeepSeek
