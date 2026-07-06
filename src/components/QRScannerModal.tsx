import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QRScannerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: {
    xp_granted: number;
    is_duplicate: boolean;
    display_name: string;
    league: string;
    level: number;
  }) => void;
}

/**
 * Parse scanned QR text to extract a token.
 * Supports:
 *  - JSON: {"token":"..."}
 *  - URL:  /checkin?token=...&branch=...  or full https://...
 *  - Raw string (fallback)
 */
function extractToken(raw: string): { token: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { token: null, error: "빈 QR 코드입니다" };

  // 1. Try JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.token && typeof parsed.token === "string") {
      return { token: parsed.token };
    }
  } catch {
    // not JSON, continue
  }

  // 2. Try URL with query params
  try {
    let url: URL;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith("/")) {
      url = new URL(trimmed, "https://placeholder.com");
    } else {
      // Could be a raw token string
      if (trimmed.length >= 16 && /^[A-Za-z0-9]+$/.test(trimmed)) {
        return { token: trimmed };
      }
      return { token: null, error: "유효하지 않은 QR입니다" };
    }
    const token = url.searchParams.get("token");
    if (token) return { token };
  } catch {
    // not a URL
  }

  // 3. Raw alphanumeric string (token-like)
  if (trimmed.length >= 16 && /^[A-Za-z0-9]+$/.test(trimmed)) {
    return { token: trimmed };
  }

  return { token: null, error: "유효하지 않은 QR입니다" };
}

const ERROR_MESSAGES: Record<string, string> = {
  NO_AUTH: "로그인이 필요합니다",
  INVALID_USER: "유효하지 않은 사용자입니다",
  NO_TOKEN: "토큰이 없습니다",
  INVALID_QR: "유효하지 않은 QR입니다",
  INACTIVE_QR: "만료된 QR입니다. 새 QR을 스캔해주세요",
  EXPIRED_QR: "만료된 QR입니다. 새 QR을 스캔해주세요",
  NO_PROFILE: "프로필을 찾을 수 없습니다",
  WRONG_BRANCH: "다른 지점의 QR입니다",
  INSERT_FAILED: "체크인 처리 중 오류가 발생했습니다",
  SERVER_ERROR: "잠시 후 다시 시도해주세요",
};

const QRScannerModal = ({ open, onClose, onSuccess }: QRScannerModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  // html5-qrcode 는 같은 QR 을 초당 수 회 콜백하는데, state(processing)는
  // 콜백 등록 시점의 stale closure 라 가드가 무력화됨 → ref 로 동기 가드.
  const processingRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }, []);

  const handleScan = useCallback(async (decodedText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    await stopScanner();

    try {
      // Parse QR data
      const { token, error: parseError } = extractToken(decodedText);
      if (!token) {
        setError(parseError || "유효하지 않은 QR입니다");
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      console.log("[QR Scanner] Token extracted, calling qr-checkin...");

      const { data, error: fnError } = await supabase.functions.invoke("qr-checkin", {
        body: { token },
      });

      if (fnError) {
        console.error("[QR Scanner] Function invoke error:", fnError);
        setError("네트워크 오류가 발생했습니다");
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      if (data?.error) {
        const code = data?.code as string;
        const message = (code && ERROR_MESSAGES[code]) || data.error;
        console.error("[QR Scanner] Server error:", code, data.error);
        setError(message);
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      console.log("[QR Scanner] Checkin success:", data);
      onSuccess(data);
    } catch (e) {
      console.error("[QR Scanner] Unexpected error:", e);
      setError("네트워크 오류가 발생했습니다");
      processingRef.current = false;
      setProcessing(false);
    }
  }, [stopScanner, onSuccess]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setError(null);
      processingRef.current = false;
      setProcessing(false);
      setScanning(false);
      return;
    }

    const startScanner = async () => {
      setError(null);
      setScanning(true);

      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleScan,
          () => {} // ignore errors during scanning
        );
      } catch (err: any) {
        const errStr = err?.toString() || "";
        if (errStr.includes("Permission") || errStr.includes("NotAllowedError")) {
          setError("카메라 권한이 필요합니다. 설정에서 카메라 권한을 허용해주세요.");
        } else if (errStr.includes("NotFoundError") || errStr.includes("DevicesNotFoundError")) {
          setError("카메라를 찾을 수 없습니다");
        } else {
          setError("카메라를 사용할 수 없습니다");
        }
        setScanning(false);
      }
    };

    // Small delay to allow modal animation
    const timer = setTimeout(startScanner, 300);
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [open]); // eslint-disable-line

  if (!open) return null;

  const retryScanner = () => {
    setError(null);
    processingRef.current = false;
    setProcessing(false);
    // Re-open scanner by triggering effect
    stopScanner().then(() => {
      const startScanner = async () => {
        setScanning(true);
        try {
          const scanner = new Html5Qrcode("qr-reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
            handleScan,
            () => {}
          );
        } catch {
          setError("카메라를 사용할 수 없습니다");
          setScanning(false);
        }
      };
      setTimeout(startScanner, 200);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <div className="relative w-full max-w-md mx-4">
        {/* Close button */}
        <button
          onClick={() => { stopScanner(); onClose(); }}
          className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-all active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <Camera className="mx-auto mb-2 h-8 w-8 text-white/80" />
          <h2 className="text-xl font-bold text-white">체육관 QR 스캔</h2>
          <p className="mt-1 text-sm text-white/60">지점에 설치된 QR 코드를 스캔하세요</p>
        </div>

        {/* Scanner area */}
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <div id="qr-reader" ref={containerRef} className="w-full" />
          {!scanning && !error && (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl bg-destructive/20 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-white">{error}</p>
                <button
                  onClick={retryScanner}
                  className="mt-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing */}
        {processing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-white">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span className="text-sm">체크인 처리 중...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScannerModal;
