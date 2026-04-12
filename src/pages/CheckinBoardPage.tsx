import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { QrCode, Monitor, RefreshCw, Trash2, ChevronLeft, Settings } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { formatRank } from "@/lib/rankLabels";

interface AttendanceLog {
  id: string;
  user_id: string;
  display_name_snapshot: string;
  league_snapshot: string;
  level_snapshot: number;
  checked_in_at: string;
  xp_granted: number;
  is_duplicate: boolean;
}

const CheckinBoardPage = () => {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const branchName = profile?.branch_name || "";
  const isSuperAdmin = role === "super_admin" || role === "admin";

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [showQrFull, setShowQrFull] = useState(false);
  const [displayMode, setDisplayMode] = useState<string>("nickname");
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const autoRefreshRef = useRef<ReturnType<typeof setInterval>>();

  // Load settings
  useEffect(() => {
    if (!branchName) return;
    supabase
      .from("branch_display_settings")
      .select("display_name_mode")
      .eq("branch_name", branchName)
      .single()
      .then(({ data }) => {
        if (data) setDisplayMode(data.display_name_mode);
      });
  }, [branchName]);

  // Load today's logs
  const loadLogs = useCallback(async () => {
    if (!branchName) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("branch_name", branchName)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false })
      .limit(200);
    if (data) setLogs(data as AttendanceLog[]);
  }, [branchName]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Generate QR token
  const refreshToken = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-token-refresh");
      if (error || data?.error) {
        toast.error(data?.error || "QR 생성 실패");
        return;
      }
      setQrToken(data.token);
      setQrExpiry(new Date(data.expires_at));
      setTimeLeft(30);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!qrExpiry) return;
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((qrExpiry.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [qrExpiry]);

  // Auto-refresh QR every 25 seconds
  useEffect(() => {
    if (!qrToken) return;
    autoRefreshRef.current = setInterval(() => {
      refreshToken();
    }, 25000);
    return () => clearInterval(autoRefreshRef.current);
  }, [qrToken, refreshToken]);

  // Save display mode
  const updateDisplayMode = async (mode: string) => {
    setDisplayMode(mode);
    await supabase
      .from("branch_display_settings")
      .upsert({ branch_name: branchName, display_name_mode: mode }, { onConflict: "branch_name" });
    toast.success("표시 설정 저장됨");
  };

  // Cancel checkin
  const cancelCheckin = async (logId: string) => {
    const { error } = await supabase
      .from("attendance_logs")
      .delete()
      .eq("id", logId);
    if (error) {
      toast.error("취소 실패");
    } else {
      setLogs(prev => prev.filter(l => l.id !== logId));
      toast.success("체크인 취소됨");
    }
  };

  const uniqueToday = logs.filter(l => !l.is_duplicate).length;
  const duplicateToday = logs.filter(l => l.is_duplicate).length;

  // Resolve branch code for live board URL
  const liveBoardUrl = `/live-board/${encodeURIComponent(branchName)}`;

  // QR fullscreen overlay
  if (showQrFull) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white" onClick={() => setShowQrFull(false)}>
        <p className="mb-4 text-sm text-muted-foreground">{branchName} · 체크인 QR</p>
        {qrToken ? (
          <>
            <QRCodeSVG
              value={JSON.stringify({ token: qrToken })}
              size={Math.min(window.innerWidth * 0.7, 500)}
              level="M"
            />
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${timeLeft > 5 ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
              <span className="text-lg font-mono font-bold text-foreground">{timeLeft}초</span>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">QR을 먼저 생성해주세요</p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">화면을 터치하면 닫힙니다</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/manager")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">체크인 보드 관리</h1>
          <p className="text-xs text-muted-foreground">{branchName}</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-primary">{uniqueToday}</p>
          <p className="text-[10px] text-muted-foreground">오늘 체크인</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-foreground">{logs.length}</p>
          <p className="text-[10px] text-muted-foreground">총 스캔 수</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-muted-foreground">{duplicateToday}</p>
          <p className="text-[10px] text-muted-foreground">중복 차단</p>
        </div>
      </div>

      {/* QR Section */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground">지점 QR 코드</h2>
          {qrToken && (
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${timeLeft > 5 ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
              <span className="text-xs font-mono text-muted-foreground">{timeLeft}초</span>
            </div>
          )}
        </div>

        {qrToken ? (
          <div className="flex flex-col items-center">
            <QRCodeSVG value={JSON.stringify({ token: qrToken })} size={200} level="M" />
            <div className="mt-4 flex gap-2">
              <button onClick={refreshToken} disabled={refreshing}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> 재생성
              </button>
              <button onClick={() => setShowQrFull(true)}
                className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground transition-all active:scale-95">
                <QrCode className="h-4 w-4" /> 전체화면
              </button>
            </div>
          </div>
        ) : (
          <button onClick={refreshToken} disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50">
            <QrCode className="h-5 w-5" />
            {refreshing ? "생성 중..." : "QR 코드 생성"}
          </button>
        )}
      </div>

      {/* Live Board Link */}
      <button onClick={() => window.open(liveBoardUrl, "_blank")}
        className="mb-5 w-full rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.98]">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">라이브 보드 열기</p>
            <p className="text-xs text-muted-foreground">모니터/TV에서 체크인 현황 표시</p>
          </div>
        </div>
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">표시 설정</h3>
          <div className="space-y-2">
            {[
              { key: "nickname", label: "닉네임만", desc: "닉네임으로 표시" },
              { key: "masked_name", label: "이름 마스킹", desc: "김O준 형식" },
              { key: "full_name", label: "실명 표시", desc: "전체 이름 표시" },
            ].map(opt => (
              <button key={opt.key} onClick={() => updateDisplayMode(opt.key)}
                className={`w-full rounded-xl p-3 text-left transition-all ${
                  displayMode === opt.key ? "bg-primary/10 border border-primary" : "bg-muted/50 border border-transparent"
                }`}>
                <p className="text-sm font-bold text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Checkin Logs */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-foreground">오늘 체크인 로그</h3>
        </div>
        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm">아직 체크인 기록이 없습니다</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{log.display_name_snapshot}</span>
                    {log.is_duplicate && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">중복</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatRank(log.league_snapshot, log.level_snapshot)} · {new Date(log.checked_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    {log.xp_granted > 0 && ` · +${log.xp_granted}XP`}
                  </p>
                </div>
                <button onClick={() => cancelCheckin(log.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-all active:scale-95">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckinBoardPage;
