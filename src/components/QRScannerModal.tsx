import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const QRScannerModal = ({ open, onClose, onSuccess }: QRScannerModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
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
    if (processing) return;
    setProcessing(true);
    await stopScanner();

    try {
      // Parse QR data - expects JSON with token
      let token: string;
      try {
        const data = JSON.parse(decodedText);
        token = data.token;
      } catch {
        token = decodedText; // fallback: raw token string
      }

      const { data, error: fnError } = await supabase.functions.invoke("qr-checkin", {
        body: { token },
      });

      if (fnError || data?.error) {
        setError(data?.error || "체크인 처리 중 오류가 발생했습니다");
        setProcessing(false);
        return;
      }

      onSuccess(data);
    } catch {
      setError("네트워크 연결을 확인해주세요");
      setProcessing(false);
    }
  }, [processing, stopScanner, onSuccess]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setError(null);
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
        if (err?.toString().includes("Permission")) {
          setError("카메라 접근 권한이 필요합니다. 설정에서 카메라 권한을 허용해주세요.");
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
                  onClick={() => { setError(null); setProcessing(false); window.location.reload(); }}
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
