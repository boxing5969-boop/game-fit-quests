import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { QrCode, Monitor, RefreshCw, Trash2, ChevronLeft, Settings, Bug, Zap, Clock, CheckCircle2, XCircle, AlertTriangle, Building2, RotateCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { formatRank } from "@/lib/rankLabels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AttendanceLog {
  id: string;
  user_id: string;
  display_name_snapshot: string;
  league_snapshot: string;
  level_snapshot: number;
  checked_in_at: string;
  xp_granted: number;
  is_duplicate: boolean;
  method: string;
}

interface Branch {
  id: string;
  name: string;
  code: string | null;
}

const CheckinBoardPage = () => {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = role === "super_admin" || role === "admin";

  // Branch selection state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branchesLoading, setBranchesLoading] = useState(false);

  // The active branch used for all operations
  const activeBranch = isSuperAdmin ? selectedBranch : (profile?.branch_name || "");

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
  const [expirySeconds, setExpirySeconds] = useState(300);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [showQrFull, setShowQrFull] = useState(false);
  const [displayMode, setDisplayMode] = useState<string>("nickname");
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [tokenPreview, setTokenPreview] = useState<string>("");
  const [activeSessions, setActiveSessions] = useState(0);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const autoRefreshRef = useRef<ReturnType<typeof setInterval>>();

  // Load active session count
  const loadActiveSessions = useCallback(async () => {
    if (!activeBranch) return;
    const { count } = await supabase
      .from("activity_sessions")
      .select("id", { count: "exact", head: true })
      .eq("branch_name", activeBranch)
      .eq("status", "active")
      .is("ended_at", null);
    setActiveSessions(count || 0);
  }, [activeBranch]);

  useEffect(() => { loadActiveSessions(); }, [loadActiveSessions]);

  // Reset active sessions
  const handleResetActiveSessions = async () => {
    if (!activeBranch) return;
    // RPC 경유 — 직접 UPDATE 는 RLS(본인·super_admin만)에 걸려 branch_manager 가 0행 무음 실패
    // + "완료" 거짓 토스트를 띄우던 문제. 실제 종료 건수로 화면 갱신.
    const { data, error } = await (supabase.rpc as any)("reset_active_sessions", { _branch_name: activeBranch });
    if (error) {
      toast.error(error.message?.includes("authorized") ? "권한이 없습니다" : "초기화 실패");
    } else {
      toast.success(`현재 활동 중 초기화 완료 (${Number(data) || 0}명)`);
      setActiveSessions(0);
    }
  };

  // Load branches for super_admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    setBranchesLoading(true);
    supabase.from("branches").select("id, name, code").order("name").then(({ data }) => {
      if (data) {
        setBranches(data);
        // Auto-select first branch or user's own branch
        if (data.length > 0) {
          const own = data.find(b => b.name === profile?.branch_name);
          setSelectedBranch(own ? own.name : data[0].name);
        }
      }
      setBranchesLoading(false);
    });
  }, [isSuperAdmin, profile?.branch_name]);

  // Reset QR state when branch changes
  useEffect(() => {
    setQrToken(null);
    setQrExpiry(null);
    setTimeLeft(0);
    setTokenPreview("");
    setLogs([]);
  }, [activeBranch]);

  // Load settings
  useEffect(() => {
    if (!activeBranch) return;
    supabase
      .from("branch_display_settings")
      .select("display_name_mode")
      .eq("branch_name", activeBranch)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDisplayMode(data.display_name_mode);
      });
  }, [activeBranch]);

  // Load today's logs
  const loadLogs = useCallback(async () => {
    if (!activeBranch) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("branch_name", activeBranch)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false })
      .limit(200);
    if (data) setLogs(data as AttendanceLog[]);
  }, [activeBranch]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Realtime subscription for attendance logs AND activity sessions
  useEffect(() => {
    if (!activeBranch) return;
    const channel = supabase
      .channel(`checkin-board-${activeBranch}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_logs",
          filter: `branch_name=eq.${activeBranch}`,
        },
        (payload) => {
          const newLog = payload.new as AttendanceLog;
          setLogs(prev => [newLog, ...prev]);
          loadActiveSessions();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_sessions",
          filter: `branch_name=eq.${activeBranch}`,
        },
        () => {
          loadActiveSessions();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeBranch, loadActiveSessions]);

  // Generate QR token
  const refreshToken = useCallback(async () => {
    if (!activeBranch) {
      toast.error("지점을 먼저 선택해주세요");
      return;
    }
    setRefreshing(true);
    try {
      const body: Record<string, any> = { expiry_seconds: expirySeconds };
      if (isSuperAdmin) {
        body.branch_name = activeBranch;
      }
      const { data, error } = await supabase.functions.invoke("qr-token-refresh", { body });
      if (error || data?.error) {
        toast.error(data?.error || "QR 생성 실패");
        console.error("[CheckinBoard] Token refresh failed:", error || data?.error);
        return;
      }
      setQrToken(data.token);
      setTokenPreview(data.token.substring(0, 8) + "...");
      setQrExpiry(new Date(data.expires_at));
      setTimeLeft(data.expiry_seconds || expirySeconds);
      toast.success(`${activeBranch} QR 코드 생성 완료`);
    } catch (e) {
      console.error("[CheckinBoard] Network error:", e);
      toast.error("네트워크 오류");
    } finally {
      setRefreshing(false);
    }
  }, [expirySeconds, activeBranch, isSuperAdmin]);

  // Countdown timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!qrExpiry) return;
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((qrExpiry.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(intervalRef.current);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [qrExpiry]);

  // Auto-refresh QR before expiry
  useEffect(() => {
    if (!qrToken || !qrExpiry) return;
    const refreshDelay = Math.max(0, (expirySeconds - 10) * 1000);
    autoRefreshRef.current = setInterval(() => { refreshToken(); }, refreshDelay);
    return () => clearInterval(autoRefreshRef.current);
  }, [qrToken, qrExpiry, expirySeconds, refreshToken]);

  // Save display mode
  const updateDisplayMode = async (mode: string) => {
    setDisplayMode(mode);
    await supabase
      .from("branch_display_settings")
      .upsert({ branch_name: activeBranch, display_name_mode: mode }, { onConflict: "branch_name" });
    toast.success("표시 설정 저장됨");
  };

  // Cancel checkin — cancel_checkin RPC 가 기록 삭제 + XP/스트릭 회수를
  // 한 트랜잭션으로 처리 (기존 직접 DELETE 는 지급된 XP 가 남는 문제).
  // types.ts 미재생성 함수라 spend_gems 와 같은 캐스트 패턴 사용.
  const cancelCheckin = async (logId: string) => {
    const { data, error } = await (supabase.rpc as any)("cancel_checkin", { _log_id: logId });
    const result = data as { success?: boolean; reverted_xp?: number } | null;
    if (error || !result?.success) {
      toast.error("취소 실패");
    } else {
      setLogs(prev => prev.filter(l => l.id !== logId));
      toast.success(
        result.reverted_xp
          ? `체크인 취소됨 (XP ${result.reverted_xp} 회수)`
          : "체크인 취소됨",
      );
    }
  };

  const uniqueToday = logs.filter(l => !l.is_duplicate).length;
  const duplicateToday = logs.filter(l => l.is_duplicate).length;

  const qrValue = qrToken ? JSON.stringify({ token: qrToken }) : "";
  const liveBoardUrl = `/live-board/${encodeURIComponent(activeBranch)}`;

  const formatTimeLeft = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}분 ${sec.toString().padStart(2, '0')}초` : `${sec}초`;
  };

  // QR fullscreen overlay
  if (showQrFull) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white" onClick={() => setShowQrFull(false)}>
        <p className="mb-4 text-sm text-muted-foreground">{activeBranch} · 체크인 QR</p>
        {qrToken ? (
          <>
            <QRCodeSVG value={qrValue} size={Math.min(window.innerWidth * 0.7, 500)} level="M" />
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${timeLeft > 30 ? "bg-green-500" : timeLeft > 10 ? "bg-yellow-500" : "bg-red-500 animate-pulse"}`} />
              <span className="text-lg font-mono font-bold text-foreground">{formatTimeLeft(timeLeft)}</span>
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
          <p className="text-xs text-muted-foreground">{activeBranch || "지점을 선택해주세요"}</p>
        </div>
        <button onClick={() => setShowDebug(!showDebug)} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <Bug className="h-5 w-5" />
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Branch Selector for super_admin */}
      {isSuperAdmin && (
        <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">지점 선택</span>
            <span className="text-xs text-muted-foreground">(전체관리자)</span>
          </div>
          {branchesLoading ? (
            <div className="text-xs text-muted-foreground">지점 목록 로딩 중...</div>
          ) : branches.length === 0 ? (
            <div className="text-xs text-muted-foreground">등록된 지점이 없습니다</div>
          ) : (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="지점을 선택해주세요" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.name}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedBranch && (
            <p className="mt-2 text-xs text-primary font-medium">선택된 지점: {selectedBranch}</p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-2">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-primary">{uniqueToday}</p>
          <p className="text-[10px] text-muted-foreground">오늘 방문(명)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-foreground">{logs.length}</p>
          <p className="text-[10px] text-muted-foreground">총 스캔 수</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-muted-foreground">{duplicateToday}</p>
          <p className="text-[10px] text-muted-foreground">재스캔</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-green-600">{activeSessions}</p>
          <p className="text-[10px] text-muted-foreground">활동 중</p>
        </div>
      </div>

      {/* Admin: Reset active sessions */}
      {(isSuperAdmin || role === "branch_manager") && (
        <div className="mb-5 flex gap-2">
          <button
            onClick={handleResetActiveSessions}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-bold text-destructive transition-all active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            현재 활동 중 초기화
          </button>
        </div>
      )}

      {/* QR Section */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground">
            {activeBranch ? `${activeBranch} QR 코드` : "지점 QR 코드"}
          </h2>
          {qrToken && (
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${timeLeft > 30 ? "bg-green-500" : timeLeft > 10 ? "bg-yellow-500" : "bg-red-500 animate-pulse"}`} />
              <span className="text-xs font-mono text-muted-foreground">{formatTimeLeft(timeLeft)}</span>
            </div>
          )}
        </div>

        {!activeBranch ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            지점을 먼저 선택해주세요
          </div>
        ) : qrToken ? (
          <div className="flex flex-col items-center">
            <QRCodeSVG value={qrValue} size={200} level="M" />
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
          <button onClick={refreshToken} disabled={refreshing || !activeBranch}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50">
            <QrCode className="h-5 w-5" />
            {refreshing ? "생성 중..." : `이 지점 QR 코드 생성`}
          </button>
        )}
      </div>

      {/* Live Board Link */}
      <button onClick={() => activeBranch && window.open(liveBoardUrl, "_blank")}
        disabled={!activeBranch}
        className="mb-5 w-full rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.98] disabled:opacity-50">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {activeBranch ? `${activeBranch} 라이브 보드 열기` : "라이브 보드 열기"}
            </p>
            <p className="text-xs text-muted-foreground">모니터/TV에서 체크인 현황 표시</p>
          </div>
        </div>
      </button>

      {/* Debug Panel */}
      {showDebug && (
        <div className="mb-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Bug className="h-4 w-4 text-yellow-500" /> 디버그 도구
          </h3>
          <div className="rounded-xl bg-card border border-border p-3 space-y-2">
            <p className="text-xs font-bold text-muted-foreground">현재 토큰</p>
            {qrToken ? (
              <>
                <p className="text-sm font-mono text-foreground">{tokenPreview}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>만료: {qrExpiry?.toLocaleTimeString("ko-KR") || "-"}</span>
                  <span>({formatTimeLeft(timeLeft)} 남음)</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">토큰 없음 - QR을 생성해주세요</p>
            )}
          </div>

          <div className="rounded-xl bg-card border border-border p-3">
            <p className="text-xs font-bold text-muted-foreground mb-2">만료 시간 설정</p>
            <div className="flex gap-2">
              {[
                { label: "30초", value: 30 },
                { label: "1분", value: 60 },
                { label: "5분", value: 300 },
                { label: "10분", value: 600 },
              ].map(opt => (
                <button key={opt.value} onClick={() => setExpirySeconds(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    expirySeconds === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={refreshToken} disabled={refreshing || !activeBranch}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-yellow-500/20 py-2.5 text-xs font-bold text-yellow-700 transition-all active:scale-95 disabled:opacity-50">
              <Zap className="h-3.5 w-3.5" /> 샘플 QR 생성
            </button>
            <button onClick={loadLogs}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/20 py-2.5 text-xs font-bold text-blue-700 transition-all active:scale-95">
              <RefreshCw className="h-3.5 w-3.5" /> 로그 새로고침
            </button>
          </div>

          <div className="rounded-xl bg-card border border-border p-3">
            <p className="text-xs font-bold text-muted-foreground mb-2">최근 체크인 로그 (최대 10건)</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  {log.is_duplicate ? (
                    <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                  ) : log.xp_granted > 0 ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium text-foreground truncate">{log.display_name_snapshot}</span>
                  <span className="text-muted-foreground">
                    {new Date(log.checked_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className={`ml-auto font-mono ${log.xp_granted > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                    {log.is_duplicate ? "중복" : `+${log.xp_granted}XP`}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">아직 로그가 없습니다</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">표시 설정 ({activeBranch})</h3>
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
          <h3 className="text-sm font-bold text-foreground">오늘 체크인 로그 {logs.length > 0 && `(${logs.length})`}</h3>
        </div>
        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm">아직 체크인 기록이 없습니다</p>
            </div>
          ) : (
            <>
              {(showAllLogs ? logs : logs.slice(0, 5)).map(log => (
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
              ))}
              {logs.length > 5 && (
                <button
                  onClick={() => setShowAllLogs(prev => !prev)}
                  className="w-full py-3 text-xs font-bold text-primary hover:bg-muted/50 transition-colors"
                >
                  {showAllLogs ? "접기" : `더보기 (+${logs.length - 5}건)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckinBoardPage;
