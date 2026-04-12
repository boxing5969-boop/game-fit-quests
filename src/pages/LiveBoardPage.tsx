import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RANK_LABELS } from "@/lib/rankLabels";
import { Building2, X, Clock } from "lucide-react";

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

const AUTO_REMOVE_MS = 40 * 60 * 1000; // 40 minutes default

interface CheckinEvent {
  id: string;
  display_name_snapshot: string;
  league_snapshot: string;
  level_snapshot: number;
  checked_in_at: string;
  user_id: string;
}

interface ActiveMember {
  id: string;
  user_id: string;
  name: string;
  league: string;
  level: number;
  startedAt: number; // timestamp ms
}

const LiveBoardPage = () => {
  const { branchCode } = useParams<{ branchCode: string }>();
  const [branchName, setBranchName] = useState<string>("");
  const [todayCheckins, setTodayCheckins] = useState<CheckinEvent[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [latestPopup, setLatestPopup] = useState<CheckinEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(true);

  // super_admin branch switching
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showBranchSwitch, setShowBranchSwitch] = useState(false);

  // Check if current user is super_admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("user_roles").select("role").eq("user_id", user.id).single().then(({ data }) => {
        if (data && (data.role === "super_admin" || data.role === "admin")) {
          setIsSuperAdmin(true);
          supabase.from("branches").select("id, name").order("name").then(({ data: b }) => {
            if (b) setBranches(b);
          });
        }
      });
    });
  }, []);

  // Resolve branch name from code
  useEffect(() => {
    if (!branchCode) return;
    const loadBranch = async () => {
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

    if (data) {
      setTodayCheckins(data);
      // Initialize active members from recent checkins (within AUTO_REMOVE_MS)
      const now = Date.now();
      const recentActive = data
        .filter(c => now - new Date(c.checked_in_at).getTime() < AUTO_REMOVE_MS)
        .map(c => ({
          id: c.id,
          user_id: c.user_id,
          name: c.display_name_snapshot,
          league: c.league_snapshot,
          level: c.level_snapshot,
          startedAt: new Date(c.checked_in_at).getTime(),
        }));
      // Deduplicate by user_id, keep latest
      const seen = new Set<string>();
      const deduped: ActiveMember[] = [];
      for (const m of recentActive) {
        if (!seen.has(m.user_id)) {
          seen.add(m.user_id);
          deduped.push(m);
        }
      }
      setActiveMembers(deduped);
    }
  }, [branchName]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Auto-remove expired active members every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveMembers(prev => prev.filter(m => now - m.startedAt < AUTO_REMOVE_MS));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerPopup = useCallback((event: CheckinEvent) => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setLatestPopup(event);
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), 7000);
  }, []);

  // Remove a member from active list manually
  const removeActiveMember = useCallback((userId: string) => {
    setActiveMembers(prev => prev.filter(m => m.user_id !== userId));
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
          // Add to active members (replace if already exists)
          setActiveMembers(prev => {
            const filtered = prev.filter(m => m.user_id !== event.user_id);
            return [{
              id: event.id,
              user_id: event.user_id,
              name: event.display_name_snapshot,
              league: event.league_snapshot,
              level: event.level_snapshot,
              startedAt: Date.now(),
            }, ...filtered];
          });
          triggerPopup(event);
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, [branchName, triggerPopup]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!connected) loadToday();
    }, 10000);
    return () => clearInterval(interval);
  }, [connected, loadToday]);

  const handleBranchSwitch = (newBranch: string) => {
    window.location.href = `/live-board/${encodeURIComponent(newBranch)}`;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const getElapsedMin = (startedAt: number) => {
    return Math.floor((Date.now() - startedAt) / 60000);
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
          {isSuperAdmin && branches.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBranchSwitch(!showBranchSwitch)}
                className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <Building2 className="h-4 w-4" />
                <span>지점 전환</span>
              </button>
              {showBranchSwitch && (
                <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl bg-gray-800 border border-gray-700 shadow-2xl overflow-hidden">
                  <div className="p-2 border-b border-gray-700">
                    <p className="text-xs text-gray-400 px-2">지점 선택</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {branches.map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleBranchSwitch(b.name)}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-700 transition-colors ${
                          b.name === branchName ? "text-orange-400 font-bold bg-gray-700/50" : "text-gray-300"
                        }`}
                      >
                        {b.name}
                        {b.name === branchName && " ✓"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-black text-green-400 tabular-nums">{activeMembers.length}</p>
              <p className="text-[10px] text-gray-500">활동 중</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-orange-400 tabular-nums">{todayCheckins.length}</p>
              <p className="text-[10px] text-gray-500">오늘 방문</p>
            </div>
          </div>
          <div className={`h-3 w-3 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Center: Popup area */}
        <div className="flex-1 flex items-center justify-center relative">
          {showPopup && latestPopup ? (
            <div
              className={`animate-bounce-in rounded-3xl border-2 p-10 ${RANK_COLORS[latestPopup.league_snapshot] || RANK_COLORS.white} shadow-2xl ${RANK_GLOW[latestPopup.league_snapshot] || ""}`}
              style={{ minWidth: 400 }}
            >
              <div className="text-center">
                <p className="text-6xl font-black mb-4">{latestPopup.display_name_snapshot}</p>
                <p className="text-2xl font-bold opacity-80">
                  {RANK_LABELS[latestPopup.league_snapshot] || latestPopup.league_snapshot} 리그 · 레벨 {latestPopup.level_snapshot}
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/10 px-6 py-3">
                  <span className="text-xl">🥊</span>
                  <span className="text-lg font-bold">복싱 레벨업 중</span>
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

        {/* Right panel: Active + Today log */}
        <div className="w-80 bg-gray-900/50 border-l border-gray-800 flex flex-col">
          {/* Section A: Currently Active */}
          <div className="flex-shrink-0 border-b border-gray-800">
            <div className="px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-green-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                현재 활동 중 ({activeMembers.length})
              </h2>
            </div>
            <div className="max-h-[35vh] overflow-y-auto">
              {activeMembers.length === 0 ? (
                <div className="px-4 pb-4 text-center text-gray-600">
                  <p className="text-sm">활동 중인 회원이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {activeMembers.map((m) => {
                    const elapsed = getElapsedMin(m.startedAt);
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 px-4 py-2.5 group">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold border ${RANK_COLORS[m.league] || "border-gray-600 bg-gray-800"}`}>
                          {m.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{m.name}</p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span>{RANK_LABELS[m.league] || m.league} L{m.level}</span>
                            <span>·</span>
                            <Clock className="h-3 w-3" />
                            <span>{elapsed}분</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeActiveMember(m.user_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 transition-all"
                          title="운동 종료 처리"
                        >
                          <X className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section B: Today's Visit Log */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-800 sticky top-0 bg-gray-900/80 backdrop-blur-sm">
              <h2 className="text-sm font-bold text-gray-400">📋 오늘 방문 기록 ({todayCheckins.length})</h2>
            </div>
            <div className="divide-y divide-gray-800/30">
              {todayCheckins.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  <p className="text-2xl mb-2">🥊</p>
                  <p className="text-sm">아직 체크인이 없습니다</p>
                </div>
              ) : (
                todayCheckins.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-800/20 transition-colors">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border ${RANK_COLORS[c.league_snapshot] || "border-gray-600 bg-gray-800"}`}>
                      {c.display_name_snapshot.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-300 truncate">{c.display_name_snapshot}</p>
                      <p className="text-[10px] text-gray-600">
                        {RANK_LABELS[c.league_snapshot] || c.league_snapshot} L{c.level_snapshot}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(c.checked_in_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBoardPage;
