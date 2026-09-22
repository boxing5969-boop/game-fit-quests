/**
 * 153 — QR 수동 출석 (2026-09-22)
 *
 * 왜 있나:
 *   출석은 입구 얼굴 인식(브로제이)으로 자동 기록되지만, 브로제이 서버가 느린 날엔
 *   라이브보드에 이름이 늦게 뜬다. 문은 얼굴 인식으로만 열리므로 회원은 이미 체육관 안에
 *   있다 — 보드 화면의 QR 을 앱에서 찍으면 출석 행이 바로 만들어져 보드에 즉시 올라간다.
 *
 * 흐름:
 *   · 홈 "오늘의 시작" 카드 → 이 페이지 → 카메라로 보드 QR 스캔 → qr_manual_checkin RPC.
 *   · 폰 카메라 앱으로 QR 을 찍어 /qr-checkin?b=..&t=.. 로 들어와도 같은 RPC 를 바로 부른다
 *     (로그인이 살아 있는 브라우저에서만 — 아니면 로그인 화면으로 가고 파라미터는 버려진다).
 *   · 규칙(토큰 5분 회전·하루 1행·XP 0·승급 카운트 인정)은 전부 서버(RPC)에 있다.
 *
 * 예전 QRScannerModal(qr-checkin Edge Function, +10 XP)은 2026-09-02 폐지된 그대로 두고
 * 건드리지 않는다 — 이 페이지는 별도 경로다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, CheckCircle2, QrCode, RotateCcw, Home } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { WORKOUT_TIME_KEY } from "@/hooks/useWorkoutTime";

interface CheckinResult {
  ok: boolean;
  already?: boolean;
  error?: string;
  message?: string;
  branch?: string;
  checked_in_at?: string;
  display_name?: string;
  staff?: boolean;
  method?: string;
  xp_granted?: number;
}

/** 보드 QR 의 URL(https://myboxer153.com/qr-checkin?b=..&t=..)에서 지점·토큰을 꺼낸다. */
function parseBoardQr(raw: string): { b: string; t: string } | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = /^https?:\/\//i.test(s) ? new URL(s) : new URL(s, "https://myboxer153.com");
    const b = url.searchParams.get("b");
    const t = url.searchParams.get("t");
    if (b && t) return { b, t };
  } catch {
    /* URL 이 아니면 보드 QR 이 아니다 */
  }
  return null;
}

const READER_ID = "qr-checkin-reader";
type Phase = "scan" | "submitting" | "done" | "error";

const fmtTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })
    : "";

const QrCheckinPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const deepB = params.get("b");
  const deepT = params.get("t");

  const [phase, setPhase] = useState<Phase>(deepB && deepT ? "submitting" : "scan");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraMsg, setCameraMsg] = useState<string | null>(null);
  // html5-qrcode 는 같은 QR 을 초당 수 회 콜백한다 — state 는 stale closure 라 ref 로 막는다.
  const busyRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    scannerRef.current = null;
    try {
      if (s.getState() === Html5QrcodeScannerState.SCANNING) await s.stop();
    } catch {
      /* 이미 멈춘 경우 */
    }
    try {
      s.clear();
    } catch {
      /* noop */
    }
  }, []);

  const submit = useCallback(
    async (b: string, t: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPhase("submitting");
      setErrorMsg(null);
      await stopScanner();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("qr_manual_checkin", { p_branch: b, p_token: t });
        const res = (data ?? null) as CheckinResult | null;
        if (error || !res) {
          setErrorMsg("네트워크 오류가 발생했어요. 다시 시도해 주세요");
          setPhase("error");
          return;
        }
        if (!res.ok) {
          setErrorMsg(res.message || "출석 처리에 실패했어요");
          setPhase("error");
          return;
        }
        setResult(res);
        setPhase("done");
        // 운동시간 카드(오늘 출석 = 시작)가 바로 켜지도록
        void qc.invalidateQueries({ queryKey: WORKOUT_TIME_KEY });
      } catch {
        setErrorMsg("네트워크 오류가 발생했어요. 다시 시도해 주세요");
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [qc, stopScanner],
  );

  // 딥링크(폰 카메라로 찍은 경우) — 카메라 없이 바로 제출
  useEffect(() => {
    if (deepB && deepT) void submit(deepB, deepT);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 카메라 스캐너 — scan 단계에서만 켠다
  useEffect(() => {
    if (phase !== "scan") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setCameraMsg(null);
      try {
        const scanner = new Html5Qrcode(READER_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (text) => {
            const p = parseBoardQr(text);
            if (!p) {
              setCameraMsg("마이복서153 라이브보드의 QR 이 아니에요");
              return;
            }
            void submit(p.b, p.t);
          },
          () => {
            /* 프레임마다 나는 미인식 오류 — 무시 */
          },
        );
      } catch (err) {
        if (cancelled) return;
        const s = String(err ?? "");
        if (s.includes("Permission") || s.includes("NotAllowedError")) {
          setCameraMsg("카메라 권한이 필요해요. 설정에서 카메라를 허용해 주세요");
        } else if (s.includes("NotFoundError") || s.includes("DevicesNotFoundError")) {
          setCameraMsg("카메라를 찾을 수 없어요");
        } else {
          setCameraMsg("카메라를 사용할 수 없어요");
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void stopScanner();
    };
  }, [phase, submit, stopScanner]);

  const goHome = () => navigate("/home", { replace: true });

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-4 pb-24 pt-4 text-foreground">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={goHome}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground transition-all active:scale-95"
          aria-label="홈으로"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-black leading-tight">QR 출석</h1>
          <p className="text-[11px] text-muted-foreground">라이브보드 화면의 QR 을 찍으면 바로 반영돼요</p>
        </div>
      </div>

      {phase === "scan" && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-card border border-border bg-black">
            <div id={READER_ID} className="w-full" />
          </div>
          <div className="rounded-card border border-border bg-card px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <QrCode className="h-4 w-4 text-primary" /> 보드의 QR 을 네모 안에 맞춰 주세요
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              입구 얼굴 인식은 그대로 하셔야 문이 열려요. QR 은 보드에 이름이 안 뜰 때 쓰는 보조 출석이에요.
            </p>
          </div>
          {cameraMsg && (
            <div className="flex items-start gap-2 rounded-card border border-destructive/30 bg-destructive/10 px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm font-bold text-foreground">{cameraMsg}</p>
            </div>
          )}
        </div>
      )}

      {phase === "submitting" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm font-bold text-muted-foreground">출석 처리 중...</p>
        </div>
      )}

      {phase === "done" && result && (
        <div className="space-y-3">
          <div className="rounded-card border border-border bg-card px-4 py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-3 text-xl font-black">
              {result.already ? "이미 출석되어 있어요" : "출석 완료 🥊"}
            </p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {result.branch}
              {result.checked_in_at ? ` · ${fmtTime(result.checked_in_at)}` : ""}
            </p>
            {!result.already && (result.xp_granted ?? 0) > 0 && (
              <p className="mt-2 text-sm font-black text-primary">XP +{result.xp_granted}</p>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              {result.already
                ? result.method === "qr_manual"
                  ? "오늘 QR 출석이 이미 기록되어 있어요"
                  : "얼굴 인식 출석이 이미 반영되어 있어요"
                : "라이브보드에 곧 이름이 올라가요"}
            </p>
            {result.staff && (
              <p className="mt-1 text-[12px] text-muted-foreground">직원 계정은 라이브보드 회원 목록에는 표시되지 않아요</p>
            )}
          </div>
          <button
            onClick={goHome}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all active:scale-95"
          >
            <Home className="h-4 w-4" /> 홈으로
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-card border border-destructive/30 bg-destructive/10 px-4 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm font-bold text-foreground">{errorMsg}</p>
          </div>
          <button
            onClick={() => {
              setErrorMsg(null);
              setPhase("scan");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> 다시 스캔
          </button>
          <button
            onClick={goHome}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-bold text-foreground transition-all active:scale-95"
          >
            <Home className="h-4 w-4" /> 홈으로
          </button>
        </div>
      )}
    </div>
  );
};

export default QrCheckinPage;
