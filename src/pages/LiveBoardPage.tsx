import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RANK_LABELS } from "@/lib/rankLabels";

const RANK_COLORS: Record<string, string> = {
  white: "border-gray-400 bg-gray-100 text-gray-800",
  blue: "border-blue-500 bg-blue-50 text-blue-800",
  red: "border-red-500 bg-red-50 text-red-800",
  black: "border-gray-800 bg-gray-900 text-white",
};

const RANK_GLOW: Record<string, string> = {
  white: "shadow-gray-300/50",
  blue: "shadow-blue-500/40",
  red: "shadow-red-500/40",
  black: "shadow-purple-500/30",
};

interface CheckinEvent {
  id: string;
  display_name_snapshot: string;
  league_snapshot: string;
  level_snapshot: number;
  checked_in_at: string;
  user_id: string;
}

const LiveBoardPage = () => {
  const { branchCode } = useParams<{ branchCode: string }>();
  const [branchName, setBranchName] = useState<string>("");
  const [todayCheckins, setTodayCheckins] = useState<CheckinEvent[]>([]);
  const [latestPopup, setLatestPopup] = useState<CheckinEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(true);

  // Resolve branch name from code
  useEffect(() => {
    if (!branchCode) return;
    const loadBranch = async () => {
      // Try by code first, then by name
      const { data } = await supabase
        .from("branches")
        .select("name, code")
        .or(`code.eq.${branchCode},name.eq.${decodeURIComponent(branchCode)}`)
        .limit(1);
      if (data && data.length > 0) {
        setBranchName(data[0].name);
      } else {
        setBranchName(decodeURIComponent(branchCode));
      }
    };
    loadBranch();
  }, [branchCode]);

  // Load today's checkins
  const loadToday = useCallback(async () => {
    if (!branchName) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("attendance_logs")
      .select("id, display_name_snapshot, league_snapshot, level_snapshot, checked_in_at, user_id")
      .eq("branch_name", branchName)
      .eq("is_duplicate", false)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false })
      .limit(100);

    if (data) setTodayCheckins(data);
  }, [branchName]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Show popup animation
  const triggerPopup = useCallback((event: CheckinEvent) => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setLatestPopup(event);
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), 6000);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!branchName) return;

    const channel = supabase
      .channel(`live-board-${branchName}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_logs",
          filter: `branch_name=eq.${branchName}`,
        },
        (payload) => {
          const newEvent = payload.new as any;
          if (newEvent.is_duplicate) return;

          const event: CheckinEvent = {
            id: newEvent.id,
            display_name_snapshot: newEvent.display_name_snapshot,
            league_snapshot: newEvent.league_snapshot,
            level_snapshot: newEvent.level_snapshot,
            checked_in_at: newEvent.checked_in_at,
            user_id: newEvent.user_id,
          };

          setTodayCheckins(prev => [event, ...prev]);
          triggerPopup(event);
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [branchName, triggerPopup]);

  // Auto-reconnect check
  useEffect(() => {
    const interval = setInterval(() => {
      if (!connected) loadToday();
    }, 10000);
    return () => clearInterval(interval);
  }, [connected, loadToday]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 text-white overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 bg-gray-900/80 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-3xl">🥊</span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">153 랭크업</h1>
            <p className="text-sm text-gray-400">{branchName || "지점"}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-4xl font-black text-primary tabular-nums">{todayCheckins.length}</p>
            <p className="text-xs text-gray-500">오늘 방문</p>
          </div>
          <div className={`h-3 w-3 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Center: Popup area */}
        <div className="flex-1 flex items-center justify-center relative">
          {showPopup && latestPopup ? (
            <div className={`animate-bounce-in rounded-3xl border-2 p-10 ${RANK_COLORS[latestPopup.league_snapshot] || RANK_COLORS.white} shadow-2xl ${RANK_GLOW[latestPopup.league_snapshot] || ""}`}
              style={{ minWidth: 400 }}
            >
              <div className="text-center">
                <p className="text-6xl font-black mb-4">{latestPopup.display_name_snapshot}</p>
                <p className="text-2xl font-bold opacity-80">
                  {RANK_LABELS[latestPopup.league_snapshot] || latestPopup.league_snapshot} 리그 · 레벨 {latestPopup.level_snapshot}
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/20 px-6 py-3">
                  <span className="text-xl">🥊</span>
                  <span className="text-lg font-bold text-primary">복싱 레벨업 중</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center opacity-50">
              <p className="text-5xl mb-4">🥊</p>
              <p className="text-3xl font-black text-gray-600">153 랭크업 시스템</p>
              <p className="mt-2 text-lg text-gray-700">오늘도 복싱 레벨업 중</p>
            </div>
          )}
        </div>

        {/* Right: Today's checkin list */}
        <div className="w-80 bg-gray-900/50 border-l border-gray-800 overflow-y-auto">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-bold text-gray-400">오늘 체크인</h2>
          </div>
          <div className="divide-y divide-gray-800/50">
            {todayCheckins.length === 0 ? (
              <div className="p-8 text-center text-gray-600">
                <p className="text-2xl mb-2">🥊</p>
                <p className="text-sm">아직 체크인이 없습니다</p>
              </div>
            ) : (
              todayCheckins.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-800/30">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold border ${RANK_COLORS[c.league_snapshot] || "border-gray-600 bg-gray-800"}`}>
                    {c.display_name_snapshot.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{c.display_name_snapshot}</p>
                    <p className="text-xs text-gray-500">
                      {RANK_LABELS[c.league_snapshot] || c.league_snapshot} L{c.level_snapshot}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600 tabular-nums">{formatTime(c.checked_in_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBoardPage;
