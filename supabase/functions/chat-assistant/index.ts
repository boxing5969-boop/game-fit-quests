import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SYSTEM_PROMPT_153 } from "../_shared/systemPrompt153.ts";
import { KNOWLEDGE_153 } from "../_shared/knowledge153.ts";
import { KNOWLEDGE_BOXING_153 } from "../_shared/knowledgeBoxing153.ts";
import { analyzeMealImage } from "../_shared/mealVision.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ────────────────────────────────────────────────────────────────
// AI Provider 체인
//
// 위에서 아래로 순서대로 시도. 각 provider 는 환경변수 KEY 가 있어야 활성화 —
// 없으면 조용히 스킵하고 다음으로 넘어감. 모두 OpenAI 호환 SSE 포맷이라
// 클라이언트 스트리밍 파서를 바꿀 필요 없음.
//
// 폴백 조건: 429(분/일 한도) 또는 402(크레딧). 그 외 4xx/5xx 는 다음
// provider 로 가도 같은 에러가 날 가능성이 높고 쓸데없이 레이턴시만 쌓이므로
// 즉시 반환.
//
// Supabase 시크릿 등록 방법:
//   Dashboard → Edge Functions → chat-assistant → Secrets → 아래 이름으로 추가
//     GROQ_API_KEY        (필수, 1차)
//     GROQ_CHAT_MODEL     (선택 — 채팅 모델 교체용. 기본값은 아래 PROVIDERS 참고)
//     CEREBRAS_API_KEY    (선택, 2차 폴백)
//     SAMBANOVA_API_KEY   (선택, 3차 폴백 — cloud.sambanova.ai)
//     DEEPSEEK_API_KEY    (선택, 4차 폴백 — platform.deepseek.com, 크레딧 필요할 수 있음)
// ────────────────────────────────────────────────────────────────
type Provider = {
  name: string;
  keyEnv: string;
  url: string;
  model: string;
  /** 모델명을 시크릿으로 덮어쓰고 싶을 때 (재배포 없이 교체). */
  modelEnv?: string;
  /** provider 전용 추가 파라미터. 400 이 나면 이것만 빼고 1회 재시도한다. */
  extraBody?: Record<string, unknown>;
};

const PROVIDERS: Provider[] = [
  {
    name: "groq",
    keyEnv: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    // qwen3.6-27b — groq 가 2026-08-16 에 llama-3.1-8b-instant 를 은퇴시켜 교체.
    // (공식 대체안: openai/gpt-oss-20b 또는 qwen/qwen3.6-27b. 한국어 품질이 나은
    //  qwen 선택 — 식단 사진 분석과 같은 모델이라 관리도 단순하다.)
    // 또 단종되면 GROQ_CHAT_MODEL 시크릿만 바꾸면 된다 (재배포 불필요).
    model: "qwen/qwen3.6-27b",
    modelEnv: "GROQ_CHAT_MODEL",
    // qwen 은 추론 모델이라 기본값이면 <think> 블록이 그대로 스트리밍돼
    // 회원 화면에 노출된다. 코치 답변은 추론이 필요 없으니 아예 끈다.
    extraBody: { reasoning_effort: "none", reasoning_format: "hidden" },
  },
  {
    name: "cerebras",
    keyEnv: "CEREBRAS_API_KEY",
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: "llama3.1-8b",
  },
  {
    name: "sambanova",
    keyEnv: "SAMBANOVA_API_KEY",
    url: "https://api.sambanova.ai/v1/chat/completions",
    model: "Meta-Llama-3.1-8B-Instruct",
  },
  {
    name: "deepseek",
    keyEnv: "DEEPSEEK_API_KEY",
    url: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
  },
];
// 시크릿 위생 처리 — 대시보드에 API 키를 붙여넣을 때 섞여 들어오는 비ASCII
// 문자(한글·스마트따옴표·보이지 않는 문자)가 fetch 헤더에서
// "not a valid ByteString" 500 오류를 일으킨다 (2026-09-02 실제 발생).
// API 키는 전부 인쇄 가능한 ASCII 라 그 외 문자는 제거해도 안전하다.
const cleanKey = (raw: string | undefined | null, name = "secret"): string => {
  const s = raw ?? "";
  const cleaned = s.replace(/[^\x21-\x7E]/g, "");
  if (cleaned !== s) {
    console.warn(
      `[chat-assistant] ${name}: ${s.length - cleaned.length} invalid char(s) stripped — 대시보드에서 이 시크릿을 깨끗하게 다시 저장하세요`,
    );
  }
  return cleaned;
};
// 종합 코어 프롬프트 — CS 톤 + 앱 전체 기능 + 안전 규칙. 약 3500자.
// 토큰 예산: 시스템 ~1750 + 히스토리 2개 ~400 + 출력 200 = 약 2350 → TPM 6K 안전.
const SYSTEM_PROMPT = `너는 랭킹업(RANKING-UP) 앱의 AI 코치 "오삼"이야. 153복싱짐 회원의 복싱 훈련과 21일 다이어트를 같이 코칭해.

[CS 톤 — 반드시 지킬 것]
- 항상 친절·긍정·존중. CS 교육 철저히 받은 상담원처럼 응답.
- 인사: "안녕하세요!", 호명: "회원님", 마무리: "응원합니다 / 함께 해봐요 / 화이팅이에요".
- 부정어 최소화. "안 됩니다" 보다 "이 방법을 추천드려요" 형식.
- 회원이 좌절·실패 표현 시: 먼저 공감 → 작은 성공 짚기 → 다음 한 걸음 제안.
- 이모지는 🥊⚡🏆✨👊👏💪 중 1~2개.

[질문 분류]
- 인사·잡담: 짧게 인사·격려. 회원 데이터·다이어트 강의 절대 시작 금지.
- 복싱 기술(잽/스트레이트/훅/어퍼컷/카운터/스파링/풋워크/콤비네이션/디펜스): 복싱 기술 답변.
- 식단/다이어트/체중/단백질/칼로리: 153다이어트 원칙.
- 앱 기능: 아래 [앱 가이드] 참고.

[앱 가이드 — 모든 기능 학습 자료]
## 99레벨 시스템 (스탠더드는 정확히 4 리그 — 5 아님)
- 4 리그: 화이트(Lv1~10) / 블루(11~20) / 레드(21~30) / 블랙(31~40)
- 그 위에 마스터트랙(41~50, /master-track) — 진입 = 블랙 Lv10 + 보스 4회 클리어
- 그 위에 HoF(99레벨 상징) — 블랙 Lv10 비관리자 자동 진입, legend 칭호·eternal 프레임 해금
- 타이틀매치(보스전): 각 리그 Lv10에서 다음 리그 승격 시험.
- 주의: "5 리그" 라고 하지 말 것. 스탠더드 리그는 4 개야.

## 미션 / 퀘스트 (코치 승인 필수)
- 메인·서브·주간·보스전 4종. /missions 에서 확인·제출.
- 제출 → 코치 검토 → 승인(XP+젬) / 반려(coach_note) / 수정요청.
- /quests 는 /missions 로 자동 리다이렉트.

## 파이트 머니 (젬) — 획득·사용
- 획득: 미션 승인, QR 출석(/home), 입단식(총 1000젬), HoF 보상, 보스 클리어, 미니게임.
- 사용: /rewards 상점, /character-studio 꾸미기 5카테고리(이펙트·프레임·칭호·오라·헤일로).
- 일부 상품은 레벨 해금 + 가격 동시 조건. HoF 전용 상품도 존재.

## 입단식 (5단계 신입 튜토리얼)
1. 캐릭터 확인(/mypage) +100젬
2. 리그·레벨 확인(/halloffame) +100젬
3. 오늘의 퀘스트(/missions) +200젬
4. 젬·보상 확인(/rewards) +200젬
5. 첫 퀘스트 시작(/missions) +400젬 + "신입 챌린저" 칭호 + 반짝임 이펙트
- 총 1000젬 + 칭호 + 이펙트(1회성). 재시작은 MyPage·/settings.

## 출석
- QR 체크인: 홈 우측 QR 버튼 → 지점 QR 스캔. XP+젬+streak.
- 같은 날 2회차부터 보상 없음. 연속 출석 랭킹은 /halloffame.

## 랭킹 (5종 보드)
브랜치 / 보스 정복자 / 연속 출석 / XP 상승왕 / 공식 HoF — 모두 /halloffame.

## 153다이어트 / 21일 다이어트 (이 앱의 공식 정의 — 임의로 바꾸지 마)
- "153다이어트" = "21일 다이어트" = 동일한 프로그램. 둘은 같은 이름이야.
- 정의: 21일 동안 자가 기록을 통해 5대 습관을 만드는 "습관 리셋" 프로그램.
- 5대 습관(이게 전부야 — 다른 항목 추가 금지):
  ① 단백질 먼저 ② 채소·자연식 ③ 당음료 절제 ④ 야식 절제 ⑤ 출석
- 자가 기록 항목: 단백질먼저 / 채소 / 당음료절제 / 야식절제 / 출석 / 물(ml) / 수면(h) / 기분.
- 마일스톤은 딱 3개: 7일 / 14일 / 21일 완주.
- 21일 후 분기: ① 유지 컨설팅(자동 식단) ② 건강 리셋 연장(주차 미션·재평가).
- 절대 만들어내지 말 것: "3단계 프로그램", "매주 일요일 리셋", "3번 리셋", "1년 3개월 후 원상복귀" 같은 통계·구조 — 앱에 존재하지 않음.

## 자동 식단 (사후 프로그램)
- 모드: 자동 랜덤 / 가정집 한식 / 업무용 초간단.
- 끼니: 아침·점심·저녁 각 1슬롯. 다시뽑기로 슬롯 전체 무작위.
- 영양: 단백질·섬유·비타민·무기질·유산균 5대 추적.
- 부족 시 "오삼 코치 식단 도우미" 카드로 보강 안내(예: 식전 프로틴 쉐이크).

## 캐릭터 / 꾸미기
- /character-studio 에서 5카테고리(이펙트 36·프레임 10·칭호 8·오라 6·헤일로 8) 조합.
- /rewards 에서 구매. 모든 구매는 purchase_customization RPC 서버 검증.

## 미니게임 / 기타
- /minigame 펀칭 게임. 소액 젬 보상.
- /guide 앱 사용법·과학·안전·FAQ.
- /settings 지점 변경, 입단식 재시작.

## 역할
- member(기본) / coach(미션 승인) / branch_manager(지점 관리) / admin·super_admin(전사).
- 회원 관점으로 답변. 관리 기능 질문 시 "담당 코치/지점장 문의" 안내.

[규칙]
1. 한국어 표준어만. 외국어 문자(5个/recovery/修 등) 절대 금지. 동일 문장 반복 금지.
2. 답변 2-5문장. 명확·간결. 답변이 잘리지 않도록 결론까지 마무리.
3. 임의 합성어 만들지 마(예: 21야/포도살/유비식/식은 설퍼/국물 수박 금지). 표준어만.
4. 영양소 수치(g, kcal 등) / 통계 / 기간 / 비율을 임의로 만들지 마. 정확히 아는 일반 상식 수준만 인용하고, 자세한 수치는 "앱의 자동 식단·식품 가이드를 참고" 또는 "담당 코치 확인" 안내.
   잘못된 예 — 절대 금지:
   · "수박 8.9g/100g 식이섬유" (실제는 ~0.4g)
   · "다이어트 후 1년 3개월에 원상복귀" (출처 없음)
   · "21일 동안 매주 일요일 리셋, 총 3번 리셋" (이 앱의 실제 구조 아님)
   · "153다이어트는 3단계 프로그램" (이 앱의 실제 구조 아님)
5. 회원 실제 데이터가 컨텍스트에 없으면 절대 만들지 마. "회원님의 기록을 보면" 같은 표현 금지.
6. 성적·욕설·혐오·의료 진단·약물 권유 절대 금지.
7. 카운터=되받아치기 복싱 기술. 잽은 "잽" (쩁/쨉 금지). 식이섬유는 "식이섬유" (식은 설퍼 금지).
8. 역질문으로 마무리 금지. 다음 한 걸음을 구체적 행동으로 제안.
9. 모르는 건 솔직히 "확인이 어려워요. 담당 코치에게 문의해주세요" 안내.`;
function buildDietContext(enrollment: any, snapshot: any, recentLogs: any[], latestCoachNote: any) {
  if (!enrollment && !snapshot && (!recentLogs || recentLogs.length === 0)) return "";
  const lines: string[] = [];
  lines.push(`## 현재 153다이어트 진행 상황`);
  if (enrollment) {
    lines.push(`- 트랙: ${enrollment.track} · 상태: ${enrollment.status} · 현재 Day ${enrollment.current_day}`);
    if (enrollment.start_date) lines.push(`- 시작일: ${enrollment.start_date}`);
  }
  if (snapshot) {
    lines.push(`- 자가 기록 누적: ${snapshot.approved_days_total ?? 0}/21일`);
    lines.push(`- 현재 스트릭: ${snapshot.current_streak ?? 0}일 (최장 ${snapshot.best_streak ?? 0}일)`);
    lines.push(`- 습관 점수: ${snapshot.habit_score ?? 0}/100`);
    const m: string[] = [];
    if (snapshot.milestone_7_reached) m.push("7일");
    if (snapshot.milestone_14_reached) m.push("14일");
    if (snapshot.milestone_21_reached) m.push("21일 완주");
    if (m.length) lines.push(`- 달성 마일스톤: ${m.join(", ")}`);
  }
  if (recentLogs && recentLogs.length > 0) {
    lines.push(`\n## 최근 식습관 체크 (최근 ${recentLogs.length}일)`);
    for (const log of recentLogs) {
      const bits: string[] = [];
      if (log.protein_first) bits.push("단백질먼저O");
      if (log.veggies_natural) bits.push("채소O");
      if (log.sugary_drink_avoided) bits.push("당음료절제O");
      if (log.late_night_snack_avoided) bits.push("야식절제O");
      if (log.gym_attended) bits.push("출석O");
      if (log.water_ml) bits.push(`물 ${log.water_ml}ml`);
      if (log.sleep_hours) bits.push(`수면 ${log.sleep_hours}h`);
      const mood = log.mood ? ` · 기분 ${log.mood}` : "";
      const memo = log.memo ? ` · 메모 "${String(log.memo).slice(0, 60)}"` : "";
      lines.push(`- Day ${log.day_number} (${log.log_date}): ${bits.join(" / ") || "기록 부실"}${mood}${memo}`);
    }
  }
  if (latestCoachNote && latestCoachNote.note_text) {
    lines.push(`\n## 가장 최근 코치 메모`);
    lines.push(`- ${String(latestCoachNote.note_text).slice(0, 240)}`);
  }
  lines.push(`\n→ 이 정보를 반드시 참고해서 답변한다. 모순되는 추측 금지.`);
  return "\n\n" + lines.join("\n");
}

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
    const globalLevel = ["white", "blue", "red", "black"].indexOf(progress.current_rank) * 10 + progress.current_level;
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
// ────────────────────────────────────────────────────────────────
// 식단 사진 칼로리 추정 (action = "meal-vision")
//
// 별도 Edge Function 을 새로 만들지 않고 여기서 분기한다 — AI 경로를 하나로
// 유지하기 위해서다. 채팅과 달리 스트리밍이 아니라 JSON 한 번에 응답한다.
//
// 추가 시크릿 (선택):
//   GEMINI_API_KEY        1차. 없으면 조용히 건너뛰고 GROQ 로 간다.
//   GEMINI_VISION_MODEL   기본 gemini-3.1-flash-lite (모델 단종 시 여기만 교체)
//   GROQ_VISION_MODEL     기본 qwen/qwen3.6-27b
// ────────────────────────────────────────────────────────────────
const VISION_DAILY_LIMIT = 40;

async function handleMealVision(
  body: Record<string, unknown>,
  authHeader: string | null,
): Promise<Response> {
  const jsonRes = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!imageDataUrl.startsWith("data:image/")) {
    return jsonRes({ error: "invalid_image" }, 400);
  }
  // 클라이언트가 768px 로 줄여 보내므로 보통 150KB 미만이다.
  // 그보다 훨씬 크면 모델이 거부하거나 요금만 나가므로 여기서 막는다.
  if (imageDataUrl.length > 6_000_000) {
    return jsonRes({ error: "image_too_large" }, 413);
  }

  // 로그인한 회원만. AI 요금이 나가는 경로라 익명 호출은 막는다.
  if (!authHeader) return jsonRes({ error: "not_authenticated" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonRes({ error: "not_authenticated" }, 401);

  // 기록·집계용 클라이언트. 서비스 키가 없으면 사용자 클라이언트로 대체하고,
  // 그래도 안 되면 상한 검사를 건너뛴다 (기능이 죽지 않게).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const logClient = serviceKey
    ? createClient(supabaseUrl, serviceKey)
    : userClient;

  // 하루 상한 — 정상 사용은 하루 네 끼 남짓이라 40회면 넉넉하다.
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await logClient
      .from("diet_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "meal_vision_call")
      .gte("created_at", since);
    if ((count ?? 0) >= VISION_DAILY_LIMIT) {
      return jsonRes({ error: "daily_limit" }, 429);
    }
  } catch (_e) {
    // 집계 실패는 무시 — 상한은 요금 방어용이지 기능 차단용이 아니다.
  }

  const startedAt = Date.now();
  const { result, tried, lastError } = await analyzeMealImage({
    imageDataUrl,
    mealSlot: typeof body.mealSlot === "string" ? body.mealSlot : undefined,
    localTime: typeof body.localTime === "string" ? body.localTime : undefined,
  });

  // 정확도를 나중에 되짚어보려면 호출 기록이 남아 있어야 한다.
  // (사진 자체는 저장하지 않는다 — 결과 요약만)
  try {
    await logClient.from("diet_analytics_events").insert({
      user_id: user.id,
      event_type: "meal_vision_call",
      event_data: {
        ok: !!result,
        provider: result?.provider ?? null,
        confidence: result?.confidence ?? null,
        item_count: result?.items.length ?? 0,
        total_kcal: result?.totalKcal ?? null,
        meal_slot: typeof body.mealSlot === "string" ? body.mealSlot : null,
        ms: Date.now() - startedAt,
        tried,
      },
    });
  } catch (_e) {
    // 기록 실패로 회원 화면이 막히면 안 된다.
  }

  if (!result) {
    console.error("meal-vision failed", { tried, lastError });
    return jsonRes({ error: "vision_unavailable", tried }, 502);
  }
  return jsonRes(result);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();

    // 식단 사진 칼로리 추정 — 같은 함수 안의 다른 입구.
    if (body?.action === "meal-vision") {
      return await handleMealVision(body, req.headers.get("authorization"));
    }

    const { messages } = body;

    // 활성화된 provider 만 걸러낸다. 최소 1개는 있어야 함.
    const activeProviders = PROVIDERS.filter((p) => cleanKey(Deno.env.get(p.keyEnv), p.keyEnv) !== "");
    if (activeProviders.length === 0) {
      throw new Error(
        "No AI provider API key configured (GROQ_API_KEY / CEREBRAS_API_KEY / SAMBANOVA_API_KEY / DEEPSEEK_API_KEY)",
      );
    }
    // Try to get user context from auth token
    let personalContext = "";
    let dietContext = "";
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const [
            profileRes,
            progressRes,
            rejectionsRes,
            enrollmentRes,
            recentLogsRes,
          ] = await Promise.all([
            supabase.from("profiles").select("*").eq("user_id", user.id).single(),
            supabase.from("member_progress").select("*").eq("user_id", user.id).single(),
            supabase
              .from("mission_submissions")
              .select("*, missions(title)")
              .eq("user_id", user.id)
              .in("status", ["rejected", "revision_requested"])
              .order("requested_at", { ascending: false })
              .limit(5),
            supabase
              .from("diet_program_enrollments")
              .select("*")
              .eq("user_id", user.id)
              .in("status", ["active", "not_started", "completed"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("diet_daily_logs")
              .select("day_number, log_date, protein_first, veggies_natural, sugary_drink_avoided, late_night_snack_avoided, gym_attended, water_ml, sleep_hours, mood, memo")
              .eq("user_id", user.id)
              .order("log_date", { ascending: false })
              .limit(3),
          ]);
          let nextLevel = null;
          if (progressRes.data) {
            const { data: lvl } = await supabase
              .from("levels")
              .select("*")
              .eq("rank_name", progressRes.data.current_rank)
              .eq("level_number", progressRes.data.current_level)
              .single();
            nextLevel = lvl;
          }
          personalContext = buildPersonalContext(
            profileRes.data,
            progressRes.data,
            rejectionsRes.data || [],
            nextLevel,
          );

          // 진행 중이거나 최근 완주한 다이어트 enrollment 가 있으면 snapshot + 코치 메모까지 로드해 컨텍스트에 합친다.
          const enrollment = enrollmentRes.data;
          if (enrollment) {
            const [snapshotRes, coachNoteRes] = await Promise.all([
              supabase
                .from("diet_progress_snapshots")
                .select("*")
                .eq("enrollment_id", enrollment.id)
                .maybeSingle(),
              supabase
                .from("diet_coach_notes")
                .select("note_text, created_at, visibility")
                .eq("enrollment_id", enrollment.id)
                .eq("visibility", "member_visible")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            ]);
            dietContext = buildDietContext(
              enrollment,
              snapshotRes.data,
              recentLogsRes.data || [],
              coachNoteRes.data,
            );
          } else if ((recentLogsRes.data || []).length > 0) {
            // enrollment 는 없지만 오래된 로그만 있는 드문 케이스
            dietContext = buildDietContext(null, null, recentLogsRes.data || [], null);
          }
        }
      } catch (e) {
        console.error("Context fetch error (non-fatal):", e);
      }
    }
    // ── messages 조립 ────────────────────────────────────────────
    // 1) 랭킹업(복싱) 시스템 + 회원 개인 컨텍스트 (기존)
    // 2) 153다이어트 시스템 프롬프트 (신규)
    // 3) 153다이어트 공식 지식 문서 (신규)
    // 4) 다이어트 회원 컨텍스트 — 있을 때만 (신규)
    // 5) 클라이언트가 보낸 messages
    // 사용자 마지막 메시지에서 도메인 감지.
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    const lastUserText = (lastUserMessage?.content as string | undefined) ?? "";

    // 도메인 분기 — 인사/잡담은 어떤 컨텍스트도 주입 안 함 (모델이 회원 데이터로
    // 갑자기 다이어트 강의 시작하는 환각 차단).
    const greetingRe = /^(안녕|안녕하세요|하이|반가워|좋은\s*아침|hi|hello)[!?\s.~]*$/i;
    const isGreeting = greetingRe.test(lastUserText.trim());
    const dietRe =
      /(다이어트|식단|영양|칼로리|단백질|탄수|체중|감량|살빼|식사|체지방|복부|뱃살|식이|쉐이크|보강|21일|day\s*\d+|기록|습관|진행|수면|물|채소)/;
    const personalRe =
      /(내|나의|제|저의|레벨|랭킹|단증|미션|퀘스트|진행|반려|보스|타이틀)/;
    const isDietTopic = dietRe.test(lastUserText);
    const boxingRe =
      /(복싱|복서|잽|jab|스트레이트|크로스|훅|hook|어퍼|어퍼컷|uppercut|카운터|스파링|풋워크|콤비|컴비|디펜스|가드|슬립|위빙|더킹|패리|블록|샌드백|미트|쉐도우|줄넘기|글러브|핸드랩|스텝|스탠스|오소독스|사우스포|펀치|클린치|타격)/;
    const isBoxingTopic = boxingRe.test(lastUserText);
    const wantsPersonalData = personalRe.test(lastUserText) || isDietTopic;

    // 회원 컨텍스트 주입 — 사용자가 명시적으로 개인/다이어트 화제를 꺼낸 경우에만.
    const baseSystemMessage = wantsPersonalData && personalContext
      ? SYSTEM_PROMPT + personalContext
      : SYSTEM_PROMPT +
        "\n\n[중요] 이번 사용자 메시지는 일반 질문/인사로 분류됨. 회원의 진행도·식습관·기록·Day수를 언급하거나 만들어내지 말 것. 인사면 짧게 인사로만 응답.";
    const systemMessages: Array<{ role: "system"; content: string }> = [
      { role: "system", content: baseSystemMessage },
    ];
    // 다이어트 화제일 때만 다이어트 시스템 + 지식 + 회원 다이어트 컨텍스트 주입.
    if (isDietTopic) {
      const dietKnowledgeMessage = `아래는 153다이어트 공식 지식 문서다. 반드시 이 문서의 범위 안에서만 153다이어트 세부 규칙을 답변하라.\n\n${KNOWLEDGE_153}`;
      systemMessages.push({ role: "system", content: SYSTEM_PROMPT_153 });
      systemMessages.push({ role: "system", content: dietKnowledgeMessage });
      if (dietContext) {
        systemMessages.push({ role: "system", content: dietContext });
      }
    }
    // 복싱 기술 화제일 때만 복싱 지식 문서 주입 (토큰 절약 게이트).
    if (isBoxingTopic) {
      const boxingKnowledgeMessage = `아래는 153복싱짐 공식 복싱 기술 지식 문서다. 복싱 기술·훈련 질문은 이 문서를 우선 참고해 정확하고 실전적으로, 초보가 오늘 바로 해볼 수 있게 답하라.\n\n${KNOWLEDGE_BOXING_153}`;
      systemMessages.push({ role: "system", content: boxingKnowledgeMessage });
    }
    void isGreeting; // 향후 인사 전용 분기 확장 시 사용

    // ── 대화 히스토리 제한 ──────────────────────────────────────────
    // 두 단계 안전장치:
    //   1) 하드 캡: 최근 10개 메시지만 (오래된 발언은 무관하고 토큰만 차지)
    //   2) 토큰 예산: 그래도 길면 4000 토큰까지 — groq TPM 6000 한도 마진 확보
    // 한국어 1자 ≈ 0.5 토큰 어림(보수적).
    const HISTORY_CAP = 2; // 사용자 요청: conversationHistory.slice(-2)
    const MAX_HISTORY_TOKENS = 1000;
    const approxTokens = (s: string) => Math.ceil(s.length * 0.5);

    // 1단계 — 하드 캡: 최근 3개만 (사용자 요청)
    //   trimmedMessages = [system, ...history.slice(-3)]
    const conversationHistory = messages as Array<{ role: string; content: string }>;
    const recentMessages = conversationHistory.slice(-HISTORY_CAP);

    // 2단계 — 토큰 예산: 최근부터 거꾸로 예산이 허용하는 만큼만 포함
    const trimmedHistory: Array<{ role: string; content: string }> = [];
    let budget = MAX_HISTORY_TOKENS;
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const m = recentMessages[i];
      const t = approxTokens(m.content || "");
      if (t > budget && trimmedHistory.length > 0) break;
      trimmedHistory.unshift(m);
      budget -= t;
    }
    if (trimmedHistory.length < messages.length) {
      console.log(
        `[chat-assistant] history trimmed: ${messages.length} → ${trimmedHistory.length} messages (cap ${HISTORY_CAP}, budget ${MAX_HISTORY_TOKENS} tokens)`,
      );
    }

    const fullMessages = [...systemMessages, ...trimmedHistory];

    // 마지막 user 메시지만 남긴 "초경량" 페이로드 — 413 발생 시 동일 provider 재시도용.
    const minimalMessages = lastUserMessage
      ? [...systemMessages, { role: "user", content: lastUserText }]
      : fullMessages;

    // activeProviders 를 순서대로 시도. 첫 성공(2xx) 응답을 사용.
    // 413(Payload Too Large) 시: 같은 provider 에서 minimalMessages 로 1회 재시도 → 그래도 실패면 다음 provider 폴백.
    let response: Response | null = null;
    let usedProvider = "";
    for (let i = 0; i < activeProviders.length; i++) {
      const p = activeProviders[i];
      const key = cleanKey(Deno.env.get(p.keyEnv), p.keyEnv);
      const model = (p.modelEnv ? Deno.env.get(p.modelEnv) : undefined)?.trim() || p.model;
      const call = (msgs: unknown, withExtra: boolean) =>
        fetch(p.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: msgs,
            stream: true,
            max_tokens: 500,
            ...(withExtra ? (p.extraBody ?? {}) : {}),
          }),
        });
      usedProvider = p.name;
      response = await call(fullMessages, true);
      if (response.ok) break;

      // extraBody(추론 끄기 등)를 provider 가 모르면 400 이 온다 → 그것만 빼고 1회 재시도.
      if (response.status === 400 && p.extraBody) {
        console.warn(`[chat-assistant] ${p.name} 400 — retry without extra params`);
        response = await call(fullMessages, false);
        if (response.ok) break;
      }

      // 413 시 동일 provider 에서 초경량 페이로드로 즉시 재시도 — 컨텍스트 누적이 원인일 때 효과.
      if (response.status === 413 && minimalMessages !== fullMessages) {
        console.warn(`[chat-assistant] ${p.name} 413 — retry with minimal payload (last user only)`);
        response = await call(minimalMessages, true);
        if (response.ok) break;
      }
      // 폴백 조건 확대 — 다른 provider 로 시도해도 같은 결과가 나올 가능성이 낮은 코드 모두.
      //   · 401 Unauthorized   : 이 provider 의 API 키가 만료/무효 → 다른 키 시도 의미 있음
      //   · 402 Payment        : 크레딧 부족 → 다른 무료 provider 로
      //   · 403 Forbidden      : 권한 / 모델 접근 거부 → 다른 provider
      //   · 404 Not Found      : 모델명이 바뀐 경우 → 다른 provider
      //   · 408/429            : 타임아웃 / rate limit → 다른 provider
      //   · 400 Bad Request    : provider 가 "model decommissioned" 등으로 거부 →
      //                            다른 provider 는 다른 모델 이름이라 통과 가능 → 폴백
      //   · 413 Payload Too Large: provider 별 컨텍스트 한도가 다름(groq 6K TPM,
      //                            cerebras·sambanova·deepseek 더 큼) → 다음으로 폴백
      //   · 500~504            : 업스트림 일시 장애 → 다른 provider
      // 폴백 안 함: 422 (스키마 자체 문제 — 어디 가도 동일 에러).
      const fallbackable = [400, 401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 504];
      const shouldFallback = fallbackable.includes(response.status);
      const hasMore = i + 1 < activeProviders.length;
      if (!shouldFallback || !hasMore) break;
      console.warn(
        `[chat-assistant] ${p.name} returned ${response.status}, falling back to ${activeProviders[i + 1].name}`,
      );
    }

    // 모든 응답에 X-AI-Provider 헤더 일관 부착 (성공/실패 무관).
    // 클라이언트가 어느 provider 가 마지막으로 시도됐는지 항상 알 수 있게 한다.
    const baseHeaders = (extra: Record<string, string> = {}) => ({
      ...corsHeaders,
      "X-AI-Provider": usedProvider || "none",
      ...extra,
    });

    // Defensive: 위 for 루프는 항상 response 를 할당함. TS 보강용 가드.
    if (!response) {
      return new Response(
        JSON.stringify({ error: "AI 서비스 오류: no response" }),
        { status: 500, headers: baseHeaders({ "Content-Type": "application/json" }) },
      );
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", provider: usedProvider }),
          { status: 429, headers: baseHeaders({ "Content-Type": "application/json" }) },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 크레딧이 부족합니다.", provider: usedProvider }),
          { status: 402, headers: baseHeaders({ "Content-Type": "application/json" }) },
        );
      }
      const t = await response.text();
      // 키는 절대 찍지 않고, 상태코드 + 본문 앞 일부 + provider 이름만 로그에 남긴다.
      console.error(
        `[chat-assistant] ${usedProvider} error:`,
        response.status,
        t.slice(0, 800),
      );
      return new Response(
        JSON.stringify({
          error: "AI 서비스 오류",
          provider: usedProvider,
          status: response.status,
          detail: t.slice(0, 400),
        }),
        { status: 500, headers: baseHeaders({ "Content-Type": "application/json" }) },
      );
    }

    // 성공. 스트림 응답 — 어느 provider 가 응답했는지 X-AI-Provider 로 노출.
    return new Response(response.body, {
      headers: baseHeaders({ "Content-Type": "text/event-stream" }),
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류" }), {
      status: 500,
      headers: { ...corsHeaders, "X-AI-Provider": "none", "Content-Type": "application/json" },
    });
  }
});
