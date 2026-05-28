/**
 * 마이복서153 — PWA 설치 프롬프트 hook.
 *
 * 플랫폼별 흐름:
 *   · Android Chrome / Edge / Samsung Internet — beforeinstallprompt 이벤트 캐치 → prompt() 직접 호출
 *   · iOS Safari — beforeinstallprompt 미지원. iOS 감지 후 '공유 → 홈 화면에 추가' 안내 노출
 *   · 이미 설치된 standalone 상태 — 둘 다 숨김 (재설치 불필요)
 *   · 데스크탑 Chrome — beforeinstallprompt 지원, 동일 흐름
 *
 * 보호 원칙: 회원 노출 텍스트는 한글, 보호 영역 (payment/Workers/door) 무관.
 */

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallStatus =
  | "loading"        // 초기 — 아직 플랫폼 판단 전
  | "installable"    // Android/Chrome — beforeinstallprompt 잡혀서 prompt() 호출 가능
  | "ios-manual"     // iOS Safari — 수동 안내 필요
  | "installed"      // 이미 standalone 모드로 실행 중
  | "unsupported";   // 그 외 (in-app webview 등) — 버튼 숨김

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ 는 Mac 으로 보고됨 — touch 점수 보조 판정
  const ua = navigator.userAgent;
  const isClassicIos = /iPhone|iPad|iPod/.test(ua);
  const isIpadOs =
    /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
  return isClassicIos || isIpadOs;
}

function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  // Safari 만 — Chrome iOS (CriOS), Firefox iOS (FxiOS), in-app browser 등 제외
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Line|KAKAOTALK|FBAN|FBAV|Instagram/.test(ua);
  return isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // matchMedia: 표준 — Chrome, Edge, Safari (16.4+)
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS legacy
  const nav = navigator as unknown as { standalone?: boolean };
  return nav.standalone === true;
}

export function useInstallPrompt() {
  const [status, setStatus] = useState<InstallStatus>("loading");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 이미 설치된 상태면 prompt 잡을 필요 없음
    if (isStandalone()) {
      setStatus("installed");
      return;
    }

    let cancelled = false;

    const onBefore = (e: Event) => {
      // 기본 mini-infobar 차단 — 우리 버튼으로만 트리거
      e.preventDefault();
      if (cancelled) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setStatus("installable");
    };

    const onInstalled = () => {
      setStatus("installed");
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari 는 beforeinstallprompt 가 안 옴 — 즉시 분류
    // (다른 브라우저는 잠시 기다렸다가 이벤트 안 오면 unsupported 로 fallback)
    if (isIosSafari()) {
      setStatus("ios-manual");
    } else {
      // 1.2초 후에도 beforeinstallprompt 가 안 오면 unsupported (in-app webview 등)
      const t = window.setTimeout(() => {
        if (cancelled) return;
        setStatus((prev) => (prev === "loading" ? "unsupported" : prev));
      }, 1200);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBefore);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** Android/Chrome 흐름 — 사용자에게 prompt 표시. iOS 에서는 noop. */
  const promptInstall = useCallback(async () => {
    if (!deferred) return { outcome: "dismissed" as const };
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        // appinstalled 이벤트가 별도로 와서 'installed' 로 set
        setDeferred(null);
      }
      return choice;
    } catch {
      return { outcome: "dismissed" as const };
    }
  }, [deferred]);

  return {
    status,
    promptInstall,
    isIos: isIos(),
  };
}
