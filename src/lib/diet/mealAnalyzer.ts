/**
 * 153 다이어트 · 식단 사진 AI 분석 추상화.
 *
 * 제공자(provider) 교체 가능한 구조. 실제 Vision LLM 연결은 edge function 또는
 * 서버에서 처리하고, 클라이언트는 `analyzeMealPhoto()` 한 개만 호출한다.
 *
 * 현재 구현:
 *   · "rules" — 시간대·파일명·메타 기반 간이 rule-based (fallback, 항상 동작)
 *   · "llm"   — edge function 경유 Vision LLM (구현 시 주입)
 *
 * 원칙:
 *   · 정확한 영양학 판정 X, 3단계 코칭(good/normal/adjust) 수준만
 *   · 죄책감 유발·벌점 문구 금지 — feedback 은 늘 부드러운 톤
 *   · 실패 프레임 금지 — "망했다" "안 좋다" 사용 안 함
 *   · 항상 "다음 행동" 한 가지 제안
 */

export type MealCategory = "good" | "normal" | "adjust";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface AnalyzeInput {
  /** base64 이미지 또는 public URL. LLM 제공자가 사용. 룰 기반은 무시. */
  imageSource?: string;
  /** 업로드 시각 (기본 now). 식사 시간대 추정에 사용. */
  uploadedAt?: Date;
  /** 이미지 파일 이름 또는 저장 경로 — 시간대 힌트 보조. */
  storageKey?: string;
  /** 사용자가 직접 지정한 끼니 (있으면 우선). */
  userSlot?: MealSlot;
}

export interface AnalyzeResult {
  category: MealCategory;
  feedback: string;                 // 한 줄, 부드러운 톤
  detectedTags: string[];
  mealSlot: MealSlot;
  provider: "rules" | "llm";
}

export const CATEGORY_LABEL_KO: Record<MealCategory, string> = {
  good: "좋음",
  normal: "보통",
  adjust: "조절 필요",
};

export const CATEGORY_TONE_CLASS: Record<MealCategory, string> = {
  good: "bg-emerald-400/15 text-emerald-600 border-emerald-400/40",
  normal: "bg-sky-400/15 text-sky-600 border-sky-400/40",
  adjust: "bg-amber-400/15 text-amber-700 border-amber-400/40",
};

// ──────────────────────────────────────────────────────────────────
// 1. 끼니 자동 추정 — 업로드 시각 기반
// ──────────────────────────────────────────────────────────────────
export function inferMealSlot(at: Date = new Date()): MealSlot {
  const h = at.getHours();
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 10 && h < 15) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack"; // 22~05, 15~17
}

// ──────────────────────────────────────────────────────────────────
// 2. Rule-based 분석기 — fallback / 기본값. 항상 동작.
//    실제 이미지 판독 없이 시간대 + 키워드(파일명)만으로 보수적 판정.
// ──────────────────────────────────────────────────────────────────
const NEGATIVE_KW = [
  "fried", "pizza", "burger", "cake", "icecream", "chips", "soda", "alcohol",
  "치킨", "피자", "햄버거", "라면", "케이크", "탄산", "튀김", "과자",
];
const POSITIVE_KW = [
  "salad", "chicken_breast", "tofu", "salmon", "broccoli", "oatmeal", "yogurt",
  "샐러드", "닭가슴", "두부", "연어", "브로콜리", "오트밀", "요거트", "나물",
];

function hitKeywords(hay: string, list: readonly string[]): string[] {
  const low = hay.toLowerCase();
  return list.filter((k) => low.includes(k.toLowerCase()));
}

export function analyzeByRules(input: AnalyzeInput): AnalyzeResult {
  const at = input.uploadedAt ?? new Date();
  const mealSlot = input.userSlot ?? inferMealSlot(at);

  const key = (input.storageKey ?? "").toString();
  const positiveHits = hitKeywords(key, POSITIVE_KW);
  const negativeHits = hitKeywords(key, NEGATIVE_KW);
  const isLateNight = at.getHours() >= 22 || at.getHours() < 5;

  let category: MealCategory = "normal";
  const tags: string[] = [];

  if (positiveHits.length >= 2 && negativeHits.length === 0) {
    category = "good";
    tags.push("balanced_guess");
  } else if (negativeHits.length >= 1 && positiveHits.length === 0) {
    category = "adjust";
    tags.push("heavy_guess");
  } else {
    category = "normal";
  }
  if (isLateNight) {
    tags.push("late_night");
    if (category === "good") category = "normal";
  }

  // 피드백 (톤 규칙: 부드럽고 실천 중심)
  let feedback = "";
  if (category === "good") {
    feedback = "균형이 좋아 보여요. 물 한 잔만 더 챙기면 완벽합니다.";
  } else if (category === "normal") {
    feedback = isLateNight
      ? "늦은 시간 식사라면 양만 조금 줄여도 훨씬 좋아져요."
      : "전체적으로 무난합니다. 다음 끼니에 채소 한 종만 더 넣어보세요.";
  } else {
    feedback = "폭식으로 보지 않아도 돼요. 다음 끼니만 가볍게 이어가면 충분합니다.";
  }

  return {
    category,
    feedback,
    detectedTags: tags,
    mealSlot,
    provider: "rules",
  };
}

// ──────────────────────────────────────────────────────────────────
// 3. 공용 엔트리 — 환경에 따라 provider 선택
//    현재는 rules 고정. 추후 edge function 연결 시 llmEndpoint 옵션으로 전환.
// ──────────────────────────────────────────────────────────────────
export interface AnalyzeOptions {
  provider?: "auto" | "rules" | "llm";
  /** llm 호출 시 사용할 endpoint. undefined 면 rules fallback. */
  llmEndpoint?: string;
}

export async function analyzeMealPhoto(
  input: AnalyzeInput,
  opts: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const provider = opts.provider ?? "auto";

  // auto: llmEndpoint 있으면 llm, 없으면 rules
  if ((provider === "auto" || provider === "llm") && opts.llmEndpoint) {
    try {
      const res = await fetch(opts.llmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageSource: input.imageSource,
          uploadedAt: (input.uploadedAt ?? new Date()).toISOString(),
          userSlot: input.userSlot,
        }),
      });
      if (!res.ok) throw new Error(`analyzer http ${res.status}`);
      const json = (await res.json()) as Partial<AnalyzeResult>;
      if (
        json.category &&
        typeof json.feedback === "string" &&
        json.feedback.trim().length > 0
      ) {
        return {
          category: json.category,
          feedback: json.feedback,
          detectedTags: json.detectedTags ?? [],
          mealSlot: json.mealSlot ?? input.userSlot ?? inferMealSlot(input.uploadedAt),
          provider: "llm",
        };
      }
    } catch {
      // LLM 실패 시 rules 로 폴백 — 사용자는 대기 X
    }
  }

  return analyzeByRules(input);
}
