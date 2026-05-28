/**
 * 마이복서153 — '앱으로 설치' 버튼 + iOS 안내 모달.
 *
 * 로그인 화면 / 홈 등 어디에든 mount 하면 자동으로 플랫폼 판단:
 *   · Android Chrome  — beforeinstallprompt 잡힌 후 버튼 노출 → 클릭 시 native prompt
 *   · iOS Safari      — 자동으로 안내 모달 노출 (공유 → 홈 화면에 추가)
 *   · 이미 설치됨      — 버튼 숨김 (반복 권유 방지)
 *   · in-app webview  — 숨김 (인스타/카톡 in-app 등에서 설치 불가)
 *
 * 회원 노출 텍스트 한국어. 153 브랜드 — 민트 포인트 + 차콜 베이스. 보호 영역 무관.
 */

import { useEffect, useState } from "react";
import { Download, Smartphone, Share, Plus, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const IOS_DISMISS_KEY = "myboxer.installPrompt.ios.dismissedAt";
const IOS_REPROMPT_DAYS = 14;

interface Props {
  /** LoginPage 처럼 sticky 위치가 아닌 인라인 버튼 모드. 기본 false (sticky). */
  inline?: boolean;
  /** 라벨 커스텀 — 기본 '앱으로 설치하기' */
  label?: string;
}

const InstallAppButton = ({ inline = false, label = "앱으로 설치하기" }: Props) => {
  const { status, promptInstall, isIos } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  // iOS 자동 안내 — 14일 dismiss 쿨다운
  useEffect(() => {
    if (status !== "ios-manual") return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(IOS_DISMISS_KEY);
      if (raw) {
        const last = Number(raw);
        if (Number.isFinite(last)) {
          const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
          if (days < IOS_REPROMPT_DAYS) return; // 아직 쿨다운 중
        }
      }
    } catch {
      /* localStorage 막혀도 안내는 띄움 */
    }
    // 약간 지연 — 로그인 페이지 렌더 후 자연스럽게
    const t = window.setTimeout(() => setIosOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [status]);

  const dismissIos = () => {
    setIosOpen(false);
    try {
      window.localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  // 노출 분기
  if (status === "loading" || status === "installed" || status === "unsupported") {
    return null;
  }

  const handleClick = async () => {
    if (status === "installable") {
      await promptInstall();
      return;
    }
    if (status === "ios-manual") {
      setIosOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="앱으로 설치하기"
        className={
          inline
            ? "inline-flex items-center justify-center gap-2 rounded-pill border border-primary/50 bg-primary/10 px-4 py-2 text-[12.5px] font-bold text-primary transition-all active:scale-95 hover:bg-primary/20"
            : "flex w-full items-center justify-center gap-2 rounded-card bg-gradient-to-r from-primary to-primary/85 px-4 py-3 text-[13.5px] font-bold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(11,15,23,0.6)] transition-all active:scale-[0.98] hover:brightness-110"
        }
      >
        <Download className="h-4 w-4" />
        {label}
      </button>

      {/* iOS 안내 모달 */}
      {iosOpen && isIos && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="iOS 앱 설치 안내"
          className="fixed inset-0 z-[200] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={dismissIos}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    iPhone · iPad
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    홈 화면에 마이복서153 추가
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    Safari 의 공유 메뉴에서 두 번만 누르면 앱처럼 사용할 수 있어요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissIos}
                aria-label="닫기"
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 본문 — 3 단계 */}
            <ol className="space-y-3 px-5 py-4">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-black text-primary">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-foreground">
                    Safari 하단의 <span className="inline-flex items-center"><Share className="mx-1 h-3.5 w-3.5 text-primary" /></span> 공유 아이콘 누르기
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    Chrome / Firefox / 카카오톡 안의 브라우저로 보고 있다면, 먼저 화면 상단 메뉴에서 <strong>"Safari로 열기"</strong> 를 눌러주세요.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-black text-primary">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1 text-[13px] font-bold text-foreground">
                    공유 메뉴에서
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[12px]">
                      <Plus className="h-3.5 w-3.5" />
                      홈 화면에 추가
                    </span>
                    선택
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    목록을 아래로 내리면 보여요.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-black text-primary">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-foreground">
                    우측 상단의 <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12px]">추가</span> 누르기
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    홈 화면에 마이복서153 아이콘이 생기고, 풀스크린 앱처럼 열려요.
                  </p>
                </div>
              </li>
            </ol>

            <div className="border-t border-border bg-card px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <button
                type="button"
                onClick={dismissIos}
                className="w-full rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
              >
                알겠어요
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
