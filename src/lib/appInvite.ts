/**
 * 앱 초대 공유 (2026-10-18 대표님: "가입안한회원도 … 앱에 가입할수있도록 앱 공유 링크 초대 보낼수있도록").
 *
 * 공유 창(카톡·문자 등)을 바로 띄운다 — 브라우저가 '누른 순간'에만 열어 주므로 서버 기록을 기다리지 않는다.
 * 공유 창이 없으면 문구+링크를 복사한다. 초대받은 회원은 카카오로 시작하기 → 체육관에 등록한 전화번호로 기존 계정과 합쳐진다.
 *
 * 2026-10-19 대표님 "4번 진행" — 링크에 초대한 사람의 코드(?inv=)를 넣는다.
 *   초대받은 회원이 이 링크로 들어와 처음 로그인하면 그 코드 주인에게만 챔피언 머니 1,000 (claim_invite_reward_v2).
 *   링크로 들어온 순간 코드를 이 기기에 남긴다 — 카카오 로그인으로 주소가 바뀌어도 쓰게 (captureInviteCodeFromUrl).
 */
export type InviteShareResult = "shared" | "copied" | "cancelled" | "failed";

/** 초대 링크는 늘 공식 주소로 — 다른 주소(미리보기 등)에서 보내도 받는 사람이 같은 앱으로 들어오게 */
const APP_ORIGIN = "https://myboxer153.com";
export const INVITE_PARAM = "inv";
const INVITE_STORE = "153_invite_code";
/** 링크를 누르고 30일 안에 처음 로그인하면 인정 */
const INVITE_TTL_MS = 30 * 24 * 3600 * 1000;
const INVITE_CODE_RE = /^[A-Za-z0-9]{6,12}$/;

export const inviteLink = (code: string | null | undefined): string =>
  code ? `${APP_ORIGIN}/?${INVITE_PARAM}=${encodeURIComponent(code)}` : `${APP_ORIGIN}/`;

/** 초대 링크로 들어왔으면 코드를 이 기기에 남긴다 — 앱을 켤 때 한 번 (main.tsx) */
export function captureInviteCodeFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get(INVITE_PARAM);
    if (!code || !INVITE_CODE_RE.test(code)) return;
    window.localStorage.setItem(INVITE_STORE, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
  } catch {
    /* 저장을 못 하면 보상만 못 받는다 — 앱은 그대로 */
  }
}

/** 남겨 둔 초대 코드 (30일 지나면 없음) */
export function readStoredInviteCode(): string | null {
  try {
    const raw = window.localStorage.getItem(INVITE_STORE);
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof v.code !== "string" || !INVITE_CODE_RE.test(v.code)) return null;
    if (typeof v.at === "number" && Date.now() - v.at > INVITE_TTL_MS) return null;
    return v.code;
  } catch {
    return null;
  }
}

export function clearStoredInviteCode(): void {
  try {
    window.localStorage.removeItem(INVITE_STORE);
  } catch {
    /* noop */
  }
}

/**
 * 설정 › 마이복서153 공유하기 (2026-11-12 대표님 「마이복서 153앱 공유기능 만들어줘 설정에」) — components/share/AppShareCard.
 *
 * 받는 사람을 고르지 않는 앱 링크(체육관 동료 · 가족 · 친구 누구에게나). 링크에는 내 초대 코드(?inv=)를 같이 넣는다 —
 * 운동 짝꿍 › 초대로 미리 초대해 둔 회원이 이 링크로 들어오면 그 보상 규칙 그대로(claim_invite_reward_v2), 그 밖의 사람에게는 보상이 없다.
 * 그래서 이 소개 글에는 보상 말을 넣지 않는다. 글은 153 브랜드 기준(서명 「153 건강과 행복. 153복싱짐」 · 긴 줄표 없음)을 따른다.
 */
export const APP_SHARE_TITLE = "마이복서153";

/** 공유 창 · 복사에 같이 가는 소개 글 (링크는 따로 붙는다) */
export const appShareText = (): string =>
  [
    "153복싱짐 앱 '마이복서153'을 소개해요.",
    "레벨 · 출석 · 153 PB 기록이 한 앱에 쌓여요.",
    "",
    "회원이라면: 링크를 열고 '카카오로 시작하기' (체육관에 등록한 전화번호로 내 기록이 이어져요)",
    "처음이라면: 로그인 화면의 '신규 회원 가입 신청'",
    "",
    "153 건강과 행복. 153복싱짐",
  ].join("\n");

/** 화면에 보여 줄 링크 글 — https:// 를 뺀 것 */
export const appLinkLabel = (code: string | null | undefined): string => inviteLink(code).replace(/^https?:\/\//, "");

/** 글 복사 — 클립보드가 없거나 막힌 화면(일부 앱 안 브라우저)은 숨긴 칸으로 한 번 더 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 방법으로
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  try {
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/**
 * 휴대폰 공유 창(카톡 · 문자 · 메일 …)을 바로 띄운다 — 브라우저는 '누른 순간'에만 열어 주므로 이 함수 앞에서 기다리지 않는다.
 * 공유 창이 없으면(일부 컴퓨터 · 앱 안 브라우저) 소개 글 + 링크를 복사한다.
 */
export async function shareAppLink(code?: string | null): Promise<InviteShareResult> {
  const url = inviteLink(code);
  const text = appShareText();
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: APP_SHARE_TITLE, text, url });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    // 공유 창을 못 열면 복사로
  }
  return (await copyText(`${text}\n${url}`)) ? "copied" : "failed";
}

/** 링크만 복사 */
export const copyAppLink = (code?: string | null): Promise<boolean> => copyText(inviteLink(code));

export async function shareAppInvite(inviteeName: string, inviterName: string, code?: string | null): Promise<InviteShareResult> {
  const url = inviteLink(code);
  const text =
    `${inviteeName}님, 153복싱짐 앱 '마이복서153'에 초대해요!\n` +
    `출석·레벨·랭킹이 벌써 쌓여 있어요.\n` +
    `① 링크 열기 ② '카카오로 시작하기' ③ 체육관에 등록한 전화번호 넣기 — 끝!\n` +
    `— ${inviterName}`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: "마이복서153 초대", text, url });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    // 공유 창을 못 열면 복사로
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
