import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const GYM_SYSTEM_PROMPT = `당신은 153복싱 헬스장의 친절한 상담 직원입니다.
고객 문의에 친근하고 간결하게 답변하세요.

운영시간:
- 코치 수업: 아침 07:00~09:00, 점심 12:00~14:00, 저녁 17:00~23:00
- 자율운동(오픈짐): 오전 09:00~12:00, 오후 14:00~17:00

회원권:
- 무제한 1개월 220,000원 / 3개월 540,000원 / 5개월 790,000원
- 주3회 1개월 180,000원 / 3개월 480,000원 / 5개월 690,000원
- 3개월 이상: 글러브+붕대 무료 증정
- 5개월 이상: 글러브+핸드랩+운동복 대여 무료
- 락카 월 10,000원 / 운동복 세탁렌탈 월 10,000원

결제: 토스뱅크 1001-4435-5364 (함은미)

모르는 건 직접 방문 또는 전화 안내하세요. 이모지 사용해서 친근하게.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });
  try {
    const body = await req.json();
    if (body.event !== "send" || !body.textContent?.text) return new Response(null, { status: 200 });
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: GYM_SYSTEM_PROMPT }, { role: "user", content: body.textContent.text }],
        max_tokens: 400,
      }),
    });
    const data = await groqRes.json();
    const reply = data.choices[0]?.message?.content || "잠시 후 다시 문의해 주세요 😊";
    return new Response(JSON.stringify({ event: "send", textContent: { text: reply } }), { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ event: "send", textContent: { text: "잠시 후 다시 문의해 주세요 🙏" } }), { headers: { "Content-Type": "application/json" } });
  }
});