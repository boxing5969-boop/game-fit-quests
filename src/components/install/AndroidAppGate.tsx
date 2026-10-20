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
import { Bell, ChevronRight, ExternalLink, Play, QrCode, Trophy } from "lucide-react";
import { PLAY_STORE_URL, appIntentUrl, isAndroidBrowser } from "@/lib/androidApp";

const SKIP_KEY = "153app:android-gate-skip";

const readSkip = () => {
  try {
    return window.sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};

/** 앱으로 받으면 좋은 점 — 세 줄 */
const PERKS = [
  { icon: QrCode, title: "QR 출석이 한 번에", sub: "라이브보드 QR 을 찍으면 앱이 바로 열려요" },
  { icon: Bell, title: "수업 · 레벨업 알림", sub: "중요한 소식을 놓치지 않아요" },
  { icon: Trophy, title: "랭킹 · 기록 한눈에", sub: "153 PB · 미션 · 레벨을 빠르게" },
] as const;

/*
 * 2026-10-20 대표님: "QR 찍었을 때 색상이 또렷하지 않고 깨지는 것 같아 — 그라데이션과 일일경영리포트처럼 밝고 쨍하고 또렷하게"
 *   → 빛 번짐(글로우) 로고를 빼고, 위는 민트 그라데이션 머리(흰 글자 · 앱 아이콘), 아래는 흰 카드 + 진한 버튼.
 *     반투명 글자 없이 진한 색만 — 폰 화면에서 또렷하게.
 */
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
    <div className="min-h-screen bg-[#F5F8F7] pb-10 text-[#11161A]">
      {/* 머리 — 민트 그라데이션 */}
      <header
        className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-[#14C99A] via-[#0EA5A0] to-[#0B6B68] px-6 pb-14 text-white shadow-[0_10px_30px_-12px_rgba(11,107,104,0.55)]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 40px)" }}
      >
        <span aria-hidden className="absolute -right-12 -top-14 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-sm text-center">
          <img
            src="/icons/icon-192.png"
            alt="마이복서153 앱 아이콘"
            width={84}
            height={84}
            className="mx-auto h-[84px] w-[84px] rounded-[24px] shadow-[0_12px_24px_-8px_rgba(0,0,0,0.45)] ring-4 ring-white"
          />
          <span className="mt-5 inline-flex items-center rounded-full bg-white px-3 py-1 text-[12.5px] font-black text-[#07784F] shadow-sm">
            NEW · 구글 플레이 출시
          </span>
          <h1 className="mt-3 text-[27px] font-black leading-[1.25] tracking-[-0.01em]">
            마이복서153
            <br />
            이제 앱으로 만나요
          </h1>
          <p className="mt-2 text-[14.5px] font-bold text-white">안드로이드 회원님은 구글 플레이에서 받으세요</p>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 w-full max-w-sm px-5">
        {/* 좋은 점 — 흰 카드 */}
        <ul className="space-y-3.5 rounded-3xl bg-white p-5 shadow-[0_8px_24px_-10px_rgba(17,22,26,0.18)] ring-1 ring-[#DCE3E1]">
          {PERKS.map(({ icon: Icon, title, sub }) => (
            <li key={title} className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14C99A] to-[#0B8F7A] text-white shadow-sm">
                <Icon className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-black leading-snug text-[#11161A]">{title}</span>
                <span className="block text-[12.5px] font-semibold leading-snug text-[#5A666C]">{sub}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* 버튼 */}
        <div className="mt-5 space-y-2.5">
          <a
            href={PLAY_STORE_URL}
            className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#11161A] text-[17px] font-black text-white shadow-[0_10px_20px_-10px_rgba(17,22,26,0.7)] transition-transform active:scale-[0.98]"
          >
            <Play className="h-5 w-5 fill-[#14C99A] text-[#14C99A]" />
            구글 플레이에서 앱 받기
          </a>
          <a
            href={appIntentUrl(here)}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#10B981] bg-white text-[15px] font-black text-[#07784F] transition-transform active:scale-[0.98]"
          >
            <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2.5} />
            앱이 이미 있어요 · 앱으로 열기
          </a>
          <button
            type="button"
            onClick={continueWeb}
            className="flex h-11 w-full items-center justify-center gap-0.5 text-[14px] font-bold text-[#5A666C]"
          >
            지금은 웹에서 계속하기 <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 rounded-2xl bg-[#E9EEEC] px-4 py-3 text-center text-[12.5px] font-semibold leading-relaxed text-[#3F4A50]">
          앱을 받은 뒤 라이브보드 QR 을 다시 찍으면 앱에서 바로 출석돼요
          <br />첫 로그인은 데스크에서 안내해 드려요
        </p>
      </main>
    </div>
  );
};

export default AndroidAppGate;
