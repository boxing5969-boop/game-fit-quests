// 지문·얼굴 로그인 (패스키 / WebAuthn)
//
// 왜 이렇게 감싸는가:
//  1) 패스키는 **도메인에 묶인다.** Supabase 의 Relying Party ID 가 myboxer153.com 이므로
//     옛 주소(game-fit-quests.pages.dev)에서는 등록도 로그인도 반드시 실패한다.
//     → 도메인이 맞을 때만 버튼을 보여준다(되지도 않는 버튼을 띄우지 않는다).
//  2) 기기가 지문·얼굴을 지원하지 않으면 역시 숨긴다.
//  3) supabase-js 의 패스키 API 는 실험 단계라 타입이 흔들린다. 필요한 부분만 여기서
//     좁게 선언해두면, 라이브러리가 바뀌어도 이 파일 하나만 고치면 된다.
import { supabase } from "@/integrations/supabase/client";

const PASSKEY_DOMAIN = "myboxer153.com";

type PasskeyResult = { error: { message: string } | null };
type PasskeyApi = {
  registerPasskey?: (opts?: { friendlyName?: string }) => Promise<PasskeyResult>;
  signInWithPasskey?: () => Promise<PasskeyResult>;
};
const api = (): PasskeyApi => supabase.auth as unknown as PasskeyApi;

/** 이 주소에서 패스키가 동작하는가 (RP ID 와 도메인이 맞는가). */
export const isPasskeyDomain = (): boolean => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === PASSKEY_DOMAIN || h.endsWith(`.${PASSKEY_DOMAIN}`);
};

/** 이 기기·브라우저가 지문/얼굴 인증을 지원하는가. */
export const hasBiometrics = async (): Promise<boolean> => {
  try {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> };
    };
    const fn = w.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    if (!fn) return false;
    return await fn.call(w.PublicKeyCredential);
  } catch {
    return false;
  }
};

/** 화면에 지문·얼굴 버튼을 띄울지 — 도메인과 기기가 모두 맞아야 한다. */
export const canUsePasskey = async (): Promise<boolean> =>
  isPasskeyDomain() && (await hasBiometrics());

/** WebAuthn 오류 코드를 회원이 읽을 수 있는 말로 바꾼다. */
const readable = (raw: string): string => {
  const m = raw || "";
  if (/NotAllowed|timed out|aborted/i.test(m)) return "취소되었거나 시간이 지났어요. 다시 시도해주세요.";
  if (/InvalidState|already registered|exists/i.test(m)) return "이 기기는 이미 등록되어 있어요.";
  if (/SecurityError|origin|rp/i.test(m)) return "이 주소에서는 사용할 수 없어요. myboxer153.com 으로 접속해주세요.";
  if (/NotSupported/i.test(m)) return "이 기기에서는 지문·얼굴 로그인을 지원하지 않아요.";
  if (/no.*credential|not found/i.test(m)) return "등록된 지문·얼굴이 없어요. 로그인 후 설정에서 먼저 등록해주세요.";
  return "잠시 문제가 있었어요. 다시 시도해주세요.";
};

/** 이 기기를 지문·얼굴로 등록. 성공하면 null, 실패하면 안내 문구를 돌려준다. */
export const registerPasskey = async (friendlyName: string): Promise<string | null> => {
  const fn = api().registerPasskey;
  if (!fn) return "앱을 새로고침한 뒤 다시 시도해주세요.";
  try {
    const { error } = await fn({ friendlyName });
    return error ? readable(error.message) : null;
  } catch (e) {
    return readable(e instanceof Error ? e.message : "");
  }
};

/** 지문·얼굴로 로그인. 성공하면 null, 실패하면 안내 문구를 돌려준다. */
export const signInWithPasskey = async (): Promise<string | null> => {
  const fn = api().signInWithPasskey;
  if (!fn) return "앱을 새로고침한 뒤 다시 시도해주세요.";
  try {
    const { error } = await fn();
    return error ? readable(error.message) : null;
  } catch (e) {
    return readable(e instanceof Error ? e.message : "");
  }
};
