/**
 * 153 다이어트 · 식단 사진 칼로리 추정 (Vision).
 *
 * 위치 이유: AI 경로를 하나로 유지하기 위해 별도 함수를 새로 만들지 않고
 *           chat-assistant Edge Function 안에서 action="meal-vision" 으로 분기한다.
 *
 * Provider 체인 (위에서 아래로, 키가 있는 것만 시도):
 *   1) gemini — Google 의 OpenAI 호환 엔드포인트. 한식 인식이 대체로 낫다.
 *   2) groq   — 이미 오삼이 코치가 쓰는 키를 그대로 재사용. 무료 한도.
 *
 * 두 곳 다 OpenAI 호환이라 요청/응답 코드가 하나로 끝난다.
 * 모델명은 자주 단종되므로 환경변수로 덮어쓸 수 있게 해둔다.
 *   GEMINI_VISION_MODEL / GROQ_VISION_MODEL
 */

export type MealVisionItem = {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
};

export type MealVisionResult = {
  items: MealVisionItem[];
  totalKcal: number;
  totalProteinG: number;
  confidence: "low" | "medium" | "high";
  category: "good" | "normal" | "adjust";
  feedback: string;
  detectedTags: string[];
  notFood: boolean;
  provider: string;
};

type VisionProvider = {
  name: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  url: string;
};

const VISION_PROVIDERS: VisionProvider[] = [
  {
    name: "gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_VISION_MODEL",
    defaultModel: "gemini-3.1-flash-lite",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  },
  {
    name: "groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_VISION_MODEL",
    defaultModel: "qwen/qwen3.6-27b",
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
];

// chat-assistant 와 동일한 이유로 키를 위생 처리한다 (헤더 ByteString 오류 방지).
const cleanKey = (raw: string | undefined | null): string =>
  (raw ?? "").replace(/[^\x21-\x7E]/g, "");

const SLOT_LABEL: Record<string, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

/**
 * 한식 1인분 기준값을 프롬프트에 박아둔다.
 * 모델이 "한 그릇" 을 얼마로 볼지 흔들리는 게 오차의 가장 큰 원인이라서,
 * 흔한 메뉴의 기준점을 주면 편차가 눈에 띄게 줄어든다.
 */
const VISION_PROMPT = `너는 한국 음식 사진을 보고 먹은 양과 칼로리를 추정하는 영양 분석기다.
반드시 JSON 객체 하나만 출력한다. 인사·설명·마크다운 코드펜스 금지.

[판단 규칙]
- 사진에 실제로 보이는 음식만 적는다. 안 보이는 재료를 상상해서 넣지 않는다.
- 그릇·숟가락·젓가락·식판을 자로 삼아 양을 가늠한다.
- 한국 기준 1인분 참고값:
  공기밥 1공기 210g 300kcal / 국·찌개 1그릇 250~400ml 120~350kcal
  삼겹살 1인분 200g 660kcal / 닭가슴살 100g 165kcal / 계란 1개 80kcal
  라면 1봉 500kcal / 김밥 1줄 480kcal / 치킨 1조각 200kcal / 피자 1조각 280kcal
  샐러드 1접시(드레싱 포함) 250kcal / 아메리카노 0kcal / 카페라떼 톨 180kcal
  소주 1병 400kcal / 맥주 500ml 200kcal
- 찌개·볶음·무침처럼 조리 기름이 사진에 안 보이는 음식은 조금 넉넉하게 잡는다.
- 여러 명이 나눠 먹는 상차림으로 보이면 1인분 몫만 계산하고 confidence 를 low 로 낮춘다.
- portion 은 "1인분", "반 공기", "2조각" 처럼 한국말로 짧게 쓴다.

[confidence]
high   = 단일 메뉴가 또렷하고 양이 분명 (도시락, 샐러드 한 그릇 등)
medium = 흔한 한식 반상, 양은 대략 가늠 가능
low    = 여러 명 상차림 / 어둡거나 흐림 / 가려짐 / 처음 보는 음식

[category] 다이어트 관점 3단계
good   = 단백질·채소 중심, 튀김과 당류가 적음
normal = 평범한 한 끼
adjust = 튀김·정제탄수·당류·술 위주

[feedback] 한국어 한 문장.
- 부드럽고 실천 중심으로 쓰고, 다음에 할 행동 한 가지를 제안한다.
- "망했다", "안 좋다", "실패", "참으세요" 같은 표현 금지. 죄책감을 주지 않는다.

[출력 형식] 아래 JSON 구조만 출력:
{"items":[{"name":"김치찌개","portion":"1인분","kcal":320,"protein_g":18}],
 "totalKcal":320,"totalProteinG":18,"confidence":"medium","category":"normal",
 "feedback":"단백질이 잘 들어갔어요. 다음 끼니에 채소 한 가지만 더 곁들여보세요.",
 "detectedTags":["stew","protein_ok"],"notFood":false}

음식 사진이 아니면 notFood 를 true 로 하고 items 는 빈 배열, 숫자는 0 으로 둔다.`;

const clampInt = (v: unknown, min: number, max: number, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const asText = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** 모델이 코드펜스나 앞뒤 설명을 붙여도 JSON 만 뽑아낸다. */
function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * 모델 응답을 앱이 믿고 쓸 수 있는 모양으로 정규화한다.
 * 합계는 모델이 준 숫자를 쓰지 않고 items 에서 다시 더한다 —
 * LLM 이 항목은 잘 뽑아도 산수를 틀리는 경우가 흔하다.
 */
function normalize(parsed: unknown, provider: string): MealVisionResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;

  const rawItems = Array.isArray(p.items) ? p.items.slice(0, 20) : [];
  const items: MealVisionItem[] = [];
  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const name = asText(o.name, 40);
    if (!name) continue;
    items.push({
      name,
      portion: asText(o.portion, 20) || "1인분",
      kcal: clampInt(o.kcal, 0, 3000),
      protein_g: clampInt(o.protein_g ?? o.proteinG, 0, 200),
    });
  }

  const notFood = p.notFood === true || (items.length === 0 && p.notFood !== false);

  const totalKcal = clampInt(
    items.reduce((s, i) => s + i.kcal, 0),
    0,
    6000,
  );
  const totalProteinG = clampInt(
    items.reduce((s, i) => s + i.protein_g, 0),
    0,
    400,
  );

  const confidence = ["low", "medium", "high"].includes(String(p.confidence))
    ? (p.confidence as MealVisionResult["confidence"])
    : "low";
  const category = ["good", "normal", "adjust"].includes(String(p.category))
    ? (p.category as MealVisionResult["category"])
    : "normal";

  const detectedTags = Array.isArray(p.detectedTags)
    ? p.detectedTags
        .map((t) => asText(t, 24))
        .filter((t) => t.length > 0)
        .slice(0, 10)
    : [];

  const feedback =
    asText(p.feedback, 200) ||
    (notFood
      ? "음식 사진이 아닌 것 같아요. 접시가 잘 보이게 한 번만 다시 찍어주세요."
      : "잘 기록하셨어요. 다음 끼니에 물 한 잔만 더 챙겨보세요.");

  return {
    items,
    totalKcal,
    totalProteinG,
    confidence,
    category,
    feedback,
    detectedTags,
    notFood,
    provider,
  };
}

async function callProvider(
  provider: VisionProvider,
  apiKey: string,
  imageDataUrl: string,
  userText: string,
  useJsonMode: boolean,
): Promise<Response> {
  const model = Deno.env.get(provider.modelEnv) || provider.defaultModel;
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_tokens: 700,
    // qwen 계열은 추론 모델 — <think> 블록이 섞이면 JSON 파싱이 깨진다.
    // groq 외 provider 가 모르는 파라미터면 400 → 아래 재시도 로직이 처리한다.
    ...(provider.name === "groq" ? { reasoning_effort: "none", reasoning_format: "hidden" } : {}),
    messages: [
      { role: "system", content: VISION_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };
  if (useJsonMode) body.response_format = { type: "json_object" };

  return await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * 사진 한 장을 분석한다. 키가 있는 provider 를 순서대로 시도하고,
 * 전부 실패하면 null 을 돌려준다 (앱은 rules 폴백으로 계속 동작).
 */
export async function analyzeMealImage(input: {
  imageDataUrl: string;
  mealSlot?: string;
  localTime?: string;
}): Promise<{ result: MealVisionResult | null; tried: string[]; lastError: string | null }> {
  const slot = SLOT_LABEL[input.mealSlot ?? ""] ?? "식사";
  const userText = `이 사진은 회원의 ${slot} 식사입니다.${
    input.localTime ? ` 촬영 시각은 ${input.localTime} 입니다.` : ""
  } 위 규칙대로 JSON 만 출력하세요.`;

  const tried: string[] = [];
  let lastError: string | null = null;

  for (const provider of VISION_PROVIDERS) {
    const apiKey = cleanKey(Deno.env.get(provider.keyEnv));
    if (!apiKey) continue;
    tried.push(provider.name);

    for (const useJsonMode of [true, false]) {
      try {
        const res = await callProvider(
          provider,
          apiKey,
          input.imageDataUrl,
          userText,
          useJsonMode,
        );

        if (!res.ok) {
          const errText = (await res.text()).slice(0, 300);
          lastError = `${provider.name} ${res.status}: ${errText}`;
          // json 모드를 안 받아주는 모델이면 한 번 더, 그 외에는 다음 provider 로.
          const jsonModeRejected =
            res.status === 400 &&
            /response_format|json|reasoning/i.test(errText);
          if (useJsonMode && jsonModeRejected) continue;
          break;
        }

        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim().length === 0) {
          lastError = `${provider.name}: empty content`;
          break;
        }

        const normalized = normalize(extractJson(content), provider.name);
        if (normalized) return { result: normalized, tried, lastError };

        lastError = `${provider.name}: unparsable content`;
        break;
      } catch (e) {
        lastError = `${provider.name}: ${e instanceof Error ? e.message : String(e)}`;
        break;
      }
    }
  }

  return { result: null, tried, lastError };
}

export const VISION_PROVIDER_NAMES = VISION_PROVIDERS.map((p) => p.name);
