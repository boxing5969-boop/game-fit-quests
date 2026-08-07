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
153복싱짐 AI 상담원 오삼코치입니다 🥊

무엇이든 편하게 말씀해 주세요!
가격, 시간표, 등록, 상담 모두 바로 안내해드릴게요 💪`;

const WELCOME_MESSAGE = `안녕하세요, 고객님! 😊
153복싱짐 AI 상담원 오삼코치입니다 🥊

────────────────
🏆 153복싱짐 선릉역점을 선택해야 하는 이유

1️⃣ 선릉역 유일 지상층 프리미엄 복싱짐
   → 지하철 2호선·분당선 선릉역 도보권!
   출근길·퇴근길에 바로 들를 수 있어요

2️⃣ 국가대표 출신 코치님 직접 지도
   → 처음이셔도 기초부터 차근차근!
   복린이·여성분·직장인 모두 환영해요 💪

3️⃣ 1시간에 700~900kcal 소모
   → 복싱은 전신 다이어트 최강 운동!
   3개월이면 주변에서 달라졌다는 말 들으세요 🔥

4️⃣ 오전 7시부터 밤 23시까지 운영
   → 출근 전 아침 운동도, 야근 후에도 OK!!
   내 일정에 맞게 언제든 오실 수 있어요

5️⃣ 프라이빗 샤워실 (남녀 분리)
   → 운동 후 바로 씻고 귀가 가능해요 🚿

────────────────
💬 아래 단어를 입력하시면 바로 안내해드려요!

💰 가격표  →  "가격" 입력
⏰ 시간표  →  "시간표" 입력
📝 등록/결제  →  "등록" 입력
🗣 상담예약  →  "상담" 입력
📞 상담원 연결  →  "연결" 입력
☀️ 아침반  →  "아침" 입력
🌞 점심반  →  "점심" 입력
🌙 저녁반  →  "저녁" 입력
🔒 락카 안내  →  "락카" 입력
📍 오시는 길  →  "위치" 입력
🚗 주차 안내  →  "주차" 입력
────────────────
궁금하신 내용을 입력해 주시면 바로 도와드릴게요 💪`;

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
• 20회: 1,000,000원 → 운동복+글러브 무료!

🔒 개인 락카 (글러브·장갑 보관용)
• 한정 수량 운영 · 월 10,000원 (별도)
• 샤워실 내 공용 락카는 목욕탕식 무료 이용 가능

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

const LOCKER_REPLY = `🔒 153복싱짐 선릉역점 락카 안내

━━━━━━━━━━━━━━━
📦 개인 락카 (유료 · 한정 수량)
━━━━━━━━━━━━━━━
글러브·장갑 등 운동 장비를 짐에 놓고 다닐 수 있는 전용 보관함이에요.

💰 이용 요금
• 1개월 등록 → 락카 1개월: 10,000원
• 3개월 등록 → 락카 3개월: 30,000원
• 5개월 등록 → 락카 5개월: 50,000원
(등록 기간과 동일하게 신청하시면 돼요)

⚠️ 한정 수량이라 자리가 없을 수 있어요.
신청은 등록 시 코치님께 문의해 주세요!

━━━━━━━━━━━━━━━
🚿 샤워실 공용 락카 (무료)
━━━━━━━━━━━━━━━
입장 후 운동복으로 갈아입을 때부터 운동 끝나고 샤워 후 사복으로 갈아입을 때까지
그날 방문하는 동안 사복·소지품을 보관하는 용도예요. 목욕탕 락카처럼 사용하시면 돼요!
단, 글러브·장비를 매일 두고 다니는 장기 보관은 개인 락카를 이용해 주세요 😊

─────────────────
추가 문의는 편하게 말씀해 주세요 💪`;

/**
 * ── 2026-08-04 추가: 봇이 답 못 하던 문의 7종 ───────────────────────────────
 * 근거: talktalk_question_log 에서 선릉 category='other' 28건을 뽑아 주제별로 묶었더니
 *       홀딩·대여·청소년·자율운동·환불·주말·주1회 7개가 반복되고 있었다.
 *       (기존에는 전부 AI 폴백으로 넘어가 매번 다른 답이 나갔다)
 * 정책 출처: 대표님 확정(2026-08-04). 임의로 바꾸지 말 것.
 */
const HOLDING_REPLY = `⏸️ 153복싱짐 선릉역점 홀딩(일시정지) 안내

━━━━━━━━━━━━━━━
📌 등록 기간별 홀딩
━━━━━━━━━━━━━━━
• 1개월 등록 → 1회, 최대 7일
• 3개월 등록 → 1회, 최대 15일
• 5개월 등록 → 2회, 최대 30일

나눠서 쓰시는 건 5개월 등록(2회)부터 가능해요.
1·3개월은 한 번에 사용하시면 됩니다 😊

━━━━━━━━━━━━━━━
🏥 규정 외 홀딩
━━━━━━━━━━━━━━━
질병·부상·사고는 위 횟수와 별도로 홀딩해 드려요.
진단서 등 증빙 서류만 보여주시면 됩니다.

━━━━━━━━━━━━━━━
✅ 신청 방법
━━━━━━━━━━━━━━━
시작일과 기간을 톡톡으로 남겨주시거나 코치님께 말씀해 주세요.
바로 처리해 드리겠습니다 💪`;

const RENTAL_REPLY = `🧤 153복싱짐 선릉역점 장비·대여 안내

━━━━━━━━━━━━━━━
🥊 글러브
━━━━━━━━━━━━━━━
• 1개월 단기 등록 → 공용 글러브 무료 사용 가능
• 3개월 이상 등록 → 글러브 + 붕대 무료 증정 (7만원 상당)
• 5개월 이상 등록 → 글러브 + 핸드랩 + 운동복 무료 증정

━━━━━━━━━━━━━━━
👕 운동복
━━━━━━━━━━━━━━━
월 10,000원 (렌탈 + 세탁비 포함)
매번 세탁된 옷으로 준비해 드려서 짐 없이 몸만 오시면 돼요!

━━━━━━━━━━━━━━━
🧻 수건
━━━━━━━━━━━━━━━
무료로 대여해 드립니다 😊

─────────────────
3개월부터는 글러브가 아예 내 것이 되니
장기로 하실 계획이면 3개월이 훨씬 이득이에요 💪`;

const YOUTH_REPLY = `🧒 153복싱짐 선릉역점 청소년 등록 안내

초등학생부터 중·고등학생까지 모두 등록 가능합니다! 😊

━━━━━━━━━━━━━━━
⏰ 시간
━━━━━━━━━━━━━━━
밤 11시까지 운영해서 학원 끝나고 밤 10시에 오셔도 수업 들으실 수 있어요.
시간 제한 없이 원하시는 반으로 오시면 됩니다.

━━━━━━━━━━━━━━━
🥊 수업
━━━━━━━━━━━━━━━
국가대표 출신 코치님이 기초부터 1:1로 봐드려서
운동이 처음인 학생도 안전하게 시작합니다.
체력·자세·집중력에 특히 좋아요!

─────────────────
학생 2명 이상 함께 등록하시는 경우도 많아요.
요일·시간만 알려주시면 자리 확인해 드릴게요 💪`;

const GYM_ONLY_REPLY = `🏋️ 153복싱짐 선릉역점 자율운동(수업 없이 시설만) 안내

수업 없이 체육관 시설만 이용하시는 경우
일반 회원권의 **50% 금액**으로 이용하실 수 있어요.

━━━━━━━━━━━━━━━
💰 자율운동 요금 (정가 대비 50%)
━━━━━━━━━━━━━━━
🔹 1개월
   총 110,000원 (정가 220,000원)
   → 한 달 110,000원 · 하루 약 3,700원

🔹 3개월
   총 270,000원 (정가 540,000원)
   → 한 달 90,000원 · 하루 3,000원

🔹 5개월 ⭐ 가장 저렴
   총 395,000원 (정가 790,000원)
   → 한 달 79,000원 · 하루 약 2,600원

커피 한 잔 값으로 하루 운동하시는 셈이에요 ☕
샌드백·기구·샤워실 모두 그대로 이용하실 수 있고,
코치 수업만 빠지는 형태입니다.

─────────────────
자세를 한 번은 잡고 시작하시는 게 좋아서,
처음이시라면 수업 포함 회원권을 권해드려요.
어떤 쪽이 맞을지 상담에서 같이 골라드릴게요 😊`;

const REFUND_REPLY = `💳 153복싱짐 선릉역점 환불 안내

법정 기준(체육시설법)에 따라 아래처럼 계산해 드려요.

━━━━━━━━━━━━━━━
🧮 계산 방식
━━━━━━━━━━━━━━━
① 이용한 기간을 **일 단위**로 계산해 차감
   (등록 개월수 ÷ 일수로 나눈 하루 단가 기준)
② 위약금 10% 차감
③ 받으신 글러브·붕대 등 장비가 있으면 장비 실비 차감
④ 운동복·락카는 남은 기간만큼 별도로 계산해 더해 드립니다
⑤ 홀딩(일시정지) 기간은 이용 기간에서 빼드려요

━━━━━━━━━━━━━━━
✅ 신청
━━━━━━━━━━━━━━━
성함만 알려주시면 정확한 금액을 계산해서 안내드립니다.
카드 결제 건은 원칙적으로 카드 승인 취소로 진행돼요.

─────────────────
혹시 시간이 안 맞아 쉬시는 거라면
환불 대신 **홀딩(일시정지)** 도 가능하니 편하게 말씀해 주세요 😊`;

const WEEKEND_REPLY = `📅 153복싱짐 선릉역점 주말 안내

주말(토·일)은 정규 수업을 운영하지 않습니다.
평일 아침 7시부터 밤 11시까지 운영해서
출근 전·점심·퇴근 후 원하시는 시간에 오실 수 있어요 😊

━━━━━━━━━━━━━━━
🤝 주말에 가능한 것
━━━━━━━━━━━━━━━
• 개인 PT
• 대관 / 자율훈련
→ 별도 문의 주시면 일정 잡아드립니다.

─────────────────
평일 시간표가 궁금하시면 "시간표" 라고 입력해 주세요 💪`;

const WEEK_FREQ_REPLY = `📆 153복싱짐 선릉역점 주 이용 횟수 안내

회원권은 **무제한** 과 **주 3회** 두 가지로 운영해요.

• 무제한 : 1개월 220,000 / 3개월 540,000 / 5개월 790,000
• 주 3회 : 1개월 180,000 / 3개월 480,000 / 5개월 690,000

주 1회로 오시는 건 **개인 PT** 로만 가능합니다.
(PT 10회 700,000원 / 20회 1,000,000원)

─────────────────
주 1~2회 생각하고 계셨다면
주 3회 회원권이 회당 단가가 훨씬 낮아요.
어떤 쪽이 맞을지 같이 봐드릴게요 😊`;

/**
 * ── 2026-08-04 2차 추가: 고정 답변이 없어 AI로 새던 단골 질문 6종 ──────────────
 * 실측: "피티"·"개인레슨"·"샤워실"·"처음인데"·"살 빠지나요"·"스파링" 모두 키워드 미매칭 →
 *       Groq 호출 실패 시 폴백 메뉴만 나가고 있었다(대표님 지적).
 *       내용은 기존 GYM_SYSTEM_PROMPT 의 FAQ·가격표와 같은 값 — 두 경로가 같은 답을 하게 맞췄다.
 */
const PT_REPLY = `💪 153복싱짐 선릉역점 개인 PT(1:1 레슨) 안내

━━━━━━━━━━━━━━━
💰 PT 요금
━━━━━━━━━━━━━━━
• 10회 : 700,000원
• 20회 : 1,000,000원

🎁 PT 등록 시 운동복 · 글러브 무료!

━━━━━━━━━━━━━━━
🥊 이런 분께 좋아요
━━━━━━━━━━━━━━━
• 처음이라 자세부터 제대로 잡고 싶은 분
• 단기간에 체형·체력을 확실히 바꾸고 싶은 분
• 주 1회만 오실 수 있는 분 (주 1회는 PT로만 가능해요)
• 평일 시간이 안 맞는 분 (주말 PT는 별도 문의 주시면 잡아드려요)

국가대표 출신 코치님이 목표·체력에 맞춰
1:1로 프로그램을 짜드립니다.

─────────────────
원하시는 요일·시간 알려주시면
코치님 일정 확인해서 바로 안내드릴게요 😊
상담 예약 → https://m.booking.naver.com/booking/6/bizes/1319992/items/7633660?area=ple&theme=place`;

const SHOWER_REPLY = `🚿 153복싱짐 선릉역점 샤워실 안내

프라이빗 1인 샤워실이고, 남녀 완전 분리 운영이에요.
운동 끝나고 바로 씻고 나가실 수 있습니다 😊

• 수건 무료 대여
• 운동복 렌탈 월 10,000원 (세탁비 포함)
• 사복·소지품은 샤워실 공용 락카에 보관 (당일 무료)

몸만 오셔도 운동하고 씻고 나가실 수 있어요.
퇴근길에 들르시는 직장인 회원분들이 많습니다 💪`;

const BEGINNER_REPLY = `🥊 복싱 처음이신가요? 전혀 걱정 안 하셔도 됩니다 😊

회원분들 대부분이 복싱 처음으로 시작하셨어요.
국가대표 출신 코치님이 붙어서 기초부터 하나씩 알려드립니다.

━━━━━━━━━━━━━━━
🗓️ 처음 한 달은 이렇게
━━━━━━━━━━━━━━━
• 1주차 : 핸드랩 감는 법 · 스탠스 · 줄넘기
• 2~3주차 : 잽 · 스트레이트 기본 폼
• 4주차 : 미트 치기 (제일 재밌어지는 구간이에요!)

처음엔 스파링을 하지 않습니다. 기본기만 배워요.
그래서 부상 위험이 아주 낮습니다.

━━━━━━━━━━━━━━━
👕 준비물
━━━━━━━━━━━━━━━
운동복 + 운동화만 있으면 돼요.
글러브는 1개월 등록도 공용으로 쓰실 수 있고,
3개월 이상 등록하시면 글러브+붕대를 드립니다.

─────────────────
보통 3~4주면 체력이 달라지는 걸 느끼세요.
편하게 오셔서 한 번 해보시는 게 제일 빠릅니다 💪`;

const WOMEN_REPLY = `💗 153복싱짐 선릉역점 여성 회원 안내

여성 회원분들 정말 많이 계세요!
처음 오시는 분도 어색하지 않게 코치님이 챙겨드립니다 😊

• 프라이빗 1인 샤워실 · 남녀 분리 운영
• 운동복 렌탈 월 10,000원 (세탁비 포함) — 짐 없이 몸만 오시면 돼요
• 팔뚝 · 등 · 코어 라인 잡는 데 복싱이 특히 좋아요
• 스파링 없이 기본기만 배우는 것도 얼마든지 가능합니다

밤 11시까지 운영해서 퇴근 후에도 여유 있게 오실 수 있어요.

─────────────────
궁금한 점 있으시면 편하게 물어봐 주세요 💪`;

const DIET_REPLY = `🔥 153복싱짐 선릉역점 다이어트 안내

복싱은 1시간에 700~900kcal 소모되는 전신 유산소 운동이에요.
러닝보다 지루하지 않아서 오래 하시는 분이 많습니다 😊

━━━━━━━━━━━━━━━
📈 보통 이런 흐름이에요
━━━━━━━━━━━━━━━
• 1개월차 : 체력이 붙는 게 먼저 느껴져요
• 2개월차 : 운동이 재밌어지는 구간
• 3개월차 : 주변에서 달라졌다는 말을 듣기 시작해요

그래서 3개월 등록을 가장 많이 하십니다.
(3개월 540,000원 · 월 180,000원 · 글러브+붕대 무료 증정)

체중이 좀 나가셔도 전혀 문제없어요.
처음엔 강도를 낮춰서 시작하고, 코치님이 옆에서 속도를 맞춰드립니다.

─────────────────
목표 체중·기간 알려주시면
어느 정도가 현실적인지 상담에서 같이 잡아드릴게요 💪`;

const SPARRING_REPLY = `🥊 153복싱짐 선릉역점 스파링 안내

처음 오시는 분은 스파링을 하지 않습니다.
기본기(스탠스·잽·미트)만 배우기 때문에 부상 위험이 아주 낮아요 😊

스파링은 원하시는 분만, 충분히 익숙해진 뒤에
코치님 판단으로 안전하게 시작합니다.
"저는 스파링 안 할래요" 하셔도 전혀 문제없어요.

시합·대회를 준비하시는 분은 따로 프로그램을 잡아드립니다.

─────────────────
운동 목적(다이어트 / 체력 / 시합)을 알려주시면
거기에 맞춰 안내해 드릴게요 💪`;

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

const CONTACT_REPLY = `📞 153복싱짐 선릉역점 상담원 연결 안내

문자·카카오톡·전화 모두 가능해요! 😊

📱 전화 / 문자: 010-5619-1278
💬 카카오톡: 채널 검색 → "153복싱짐 선릉역점"

─────────────────
⚠️ 수업 중·회의 중에는 전화 통화가 바로 어려울 수 있어요.
문자나 카카오톡으로 남겨주시면
확인 후 꼭 연락드릴게요 🙏

혹시 더 궁금하신 점이 있으신가요? 😊`;

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
저는 153복싱짐 선릉역점 AI 상담원이에요!

말씀하신 내용을 정확히 파악하지 못했어요 🙏
아래처럼 입력해 주시면 원하시는 정보를 바로 안내해드릴게요!

👉 가격이 궁금하시면 → "가격" 이라고 입력해 주세요
👉 시간표가 궁금하시면 → "시간표" 라고 입력해 주세요
👉 상담 예약을 원하시면 → "상담" 이라고 입력해 주세요
👉 상담원과 직접 연결을 원하시면 → "연결" 이라고 입력해 주세요
👉 등록/결제를 원하시면 → "등록" 이라고 입력해 주세요
👉 아침·점심·저녁 수업이 궁금하시면 → "아침" / "점심" / "저녁" 이라고 입력해 주세요
👉 락카 안내는 → "락카" 라고 입력해 주세요
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
  if (text.includes("상담원")) return false;
  if ([
    "상담예약", "상담 예약", "상담신청", "상담 신청",
    "상담하고싶", "상담 하고 싶", "산단", "오프라인 상담",
    "직접 상담", "방문 상담", "상담 가능", "상담 시간",
  ].some(kw => text.includes(kw))) return true;
  return fuzzyContains(text, "상담", 1);
}

function isContactQuery(text) {
  return [
    "상담원", "연결", "전화번호", "직접 연락", "직접연락",
    "담당자", "직원 연결", "직원연결", "사람이랑", "사람과",
  ].some(kw => text.includes(kw));
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

function isLockerQuery(text) {
  if (["락카", "라카", "롹카", "락커", "라커", "로카", "록카", "라크카", "낙카", "locker"].some(kw => text.includes(kw))) return true;
  return fuzzyContains(text, "락카", 1);
}

// ─── 2026-08-04 추가 감지기 (미응답 문의 7종) ─────────────────────────────────

function isHoldingQuery(text) {
  return [
    "홀딩", "홀드", "일시정지", "일시 정지", "정지", "중지", "미루",
    "쉬었다", "쉬려고", "잠깐 쉬", "잠시 쉬", "연기", "기간 미룰", "멈춤",
  ].some(kw => text.includes(kw));
}

function isRentalQuery(text) {
  // '대여/렌탈' 또는 장비 단어 + 구비·있나요 조합
  if (["대여", "렌탈", "렌트", "빌릴", "빌려", "빌리"].some(kw => text.includes(kw))) return true;
  return ["운동복", "글러브", "글로브", "수건", "타월", "목장갑", "장갑"].some(kw => text.includes(kw))
    && ["있나", "있어", "구비", "제공", "주나", "되나", "필요"].some(kw => text.includes(kw));
}

function isYouthQuery(text) {
  return [
    "초등", "중학", "고등", "중1", "중2", "중3", "고1", "고2", "고3",
    "학생", "청소년", "아이", "자녀", "딸", "아들", "미성년",
    "몇 살", "몇살", "나이 제한", "나이제한", "연령",
  ].some(kw => text.includes(kw));
}

function isGymOnlyQuery(text) {
  // "수업 안 받고 체육관만" — 자율운동 문의
  if (["자율운동", "자율 운동", "체육관만", "시설만", "기구만", "혼자 운동", "혼자운동"].some(kw => text.includes(kw))) return true;
  return ["수업", "레슨", "pt", "PT", "피티"].some(kw => text.includes(kw))
    && ["안 받", "안받", "없이", "빼고", "말고"].some(kw => text.includes(kw));
}

function isRefundQuery(text) {
  return ["환불", "환급", "돌려받", "취소하고", "해지", "중도 해지", "중도해지"].some(kw => text.includes(kw));
}

function isWeekendQuery(text) {
  return ["주말", "토요일", "일요일", "토욜", "일욜", "주말반", "토일"].some(kw => text.includes(kw));
}

function isWeekFreqQuery(text) {
  return ["주1회", "주 1회", "주2회", "주 2회", "주1", "주3회", "주 3회", "일주일에 한", "일주일에 두"].some(kw => text.includes(kw));
}

// ─── 2026-08-04 2차 추가 감지기 ─────────────────────────────────────────────


/* --- PT 상담앱 연결 + 2:1 듀엣 + 카드 (2026-08-07 복구) --- */
const PT_CONSULT_URL = "https://quiet-vulture-8998.boxing5969-boop.deno.net/";
const PT_BANNER_URL = "https://tidy-robin-56.boxing5969-boop.deno.net/consult-banner.png?v=2";
const PT_TEL_DIGITS = "05071468596" + "9";
const PT_REPLY_FULL = PT_REPLY
  + "\n\n━━━━━━━━━━━━━━━\n👥 2:1 듀엣 PT (1인 기준)\n━━━━━━━━━━━━━━━\n"
  + "• 10회 · 400,000원\n• 20회 · 600,000원\n친구·가족·연인과 둘이 함께하면 1인당 약 40% 저렴해요!\n"
  + "\n📝 상담 신청\n목표·희망 시간만 남겨주시면 담당 코치가 확인 후 연락드립니다\n👉 " + PT_CONSULT_URL;
function ptCard() {
  return {
    event: "send",
    compositeContent: { compositeList: [{
      title: "🥊 1:1 퍼스널 트레이닝 · 선릉역점",
      image: { imageUrl: PT_BANNER_URL },
      description: PT_REPLY_FULL.length > 990 ? PT_REPLY_FULL.slice(0, 987) + "..." : PT_REPLY_FULL,
      buttonList: [
        { type: "LINK", data: { title: "상담 신청하기 <<클릭!!", url: PT_CONSULT_URL, mobileUrl: PT_CONSULT_URL } },
        { type: "LINK", data: { title: "전화 상담", url: "tel:" + PT_TEL_DIGITS, mobileUrl: "tel:" + PT_TEL_DIGITS } }
      ]
    }] }
  };
}
const PT_KO_RE = /개인피티|개인트레이닝|개인레슨|개인수업|개인강습|개인지도|퍼스널|퍼스날|프라이빗|(?<!지)피티/;
const PT_ONE_RE = /(?<![\d:])1\s*[:대]\s*1(?![\d:])|(?<!\d)일대[1일](?!\d|반)|(?<!\d)1대일(?!\d)/;
const PT_EN_RE = /(?<![a-z])(p\.?t\.?|personal)(?![a-z])/;
function isPtQuery(text) {
  const raw = String(text || "").toLowerCase();
  const s = raw.replace(/\s/g, "");
  if (PT_KO_RE.test(s)) return true;
  if (PT_ONE_RE.test(s)) return true;
  if (PT_EN_RE.test(raw)) return true;
  return false;
}

function isShowerQuery(text) {
  return ["샤워", "샤워실", "씻", "탈의", "탈의실", "드라이기", "드라이어"].some(kw => text.includes(kw));
}

function isBeginnerQuery(text) {
  return [
    "처음", "초보", "복린이", "초심자", "입문", "생초보",
    "해본적", "해 본 적", "할수있을지", "할 수 있을지", "잘할수", "잘 할 수", "걱정",
  ].some(kw => text.includes(kw));
}

function isWomenQuery(text) {
  return ["여자", "여성", "여성분", "여자분", "여회원"].some(kw => text.includes(kw));
}

function isDietQuery(text) {
  return [
    "다이어트", "체중감량", "체중 감량", "살 빠", "살빠", "감량", "체지방",
    "몸무게", "체중이", "뱃살", "복부",
  ].some(kw => text.includes(kw));
}

function isSparringQuery(text) {
  return ["스파링", "대련", "시합", "경기", "맞는", "때리는", "부상", "다치"].some(kw => text.includes(kw));
}

/**
 * 광고·스팸 — 블로그 홍보 링크가 실제로 들어왔다(2026-08-03).
 * 응답하면 발신자에게 '살아있는 채널'이라는 신호를 준다. 조용히 무시한다.
 */
function isSpam(text) {
  if (!/https?:\/\//i.test(text)) return false;
  return ["블로그", "상위노출", "무료", "체험단", "홍보", "마케팅", "대행", "팔로워", "구독자"]
    .some(kw => text.includes(kw));
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
→ "네! 10회 700,000원 / 20회 1,000,000원이에요. PT 등록 시 운동복·글러브 무료예요 💪 개인 락카는 한정 수량으로 월 10,000원 별도예요."

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【운영 규정 — 2026-08-04 대표 확정. 절대 지어내지 말 것】
━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ 홀딩(일시정지)
  · 1개월 등록 = 1회, 최대 7일
  · 3개월 등록 = 1회, 최대 15일
  · 5개월 등록 = 2회, 최대 30일 (5개월만 나눠 쓰기 가능)
  · 질병·부상·사고는 위 횟수와 별도. 진단서 등 증빙 서류 제출 시 홀딩 가능
  → 없는 조건(예: 무제한 홀딩, 3개월 분할)을 지어내지 말 것

▶ 장비·대여
  · 1개월 단기 등록 = 공용 글러브 무료 사용 가능
  · 운동복 = 월 10,000원 (렌탈+세탁비 포함)
  · 수건 = 무료 대여
  · 3개월↑ 글러브+붕대 증정 / 5개월↑ 글러브+핸드랩+운동복 증정

▶ 청소년
  · 초등학생·중학생·고등학생 모두 등록 가능, 시간 제한 없음
  · 밤 11시까지 운영이라 밤 10시에 오셔도 수업 가능

▶ 자율운동(수업 없이 시설만) — 일반 회원권의 50%
  · 1개월 = 총 110,000원 / 월 110,000원 / 하루 약 3,700원
  · 3개월 = 총 270,000원 / 월 90,000원 / 하루 3,000원
  · 5개월 = 총 395,000원 / 월 79,000원 / 하루 약 2,600원 (가장 저렴)
  → 총액·월 단가·하루 단가를 함께 말해 주면 부담이 작게 느껴진다. 위 숫자 외에는 만들지 말 것

▶ 환불
  · 이용한 기간을 일 단위로 차감 + 위약금 10% 차감
  · 받은 장비(글러브·붕대) 실비 차감
  · 운동복·락카는 남은 기간만큼 별도 계산해 가산
  · 홀딩 기간은 이용 기간에서 제외
  · 정확한 금액은 성함 확인 후 계산해 안내

▶ 주말
  · 토·일 정규 수업 없음(평일만 운영)
  · 단, 개인 PT / 대관 / 자율훈련은 별도 문의 시 가능

▶ 주 이용 횟수
  · 회원권은 무제한 · 주3회 두 가지
  · 주 1회는 개인 PT로만 가능

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
락카: 개인락카=글러브·장비 장기보관전용, 한정수량, 등록기간과 동일하게 신청(1개월10,000/3개월30,000/5개월50,000원) / 샤워실공용락카=무료, 방문당일 입장~퇴장까지 사복·소지품 보관용(목욕탕식), 장비 장기보관 불가

【체험】 보증금 3만원 (당일 등록 시 전액 환급) / 준비물: 운동복+운동화

【답변 규칙】
1. 항상 "고객님" 호칭, 따뜻하고 긍정적인 존댓말
2. 부정어 절대 금지
3. 답변 끝은 반드시 3개월/5개월 선택 유도 또는 열린 질문으로 마무리
4. 전화번호보다 네이버 링크 우선
5. 4~6문장 이내 간결하게
6. 링크 안내 시 3개월 먼저, 5개월 두 번째로
7. 반드시 한국어(한글)로만 답변. 한자·중국어·일본어·알 수 없는 특수문자 절대 사용 금지.
8. 무료 증정 물품은 정확히: 3개월=글러브+붕대, 5개월=글러브+핸드랩+운동복. 이 외 물품(조끼·장갑·신발 등) 절대 추가 금지.
9. 락카는 무료가 아님. 개인락카=월10,000원, 공용락카=당일방문용 무료. 절대로 "락카 무료"라고 말하지 말 것.
10. 위 【운영 규정】에 없는 조건·금액·기간을 만들어내지 말 것. 모르면 "코치님이 정확히 안내드릴게요"로 상담 링크를 준다.
11. 주말에 정규 수업이 있다고 말하지 말 것(평일만 운영).`;

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

    // 사업주 계정 — 자동 응답 없음
    const OWNER_IDS = ["gkadmsal64"];
    if (OWNER_IDS.includes(user)) {
      return new Response(null, { status: 200 });
    }

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

    // 광고·스팸은 조용히 무시 — 응답하면 '살아있는 채널'이라는 신호를 준다
    if (isSpam(msg)) {
      console.log("[TalkTalk-선릉] 스팸 무시");
      return new Response(null, { status: 200 });
    }

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

      // 상담원 직접 연결
      if (isContactQuery(msg)) parts.push(CONTACT_REPLY);

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
        if (isLunchQuery(msg))   parts.push(LUNCH_REPLY);
        if (isEveningQuery(msg)) parts.push(EVENING_REPLY);
      }

      // 위치/주차/락카
      if (isLocationQuery(msg)) parts.push(LOCATION_REPLY);
      if (isParkingQuery(msg))  parts.push(PARKING_REPLY);
      if (isLockerQuery(msg))   parts.push(LOCKER_REPLY);

      // 2026-08-04 추가 — 실제로 들어왔는데 답이 없던 문의들
      if (isHoldingQuery(msg))  parts.push(HOLDING_REPLY);
      if (isRentalQuery(msg))   parts.push(RENTAL_REPLY);
      if (isYouthQuery(msg))    parts.push(YOUTH_REPLY);
      if (isGymOnlyQuery(msg))  parts.push(GYM_ONLY_REPLY);
      if (isRefundQuery(msg))   parts.push(REFUND_REPLY);
      if (isWeekendQuery(msg))  parts.push(WEEKEND_REPLY);
      // 주말/시간표 안내가 이미 붙었으면 횟수 안내는 생략(같은 말 반복 방지)
      if (isWeekFreqQuery(msg) && !parts.includes(PRICE_TABLE)) parts.push(WEEK_FREQ_REPLY);

      // 2026-08-04 2차 — PT·샤워·초보·여성·다이어트·스파링
      // 가격표가 이미 붙었으면 PT 요금이 중복되므로 PT 블록은 생략한다
      if (isPtQuery(msg)) {
        // PT 문의는 전용 카드(상담 신청 버튼)가 전체 가격표보다 우선한다
        const pi = parts.indexOf(PRICE_TABLE);
        if (pi >= 0) parts.splice(pi, 1);
        parts.push(PT_REPLY_FULL);
      }
      if (isShowerQuery(msg))   parts.push(SHOWER_REPLY);
      if (isBeginnerQuery(msg)) parts.push(BEGINNER_REPLY);
      if (isWomenQuery(msg))    parts.push(WOMEN_REPLY);
      if (isDietQuery(msg))     parts.push(DIET_REPLY);
      if (isSparringQuery(msg)) parts.push(SPARRING_REPLY);

      if (parts.length === 1) {
        replyText = parts[0];
      } else if (parts.length > 1) {
        replyText = `고객님, 궁금하신 내용 모두 안내드릴게요 😊\n\n` +
                    parts.join("\n\n─────────────────\n\n");
      }
    }

    if (replyText === PT_REPLY_FULL) {
      return new Response(JSON.stringify(ptCard()), { status: 200, headers: { "Content-Type": "application/json" } });
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
          max_tokens: 500,
          temperature: 0.4,
        }),
      });

      if (!groqRes.ok) throw new Error(`Groq error: ${groqRes.status}`);
      const data = await groqRes.json();
      const aiReply = data.choices[0]?.message?.content?.trim();
      if (!aiReply) throw new Error("Empty response");

      // 한자·이상한 문자 포함 시 fallback
      if (/[⺀-鿿豈-﫿]/.test(aiReply)) {
        throw new Error("Non-Korean characters detected");
      }

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