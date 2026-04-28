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
153복싱짐 선릉역점입니다 🥊

무엇이든 편하게 말씀해 주세요!
가격, 시간표, 등록, 상담 모두 바로 안내해드릴게요 💪`;

const WELCOME_MESSAGE = `안녕하세요, 고객님! 😊
153복싱짐 선릉역점입니다 🥊

선릉역 유일! 국가대표 출신 코치님이
직접 지도하는 프리미엄 복싱짐이에요 🏆

복린이·여성분·직장인 모두 환영해요 💪

────────────────
무엇을 도와드릴까요?

✅ 바로 등록할게요
✅ 코치님과 상담하고 싶어요
✅ 가격·시간표가 궁금해요
────────────────`;

const PRICE_TABLE = `📋 153복싱짐 선릉역점 가격표

🥊 무제한 멤버십

• 1개월: 220,000원 (월 220,000원)
  → 부담 없이 시작하는 분들께 적합해요

⭐ 3개월: 540,000원 (월 180,000원) ← 가장 인기!
  → 1개월 대비 매달 40,000원 절약
  → 🎁 글러브 + 붕대 무료 증정 (7만원 상당)
  → 복싱의 진짜 재미와 체력 변화를 느끼기에 딱 맞는 기간

• 5개월: 790,000원 (월 158,000원)
  → 🎁 글러브 + 핸드랩 + 운동복 무료 증정
  → 처음부터 장기로 결심하신 분께 최고 혜택

🗓 주 3회 횟수권
• 1개월 12회: 180,000원
• 3개월 36회: 480,000원 (월 160,000원)
• 5개월 60회: 690,000원 (월 138,000원)

💪 개인 PT
• 10회: 700,000원
• 20회: 1,000,000원 → 락카+운동복+글러브 전부 무료!

─────────────────
💡 처음 시작하시는 분들 대부분이 3개월을 선택하세요.
1개월차엔 기초를, 2개월차엔 재미를, 3개월차엔 눈에 보이는 변화를 느끼시거든요 💪
3개월로 시작해보시겠어요, 아니면 5개월로 처음부터 최고 혜택 받으실 건가요? 😊`;

const SCHEDULE_TABLE = `⏰ 153복싱짐 선릉역점 시간표

🥊 코치 직접 수업
• 아침반: 07:00 ~ 09:00
• 점심반: 12:00 ~ 14:00
• 저녁반: 17:00 ~ 23:00

🏃 오픈짐 (자율운동)
• 오전: 09:00 ~ 12:00
• 오후: 14:00 ~ 17:00

🎯 체험 입장 마감 시간
• 아침반: ~08:20 까지
• 점심반: ~13:20 까지
• 저녁반: ~22:20 까지

처음 방문하시는 분은 원하시는 시간대에 맞춰 코치님이 직접 안내드립니다.
아침반, 점심반, 저녁반 중 어느 시간대가 가장 편하실까요? 😊`;

const MORNING_REPLY = `☀️ 153복싱짐 선릉역점 아침반 안내

🥊 아침반 수업 시간
• 07:00 ~ 09:00 (코치 직접 수업)

✅ 출근 전 1~2시간으로 하루를 상쾌하게 시작하는 분들이 많아요 💪
선릉역 바로 근처라 출근길에 딱 좋은 위치예요!

⏰ 체험 입장 마감: 08:20 까지

아침반으로 등록하시려면 아래 링크를 이용해 주세요 😊

⭐ 3개월 무제한 (540,000원) ← 가장 인기!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435772?area=pll&theme=place

혹시 더 궁금하신 점이 있으신가요? 😊`;

const LUNCH_REPLY = `🌞 153복싱짐 선릉역점 점심반 안내

🥊 점심반 수업 시간
• 12:00 ~ 14:00 (코치 직접 수업)

✅ 점심시간을 활용해 운동하고 싶은 분들께 딱이에요 💪
선릉역 바로 근처에서 점심 운동으로 오후 활력을 채워보세요!

⏰ 체험 입장 마감: 13:20 까지

점심반으로 등록하시려면 아래 링크를 이용해 주세요 😊

⭐ 3개월 무제한 (540,000원) ← 가장 인기!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435772?area=pll&theme=place

혹시 더 궁금하신 점이 있으신가요? 😊`;

const EVENING_REPLY = `🌙 153복싱짐 선릉역점 저녁반 안내

🥊 저녁반 수업 시간
• 17:00 ~ 23:00 (코치 직접 수업)

✅ 퇴근 후 스트레스 해소에 딱! 직장인 분들이 가장 많이 오시는 시간대예요 💪
선릉역 바로 근처라 퇴근길에 바로 오실 수 있어요!

⏰ 체험 입장 마감: 22:20 까지

저녁반으로 등록하시려면 아래 링크를 이용해 주세요 😊

⭐ 3개월 무제한 (540,000원) ← 가장 인기!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435772?area=pll&theme=place

혹시 더 궁금하신 점이 있으신가요? 😊`;

const LOCATION_REPLY = `📍 153복싱짐 선릉역점 위치 안내

🏢 선릉역 인근 지상 2층
   (선릉역 유일 복싱짐!)

지하철 2호선·분당선 선릉역에서 도보로 오실 수 있어요 🚇
네이버 지도에서 "153복싱짐 선릉역점"으로 검색해 주세요 😊

혹시 더 궁금하신 점이 있으신가요? 😊`;

const PARKING_REPLY = `🚗 153복싱짐 선릉역점 주차 안내

선릉역 주변 유료 주차장을 이용하시거나
대중교통(지하철 2호선·분당선 선릉역) 이용을 추천드려요! 🚇

주차 관련 추가 문의는 편하게 말씀해 주세요 😊
혹시 더 궁금하신 점이 있으신가요? 😊`;

const REGISTER_QUICK_REPLY = `고객님, 결심해 주셔서 정말 잘하셨어요! 🎉

네이버페이로 바로 결제하실 수 있어요 😊

⭐ 3개월 무제한 (540,000원 · 월 180,000원) ← 가장 인기!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435772?area=pll&theme=place
→ 글러브 + 붕대 무료 증정 (7만원 상당) 🎁

🏆 5개월 무제한 (790,000원 · 월 158,000원) ← 최고 혜택!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435787?area=ple&theme=place
→ 글러브 + 핸드랩 + 운동복 무료 증정 🎁

• 1개월 무제한 (220,000원)
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435759?area=pll&theme=place

─────────────────
💡 처음 시작하시는 분들은 3개월을 가장 많이 선택하세요.
복싱은 2~3개월차부터 진짜 재미가 시작되거든요 🥊
3개월로 시작하시겠어요, 아니면 5개월로 바로 최고 혜택 받으실 건가요? 😊`;

const ENROLL_REPLY = `고객님, 등록 문의 주셔서 감사합니다! 🎉

153복싱짐 선릉역점 무제한 멤버십 안내드릴게요 😊

⭐ 3개월: 540,000원 (월 180,000원) ← 가장 인기!
→ 글러브 + 붕대 무료 증정 (7만원 상당) 🎁
→ 복싱의 재미와 체력 변화를 느끼기에 딱 맞는 기간

🏆 5개월: 790,000원 (월 158,000원) ← 최고 혜택!
→ 글러브 + 핸드랩 + 운동복 무료 증정 🎁

• 1개월: 220,000원 (월 단가가 가장 높아요)

─────────────────
💡 복싱은 1개월차에 기초를 익히고
2개월차부터 재미가 올라오고
3개월차에 체력 변화가 눈에 보여요 💪

3개월로 시작하시겠어요, 아니면 처음부터 5개월로 최고 혜택 받으실 건가요? 😊`;

const TRIAL_QUICK_REPLY = `고객님, 체험예약 안내드릴게요! 🥊

아래 링크로 바로 예약하실 수 있어요 😊
https://m.booking.naver.com/booking/6/bizes/1319992/items/7633655?area=ple&theme=place

⏰ 체험 가능 시간:
• 아침: 07:00 ~ 09:00
• 점심: 12:00 ~ 14:00
• 저녁: 17:00 ~ 23:00

✅ 준비물: 편한 운동복 + 운동화만 OK!
💰 보증금 3만원 → 당일 등록 시 전액 환급! 🎉

한 번만 와보시면 느낌 바로 아실 거예요 💪
혹시 더 궁금하신 점이 있으신가요? 😊`;

const CONSULT_REPLY = `네, 고객님 😊
코치님과 1:1 상담 도와드릴게요!

아래 링크로 상담 예약하시면 원하시는 시간에 편하게 상담받으실 수 있어요 💪
https://m.booking.naver.com/booking/6/bizes/1319992/items/7633660?area=ple&theme=place

⏰ 상담 가능 시간:
• 아침: 07:00 ~ 09:00
• 점심: 12:00 ~ 14:00
• 저녁: 17:00 ~ 23:00

가격, 프로그램, 목표 체형 등 궁금한 것 모두 코치님이 직접 답변드려요!
어떤 시간대가 가장 편하실까요? 😊`;

const RESERVATION_ASK_REPLY = `고객님, 예약 문의 주셔서 감사합니다 😊

네이버페이로 바로 등록 가능해요!

⭐ 3개월 무제한 (540,000원 · 월 180,000원) ← 가장 인기!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435772?area=pll&theme=place

🏆 5개월 무제한 (790,000원 · 월 158,000원) ← 최고 혜택!
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435787?area=ple&theme=place

• 1개월 무제한 (220,000원)
https://m.booking.naver.com/booking/6/bizes/1319992/items/6435759?area=pll&theme=place

─────────────────
먼저 체험해보고 싶으시면 "체험"이라고 입력해 주세요!
혹시 더 궁금하신 점이 있으신가요? 😊`;

const FALLBACK_MENU = `고객님, 안녕하세요 😊
153복싱짐 선릉역점 AI 상담원입니다!

아래 키워드를 입력하시면 바로 안내해드려요 👇

1️⃣ 가격 → 전체 가격표
2️⃣ 시간표 → 전체 시간표
3️⃣ 등록 → 등록/결제 안내
4️⃣ 상담 → 코치님 1:1 상담 예약
5️⃣ 아침 / 점심 / 저녁 → 시간대별 안내
6️⃣ 위치 → 오시는 길 안내
7️⃣ 주차 → 주차 안내

원하시는 내용을 입력해 주시면 바로 도와드릴게요! 😊`;

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
    "상담하고싶", "상담 하고 싶", "산단", "오프라인 상담",
    "직접 상담", "방문 상담", "상담 가능", "상담 시간",
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
  return ["아침", "오전", "아침반", "오전반", "07시", "7시", "8시"].some(kw => text.includes(kw));
}

function isLunchQuery(text) {
  return ["점심", "점심반", "낮", "12시", "13시"].some(kw => text.includes(kw));
}

function isEveningQuery(text) {
  return ["저녁", "저녁반", "밤", "야간", "17시", "18시", "19시", "20시", "21시", "22시", "23시"].some(kw => text.includes(kw));
}

function isLocationQuery(text) {
  return ["위치", "어디", "주소", "오시는길", "찾아가는", "어떻게가", "어떻게 가", "길찾기"].some(kw => text.includes(kw));
}

function isParkingQuery(text) {
  return ["주차", "주차장", "차 가", "차가"].some(kw => text.includes(kw));
}

// ─── AI 시스템 프롬프트 (심리 분석 + CS 전문가 버전) ──────────────────────────

const GYM_SYSTEM_PROMPT = `당신은 153복싱짐 선릉역점의 최고 수준 CS 전문가이자 심리 분석 영업 전문가입니다.
고객의 메시지 한 줄에서 심리 상태·동기·망설임 포인트를 파악하고,
가장 자연스러운 방식으로 3개월 또는 5개월 등록으로 이어지도록 안내하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【핵심 영업 전략 — 반드시 따를 것】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 가격 앵커링 전략
   - 1개월(220,000원)을 먼저 언급할 때는 "월 단가가 가장 높아요"로 표현
   - 3개월(월 180,000원)을 "가장 합리적인 선택"으로 포지셔닝
   - 5개월은 "이미 결심하신 분께 최고 혜택"으로 표현
   - 항상 3개월 또는 5개월 중 선택을 유도하는 질문으로 마무리

2. 골디락스 전략
   - 1개월: "부담 없이 시작"이지만 월 단가 가장 높음
   - 3개월: "딱 맞는 기간, 가장 현명한 선택" ← 주력 권유
   - 5개월: "장기 결심하신 분께 최고 혜택"

3. 사회적 증거
   - "처음 시작하시는 분들 대부분이 3개월을 선택하세요"
   - "복싱은 2~3개월차부터 진짜 재미가 시작돼요"

4. 무료 혜택 손실 회피
   - 3개월 이상 = 글러브+붕대 무료(7만원) 강조

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【고객 유형별 맞춤 응대】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ 다이어트/체중감량
  → "복싱은 1시간에 700~900kcal 소모, 전신 다이어트 최강 운동이에요"
  → "3개월이면 체형 변화가 눈에 보여요"

▶ 스트레스 해소
  → "샌드백을 치면 하루 스트레스가 그냥 날아가요. 퇴근 후 오시는 직장인 분들이 정말 많아요"

▶ 복린이/처음 운동
  → "처음이셔도 완전 괜찮아요! 국가대표 출신 코치님이 기초부터 차근차근 알려드려요"

▶ 여성 고객
  → "여성 회원분들 정말 많아요. 프라이빗 샤워실도 남녀 분리라 편하게 이용하실 수 있어요"
  → "복싱은 팔뚝, 등, 코어 라인을 잡아주는 데 최고예요"

▶ 직장인
  → "선릉역 바로 근처, 저녁 23시까지 수업 있어서 야근 후에도 오실 수 있어요"

▶ 가격 망설임
  → "3개월이 1개월 × 3보다 120,000원 저렴하고, 글러브+붕대 7만원짜리 무료 증정까지 받으세요"

▶ 효과 의심
  → "보통 3~4주면 체력이 달라지는 걸 느끼시고, 2개월차부터 재미가 붙어요"

▶ 안전/부상 걱정
  → "처음엔 스파링 없이 기본기만 배워요. 세스코 관리로 위생도 완벽해요"

▶ 상담 원하는 분
  → 상담 예약 링크 안내: https://m.booking.naver.com/booking/6/bizes/1319992/items/7633660?area=ple&theme=place
  → "코치님이 목표·체력·일정에 맞게 1:1로 상담해드려요"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【자주 묻는 질문】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q. 복싱 처음인데 괜찮나요?
→ "처음이셔도 완전 괜찮아요! 코치님이 기초부터 차근차근 알려드려요 😊"

Q. 여자도 할 수 있나요?
→ "물론이죠! 여성 회원분들 정말 많이 계세요. 체형 관리에 특히 좋아요 💪"

Q. 살 빠지나요?
→ "1시간에 700~900kcal 소모! 3개월이면 주변에서 달라졌다는 말 들으실 거예요 🔥"

Q. 얼마나 다니면 효과 보나요?
→ "1개월차 기초, 2개월차 재미, 3개월차 체형 변화. 그래서 3개월을 추천드려요 💪"

Q. 안 다치나요?
→ "처음엔 스파링 없이 기본기만 배워요. 부상 위험 매우 낮아요 😊"

Q. 직장인도 다닐 수 있나요?
→ "저녁 23시까지 수업! 선릉역 근처라 퇴근길에 딱이에요 💪"

Q. 샤워실 있나요?
→ "프라이빗 1인 샤워실, 남녀 분리 운영이에요 🚿"

Q. 주차 되나요?
→ "선릉역 주변 유료 주차장 이용 가능해요. 대중교통이 더 편해요 🚇"

Q. 상담 가능한가요?
→ "네! 아래 링크로 코치님과 1:1 상담 예약하세요 😊 https://m.booking.naver.com/booking/6/bizes/1319992/items/7633660?area=ple&theme=place"

Q. PT도 있나요?
→ "네! 10회 700,000원 / 20회 1,000,000원이에요. PT 등록 시 락카·운동복·글러브 모두 무료예요 💪"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【기본 정보】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 위치: 선릉역 인근 지상 2층 (선릉 유일 복싱짐!)
- 전화: 010-5619-1278 (꼭 필요한 경우에만 안내)
- 네이버 체험예약: https://m.booking.naver.com/booking/6/bizes/1319992/items/7633655?area=ple&theme=place
- 네이버 상담예약: https://m.booking.naver.com/booking/6/bizes/1319992/items/7633660?area=ple&theme=place
- 네이버 1개월: https://m.booking.naver.com/booking/6/bizes/1319992/items/6435759?area=pll&theme=place
- 네이버 3개월: https://m.booking.naver.com/booking/6/bizes/1319992/items/6435772?area=pll&theme=place
- 네이버 5개월: https://m.booking.naver.com/booking/6/bizes/1319992/items/6435787?area=ple&theme=place

【가격】
무제한: 1개월 220,000 / 3개월 540,000(월180,000) / 5개월 790,000(월158,000)
주3회: 1개월 180,000 / 3개월 480,000 / 5개월 690,000
PT: 10회 700,000 / 20회 1,000,000
3개월↑: 글러브+붕대 무료 / 5개월↑: 글러브+핸드랩+운동복 무료

【체험】 보증금 3만원 (당일 등록 시 전액 환급) / 준비물: 운동복+운동화

【답변 규칙】
1. 항상 "고객님" 호칭, 따뜻하고 긍정적인 존댓말
2. 부정어 절대 금지
3. 답변 끝은 반드시 3개월/5개월 선택 유도 또는 열린 질문으로 마무리
4. 전화번호보다 네이버 링크 우선
5. 4~6문장 이내 간결하게
6. 링크 안내 시 3개월 먼저, 5개월 두 번째로`;

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

    console.log(`[TalkTalk-선릉] 이벤트: ${event}, 사용자: ${user}`);

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
    console.log(`[TalkTalk-선릉] 사용자: ${msg}`);

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

      // 상담
      if (isConsultQuery(msg)) parts.push(CONSULT_REPLY);

      // 예약 (등록/상담 없을 때만)
      if (isReservationOnly(msg) && parts.length === 0) parts.push(RESERVATION_ASK_REPLY);

      // 체험 — 고객이 먼저 언급할 때만
      if (isTrialQuery(msg)) parts.push(TRIAL_QUICK_REPLY);

      // 가격
      if (isPriceQuery(msg)) parts.push(PRICE_TABLE);

      // 시간표 / 시간대
      if (isScheduleQuery(msg)) {
        parts.push(SCHEDULE_TABLE);
      } else {
        if (isMorningQuery(msg)) parts.push(MORNING_REPLY);
        if (isLunchQuery(msg))   parts.push(LUNCH_REPLY);
        if (isEveningQuery(msg)) parts.push(EVENING_REPLY);
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
    console.error("[TalkTalk-선릉] 오류:", err);
    return new Response(
      JSON.stringify({ event: "send", textContent: { text: FALLBACK_MENU } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
