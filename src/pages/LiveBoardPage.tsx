import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import SDBoxerCharacter from "@/components/SDBoxerCharacter";
import CharacterSprite from "@/components/CharacterSprite";
import { useParams } from "react-router-dom";
import { resolveBranchCode } from "@/lib/branchAlias";
import markWhite from "@/assets/branding/153-mark-white.png";
import { supabase } from "@/integrations/supabase/client";
import { RANK_LABELS } from "@/lib/rankLabels";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Clock, X, Trophy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import LiveBoardEmptyState from "@/components/liveBoard/LiveBoardEmptyState";
import LiveGymRaidStrip from "@/components/liveBoard/LiveGymRaidStrip";
import LiveSpotlightStage from "@/components/liveBoard/LiveSpotlightStage";
import LiveCompactGrid from "@/components/liveBoard/LiveCompactGrid";
import LiveLevelUpInterrupt, {
  type LevelUpEvent,
} from "@/components/liveBoard/LiveLevelUpInterrupt";
import LiveBoardTestPanel from "@/components/liveBoard/LiveBoardTestPanel";
import {
  generateMockMembers,
  type MockActiveMember,
} from "@/components/liveBoard/liveBoardMock";

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
  /** member_character_assignments → character_presets.parts_json (사용자 설정 캐릭터) */
  partsJson?: { style?: string; customization?: Record<string, unknown> } | null;
}

/**
 * 얼굴 출석 후 "운동 중"으로 보여줄 시간(분).
 * 브로제이가 퇴실을 기록하지 않아 시간으로 추정한다. 늘리면 화면이 풍성해지지만
 * 이미 나간 회원이 오래 남고, 줄이면 정확하지만 한가한 시간에 보드가 빨리 빈다.
 */
const CHECKIN_ACTIVE_MINUTES = 120;

interface HallMember {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_bosses_cleared: number;
}

/**
 * 회원 아바타 — 모듈 스코프로 hoist.
 * (이전엔 LiveBoardPage 본문 안에 정의되어 매 렌더마다 새 컴포넌트 identity 가
 *  생성 → 아바타가 매번 remount 되며 깜빡였다. props 만으로 동작하므로 밖으로 이동.)
 */
const MemberAvatar = ({
  url,
  name,
  sizeClass = "h-14 w-14",
}: {
  url?: string | null;
  name: string;
  sizeClass?: string;
}) => (
  <Avatar className={`${sizeClass} border-2 border-gray-700`}>
    {url ? <AvatarImage src={url} alt={name} /> : null}
    <AvatarFallback className="bg-gray-800 text-white text-lg font-black">
      {name.charAt(0)}
    </AvatarFallback>
  </Avatar>
);

const LiveBoardPage = () => {
  const { branchCode: rawBranchCode, screen } = useParams<{ branchCode: string; screen?: string }>();
  // /tv/s 처럼 한 글자로 들어와도 지점을 찾아낸다 (TV 리모컨 입력 편의).
  const branchCode = resolveBranchCode(rawBranchCode);
  // 사이니지 2대를 나란히 놓았을 때 좌·우로 나눠 띄운다.
  //   /tv/sunreung/1 → 지금 운동 중인 회원만 (크게)
  //   /tv/sunreung/2 → 오늘 방문 명단 + 명예의 전당 + 짐 레이드
  //   번호를 안 붙이면 예전처럼 한 화면에 전부 나온다.
  const only1 = screen === "1";
  const only2 = screen === "2";
  const [branchName, setBranchName] = useState("");
  const [dailyVisits, setDailyVisits] = useState<DailyVisit[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [hallMembers, setHallMembers] = useState<HallMember[]>([]);
  const [latestPopup, setLatestPopup] = useState<CheckinEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 레벨업 인터럽트 큐 (한 번에 하나)
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const knownLevelsRef = useRef<Map<string, number>>(new Map());

  // 테스트 모드 — 가상 회원 (DB 변경 없음)
  const [mockMembers, setMockMembers] = useState<MockActiveMember[]>([]);


  const [connected, setConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  /**
   * 얼굴 출석(브로제이) 회원을 "지금 운동 중"으로 올린다.
   *
   * 왜 필요한가: 화면 가운데는 원래 activity_sessions(앱에서 직접 "운동 시작"을 누른 기록)만
   * 봤는데, 회원들은 출입구에서 얼굴만 찍고 들어가지 앱을 켜지 않는다. 그래서 실제로는
   * 사람이 가득한 시간에도 보드가 늘 0명이었다.
   *
   * 브로제이는 입실만 기록하고 퇴실은 남기지 않는다. 그래서 "언제까지 운동 중인가"는
   * 시간으로 판단할 수밖에 없다 — 입실 후 CHECKIN_ACTIVE_MINUTES 동안 운동 중으로 본다.
   * (대표님 결정: 120분. 50분 수업 + 씻고 나가는 시간까지 넉넉히 잡은 값)
   *
   * 앱에서 실제 운동세션을 시작한 회원은 activeMembers 에 이미 있으므로 중복 제외한다.
   */
  const checkinMembers = useMemo<ActiveMember[]>(() => {
    const cutoff = currentTime.getTime() - CHECKIN_ACTIVE_MINUTES * 60_000;
    const already = new Set(activeMembers.map((m) => m.user_id));
    return dailyVisits
      .filter((v) => {
        if (already.has(v.user_id)) return false;
        const t = new Date(v.last_checkin_at).getTime();
        return Number.isFinite(t) && t >= cutoff;
      })
      .map((v) => ({
        id: `checkin-${v.user_id}`,
        user_id: v.user_id,
        name: v.display_name,
        league: v.league,
        level: v.level,
        startedAt: new Date(v.last_checkin_at).getTime(),
        avatar_url: null,
        partsJson: null,
      }));
  }, [dailyVisits, activeMembers, currentTime]);

  /** 앱 운동세션 + 얼굴 출석 + mock 을 합쳐 시각효과에 전달 */
  const combinedMembers = useMemo<ActiveMember[]>(
    () => [...activeMembers, ...checkinMembers, ...mockMembers],
    [activeMembers, checkinMembers, mockMembers],
  );
  const [popupAvatarUrl, setPopupAvatarUrl] = useState<string | null>(null);
  const [popupPartsJson, setPopupPartsJson] = useState<{ style?: string; customization?: Record<string, unknown> } | null>(null);

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
    // 공개 안전컬럼 뷰 사용 (민감정보 제외, 회원 간 닉네임/아바타만 노출)
    const { data } = await (supabase as any).from("public_profiles").select("avatar_url").eq("user_id", userId).single();
    const url = data?.avatar_url || null;
    avatarCacheRef.current[userId] = url;
    setAvatarMap(prev => ({ ...prev, [userId]: url }));
    return url;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock — update every 15s so elapsed times refresh
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // 사이니지(TV)에서 화면이 저절로 꺼지지 않게 잡아둔다.
  // 브라우저가 지원할 때만 동작하고, 탭이 뒤로 갔다 돌아오면 다시 잡는다.
  useEffect(() => {
    type WakeLockSentinelLike = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* 배터리 절약 모드 등 — 못 잡아도 화면은 그대로 나온다 */
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
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

    // Auto-end stale sessions (>60 minutes old)
    // ⚠️ RPC 경유 — 직접 UPDATE 는 RLS(본인·super_admin만)에 걸려 비로그인 TV 에서 0행 무음 실패했다.
    await (supabase.rpc as any)("end_stale_sessions", { _branch_name: branchName });

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

    // 공개 안전컬럼 뷰 사용 (민감정보 제외)
    type PublicProfileLite = { user_id: string; nickname: string | null; avatar_url: string | null };
    const { data: profiles } = (await (supabase as any)
      .from("public_profiles")
      .select("user_id, nickname, avatar_url")
      .in("user_id", userIds)) as { data: PublicProfileLite[] | null };

    const { data: progressData } = await supabase
      .from("member_progress")
      .select("user_id, current_rank, current_level")
      .in("user_id", userIds);

    // 회원이 설정한 캐릭터 (member_character_assignments → character_presets.parts_json)
    // anon RLS 거부 가능 — 거부 시 빈 배열, fallback 으로 letter avatar 사용
    const { data: charAssignments } = await supabase
      .from("member_character_assignments")
      .select("user_id, character_presets(parts_json)")
      .in("user_id", userIds)
      .eq("is_active", true);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const progressMap = new Map((progressData || []).map(p => [p.user_id, p]));
    const charMap = new Map<string, { style?: string; customization?: Record<string, unknown> }>();
    for (const a of (charAssignments || [])) {
      const cp = (a as { character_presets?: { parts_json?: unknown } }).character_presets;
      const pj = cp?.parts_json as { style?: string; customization?: Record<string, unknown> } | undefined;
      if (pj && (a as { user_id: string }).user_id) {
        charMap.set((a as { user_id: string }).user_id, pj);
      }
    }

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
      const displayName = profile?.nickname || attendanceFallback?.display_name;
      if (!displayName) continue; // truly unknown user — skip

      const avatarUrl = profile?.avatar_url || null;
      avatarCacheRef.current[userId] = avatarUrl;

      const level = progress?.current_level || attendanceFallback?.level || 1;
      // 알려진 레벨 시드 — Realtime 비교용
      knownLevelsRef.current.set(userId, level);

      members.push({
        id: session.id,
        user_id: userId,
        name: displayName,
        league: progress?.current_rank || attendanceFallback?.league || "white",
        level,
        startedAt: new Date(session.started_at).getTime(),
        avatar_url: avatarUrl,
        partsJson: charMap.get(userId) ?? null,
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

      // Prefetch avatars + 알려진 레벨 시드 (Realtime 비교용)
      for (const v of visits) {
        getAvatarUrl(v.user_id);
        if (!knownLevelsRef.current.has(v.user_id)) {
          knownLevelsRef.current.set(v.user_id, v.level);
        }
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

    // 회원이 설정한 캐릭터 fetch (RLS 거부 시 null fallback)
    try {
      const { data } = await supabase
        .from("member_character_assignments")
        .select("character_presets(parts_json)")
        .eq("user_id", event.user_id)
        .eq("is_active", true)
        .maybeSingle();
      const cp = (data as { character_presets?: { parts_json?: unknown } } | null)
        ?.character_presets;
      const pj = cp?.parts_json as
        | { style?: string; customization?: Record<string, unknown> }
        | undefined;
      setPopupPartsJson(pj ?? null);
    } catch {
      setPopupPartsJson(null);
    }

    setLatestPopup(event);
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), 7000);
  }, [getAvatarUrl]);

  /**
   * member_progress 의 current_level 이 증가할 때 인터럽트 발동.
   *
   * Ref 패턴: activeMembers/dailyVisits 가 자주 변해서 채널을 자주 재구독하면 안 됨 →
   * 항상 최신 state 를 참조할 수 있게 ref 로 래핑.
   */
  const activeMembersRef = useRef(activeMembers);
  const dailyVisitsRef = useRef(dailyVisits);
  const avatarMapRef = useRef(avatarMap);
  useEffect(() => {
    activeMembersRef.current = activeMembers;
  }, [activeMembers]);
  useEffect(() => {
    dailyVisitsRef.current = dailyVisits;
  }, [dailyVisits]);
  useEffect(() => {
    avatarMapRef.current = avatarMap;
  }, [avatarMap]);

  const triggerLevelUp = useCallback(
    async (userId: string, oldLevel: number, newLevel: number, league: string) => {
      const active = activeMembersRef.current.find((m) => m.user_id === userId);
      const visit = dailyVisitsRef.current.find((v) => v.user_id === userId);
      const name = active?.name || visit?.display_name;
      if (!name) return; // 이름 모르면 패스 (다른 지점 회원일 수 있음)

      const avatar =
        active?.avatar_url ?? avatarMapRef.current[userId] ?? (await getAvatarUrl(userId));

      // 회원 설정 캐릭터 — 활동 중이면 이미 가지고 있고, 아니면 fetch
      let partsJson = active?.partsJson ?? null;
      if (!partsJson) {
        try {
          const { data } = await supabase
            .from("member_character_assignments")
            .select("character_presets(parts_json)")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          const cp = (data as { character_presets?: { parts_json?: unknown } } | null)
            ?.character_presets;
          partsJson = (cp?.parts_json as { style?: string; customization?: Record<string, unknown> } | undefined) ?? null;
        } catch {
          /* RLS 거부 — letter fallback */
        }
      }

      setLevelUpEvent({
        eventId: `${userId}-${newLevel}-${Date.now()}`,
        user_id: userId,
        name,
        league,
        oldLevel,
        newLevel,
        avatar_url: avatar,
        partsJson,
      });
    },
    [getAvatarUrl],
  );

  // Realtime subscriptions
  useEffect(() => {
    if (!branchName) return;
    const channel = supabase
      .channel(`live-board-${branchName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs", filter: `branch_name=eq.${branchName}` },
        (payload) => {
          const n = payload.new as any;
          // 백필·과거 데이터 가드: 중복 표시 행이거나 KST 오늘이 아니면 무시 —
          // 과거 30일 백필이 TV 에 팝업 폭풍·시각 회귀를 일으키는 것을 막는다.
          if (n.is_duplicate) return;
          const kstMs = Date.now() + 9 * 3600 * 1000;
          const kstDayStart = Math.floor(kstMs / 86400000) * 86400000 - 9 * 3600 * 1000;
          const t = new Date(n.checked_in_at).getTime();
          if (!Number.isFinite(t) || t < kstDayStart) return;
          const event: CheckinEvent = { id: n.id, display_name_snapshot: n.display_name_snapshot, league_snapshot: n.league_snapshot, level_snapshot: n.level_snapshot, checked_in_at: n.checked_in_at, user_id: n.user_id };
          getAvatarUrl(n.user_id);
          // Update daily visits (deduplicated)
          setDailyVisits(prev => {
            const exists = prev.find(v => v.user_id === n.user_id);
            if (exists) {
              // 최신 시각일 때만 갱신 — 늦게 도착한 과거 행이 시각을 되돌리지 않게
              if (new Date(exists.last_checkin_at).getTime() >= t) return prev;
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "member_progress" },
        (payload) => {
          // 운영 DB 모든 지점의 회원 변경이 들어옴 — member_progress 에는 branch
          // 컬럼이 없어 서버 필터가 불가. knownLevelsRef 는 이 지점의 활동/방문
          // 회원으로만 시드되므로, 그것으로 우리 지점 회원인지 판별해 처리한다.
          const n = payload.new as { user_id: string; current_level: number; current_rank: string };
          const o = payload.old as { current_level?: number };
          if (!n?.user_id || typeof n.current_level !== "number") return;
          const knownToBranch = knownLevelsRef.current.has(n.user_id);
          const oldLevel = typeof o?.current_level === "number"
            ? o.current_level
            : knownLevelsRef.current.get(n.user_id);
          if (oldLevel === undefined) return; // 모르는 회원 (다른 지점) — 무시
          if (n.current_level > oldLevel) {
            void triggerLevelUp(n.user_id, oldLevel, n.current_level, n.current_rank || "white");
          }
          knownLevelsRef.current.set(n.user_id, n.current_level);
          // 다른 지점 회원의 변경으로 무거운 loadActivitySessions() 를 호출하지 않음 —
          // 이 지점에서 활동/방문한 회원의 변경일 때만 세션을 다시 불러온다.
          if (knownToBranch) void loadActivitySessions();
        })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [branchName, triggerPopup, loadActivitySessions, getAvatarUrl, triggerLevelUp]);

  // Reconnect fallback
  useEffect(() => {
    const i = setInterval(() => { if (!connected) { loadToday(); loadActivitySessions(); } }, 10000);
    return () => clearInterval(i);
  }, [connected, loadToday, loadActivitySessions]);

  const handleBranchSwitch = (name: string) => {
    window.location.href = `/live-board/${encodeURIComponent(name)}`;
  };

  // Force-exit a single member (admin/manager) — mock 회원은 화면에서만 제거
  const handleForceExit = async (sessionId: string, memberName: string) => {
    if (sessionId.startsWith("mock-")) {
      setMockMembers((prev) => prev.filter((m) => m.id !== sessionId));
      return;
    }
    const { data, error } = await (supabase.rpc as any)("force_end_session", { _session_id: sessionId });
    if (error || !data?.success) {
      toast.error(error?.message?.includes("authorized") ? "권한이 없습니다 (관리자 로그인 필요)" : "퇴장 처리 실패");
    } else {
      toast.success(`${memberName} 퇴장 처리 완료`);
      loadActivitySessions();
    }
  };

  // ── 테스트 패널 콜백 ──
  const handleMockAdd = useCallback((count: number, asFresh = false) => {
    setMockMembers((prev) => [...prev, ...generateMockMembers(count, { fresh: asFresh })]);
  }, []);
  const handleMockRemoveOne = useCallback(() => {
    setMockMembers((prev) => prev.slice(0, -1));
  }, []);
  const handleMockReset = useCallback(() => {
    setMockMembers([]);
  }, []);
  const handleMockTriggerLevelUp = useCallback(() => {
    setMockMembers((prev) => {
      if (prev.length === 0) return prev;
      const target = prev[Math.floor(Math.random() * prev.length)];
      const newLevel = Math.min(target.level + 1, 10);
      // 인터럽트 발동
      setLevelUpEvent({
        eventId: `${target.user_id}-${newLevel}-${Date.now()}`,
        user_id: target.user_id,
        name: target.name,
        league: target.league,
        oldLevel: target.level,
        newLevel,
        avatar_url: target.avatar_url,
      });
      // mock 회원 레벨도 갱신
      return prev.map((m) =>
        m.user_id === target.user_id ? { ...m, level: newLevel } : m,
      );
    });
  }, []);

  // Reset all active sessions for this branch (admin tool)
  const handleResetActiveSessions = async () => {
    if (!branchName) return;
    const { data, error } = await (supabase.rpc as any)("reset_active_sessions", { _branch_name: branchName });
    if (error) {
      toast.error(error.message?.includes("authorized") ? "권한이 없습니다 (관리자 로그인 필요)" : "초기화 실패");
    } else {
      toast.success(`현재 활동 중 초기화 완료 (${Number(data) || 0}명)`);
      loadActivitySessions();
    }
  };

  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
  const elapsedMin = (t: number) => {
    const mins = Math.floor((Date.now() - t) / 60000);
    return mins > 120 ? "–" : mins; // Cap abnormal durations
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 text-white overflow-hidden select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-3 bg-gray-900/90 border-b border-gray-800/60">
        <div className="flex items-center gap-5">
          {/* 153 공식 심볼. 예전엔 🥊 이모지였는데 기기·폰트마다 모양이 달라 브랜드가 흔들렸다. */}
          <img
            src={markWhite}
            alt="153 BOXING GYM"
            className="h-14 w-auto shrink-0"
            draggable={false}
          />
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">마이복서153</h1>
            <p className="text-xs font-bold tracking-[0.25em] text-yellow-400">MY BOXER 153</p>
            <p className="text-lg text-gray-400 font-bold mt-0.5">{branchName || "지점"}</p>
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
              <p className="text-5xl font-black text-green-400 tabular-nums leading-none">{combinedMembers.length}</p>
              <p className="text-base text-gray-500 mt-1 font-bold">활동 중</p>
            </div>
            <div className="text-center">
              <p className="text-5xl font-black text-orange-400 tabular-nums leading-none">{dailyVisits.length}</p>
              <p className="text-base text-gray-500 mt-1 font-bold">오늘 방문</p>
            </div>
          </div>
          <div className="text-right">
            {/* 사이니지 기기는 공장 초기 표준시(UTC 등)로 놓인 경우가 많아 timeZone 을 못 박는다.
                기기 시계만 맞으면 지역 설정이 틀려도 한국 시각으로 나온다. */}
            <p className="text-lg font-bold text-gray-500 leading-none">
              {currentTime.toLocaleDateString("ko-KR", {
                month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul",
              })}
            </p>
            <p className="mt-1.5 text-3xl font-black text-gray-500 tabular-nums leading-none">
              {currentTime.toLocaleTimeString("ko-KR", {
                hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul",
              })}
            </p>
          </div>
          <div className={`h-4 w-4 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        </div>
      </div>

      {/* 헤더 높이를 숫자로 빼지 않는다. 예전엔 calc(100vh-80px) 였는데 실제 헤더는 109px 이라
          29px 이 화면 밖으로 밀려 명예의 전당 띠 아래가 잘려 있었다. flex-1 이면 항상 정확하다. */}
      <div className={`flex min-h-0 flex-1 ${only2 ? "flex-col" : ""}`}>
        {/* ═══ Center: Main area — 명예의 전당 sticky bottom + 위쪽만 스크롤 ═══ */}
        <div className={`flex flex-col min-w-0 overflow-hidden ${only2 ? "flex-shrink-0" : "flex-1"}`}>
          {/* 상단: 스포트라이트 + 컴팩트 그리드 (37명까지 스크롤 없이 fit) */}
          {!only2 && (
          <div className="flex-1 flex flex-col relative px-4 py-2 overflow-y-auto min-h-0">
            {/*
              Cinematic 업그레이드:
              · 새 입실 popup 은 그대로 유지 (큰 SDBoxerCharacter, 7초 표시)
              · 그 외 시간엔 활동 중 회원 그리드 (LiveActiveMemberCard 풀 사이즈)
              · 활동 0명일 때는 시그니처 빈 상태 (LiveBoardEmptyState)
            */}
            {showPopup && latestPopup ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                {popupPartsJson ? (
                  <CharacterSprite
                    partsJson={popupPartsJson}
                    size="lg"
                    league={(latestPopup.league_snapshot as "white" | "blue" | "red" | "black") || "white"}
                    level={latestPopup.level_snapshot}
                    animate
                  />
                ) : (
                  <SDBoxerCharacter
                    league={(latestPopup.league_snapshot as "white" | "blue" | "red" | "black") || "white"}
                    nickname={latestPopup.display_name_snapshot}
                    level={latestPopup.level_snapshot}
                    state="enter"
                  />
                )}
                {/* 캐릭터일 때는 이름/리그 별도 표시 (SDBoxerCharacter 는 자체 포함) */}
                {popupPartsJson && (
                  <div className="text-center">
                    <p
                      className="text-4xl font-black text-white"
                      style={{ textShadow: "0 4px 20px rgba(0,0,0,0.8)" }}
                    >
                      {latestPopup.display_name_snapshot}
                    </p>
                    <p className="mt-1 text-xl font-bold text-emerald-300">
                      입실! · Lv.{latestPopup.level_snapshot}
                    </p>
                  </div>
                )}
              </div>
            ) : combinedMembers.length > 0 ? (
              <div className="flex flex-1 flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-base font-black tracking-wide text-emerald-300">
                    🥊 지금 운동 중
                  </h2>
                  <p className="number-font text-base font-black text-emerald-400 tabular-nums">
                    {combinedMembers.length}
                    <span className="ml-1 text-xs text-emerald-500/70">명</span>
                  </p>
                  {mockMembers.length > 0 && (
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-black text-purple-300">
                      mock {mockMembers.length}
                    </span>
                  )}
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
                </div>

                {/* 스포트라이트 무대 — 항상 표시 (1명도 OK) */}
                <LiveSpotlightStage
                  members={combinedMembers}
                  getElapsedMinutes={(t) => {
                    const v = elapsedMin(t);
                    return typeof v === "number" ? v : 0;
                  }}
                  showForceExit={isBranchManager}
                  onForceExit={(sessionId, name) => handleForceExit(sessionId, name)}
                />

                {/* 컴팩트 그리드 — 5명 이상일 때만 (3명 이하면 스포트라이트만으로 충분) */}
                {combinedMembers.length >= 5 && (
                  <LiveCompactGrid
                    members={combinedMembers}
                    getElapsedMinutes={(t) => {
                      const v = elapsedMin(t);
                      return typeof v === "number" ? v : 0;
                    }}
                    showForceExit={isBranchManager}
                    onForceExit={(sessionId, name) => handleForceExit(sessionId, name)}
                  />
                )}
              </div>
            ) : (
              <LiveBoardEmptyState
                branchName={branchName}
                todayVisitCount={dailyVisits.length}
                hallOfFameCount={hallMembers.length}
              />
            )}
          </div>

          )}

          {/* ── Bottom: Hall of Fame banner ── */}
          {/* 명예의 전당 — 항상 맨 아래 sticky, 한 줄, 가로 스크롤 */}
          {/* 명예의 전당 — 달성자가 없어도 한 줄은 늘 자리를 지킨다.
              비워두면 초라해 보이지만, 목표가 걸려 있는 띠는 회원에게 "저기까지 가면 이름이 올라간다"로 읽힌다. */}
          {!only1 && (
            <div className="mx-4 mb-3 flex-shrink-0 rounded-xl border border-yellow-600/40 bg-gradient-to-r from-yellow-950/60 via-gray-900/80 to-yellow-950/60 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-base font-black text-yellow-400 tracking-wide whitespace-nowrap">
                    명예의 전당
                  </h2>
                  {hallMembers.length > 0 && (
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-black text-yellow-300 tabular-nums">
                      {hallMembers.length}
                    </span>
                  )}
                </div>
                {hallMembers.length > 0 ? (
                  <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                    {hallMembers.map((m) => (
                      <div
                        key={m.r_user_id}
                        className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-yellow-700/30 bg-yellow-900/20 px-2.5 py-1"
                      >
                        <MemberAvatar url={m.r_avatar_url} name={m.r_nickname} sizeClass="h-7 w-7" />
                        <div>
                          <p className="text-sm font-black text-yellow-200 leading-tight whitespace-nowrap">
                            {m.r_nickname}
                          </p>
                          <p className="text-[10px] text-yellow-500/80 font-black">MASTER 40</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-yellow-700/40 px-3 py-1.5">
                    <p className="text-sm font-black text-yellow-500/70 whitespace-nowrap">
                      첫 마스터의 자리 · 블랙 리그 레벨 10 + 보스 4 달성
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Right panel ═══ */}
        {!only1 && (
        <div className={`bg-gray-900/60 flex flex-col min-h-0 ${only2 ? "flex-1 w-full border-t border-gray-800/60" : "w-[26rem] border-l border-gray-800/60"}`}>
          {/* Active members — 인원수 많을 때 더 많이 보이게 flex-1 + 최소 절반 보장 */}
          <div className="flex-1 border-b border-gray-800/60 flex flex-col min-h-[40vh]">
            <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <span className="h-4 w-4 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-2xl font-black text-green-400">현재 활동 중 ({combinedMembers.length})</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {combinedMembers.length === 0 ? (
                <div className="text-center py-6 text-gray-600"><p className="text-xl">활동 중인 회원 없음</p></div>
              ) : (
                <div className="space-y-2">
                  {combinedMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-4 rounded-xl bg-gray-800/40 px-4 py-4 group">
                      <MemberAvatar url={m.avatar_url} name={m.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-2xl font-black text-white truncate leading-tight">{m.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded text-sm font-black ${RANK_BADGE_COLORS[m.league] || "bg-gray-700 text-gray-300"}`}>
                            {RANK_LABELS[m.league] || m.league} 리그
                          </span>
                          <span className="text-lg text-gray-400 font-bold">레벨 {m.level}</span>
                          <span className="text-gray-600">·</span>
                          <Clock className="h-4 w-4 text-gray-500 inline" />
                          <span className="text-lg text-gray-500 font-bold">{elapsedMin(m.startedAt)}분</span>
                        </div>
                      </div>
                      {isBranchManager && (
                        <button
                          onClick={() => handleForceExit(m.id, m.name)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-red-600/20 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-600/40"
                          title="퇴장 처리"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 짐 레이드 — sidebar variant (오늘 방문 자리에 표시) */}
          <div className="flex-shrink-0 overflow-y-auto p-4">
            {branchName && <LiveGymRaidStrip branchName={branchName} variant="sidebar" />}
          </div>
        </div>
        )}
      </div>

      {/* 레벨업 인터럽트 — 최상위 z-index, 5초 풀스크린 */}
      <LiveLevelUpInterrupt
        event={levelUpEvent}
        onDismiss={() => setLevelUpEvent(null)}
      />

      {/* ── 테스트 패널 (관리자 전용) — 가상 회원 추가/레벨업 시뮬레이트 ── */}
      {(isSuperAdmin || isBranchManager) && (
        <LiveBoardTestPanel
          mockCount={mockMembers.length}
          onAdd={handleMockAdd}
          onRemoveOne={handleMockRemoveOne}
          onReset={handleMockReset}
          onTriggerLevelUp={handleMockTriggerLevelUp}
        />
      )}

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
