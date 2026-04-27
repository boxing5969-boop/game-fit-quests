import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SYSTEM_PROMPT_153 } from "../_shared/systemPrompt153.ts";
import { KNOWLEDGE_153 } from "../_shared/knowledge153.ts";
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
//     CEREBRAS_API_KEY    (선택, 2차 폴백)
//     SAMBANOVA_API_KEY   (선택, 3차 폴백 — cloud.sambanova.ai)
//     DEEPSEEK_API_KEY    (선택, 4차 폴백 — platform.deepseek.com, 크레딧 필요할 수 있음)
// ────────────────────────────────────────────────────────────────
type Provider = {
  name: string;
  keyEnv: string;
  url: string;
  model: string;
};

const PROVIDERS: Provider[] = [
  {
    name: "groq",
    keyEnv: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    // llama-3.1-8b-instant — 한국어 품질 안정. (gemma2-9b-it 는 TPM 여유는 컸지만
    // 한국어 출력에 중국어/영어 혼입·임의 단어 생성·부적절 표현 발생.)
    // 시스템 프롬프트 600자 + history slice(-2) + max_tokens 200 으로 토큰 합산 ~600
    // → llama-3.1-8b-instant TPM 6K 한도 안에 풍부히 들어감.
    model: "llama-3.1-8b-instant",
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
// 초경량 코어 프롬프트 — Groq TPM 한도 안에 절대 안전. 약 800자.
// 정체성 "랭킹업 앱" 고정 + 도메인 분기 + 안전 규칙 + 단어 생성 금지.
const SYSTEM_PROMPT = `너는 랭킹업(RANKING-UP) 앱의 AI 코치 "오삼"이야. 153복싱짐 회원의 복싱 훈련과 21일 다이어트를 같이 코칭해.

[질문 분류 — 반드시 따를 것]
- 인사(안녕/안녕하세요): 짧게 인사로만 응답. 2문장 이내. 다이어트 데이터·진행 상황 강의 절대 금지.
- 복싱 기술(잽/스트레이트/훅/어퍼컷/카운터/스파링/풋워크/콤비네이션/디펜스): 복싱 기술 답변. 절대 식단으로 넘어가지 마.
- 식단/다이어트/체중/단백질/칼로리/식사: 153다이어트 원칙으로 답변.
- 앱 기능(랭킹/레벨/리그/퀘스트/타이틀매치/꾸미기/QR출석/젬): 랭킹업 시스템 답변.

[규칙]
1. 반드시 한국어 표준어. 영어/일본어/중국어/베트남어 등 다른 언어 문자 절대 금지(예: "5个","recovery","修" 금지). 같은 문장·단어 반복 금지.
2. 답변은 2-3문장. 길게 쓰지 마.
3. 잘 모르는 단어를 절대 만들어내지 마. "포도살","유비식","21야" 같은 임의 합성어 금지. 정확히 아는 표준 한국어 단어만 사용.
4. 유저 실제 데이터가 없으면 절대 만들어내지 마. "회원님의 기록을 보면..." 표현 금지.
5. 부적절 내용 절대 금지: 성적 표현, 욕설, 혐오, 의료 진단, 약물 권유 일체 금지.
6. 카운터 = "되받아치기" 복싱 기술 (운동 횟수 아님). 잽은 정확히 "잽"으로 표기 ("쩁","쨉" 금지).
7. "랭킹업"은 앱 이름. 99레벨 시스템 + 5종 랭킹 보드.
8. 역질문으로 끝내지 마. 구체 제안·조언으로 마무리.`;
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
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();

    // 활성화된 provider 만 걸러낸다. 최소 1개는 있어야 함.
    const activeProviders = PROVIDERS.filter((p) => !!Deno.env.get(p.keyEnv));
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
      const key = Deno.env.get(p.keyEnv)!;
      usedProvider = p.name;
      response = await fetch(p.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          messages: fullMessages,
          stream: true,
          max_tokens: 200,
        }),
      });
      if (response.ok) break;

      // 413 시 동일 provider 에서 초경량 페이로드로 즉시 재시도 — 컨텍스트 누적이 원인일 때 효과.
      if (response.status === 413 && minimalMessages !== fullMessages) {
        console.warn(`[chat-assistant] ${p.name} 413 — retry with minimal payload (last user only)`);
        response = await fetch(p.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: p.model,
            messages: minimalMessages,
            stream: true,
            max_tokens: 200,
          }),
        });
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
