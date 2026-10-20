/**
 * 🤖 안드로이드 — QR 을 폰 카메라로 찍었는데 앱이 아니라 브라우저로 열렸을 때 (2026-10-20 대표님:
 *   "마이복서153 앱 구글 스토어에 출시되었어. 안드로이드 회원님들은 라이브보드에 QR 찍으면 앱스토어에서 다운받을 수 있게").
 *
 *   앱이 깔린 폰은 앱 링크로 앱이 바로 열려서 이 화면을 보지 않는다(앱 안 = 전체 화면 → 그대로 통과).
 *   브라우저로 열렸으면: ① 구글 플레이에서 앱 받기 ② 이미 있으면 앱으로 열기(같은 QR 주소 그대로) ③ 웹에서 계속.
 *   '웹에서 계속'을 고르면 이 탭에서는 다시 묻지 않는다. 아이폰 · 컴퓨터는 그대로 통과.
 */
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, Download, ExternalLink } from "lucide-react";
import MyBoxerWordmark from "@/components/brand/MyBoxerWordmark";
import { PLAY_STORE_URL, appIntentUrl, isAndroidBrowser } from "@/lib/androidApp";

const SKIP_KEY = "153app:android-gate-skip";

const readSkip = () => {
  try {
    return window.sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};

const AndroidAppGate = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [show, setShow] = useState(() => isAndroidBrowser() && !readSkip());
  if (!show) return <>{children}</>;

  const here = `https://myboxer153.com${location.pathname}${location.search}`;
  const continueWeb = () => {
    try {
      window.sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* 저장이 막혀도 이번엔 넘어간다 */
    }
    setShow(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-foreground">
      <MyBoxerWordmark size="md" align="center" className="mx-auto" />
      <h1 className="mt-6 text-center text-[20px] font-black leading-snug">
        마이복서153 앱이
        <br />
        구글 플레이에 나왔어요
      </h1>
      <p className="mt-2 text-center text-[13.5px] leading-relaxed text-muted-foreground">
        앱으로 받으면 QR 출석 · 알림 · 랭킹을 더 빠르게 쓸 수 있어요
      </p>

      <div className="mt-6 w-full max-w-sm space-y-2.5">
        <a
          href={PLAY_STORE_URL}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-[16px] font-black text-background shadow-elev-1 transition-transform active:scale-[0.98]"
        >
          <Download className="h-5 w-5" /> 구글 플레이에서 앱 받기
        </a>
        <a
          href={appIntentUrl(here)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-card text-[14px] font-bold text-foreground ring-1 ring-border transition-transform active:scale-[0.98]"
        >
          <ExternalLink className="h-4 w-4" /> 앱이 이미 있어요 — 앱으로 열기
        </a>
        <button
          type="button"
          onClick={continueWeb}
          className="flex h-11 w-full items-center justify-center gap-0.5 text-[13px] font-semibold text-muted-foreground"
        >
          지금은 웹에서 계속하기 <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-4 max-w-sm text-center text-[11.5px] leading-relaxed text-muted-foreground">
        앱을 받은 뒤 라이브보드 QR 을 다시 찍으면 앱에서 바로 출석돼요 · 첫 로그인은 데스크에서 안내해 드려요
      </p>
    </div>
  );
};

export default AndroidAppGate;
