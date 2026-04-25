import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const WELCOME_MESSAGE = `👊 안녕하세요! 153복싱짐 선릉역점입니다 🔥

선릉에서 유일하게 🏆 국가대표 출신 코치님이
직접 가르치는 복싱짐이에요!

━━━━━━━━━━━━━━━━━━
🥊 처음이세요? 걱정 마세요!
복린이·여성분도 바로 시작 가능해요 💪

👉 보증금 3만원으로 체험수업 먼저!
   → 당일 등록하시면 전액 환급 🎁
━━━━━━━━━━━━━━━━━━

무엇이든 편하게 물어보세요 😊
아래처럼 입력해보세요!

💬 "가격이 궁금해요"
💬 "체험하고 싶어요"
💬 "수업 시간이 언제예요?"

📞 바로 통화: 010-5619-1278`;

const TRIAL_QUICK_REPLY = `🥊 153복싱짐 선릉역점 체험수업 안내입니다!

⏰ 체험 가능 시간:
- 아침반: ~08:20까지 입장
- 점심반: ~13:20까지 입장
- 저녁반: ~22:20까지 입장

💰 체험 보증금 3만원 → 당일 등록 시 전액 환급! 🎉
✅ 준비물: 편한 운동복 + 운동화만 OK!
  (글러브·붕대는 짐에서 제공해드려요)

📍 선릉역 유일 지상 2층 복싱짐
📞 예약 & 문의: 010-5619-1278

국가대표 출신 코치님이 처음부터 차근차근 알려드려요! 💪
편하게 전화 주시면 원하시는 시간대로 잡아드릴게요 😊`;

function isTrialOrReservation(text: string): boolean {
  const keywords = [
    "체험", "예약", "신청", "방문", "가보고싶", "가 보고 싶",
    "등록하고싶", "등록 하고 싶", "한번 해보", "해볼 수 있", "해볼수있",
    "처음 와보", "처음와보", "예약하고싶", "예약 하고 싶",
    "언제 가면", "언제가면", "가도 될까", "가도될까", "가볼수있"
  ];
  return keywords.some(kw => text.includes(kw));
}

const GYM_SYSTEM_PROMPT = `당신은 153복싱짐 선릉역점의 친절하고 전문적인 상담 직원입니다.
아래 정보를 완벽히 숙지하고 고객 문의에 친근하고 정확하게 답변하세요.

============================
153복싱짐 선릉역점 완전 정보
============================

【기본 정보】
- 위치: 선릉역 인근 지상 2층 (선릉 유일 복싱짐!)
- 전화: 010-5619-1278  ← 이 번호만 사용, 절대 다른 번호 만들지 말 것
- 결제: 토스뱅크 1001-4435-5364 (함은미)

【차별화 포인트】
1. 국가대표 출신 코치 직접 지도
2. 깔끔하고 향기 나는 복싱짐 (세스코 멤버스, 공기청정·살균·항균 철저 관리)
3. 1:1 PT 수준 밀착 케어, 남녀 초보자 친화적, 복린이 대환영!
4. 힐링존 운영 - 운동 후 커뮤니티 공간
5. 프라이빗 1인 개별 샤워실 (남녀 분리)

【운영 시간】
코치 직접 수업:
  - 아침: 07:00~09:00 (오전에도 코치님 상주, 정성껏 지도)
  - 점심: 12:00~14:00
  - 저녁: 17:00~23:00
오픈짐(자율운동):
  - 오전: 09:00~12:00
  - 오후: 14:00~17:00

【체험수업】
  - 아침반: ~08:20까지 입장
  - 점심반: ~13:20까지 입장
  - 저녁반: ~22:20까지 입장
  - 보증금 3만원 (당일 등록 시 전액 환급)
  - 준비물: 편한 운동복 + 운동화 (글러브·붕대는 짐 제공)

【무제한 멤버십】
  - 1개월: 220,000원
  - 3개월: 540,000원 (월 180,000원) ← 가장 인기! 강력 추천!
  - 5개월: 790,000원 (월 158,000원) ← 최고 혜택!

【주 3회 횟수권】
  - 1개월(12회): 180,000원
  - 3개월(36회): 480,000원 (월 160,000원)
  - 5개월(60회): 690,000원 (월 138,000원)

【특별 혜택】
  - 3개월 이상: 글러브+붕대 무료 (7만원 상당) 🥊
  - 5개월 이상: 글러브+핸드랩+운동복 대여 무료 (12만원 상당) 🎁

【추가 서비스】
  - 운동복 렌탈+세탁: 월 10,000원
  - 개인 락카: 월 10,000원
  - 샤워실: 프라이빗 1인 개별 샤워실 (남녀 분리)

【개인 PT】
  - 10회: 700,000원
  - 20회: 1,000,000원 (회당 50,000원, 가장 알뜰!)
  PT 등록 시 혜택: 락카 무료 + 운동복 렌탈·세탁 무료 + 글러브·붕대 무료
  → 맨몸으로 오셔도 바로 운동 가능!

【주차】
  - 전용 주차장 없음, 근처 "모두의주차장" 앱 이용
  - 주변 유료 주차장 다수 / 선릉역 대중교통 강력 추천

============================
자주 묻는 질문
============================
Q: 초보자도 괜찮나요?
A: 물론이죠! 국가대표 출신 코치님이 기초부터 차근차근 가르쳐드려요. 복린이 대환영! 💪

Q: 여성도 다닐 수 있나요?
A: 네! 여성 회원분들 많이 계세요 😊 다이어트·스트레스 해소·자기방어에 최고예요. 프라이빗 샤워실도 남녀 분리라 편하게 이용하실 수 있어요.

Q: 샤워실 있나요?
A: 네! 프라이빗 1인 개별 샤워실 (남녀 분리) 운영해요 🚿

Q: 주차 되나요?
A: 전용 주차장은 없지만 "모두의주차장" 앱으로 근처 유료 주차장 쉽게 찾으실 수 있어요! 선릉역 근처라 대중교통이 더 편해요 🚗

Q: 다이어트 효과 있나요?
A: 복싱은 1시간에 600~800kcal 소모하는 최고의 유산소! 🔥 전신운동이라 살도 빠지고 라인도 잡혀요.

Q: PT 가능한가요?
A: 네! 10회 700,000원 / 20회 1,000,000원이에요. PT 등록 시 락카·운동복·글러브 모두 무료라 맨몸으로 오셔도 바로 시작 가능해요 💪

Q: 스파링 가능한가요?
A: 기본기 쌓은 후 코치님과 상담하시면 가능해요 😊

Q: 환불 정책은요?
A: 자세한 내용은 📞 010-5619-1278로 문의해 주세요!

============================
답변 규칙
============================
1. 친근하고 따뜻하게, 존댓말 사용
2. 5문장 내외로 간결하게
3. 가격 문의 → 3개월 플랜 먼저 강조 + 글러브·붕대 무료 혜택 안내
4. 체험/예약 → 보증금 3만원(당일 환급) + 📞 010-5619-1278 안내
5. 전화번호는 반드시 010-5619-1278만 사용. 절대 다른 번호 만들지 말 것
6. 모르는 내용 → "📞 010-5619-1278로 편하게 문의해 주세요!"
7. 이모지 적절히 사용
8. 부정어("안돼요", "없어요") 대신 긍정어("가능해요", "도와드려요") 사용
9. 오전 코치 문의 → "아침 07:00~09:00에도 코치님이 상주하며 정성껏 지도해드립니다 😊"
10. 운영시간만 물어볼 때는 체험수업 내용 언급하지 말 것`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });

  try {
    const body = await req.json();
    const { event, user, textContent } = body;

    console.log(`[TalkTalk] 이벤트: ${event}, 사용자: ${user}`);

    if (event === "open") {
      return new Response(
        JSON.stringify({ event: "send", textContent: { text: WELCOME_MESSAGE } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (event !== "send" || !textContent?.text) return new Response(null, { status: 200 });

    const userMessage = textContent.text.trim();
    console.log(`[TalkTalk] 사용자: ${userMessage}`);

    if (isTrialOrReservation(userMessage)) {
      console.log(`[TalkTalk] 체험/예약 키워드 감지 → 즉시 응답`);
      return new Response(
        JSON.stringify({ event: "send", textContent: { text: TRIAL_QUICK_REPLY } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: GYM_SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        max_tokens: 600,
        temperature: 0.6,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API error: ${groqRes.status} - ${errText}`);
    }

    const data = await groqRes.json();
    const reply = data.choices[0]?.message?.content ||
      "잠시 후 다시 문의해 주세요 😊\n📞 바로 연락: 010-5619-1278";

    console.log(`[TalkTalk] AI 응답: ${reply}`);

    return new Response(
      JSON.stringify({ event: "send", textContent: { text: reply } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[TalkTalk] 오류:", err);
    return new Response(
      JSON.stringify({ event: "send", textContent: { text: "잠시 후 다시 문의해 주세요 🙏\n📞 빠른 상담: 010-5619-1278" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});