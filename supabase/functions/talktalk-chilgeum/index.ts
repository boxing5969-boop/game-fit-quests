const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyContains(text, target, maxDist = 1) {
  if (text.includes(target)) return true;
  const tLen = target.length;
  for (let i = 0; i <= text.length - tLen; i++) {
    if (levenshtein(text.slice(i, i + tLen), target) <= maxDist) return true;
  }
  return false;
}

// ─── 메시지 상수 ───────────────────────────────────────────────────────────────

const GREETING_REPLY = `안녕하세요, 고객님! 😊
153복싱짐 칠금점입니다 🥊

무엇이든 편하게 말씀해 주세요!
가격, 시간표, 등록, 상담 모두 바로 안내해드릴게요 💪`;

const WELCOME_MESSAGE = `안녕하세요, 고객님! 😊
153복싱짐 칠금점입니다 🥊

────────────────
🏆 153복싱짐 칠금점을 선택해야 하는 이유

1️⃣ 충주 유일! 국가대표 관장님 개발 프로그램
   → 아무 복싱짐과는 달라요!
   검증된 커리큘럼으로 처음부터 제대로 배워요 🥊

2️⃣ 복싱 + 충북 최대 250평 헬스장 한 번에!
   → 멤버십 하나로 복싱 레슨 + 70여 종 헬스 머신 전부 이용
   따로 등록하면 훨씬 비싸요 💪

3️⃣ 1시간에 1,000kcal 목표!
   → 전신 다이어트 최강 운동!
   3개월이면 주변에서 달라졌다는 말 들으세요 🔥

4️⃣ 오전 10시부터 밤 22:30까지 운영
   → 복싱 자율운동은 365일 24시간 가능!
   내 일정에 맞게 언제든 오실 수 있어요

5️⃣ 키즈반 운영 (15:00 ~ 17:00)
   → 아이들 체력·집중력·자신감을 함께 키워요 👧
   가족이 함께 다닐 수 있는 복싱짐!

────────────────
💬 아래 단어를 입력하시면 바로 안내해드려요!

💰 가격표  →  "가격" 입력
⏰ 시간표  →  "시간표" 입력
📝 등록/결제  →  "등록" 입력
🗣 코치님 상담  →  "상담" 입력
☀️ 오전반  →  "아침" 입력
🌙 저녁반  →  "저녁" 입력
👧 키즈반  →  "키즈" 입력
📍 오시는 길  →  "위치" 입력
🚗 주차 안내  →  "주차" 입력
────────────────
궁금하신 내용을 입력해 주시면 바로 도와드릴게요 💪`;

const PRICE_TABLE = `📋 153복싱짐 칠금점 가격표

🥊 멤버십 / 전부 포함
복싱 레슨 + 헬스장 + 글러브 + 붕대 포함

• 1개월: 189,000원 (월 189,000원)
  → 부담 없이 시작하는 분들께 적합해요

⭐ 3개월: 359,000원 (월 119,667원) ← 가장 인기!
  → 1개월 대비 매달 약 70,000원 절약
  → 복싱의 진짜 재미와 체력 변화를 느끼기에 딱 맞는 기간

• 5개월: 549,000원 (월 109,800원)
  → 처음부터 장기로 결심하신 분께 최고 혜택 🏆

🏋️ 포함 혜택 (모든 플랜 동일)
• 250평 153휘트니스 칠금점 이용
• 70여 종 최고급 머신 이용
• 복싱 레슨 + 헬스장 동시 이용
• 글러브 + 붕대 포함

─────────────────
💡 처음 시작하시는 분들 대부분이 3개월을 선택하세요.
1개월차엔 기초를, 2개월차엔 재미를, 3개월차엔 눈에 보이는 변화를 느끼시거든요 💪
3개월로 시작해보시겠어요, 아니면 5개월로 처음부터 최고 혜택 받으실 건가요? 😊`;

const SCHEDULE_TABLE = `⏰ 153복싱짐 칠금점 시간표

🥊 복싱 레슨
• 오전반: 10:00 ~ 12:00
• 저녁반: 18:00 ~ 22:30

👧 키즈 레슨
• 오후: 15:00 ~ 17:00

🏃 자율운동
• 복싱 자율운동: 365일 24시간 🌙
• 헬스장: 06:00 ~ 24:00

처음 방문하시는 분은 원하시는 시간대에 맞춰 상담 후 체력에 맞게 안내드립니다.
오전반, 저녁반, 키즈반 중 어느 시간대가 가장 편하실까요? 😊`;

const MORNING_REPLY = `☀️ 153복싱짐 칠금점 오전반 안내

🥊 오전반 수업 시간
• 10:00 ~ 12:00 (코치 직접 수업)

✅ 오전에 개운하게 운동하고 하루를 시작해보세요 💪
복싱 레슨 후 충북 최대 헬스장도 바로 이용 가능해요!

오전반으로 등록하시려면 아래 링크를 이용해 주세요 😊

⭐ 3개월 (359,000원) ← 가장 인기!
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309825?area=pll&theme=place

혹시 더 궁금하신 점이 있으신가요? 😊`;

const EVENING_REPLY = `🌙 153복싱짐 칠금점 저녁반 안내

🥊 저녁반 수업 시간
• 18:00 ~ 22:30 (코치 직접 수업)

✅ 퇴근 후 스트레스 해소에 딱! 저녁에 오시는 분들이 가장 많아요 💪
복싱 + 충북 최대 헬스장 동시 이용 가능해요!

저녁반으로 등록하시려면 아래 링크를 이용해 주세요 😊

⭐ 3개월 (359,000원) ← 가장 인기!
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309825?area=pll&theme=place

혹시 더 궁금하신 점이 있으신가요? 😊`;

const KIDS_REPLY = `👧 153복싱짐 칠금점 키즈반 안내

🥊 키즈 레슨 시간
• 15:00 ~ 17:00 (전문 코치 직접 지도)

✅ 아이들의 체력, 집중력, 자신감을 키워주는 복싱 레슨!
안전하고 재미있게 지도해드려요 💪

키즈반 체험 예약하시려면 아래 링크를 이용해 주세요 😊
https://m.booking.naver.com/booking/5/bizes/1271500/items/7634522?area=pll&theme=place

혹시 더 궁금하신 점이 있으신가요? 😊`;

const LOCATION_REPLY = `📍 153복싱짐 칠금점 위치 안내

🏢 충주시 계명대로 33-1 2층

네이버 지도에서 "153복싱짐 칠금점"으로 검색해 주세요 😊
카카오채널로도 문의 가능해요: http://pf.kakao.com/_txdGxcxj

혹시 더 궁금하신 점이 있으신가요? 😊`;

const PARKING_REPLY = `🚗 153복싱짐 칠금점 주차 안내

건물 주변 주차 가능해요 🅿️
자세한 주차 문의는 편하게 연락 주세요 😊

전화: 010-8343-1530
카카오채널: http://pf.kakao.com/_txdGxcxj

혹시 더 궁금하신 점이 있으신가요? 😊`;

const REGISTER_QUICK_REPLY = `고객님, 결심해 주셔서 정말 잘하셨어요! 🎉

네이버페이로 바로 결제하실 수 있어요 😊

⭐ 3개월 (359,000원 · 월 119,667원) ← 가장 인기!
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309825?area=pll&theme=place

🏆 5개월 (549,000원 · 월 109,800원) ← 최고 혜택!
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309835?area=pll&theme=place

• 1개월 (189,000원)
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309584?area=pll&theme=place

─────────────────
💡 복싱 레슨 + 충북 최대 헬스장 + 글러브 + 붕대 전부 포함!
처음 시작하시는 분들은 3개월을 가장 많이 선택하세요 🥊
3개월로 시작하시겠어요, 아니면 5개월로 최고 혜택 받으실 건가요? 😊`;

const ENROLL_REPLY = `고객님, 등록 문의 주셔서 감사합니다! 🎉

153복싱짐 칠금점 멤버십 안내드릴게요 😊

⭐ 3개월: 359,000원 (월 119,667원) ← 가장 인기!
→ 복싱의 재미와 체력 변화를 느끼기에 딱 맞는 기간

🏆 5개월: 549,000원 (월 109,800원) ← 최고 혜택!
→ 처음부터 장기로 결심하신 분께 최고 혜택

• 1개월: 189,000원 (월 단가가 가장 높아요)

─────────────────
💡 복싱 + 250평 헬스장 + 글러브 + 붕대 전부 포함!
1개월차엔 기초를, 2개월차엔 재미를, 3개월차엔 체력 변화가 눈에 보여요 💪
3개월로 시작하시겠어요, 아니면 5개월로 최고 혜택 받으실 건가요? 😊`;

const TRIAL_QUICK_REPLY = `고객님, 체험예약 안내드릴게요! 🥊

아래 링크로 바로 예약하실 수 있어요 😊
https://m.booking.naver.com/booking/5/bizes/1271500/items/7634522?area=pll&theme=place

⏰ 체험 가능 시간:
• 오전반: 10:00 ~ 12:00
• 저녁반: 18:00 ~ 22:30

✅ 준비물: 편한 운동복 + 운동화만 OK!
💰 보증금 2만원 → 당일 등록 시 전액 환급! 🎉

1시간에 1,000kcal 목표! 한 번만 와보시면 느낌 아실 거예요 💪
혹시 더 궁금하신 점이 있으신가요? 😊`;

const CONSULT_REPLY = `네, 고객님 😊
코치님과 직접 상담 도와드릴게요!

아래 운영 시간에 편하게 방문해 주세요 🥊

⏰ 운영 시간:
• 오전반: 10:00 ~ 12:00
• 저녁반: 18:00 ~ 22:30

언제든 편히 오세요! 방문하시면 코치님이 가격, 프로그램, 목표 체형 등 모든 것을 직접 안내해드려요 💪

카카오채널로도 편하게 문의 가능해요 😊
http://pf.kakao.com/_txdGxcxj`;

const RESERVATION_ASK_REPLY = `고객님, 예약 문의 주셔서 감사합니다 😊

네이버페이로 바로 등록 가능해요!

⭐ 3개월 (359,000원 · 월 119,667원) ← 가장 인기!
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309825?area=pll&theme=place

🏆 5개월 (549,000원 · 월 109,800원) ← 최고 혜택!
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309835?area=pll&theme=place

• 1개월 (189,000원)
https://m.booking.naver.com/booking/5/bizes/1271500/items/6309584?area=pll&theme=place

─────────────────
먼저 체험해보고 싶으시면 "체험"이라고 입력해 주세요!
혹시 더 궁금하신 점이 있으신가요? 😊`;

const FALLBACK_MENU = `고객님, 안녕하세요 😊
저는 153복싱짐 칠금점 AI 상담원이에요!

말씀하신 내용을 정확히 파악하지 못했어요 🙏
아래처럼 입력해 주시면 원하시는 정보를 바로 안내해드릴게요!

👉 가격이 궁금하시면 → "가격" 이라고 입력해 주세요
👉 시간표가 궁금하시면 → "시간표" 라고 입력해 주세요
👉 코치님과 상담을 원하시면 → "상담" 이라고 입력해 주세요
👉 등록/결제를 원하시면 → "등록" 이라고 입력해 주세요
👉 아침·저녁·키즈 수업이 궁금하시면 → "아침" / "저녁" / "키즈" 라고 입력해 주세요
👉 오시는 길이 궁금하시면 → "위치" 라고 입력해 주세요
👉 주차가 궁금하시면 → "주차" 라고 입력해 주세요

궁금하신 내용을 입력해 주시면 바로 도와드릴게요 💪`;

// ─── 키워드 감지 함수들 ────────────────────────────────────────────────────────

function isGreeting(text) {
  const t = text.trim();
  return [
    "안녕하세요", "안녕", "안녕요", "안뇽", "반갑습니다", "반가워요",
    "hi", "hello", "ㅎㅇ", "하이", "헬로", "안녕하세용", "안녕하세염",
    "ㅎㅇㅎㅇ", "안녕하십니까",
  ].some(kw => t === kw || (t.startsWith(kw) && t.length <= kw.length + 3));
}

function isReadyToRegister(text) {
  return [
    "바로 등록", "바로등록", "지금 등록", "지금등록",
    "등록하려고", "등록할게요", "등록하고싶어요", "등록하고 싶어요",
    "바로 시작", "바로시작", "오늘 등록", "오늘등록",
    "계좌", "입금", "결제", "신청할게요", "신청하려고",
  ].some(kw => text.includes(kw));
}

function isEnrollQuery(text) {
  if (["등록예약", "등록 예약"].some(kw => text.includes(kw))) return true;
  return fuzzyContains(text, "등록", 1);
}

function isConsultQuery(text) {
  if ([
    "상담예약", "상담 예약", "상담신청", "상담 신청",
    "상담하고싶", "상담 하고 싶", "산단",
    "오프라인 상담", "오프라인상담", "직접 상담", "직접상담",
    "방문 상담", "방문상담", "상담 가능", "상담가능",
    "상담 시간", "상담시간",
  ].some(kw => text.includes(kw))) return true;
  return fuzzyContains(text, "상담", 1);
}

function isReservationOnly(text) {
  const t = text.trim();
  return (
    t === "예약" || t === "예약하고싶어요" || t === "예약하고싶어" ||
    t === "예약하고 싶어요" || t === "예약 하고 싶어요" ||
    (text.includes("예약") &&
      !text.includes("등록") && !text.includes("상담") && !text.includes("체험"))
  );
}

function isTrialQuery(text) {
  return text.includes("체험");
}

function isVisitQuery(text) {
  if (text.includes("체험") || text.includes("상담")) return false;
  return [
    "방문", "가보고싶", "가 보고 싶", "가볼수있",
    "가도 될까", "가도될까", "둘러봐도", "둘러볼",
    "언제 가면", "언제가면", "몇시에 오면", "몇시에오면",
    "언제 오면", "언제오면", "직접 와", "직접와",
    "가면 되나요", "가면되나요", "가볼게요", "가려고",
    "와보고", "와도 될", "와도될",
  ].some(kw => text.includes(kw));
}

function isPriceQuery(text) {
  return [
    "가격", "요금", "비용", "얼마", "회원권", "멤버십", "가격표",
    "몇만원", "얼마에요", "얼마예요", "수강료", "등록비",
  ].some(kw => text.includes(kw));
}

function isScheduleQuery(text) {
  return [
    "시간표", "운영시간", "수업시간", "오픈시간", "몇시부터", "몇시까지", "영업시간",
  ].some(kw => text.includes(kw));
}

function isMorningQuery(text) {
  return ["아침", "오전", "아침반", "오전반", "10시", "11시"].some(kw => text.includes(kw));
}

function isEveningQuery(text) {
  return ["저녁", "저녁반", "밤", "야간", "18시", "19시", "20시", "21시", "22시"].some(kw => text.includes(kw));
}

function isKidsQuery(text) {
  return ["키즈", "어린이", "아이", "초등", "자녀", "kids", "키즈반"].some(kw => text.includes(kw));
}

function isLocationQuery(text) {
  return ["위치", "어디", "주소", "오시는길", "찾아가는", "어떻게가", "어떻게 가", "길찾기"].some(kw => text.includes(kw));
}

function isParkingQuery(text) {
  return ["주차", "주차장", "차 가", "차가"].some(kw => text.includes(kw));
}

// ─── AI 시스템 프롬프트 (심리 분석 + CS 전문가 버전) ──────────────────────────

const GYM_SYSTEM_PROMPT = `당신은 153복싱짐 칠금점의 최고 수준 CS 전문가이자 심리 분석 영업 전문가입니다.
고객의 메시지 한 줄에서 심리 상태·동기·망설임 포인트를 파악하고,
가장 자연스러운 방식으로 3개월 또는 5개월 등록으로 이어지도록 안내하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【핵심 영업 전략 — 반드시 따를 것】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 가격 앵커링 전략
   - 1개월(189,000원)을 먼저 언급할 때는 "월 단가가 가장 높아요"로 표현
   - 3개월(월 119,667원)을 "가장 합리적인 선택"으로 포지셔닝
   - 5개월은 "이미 결심하신 분께 최고 혜택"으로 표현
   - 항상 3개월 또는 5개월 중 선택을 유도하는 질문으로 마무리

2. 골디락스 전략
   - 1개월: "부담 없이 시작"이지만 월 단가 가장 높음
   - 3개월: "딱 맞는 기간, 가장 현명한 선택" ← 주력 권유
   - 5개월: "장기 결심하신 분께 최고 혜택"
   - 고객이 자연스럽게 3개월을 "합리적 중간 선택"으로 느끼게 유도

3. 사회적 증거
   - "처음 시작하시는 분들 대부분이 3개월을 선택하세요"
   - "3개월 후 자연스럽게 연장하시는 분이 많아요"
   - "복싱은 2~3개월차부터 진짜 재미가 시작돼요"

4. 차별화 포인트 강조
   - 충북 최대 헬스장 250평 무료 이용 → 타 복싱짐과 가장 큰 차이
   - "복싱짐 + 헬스장을 따로 다니면 훨씬 비싸요. 여기선 하나 가격에 두 가지!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【고객 유형별 맞춤 응대】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ 다이어트/체중감량 목적
  → "복싱은 1시간에 700~1,000kcal 소모, 4주 10kg 감량 후기도 쏟아지고 있어요"
  → "복싱 후 헬스장까지 이용하시면 시너지 효과가 정말 커요"

▶ 스트레스 해소 목적
  → "복싱은 샌드백을 치면서 감정이 그냥 정화돼요. 퇴근 후 10분만 치면 하루 스트레스가 날아가요"
  → "저녁반 직장인 분들이 특히 많이 오시고, 운동 후 표정이 달라진다고 하세요"

▶ 처음 운동하는 분 (복린이)
  → "처음이셔도 전혀 걱정 안 하셔도 돼요. 국가대표 관장님이 개발한 프로그램으로 처음부터 차근차근 알려드려요"
  → "운동 경험 전혀 없으신 분도 1개월이면 기본기를 잡으시고 2개월부터 재미를 느끼세요"

▶ 여성 고객
  → "여성 회원분들 정말 많이 오세요. 분위기 편하고 안전해요"
  → "복싱은 전신 운동이라 체형 관리에 특히 효과적이에요. 팔뚝, 등, 코어가 예뻐져요"

▶ 가격 망설이는 분
  → "3개월이 189,000원 × 3 = 567,000원인데 359,000원이라 208,000원 절약이에요"
  → "게다가 복싱+헬스장 동시 이용이라 헬스장 따로 다닌다고 생각하면 정말 이득이에요"

▶ 효과 의심하는 분
  → "4주 10kg 감량 후기가 실제로 쏟아지고 있어요. 1시간에 1,000kcal가 목표예요"
  → "보통 3~4주면 체력이 달라지는 걸 느끼세요"

▶ 다칠까봐 걱정하는 분
  → "처음엔 스파링 없이 기본기만 배워요. 안전하게 진행하고 부상 위험 매우 낮아요"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【자주 묻는 질문 사전 학습 — 이렇게 답하세요】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q. 복싱 처음인데 괜찮나요?
→ "처음이셔도 완전 괜찮아요! 국가대표 관장님이 개발한 프로그램으로 처음부터 기초부터 차근차근 알려드려요 😊"

Q. 여자도 할 수 있나요?
→ "물론이죠! 여성 회원분들 정말 많이 계세요. 복싱은 전신 운동이라 체형 관리에 특히 좋아요 💪"

Q. 살 빠지나요? / 다이어트에 좋나요?
→ "복싱은 1시간에 1,000kcal를 목표로 하는 최강 다이어트 운동이에요. 4주 10kg 감량 후기도 실제로 쏟아지고 있어요. 3개월이면 주변에서 달라졌다는 말 들으실 거예요 🔥"

Q. 얼마나 다니면 효과 보나요?
→ "보통 1개월차엔 기초를 익히고, 2개월차부터 재미가 붙고, 3개월차에 체력과 체형 변화가 눈에 보여요. 그래서 3개월을 가장 추천드려요 💪"

Q. 안 다치나요? / 위험하지 않나요?
→ "처음엔 스파링 없이 기본기만 배워요. 코치님이 안전하게 진행해주셔서 부상 위험이 매우 낮아요 😊"

Q. 헬스장은 따로 등록해야 하나요?
→ "아니에요! 복싱 멤버십 하나로 250평 헬스장까지 무료로 이용하실 수 있어요. 70여 종 최고급 머신이 다 있어요 💪"

Q. 직장인도 다닐 수 있나요?
→ "네, 직장인 분들 많이 오세요! 저녁 22:30까지 수업이 있어서 퇴근 후에도 오실 수 있어요 💪"

Q. 다른 운동이랑 병행 가능한가요?
→ "물론이에요! 헬스장도 365일 24시간 자율운동이 가능하고, 복싱과 병행하시기 정말 좋아요 💪"

Q. 키즈도 할 수 있나요?
→ "네! 오후 15:00~17:00에 키즈 레슨이 있어요. 아이들 체력, 집중력, 자신감 키우기에 정말 좋아요 😊"

Q. 주차 되나요?
→ "건물 주변 주차 가능해요. 자세한 내용은 010-8343-1530으로 문의 주세요 😊"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【기본 정보】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 위치: 충주시 계명대로 33-1 2층
- 전화: 010-8343-1530 (꼭 필요한 경우에만 안내)
- 카카오채널: http://pf.kakao.com/_txdGxcxj
- 네이버 체험예약: https://m.booking.naver.com/booking/5/bizes/1271500/items/7634522?area=pll&theme=place
- 네이버 1개월 결제: https://m.booking.naver.com/booking/5/bizes/1271500/items/6309584?area=pll&theme=place
- 네이버 3개월 결제: https://m.booking.naver.com/booking/5/bizes/1271500/items/6309825?area=pll&theme=place
- 네이버 5개월 결제: https://m.booking.naver.com/booking/5/bizes/1271500/items/6309835?area=pll&theme=place

【가격 (전부 포함 — 복싱+헬스+글러브+붕대)】
1개월: 189,000 / 3개월: 359,000(월119,667) / 5개월: 549,000(월109,800)

【체험】 보증금 20,000원 (당일 등록 시 전액 환급) / 준비물: 운동복+운동화

【답변 규칙】
1. 항상 "고객님" 호칭, 따뜻하고 긍정적인 존댓말
2. 부정어 절대 금지 — "안 돼요" → "이렇게 하시면 돼요"
3. 답변 끝은 반드시 열린 질문 또는 3개월/5개월 선택 유도 질문으로 마무리
4. 전화번호보다 네이버 결제 링크 우선
5. 4~6문장 이내 간결하게
6. 링크 안내 시 3개월을 항상 먼저, 5개월을 두 번째로
7. 헬스장 무료 이용 혜택을 항상 차별화 포인트로 강조`;

// ─── Deno Deploy 서버 ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { event, user, textContent } = body;

    console.log(`[TalkTalk-칠금] 이벤트: ${event}, 사용자: ${user}`);

    if (event === "open") {
      return new Response(
        JSON.stringify({ event: "send", textContent: { text: WELCOME_MESSAGE } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (event !== "send" || !textContent?.text) {
      return new Response(null, { status: 200 });
    }

    const msg = textContent.text.trim();
    console.log(`[TalkTalk-칠금] 사용자: ${msg}`);

    let replyText = null;

    if (isGreeting(msg)) {
      replyText = GREETING_REPLY;
    } else {
      const parts = [];

      // 등록 의사 (더 구체적인 것 우선)
      if (isReadyToRegister(msg)) {
        parts.push(REGISTER_QUICK_REPLY);
      } else if (isEnrollQuery(msg)) {
        parts.push(ENROLL_REPLY);
      }

      // 상담 (방문 의사도 상담으로 연결)
      if (isConsultQuery(msg) || isVisitQuery(msg)) parts.push(CONSULT_REPLY);

      // 예약 (등록/상담 없을 때만)
      if (isReservationOnly(msg) && parts.length === 0) parts.push(RESERVATION_ASK_REPLY);

      // 체험 — 고객이 "체험" 단어를 먼저 언급할 때만
      if (isTrialQuery(msg)) parts.push(TRIAL_QUICK_REPLY);

      // 가격
      if (isPriceQuery(msg)) parts.push(PRICE_TABLE);

      // 시간표 / 시간대
      if (isScheduleQuery(msg)) {
        parts.push(SCHEDULE_TABLE);
      } else {
        if (isMorningQuery(msg)) parts.push(MORNING_REPLY);
        if (isEveningQuery(msg)) parts.push(EVENING_REPLY);
        if (isKidsQuery(msg))    parts.push(KIDS_REPLY);
      }

      // 위치/주차
      if (isLocationQuery(msg)) parts.push(LOCATION_REPLY);
      if (isParkingQuery(msg))  parts.push(PARKING_REPLY);

      if (parts.length === 1) {
        replyText = parts[0];
      } else if (parts.length > 1) {
        replyText = `고객님, 궁금하신 내용 모두 안내드릴게요 😊\n\n` +
                    parts.join("\n\n─────────────────\n\n");
      }
    }

    if (replyText) {
      return new Response(
        JSON.stringify({ event: "send", textContent: { text: replyText } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Groq AI 호출
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: GYM_SYSTEM_PROMPT },
            { role: "user", content: msg },
          ],
          max_tokens: 600,
          temperature: 0.6,
        }),
      });

      if (!groqRes.ok) throw new Error(`Groq error: ${groqRes.status}`);
      const data = await groqRes.json();
      const aiReply = data.choices[0]?.message?.content;
      if (!aiReply) throw new Error("Empty response");

      return new Response(
        JSON.stringify({ event: "send", textContent: { text: aiReply } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (_groqErr) {
      return new Response(
        JSON.stringify({ event: "send", textContent: { text: FALLBACK_MENU } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("[TalkTalk-칠금] 오류:", err);
    return new Response(
      JSON.stringify({ event: "send", textContent: { text: FALLBACK_MENU } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
