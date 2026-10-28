/**
 * 153 커뮤니티 — 모두의 피드 (2026-10-15 대표님: "커뮤니티 개편안대로 — 반응 이름은 153").
 *
 * 순서: 코치 이번 주 목표(고정) → 승급 축하(고정) → 오늘도 한 판(오늘 출석한 동료, 한 장으로 묶음) → 새 식구 → 오늘 운동 한 줄.
 * 반응은 '153' 하나. 내 글에는 누를 수 없다. 153·댓글에는 보상이 없다 (공식 레벨업과 무관).
 * 이번 주 153을 가장 많이 보낸 회원을 TV '이번 주 153왕'으로 띄웠으나 2026-10-19 대표님 지시로 TV 에서 뺐다(153 반응은 그대로).
 * 본사 보기 (2026-10-16 대표님: "회원이 쓴 커뮤니티 글 내가 확인할수있나? 나는 모든 활동을 확인할수있게해줘"):
 *   전체관리자·관리자는 모든 지점의 모든 글(친구만 · 나만 보기 · 숨긴 글 포함, 최근 30일) — 지점 골라 보기.
 * 공개 범위 3가지 (2026-10-18 대표님: "개인 공개 전체공개 친구만 공개할수있는 기능 … 본사는 지점장이나 코치에게 볼수있는 권한"):
 *   전체 공개 · 친구만 · 나만 보기 — 내 글에는 늘 표시하고 ⋯ 에서 바꾼다. 남의 글은 전체 공개가 아닐 때만 표시.
 *   전 지점 보기에서 지점장·코치 권한을 켜고 끈다(CommunityViewGrants). 받은 사람은 맨 위에 안내.
 * 2026-10-18 대표님 더:
 *   · "이름을 클릭하면 회원 상세 … 좋아요 · 메시지 · 짝꿍 신청 · 응원" → 이름·사진을 누르면 누구나 회원 카드(openMemberCard)
 *   · "회원님들에게는 어떻게 보이나?" → 전 지점 보기에 '회원 화면으로 보기' (그 지점 일반 회원이 보는 그대로)
 *   · "새식구가 가입하면 환영하는 문화" → 새 식구 카드에 환영 인사 (NewbieWelcome)
 *   · 화면 글에 '본사'를 쓰지 않는다 · 전체관리자도 이번 주 목표를 올려 본다(내 지점으로)
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  Flag,
  Handshake,
  KeyRound,
  Lock,
  MessageCircle,
  MoreHorizontal,
  PartyPopper,
  Sprout,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  JOURNAL_VISIBILITIES,
  VISIBILITY_LABEL,
  getCommunityFeed,
  getCommunityWeeklyMetrics,
  getCommunityFeedMemberView,
  hideCommunityEntry,
  postWeeklyGoal,
  reactTargetOf,
  reportCommunityEntry,
  setJournalEntryVisibility,
  toggle153,
  type CommunityFeed as Feed,
  type FeedItem,
  type JournalVisibility,
} from "@/services/communityFeedService";
import CommunityViewGrants from "./CommunityViewGrants";
import NewbieWelcome from "./NewbieWelcome";
import SecondCheerSheet, { type CheerInitialTarget } from "./SecondCheerSheet";
import { openMemberCard } from "@/lib/appEvents";
import type { PartnerJournalFeedRow } from "@/services/championJournalPartnerService";
import { RANK_LABELS } from "@/lib/rankLabels";
import { shortBranchName } from "@/services/communityHubService";
import { useAuth } from "@/contexts/AuthContext";
import NameBadge from "@/components/badges/NameBadge";
import PartnerJournalCommentSheet from "./PartnerJournalCommentSheet";

const FEED_KEY = ["community-feed"] as const;
const NEXT_LEAGUE: Record<string, string> = { white: "blue", blue: "red", red: "black" };
const VIS_ICON: Record<JournalVisibility, LucideIcon> = { branch: Users, partners: Handshake, private: Lock };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}일 전` : new Date(iso).toLocaleDateString("ko-KR");
}

/** 길게 누르면 한마디 응원 (2026-10-27 커뮤니티 1단계) — 응원 보내기와 같은 규칙(하루 10번 · 같은 동료 1번) */
const LONG_PRESS_MS = 450;

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 진동 없는 기기 */
  }
};

/** 153 버튼 — 눌렀으면 채워진다. 내 글이면 숫자만. 누르면 '+1'이 떠오르고 가볍게 떨린다 */
const Btn153 = ({
  item,
  onToggle,
  onLongPress,
  compact,
}: {
  item: FeedItem;
  onToggle: (i: FeedItem) => void;
  onLongPress?: (i: FeedItem) => void;
  compact?: boolean;
}) => {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const [pop, setPop] = useState(0);
  const canLong = !!onLongPress && !item.isMine;
  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clear, []);
  const start = () => {
    if (!canLong) return;
    fired.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      buzz(20);
      onLongPress?.(item);
    }, LONG_PRESS_MS);
  };
  return (
    <motion.button
      type="button"
      disabled={item.isMine}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => {
        if (canLong) e.preventDefault();
      }}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        if (!item.reacted) {
          buzz(10);
          setPop(Date.now());
        }
        onToggle(item);
      }}
      whileTap={item.isMine ? undefined : { scale: 0.88 }}
      aria-pressed={item.reacted}
      aria-label={
        item.isMine ? `153 ${item.count153}개` : item.reacted ? "153 취소" : "153 보내기 (길게 누르면 한마디 응원)"
      }
      className={`relative inline-flex shrink-0 select-none items-center gap-1 rounded-pill border font-black transition-colors [-webkit-touch-callout:none] ${
        compact ? "min-h-[32px] px-2.5 text-micro" : "min-h-[40px] px-3.5 text-label"
      } ${
        item.reacted
          ? "border-primary bg-primary text-primary-foreground"
          : "border-primary/40 bg-primary/5 text-primary"
      } ${item.isMine ? "opacity-70" : ""}`}
    >
      <span className="number-font tracking-tight">153</span>
      {item.count153 > 0 && <span className="number-font opacity-90">{item.count153}</span>}
      <AnimatePresence>
        {pop > 0 && (
          <motion.span
            key={pop}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            onAnimationComplete={() => setPop(0)}
            aria-hidden
            className="number-font pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-micro font-black text-primary"
          >
            +1
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

/** KST 기준 이번 주(0) · 지난주(-1) 월요일 YYYY-MM-DD */
const kstWeekStart = (offsetWeeks: number) => {
  const now = new Date(Date.now() + 9 * 3_600_000);
  const dow = (now.getUTCDay() + 6) % 7; // 월요일 = 0
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow + offsetWeeks * 7))
    .toISOString()
    .slice(0, 10);
};

/**
 * 전 지점 보기 — 커뮤니티 숫자 한 장 (2026-10-27 커뮤니티 1단계 「측정 지표: 매주 볼 숫자」).
 * 핵심 숫자 = 커뮤니티 활동 회원 비율(그 주 누르거나 쓴 회원 ÷ 그 주 출석 회원). 월요일 08:30 알림과 같은 계산.
 */
const CommunityMetricsCard = () => {
  const lastWeek = kstWeekStart(-1);
  const thisWeek = kstWeekStart(0);
  const q = useQuery({
    queryKey: ["community-weekly-metrics", lastWeek, thisWeek],
    queryFn: async () => {
      const [last, now] = await Promise.all([
        getCommunityWeeklyMetrics(null, lastWeek),
        getCommunityWeeklyMetrics(null, thisWeek),
      ]);
      return { last, now };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!q.data) return null;
  const { last, now } = q.data;
  const rows: { label: string; a: string; b: string }[] = [
    { label: "활동 회원 비율", a: `${last.active_rate}% (${last.active}/${last.attendees})`, b: `${now.active_rate}% (${now.active}/${now.attendees})` },
    { label: "회원이 누른 153", a: `${last.member_153}번`, b: `${now.member_153}번` },
    { label: "글쓴이", a: `${last.posters}명`, b: `${now.posters}명` },
    { label: "댓글 · 응원", a: `${last.comments} · ${last.cheers}`, b: `${now.comments} · ${now.cheers}` },
    // 운동 모집 (2026-10-28) — 모집 수 (저요가 붙은 모집) · 같이 운동한 쌍
    { label: "운동 모집 (저요)", a: `${last.calls ?? 0} (${last.calls_joined ?? 0})`, b: `${now.calls ?? 0} (${now.calls_joined ?? 0})` },
    { label: "같이 운동한 쌍", a: `${last.call_pairs ?? 0}쌍`, b: `${now.call_pairs ?? 0}쌍` },
  ];
  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-3">
      <p className="text-label font-black text-foreground">커뮤니티 숫자 · {shortBranchName(last.branch)}</p>
      <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-label">
        <span />
        <span className="text-right font-bold text-muted-foreground">지난주</span>
        <span className="text-right font-bold text-muted-foreground">이번 주</span>
        {rows.map((r) => (
          <Fragment key={r.label}>
            <span className="text-muted-foreground">{r.label}</span>
            <span className="number-font text-right font-bold text-foreground">{r.a}</span>
            <span className="number-font text-right font-bold text-foreground">{r.b}</span>
          </Fragment>
        ))}
      </div>
      <p className="mt-2 text-label text-muted-foreground">
        목표 4주 15% · 8주 25% · 최근 30일 출석 회원 중 앱 로그인 {now.app_rate_30d}% · 코치·운영진 제외
      </p>
    </div>
  );
};

const Avatar = ({ item, size = 36 }: { item: FeedItem; size?: number }) => (
  <span
    className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-body font-black text-muted-foreground"
    style={{ width: size, height: size }}
  >
    {item.avatarUrl ? (
      <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : (
      item.nickname.slice(0, 1)
    )}
  </span>
);

interface CommunityFeedProps {
  /** 댓글 알림(/myboxer/community?entry=<글>)으로 들어오면 그 글의 댓글 창을 연다 */
  openEntryId?: string | null;
  onEntryHandled?: () => void;
}

const CommunityFeed = ({ openEntryId = null, onEntryHandled }: CommunityFeedProps = {}) => {
  const qc = useQueryClient();
  const { role, viewAsMember, profile } = useAuth();
  // 전체관리자는 모든 지점 글이 와서 더 많이 받는다 (서버가 다시 확인한다)
  const hqRole = role === "super_admin" || role === "admin";
  // 👀 앱 전체 '회원으로 보기' 중 — 서버는 여전히 본사 권한이라 전 지점 글이 온다 → 내 지점 회원 피드로 읽는다 (2026-10-21)
  const forcedMemberView = viewAsMember ? profile?.branch_name ?? null : null;
  const feedQ = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => getCommunityFeed(hqRole ? 150 : 40),
    staleTime: 30_000,
  });
  // 회원 화면으로 보기 (전체관리자) — 고른 지점의 일반 회원이 보는 피드 그대로. null = 끔
  const [memberViewPick, setMemberView] = useState<string | null>(null);
  const memberView = forcedMemberView ?? memberViewPick;
  const mvKey = ["community-feed-mv", memberView ?? ""] as const;
  const mvQ = useQuery({
    queryKey: mvKey,
    queryFn: () => getCommunityFeedMemberView(memberView as string, 40),
    enabled: !!memberView,
    staleTime: 30_000,
  });
  const activeKey = memberView ? mvKey : FEED_KEY;
  const { data, isLoading, isError, refetch } = memberView ? mvQ : feedQ;
  const refreshFeeds = () => {
    qc.invalidateQueries({ queryKey: FEED_KEY });
    qc.invalidateQueries({ queryKey: ["community-feed-mv"] });
  };
  const [openEntry, setOpenEntry] = useState<PartnerJournalFeedRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showAllCheckins, setShowAllCheckins] = useState(false);
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [showGrants, setShowGrants] = useState(false);
  // 153 을 길게 누르면 그 동료에게 한마디 응원 (2026-10-27 커뮤니티 1단계)
  const [cheerTarget, setCheerTarget] = useState<CheerInitialTarget | null>(null);
  const onLong153 = (i: FeedItem) =>
    setCheerTarget({ user_id: i.userId, nickname: i.nickname, avatar_url: i.avatarUrl, league: i.league, branch: i.branch ?? null });
  const allBranches = !!data?.all_branches;

  const react = useMutation({
    mutationFn: (i: FeedItem) => toggle153(reactTargetOf(i.type), i.id),
    onMutate: async (i) => {
      await qc.cancelQueries({ queryKey: activeKey });
      const prev = qc.getQueryData<Feed>(activeKey);
      qc.setQueryData<Feed>(activeKey, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((x) =>
                x.id === i.id && x.type === i.type
                  ? { ...x, reacted: !x.reacted, count153: Math.max(0, x.count153 + (x.reacted ? -1 : 1)) }
                  : x,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (e, _i, ctx) => {
      if (ctx?.prev) qc.setQueryData(activeKey, ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: refreshFeeds,
  });

  const hide = useMutation({
    mutationFn: (i: FeedItem) => hideCommunityEntry(i.id),
    onSuccess: () => {
      toast.success("글을 숨겼어요");
      refreshFeeds();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const report = useMutation({
    mutationFn: (i: FeedItem) => reportCommunityEntry(i.id, ""),
    onSuccess: () => toast.success("신고를 받았어요. 코치님과 대표님이 확인할게요"),
    onError: (e) => toast.error((e as Error).message),
  });

  // 내 한 줄 공개 범위 바꾸기 (2026-10-18) — 바로 바뀐 것처럼 보이고, 실패하면 되돌린다
  const changeVis = useMutation({
    mutationFn: ({ item, v }: { item: FeedItem; v: JournalVisibility }) => setJournalEntryVisibility(item.id, v),
    onMutate: async ({ item, v }) => {
      await qc.cancelQueries({ queryKey: activeKey });
      const prev = qc.getQueryData<Feed>(activeKey);
      qc.setQueryData<Feed>(activeKey, (old) =>
        old
          ? { ...old, items: old.items.map((x) => (x.id === item.id && x.type === item.type ? { ...x, visibility: v } : x)) }
          : old,
      );
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(activeKey, ctx.prev);
      toast.error((e as Error).message);
    },
    onSuccess: (_d, { v }) => toast.success(`공개 범위를 바꿨어요 — ${VISIBILITY_LABEL[v]}`),
    onSettled: refreshFeeds,
  });

  const goal = useMutation({
    mutationFn: (text: string) => postWeeklyGoal(text),
    onSuccess: () => {
      toast.success("이번 주 목표를 올렸어요");
      setGoalDraft(null);
      refreshFeeds();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const allItems = data?.items ?? [];
  // 전 지점 보기 — 지점별 글 수 (지점 칩). 회원 화면으로 볼 때도 같은 칩으로 지점을 바꾼다
  const hqFeed = feedQ.data?.all_branches ? feedQ.data : null;
  const branchChips = useMemo(() => {
    if (!hqFeed) return [];
    const m = new Map<string, number>();
    for (const it of hqFeed.items) if (it.branch) m.set(it.branch, (m.get(it.branch) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [hqFeed]);
  const items = useMemo(
    () => (allBranches && branchFilter ? allItems.filter((i) => i.branch === branchFilter) : allItems),
    [allBranches, branchFilter, allItems],
  );
  const { pinned, checkins, newbies, posts } = useMemo(() => {
    const p: FeedItem[] = [];
    const c: FeedItem[] = [];
    const n: FeedItem[] = [];
    const j: FeedItem[] = [];
    for (const it of items) {
      if (it.pinned) p.push(it);
      else if (it.type === "checkin") (it.newbie ? n : c).push(it);
      else j.push(it);
    }
    c.sort((a, b) => b.at.localeCompare(a.at));
    j.sort((a, b) => b.at.localeCompare(a.at));
    return { pinned: p, checkins: c, newbies: n, posts: j };
  }, [items]);
  const hasGoal = pinned.some((i) => i.type === "goal");

  const onToggle = (i: FeedItem) => {
    if (i.isMine || react.isPending) return;
    react.mutate(i);
  };

  const openComments = (i: FeedItem) =>
    setOpenEntry({
      id: i.id,
      user_id: i.userId,
      display_name: i.nickname,
      prompt: i.prompt ?? "",
      content: i.content ?? "",
      mood: i.mood,
      created_at: i.at,
      comment_count: i.comments,
      relation: "branch",
    });

  const handledEntry = useRef<string | null>(null);
  useEffect(() => {
    if (!openEntryId || !data || handledEntry.current === openEntryId) return;
    handledEntry.current = openEntryId;
    const it = data.items.find((x) => x.id === openEntryId && (x.type === "journal" || x.type === "goal"));
    if (it) openComments(it);
    onEntryHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntryId, data]);

  /** 글 아래 줄 — 153 · 댓글 · ⋯(숨기기/신고) */
  const actions = (i: FeedItem) => (
    <div className="mt-2.5 flex items-center gap-2">
      <Btn153 item={i} onToggle={onToggle} onLongPress={onLong153} />
      <button
        type="button"
        onClick={() => openComments(i)}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-pill px-2.5 text-label font-bold text-muted-foreground active:scale-95"
      >
        <MessageCircle className="h-4 w-4" />
        {i.comments > 0 ? `댓글 ${i.comments}` : "댓글"}
      </button>
      <div className="relative ml-auto">
        <button
          type="button"
          aria-label="더보기"
          onClick={() => setMenuFor(menuFor === i.id ? null : i.id)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground active:scale-95"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menuFor === i.id && (
          <div
            className={`absolute right-0 top-10 z-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg ${
              i.isMine && i.type === "journal" ? "w-44" : "w-36"
            }`}
          >
            {/* 내 한 줄 — 공개 범위 바꾸기 (2026-10-18) */}
            {i.isMine && i.type === "journal" && !i.hidden && (
              <div role="group" aria-label="공개 범위" className="border-b border-border pb-1">
                <p className="px-3 pb-1 pt-2.5 text-label font-bold text-muted-foreground">공개 범위</p>
                {JOURNAL_VISIBILITIES.map((v) => {
                  const Icon = VIS_ICON[v];
                  const on = (i.visibility ?? "branch") === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="menuitemradio"
                      aria-checked={on}
                      onClick={() => {
                        setMenuFor(null);
                        if (!on) changeVis.mutate({ item: i, v });
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-label font-bold hover:bg-muted ${
                        on ? "text-primary" : "text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {VISIBILITY_LABEL[v]}
                      {on && <Check className="ml-auto h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
            {(i.isMine || data?.is_staff) && !i.hidden ? (
              <button
                type="button"
                onClick={() => {
                  setMenuFor(null);
                  hide.mutate(i);
                }}
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-label font-bold text-foreground hover:bg-muted"
              >
                <EyeOff className="h-3.5 w-3.5" /> 숨기기
              </button>
            ) : null}
            {!i.isMine && (
              <button
                type="button"
                onClick={() => {
                  setMenuFor(null);
                  report.mutate(i);
                }}
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-label font-bold text-destructive hover:bg-muted"
              >
                <Flag className="h-3.5 w-3.5" /> 신고하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /** 사진 — 누르면 회원 카드 */
  const avatarBtn = (i: FeedItem, size?: number) => (
    <button
      type="button"
      onClick={() => openMemberCard(i.userId)}
      aria-label={`${i.nickname}님 회원 카드 보기`}
      className="shrink-0 rounded-full active:scale-95"
    >
      <Avatar item={i} size={size} />
    </button>
  );

  /** 전 지점 보기 — 글마다 지점 이름 */
  const branchTag = (i: FeedItem) =>
    allBranches && i.branch ? (
      <span className="shrink-0 text-label font-bold text-muted-foreground">· {shortBranchName(i.branch)}</span>
    ) : null;

  const nameLine = (i: FeedItem) => (
    <div className="flex min-w-0 items-center gap-1">
      {/* 이름을 누르면 누구나 회원 카드 — 좋아요 · 메시지 · 짝꿍 신청 · 응원 (관리자는 카드에서 회원 상세로) */}
      <button
        type="button"
        onClick={() => openMemberCard(i.userId)}
        className="truncate text-left text-body font-bold text-foreground active:opacity-70"
        aria-label={`${i.nickname}님 회원 카드 보기`}
      >
        {i.nickname}
      </button>
      {i.isStaff ? (
        <span className="shrink-0 rounded-pill bg-yellow-500/15 px-1.5 py-0.5 text-micro font-black text-yellow-600">
          {i.staffTitle || "코치"}
        </span>
      ) : (
        <>
          <NameBadge league={i.league} className="h-4 w-4" glow={false} />
          <span className="number-font shrink-0 text-micro font-bold text-muted-foreground">Lv.{i.level}</span>
        </>
      )}
      {branchTag(i)}
    </div>
  );

  if (isLoading) {
    return <p className="py-6 text-center text-label text-muted-foreground">피드를 불러오는 중…</p>;
  }
  if (isError) {
    return (
      <div className="rounded-card border border-border bg-card px-4 py-5 text-center">
        <p className="text-label font-bold text-foreground">피드를 불러오지 못했어요</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-label font-bold text-primary underline">
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!data?.branch && !allBranches) {
    return (
      <div className="rounded-card border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-label text-muted-foreground">
        지점이 정해지면 같은 지점 동료들의 피드가 보여요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 회원 화면으로 보는 중 — 그 지점 일반 회원에게 보이는 그대로 (2026-10-18).
          앱 전체 '회원으로 보기' 중엔 회원 화면 그대로라 이 안내도 숨긴다 (2026-10-21) */}
      {memberView && !forcedMemberView && (
        <div className="rounded-card border-2 border-primary/50 bg-card p-3">
          <p className="flex items-center gap-1.5 text-label font-black text-foreground">
            <Eye className="h-4 w-4 text-primary" /> 회원 화면으로 보는 중 · {shortBranchName(memberView)}
          </p>
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">
            이 지점 회원에게 보이는 그대로예요. 친구만 글은 그 친구에게만, 나만 보기 글은 쓴 사람에게만 보여서 여기선 빠져요.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {branchChips.length > 1 &&
              branchChips.map(([b]) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setMemberView(b)}
                  aria-pressed={memberView === b}
                  className={`rounded-pill border px-2.5 py-1 text-label font-bold ${
                    memberView === b ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {shortBranchName(b)}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setMemberView(null)}
              className="rounded-pill border border-primary/40 bg-primary/5 px-3 py-1 text-label font-bold text-primary active:scale-95"
            >
              전 지점 보기로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 전 지점 보기 — 모든 지점 · 모든 글 (친구만 · 나만 보기 · 숨긴 글 포함) */}
      {allBranches && (
        <div className="rounded-card border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-label font-black text-foreground">
            <Building2 className="h-4 w-4 text-primary" /> 전 지점 보기 — 모든 지점의 모든 글
          </p>
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">
            친구만 · 나만 보기 · 숨긴 글까지 최근 30일이 보여요. 이름을 누르면 회원 카드가 열려요.
          </p>
          {branchChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[{ b: null as string | null, n: allItems.length }, ...branchChips.map(([b, n]) => ({ b, n }))].map(({ b, n }) => (
                <button
                  key={b ?? "all"}
                  type="button"
                  onClick={() => setBranchFilter(b)}
                  aria-pressed={branchFilter === b}
                  className={`rounded-pill border px-2.5 py-1 text-label font-bold ${
                    branchFilter === b ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {b ? shortBranchName(b) : "전체"} {n}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* 회원 화면으로 보기 — 고른 지점(없으면 글이 가장 많은 지점) 일반 회원 화면 */}
            <button
              type="button"
              disabled={branchChips.length === 0}
              onClick={() => setMemberView(branchFilter ?? branchChips[0]?.[0] ?? null)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 bg-card px-3 py-1.5 text-label font-bold text-primary active:scale-95 disabled:opacity-50"
            >
              <Eye className="h-3.5 w-3.5" /> 회원 화면으로 보기
            </button>
            {/* 지점장·코치 권한 — 커뮤니티 모든 글 보기 · 우리 지점 목표 만들기 (2026-10-18) */}
            <button
              type="button"
              onClick={() => setShowGrants((v) => !v)}
              aria-expanded={showGrants}
              aria-controls="community-view-grants"
              className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 bg-card px-3 py-1.5 text-label font-bold text-primary active:scale-95"
            >
              <KeyRound className="h-3.5 w-3.5" /> 지점장·코치 권한 {showGrants ? "접기" : "관리"}
            </button>
          </div>
          {showGrants && <CommunityViewGrants />}
          <CommunityMetricsCard />
        </div>
      )}

      {/* 본사가 보기 권한을 준 지점장·코치 — 무엇이 보이는지 알린다 (2026-10-18) */}
      {data.granted && !allBranches && (
        <div className="rounded-card border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-label font-black text-foreground">
            <KeyRound className="h-4 w-4 text-primary" /> 운영진 보기 — 우리 지점의 모든 글
          </p>
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">
            권한을 받아 친구만 · 나만 보기 · 숨긴 글까지 보여요. 회원 관리와 응원에만 써 주세요.
          </p>
        </div>
      )}

      {/* 코치님 — 이번 주 목표 올리기 (전체관리자도 해 볼 수 있다 — 내 지점으로 올라간다, 2026-10-18) */}
      {data.is_staff && !memberView && (
        <div className="rounded-card border border-yellow-500/30 bg-yellow-500/5 p-3">
          {goalDraft === null ? (
            <button
              type="button"
              onClick={() => setGoalDraft("")}
              className="flex w-full items-center gap-2 text-left text-label font-bold text-foreground"
            >
              <Target className="h-4 w-4 text-yellow-600" />
              {hasGoal ? "이번 주 목표 다시 올리기 (코치님)" : "이번 주 목표 올리기 (코치님)"}
              {allBranches && data.branch && (
                <span className="ml-auto shrink-0 text-label font-semibold text-muted-foreground">
                  {shortBranchName(data.branch)}에 올라가요
                </span>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="예: 이번 주는 가드 올리고 원투 100개! 매일 한 판 더."
                className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-label focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGoalDraft(null)}
                  className="flex-1 rounded-xl border border-border py-2 text-label font-bold text-muted-foreground"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={goal.isPending || goalDraft.trim().length < 2}
                  onClick={() => goal.mutate(goalDraft.trim())}
                  className="flex-1 rounded-xl bg-primary py-2 text-label font-bold text-primary-foreground disabled:opacity-50"
                >
                  {goal.isPending ? "올리는 중…" : "올리기"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 고정 — 이번 주 목표 · 승급 축하 */}
      {pinned.map((i) =>
        i.type === "goal" ? (
          <article key={`g-${i.id}`} className="rounded-card border-2 border-yellow-500/40 bg-yellow-500/5 p-4">
            <p className="flex items-center gap-1.5 text-label font-bold text-yellow-600">
              <Target className="h-3.5 w-3.5" /> 이번 주 목표 · {i.nickname} {i.staffTitle || "코치"}
              {allBranches && i.branch ? ` · ${shortBranchName(i.branch)}` : ""}
              {i.hidden && " · 숨긴 글"}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-body font-bold leading-relaxed text-foreground">{i.content}</p>
            {actions(i)}
          </article>
        ) : (
          <article key={`p-${i.id}`} className="rounded-card border-2 border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2.5">
              {avatarBtn(i, 40)}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-label font-bold text-primary">
                  <PartyPopper className="h-3.5 w-3.5" /> 승급 축하 · {timeAgo(i.at)}
                  {allBranches && i.branch ? ` · ${shortBranchName(i.branch)}` : ""}
                </p>
                <p className="mt-0.5 text-body font-bold text-foreground">
                  <button type="button" onClick={() => openMemberCard(i.userId)} className="text-left active:opacity-70">
                    {i.nickname}님
                  </button>{" "}
                  레벨 {i.promoLevel} 통과!
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-label text-muted-foreground">
                  {i.promoRank && NEXT_LEAGUE[i.promoRank] ? (
                    <>
                      <NameBadge league={NEXT_LEAGUE[i.promoRank]} className="h-3.5 w-3.5" glow={false} />
                      {RANK_LABELS[NEXT_LEAGUE[i.promoRank]]} 리그로 올라갔어요
                    </>
                  ) : (
                    "마스터 로드에 도전해요"
                  )}
                </p>
              </div>
              <Btn153 item={i} onToggle={onToggle} onLongPress={onLong153} />
            </div>
          </article>
        ),
      )}

      {/* 오늘도 한 판 — 오늘 출석한 동료 (한 장으로 묶음) */}
      {checkins.length > 0 && (
        <article className="rounded-card border border-border bg-card p-4">
          <p className="text-label font-bold text-primary">오늘도 한 판</p>
          <p className="mt-0.5 text-body font-bold text-foreground">
            오늘 {checkins.length}명이 왔어요{allBranches ? (branchFilter ? ` · ${shortBranchName(branchFilter)}` : " · 전 지점") : ""}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(showAllCheckins ? checkins : checkins.slice(0, 12)).map((i) => (
              <span
                key={`c-${i.id}`}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-muted/30 py-1 pl-1 pr-1.5"
              >
                <button
                  type="button"
                  onClick={() => openMemberCard(i.userId)}
                  aria-label={`${i.nickname}님 회원 카드 보기`}
                  className="inline-flex min-w-0 items-center gap-1.5 active:opacity-70"
                >
                  <Avatar item={i} size={26} />
                  <span className="max-w-[6rem] truncate text-label font-bold text-foreground">{i.nickname}</span>
                </button>
                <NameBadge league={i.league} className="h-3 w-3" glow={false} />
                <Btn153 item={i} onToggle={onToggle} onLongPress={onLong153} compact />
              </span>
            ))}
          </div>
          {checkins.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllCheckins((v) => !v)}
              className="mt-2 min-h-[40px] text-label font-bold text-primary"
            >
              {showAllCheckins ? "접기" : `${checkins.length - 12}명 더 보기`}
            </button>
          )}
        </article>
      )}

      {/* 새 식구 — 첫 출석 */}
      {newbies.map((i) => (
        <article key={`n-${i.id}`} className="rounded-card border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2.5">
            {avatarBtn(i, 40)}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-label font-bold text-emerald-600">
                <Sprout className="h-3.5 w-3.5" /> 새 식구
                {allBranches && i.branch ? ` · ${shortBranchName(i.branch)}` : ""}
              </p>
              <p className="mt-0.5 text-body font-bold text-foreground">
                <button type="button" onClick={() => openMemberCard(i.userId)} className="text-left active:opacity-70">
                  {i.nickname}님
                </button>{" "}
                첫 출석! 환영해요
              </p>
            </div>
            <Btn153 item={i} onToggle={onToggle} onLongPress={onLong153} />
          </div>
          {/* 환영 인사 — 동료가 한마디씩 (2026-10-18) */}
          <NewbieWelcome item={i} onSent={refreshFeeds} />
        </article>
      ))}

      {/* 오늘 운동 한 줄 */}
      {posts.map((i) => (
        <article key={`j-${i.id}`} className="rounded-card border border-border bg-card p-4">
          <div className="flex items-center gap-2.5">
            {avatarBtn(i)}
            <div className="min-w-0 flex-1">
              {nameLine(i)}
              <p className="flex items-center gap-1 text-label text-muted-foreground">
                {timeAgo(i.at)}
                {i.mood ? ` · ${i.mood}` : ""}
                {/* 공개 범위 — 내 글은 늘, 남의 글은 전체 공개가 아닐 때만 (2026-10-18) */}
                {i.visibility && (i.isMine || i.visibility !== "branch") && (() => {
                  const Icon = VIS_ICON[i.visibility];
                  return (
                    <span
                      className={`inline-flex items-center gap-0.5 ${i.visibility === "private" ? "font-bold text-foreground" : ""}`}
                    >
                      · <Icon className="h-3 w-3" /> {VISIBILITY_LABEL[i.visibility]}
                    </span>
                  );
                })()}
                {i.hidden && (
                  <span className="inline-flex items-center gap-0.5 font-bold text-destructive">
                    · <EyeOff className="h-3 w-3" /> 숨긴 글
                  </span>
                )}
              </p>
            </div>
          </div>
          {i.prompt && <p className="mt-3 text-label font-bold text-primary">{i.prompt}</p>}
          <p className="mt-3 whitespace-pre-wrap text-body leading-relaxed text-foreground">{i.content}</p>
          {i.photoUrl && (
            <img
              src={i.photoUrl}
              alt={`${i.nickname}님이 올린 사진`}
              loading="lazy"
              className="mt-3 max-h-[420px] w-full rounded-xl object-cover"
            />
          )}
          {actions(i)}
        </article>
      ))}

      {posts.length === 0 && (
        <div className="rounded-card border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-label font-bold text-foreground">
            {allBranches ? "최근 30일 올라온 글이 없어요" : "아직 올라온 한 줄이 없어요"}
          </p>
          {!allBranches && <p className="mt-1 text-label text-muted-foreground">오늘 운동을 한 줄로 남기고 첫 153을 받아보세요.</p>}
        </div>
      )}

      <PartnerJournalCommentSheet open={!!openEntry} entry={openEntry} onClose={() => setOpenEntry(null)} />
      <SecondCheerSheet open={!!cheerTarget} onClose={() => setCheerTarget(null)} initialTarget={cheerTarget} />
    </div>
  );
};

export default CommunityFeed;
