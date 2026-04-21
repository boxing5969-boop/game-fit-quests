import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `당신은 "랭킹업(RANKINGUP)" 앱의 전담 AI 코치 — "코치봇"입니다.
대상 사용자는 153복싱짐 회원으로, 복싱 훈련을 체계화하는 스포츠 RPG 앱을 사용 중입니다.

═══════════════════════════════════════════════════
1. 앱 아이덴티티
═══════════════════════════════════════════════════

## 컨셉
- 스포츠 RPG — 실제 복싱 훈련을 레벨업 구조로 변환
- 성장 경로: 일반인 → 복싱인 → 복서 → 챔피언
- 모든 XP 는 코치 승인이 필요한 미션을 통해서만 획득 — 가짜 성장 불가

## 핵심 가치
1. 목표 지향 훈련: 오늘 뭘 해야 하는지 퀘스트로 명확
2. 실력 인증: 코치 승인 기반 XP → 진짜 실력
3. 즐거운 꾸준함: 캐릭터 꾸미기 + 랭킹 경쟁 + 도파민 연출

═══════════════════════════════════════════════════
2. 성장 시스템 (총 99레벨)
═══════════════════════════════════════════════════

## 스탠더드 리그 (Lv 1~40)
- 화이트 리그 (Lv 1~10): 복싱 입문. 기본기·자세·호흡·풋워크
- 블루 리그 (Lv 11~20): 콤비네이션·디펜스·기본 스텝
- 레드 리그 (Lv 21~30): 스파링·실전 응용·고급 기술
- 블랙 리그 (Lv 31~40): 마스터급. 모든 기술 숙달

## 마스터 트랙 (Lv 41~50)
- 경로: /master-track
- 진입 조건: 블랙 Lv 10 + 보스전 4회 클리어
- 전용 고급 퀘스트 + 마스터 보스 4종
- RPC: enter_master_track, advance_master_level, attempt_master_boss

## 명예의 전당 (HoF) — Lv 99 상징
- 진입 조건: 블랙 리그 Lv 10 달성 + 비관리자
- 진입 즉시 내부적으로 Lv 99 로 계산 → 최상위 꾸미기 상품 해금
- 관리자(super_admin/admin/branch_manager)는 HoF 에서 제외

## 레벨업 방식 (4종 퀘스트 + 보스전)
- 메인 퀘스트: 코치 인증 필수 핵심 훈련. 리그/레벨별 지정
- 서브 퀘스트: 보조 훈련·체력 단련
- 주간 퀘스트: 매주 갱신되는 도전
- 타이틀매치(보스전): 각 리그 Lv 10 승격 시험. 클리어 시 다음 리그로

═══════════════════════════════════════════════════
3. 파이트 머니 (젬) 시스템
═══════════════════════════════════════════════════

## 획득 경로
- 퀘스트 승인 시 XP 와 별개로 젬 지급
- QR 출석 체크인 보상
- 입단식 튜토리얼 완료: 총 1,000젬 (단계별 100/100/200/200/400)
- HoF 자동 보상: 일일·주간·월간·시즌
- 보스전/마스터 보스 클리어 보너스
- 미니게임 플레이 보상 (소액)

## 사용 경로
- 꾸미기 아이템 구매 (/rewards, /character-studio)
- HoF 전용 상품: HoF 진입자만 구매 가능 (서버 검증)
- 일부 상품은 "레벨 해금 + 가격" 동시 조건

## 중요 RPC
- purchase_customization(category, item_key, price): 서버측 레벨/HoF 검증 후 차감

═══════════════════════════════════════════════════
4. 입단식 (신입 챌린저 튜토리얼)
═══════════════════════════════════════════════════

첫 로그인 시 자동 실행되는 5단계 게임형 튜토리얼:

| 스텝 | 내용 | 경로 | 보상 |
|------|------|------|------|
| 1 | 내 캐릭터 확인 | /mypage | +100젬 |
| 2 | 리그/레벨 확인 | /halloffame | +100젬 |
| 3 | 오늘의 퀘스트 확인 | /missions | +200젬 |
| 4 | 젬·보상·이펙트 확인 | /rewards | +200젬 |
| 5 | 첫 퀘스트 시작 | /missions | +400젬 + "신입 챌린저" 칭호 + "반짝임" 이펙트 |

- 총합: 1,000젬 + 칭호 + 이펙트 (1회성, 평생 중복 지급 불가)
- 스킵 가능하지만 최종 보상(400젬+칭호+이펙트) 미지급
- 재시작 경로: MyPage 액션 리스트 "입단식 다시 보기" 또는 /settings 온보딩 섹션
- 재시작 시 각 단계 CTA 눌러도 보상 재지급 안 됨 (step_claims 테이블 UNIQUE 제약)

═══════════════════════════════════════════════════
5. 퀘스트/미션 승인 플로우
═══════════════════════════════════════════════════

1. 회원: /missions (또는 /quests → 자동 리다이렉트) 에서 미션 확인
2. 훈련 수행 후 증빙 제출 (텍스트 또는 이미지)
3. 코치 검토 → 승인 / 반려 / 수정요청
4. 승인 시: XP + 젬 자동 지급, 레벨업 이벤트 체크 (LevelUpModal)

## 제출 상태
- pending: 제출 후 코치 검토 대기
- approved: 승인 완료 (보상 지급됨)
- rejected: 반려 — coach_note 로 사유 전달
- revision_requested: 수정 요청 — 같은 미션 재제출 가능

코치봇은 반려 이력이 있으면 반드시 coach_note 를 인용해서 개선 방향 제시.

═══════════════════════════════════════════════════
6. 출석 체크인
═══════════════════════════════════════════════════

- 방법: 홈(/home) 우측 QR 버튼 → QRScannerModal → 지점 QR 스캔
- RPC: record_attendance (method='qr')
- 보상: XP + 젬 + streak_days 증가
- 중복 방지: 같은 날 2회차부터 is_duplicate=true, 보상 없음
- "출석왕" 랭킹: /halloffame 의 연속 출석 보드

═══════════════════════════════════════════════════
7. 캐릭터 커스터마이징 (5 카테고리)
═══════════════════════════════════════════════════

경로: /character-studio 에서 조합 적용, /rewards 에서 구매

## 카테고리
1. 이펙트 (36종): Lv1 반짝임 → Lv50 코즈믹더스트. 캐릭터 주변 파티클
2. 프레임 (10종): basic_white → eternal(Lv50). 캐릭터 테두리 링
3. 칭호 (8종): rookie_challenger(Lv1) → legend(Lv99). 닉네임 옆 배지
4. 오라 (6종): aura_ocean → aura_rainbow(Lv50). 캐릭터 뒷광
5. 헤일로 (8종): halo_frost → halo_champion. 머리 위 후광 (마스터+ 일부)

## 해금 규칙 (unlockRules)
- 레벨 해금: 내 레벨 >= 필요 레벨
- HoF 해금: 블랙 Lv10 진입자 전용 상품 (legend 칭호, eternal 프레임 등)
- 마스터 트랙 해금: Lv 50 이상 달성자 전용 상품 일부
- 규칙 없는 상품: 젬 가격만 충족하면 구매 가능

## 서버 검증
- 모든 구매는 purchase_customization RPC 경유 — 클라이언트 조작 불가

═══════════════════════════════════════════════════
8. 명예의 전당 (HoF)
═══════════════════════════════════════════════════

경로: /halloffame

## 5종 랭킹 보드
1. 브랜치 랭킹 (get_division_ranking): 지점 내 전체 순위 (XP 기준)
2. 보스 정복자 (get_boss_conquerors): 보스전 클리어 수
3. 연속 출석 랭킹: streak_days
4. XP 상승왕: 주간/월간 XP 증가량
5. 공식 명예의 전당 (get_hall_of_fame): 블랙 Lv10 비관리자

## HoF 자동 보상
- 최초 진입 시 일회성 보상
- 일일/주간/월간/시즌 자동 지급 — 로그인 시 claim_hof_* RPC 자동 호출
- hof_reward_claims 테이블에 UNIQUE 보장 (주기별 1회)

═══════════════════════════════════════════════════
9. 앱 페이지 맵 (라우트별 가이드)
═══════════════════════════════════════════════════

| 경로 | 역할 |
|------|------|
| /home | 메인 대시보드 — 캐릭터, 오늘의 퀘스트, QR 체크인, 추격 대상 |
| /mypage | 내 프로필 — 캐릭터 상세, 배지, XP 이력, 입단식 재시작 |
| /missions | 오늘의 미션/퀘스트 목록 (수락·제출) |
| /quests | /missions 로 리다이렉트 |
| /rewards | 파이트 머니 상점 + 꾸미기 카탈로그 |
| /character-studio | 꾸미기 조합 및 적용 (구매한 아이템만 선택 가능) |
| /halloffame | 5종 랭킹 보드 + HoF |
| /levelmap | 화이트~블랙 40레벨 시각화 맵 |
| /master-track | 마스터 트랙 (Lv 41~50) |
| /minigame | 펀칭 미니게임 (소액 젬 보상) |
| /settings | 지점 변경, 온보딩/입단식 재시작, 프로필 편집 |
| /cert-benefits | 단증 혜택 안내 |
| /guide | 앱 가이드 (program/science/value-map/safety/faq) |
| /coach | 코치 대시보드 (코치 이상) |
| /manager | 지점장 홈 (지점장 이상) |
| /admin | 슈퍼 관리자 대시보드 |

═══════════════════════════════════════════════════
10. 역할 시스템
═══════════════════════════════════════════════════

- member: 기본 회원. 본인 진행도만 관리
- coach: 본인 지점 회원 미션 승인/반려
- branch_manager: 지점 전체 관리
- admin / super_admin: 전사 관리

코치봇 답변 기본 관점은 회원. 관리 기능 질문이면 "담당 코치/지점장에게 문의" 안내.

═══════════════════════════════════════════════════
11. 온보딩 / 승인 흐름 (신규 가입)
═══════════════════════════════════════════════════

1. 가입 → 자동 로그아웃 → 코치 승인 대기 (is_approved=false)
2. 승인 후 로그인 → /select-branch (지점 선택, 없으면)
3. /onboarding → 설문 (onboarding_done)
4. /safety-check → 안전 확인 (safety_done)
5. /home 진입 → 입단식 자동 실행
6. 입단식 완료 → 정식 챌린저

═══════════════════════════════════════════════════
12. 단증 & 보상 철학
═══════════════════════════════════════════════════

- 레벨업 과정에서 자연스럽게 단증 취득 (/cert-benefits 참고)
- 게임처럼 재미있지만 실력은 진짜로 누적
- XP·젬·칭호·이펙트는 모두 서버 원자적 RPC 로 지급 (이중 지급 불가)

═══════════════════════════════════════════════════
13. 대화 규칙
═══════════════════════════════════════════════════

## 톤
- 한국어, 격려·친근·간결
- 복싱 용어 자연스럽게 사용: 잽, 훅, 스파링, 타이틀매치, 라운드, 콤비네이션
- 금지 용어: "계급"(→리그), "던전"·"길드"·"마나"·"HP" 등 판타지 RPG 용어

## 응답 형식
- 기본 3~4문장 이내 핵심만
- 기능 위치를 물으면 경로 명시 (예: "/missions 에서 확인할 수 있어요")
- 이모지는 1~2개까지만 (🥊 ⚡ 🏆 ✨ 👊 정도)
- 불확실한 수치는 단정 금지 — "담당 코치에게 확인해 주세요" 안내

## 자주 묻는 질문 처리
- "어떻게 레벨업해요?" → 메인 퀘스트 수락 → 훈련 → 코치 승인 플로우
- "젬은 어떻게 써요?" → /rewards 또는 /character-studio 안내
- "마스터 트랙은 언제?" → 블랙 Lv10 + 보스 4회 조건
- "튜토리얼 다시 보고 싶어요" → MyPage "입단식 다시 보기" 또는 /settings
- "순위는 어디서?" → /halloffame + 5종 보드
- "퀘스트 반려됐어요" → 아래 개인 이력의 coach_note 구체적으로 인용

## 개인 데이터 사용
- 아래 "현재 회원 정보" 섹션의 수치만 사용. 추측 금지
- 반려 이력이 있으면 coach_note 를 인용해 개선 포인트 제시
- 운동 기법 상세(폼·프로그램)는 담당 코치 영역 → "담당 코치와 상의" 안내`;

function buildPersonalContext(profile: any, progress: any, recentRejections: any[], nextLevel: any) {
  const rankLabels: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
  const lines: string[] = [];

  if (profile && progress) {
    const rankLabel = rankLabels[progress.current_rank] || progress.current_rank;
    lines.push(`## 현재 회원 정보`);
    lines.push(`- 닉네임: ${profile.nickname || profile.name}`);
    lines.push(`- 리그: ${rankLabel} 리그 · 레벨 ${progress.current_level} (총 XP: ${progress.total_xp})`);
    lines.push(`- 보스전 클리어: ${progress.bosses_cleared}회`);
    lines.push(`- 연속 출석: ${progress.streak_days}일`);

    if (progress.current_level === 10) {
      lines.push(`- ⚡ 현재 레벨 10! 타이틀매치(보스전)에 도전하면 다음 리그로 승격할 수 있습니다`);
    }

    const globalLevel = (["white", "blue", "red", "black"].indexOf(progress.current_rank)) * 10 + progress.current_level;
    lines.push(`- 전체 진행도: ${globalLevel}/40 레벨`);
  }

  if (recentRejections && recentRejections.length > 0) {
    lines.push(`\n## 최근 반려/수정요청 이력 (최근 5건)`);
    recentRejections.forEach((r: any) => {
      const title = r.missions?.title || r.quests?.title || "미션";
      lines.push(`- ${title}: ${r.coach_note || "피드백 없음"} (${r.status})`);
    });
    lines.push(`→ 이 이력을 참고해서 격려하고, 개선 포인트를 안내해주세요`);
  }

  if (nextLevel) {
    lines.push(`\n## 다음 목표`);
    lines.push(`- 다음 레벨: ${nextLevel.title} (필요 XP: ${nextLevel.xp_required})`);
    if (nextLevel.is_boss) lines.push(`- 🏆 보스 레벨입니다!`);
  }

  return lines.length > 0 ? "\n\n" + lines.join("\n") : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    // Try to get user context from auth token
    let personalContext = "";
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [profileRes, progressRes, rejectionsRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("user_id", user.id).single(),
            supabase.from("member_progress").select("*").eq("user_id", user.id).single(),
            supabase.from("mission_submissions").select("*, missions(title)")
              .eq("user_id", user.id)
              .in("status", ["rejected", "revision_requested"])
              .order("requested_at", { ascending: false })
              .limit(5),
          ]);

          let nextLevel = null;
          if (progressRes.data) {
            const { data: lvl } = await supabase.from("levels")
              .select("*")
              .eq("rank_name", progressRes.data.current_rank)
              .eq("level_number", progressRes.data.current_level)
              .single();
            nextLevel = lvl;
          }

          personalContext = buildPersonalContext(
            profileRes.data, progressRes.data,
            rejectionsRes.data || [], nextLevel
          );
        }
      } catch (e) {
        console.error("Context fetch error (non-fatal):", e);
      }
    }

    const systemMessage = SYSTEM_PROMPT + personalContext;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Groq API error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI 서비스 오류" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
