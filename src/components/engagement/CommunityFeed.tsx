/**
 * 153 커뮤니티 — 모두의 피드 (2026-10-15 대표님: "커뮤니티 개편안대로 — 반응 이름은 153").
 *
 * 순서: 코치 이번 주 목표(고정) → 승급 축하(고정) → 오늘도 한 판(오늘 출석한 동료, 한 장으로 묶음) → 새 식구 → 오늘 운동 한 줄.
 * 반응은 '153' 하나. 내 글에는 누를 수 없다. 153·댓글에는 보상이 없다 (공식 레벨업과 무관).
 * 이번 주 153을 가장 많이 보낸 회원이 라이브보드 TV 의 '이번 주 153왕' — 받은 수가 아니라 보낸 수.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Lock, MessageCircle, MoreHorizontal, PartyPopper, Sprout, Target, EyeOff } from "lucide-react";

import {
  getCommunityFeed,
  hideCommunityEntry,
  postWeeklyGoal,
  reactTargetOf,
  reportCommunityEntry,
  toggle153,
  type CommunityFeed as Feed,
  type FeedItem,
} from "@/services/communityFeedService";
import type { PartnerJournalFeedRow } from "@/services/championJournalPartnerService";
import { RANK_LABELS } from "@/lib/rankLabels";
import NameBadge from "@/components/badges/NameBadge";
import PartnerJournalCommentSheet from "./PartnerJournalCommentSheet";

const FEED_KEY = ["community-feed"] as const;
const NEXT_LEAGUE: Record<string, string> = { white: "blue", blue: "red", red: "black" };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}일 전` : new Date(iso).toLocaleDateString("ko-KR");
}

/** 153 버튼 — 눌렀으면 채워진다. 내 글이면 숫자만 */
const Btn153 = ({ item, onToggle, compact }: { item: FeedItem; onToggle: (i: FeedItem) => void; compact?: boolean }) => (
  <button
    type="button"
    disabled={item.isMine}
    onClick={() => onToggle(item)}
    aria-pressed={item.reacted}
    aria-label={item.isMine ? `153 ${item.count153}개` : item.reacted ? "153 취소" : "153 보내기"}
    className={`inline-flex shrink-0 items-center gap-1 rounded-pill border font-black transition-all active:scale-95 disabled:active:scale-100 ${
      compact ? "px-2 py-0.5 text-[10.5px]" : "px-3 py-1 text-[12px]"
    } ${
      item.reacted
        ? "border-primary bg-primary text-primary-foreground"
        : "border-primary/40 bg-primary/5 text-primary"
    } ${item.isMine ? "opacity-70" : ""}`}
  >
    <span className="number-font tracking-tight">153</span>
    {item.count153 > 0 && <span className="number-font opacity-90">{item.count153}</span>}
  </button>
);

const Avatar = ({ item, size = 36 }: { item: FeedItem; size?: number }) => (
  <span
    className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[13px] font-black text-muted-foreground"
    style={{ width: size, height: size }}
  >
    {item.avatarUrl ? (
      <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : (
      item.nickname.slice(0, 1)
    )}
  </span>
);

const CommunityFeed = () => {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => getCommunityFeed(40),
    staleTime: 30_000,
  });
  const [openEntry, setOpenEntry] = useState<PartnerJournalFeedRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showAllCheckins, setShowAllCheckins] = useState(false);
  const [goalDraft, setGoalDraft] = useState<string | null>(null);

  const react = useMutation({
    mutationFn: (i: FeedItem) => toggle153(reactTargetOf(i.type), i.id),
    onMutate: async (i) => {
      await qc.cancelQueries({ queryKey: FEED_KEY });
      const prev = qc.getQueryData<Feed>(FEED_KEY);
      qc.setQueryData<Feed>(FEED_KEY, (old) =>
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
      if (ctx?.prev) qc.setQueryData(FEED_KEY, ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: FEED_KEY }),
  });

  const hide = useMutation({
    mutationFn: (i: FeedItem) => hideCommunityEntry(i.id),
    onSuccess: () => {
      toast.success("글을 숨겼어요");
      qc.invalidateQueries({ queryKey: FEED_KEY });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const report = useMutation({
    mutationFn: (i: FeedItem) => reportCommunityEntry(i.id, ""),
    onSuccess: () => toast.success("신고를 받았어요. 코치님과 대표님이 확인할게요"),
    onError: (e) => toast.error((e as Error).message),
  });

  const goal = useMutation({
    mutationFn: (text: string) => postWeeklyGoal(text),
    onSuccess: () => {
      toast.success("이번 주 목표를 올렸어요");
      setGoalDraft(null);
      qc.invalidateQueries({ queryKey: FEED_KEY });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const items = data?.items ?? [];
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

  /** 글 아래 줄 — 153 · 댓글 · ⋯(숨기기/신고) */
  const actions = (i: FeedItem) => (
    <div className="mt-2 flex items-center gap-2">
      <Btn153 item={i} onToggle={onToggle} />
      <button
        type="button"
        onClick={() => openComments(i)}
        className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[11.5px] font-bold text-muted-foreground active:scale-95"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {i.comments > 0 ? `댓글 ${i.comments}` : "댓글"}
      </button>
      <div className="relative ml-auto">
        <button
          type="button"
          aria-label="더보기"
          onClick={() => setMenuFor(menuFor === i.id ? null : i.id)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:scale-95"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuFor === i.id && (
          <div className="absolute right-0 top-8 z-10 w-32 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {i.isMine || data?.is_staff ? (
              <button
                type="button"
                onClick={() => {
                  setMenuFor(null);
                  hide.mutate(i);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-foreground hover:bg-muted"
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
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-destructive hover:bg-muted"
              >
                <Flag className="h-3.5 w-3.5" /> 신고하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const nameLine = (i: FeedItem) => (
    <div className="flex min-w-0 items-center gap-1">
      <span className="truncate text-[13px] font-bold text-foreground">{i.nickname}</span>
      {i.isStaff ? (
        <span className="shrink-0 rounded-pill bg-yellow-500/15 px-1.5 py-0.5 text-[9.5px] font-black text-yellow-600">
          {i.staffTitle || "코치"}
        </span>
      ) : (
        <>
          <NameBadge league={i.league} className="h-3.5 w-3.5" glow={false} />
          <span className="number-font shrink-0 text-[10.5px] font-bold text-muted-foreground">Lv.{i.level}</span>
        </>
      )}
    </div>
  );

  if (isLoading) {
    return <p className="py-6 text-center text-[12px] text-muted-foreground">피드를 불러오는 중…</p>;
  }
  if (isError) {
    return (
      <div className="rounded-card border border-border bg-card px-4 py-5 text-center">
        <p className="text-[12.5px] font-bold text-foreground">피드를 불러오지 못했어요</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-[12px] font-bold text-primary underline">
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!data?.branch) {
    return (
      <div className="rounded-card border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-[12px] text-muted-foreground">
        지점이 정해지면 같은 지점 동료들의 피드가 보여요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 코치님 — 이번 주 목표 올리기 */}
      {data.is_staff && (
        <div className="rounded-card border border-yellow-500/30 bg-yellow-500/5 p-3">
          {goalDraft === null ? (
            <button
              type="button"
              onClick={() => setGoalDraft("")}
              className="flex w-full items-center gap-2 text-left text-[12.5px] font-bold text-foreground"
            >
              <Target className="h-4 w-4 text-yellow-600" />
              {hasGoal ? "이번 주 목표 다시 올리기 (코치님)" : "이번 주 목표 올리기 (코치님)"}
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="예: 이번 주는 가드 올리고 원투 100개! 매일 한 판 더."
                className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-[13px] focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGoalDraft(null)}
                  className="flex-1 rounded-xl border border-border py-2 text-[12.5px] font-bold text-muted-foreground"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={goal.isPending || goalDraft.trim().length < 2}
                  onClick={() => goal.mutate(goalDraft.trim())}
                  className="flex-1 rounded-xl bg-primary py-2 text-[12.5px] font-bold text-primary-foreground disabled:opacity-50"
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
          <article key={`g-${i.id}`} className="rounded-card border-2 border-yellow-500/40 bg-yellow-500/5 p-3.5">
            <p className="flex items-center gap-1.5 text-[10.5px] font-black tracking-wider text-yellow-600">
              <Target className="h-3.5 w-3.5" /> 이번 주 목표 · {i.nickname} {i.staffTitle || "코치"}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-bold leading-relaxed text-foreground">{i.content}</p>
            {actions(i)}
          </article>
        ) : (
          <article key={`p-${i.id}`} className="rounded-card border-2 border-primary/40 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar item={i} size={40} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[10.5px] font-black tracking-wider text-primary">
                  <PartyPopper className="h-3.5 w-3.5" /> 승급 축하 · {timeAgo(i.at)}
                </p>
                <p className="mt-0.5 text-[13.5px] font-bold text-foreground">
                  {i.nickname}님 레벨 {i.promoLevel} 통과!
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
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
              <Btn153 item={i} onToggle={onToggle} />
            </div>
          </article>
        ),
      )}

      {/* 오늘도 한 판 — 오늘 출석한 동료 (한 장으로 묶음) */}
      {checkins.length > 0 && (
        <article className="rounded-card border border-border bg-card p-3.5">
          <p className="text-[10.5px] font-black tracking-wider text-primary">오늘도 한 판</p>
          <p className="mt-0.5 text-[13px] font-bold text-foreground">오늘 {checkins.length}명이 왔어요</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(showAllCheckins ? checkins : checkins.slice(0, 12)).map((i) => (
              <span
                key={`c-${i.id}`}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-muted/30 py-1 pl-1 pr-1.5"
              >
                <Avatar item={i} size={22} />
                <span className="max-w-[5.5rem] truncate text-[11.5px] font-bold text-foreground">{i.nickname}</span>
                <NameBadge league={i.league} className="h-3 w-3" glow={false} />
                <Btn153 item={i} onToggle={onToggle} compact />
              </span>
            ))}
          </div>
          {checkins.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllCheckins((v) => !v)}
              className="mt-2 text-[11.5px] font-bold text-primary"
            >
              {showAllCheckins ? "접기" : `${checkins.length - 12}명 더 보기`}
            </button>
          )}
        </article>
      )}

      {/* 새 식구 — 첫 출석 */}
      {newbies.map((i) => (
        <article key={`n-${i.id}`} className="flex items-center gap-2.5 rounded-card border border-emerald-500/30 bg-emerald-500/5 p-3.5">
          <Avatar item={i} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[10.5px] font-black tracking-wider text-emerald-600">
              <Sprout className="h-3.5 w-3.5" /> 새 식구
            </p>
            <p className="mt-0.5 text-[13px] font-bold text-foreground">{i.nickname}님 첫 출석! 환영해요</p>
          </div>
          <Btn153 item={i} onToggle={onToggle} />
        </article>
      ))}

      {/* 오늘 운동 한 줄 */}
      {posts.map((i) => (
        <article key={`j-${i.id}`} className="rounded-card border border-border bg-card p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar item={i} />
            <div className="min-w-0 flex-1">
              {nameLine(i)}
              <p className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                {timeAgo(i.at)}
                {i.mood ? ` · ${i.mood}` : ""}
                {i.visibility === "partners" && (
                  <span className="inline-flex items-center gap-0.5">
                    · <Lock className="h-3 w-3" /> 짝꿍만
                  </span>
                )}
              </p>
            </div>
          </div>
          {i.prompt && <p className="mt-2 text-[11px] font-bold text-primary">{i.prompt}</p>}
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{i.content}</p>
          {i.photoUrl && (
            <img
              src={i.photoUrl}
              alt={`${i.nickname}님이 올린 사진`}
              loading="lazy"
              className="mt-2 max-h-80 w-full rounded-xl object-cover"
            />
          )}
          {actions(i)}
        </article>
      ))}

      {posts.length === 0 && (
        <div className="rounded-card border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-[12.5px] font-bold text-foreground">아직 올라온 한 줄이 없어요</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">오늘 운동을 한 줄로 남기고 첫 153을 받아보세요.</p>
        </div>
      )}

      <PartnerJournalCommentSheet open={!!openEntry} entry={openEntry} onClose={() => setOpenEntry(null)} />
    </div>
  );
};

export default CommunityFeed;
