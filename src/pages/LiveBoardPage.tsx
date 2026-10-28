import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import SDBoxerCharacter from "@/components/SDBoxerCharacter";
import CharacterSprite from "@/components/CharacterSprite";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { resolveBranchCode } from "@/lib/branchAlias";
import logoWhite from "@/assets/branding/153-logo-white.png";
import { supabase } from "@/integrations/supabase/client";
import { isBoardKeyError, readBoardKey } from "@/lib/boardKey";
import { RANK_LABELS, toGlobalLevel } from "@/lib/rankLabels";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import MedalMark, { setPreviewMedal } from "@/components/MedalMark";
import { Building2, Clock, X, Trophy, RotateCcw, Medal } from "lucide-react";
import { toast } from "sonner";
import LiveBoardEmptyState from "@/components/liveBoard/LiveBoardEmptyState";
import LiveGymRaidStrip from "@/components/liveBoard/LiveGymRaidStrip";
import LiveSpotlightStage from "@/components/liveBoard/LiveSpotlightStage";
import LiveCompactGrid from "@/components/liveBoard/LiveCompactGrid";
import NameBadge from "@/components/badges/NameBadge";
import LiveLevelUpInterrupt, {
  type LevelUpEvent,
} from "@/components/liveBoard/LiveLevelUpInterrupt";
import LiveBoardTestPanel from "@/components/liveBoard/LiveBoardTestPanel";
import LiveBoardQrCard from "@/components/liveBoard/LiveBoardQrCard";
import LaunchEventBoard from "@/components/liveBoard/LaunchEventBoard";
import { isPilotBranch } from "@/lib/pilotBranches";
import { STAFF_CHAMPION_LEVEL, honorTitle } from "@/lib/staffDisplay";
import {
  generateMockMember,
  generateMockMembers,
  type MockActiveMember,
} from "@/components/liveBoard/liveBoardMock";
import birthdayCake from "@/assets/birthday/cake.webp";
import fxAurora from "@/assets/effects/fx_aurora.png";
import fxGoldConfetti from "@/assets/effects/fx_gold_confetti.png";

/** 🎂 생일 회원 입장 환영은 보통(7초)보다 길게 — 다 같이 보고 축하할 시간 (2026-10-16 대표님) */
const POPUP_MS = 7000;
const BIRTHDAY_POPUP_MS = 12000;
/** 153 레코드(최초 기록) 보유자 입장 환영 — 금빛 판 10초 (2026-10-19 대표님 "가 적용시켜주고 10초정도") */
const RECORD_POPUP_MS = 10000;

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

/** 입장 환영 사진 테두리 — 리그 색 (RANK_COLORS 와 같은 계열, 2026-10-14) */
const WELCOME_RING: Record<string, string> = {
  white: "from-gray-200 to-gray-400",
  blue: "from-blue-300 to-blue-600",
  red: "from-red-300 to-red-600",
  black: "from-yellow-300 to-yellow-600",
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

/** 오늘 출석 한 줄 — board_checkins_today (age_sec = 서버에 들어온 지 몇 초, TV 시계와 무관) */
interface TodayCheckinRow extends CheckinEvent {
  is_duplicate: boolean;
  age_sec: number;
}

/** 방금 들어온 출석으로 보는 시간 — 얼굴 출석은 찍은 뒤 평균 3분 늦게 들어오므로 '들어온 시각' 기준 */
const FRESH_CHECKIN_SEC = 150;

/** 카드에 그릴 회원 정보 — board_people (오늘 이 지점에 왔거나 운동 중인 사람만 돌려준다) */
interface BoardPerson {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  is_staff: boolean | null;
  current_rank: string | null;
  current_level: number | null;
  parts_json: { style?: string; customization?: Record<string, unknown> } | null;
  card_mode: string | null;
}

/** 오늘 온 153 레코드 '최초' 기록 보유자 — board_record_holders (2026-10-19 대표님 가·나·라) */
interface RecordHolderRow {
  user_id: string;
  name: string | null;
  records: string[];
  first_at: string;
}

/** Deduplicated daily visit: one row per user */
interface DailyVisit {
  user_id: string;
  display_name: string;
  league: string;
  level: number;
  last_checkin_at: string;
}

/**
 * 지금 근무중인 코치 — 판정은 DB(public_staff_on_duty 뷰)가 한다.
 *
 * 브로제이는 출근만 기록하고 퇴근은 남기지 않는다(GO_TO_WORK 만 존재). 그래서
 * "언제까지 근무중인가" 는 시간으로 판단할 수밖에 없다 — 대표님 결정:
 *   · 지점장/관장/대표 : 오늘 출근했으면 하루 종일
 *   · 그 외 코치        : 출근 후 4시간
 *
 * 근거가 앱 계정이 아니라 브로제이 직원 출근이라, 앱에 가입하지 않은 코치도
 * 그대로 걸린다 — 대신 user_id 는 없을 수 있다.
 */
interface OnDutyCoach {
  user_id: string | null;
  name: string;
  title: string;
  avatar_url: string | null;
  checked_in_at: string;
}

/** 직함 정렬 — 관장이 앞, 그다음 수석, 나머지는 코치 */
const COACH_TITLE_ORDER: Record<string, number> = {
  "대표": 0, "관장": 0, "지점장": 0, "수석코치": 1, "헤드코치": 1,
};
const coachOrder = (title: string): number => COACH_TITLE_ORDER[title] ?? 2;

// 화면 표기용 직함(honorTitle)은 src/lib/staffDisplay 로 이동 — 홈 카드·마이페이지와 같은 규칙을 쓴다.

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
  /** PT 회원 — 카드 이름 옆 파란 배지 (ptIds 에서 채운다) */
  pt?: boolean;
  /** 🎂 오늘 생일 — 오로라·황금 버튼·HAPPY BIRTHDAY (birthdayIds 에서 채운다, 2026-10-16) */
  birthday?: boolean;
  /** 앱에서 받은 생일 축하 수 */
  birthdayCongrats?: number;
  /** 153 레코드 '최초' 기록 이름들 — 금빛 카드 (recordMap 에서 채운다, 2026-10-19) */
  records?: string[];
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

/** 마이복서153 랭킹 1·2·3위 (get_live_board_top3 — 앱 랭킹 '전체'와 같은 순서) */
interface TopRankMember {
  r_user_id: string;
  r_nickname: string;
  r_avatar_url: string | null;
  r_current_rank: string;
  r_current_level: number;
  r_position: number;
}

const TOP_TONE = [
  { ring: "border-[#F6C453]/60 bg-[#F6C453]/15", num: "bg-[#F6C453] text-black", name: "text-[#FCE7A8]" },
  { ring: "border-[#C9D1DC]/50 bg-[#C9D1DC]/10", num: "bg-[#C9D1DC] text-black", name: "text-[#E5EAF0]" },
  { ring: "border-[#C8874A]/50 bg-[#C8874A]/10", num: "bg-[#C8874A] text-black", name: "text-[#F1C9A0]" },
];

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
    <AvatarFallback className="bg-gray-800 text-white text-tv-micro font-black">
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
  const [onDutyStaff, setOnDutyStaff] = useState<OnDutyCoach[]>([]);
  // user_id → 직원 여부 캐시. Realtime 이벤트마다 다시 조회하지 않는다.
  const staffFlagRef = useRef<Map<string, boolean>>(new Map());
  /** is_staff 계정 id — 회원 목록에서 빼는 용도. 근무중 여부와는 별개다
   *  (4시간이 지나 띠에서 내려간 코치도 회원 그리드에 나타나면 안 된다). */
  const [staffUserIds, setStaffUserIds] = useState<Set<string>>(new Set());
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [hallMembers, setHallMembers] = useState<HallMember[]>([]);
  const [topRank, setTopRank] = useState<TopRankMember[]>([]);
  const [latestPopup, setLatestPopup] = useState<CheckinEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 레벨업 인터럽트 큐 (한 번에 하나)
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const knownLevelsRef = useRef<Map<string, number>>(new Map());

  /**
   * 카드 레벨은 '지금 레벨'로 (2026-10-16 대표님: "비볼 왜 랭킹에서 레벨 10인데 라이브 보드에선 9로 나와?")
   *   출석 기록(attendance_logs.level_snapshot)에는 출석하던 순간의 레벨이 찍힌다. 그 출석으로 자동 승급하면
   *   레벨이 곧바로 하나 오르는데, 카드는 출석 기록의 레벨을 그날 내내 보여 줬다(랭킹은 지금 레벨).
   *   TV(비로그인)는 member_progress 를 못 읽으므로, 오늘 이 지점에 온 회원의 리그·레벨만 돌려주는
   *   get_board_member_levels(한 번에 50명)로 오늘 명단을 읽을 때마다(1분마다) 다시 읽어 카드에 덮어쓴다.
   */
  const [liveLevels, setLiveLevels] = useState<Record<string, { league: string; level: number }>>({});
  const loadLiveLevels = useCallback(async (ids: string[]) => {
    if (!branchName || ids.length === 0) return;
    const got: Record<string, { league: string; level: number }> = {};
    for (let i = 0; i < ids.length; i += 50) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_board_member_levels", {
        p_branch: branchName, p_user_ids: ids.slice(i, i + 50),
      });
      if (error || !Array.isArray(data)) break; // 실패하면 그전 값을 그대로 둔다
      for (const r of data as { user_id: string; current_rank: string | null; current_level: number | null }[]) {
        if (r.current_level) got[r.user_id] = { league: r.current_rank || "white", level: r.current_level };
      }
    }
    setLiveLevels((prev) => {
      const changed = Object.entries(got).some(([id, v]) => prev[id]?.level !== v.level || prev[id]?.league !== v.league);
      return changed ? { ...prev, ...got } : prev;
    });
  }, [branchName]);

  // 테스트 모드 — 가상 회원 (DB 변경 없음)
  const [mockMembers, setMockMembers] = useState<MockActiveMember[]>([]);

  /**
   * TV 전용 읽기 (2026-10-19 회원 정보 잠그기) — 예전엔 공개된 표(public_profiles·출석·운동·캐릭터)를 직접 읽었다.
   * 이제 board_* 함수가 '오늘 이 지점에 온 회원'만 준다. 지점에 TV 열쇠가 걸렸는데 이 TV 에 없으면 안내를 띄운다.
   * 실패하면 null — 부르는 쪽은 그전 화면을 그대로 둔다.
   */
  const [keyRequired, setKeyRequired] = useState(false);
  const boardRpc = useCallback(async <T,>(fn: string, args: Record<string, unknown>): Promise<T[] | null> => {
    if (!branchName) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(fn, { p_branch: branchName, p_key: readBoardKey(branchName), ...args });
    if (error) {
      if (isBoardKeyError(error)) setKeyRequired(true);
      return null;
    }
    setKeyRequired(false);
    return Array.isArray(data) ? (data as T[]) : [];
  }, [branchName]);
  /** 마지막으로 읽은 오늘 출석 (최신이 앞) — 운동 중 카드의 이름 대신 쓰기 */
  const todayRowsRef = useRef<TodayCheckinRow[]>([]);
  /** 이미 본 출석 id — 새 출석에만 환영 화면을 띄운다 (첫 읽기는 조용히 기억만) */
  const seenCheckinIdsRef = useRef<Set<string>>(new Set());
  const firstTodayLoadRef = useRef(true);
  /** 새 출석이 들어왔을 때 할 일 — 아래에서 채운다 (환영 화면 · 운동 중 다시 읽기 · 레벨업 확인) */
  const onNewCheckinRef = useRef<(row: TodayCheckinRow) => void>(() => {});


  // 실시간 구독 상태 — SUBSCRIBED 를 받기 전까지는 '끊김' 으로 보고 10초 폴링으로 메운다.
  // (예전엔 true 로 시작해서, 구독이 한 번도 안 된 TV 는 초록불인 채 20분 새로고침만 기다렸다)
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 회원 사진을 새 자리(입장 환영 화면 · 얼굴/QR 출석 카드)에도 쓰는 TV — 시범 지점(선릉역점)부터 (2026-10-14 대표님:
  // "잠실점 역삼점은 일단 빼줘"). 다른 지점 TV 는 어제처럼 캐릭터·이니셜 (앱 운동 카드·레벨업 연출의 사진은 원래대로).
  const boardPhotos = isPilotBranch(branchName);

  // Avatar cache with state to trigger re-renders
  // (얼굴·QR 출석 회원 카드도 이 사진을 쓰므로 checkinMembers 보다 먼저 선언한다 — 2026-10-14)
  const avatarCacheRef = useRef<Record<string, string | null>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  // 회원 캐릭터 + '카드에 보일 것'(자동·사진·캐릭터) — 얼굴·QR 출석 회원도 캐릭터가 뜨게 (2026-10-15 대표님)
  type PartsJson = { style?: string; customization?: Record<string, unknown> };
  const lookLoadedRef = useRef<Set<string>>(new Set());
  const [charLookMap, setCharLookMap] = useState<Record<string, PartsJson | null>>({});
  const [displayPrefMap, setDisplayPrefMap] = useState<Record<string, "auto" | "photo" | "character">>({});
  /** 기억해 둔 캐릭터 — 환영 화면·레벨업 연출이 다시 읽기 전에 쓴다 */
  const charLookMapRef = useRef(charLookMap);
  useEffect(() => {
    charLookMapRef.current = charLookMap;
  }, [charLookMap]);
  /** board_people 로 받은 정보를 한 번에 기억 — 코치 여부 · 사진 · 캐릭터 · 카드에 보일 것 */
  const absorbPeople = useCallback((list: BoardPerson[]) => {
    if (list.length === 0) return;
    const nextAvatars: Record<string, string | null> = {};
    const nextChars: Record<string, PartsJson | null> = {};
    const nextPrefs: Record<string, "auto" | "photo" | "character"> = {};
    for (const p of list) {
      staffFlagRef.current.set(p.user_id, p.is_staff === true);
      const url = p.avatar_url || null;
      avatarCacheRef.current[p.user_id] = url;
      nextAvatars[p.user_id] = url;
      lookLoadedRef.current.add(p.user_id);
      if (p.parts_json) nextChars[p.user_id] = p.parts_json;
      if (p.card_mode === "photo" || p.card_mode === "character" || p.card_mode === "auto") nextPrefs[p.user_id] = p.card_mode;
    }
    setAvatarMap((prev) => (Object.entries(nextAvatars).every(([id, u]) => prev[id] === u) ? prev : { ...prev, ...nextAvatars }));
    if (Object.keys(nextChars).length) setCharLookMap((prev) => ({ ...prev, ...nextChars }));
    if (Object.keys(nextPrefs).length) setDisplayPrefMap((prev) => ({ ...prev, ...nextPrefs }));
  }, []);

  /** 오늘 이 지점에 온 사람들의 카드 정보 — 300명씩. 실패하면 null (알던 값을 그대로 둔다) */
  const fetchPeople = useCallback(async (ids: string[]): Promise<Map<string, BoardPerson> | null> => {
    const out = new Map<string, BoardPerson>();
    for (let i = 0; i < ids.length; i += 300) {
      const rows = await boardRpc<BoardPerson>("board_people", { p_user_ids: ids.slice(i, i + 300) });
      if (rows === null) return null;
      for (const r of rows) out.set(r.user_id, r);
    }
    absorbPeople([...out.values()]);
    return out;
  }, [boardRpc, absorbPeople]);

  const loadCardLooks = useCallback(async (ids: string[]) => {
    const fresh = ids.filter((id) => !lookLoadedRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => lookLoadedRef.current.add(id));
    await fetchPeople(fresh);
  }, [fetchPeople]);

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
        // 회원이 올린 프로필 사진 — TV 가 읽어 둔 값(getAvatarUrl → avatarMap). 입실하면 새로 읽는다.
        // 예전엔 null 고정이라 얼굴·QR 출석 회원은 사진을 올려도 '활동 중' 칸에 글자만 나왔다 (2026-10-14 대표님)
        avatar_url: boardPhotos ? avatarMap[v.user_id] ?? null : null,
        partsJson: charLookMap[v.user_id] ?? null,
      }));
  }, [dailyVisits, activeMembers, currentTime, avatarMap, boardPhotos, charLookMap]);

  /** 지금 운동 중인 회원 id — 아래 이름 티커에서 밝게 구분하는 데 쓴다 */
  const activeUserIds = useMemo(
    () => new Set([...activeMembers, ...checkinMembers].map((m) => m.user_id)),
    [activeMembers, checkinMembers],
  );

  /**
   * PT 회원 파란 배지 (2026-10-14 대표님: "블루버튼 — 앱에서는 보이는데 pt 회원님들").
   * TV 는 로그인하지 않아 PT 기간을 직접 못 읽는다 — DB 가 "이 지점에 오늘 왔거나 운동 중인 PT 회원 id" 만 준다.
   * 화면에 오는 회원이 바뀔 때(입실·운동 시작/종료)와 10분마다 다시 묻는다 — 한 번 실패해도, PT 등록(매시 동기화)이
   * 바뀌어도 늦어도 10분 안에 맞춰진다. 실패하면 그전 배지를 그대로 둔다.
   */
  const [ptIds, setPtIds] = useState<Set<string>>(() => new Set());
  const presentKey = useMemo(() => Array.from(activeUserIds).sort().join(","), [activeUserIds]);
  const ptRefreshSlot = Math.floor(currentTime.getTime() / 600_000);
  useEffect(() => {
    if (!branchName || !presentKey) return;
    let cancelled = false;
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_live_board_pt_members", { _branch_name: branchName });
      if (cancelled || error || !Array.isArray(data)) return;
      const next = new Set((data as { user_id: string }[]).map((r) => r.user_id));
      setPtIds((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next));
    })();
    return () => { cancelled = true; };
  }, [branchName, presentKey, ptRefreshSlot]);

  /**
   * 🎂 오늘 생일인 회원 (2026-10-16 대표님: "생일 회원이 운동하러 오면 오로라 표시와 황금버튼, 생일축하 표시 —
   * 다른 회원님들이 축하하는 문화를 만들자"). PT 배지와 같은 방식 — TV 는 생년월일을 못 읽으므로 DB 가
   * "오늘 생일이고 오늘 이 지점에 왔거나 운동 중인 회원 id" 만 준다. 오늘 다녀간 명단이 바뀔 때와 10분마다 다시 묻는다
   * (자정이 지나면 다음 날 생일로 바뀐다). 입장 환영 화면은 입실하는 순간 따로 확인한다(triggerPopup).
   */
  const [birthdayIds, setBirthdayIds] = useState<Set<string>>(() => new Set());
  /** 오늘 온 회원 중 153 레코드 '최초' 기록 보유자 → 기록 이름들 (2026-10-19) */
  // ── 153 레코드 — 오늘 온 '최초' 기록 보유자 (2026-10-19 대표님: 가·나·라) ──
  //   가: 들어오면 금색 환영 화면 10초 · 나: 운동하는 동안 카드 맨 위 금색 띠 · 라: 아래 금색 띠 '오늘 온 최초 기록 보유자'
  //   board_record_holders(TV 열쇠 길) — 오늘 이 지점에 왔거나 운동 중인 회원 중 보유자만. 출석이 들어올 때마다 다시 읽는다.
  const [recordHolders, setRecordHolders] = useState<RecordHolderRow[]>([]);
  const [recordMap, setRecordMap] = useState<Record<string, string[]>>({});
  const recordMapRef = useRef(recordMap);
  // 라 띠 — 한 줄에 다 들어가면 가만히, 넘치면 천천히 흐른다 (TV 크기·이름 길이에 따라 재어 본다)
  const recordBoxRef = useRef<HTMLDivElement>(null);
  const recordMeasureRef = useRef<HTMLDivElement>(null);
  const [recordOverflow, setRecordOverflow] = useState(false);
  useEffect(() => {
    const box = recordBoxRef.current;
    const m = recordMeasureRef.current;
    if (!box || !m) {
      setRecordOverflow(false);
      return;
    }
    const check = () => setRecordOverflow(m.scrollWidth > box.clientWidth + 2);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(box);
    ro.observe(m);
    return () => ro.disconnect();
  }, [recordHolders]);
  /** 앱 '축하하기'로 받은 생일 축하 수 — 카드 🎉 N (2026-10-16 대표님: "진행") */
  const [birthdayCongrats, setBirthdayCongrats] = useState<Record<string, number>>({});
  const visitKey = useMemo(() => dailyVisits.map((v) => v.user_id).sort().join(","), [dailyVisits]);
  // 생일 회원이 와 있으면 1분마다 다시 읽는다 — 앱에서 보낸 축하가 TV 에 곧바로 쌓여 보이게
  const birthdaySlot = birthdayIds.size > 0 ? Math.floor(currentTime.getTime() / 60_000) : 0;
  useEffect(() => {
    if (!branchName) return;
    let cancelled = false;
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_live_board_birthdays", { _branch_name: branchName });
      if (cancelled || error || !Array.isArray(data)) return;
      const rows = data as { user_id: string; congrats: number | null }[];
      const next = new Set(rows.map((r) => r.user_id));
      setBirthdayIds((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next));
      const counts: Record<string, number> = Object.fromEntries(rows.map((r) => [r.user_id, Number(r.congrats) || 0]));
      setBirthdayCongrats((prev) => {
        const keys = Object.keys(counts);
        return keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === counts[k]) ? prev : counts;
      });
    })();
    return () => { cancelled = true; };
  }, [branchName, presentKey, visitKey, ptRefreshSlot, birthdaySlot]);

  /** 앱 운동세션 + 얼굴 출석 + mock 을 합쳐 시각효과에 전달 */
  //   회원이 앱에서 고른 '카드에 보일 것'을 따른다 — 사진만이면 캐릭터를 빼고, 캐릭터만이면(캐릭터가 있을 때) 사진을 뺀다
  const combinedMembers = useMemo<ActiveMember[]>(
    () => [
      // 리그·레벨은 지금 값으로 (liveLevels — 출석 기록의 레벨은 그 출석으로 승급하기 전 값일 수 있다, 2026-10-16)
      ...[...activeMembers, ...checkinMembers].map((m) => {
        const live = liveLevels[m.user_id];
        return live && (live.level !== m.level || live.league !== m.league) ? { ...m, league: live.league, level: live.level } : m;
      }),
      ...mockMembers,
    ]
      .filter((m) => !staffUserIds.has(m.user_id))
      .map((m) => {
        const pref = displayPrefMap[m.user_id] ?? "auto";
        let next: ActiveMember = m;
        if (pref === "photo" && next.partsJson) next = { ...next, partsJson: null };
        if (pref === "character" && next.partsJson && next.avatar_url) next = { ...next, avatar_url: null };
        if (birthdayIds.has(m.user_id)) next = { ...next, birthday: true, birthdayCongrats: birthdayCongrats[m.user_id] ?? 0 };
        if (recordMap[m.user_id]?.length) next = { ...next, records: recordMap[m.user_id] };
        return ptIds.has(m.user_id) ? { ...next, pt: true } : next;
      }),
    [activeMembers, checkinMembers, mockMembers, liveLevels, staffUserIds, ptIds, displayPrefMap, birthdayIds, birthdayCongrats, recordMap],
  );
  const [popupAvatarUrl, setPopupAvatarUrl] = useState<string | null>(null);
  const [popupPartsJson, setPopupPartsJson] = useState<{ style?: string; customization?: Record<string, unknown> } | null>(null);
  /** 🎂 지금 환영 화면의 회원이 오늘 생일인가 — 오로라·축하 문구·12초 (2026-10-16) */
  const [popupBirthday, setPopupBirthday] = useState(false);
  /** 지금 환영 화면의 회원이 153 레코드 보유자면 기록 이름들 — 금빛 판·10초 (2026-10-19) */
  const [popupRecords, setPopupRecords] = useState<string[] | null>(null);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isBranchManager, setIsBranchManager] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showBranchSwitch, setShowBranchSwitch] = useState(false);

  // fresh=true 면 저장해 둔 값을 건너뛰고 새로 읽는다 — 입장 환영 화면용 (오늘 사진을 새로 올린 회원도 바로 사진으로, 2026-10-14)
  const getAvatarUrl = useCallback(async (userId: string, fresh = false): Promise<string | null> => {
    // 같은 값이면 상태를 바꾸지 않는다 — 출석 카드가 avatarMap 을 보므로 쓸데없는 다시 그리기를 막는다
    if (!fresh && avatarCacheRef.current[userId] !== undefined) {
      const cached = avatarCacheRef.current[userId];
      setAvatarMap(prev => (prev[userId] === cached ? prev : { ...prev, [userId]: cached }));
      return cached;
    }
    // TV 전용 읽기(board_people) — 읽기가 실패하면(네트워크 등) 알던 사진을 그대로 쓴다.
    // 돌려받지 못한 사람(오늘 이 지점에 안 온 사람)만 사진 없음으로 본다
    // (알던 값이 없으면 기억하지 않고 null — 1분 뒤 다시 읽는다)
    const got = await fetchPeople([userId]);
    if (got === null) return avatarCacheRef.current[userId] ?? null;
    const person = got.get(userId);
    if (!person) {
      avatarCacheRef.current[userId] = null;
      setAvatarMap(prev => (prev[userId] === null ? prev : { ...prev, [userId]: null }));
      return null;
    }
    return person.avatar_url || null; // absorbPeople 가 이미 기억했다
  }, [fetchPeople]);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)("end_stale_sessions", { _branch_name: branchName });

    // TV 전용 읽기 — 실패하면 그전 화면 그대로 (예전엔 읽기 실패에도 '운동 중 0명'으로 지웠다)
    const activeSessions = await boardRpc<{ id: string; user_id: string; started_at: string }>("board_active_sessions", {});
    if (activeSessions === null) return;
    if (activeSessions.length === 0) {
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

    // 이름·사진·코치 여부·지금 레벨·캐릭터 — TV 전용 읽기 한 번 (실패하면 null → 오늘 출석 기록의 이름으로)
    // 지도진(코치님)은 '활동 중' 회원 칸에 넣지 않는다 — 코치님은 아래 COACHING STAFF 띠에 챔피언으로 따로 선다.
    const profileMap = (await fetchPeople(userIds)) ?? new Map<string, BoardPerson>();

    // 이름을 못 받으면 오늘 출석 기록의 이름·리그·레벨로 (loadToday 가 읽어 둔 것, 최신이 앞)
    const attendanceMap = new Map<string, { display_name: string; league: string; level: number }>();
    for (const log of todayRowsRef.current) {
      if (!latestByUser.has(log.user_id)) continue;
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
      if (profile?.is_staff === true) continue;
      const attendanceFallback = attendanceMap.get(userId);

      // Determine display name: profile > attendance_log > skip
      const displayName = profile?.nickname || attendanceFallback?.display_name;
      if (!displayName) continue; // truly unknown user — skip

      // 프로필을 못 읽은 회원(일시 오류·권한)은 알던 사진을 그대로 둔다 — 예전엔 null 로 덮어써서
      // 사진이 떴다가 사라졌다 (2026-10-15 대표님 "프로필 사진이 떴다가 갑자기 또 안 떠")
      const avatarUrl = profile ? profile.avatar_url || null : avatarCacheRef.current[userId] ?? null;
      if (profile) avatarCacheRef.current[userId] = avatarUrl;

      const level = profile?.current_level || attendanceFallback?.level || 1;
      // 알려진 레벨 시드 — Realtime 비교용
      knownLevelsRef.current.set(userId, level);

      members.push({
        id: session.id,
        user_id: userId,
        name: displayName,
        league: profile?.current_rank || attendanceFallback?.league || "white",
        level,
        startedAt: new Date(session.started_at).getTime(),
        avatar_url: avatarUrl,
        partsJson: profile?.parts_json ?? null,
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
  }, [branchName, boardRpc, fetchPeople]);

  /**
   * 지금 근무중인 코치 — 필터·시간 판정은 전부 DB 뷰가 끝내고 내려준다.
   * 여기서는 직함 순서로 정렬만 한다(지점장·관장이 앞).
   */
  const loadOnDutyStaff = useCallback(async () => {
    if (!branchName) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("public_staff_on_duty")
      .select("user_id, name, title, avatar_url, checked_in_at")
      .eq("branch_name", branchName);
    const rows = (data || []) as OnDutyCoach[];
    setOnDutyStaff(
      [...rows].sort(
        (a, b) => coachOrder(a.title) - coachOrder(b.title) || a.name.localeCompare(b.name, "ko"),
      ),
    );
  }, [branchName]);

  /** 코치·직원 여부 — 캐시 우선, 처음 보는 계정만 1회 조회 (TV 전용 읽기. 실패하면 기억하지 않고 다음에 다시) */
  const isStaffUser = useCallback(async (userId: string): Promise<boolean> => {
    const cached = staffFlagRef.current.get(userId);
    if (cached !== undefined) return cached;
    const got = await fetchPeople([userId]);
    const flag = got?.get(userId)?.is_staff === true;
    if (got !== null) staffFlagRef.current.set(userId, flag);
    return flag;
  }, [fetchPeople]);

  /** 오늘 온 153 레코드 보유자 (가·나·라) — 실패하면 그전 것 그대로 */
  const lastRecordLoadRef = useRef(0);
  const loadRecordHolders = useCallback(async () => {
    if (!branchName) return;
    lastRecordLoadRef.current = Date.now();
    const rows = await boardRpc<RecordHolderRow>("board_record_holders", {});
    if (rows === null) return;
    const list = rows.filter((r) => !!r.name && Array.isArray(r.records) && r.records.length > 0);
    const map: Record<string, string[]> = {};
    for (const r of list) map[r.user_id] = r.records;
    recordMapRef.current = map; // 환영 화면이 바로 읽는다 (state 가 바뀌기 전에)
    setRecordMap(map);
    setRecordHolders(list);
  }, [branchName, boardRpc]);

  // Load today visits — deduplicated by user_id
  const loadToday = useCallback(async () => {
    if (!branchName) return;
    // TV 전용 읽기 — 실패하면 그전 명단 그대로 (예전엔 읽기 실패에도 명단을 비웠다)
    const data = await boardRpc<TodayCheckinRow>("board_checkins_today", {});
    if (data === null) return;
    todayRowsRef.current = data;

    // 새로 들어온 출석 — 첫 읽기(화면을 막 켰을 때 · 20분마다 새로고침)는 기억만 한다
    const first = firstTodayLoadRef.current;
    firstTodayLoadRef.current = false;
    const fresh: TodayCheckinRow[] = [];
    let unseen = 0;
    for (const r of data) {
      if (seenCheckinIdsRef.current.has(r.id)) continue;
      seenCheckinIdsRef.current.add(r.id);
      unseen += 1;
      if (!first && !r.is_duplicate && r.age_sec <= FRESH_CHECKIN_SEC) fresh.push(r);
    }
    // 153 레코드 보유자 — 새 출석이 있을 때(환영 화면보다 먼저) · 처음 · 5분마다(앱으로만 운동을 시작한 회원)
    if (first || unseen > 0 || Date.now() - lastRecordLoadRef.current > 5 * 60_000) await loadRecordHolders();

    if (data.length > 0) {
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

      // 코치·직원은 여기서 갈라낸다 — dailyVisits 를 회원 전용으로 유지하면
      // 카운트·티커·그리드·2번 화면이 전부 손대지 않아도 회원만 남는다.
      const flags = staffFlagRef.current;
      const unknownIds = visits.map((v) => v.user_id).filter((id) => !flags.has(id));
      // 처음 보는 사람은 한 번에 — 코치 여부와 함께 사진·캐릭터도 기억한다 (absorbPeople)
      if (unknownIds.length > 0) await fetchPeople(unknownIds);
      const memberVisits = visits.filter((v) => flags.get(v.user_id) !== true);
      setDailyVisits(memberVisits);
      void loadCardLooks(memberVisits.map((v) => v.user_id));
      void loadLiveLevels(memberVisits.map((v) => v.user_id));
      setStaffUserIds(
        new Set(visits.filter((v) => flags.get(v.user_id) === true).map((v) => v.user_id)),
      );

      // Prefetch avatars + 알려진 레벨 시드 (Realtime 비교용)
      for (const v of memberVisits) {
        getAvatarUrl(v.user_id);
        if (!knownLevelsRef.current.has(v.user_id)) {
          knownLevelsRef.current.set(v.user_id, v.level);
        }
      }
    } else {
      setDailyVisits([]);
      setStaffUserIds(new Set());
    }

    // 방금 들어온 출석 — 들어온 순서대로 (환영 화면은 맨 마지막 사람이 남는다)
    fresh
      .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())
      .forEach((r) => onNewCheckinRef.current(r));
  }, [branchName, boardRpc, fetchPeople, getAvatarUrl, loadCardLooks, loadLiveLevels, loadRecordHolders]);

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
    // 마이복서153 랭킹 1·2·3위 (2026-10-15 대표님) — 페이지가 20분마다 새로고침되니 한 번 읽으면 된다
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: top } = await (supabase as any).rpc("get_live_board_top3", { p_branch_name: branchName, p_limit: 3 });
    setTopRank(Array.isArray(top) ? (top as TopRankMember[]) : []);
  }, [branchName]);

  useEffect(() => { loadToday(); loadHall(); loadActivitySessions(); loadOnDutyStaff(); }, [loadToday, loadHall, loadActivitySessions, loadOnDutyStaff]);

  // 근무중 판정은 시간이 지나면 바뀐다(코치 4시간). 페이지 자동 새로고침은
  // 20분 주기라 그 사이를 1분마다 메운다 — 앱 계정 없는 코치의 첫 등장도 여기서 잡힌다.
  useEffect(() => {
    const t = setInterval(() => { void loadOnDutyStaff(); }, 60_000);
    return () => clearInterval(t);
  }, [loadOnDutyStaff]);

  /** 자동 새로고침이 연출 도중 끼어들지 않게 하는 현재 상태 스냅샷 */
  const busyRef = useRef(false);
  useEffect(() => { busyRef.current = showPopup || levelUpEvent !== null; }, [showPopup, levelUpEvent]);

  // ── 20분마다 페이지 통째로 새로고침 (대표님 요청) ─────────────────
  // TV 는 몇 주씩 켜둔 채로 두기 때문에 (1) 새로 배포한 화면이 안 걸리고
  // (2) 오래 켜두면 메모리·소켓이 조금씩 쌓인다. 주기적으로 다시 띄워 둘 다 해결한다.
  //
  // 단, 환영 팝업이나 레벨업 연출이 떠 있는 동안에는 미룬다 — 회원이 자기 이름을
  // 보고 있는 순간을 끊어버리면 안 된다. 연출이 끝날 때까지 15초 간격으로 기다린다.
  useEffect(() => {
    const RELOAD_MS = 20 * 60_000;
    let timer: ReturnType<typeof setTimeout>;
    const tryReload = () => {
      if (busyRef.current) { timer = setTimeout(tryReload, 15_000); return; }
      window.location.reload();
    };
    timer = setTimeout(tryReload, RELOAD_MS);
    return () => clearTimeout(timer);
  }, []);

  // 입장 환영 순번 — 여러 명이 한꺼번에 들어와도(얼굴 출석은 1분마다 묶어서 들어온다) 맨 마지막 입실만 보여 준다.
  // 사진·캐릭터를 다 읽은 뒤 한 번에 바꾸므로 A 의 얼굴에 B 의 이름이 붙는 일이 없다 (2026-10-14).
  const popupSeqRef = useRef(0);
  const triggerPopup = useCallback(async (event: CheckinEvent) => {
    const seq = ++popupSeqRef.current;
    const [person, isBirthday] = await Promise.all([
      // 사진·캐릭터를 새로 읽는다 — 오늘 사진을 새로 올린 회원도 바로 (TV 전용 읽기, 실패하면 알던 값)
      fetchPeople([event.user_id]).then((m) => m?.get(event.user_id) ?? null),
      // 🎂 오늘 생일인가 — 입실 행이 들어온 뒤라 DB 가 이 회원을 '오늘 온 회원'으로 본다 (실패하면 보통 환영)
      (async () => {
        if (!branchName) return false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.rpc as any)("get_live_board_birthdays", { _branch_name: branchName });
          return Array.isArray(data) && (data as { user_id: string }[]).some((r) => r.user_id === event.user_id);
        } catch {
          return false;
        }
      })(),
    ]);
    if (seq !== popupSeqRef.current) return; // 그 사이 더 새 입실이 왔다
    // 시범 지점 TV 만 사진을 환영 화면에 쓴다 — 다른 지점은 어제처럼 캐릭터
    const avatar = boardPhotos ? (person ? person.avatar_url || null : avatarCacheRef.current[event.user_id] ?? null) : null;
    const partsJson = person?.parts_json ?? charLookMapRef.current[event.user_id] ?? null;

    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    if (isBirthday) setBirthdayIds((prev) => (prev.has(event.user_id) ? prev : new Set(prev).add(event.user_id)));
    const records = recordMapRef.current[event.user_id]?.length ? recordMapRef.current[event.user_id] : null;
    setPopupAvatarUrl(avatar);
    setPopupPartsJson(partsJson);
    setPopupBirthday(isBirthday);
    setPopupRecords(records);
    setLatestPopup(event);
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(
      () => setShowPopup(false),
      isBirthday ? BIRTHDAY_POPUP_MS : records ? RECORD_POPUP_MS : POPUP_MS,
    );
  }, [fetchPeople, boardPhotos, branchName]);

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
    async (userId: string, oldLevel: number, newLevel: number, league: string, oldLeague?: string) => {
      // 코치님(지도진)은 TV 에서 챔피언 · Lv.77 — 회원 레벨업 연출을 띄우지 않는다.
      if (await isStaffUser(userId)) return;
      const active = activeMembersRef.current.find((m) => m.user_id === userId);
      const visit = dailyVisitsRef.current.find((v) => v.user_id === userId);
      const name = active?.name || visit?.display_name;
      if (!name) return; // 이름 모르면 패스 (다른 지점 회원일 수 있음)

      const avatar =
        active?.avatar_url ?? avatarMapRef.current[userId] ?? (await getAvatarUrl(userId));

      // 회원 설정 캐릭터 — 활동 중이면 이미 가지고 있고, 아니면 기억해 둔 것 → 없으면 TV 전용 읽기
      let partsJson = active?.partsJson ?? charLookMapRef.current[userId] ?? null;
      if (!partsJson) {
        const got = await fetchPeople([userId]);
        partsJson = got?.get(userId)?.parts_json ?? null;
      }

      setLevelUpEvent({
        eventId: `${userId}-${newLevel}-${Date.now()}`,
        user_id: userId,
        name,
        league,
        oldLeague,
        oldLevel,
        newLevel,
        avatar_url: avatar,
        partsJson,
      });
    },
    [getAvatarUrl, isStaffUser, fetchPeople],
  );

  /**
   * 출석 직후 레벨업 확인 (2026-09-28).
   *
   * 예전엔 member_progress UPDATE 를 실시간으로 받으려 했는데 (1) member_progress 는 실시간 발행
   * (supabase_realtime publication)에 없고 (2) TV(anon)는 RLS 로 읽을 수도 없다. 게다가 발행에 없는 테이블을
   * 같은 채널에 넣으면 Realtime 이 그 채널의 구독을 통째로 등록하지 않아 출석 이벤트까지 한 건도 안 왔다
   * (운영에서 실측 — 라이브보드에 이름이 늦게/안 뜨고 QR 출석이 안 보이던 원인).
   * 그래서 출석 행이 들어오면 몇 초 뒤(자동 승급이 끝날 시간) 좁은 RPC 로 그 회원의 리그·레벨만 다시 묻는다.
   */
  const levelTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => () => {
    levelTimersRef.current.forEach((t) => clearTimeout(t));
    levelTimersRef.current.clear();
  }, []);
  const checkLevelUpSoon = useCallback(
    (userId: string, snapLevel: number, snapRank: string) => {
      if (!branchName) return;
      const RANK_IDX: Record<string, number> = { white: 0, blue: 1, red: 2, black: 3 };
      const timer = setTimeout(async () => {
        levelTimersRef.current.delete(timer);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.rpc as any)("get_board_member_levels", {
            p_branch: branchName, p_user_ids: [userId],
          });
          const row = ((data ?? []) as { user_id: string; current_rank: string; current_level: number }[])
            .find((r) => r.user_id === userId);
          if (!row) return;
          // 카드도 곧바로 지금 레벨로 — 레벨업 연출만 띄우고 카드는 출석 때 레벨로 남던 것 (2026-10-16)
          setLiveLevels((prev) =>
            prev[userId]?.level === row.current_level && prev[userId]?.league === (row.current_rank || "white")
              ? prev
              : { ...prev, [userId]: { league: row.current_rank || "white", level: row.current_level } },
          );
          const before = RANK_IDX[(snapRank || "white").toLowerCase()] ?? 0;
          const after = RANK_IDX[(row.current_rank || "white").toLowerCase()] ?? 0;
          const oldLevel = Number(snapLevel) || 1;
          if (after > before || (after === before && row.current_level > oldLevel)) {
            knownLevelsRef.current.set(userId, row.current_level);
            void triggerLevelUp(userId, oldLevel, row.current_level, row.current_rank || "white", snapRank || "white");
          }
        } catch {
          /* 레벨업 연출은 부가 기능 — 실패해도 조용히 넘어간다 */
        }
      }, 8000);
      levelTimersRef.current.add(timer);
    },
    [branchName, triggerLevelUp],
  );

  // 새 출석이 들어왔을 때 — 예전 실시간 출석 처리 그대로 (loadToday 가 '방금 들어온' 출석마다 부른다)
  //   코치·직원 출근은 회원 명단·환영 팝업에 넣지 않는다. 코치 띠는 DB 판정만 따르므로 다시 불러오기만 한다.
  useEffect(() => {
    onNewCheckinRef.current = (n: TodayCheckinRow) => {
      void (async () => {
        if (await isStaffUser(n.user_id)) {
          setStaffUserIds(prev => (prev.has(n.user_id) ? prev : new Set(prev).add(n.user_id)));
          void loadOnDutyStaff();
          return;
        }
        const event: CheckinEvent = {
          id: n.id, display_name_snapshot: n.display_name_snapshot, league_snapshot: n.league_snapshot,
          level_snapshot: n.level_snapshot, checked_in_at: n.checked_in_at, user_id: n.user_id,
        };
        triggerPopup(event);
        void loadActivitySessions();
        checkLevelUpSoon(n.user_id, n.level_snapshot, n.league_snapshot);
      })();
    };
  }, [isStaffUser, loadOnDutyStaff, triggerPopup, loadActivitySessions, checkLevelUpSoon]);

  // 실시간 — 이름 없는 신호(board-ping:<지점>)만 받는다 (2026-10-19 회원 정보 잠그기).
  //   예전엔 출석·운동 표의 바뀐 줄(이름 포함)을 그대로 받았는데, 그러려면 로그인 안 한 누구나 그 표를 읽을 수 있어야 했다.
  //   이제 DB 트리거(_board_ping)가 '다시 읽어요' 신호만 보내고, TV 는 TV 전용 읽기로 다시 읽는다.
  //   얼굴 출석은 1분마다 여러 줄이 한꺼번에 들어오니 0.7초 모았다가 한 번에 읽는다.
  const loadTodayRef = useRef(loadToday);
  const loadSessionsRef = useRef(loadActivitySessions);
  useEffect(() => { loadTodayRef.current = loadToday; }, [loadToday]);
  useEffect(() => { loadSessionsRef.current = loadActivitySessions; }, [loadActivitySessions]);
  useEffect(() => {
    if (!branchName) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wantToday = false;
    let wantSessions = false;
    const flush = () => {
      timer = undefined;
      if (wantToday) { wantToday = false; void loadTodayRef.current(); }
      if (wantSessions) { wantSessions = false; void loadSessionsRef.current(); }
    };
    const channel = supabase
      .channel(`board-ping:${branchName}`)
      .on("broadcast", { event: "changed" }, (msg) => {
        const kind = (msg?.payload as { t?: string } | undefined)?.t;
        if (kind === "activity_sessions") wantSessions = true;
        else wantToday = true;
        if (!timer) timer = setTimeout(flush, 700);
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [branchName]);

  // Reconnect fallback — 구독이 안 된 동안엔 10초마다 직접 읽는다
  useEffect(() => {
    const i = setInterval(() => { if (!connected) { loadToday(); loadActivitySessions(); } }, 10000);
    return () => clearInterval(i);
  }, [connected, loadToday, loadActivitySessions]);

  // 자가 복구 — 구독이 '됐다' 고 해도 TV 절전·공유기 재시작 등으로 이벤트가 조용히 끊길 수 있다.
  // 1분마다, 그리고 화면이 다시 보일 때 오늘 출석·활동을 새로 읽어 놓친 회원을 채운다(팝업 없이 목록만).
  useEffect(() => {
    const refresh = () => { void loadToday(); void loadActivitySessions(); };
    const i = setInterval(refresh, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadToday, loadActivitySessions]);

  const handleBranchSwitch = (name: string) => {
    window.location.href = `/live-board/${encodeURIComponent(name)}`;
  };

  // Force-exit a single member (admin/manager) — mock 회원은 화면에서만 제거
  const handleForceExit = async (sessionId: string, memberName: string) => {
    if (sessionId.startsWith("mock-")) {
      setMockMembers((prev) => prev.filter((m) => m.id !== sessionId));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // 실제 회원 미리보기 (2026-10-16 대표님: "테스트할 때 메달 딴 사람, 사진 올린 사람, 캐릭터로 설정한 사람도 보이게")
  //   우리 지점의 메달·사진·캐릭터 회원을 진짜 이름·모습으로 카드에 올린다. 이 기기 화면에서만 (테스트 패널 = 관리자 전용).
  const handleMockAddReal = useCallback(async () => {
    if (!branchName) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: profs }, { data: medals }, { data: chars }] = await Promise.all([
      sb.from("public_profiles").select("user_id, nickname, avatar_url, is_staff").eq("branch_name", branchName).limit(2000),
      sb.from("member_medals").select("user_id").eq("branch_name", branchName).not("user_id", "is", null),
      supabase.from("member_character_assignments").select("user_id, character_presets(parts_json)").eq("is_active", true).limit(2000),
    ]);
    type Prof = { user_id: string; nickname: string | null; avatar_url: string | null; is_staff: boolean | null };
    const profMap = new Map<string, Prof>();
    for (const p of (profs || []) as Prof[]) if (!p.is_staff && p.nickname) profMap.set(p.user_id, p);
    const charOf = new Map<string, { style?: string; customization?: Record<string, unknown> }>();
    for (const a of (chars || []) as { user_id: string; character_presets?: { parts_json?: unknown } | null }[]) {
      const pj = a.character_presets?.parts_json as { style?: string; customization?: Record<string, unknown> } | undefined;
      if (pj && profMap.has(a.user_id)) charOf.set(a.user_id, pj);
    }
    const medalIds = new Set(((medals || []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => profMap.has(id)));
    const picked = [...profMap.values()].filter(
      (p) => medalIds.has(p.user_id) || (boardPhotos && !!p.avatar_url) || charOf.has(p.user_id),
    );
    // 메달 → 사진 → 캐릭터 순으로 앞에
    picked.sort((a, b) => Number(medalIds.has(b.user_id)) - Number(medalIds.has(a.user_id)) || Number(!!b.avatar_url) - Number(!!a.avatar_url));
    const ids = picked.map((p) => p.user_id);
    if (ids.length === 0) {
      toast.info("이 지점엔 메달·사진·캐릭터 회원이 아직 없어요");
      return;
    }
    const { data: prog } = await supabase.from("member_progress").select("user_id, current_rank, current_level").in("user_id", ids);
    const progMap = new Map(((prog || []) as { user_id: string; current_rank: string | null; current_level: number | null }[]).map((p) => [p.user_id, p]));
    void loadCardLooks(ids); // 회원이 고른 '카드에 보일 것'(사진만·캐릭터만)도 따른다
    const now = Date.now();
    setMockMembers((prev) => {
      const taken = new Set([...prev.map((m) => m.user_id), ...activeMembers.map((m) => m.user_id), ...checkinMembers.map((m) => m.user_id)]);
      const add = picked
        .filter((p) => !taken.has(p.user_id))
        .map((p, i) => ({
          id: `mock-real-${p.user_id}`,
          user_id: p.user_id,
          name: p.nickname as string,
          league: progMap.get(p.user_id)?.current_rank || "white",
          level: progMap.get(p.user_id)?.current_level || 1,
          startedAt: now - (10 + i * 3) * 60_000,
          avatar_url: boardPhotos ? p.avatar_url : null,
          partsJson: charOf.get(p.user_id) ?? null,
        }));
      return [...prev, ...add];
    });
    toast.success(`실제 회원 ${ids.length}명 미리보기 (메달 ${medalIds.size}명)`);
  }, [branchName, boardPhotos, loadCardLooks, activeMembers, checkinMembers]);

  // 메달 예시 — 가상 회원 3명에게 금 ×2 · 은 · 동 (MedalMark 미리보기, DB 와 무관)
  const handleMockMedalSamples = useCallback(() => {
    const three = generateMockMembers(3);
    setPreviewMedal(three[0].user_id, "gold", 2);
    setPreviewMedal(three[1].user_id, "silver");
    setPreviewMedal(three[2].user_id, "bronze");
    setMockMembers((prev) => [...prev, ...three]);
  }, []);
  // 🎂 생일 회원 입장 미리보기 (2026-10-16) — 생일 환영 화면 12초 → 오로라·황금 버튼 카드.
  //   '실제 회원 미리보기'로 올린 사진·캐릭터 회원이 있으면 그 회원으로(진짜 모습), 없으면 가상 회원 1명.
  const handleMockBirthday = useCallback(() => {
    const real = mockMembers.find((m) => !m.birthday && (m.avatar_url || m.partsJson));
    // 축하 수는 미리보기용 예시(3개) — 실제로는 앱에서 받은 수가 1분마다 올라간다
    const target: MockActiveMember = real
      ? { ...real, birthday: true, birthdayCongrats: 3, startedAt: Date.now() }
      : { ...generateMockMember({ fresh: true, usedNames: new Set(mockMembers.map((m) => m.name)) }), birthday: true, birthdayCongrats: 3 };
    setMockMembers((prev) => (real ? prev.map((m) => (m.id === real.id ? target : m)) : [...prev, target]));
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupSeqRef.current += 1; // 읽는 중이던 실제 입실 환영이 이 미리보기를 덮지 않게
    setPopupAvatarUrl(target.avatar_url ?? null);
    setPopupPartsJson(target.partsJson ?? null);
    setPopupBirthday(true);
    setLatestPopup({
      id: target.id,
      user_id: target.user_id,
      display_name_snapshot: target.name,
      league_snapshot: target.league,
      level_snapshot: target.level,
      checked_in_at: new Date().toISOString(),
    });
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), BIRTHDAY_POPUP_MS);
  }, [mockMembers]);
  // 🏆 153 레코드 보유자 입장 미리보기 (2026-10-19) — 금색 환영 화면 10초 → 카드 금색 띠 + 아래 금색 띠.
  //   '실제 회원 미리보기'로 올린 회원이 있으면 그 회원으로, 없으면 가상 회원 1명. 이 기기 화면에서만 (다음 읽기 때 실제 목록으로 돌아간다).
  const handleMockRecord = useCallback(() => {
    const real = mockMembers.find((m) => !m.birthday && (m.avatar_url || m.partsJson));
    const target: MockActiveMember = real
      ? { ...real, startedAt: Date.now() }
      : generateMockMember({ fresh: true, usedNames: new Set(mockMembers.map((m) => m.name)) });
    setMockMembers((prev) => (real ? prev.map((m) => (m.id === real.id ? target : m)) : [...prev, target]));
    const records = ["최초 출석 100회"];
    const map = { ...recordMapRef.current, [target.user_id]: records };
    recordMapRef.current = map;
    setRecordMap(map);
    setRecordHolders((prev) => [
      ...prev.filter((h) => h.user_id !== target.user_id),
      { user_id: target.user_id, name: target.name, records, first_at: new Date().toISOString() },
    ]);
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupSeqRef.current += 1; // 읽는 중이던 실제 입실 환영이 이 미리보기를 덮지 않게
    setPopupAvatarUrl(target.avatar_url ?? null);
    setPopupPartsJson(target.partsJson ?? null);
    setPopupBirthday(false);
    setPopupRecords(records);
    setLatestPopup({
      id: target.id,
      user_id: target.user_id,
      display_name_snapshot: target.name,
      league_snapshot: target.league,
      level_snapshot: target.level,
      checked_in_at: new Date().toISOString(),
    });
    setShowPopup(true);
    popupTimeoutRef.current = setTimeout(() => setShowPopup(false), RECORD_POPUP_MS);
  }, [mockMembers]);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      {/* 지점에 TV 열쇠가 걸렸는데 이 TV 에 없을 때 (2026-10-19 회원 정보 잠그기) */}
      {keyRequired && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full bg-amber-400 px-6 py-2.5 text-tv-micro font-black text-gray-950 shadow-2xl">
          이 TV는 열쇠 주소로 열어야 회원이 보여요 · 관리자 앱 › 라이브보드에서 주소를 확인해 주세요
        </div>
      )}
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-3 bg-gray-900/90 border-b border-gray-800/60">
        <div className="flex items-center gap-5">
          {/* 153 공식 로고(심볼+워드마크). 원본 비율 그대로 — w-auto 로 절대 늘리지 않는다.
              예전엔 🥊 이모지였는데 기기·폰트마다 모양이 달라 브랜드가 흔들렸다. */}
          <img
            src={logoWhite}
            alt="153 BOXING GYM"
            className="h-[72px] w-auto shrink-0"
            draggable={false}
          />
          {/* 로고가 이미 "153 BOXING GYM" 을 담고 있어 같은 워드마크를 글자로 반복하지 않는다.
              남기는 건 앱 이름과 지점명 둘뿐 — 로고 높이(72)에 맞춰 2줄로 정렬한다. */}
          <div className="flex flex-col justify-center gap-1">
            <h1 className="text-tv-heading font-black leading-none tracking-tight text-white">마이복서153</h1>
            <p className="text-tv-micro font-bold leading-none text-white/50">{branchName || "지점"}</p>
            {only1 && onDutyStaff.length > 0 && (
              <p className="flex items-center gap-2 text-tv-micro font-bold leading-none text-white/60">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                {onDutyStaff.map((c) => `${c.name} ${honorTitle(c.title)}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-8">
          {isSuperAdmin && branches.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowBranchSwitch(!showBranchSwitch)} className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-tv-micro text-gray-300 hover:bg-gray-700 transition-colors">
                <Building2 className="h-5 w-5" />
                <span>지점 전환</span>
              </button>
              {showBranchSwitch && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-gray-800 border border-gray-700 shadow-2xl overflow-hidden">
                  <div className="p-3 border-b border-gray-700"><p className="text-tv-micro text-gray-400 px-2">지점 선택</p></div>
                  <div className="max-h-60 overflow-y-auto">
                    {branches.map(b => (
                      <button key={b.id} onClick={() => handleBranchSwitch(b.name)}
                        className={`w-full px-5 py-3 text-left text-tv-micro hover:bg-gray-700 transition-colors ${b.name === branchName ? "text-primary font-bold bg-gray-700/50" : "text-gray-300"}`}>
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
            <button onClick={handleResetActiveSessions} className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-tv-micro text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors" title="현재 활동 중 초기화">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden xl:inline">초기화</span>
            </button>
          )}
          <div className="flex items-center gap-8">
            {/* 숫자는 "활동 중" 하나만 남긴다 — 오늘 방문 누적치는 대표님 요청으로 화면에서 뺐다.
                (방문이 적은 시간대에 작게 보이는 숫자가 오히려 썰렁해 보인다) */}
            <div className="text-center">
              <p className="text-tv-title font-black leading-none tabular-nums text-primary">{combinedMembers.length}</p>
              <p className="mt-1.5 text-tv-micro font-bold text-white/40">활동 중</p>
            </div>
          </div>
          <div className="text-right">
            {/* 사이니지 기기는 공장 초기 표준시(UTC 등)로 놓인 경우가 많아 timeZone 을 못 박는다.
                기기 시계만 맞으면 지역 설정이 틀려도 한국 시각으로 나온다. */}
            <p className="text-tv-micro font-bold leading-none text-white/40">
              {currentTime.toLocaleDateString("ko-KR", {
                month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul",
              })}
            </p>
            <p className="mt-1.5 text-tv-heading font-black leading-none tabular-nums text-white/70">
              {currentTime.toLocaleTimeString("ko-KR", {
                hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul",
              })}
            </p>
          </div>
          {/* 내 레벨 보기 QR — 출석하고 이름·레벨이 뜬 회원이 그 자리에서 앱으로 (2026-10-10 대표님) */}
          <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl bg-white p-2.5">
            <QRCodeSVG value="https://myboxer153.com/?from=tv" size={74} level="M" marginSize={0} />
            <p className="text-tv-micro font-black leading-none text-gray-900">📱 내 레벨 보기</p>
          </div>
          <div className={`h-4 w-4 rounded-full ${connected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
        </div>
      </div>

      {/* 헤더 높이를 숫자로 빼지 않는다. 예전엔 calc(100vh-80px) 였는데 실제 헤더는 109px 이라
          29px 이 화면 밖으로 밀려 명예의 전당 띠 아래가 잘려 있었다. flex-1 이면 항상 정확하다. */}
      <div className="flex min-h-0 flex-1">
        {/* ═══ Center: Main area — 명예의 전당 sticky bottom + 위쪽만 스크롤 ═══ */}
        <div className="flex flex-col min-w-0 overflow-hidden flex-1">
          {/* 2번 화면(TV2): 스포트라이트 대신 런칭 이벤트 보드 — ① 출석왕 ② 앱 활동왕 ③ 닉네임 좋아요왕 (2026-09-23 대표님 지시).
              아래 띠(오늘 다녀간 회원·COACHING STAFF·명예의 전당)와 오른쪽 패널(QR·활동 중)은 그대로 둔다. */}
          {only2 && branchName && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <LaunchEventBoard branchName={branchName} />
            </div>
          )}
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
              <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden">
                {/* 153 레코드 보유자 (2026-10-19 대표님 '가') — 위에 금빛 '153 RECORD' 알약, 10초 */}
                {popupRecords && !popupBirthday && (
                  <div className="bday-pop relative z-10 rounded-full p-[2px] record-gold-ring shadow-[0_0_40px_rgba(246,196,83,0.45)]">
                    <div className="flex items-center gap-3 rounded-full bg-gray-950/90 px-7 py-2.5">
                      <span className="text-tv-heading">🏆</span>
                      <span className="bday-gold-text text-tv-heading font-black tracking-[0.25em]">153 RECORD</span>
                    </div>
                  </div>
                )}
                {/* 입장 환영 — 사진(본인이 올린 프로필) > 캐릭터 > 기본 복서. 활동 중 카드와 같은 순서 (2026-10-14 대표님)
                    🎂 생일 회원이면 (2026-10-16 대표님): 뒤로 오로라 빛무리와 금빛 꽃가루가 돌고, 사진 테두리가 오로라로 흐르고,
                    케이크가 얹히고, "생일 축하합니다!" — 12초 동안 (보통 7초) */}
                <div className="relative flex items-center justify-center">
                  {/* 153 레코드 — 뒤로 금빛 빛무리와 금빛 꽃가루 */}
                  {popupRecords && !popupBirthday && (
                    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
                      <div
                        className="absolute -left-[20rem] -top-[20rem] h-[40rem] w-[40rem] rounded-full blur-3xl"
                        style={{ background: "radial-gradient(circle, rgba(246,196,83,0.38), rgba(224,163,38,0.18) 45%, transparent 70%)" }}
                      />
                      <img
                        src={fxGoldConfetti}
                        alt=""
                        draggable={false}
                        className="bday-halo-reverse absolute -left-[21rem] -top-[21rem] h-[42rem] w-[42rem] max-w-none select-none opacity-90"
                        style={{ mixBlendMode: "screen" }}
                      />
                    </div>
                  )}
                  {popupBirthday && (
                    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
                      <div
                        className="absolute -left-[20rem] -top-[20rem] h-[40rem] w-[40rem] rounded-full blur-3xl"
                        style={{ background: "radial-gradient(circle, rgba(52,245,197,0.32), rgba(167,139,250,0.24) 45%, transparent 70%)" }}
                      />
                      <img
                        src={fxAurora}
                        alt=""
                        draggable={false}
                        className="bday-halo absolute -left-[18rem] -top-[18rem] h-[36rem] w-[36rem] max-w-none select-none"
                        style={{ mixBlendMode: "screen" }}
                      />
                      <img
                        src={fxGoldConfetti}
                        alt=""
                        draggable={false}
                        className="bday-halo-reverse absolute -left-[21rem] -top-[21rem] h-[42rem] w-[42rem] max-w-none select-none opacity-85"
                        style={{ mixBlendMode: "screen" }}
                      />
                    </div>
                  )}
                  {popupAvatarUrl ? (
                    <div
                      className={`relative rounded-full p-[6px] ${
                        popupBirthday
                          ? "bday-aurora-ring shadow-[0_0_90px_rgba(52,245,197,0.55)]"
                          : popupRecords
                            ? "record-gold-ring shadow-[0_0_90px_rgba(246,196,83,0.55)]"
                            : `bg-gradient-to-br ${
                              WELCOME_RING[(latestPopup.league_snapshot || "white").toLowerCase()] ?? WELCOME_RING.white
                            } ${RANK_GLOW[(latestPopup.league_snapshot || "white").toLowerCase()] ?? RANK_GLOW.white}`
                      }`}
                    >
                      <img
                        src={popupAvatarUrl}
                        alt={latestPopup.display_name_snapshot}
                        className="h-72 w-72 rounded-full object-cover ring-4 ring-black/70"
                        // 사진을 못 불러오면 캐릭터·기본 복서로 돌아간다
                        onError={() => setPopupAvatarUrl(null)}
                      />
                    </div>
                  ) : popupPartsJson ? (
                    <div className="relative">
                      <CharacterSprite
                        partsJson={popupPartsJson}
                        size="lg"
                        league={(latestPopup.league_snapshot as "white" | "blue" | "red" | "black") || "white"}
                        level={latestPopup.level_snapshot}
                        animate
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <SDBoxerCharacter
                        league={(latestPopup.league_snapshot as "white" | "blue" | "red" | "black") || "white"}
                        nickname={latestPopup.display_name_snapshot}
                        level={latestPopup.level_snapshot}
                        state="enter"
                      />
                    </div>
                  )}
                  {popupBirthday && (
                    <img
                      src={birthdayCake}
                      alt="생일 케이크"
                      draggable={false}
                      className="bday-bob pointer-events-none absolute -right-14 -top-10 h-36 w-36 select-none"
                      style={{ filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.6))" }}
                    />
                  )}
                </div>
                {/* 사진·캐릭터일 때는 이름/리그 별도 표시 (SDBoxerCharacter 는 자체 포함). 생일 문구는 늘 */}
                {(popupAvatarUrl || popupPartsJson || popupBirthday || popupRecords) && (
                  // 생일이면 글자 뒤에 어두운 판 — 금빛 꽃가루 위에서도 또렷하게
                  <div
                    className={`relative text-center ${
                      popupBirthday
                        ? "rounded-[2rem] bg-gray-950/80 px-14 py-5 ring-1 ring-white/10 backdrop-blur-sm"
                        : popupRecords
                          ? "rounded-[2rem] bg-gray-950/85 px-14 py-5 ring-1 ring-amber-300/30 backdrop-blur-sm"
                          : ""
                    }`}
                  >
                    {(popupAvatarUrl || popupPartsJson) && (
                      <p
                        className="text-tv-heading font-black text-white"
                        style={{ textShadow: "0 4px 20px rgba(0,0,0,0.8)" }}
                      >
                        {latestPopup.display_name_snapshot}
                        {popupBirthday ? " 님" : ""}
                      </p>
                    )}
                    {popupBirthday ? (
                      <>
                        <p
                          className="bday-pop bday-gold-text mt-1 text-tv-display font-black tracking-tight"
                          style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.75))" }}
                        >
                          생일 축하합니다!
                        </p>
                        <p className="mt-3 text-tv-label font-black text-amber-100" style={{ textShadow: "0 3px 14px rgba(0,0,0,0.85)" }}>
                          🎉 오늘 생일이에요 · 다 같이 축하해 주세요! 👏
                        </p>
                        {/* 생일 + 153 레코드 — 생일 화면은 그대로, 기록 이름만 한 줄 더 (2026-10-19) */}
                        {popupRecords && (
                          <p className="mt-2 text-tv-micro font-black">
                            <span className="bday-gold-text tracking-[0.15em]">🏆 153 RECORD</span>
                            <span className="ml-2 text-amber-200">{popupRecords.join(" · ")}</span>
                          </p>
                        )}
                        {/* 앱 '축하하기' 안내 — 보낸 축하는 이 회원 카드에 '🎉 N'으로 쌓인다 */}
                        <p className="mt-2 text-tv-micro font-bold text-white/70">
                          📱 마이복서153 앱 홈에서 <span className="font-black text-amber-200">🎂 축하하기</span>를 눌러 주세요
                        </p>
                      </>
                    ) : popupRecords ? (
                      <>
                        <p
                          className="bday-pop bday-gold-text mt-1 text-tv-title font-black tracking-tight"
                          style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.75))" }}
                        >
                          {popupRecords.join(" · ")}
                        </p>
                        <p className="mt-3 text-tv-label font-black text-amber-100" style={{ textShadow: "0 3px 14px rgba(0,0,0,0.85)" }}>
                          153복싱짐 최초 기록 보유자 · 입실! Lv.{toGlobalLevel(latestPopup.league_snapshot, latestPopup.level_snapshot)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-tv-micro font-bold text-primary">
                        입실! · Lv.{toGlobalLevel(latestPopup.league_snapshot, latestPopup.level_snapshot)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : combinedMembers.length > 0 ? (
              <div className="flex flex-1 flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-tv-micro font-black tracking-wide text-primary">
                    지금 운동 중
                  </h2>
                  <p className="number-font text-tv-micro font-black text-primary tabular-nums">
                    {combinedMembers.length}
                    <span className="ml-1 text-tv-micro text-primary/70">명</span>
                  </p>
                  {mockMembers.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-tv-micro font-black text-white/50">
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
                hallOfFameCount={hallMembers.length}
              />
            )}
          </div>

          )}

          {/* ── Bottom: 오늘 다녀간 회원 (이름 티커) ── */}
          {/* 하루 30~40명이라 한 줄에 다 안 들어간다. 잘라서 일부만 보여주면 대부분의 회원은
              자기 이름을 영영 못 보므로, 아주 느리게 흘려 모두가 한 번씩 지나가게 한다.
              목록을 두 벌 이어붙이고 -50% 까지 옮기면 이음매 없이 반복된다. */}
          {!only1 && dailyVisits.length > 0 && (
            <div className="mx-4 mb-2 flex-shrink-0 overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/50 px-4 py-2.5">
              <div className="flex items-center gap-4">
                {/* 인원수 배지는 대표님 요청으로 뺐다 — 이름만 흐르게 둔다 */}
                <h2 className="flex-shrink-0 whitespace-nowrap text-tv-micro font-black tracking-wide text-white/50">
                  오늘 다녀간 회원
                </h2>
                {/* 양 끝을 페이드 처리 — 안 하면 이름이 가장자리에서 뚝 잘려 보인다 */}
                <div
                  className="relative min-w-0 flex-1 overflow-hidden"
                  style={{
                    maskImage:
                      "linear-gradient(to right, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%)",
                  }}
                >
                  <div
                    className="flex w-max items-center gap-6 whitespace-nowrap"
                    style={{
                      animation: `tv-marquee ${Math.max(30, dailyVisits.length * 2.4)}s linear infinite`,
                    }}
                  >
                    {[0, 1].map((copy) => (
                      <div key={copy} className="flex items-center gap-6" aria-hidden={copy === 1}>
                        {dailyVisits.map((v) => {
                          const training = activeUserIds.has(v.user_id);
                          return (
                            <span key={`${copy}-${v.user_id}`} className="flex items-center gap-1.5">
                              {training && (
                                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden />
                              )}
                              <span
                                className={`text-tv-micro font-bold ${training ? "text-white" : "text-white/45"}`}
                              >
                                {v.display_name}
                              </span>
                              {/* 🎂 오늘 생일 (2026-10-16) */}
                              {birthdayIds.has(v.user_id) && (
                                <img src={birthdayCake} alt="오늘 생일" draggable={false} className="h-6 w-6 shrink-0 select-none" />
                              )}
                              <MedalMark animated userId={v.user_id} className="text-tv-micro" />
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Bottom: COACHING STAFF 띠 ── */}
          {/* 명예의 전당과 같은 격으로 코치진을 세운다 — 지금 근무중인 코치만 이름이 걸리고,
              아무도 없으면 띠 자체를 접는다. 이름 뒤 직함(지점장님·코치님)이 예우다. */}
          {!only1 && onDutyStaff.length > 0 && (
            <div className="mx-4 mb-2 flex-shrink-0 rounded-xl border border-yellow-600/40 bg-gradient-to-r from-yellow-950/60 via-gray-900/80 to-yellow-950/60 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <Medal className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-tv-micro font-black text-yellow-400 tracking-widest whitespace-nowrap">
                    COACHING STAFF
                  </h2>
                </div>
                <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                  {onDutyStaff.map((c) => (
                      <div
                        key={c.user_id ?? `${c.name}-${c.checked_in_at}`}
                        className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-yellow-700/30 bg-yellow-900/20 px-2.5 py-1"
                      >
                        <MemberAvatar url={c.avatar_url} name={c.name} sizeClass="h-7 w-7" />
                        <div>
                          <p className="text-tv-micro font-black leading-tight text-yellow-100 whitespace-nowrap">
                            {c.name} {honorTitle(c.title)} <MedalMark animated userId={c.user_id} />
                          </p>
                          <p className="text-tv-micro font-black uppercase tracking-wider text-yellow-500/80">
                            {/* 대표님 지시: 코치님은 모두 Lv.77 — 리그 표기 2026-09-23 챔피언 → 2026-10-19 블랙 */}
                            BLACK · LV.{STAFF_CHAMPION_LEVEL}
                          </p>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 153 레코드 — 오늘 온 최초 기록 보유자 띠 (2026-10-19 대표님 '라') ── */}
          {/* 랭킹 띠처럼 모든 화면에(1번 화면은 우하단 QR 카드를 피해 오른쪽을 비운다). 한 줄에 다 안 들어가면 오늘 다녀간 회원 띠처럼 천천히 흐른다 */}
          {recordHolders.length > 0 && (
            // 금빛 테두리·글자는 흐르지 않는 같은 그림(still) — TV 가 하루 종일 다시 칠하느라 끊기던 것 (2026-10-26)
            <div className={`mx-4 mb-2 flex-shrink-0 rounded-xl p-[1.5px] record-gold-ring still ${only1 ? "mr-[35rem]" : ""}`}>
              <div className="flex items-center gap-4 overflow-hidden rounded-[11px] bg-gray-950/95 px-4 py-2.5">
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="text-tv-micro">🏆</span>
                  <h2 className="bday-gold-text still whitespace-nowrap text-tv-micro font-black tracking-widest">153 RECORD</h2>
                  <span className="whitespace-nowrap text-tv-micro font-bold text-amber-100/70">오늘 온 최초 기록 보유자</span>
                </div>
                <div
                  ref={recordBoxRef}
                  className="relative min-w-0 flex-1 overflow-hidden"
                  style={
                    recordOverflow
                      ? {
                          maskImage: "linear-gradient(to right, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%)",
                          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%)",
                        }
                      : undefined
                  }
                >
                  {/* 길이 재기용 한 벌 (보이지 않음) — 넘치면 두 벌을 이어 흘린다 */}
                  <div ref={recordMeasureRef} aria-hidden className="invisible absolute left-0 top-0 flex w-max items-center gap-6 whitespace-nowrap">
                    {recordHolders.map((h) => (
                      <span key={h.user_id} className="flex items-center gap-2">
                        <span className="text-tv-micro font-black">{h.name}</span>
                        <span className="text-tv-micro font-bold">{h.records.join(" · ")}</span>
                      </span>
                    ))}
                  </div>
                  <div
                    className="flex w-max items-center whitespace-nowrap"
                    style={recordOverflow ? { animation: `tv-marquee ${Math.max(24, recordHolders.length * 8)}s linear infinite` } : undefined}
                  >
                    {(recordOverflow ? [0, 1] : [0]).map((copy) => (
                      <div key={copy} className={`flex items-center gap-6 ${recordOverflow ? "pr-6" : ""}`} aria-hidden={copy === 1}>
                        {recordHolders.map((h) => (
                          <span key={`${copy}-${h.user_id}`} className="flex items-center gap-2">
                            <span className="text-tv-micro font-black text-white">{h.name}</span>
                            <span className="text-tv-micro font-bold text-amber-200">{h.records.join(" · ")}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Bottom: 마이복서153 랭킹 TOP 3 (2026-10-15 대표님) ── */}
          {/* 앱 랭킹 '전체'와 같은 순서: 레벨 → 보스 클리어 → 누적 XP. 순위가 없으면(새 지점) 띠를 접는다. */}
          {/* 1번 화면(운동 중만)에도 보인다 — 2026-10-15 대표님. 우하단 QR 카드(33rem)를 피해 오른쪽을 비운다 */}
          {topRank.length > 0 && (
            <div className={`mx-4 mb-2 flex-shrink-0 rounded-xl border border-primary/30 ${only1 ? "mr-[35rem]" : ""} bg-gradient-to-r from-primary/10 via-gray-900/80 to-primary/10 px-4 py-2.5`}>
              <div className="flex items-center gap-3">
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h2 className="whitespace-nowrap text-tv-micro font-black tracking-wide text-primary">
                    마이복서153 랭킹
                  </h2>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  {topRank.slice(0, 3).map((m, i) => {
                    const tone = TOP_TONE[i] ?? TOP_TONE[2];
                    return (
                      <div
                        key={m.r_user_id}
                        className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1 ${tone.ring}`}
                      >
                        <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-tv-micro font-black ${tone.num}`}>
                          {i + 1}
                        </span>
                        <MemberAvatar url={m.r_avatar_url} name={m.r_nickname} sizeClass="h-7 w-7" />
                        <div className="min-w-0">
                          <p className={`flex min-w-0 items-center gap-1 text-tv-micro font-black leading-tight ${tone.name}`}>
                            <span className="truncate">{m.r_nickname}</span>
                            <MedalMark animated userId={m.r_user_id} />
                          </p>
                          <p className="text-tv-micro font-black uppercase tracking-wider text-white/50">
                            {RANK_LABELS[m.r_current_rank] ?? m.r_current_rank} · LV.{toGlobalLevel(m.r_current_rank, m.r_current_level)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                  <h2 className="text-tv-micro font-black text-yellow-400 tracking-wide whitespace-nowrap">
                    명예의 전당
                  </h2>
                  {hallMembers.length > 0 && (
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-tv-micro font-black text-yellow-300 tabular-nums">
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
                          <p className="text-tv-micro font-black text-yellow-200 leading-tight whitespace-nowrap">
                            {m.r_nickname} <MedalMark animated userId={m.r_user_id} />
                          </p>
                          <p className="text-tv-micro text-yellow-500/80 font-black">MASTER 40</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-yellow-700/40 px-3 py-1.5">
                    <p className="text-tv-micro font-black text-yellow-500/70 whitespace-nowrap">
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
        <div className="bg-gray-900/60 flex flex-col min-h-0 w-[26rem] border-l border-gray-800/60">
          {/* QR 출석 — 항상 표시. 브로제이가 느릴 때 회원이 앱에서 찍으면 보드에 바로 올라온다 (2026-09-22) */}
          {branchName && <LiveBoardQrCard branchName={branchName} />}
          {/* Active members — 인원수 많을 때 더 많이 보이게 flex-1 + 최소 보장 (QR 카드 232px 이 위에 생겨 40vh → 28vh) */}
          <div className="flex-1 border-b border-gray-800/60 flex flex-col min-h-[28vh]">
            <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <span className="h-4 w-4 rounded-full bg-primary animate-pulse" />
              <h2 className="text-tv-label font-black text-primary">현재 활동 중 ({combinedMembers.length})</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {combinedMembers.length === 0 ? (
                <div className="text-center py-6 text-gray-600"><p className="text-tv-micro">활동 중인 회원 없음</p></div>
              ) : (
                <div className="space-y-2">
                  {/* 🎂 생일 회원이 맨 위 (2026-10-16) — 나머지 순서는 그대로 (sort 는 안정 정렬) */}
                  {[...combinedMembers].sort((a, b) => Number(!!b.birthday) - Number(!!a.birthday)).map((m) => (
                    <div
                      key={m.user_id}
                      className={`flex items-center gap-4 rounded-xl px-4 py-4 group ${
                        m.birthday
                          ? "bg-gradient-to-r from-emerald-500/15 via-violet-500/15 to-pink-500/15 ring-1 ring-inset ring-emerald-300/40"
                          : "bg-gray-800/40"
                      }`}
                    >
                      <MemberAvatar url={m.avatar_url} name={m.name} />
                      <div className="flex-1 min-w-0">
                        {/* 이름 + 리그 버튼(모든 회원, 앱 라이센스 카드와 같은 버튼). PT 회원은 'PT' 글자 (2026-10-15 대표님) */}
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="min-w-0 text-tv-label font-black text-white truncate leading-tight">{m.name}</p>
                          {/* 생일이면 황금 버튼 + 케이크 (2026-10-16 대표님) */}
                          <NameBadge league={m.league} birthday={m.birthday} className="h-7 w-7" />
                          {m.birthday && (
                            <img src={birthdayCake} alt="오늘 생일" draggable={false} className="h-8 w-8 shrink-0 select-none" />
                          )}
                          {m.birthday && (m.birthdayCongrats ?? 0) > 0 && (
                            <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-tv-micro font-black tabular-nums text-amber-200">
                              🎉 {m.birthdayCongrats}
                            </span>
                          )}
                          <MedalMark animated userId={m.user_id} className="text-tv-label" />
                          {m.pt && (
                            <span className="shrink-0 rounded-md border border-blue-400/50 bg-blue-500/20 px-2 py-0.5 text-tv-micro font-black tracking-wider text-blue-200">
                              PT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded text-tv-micro font-black ${RANK_BADGE_COLORS[m.league] || "bg-gray-700 text-gray-300"}`}>
                            {RANK_LABELS[m.league] || m.league} 리그
                          </span>
                          <span className="text-tv-micro text-gray-400 font-bold">레벨 {toGlobalLevel(m.league, m.level)}</span>
                          <span className="text-gray-600">·</span>
                          <Clock className="h-4 w-4 text-gray-500 inline" />
                          <span className="text-tv-micro text-gray-500 font-bold">{elapsedMin(m.startedAt)}분</span>
                        </div>
                      </div>
                      {isBranchManager && (
                        <button
                          onClick={() => handleForceExit(m.id, m.name)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-red-600/20 px-3 py-2 text-tv-micro font-bold text-red-400 hover:bg-red-600/40"
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

      {/* 1번 화면(운동 중만)엔 오른쪽 패널이 없다 — QR 출석 카드를 우하단에 띄운다 */}
      {only1 && branchName && <LiveBoardQrCard branchName={branchName} variant="floating" />}

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
          onAddReal={handleMockAddReal}
          onAddMedalSamples={handleMockMedalSamples}
          onBirthdaySample={handleMockBirthday}
          onRecordSample={handleMockRecord}
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
