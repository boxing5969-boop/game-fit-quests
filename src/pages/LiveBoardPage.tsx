import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RANK_LABELS } from "@/lib/rankLabels";
import { Building2, Clock, X, Trophy } from "lucide-react";

const RANK_COLORS: Record<string, string> = {
  white: "border-gray-400 bg-gray-200 text-gray-900",
  blue: "border-blue-400 bg-blue-100 text-blue-900",
  red: "border-red-400 bg-red-100 text-red-900",
  black: "border-yellow-500 bg-gray-900 text-yellow-100",
};

const RANK_GLOW: Record<string, string> = {
  white: "shadow-[0_0_60px_rgba(180,180,180,0.3)]",
  blue: "shadow-[0_0_60px_rgba(59,130,246,0.4)]",
  red: "shadow-[0_0_60px_rgba(239,68,68,0.4)]",
  black: "shadow-[0_0_60px_rgba(234,179,8,0.35)]",
};

const AUTO_REMOVE_MS = 40 * 60 * 1000;

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
  startedAt: number;
}

interface HallMember {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_bosses_cleared: number;
}

const LiveBoardPage = () => {
  const { branchCode } = useParams<{ branchCode: string }>();
  const [branchName, setBranchName] = useState("");
  const [todayCheckins, setTodayCheckins] = useState<CheckinEvent[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [hallMembers, setHallMembers] = useState<HallMember[]>([]);
  const [latestPopup, setLatestPopup] = useState<CheckinEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showBranchSwitch, setShowBranchSwitch] = useState(false);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Check super_admin
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

  // Resolve branch
  useEffect(() => {
    if (!branchCode) return;
    (async () => {
      const { data } = await supabase
        .from("branches").select("name, code")
        .or(`code.eq.${branchCode},name.eq.${decodeURIComponent(branchCode)}`)
        .limit(1);
      setBranchName(data?.[0]?.name || decodeURIComponent(branchCode));
    })();
  }, [branchCode]);

  // Load today checkins
  const loadToday = useCallback(async () => {
    if (!branchName) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("attendance_logs")
      .select("id, display_name_snapshot, league_snapshot, level_snapshot, checked_in_at, user_id")
      .eq("branch_name", branchName).eq("is_duplicate", false)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false }).limit(100);
    if (data) {
      setTodayCheckins(data);
      const now = Date.now();
      const seen = new Set<string>();
      const active: ActiveMember[] = [];
      for (const c of data) {
        if (now - new Date(c.checked_in_at).getTime() < AUTO_REMOVE_MS && !seen.has(c.user_id)) {
          seen.add(c.user_id);
          active.push({ id: c.id, user_id: c.user_id, name: c.display_name_snapshot, league: c.league_snapshot, level: c.level_snapshot, startedAt: new Date(c.checked_in_at).getTime() });
        }
      }
      setActiveMembers(active);
    }
  }, [branchName]);

  // Load hall of fame for this branch
  const loadHall = useCallback(async () => {
    if (!branchName) return;
    const { data } = await supabase.rpc("get_boss_conquerors", { _branch_name: branchName, _limit: 20 });
    if (data) {
      // Filter MASTER 40: black rank, level 10, bosses_cleared >= 4
      const masters = (data as HallMember[]).filter(
        m => m.r_current_rank === "black" && m.r_current_level === 10 && m.r_bosses_cleared >= 4
      );
      setHallMembers(masters);
    }
  }, [branchName]);

  useEffect(() => { loadToday(); loadHall(); }, [loadToday, loadHall]);

  // Auto-remove expired active members
  useEffect(() => {
    const i = setInterval(() => {
      const now = Date.now();
      setActiveMembers(prev => prev.filter(m => now - m.startedAt < AUTO_REMOVE_MS));
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const triggerPopup = useCallback((event: CheckinEvent) => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setLatestPopup(event);
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), 7000);
  }, []);

  const removeActiveMember = useCallback((userId: string) => {
    setActiveMembers(prev => prev.filter(m => m.user_id !== userId));
  }, []);

  // Realtime
  useEffect(() => {
    if (!branchName) return;
    const channel = supabase
      .channel(`live-board-${branchName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs", filter: `branch_name=eq.${branchName}` },
        (payload) => {
          const n = payload.new as any;
          if (n.is_duplicate) return;
          const event: CheckinEvent = { id: n.id, display_name_snapshot: n.display_name_snapshot, league_snapshot: n.league_snapshot, level_snapshot: n.level_snapshot, checked_in_at: n.checked_in_at, user_id: n.user_id };
          setTodayCheckins(prev => [event, ...prev]);
          setActiveMembers(prev => {
            const filtered = prev.filter(m => m.user_id !== event.user_id);
            return [{ id: event.id, user_id: event.user_id, name: event.display_name_snapshot, league: event.league_snapshot, level: event.level_snapshot, startedAt: Date.now() }, ...filtered];
          });
          triggerPopup(event);
        })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [branchName, triggerPopup]);

  // Reconnect fallback
  useEffect(() => {
    const i = setInterval(() => { if (!connected) loadToday(); }, 10000);
    return () => clearInterval(i);
  }, [connected, loadToday]);

  const handleBranchSwitch = (name: string) => {
    window.location.href = `/live-board/${encodeURIComponent(name)}`;
  };

  const fmtTime = (s: string) => new Date(s).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const elapsedMin = (t: number) => Math.floor((Date.now() - t) / 60000);

  return (
    <div className="fixed inset-0 bg-gray-950 text-white overflow-hidden select-none" style={{ fontFamily: "'Black Han Sans', 'Noto Sans KR', sans-serif" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-4 bg-gray-900/90 border-b border-gray-800/60">
        <div className="flex items-center gap-5">
          <span className="text-4xl">🥊</span>
          <div>
            <h1 className="text-3xl font-black tracking-tight leading-none">153 랭크업</h1>
            <p className="text-lg text-gray-400 font-medium">{branchName || "지점"}</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          {isSuperAdmin && branches.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowBranchSwitch(!showBranchSwitch)} className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-base text-gray-300 hover:bg-gray-700 transition-colors">
                <Building2 className="h-5 w-5" />
                <span>지점 전환</span>
              </button>
              {showBranchSwitch && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-gray-800 border border-gray-700 shadow-2xl overflow-hidden">
                  <div className="p-3 border-b border-gray-700"><p className="text-sm text-gray-400 px-2">지점 선택</p></div>
                  <div className="max-h-60 overflow-y-auto">
                    {branches.map(b => (
                      <button key={b.id} onClick={() => handleBranchSwitch(b.name)}
                        className={`w-full px-5 py-3 text-left text-base hover:bg-gray-700 transition-colors ${b.name === branchName ? "text-orange-400 font-bold bg-gray-700/50" : "text-gray-300"}`}>
                        {b.name}{b.name === branchName && " ✓"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-black text-green-400 tabular-nums leading-none">{activeMembers.length}</p>
              <p className="text-sm text-gray-500 mt-1">활동 중</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-orange-400 tabular-nums leading-none">{todayCheckins.length}</p>
              <p className="text-sm text-gray-500 mt-1">오늘 방문</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-500 tabular-nums">
              {currentTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className={`h-4 w-4 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        </div>
      </div>

      <div className="flex h-[calc(100vh-76px)]">
        {/* ═══ Center: Main area ═══ */}
        <div className="flex-1 flex flex-col">
          {/* Main popup / idle */}
          <div className="flex-1 flex items-center justify-center relative px-8">
            {showPopup && latestPopup ? (
              <div
                className={`rounded-3xl border-4 px-16 py-14 ${RANK_COLORS[latestPopup.league_snapshot] || RANK_COLORS.white} ${RANK_GLOW[latestPopup.league_snapshot] || ""}`}
                style={{ minWidth: "50vw", maxWidth: "70vw", animation: "popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                <div className="text-center">
                  <p className="text-[6rem] font-black leading-none tracking-tight mb-4" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                    {latestPopup.display_name_snapshot}
                  </p>
                  <p className="text-4xl font-bold opacity-80 mb-8">
                    {RANK_LABELS[latestPopup.league_snapshot] || latestPopup.league_snapshot} 리그 · 레벨 {latestPopup.level_snapshot}
                  </p>
                  <div className="inline-flex items-center gap-3 rounded-full bg-black/10 px-8 py-4">
                    <span className="text-3xl">🥊</span>
                    <span className="text-2xl font-black">복싱 레벨업 중</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-8xl mb-6">🥊</p>
                <p className="text-5xl font-black text-gray-600 leading-tight">153 랭크업 시스템</p>
                <p className="mt-4 text-3xl text-gray-700 font-bold">오늘도 복싱 레벨업 중</p>
                <p className="mt-2 text-xl text-gray-800">{branchName}</p>
              </div>
            )}
          </div>

          {/* ── Bottom: Hall of Fame banner ── */}
          {hallMembers.length > 0 && (
            <div className="mx-6 mb-5 rounded-2xl border-2 border-yellow-600/40 bg-gradient-to-r from-yellow-950/60 via-gray-900/80 to-yellow-950/60 px-8 py-5">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <h2 className="text-2xl font-black text-yellow-400 tracking-wide">명예의 전당</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-yellow-600/40 to-transparent" />
              </div>
              <div className="flex flex-wrap gap-4">
                {hallMembers.map((m) => (
                  <div key={m.r_user_id} className="flex items-center gap-3 rounded-xl border border-yellow-700/30 bg-yellow-900/20 px-5 py-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <p className="text-xl font-black text-yellow-200 leading-tight">{m.r_nickname}</p>
                      <p className="text-sm text-yellow-500/80 font-bold">MASTER 40</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Right panel ═══ */}
        <div className="w-[22rem] bg-gray-900/60 border-l border-gray-800/60 flex flex-col">
          {/* Active members */}
          <div className="flex-shrink-0 border-b border-gray-800/60">
            <div className="px-5 py-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-xl font-black text-green-400">현재 활동 중 ({activeMembers.length})</h2>
            </div>
            <div className="max-h-[30vh] overflow-y-auto px-3 pb-3">
              {activeMembers.length === 0 ? (
                <div className="text-center py-4 text-gray-600"><p className="text-lg">활동 중인 회원 없음</p></div>
              ) : (
                <div className="space-y-2">
                  {activeMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 rounded-xl bg-gray-800/40 px-4 py-3 group">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-black border-2 ${RANK_COLORS[m.league] || "border-gray-600 bg-gray-800 text-white"}`}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xl font-black text-white truncate leading-tight">{m.name}</p>
                        <div className="flex items-center gap-2 text-base text-gray-400">
                          <span>{RANK_LABELS[m.league] || m.league} L{m.level}</span>
                          <span>·</span>
                          <Clock className="h-4 w-4 inline" />
                          <span>{elapsedMin(m.startedAt)}분</span>
                        </div>
                      </div>
                      <button onClick={() => removeActiveMember(m.user_id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-700 transition-all" title="운동 종료">
                        <X className="h-5 w-5 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Today visit log */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-800/40 sticky top-0 bg-gray-900/90 backdrop-blur-sm z-10">
              <h2 className="text-xl font-black text-gray-400">📋 오늘 방문 ({todayCheckins.length})</h2>
            </div>
            <div className="px-3 py-2">
              {todayCheckins.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <p className="text-3xl mb-2">🥊</p>
                  <p className="text-lg">아직 체크인이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {todayCheckins.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-800/30 transition-colors">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-bold border-2 ${RANK_COLORS[c.league_snapshot] || "border-gray-600 bg-gray-800 text-white"}`}>
                        {c.display_name_snapshot.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-gray-200 truncate leading-tight">{c.display_name_snapshot}</p>
                        <p className="text-sm text-gray-500">{RANK_LABELS[c.league_snapshot] || c.league_snapshot} L{c.level_snapshot}</p>
                      </div>
                      <span className="text-base text-gray-600 tabular-nums font-medium">{fmtTime(c.checked_in_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popup animation keyframes */}
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LiveBoardPage;
