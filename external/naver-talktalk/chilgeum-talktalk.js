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

// ─── 웰컴 발송 하루 1회 제한 (in-memory, cold start 시 리셋) ─────────────────
const WELCOME_TTL_MS = 24 * 60 * 60 * 1000;
const welcomeCache = new Map();

// 하루 안에 재입장한 사용자에게 보낼 짧은 재인사
const RE_WELCOME_MESSAGE = `다시 오셨네요, 고객님! 🥊
편하게 무엇이든 물어봐 주세요 😊

💡 봇 사용법이 궁금하시면 "사용법" 이라고 보내주세요.`;

// ─── 봇 사용법 안내 ────────────────────────────────────────────────────────
const USAGE_HELP_MESSAGE = `💡 이렇게 물어봐 주세요

📋 가격 / 요금 → 회원권 안내
⏰ 시간표 → 수업 시간 안내
📞 예약 / 체험 → 첫 방문 잡기
📍 위치 / 주차 / 락카 → 시설 안내
🙋 상담 → 상담원 직접 연결

어떤 것이든 자유롭게 말씀하시면
AI 가 답변드립니다 😊`;

const USAGE_HELP_KEYWORDS = ["사용법", "어떻게 써", "어떻게 하", "뭐 물어", "뭘 물어", "이해 안", "이해가 안", "help"];
function isUsageHelpQuery(msg) {
  const lower = msg.toLowerCase();
  return USAGE_HELP_KEYWORDS.some((k) => lower.includes(k));
}

// (본문 나머지는 로컬 커밋과 동일 — 이 push는 stub. 실 업로드는 아래 노트 참고)