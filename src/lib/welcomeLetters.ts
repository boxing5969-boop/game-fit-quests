/**
 * 웰컴 편지 — 회원용 · 코치님용 (2026-09-23)
 *
 * 대표님 지시: "웰컴 편지는 회원님들에게 보내는 편지, 코치님이 회원가입하면 코치님에게 보내는 편지로".
 *   · 회원 — 온보딩·튜토리얼을 마치면 1회: "첫 라운드를 앞둔 {이름}님께"
 *   · 코치님(지도진 is_staff, 코치·관장 역할) — 처음 들어오면 1회: "153의 링을 함께 지킬 {이름}님께"
 *   · 전체관리자·관리자 계정 — 자동 편지 없음(설정 화면 미리보기로만 본다).
 *     예전엔 관리자 계정도 회원 편지를 받아 닉네임이 그대로 들어가 "…개발자님께" 처럼 보였다.
 * 문구는 설정 화면(관리자)에서 고친다 — app_settings.welcome_letters 에 저장하고, 비어 있는 칸은 아래 기본 문구를 쓴다.
 * {이름} 자리에 회원은 닉네임(없으면 이름), 코치님은 "이름 직함"(예: 홍길동 코치)이 들어간다.
 * 저장 형식은 서버 set_app_setting 이 검사한다(대상 member·coach, 항목 title·body·sign·cta, 글자 수 제한).
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type LetterAudience = "member" | "coach";
export interface LetterTemplate {
  title: string;
  body: string;
  sign: string;
  cta: string;
}
export type WelcomeLetters = Partial<Record<LetterAudience, Partial<LetterTemplate>>>;

export const NAME_TOKEN = "{이름}";
/** 서버 검사와 같은 글자 수 제한 */
export const LETTER_LIMITS: Record<keyof LetterTemplate, number> = { title: 80, body: 3000, sign: 80, cta: 30 };
export const LETTER_AUDIENCE_LABEL: Record<LetterAudience, string> = { member: "회원님께", coach: "코치님께" };

export const DEFAULT_LETTERS: Record<LetterAudience, LetterTemplate> = {
  member: {
    title: "첫 라운드를 앞둔\n{이름}님께",
    body: `지금, 더 단단해지고 싶은 마음이 있나요?
누군가는 그걸 목표라 부르고,
누군가는 그냥 '오기'라 부르죠.

뭐라 부르든,
링 위에 서기로 마음먹은 건
그 자체로 멋진 일입니다.

복싱은 상대를 이기는 운동처럼 보이지만,
사실은 매일의 나와 겨루는 일이에요.
어제보다 1초 더 버틴 스텝,
한 번 더 뻗은 잽,
그만두고 싶던 순간을 넘긴 오늘.

그 작은 승리들이 조용히 쌓이면
어느새 거울 앞에서
조금 다른 나를 마주하게 됩니다.

화이트 리그, 레벨 1.
{이름}님의 153랭크업은 지금부터예요.

빠르지 않아도 괜찮아요.
오늘 한 걸음이면 충분합니다.

153복싱짐에서
{이름}님만의 단단한 날들을 만들어 가시길.`,
    sign: "— 153 일동",
    cta: "오늘, 한 라운드 시작 🥊",
  },
  coach: {
    title: "153의 링을 함께 지킬\n{이름}님께",
    body: `마이복서153에 오신 것을 환영합니다.

회원님이 처음 글러브를 끼던 날의 떨림,
숨이 차서 멈추고 싶던 순간,
그리고 그걸 넘어선 오늘까지.
그 모든 라운드 곁에는
늘 코치님이 계셨습니다.

이 앱은 코치님의 눈과 손을 대신하려는 게 아니라,
코치님이 보고 있는 성장을
회원님이 스스로 볼 수 있게 돕는 도구예요.

출석과 레벨업은 자동으로 쌓이고,
승급 심사와 미션 확인,
그리고 응원 한마디는 코치님의 몫입니다.

앱에서 코치님은 챔피언 · Lv.77 로 표시됩니다.
회원님들이 바라보며 올라갈 자리예요.

코치님의 한마디가
회원님의 다음 라운드를 만듭니다.
153의 링을 함께 지켜 주셔서 고맙습니다.`,
    sign: "— 153 일동",
    cta: "코치로 시작하기 🥊",
  },
};

export const WELCOME_LETTERS_KEY = ["app-settings", "welcome_letters"] as const;

/** 저장된 편지 문구 (없으면 빈 객체 → 기본 문구). app_settings 는 로그인 회원 누구나 읽을 수 있다. */
export async function fetchWelcomeLetters(): Promise<WelcomeLetters> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("app_settings").select("value").eq("key", "welcome_letters").maybeSingle();
  if (error) throw new Error(translateError(error));
  const v = (data as { value?: unknown } | null)?.value;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as WelcomeLetters) : {};
}

/** 관리자만 — 서버(set_app_setting)가 권한·형식·글자 수를 검사한다 */
export async function saveWelcomeLetters(value: WelcomeLetters): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("set_app_setting", { _key: "welcome_letters", _value: value });
  if (error) throw new Error(translateError(error));
}

/** 저장본 + 기본 문구 — 비어 있는 칸은 기본 문구 */
export function resolveLetter(saved: WelcomeLetters | null | undefined, aud: LetterAudience): LetterTemplate {
  const d = DEFAULT_LETTERS[aud];
  const s = saved?.[aud] ?? {};
  const pick = (k: keyof LetterTemplate): string => {
    const v = s[k];
    return typeof v === "string" && v.trim() ? v : d[k];
  };
  return { title: pick("title"), body: pick("body"), sign: pick("sign"), cta: pick("cta") };
}

/** {이름} 자리에 이름 넣기 */
export const fillName = (text: string, name: string): string => text.split(NAME_TOKEN).join(name);

/** 화면에 그릴 편지 한 통 — 이름까지 채워진 최종 문구 */
export interface LetterContent {
  eyebrow: string;
  title: string;
  body: string;
  sign: string;
  cta: string;
}

/** 편지 서식(관리자가 고친 문구 또는 기본 문구) + 이름 → 화면용 편지 */
export const buildLetter = (aud: LetterAudience, t: LetterTemplate, name: string): LetterContent => ({
  eyebrow: aud === "coach" ? "Coach Letter" : "Welcome Letter",
  title: fillName(t.title, name),
  body: fillName(t.body, name),
  sign: t.sign,
  cta: t.cta,
});
