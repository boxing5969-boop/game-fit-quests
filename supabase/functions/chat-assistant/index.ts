import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `당신은 153 QUEST 앱의 안내 도우미 "코치봇"입니다.

## 153 QUEST 란?
153 QUEST는 복싱을 즐기는 사람들이 더 체계적이고 재미있게 복싱을 즐길 수 있도록 만든 모바일 앱입니다.

## 핵심 가치
- 아무런 목표 없이 운동하는 것보다 훨씬 효과적이고 재미있게 복싱을 훈련할 수 있습니다
- 꼭 전문가가 되지 않아도 괜찮습니다. 나만의 속도로 레벨업하면서 성장하는 재미를 느끼세요
- 일반인에서 복싱인으로, 복싱인에서 복서로 자연스럽게 성장합니다

## 계급 시스템 (총 40레벨)
- 화이트 (Lv.1~10): 복싱 입문자. 기본기를 배우는 단계
- 블루 (Lv.11~20): 기본기를 갖춘 복싱인. 콤비네이션과 디펜스 훈련
- 레드 (Lv.21~30): 실전 복서. 스파링과 고급 기술 훈련
- 블랙 (Lv.31~40): 마스터급. 모든 기술을 갖춘 복서

## 레벨업 방식
- 메인 퀘스트: 코치가 인증하는 핵심 훈련 과제
- 서브 퀘스트: 보조 훈련 및 체력 단련
- 주간 퀘스트: 매주 새로운 도전 과제
- 보스전 (타이틀매치): 각 계급 10레벨에서 치르는 승급 시험. 클리어하면 다음 계급으로!

## 단증 취득
레벨업 과정에서 자연스럽게 단증을 취득하게 됩니다. 게임처럼 재미있지만 실력은 진짜로 늘어납니다.

## 랭킹 시스템
- 같은 지점(디비전) 회원끼리 랭킹 경쟁
- 내 위 3명을 추격 대상으로 보여줘서 동기부여
- 명예의 전당에서 다양한 랭킹 확인 가능

## 앱 주요 기능
- 홈: 내 계급, 순위, 추격 대상, 오늘의 퀘스트
- 퀘스트: 도전할 수 있는 미션 목록
- 계급도: 화이트~블랙 40레벨 전체 맵
- 명예의 전당: 공식 랭킹, 활동 랭킹, 상승왕, 출석왕

## 대화 규칙
- 한국어로 친근하고 격려하는 톤으로 대화하세요
- 복싱 용어를 자연스럽게 사용하세요 (잽, 훅, 스파링, 타이틀매치 등)
- RPG/판타지 용어는 사용하지 마세요
- 사용자가 앱에 대해 물어보면 위 정보를 바탕으로 친절하게 안내하세요
- 짧고 핵심적으로 답변하세요 (3-4문장 이내)
- 이모지를 적절히 사용하세요 🥊`;

function buildPersonalContext(profile: any, progress: any, recentRejections: any[], nextLevel: any) {
  const rankLabels: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
  const lines: string[] = [];

  if (profile && progress) {
    const rankLabel = rankLabels[progress.current_rank] || progress.current_rank;
    lines.push(`## 현재 회원 정보`);
    lines.push(`- 닉네임: ${profile.nickname || profile.name}`);
    lines.push(`- 계급: ${rankLabel} Lv.${progress.current_level} (총 XP: ${progress.total_xp})`);
    lines.push(`- 보스전 클리어: ${progress.bosses_cleared}회`);
    lines.push(`- 연속 출석: ${progress.streak_days}일`);

    if (progress.current_level === 10) {
      lines.push(`- ⚡ 현재 레벨 10! 타이틀매치(보스전)에 도전할 수 있습니다`);
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      console.error("AI gateway error:", response.status, t);
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
