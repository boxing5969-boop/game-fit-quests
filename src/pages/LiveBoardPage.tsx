import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RANK_LABELS } from "@/lib/rankLabels";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Clock, X, Trophy, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const RANK_COLORS: Record<string, string> = {
  white: "border-gray-400 bg-gray-200 text-gray-900",
  blue: "border-blue-400 bg-blue-100 text-blue-900",
  red: "border-red-400 bg-red-100 text-red-900",
  black: "border-yellow-500 bg-gray-900 text-yellow-100",
};

const RANK_GLOW: Record<string, string> = {
  white: "shadow-[0_0_80px_rgba(180,180,180,0.3)]",
  blue: "shadow-[0_0_80px_rgba(59,130,246,0.5)]",
  red: "shadow-[0_0_80px_rgba(239,68,68,0.5)]",
  black: "shadow-[0_0_80px_rgba(234,179,8,0.4)]",
};

const RANK_BADGE_COLORS: Record<string, string> = {
  white: "bg-gray-300 text-gray-900",
  blue: "bg-blue-500 text-white",
  red: "bg-red-500 text-white",
  black: "bg-gray-900 text-yellow-400 border border-yellow-600",
};

interface CheckinEvent {
  id: string;
  display_name_snapshot: string;
  league_snapshot: string;
  level_snapshot: number;
  checked_in_at: string;
  user_id: string;
}

/** Deduplicated daily visit: one row per user */
interface DailyVisit {
  user_id: string;
  display_name: string;
  league: string;
  level: number;
  last_checkin_at: string;
}

interface ActiveMember {
  id: string;
  user_id: string;
  name: string;
  league: string;
  level: number;
  startedAt: number;
  avatar_url?: string | null;
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
  const [dailyVisits, setDailyVisits] = useState<DailyVisit[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [hallMembers, setHallMembers] = useState<HallMember[]>([]);
  const [latestPopup, setLatestPopup] = useState<CheckinEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [popupAvatarUrl, setPopupAvatarUrl] = useState<string | null>(null);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isBranchManager, setIsBranchManager] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showBranchSwitch, setShowBranchSwitch] = useState(false);

  // Avatar cache with state to trigger re-renders
  const avatarCacheRef = useRef<Record<string, string | null>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  const getAvatarUrl = useCallback(async (userId: string): Promise<string | null> => {
    if (avatarCacheRef.current[userId] !== undefined) {
      if (avatarMap[userId] === undefined) {
        setAvatarMap(prev => ({ ...prev, [userId]: avatarCacheRef.current[userId] }));
      }
      return avatarCacheRef.current[userId];
    }
    // Try profiles (may fail for anon due to RLS)
    const { data } = await supabase.from("profiles").select("avatar_url").eq("user_id", userId).single();
    const url = data?.avatar_url || null;
    avatarCacheRef.current[userId] = url;
    setAvatarMap(prev => ({ ...prev, [userId]: url }));
    return url;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Check admin/manager role
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
        if (data && (data.role === "branch_manager" || data.role === "super_admin" || data.role === "admin")) {
          setIsBranchManager(true);
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

  // Load active sessions — only status='active', use attendance_logs as fallback for display data
  const loadActivitySessions = useCallback(async () => {
    if (!branchName) return;

    // Auto-end stale sessions (>2 hours old)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("activity_sessions")
      .update({ status: "auto_ended", ended_at: new Date().toISOString() })
      .eq("branch_name", branchName)
      .eq("status", "active")
      .is("ended_at", null)
      .lt("started_at", twoHoursAgo);

    const { data: activeSessions } = await supabase
      .from("activity_sessions")
      .select("id, user_id, started_at")
      .eq("branch_name", branchName)
      .eq("status", "active")
      .is("ended_at", null);

    if (!activeSessions || activeSessions.length === 0) {
      setActiveMembers([]);
      return;
    }

    // Deduplicate by user_id (keep latest session)
    const latestByUser = new Map<string, typeof activeSessions[0]>();
    for (const s of activeSessions) {
      const existing = latestByUser.get(s.user_id);
      if (!existing || new Date(s.started_at) > new Date(existing.started_at)) {
        latestByUser.set(s.user_id, s);
      }
    }

    const userIds = Array.from(latestByUser.keys());

    // Batch fetch profiles and progress (may fail for anon users due to RLS)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, name, avatar_url")
      .in("user_id", userIds);

    const { data: progressData } = await supabase
      .from("member_progress")
      .select("user_id, current_rank, current_level")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const progressMap = new Map((progressData || []).map(p => [p.user_id, p]));

    // Fallback: fetch today's attendance_logs for display info (anon CAN read these)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayLogs } = await supabase
      .from("attendance_logs")
      .select("user_id, display_name_snapshot, league_snapshot, level_snapshot")
      .eq("branch_name", branchName)
      .in("user_id", userIds)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false });

    // Build attendance fallback map (latest log per user)
    const attendanceMap = new Map<string, { display_name: string; league: string; level: number }>();
    for (const log of (todayLogs || [])) {
      if (!attendanceMap.has(log.user_id)) {
        attendanceMap.set(log.user_id, {
          display_name: log.display_name_snapshot,
          league: log.league_snapshot,
          level: log.level_snapshot,
        });
      }
    }

    const members: ActiveMember[] = [];
    for (const [userId, session] of latestByUser) {
      const profile = profileMap.get(userId);
      const progress = progressMap.get(userId);
      const attendanceFallback = attendanceMap.get(userId);

      // Determine display name: profile > attendance_log > skip
      const displayName = profile?.nickname || profile?.name || attendanceFallback?.display_name;
      if (!displayName) continue; // truly unknown user — skip

      const avatarUrl = profile?.avatar_url || null;
      avatarCacheRef.current[userId] = avatarUrl;

      members.push({
        id: session.id,
        user_id: userId,
        name: displayName,
        league: progress?.current_rank || attendanceFallback?.league || "white",
        level: progress?.current_level || attendanceFallback?.level || 1,
        startedAt: new Date(session.started_at).getTime(),
        avatar_url: avatarUrl,
      });
    }

    // Update avatar map in batch
    setAvatarMap(prev => {
      const next = { ...prev };
      for (const m of members) {
        next[m.user_id] = m.avatar_url || null;
      }
      return next;
    });

    setActiveMembers(members);
  }, [branchName]);

  // Load today visits — deduplicated by user_id
  const loadToday = useCallback(async () => {
    if (!branchName) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("attendance_logs")
      .select("id, display_name_snapshot, league_snapshot, level_snapshot, checked_in_at, user_id")
      .eq("branch_name", branchName)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false }).limit(500);

    if (data && data.length > 0) {
      // Deduplicate by user_id — keep last checkin time
      const userMap = new Map<string, DailyVisit>();
      for (const c of data) {
        if (!userMap.has(c.user_id)) {
          userMap.set(c.user_id, {
            user_id: c.user_id,
            display_name: c.display_name_snapshot,
            league: c.league_snapshot,
            level: c.level_snapshot,
            last_checkin_at: c.checked_in_at,
          });
        }
      }
      const visits = Array.from(userMap.values());
      setDailyVisits(visits);

      // Prefetch avatars
      for (const v of visits) {
        getAvatarUrl(v.user_id);
      }
    } else {
      setDailyVisits([]);
    }
  }, [branchName, getAvatarUrl]);

  // Load hall of fame
  const loadHall = useCallback(async () => {
    if (!branchName) return;
    const { data } = await supabase.rpc("get_boss_conquerors", { _branch_name: branchName, _limit: 20 });
    if (data) {
      const masters = (data as HallMember[]).filter(
        m => m.r_current_rank === "black" && m.r_current_level === 10 && m.r_bosses_cleared >= 4
      );
      setHallMembers(masters);
    }
  }, [branchName]);

  useEffect(() => { loadToday(); loadHall(); loadActivitySessions(); }, [loadToday, loadHall, loadActivitySessions]);

  const triggerPopup = useCallback(async (event: CheckinEvent) => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    const avatar = await getAvatarUrl(event.user_id);
    setPopupAvatarUrl(avatar);
    setLatestPopup(event);
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), 7000);
  }, [getAvatarUrl]);

  // Realtime subscriptions
  useEffect(() => {
    if (!branchName) return;
    const channel = supabase
      .channel(`live-board-${branchName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs", filter: `branch_name=eq.${branchName}` },
        (payload) => {
          const n = payload.new as any;
          const event: CheckinEvent = { id: n.id, display_name_snapshot: n.display_name_snapshot, league_snapshot: n.league_snapshot, level_snapshot: n.level_snapshot, checked_in_at: n.checked_in_at, user_id: n.user_id };
          getAvatarUrl(n.user_id);
          // Update daily visits (deduplicated)
          setDailyVisits(prev => {
            const exists = prev.find(v => v.user_id === n.user_id);
            if (exists) {
              // Update last checkin time
              return prev.map(v => v.user_id === n.user_id ? { ...v, last_checkin_at: n.checked_in_at, display_name: n.display_name_snapshot, league: n.league_snapshot, level: n.level_snapshot } : v);
            }
            return [{ user_id: n.user_id, display_name: n.display_name_snapshot, league: n.league_snapshot, level: n.level_snapshot, last_checkin_at: n.checked_in_at }, ...prev];
          });
          triggerPopup(event);
          void loadActivitySessions();
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_sessions", filter: `branch_name=eq.${branchName}` },
        () => {
          loadActivitySessions();
        })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [branchName, triggerPopup, loadActivitySessions, getAvatarUrl]);

  // Reconnect fallback
  useEffect(() => {
    const i = setInterval(() => { if (!connected) { loadToday(); loadActivitySessions(); } }, 10000);
    return () => clearInterval(i);
  }, [connected, loadToday, loadActivitySessions]);

  const handleBranchSwitch = (name: string) => {
    window.location.href = `/live-board/${encodeURIComponent(name)}`;
  };

  // Reset all active sessions for this branch (admin tool)
  const handleResetActiveSessions = async () => {
    if (!branchName) return;
    const { error } = await supabase
      .from("activity_sessions")
      .update({ status: "auto_ended", ended_at: new Date().toISOString() })
      .eq("branch_name", branchName)
      .eq("status", "active");
    if (error) {
      toast.error("초기화 실패");
    } else {
      toast.success("현재 활동 중 초기화 완료");
      loadActivitySessions();
    }
  };

  const fmtTime = (s: string) => new Date(s).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const elapsedMin = (t: number) => Math.floor((Date.now() - t) / 60000);

  const MemberAvatar = ({ url, name, sizeClass = "h-14 w-14" }: { url?: string | null; name: string; sizeClass?: string }) => (
    <Avatar className={`${sizeClass} border-2 border-gray-700`}>
      {url ? <AvatarImage src={url} alt={name} /> : null}
      <AvatarFallback className="bg-gray-800 text-white text-lg font-black">
        {name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div className="fixed inset-0 bg-gray-950 text-white overflow-hidden select-none" style={{ fontFamily: "'Black Han Sans', 'Noto Sans KR', sans-serif" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-3 bg-gray-900/90 border-b border-gray-800/60">
        <div className="flex items-center gap-5">
          <span className="text-5xl">🥊</span>
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">153 랭크업</h1>
            <p className="text-xl text-gray-400 font-bold mt-1">{branchName || "지점"}</p>
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
          {/* Admin reset button */}
          {isBranchManager && (
            <button onClick={handleResetActiveSessions} className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors" title="현재 활동 중 초기화">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden xl:inline">초기화</span>
            </button>
          )}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-black text-green-400 tabular-nums leading-none">{activeMembers.length}</p>
              <p className="text-base text-gray-500 mt-1 font-bold">활동 중</p>
            </div>
            <div className="text-center">
              <p className="text-5xl font-black text-orange-400 tabular-nums leading-none">{dailyVisits.length}</p>
              <p className="text-base text-gray-500 mt-1 font-bold">오늘 방문</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-gray-500 tabular-nums">
              {currentTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className={`h-4 w-4 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* ═══ Center: Main area ═══ */}
        <div className="flex-1 flex flex-col">
          {/* Main popup / idle */}
          <div className="flex-1 flex items-center justify-center relative px-8">
            {showPopup && latestPopup ? (
              <div
                className={`rounded-3xl border-4 px-20 py-16 ${RANK_COLORS[latestPopup.league_snapshot] || RANK_COLORS.white} ${RANK_GLOW[latestPopup.league_snapshot] || ""}`}
                style={{ minWidth: "55vw", maxWidth: "75vw", animation: "popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-6">
                    <MemberAvatar url={popupAvatarUrl} name={latestPopup.display_name_snapshot} sizeClass="h-28 w-28" />
                  </div>
                  <p className="text-[8rem] font-black leading-none tracking-tight mb-6" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
                    {latestPopup.display_name_snapshot}
                  </p>
                  <p className="text-5xl font-black opacity-80 mb-10">
                    {RANK_LABELS[latestPopup.league_snapshot] || latestPopup.league_snapshot} 리그 · 레벨 {latestPopup.level_snapshot}
                  </p>
                  <div className="inline-flex items-center gap-4 rounded-full bg-black/10 px-10 py-5">
                    <span className="text-4xl">🥊</span>
                    <span className="text-3xl font-black">복싱 레벨업 중</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-9xl mb-8">🥊</p>
                <p className="text-6xl font-black text-gray-600 leading-tight">153 랭크업 시스템</p>
                <p className="mt-6 text-4xl text-gray-700 font-black">오늘도 복싱 레벨업 중</p>
                <p className="mt-3 text-2xl text-gray-800 font-bold">{branchName}</p>
                {hallMembers.length > 0 && (
                  <div className="mt-8 inline-flex items-center gap-3 text-yellow-600/60">
                    <Trophy className="h-6 w-6" />
                    <span className="text-lg font-bold">명예의 전당 {hallMembers.length}명 등록</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Bottom: Hall of Fame banner ── */}
          {hallMembers.length > 0 && (
            <div className="mx-6 mb-4 rounded-2xl border-2 border-yellow-600/40 bg-gradient-to-r from-yellow-950/60 via-gray-900/80 to-yellow-950/60 px-8 py-6">
              <div className="flex items-center gap-4 mb-5">
                <Trophy className="h-10 w-10 text-yellow-500" />
                <h2 className="text-3xl font-black text-yellow-400 tracking-wide">명예의 전당</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-yellow-600/40 to-transparent" />
              </div>
              <div className="flex flex-wrap gap-4">
                {hallMembers.map((m) => (
                  <div key={m.r_user_id} className="flex items-center gap-4 rounded-xl border border-yellow-700/30 bg-yellow-900/20 px-6 py-4">
                    <MemberAvatar url={m.r_avatar_url} name={m.r_nickname} sizeClass="h-12 w-12" />
                    <div>
                      <p className="text-2xl font-black text-yellow-200 leading-tight">{m.r_nickname}</p>
                      <p className="text-base text-yellow-500/80 font-black">MASTER 40</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Right panel ═══ */}
        <div className="w-[26rem] bg-gray-900/60 border-l border-gray-800/60 flex flex-col">
          {/* Active members */}
          <div className="flex-shrink-0 border-b border-gray-800/60">
            <div className="px-5 py-4 flex items-center gap-3">
              <span className="h-4 w-4 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-2xl font-black text-green-400">현재 활동 중 ({activeMembers.length})</h2>
            </div>
            <div className="max-h-[28vh] overflow-y-auto px-3 pb-3">
              {activeMembers.length === 0 ? (
                <div className="text-center py-6 text-gray-600"><p className="text-xl">활동 중인 회원 없음</p></div>
              ) : (
                <div className="space-y-2">
                  {activeMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-4 rounded-xl bg-gray-800/40 px-4 py-4 group">
                      <MemberAvatar url={m.avatar_url} name={m.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-2xl font-black text-white truncate leading-tight">{m.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded text-sm font-black ${RANK_BADGE_COLORS[m.league] || "bg-gray-700 text-gray-300"}`}>
                            {RANK_LABELS[m.league] || m.league}
                          </span>
                          <span className="text-lg text-gray-400 font-bold">L{m.level}</span>
                          <span className="text-gray-600">·</span>
                          <Clock className="h-4 w-4 text-gray-500 inline" />
                          <span className="text-lg text-gray-500 font-bold">{elapsedMin(m.startedAt)}분</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Today visits — deduplicated */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-800/40 sticky top-0 bg-gray-900/90 backdrop-blur-sm z-10">
              <h2 className="text-2xl font-black text-gray-400">📋 오늘 방문 ({dailyVisits.length})</h2>
            </div>
            <div className="px-3 py-2">
              {dailyVisits.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <p className="text-4xl mb-3">🥊</p>
                  <p className="text-xl font-bold">아직 체크인이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {dailyVisits.map((v) => (
                    <div key={v.user_id} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-gray-800/30 transition-colors">
                      <MemberAvatar url={avatarMap[v.user_id]} name={v.display_name} sizeClass="h-11 w-11" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xl font-black text-gray-200 truncate leading-tight">{v.display_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-black ${RANK_BADGE_COLORS[v.league] || "bg-gray-700 text-gray-300"}`}>
                            {RANK_LABELS[v.league] || v.league}
                          </span>
                          <span className="text-sm text-gray-500 font-bold">L{v.level}</span>
                        </div>
                      </div>
                      <span className="text-lg text-gray-500 tabular-nums font-black">{fmtTime(v.last_checkin_at)}</span>
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
