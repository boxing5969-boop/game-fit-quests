/**
 * 153 챌린지 킹 보드 (2026-09-23)
 *
 * 대표님 지시: "출석왕·버피왕·체력왕 등등 — 글보다 버튼, 버튼을 누르면 설명이 나오게, 깔끔하게".
 *
 * 구조
 *   · 컨트롤: 이번 주 / 이번 달 · 내 지점 / 전체
 *   · 왕좌 버튼 8개 (4×2): 이모지 + 이름 + 현재 왕 이름 + 내 순위. 글 없음.
 *     앞 세 개(출석왕·앱활동왕·닉네임왕)가 사이니지 TV2 런칭 이벤트 ①②③ 과 같은 왕좌다 (같은 서버 점수).
 *   · 버튼을 누르면 아래에 상세: 규칙 두 줄 → 현재 왕(골드) → 나 → Top 10 → 행동 버튼(버피 기록·아레나·닉네임 좋아요)
 * 숫자는 전부 서버 RPC(get_153_king_summary / get_153_king_board)에서 온다.
 *
 * 보호 원칙: 읽기 전용 — 공식 XP / wallet / level 변경 0건. 아레나 기록은 기존 FunChallengeArenaSheet 경로.
 *
 * 2026-09-23 검수 반영: 범위 기본값을 프로필 로딩 뒤에 맞춤 · 이벤트 종료 후 "최종" 표기(격차·행동 버튼 숨김) ·
 * 연속출석은 '지금 연속', 닉네임왕은 '누적' 배지 · 불러오기 실패를 빈 왕좌와 구분 · 320px 줄바꿈.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, ChevronUp, Info, PartyPopper } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { KING_153_KEY, use153KingBoard, use153KingSummary, useLaunchEventWindow } from "@/hooks/use153King";
import {
  KING_CATEGORIES, KING_META, KING_PERIOD_LABEL, KING_PERIOD_RESET, LAUNCH_EVENT_CATEGORIES, formatKingScore, launchEventLine,
  type KingBoardRow, type KingCategory, type KingMeta, type KingPeriod, type KingScope,
} from "@/services/king153Service";
import FunChallengeArenaSheet from "./FunChallengeArenaSheet";
import NicknameLikeSheet from "./NicknameLikeSheet";

const PERIODS: Array<{ key: KingPeriod; label: string }> = [
  { key: "event", label: "🎉 이벤트" },
  { key: "weekly", label: "이번 주" },
  { key: "monthly", label: "이번 달" },
];
const SCOPES: Array<{ key: KingScope; label: string }> = [
  { key: "branch", label: "내 지점" },
  { key: "all", label: "전체" },
];

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`);

/** 상세 배지 — 연속출석은 '지금 연속'(이벤트 탭은 시작일부터), 닉네임왕은 기간과 상관없는 '누적' */
const periodBadge = (m: KingMeta, period: KingPeriod): string => {
  if (m.key === "streak") return period === "event" ? "이벤트 · 지금 연속" : "지금 연속";
  if (m.key === "nickname") return "누적";
  return KING_PERIOD_LABEL[period];
};
/** 왕과의 격차 — 연속출석은 "3일"(“3일 연속” 이 아니라) */
const gapLabel = (gap: number, m: KingMeta): string =>
  m.key === "streak" ? `${gap.toLocaleString("ko-KR")}일` : formatKingScore(gap, m.key);
const shortBranch = (b: string) => b.replace(/^153복싱짐\s*/, "");

/** 작은 세그먼트 컨트롤 — 두 개(기간·범위)가 같은 모양 */
const Segmented = <K extends string>({ value, options, onChange, ariaLabel }: {
  value: K; options: Array<{ key: K; label: string }>; onChange: (k: K) => void; ariaLabel: string;
}) => (
  <div role="tablist" aria-label={ariaLabel} className="flex rounded-pill border border-border bg-muted/30 p-0.5">
    {options.map((o) => {
      const on = o.key === value;
      return (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(o.key)}
          className={`whitespace-nowrap rounded-pill px-3 py-1 text-[11px] font-bold transition-all active:scale-95 ${
            on ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

const King153Board = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const hasBranch = !!(profile?.branch_name || "").trim();

  // 런칭 이벤트가 진행 중이면 이벤트 탭을 기본으로 — 시작 전/종료 후엔 이번 주
  const eventQ = useLaunchEventWindow();
  const [period, setPeriod] = useState<KingPeriod>("weekly");
  const [periodTouched, setPeriodTouched] = useState(false);
  useEffect(() => {
    if (!periodTouched && eventQ.data?.status === "active") setPeriod("event");
  }, [eventQ.data?.status, periodTouched]);
  const choosePeriod = (p: KingPeriod) => { setPeriodTouched(true); setPeriod(p); };
  // 프로필이 늦게 오면 첫 렌더엔 지점이 비어 '전체' 로 시작한다 — 사용자가 직접 고르기 전까지는 지점이 보이면 '내 지점' 으로.
  const [scope, setScope] = useState<KingScope>(hasBranch ? "branch" : "all");
  const [scopeTouched, setScopeTouched] = useState(false);
  useEffect(() => {
    if (!scopeTouched) setScope(hasBranch ? "branch" : "all");
  }, [hasBranch, scopeTouched]);
  const chooseScope = (s: KingScope) => { setScopeTouched(true); setScope(s); };
  const [selected, setSelected] = useState<KingCategory | null>(null);
  const [arena, setArena] = useState<{ open: boolean; code: string | null }>({ open: false, code: null });
  const [likeOpen, setLikeOpen] = useState(false);

  const summaryQ = use153KingSummary(period, scope);
  const boardQ = use153KingBoard(selected, period, scope, 10);

  const items = useMemo(() => {
    const map = new Map(summaryQ.data?.items.map((i) => [i.category, i]) ?? []);
    return KING_CATEGORIES.map((c) => ({ meta: KING_META[c], item: map.get(c) ?? null }));
  }, [summaryQ.data]);

  // 내 지점에 아직 기록이 하나도 없으면(본사 계정·새 지점) 전체 보기로 안내
  const eventUpcoming = period === "event" && eventQ.data?.status === "upcoming";
  const eventEnded = period === "event" && eventQ.data?.status === "ended";
  const branchEmpty =
    scope === "branch" && !eventUpcoming && !summaryQ.isLoading && !!summaryQ.data && summaryQ.data.items.every((i) => i.total === 0);

  const openArena = (code: string | null) => setArena({ open: true, code });
  const closeLike = () => {
    setLikeOpen(false);
    queryClient.invalidateQueries({ queryKey: KING_153_KEY });
  };
  const runAction = (action: NonNullable<KingMeta["action"]>) => {
    if (action === "nickname_like") setLikeOpen(true);
    else openArena(action === "arena_burpee" ? "burpee_blast" : null);
  };
  const closeArena = () => {
    setArena((a) => ({ ...a, open: false }));
    // 아레나에서 기록했으면 순위가 바뀐다 — 킹 보드 전부 다시 읽기
    queryClient.invalidateQueries({ queryKey: KING_153_KEY });
  };

  const meta = selected ? KING_META[selected] : null;
  const board = boardQ.data;
  const king: KingBoardRow | null = board?.board[0] ?? null;
  const me = board?.me ?? null;
  const meInList = !!board?.board.some((r) => r.is_me);
  const gapToKing = king && me && me.rank > 1 && !eventEnded ? Number(king.score) - Number(me.score) : null;

  return (
    <section aria-label="153 챌린지 킹 보드" className="space-y-3">
      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<KingPeriod> value={period} options={PERIODS} onChange={choosePeriod} ariaLabel="기간" />
        {hasBranch && <Segmented<KingScope> value={scope} options={SCOPES} onChange={chooseScope} ariaLabel="범위" />}
      </div>

      {/* 런칭 이벤트 띠 — 이벤트 탭일 때만. 시작 전엔 D-day, 진행 중엔 기간, 종료 후엔 최종 결과 */}
      {period === "event" && (
        <div className="flex items-center gap-2 rounded-xl border border-reward/30 bg-reward/10 px-3 py-2">
          <PartyPopper className="h-4 w-4 shrink-0 text-reward" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black text-foreground">153 마이복서 런칭 이벤트</p>
            <p className="truncate text-[10.5px] text-muted-foreground">
              {eventQ.data ? launchEventLine(eventQ.data) : "기간 확인 중…"} · 사이니지 TV에 ①출석왕 ②앱활동왕 ③닉네임왕이 걸려요
            </p>
          </div>
        </div>
      )}

      {/* 왕좌 버튼 8개 — 앞 세 개가 런칭 이벤트 ①②③. 튜토리얼 1일차 스포트라이트가 이 격자를 가리킨다. */}
      <div data-tour="challenge153-leaderboard" className="grid grid-cols-4 gap-1.5">
        {items.map(({ meta: m, item }) => {
          const on = selected === m.key;
          const kingName = item?.king?.display_name ?? null;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected(on ? null : m.key)}
              className={`relative min-w-0 rounded-2xl border p-2.5 text-left transition-all active:scale-[0.97] ${
                on ? "border-primary bg-primary/10 shadow-elev-1" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {LAUNCH_EVENT_CATEGORIES.includes(m.key) && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-reward/20 px-1.5 py-0.5 text-[8px] font-black text-reward">
                  이벤트 {LAUNCH_EVENT_CATEGORIES.indexOf(m.key) + 1}
                </span>
              )}
              <span className="text-xl leading-none" aria-hidden>{m.emoji}</span>
              <p className="mt-1.5 truncate text-[12px] font-black text-foreground">{m.title}</p>
              {summaryQ.isLoading ? (
                <div className="mt-1 h-3 w-14 animate-pulse rounded bg-muted" />
              ) : summaryQ.isError ? (
                <p className="mt-1 truncate text-[10.5px] text-muted-foreground">불러오기 실패</p>
              ) : kingName ? (
                <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] font-bold text-reward">
                  <Crown className="h-3 w-3 shrink-0" /> <span className="truncate">{kingName}</span>
                </p>
              ) : (
                <p className="mt-1 truncate text-[10.5px] text-muted-foreground">
                  {period === "event" && eventQ.data?.status === "upcoming" ? "시작 전" : "왕좌 비어 있음"}
                </p>
              )}
              {item?.me && (
                <p className="mt-0.5 truncate text-[10px] font-bold text-primary">나 {item.me.rank}위</p>
              )}
            </button>
          );
        })}
      </div>

      {branchEmpty && (
        <button
          type="button"
          onClick={() => chooseScope("all")}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-[11px] font-bold text-muted-foreground active:scale-[0.99]"
        >
          <Info className="h-3.5 w-3.5" /> 우리 지점엔 {KING_PERIOD_LABEL[period]} 기록이 아직 없어요 · 전체 지점 보기
        </button>
      )}

      {/* 상세 — 왕좌를 눌렀을 때만 */}
      {!meta ? (
        <p className="px-1 text-center text-[11px] text-muted-foreground">왕좌를 누르면 규칙과 순위가 보여요</p>
      ) : (
        <div className="surface-card space-y-3 !p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xl leading-none" aria-hidden>{meta.emoji}</span>
                <h3 className="text-[15px] font-black text-foreground">{meta.title}</h3>
                <span className="badge-pill bg-secondary text-secondary-foreground text-[10px]">
                  {periodBadge(meta, period)}
                  {board && board.scope === "all" ? " · 전체" : ""}
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-foreground">{meta.what}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{meta.how}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="접기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          {/* 현재 왕 — 주인공 숫자 하나 */}
          <div className="rounded-card border border-reward/30 bg-reward/10 px-4 py-3">
            {boardQ.isLoading ? (
              <div className="h-7 w-40 animate-pulse rounded bg-reward/20" />
            ) : boardQ.isError ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">순위를 불러오지 못했어요</p>
                <p className="mt-0.5 text-[13px] font-bold text-foreground">잠시 후 다시 눌러 주세요</p>
              </div>
            ) : eventUpcoming ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">런칭 이벤트 시작 전</p>
                <p className="mt-0.5 text-[13px] font-bold text-foreground">
                  {eventQ.data ? launchEventLine(eventQ.data) : ""} — 그날부터 기록이 쌓여요
                </p>
              </div>
            ) : king ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">{eventEnded ? "최종" : "현재"} {meta.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[17px] font-black text-foreground">
                    <Crown className="h-4 w-4 shrink-0 text-reward" />
                    <span className="truncate">{king.display_name}</span>
                  </p>
                  {board?.scope === "all" && (
                    <p className="truncate text-[10.5px] text-muted-foreground">{shortBranch(king.branch_name)}</p>
                  )}
                </div>
                <p className="shrink-0 text-2xl font-black tabular-nums text-reward">{formatKingScore(king.score, meta.key)}</p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">왕좌 비어 있음</p>
                <p className="mt-0.5 text-[13px] font-bold text-foreground">첫 기록이 곧 왕이 됩니다</p>
              </div>
            )}
          </div>

          {/* 나 */}
          {!boardQ.isLoading && !boardQ.isError && !eventUpcoming && (
            <div className="flex items-center justify-between rounded-card border border-primary/20 bg-primary/5 px-4 py-2.5">
              <p className="text-[12px] font-bold text-foreground">
                나 · {me ? `${me.rank}위` : "기록 없음"}
              </p>
              <p className="text-[12px] tabular-nums text-muted-foreground">
                {me ? (
                  <>
                    <span className="font-black text-primary">{formatKingScore(me.score, meta.key)}</span>
                    {gapToKing !== null && gapToKing > 0 && <span> · 왕까지 {gapLabel(gapToKing, meta)}</span>}
                    {me.rank === 1 && <span>{eventEnded ? " · 👑 최종 왕은 나" : " · 👑 지금 왕은 나"}</span>}
                  </>
                ) : (
                  <span>
                    {meta.key === "streak" ? "이어지는 출석이 없어요"
                      : meta.key === "nickname" ? "받은 좋아요가 없어요"
                      : `${KING_PERIOD_LABEL[period]} 기록이 없어요`}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Top 10 */}
          {board && board.board.length > 0 && (
            <ol className="space-y-1">
              {board.board.map((r) => (
                <li
                  key={r.user_id}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
                    r.is_me ? "border border-primary/40 bg-primary/10" : "bg-muted/30"
                  }`}
                >
                  <span className="w-7 shrink-0 text-center text-[13px] font-black tabular-nums">{medal(r.rank)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
                    {r.display_name}
                    {r.is_me && <span className="ml-1 text-[10px] font-black text-primary">나</span>}
                  </span>
                  {board.scope === "all" && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{shortBranch(r.branch_name)}</span>
                  )}
                  <span className="shrink-0 text-[13px] font-black tabular-nums text-foreground">{formatKingScore(r.score, meta.key)}</span>
                </li>
              ))}
              {me && !meInList && (
                <li className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                  <span className="w-7 shrink-0 text-center text-[13px] font-black tabular-nums">{me.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
                    나 <span className="text-[10px] text-muted-foreground">(10위 밖)</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-black tabular-nums text-foreground">{formatKingScore(me.score, meta.key)}</span>
                </li>
              )}
            </ol>
          )}

          {/* 행동 — 이벤트가 끝난 뒤 이벤트 탭에서는 숨긴다(기록해도 이벤트 결과는 안 바뀐다) */}
          {meta.action && !eventEnded && (
            <button
              type="button"
              onClick={() => runAction(meta.action!)}
              className="w-full rounded-xl bg-primary py-3 text-[13px] font-black text-primary-foreground transition-all active:scale-[0.98]"
            >
              {meta.actionLabel}
            </button>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {meta.key === "nickname" ? "좋아요는 취소하기 전까지 계속 쌓여 있어요."
              : period === "event" ? (eventQ.data ? launchEventLine(eventQ.data) : KING_PERIOD_RESET.event)
              : meta.periodless ? "하루라도 빠지면 연속이 끊어져요." : KING_PERIOD_RESET[period]}
            {board ? ` · 참가 ${board.total.toLocaleString("ko-KR")}명` : ""} · 동점이면 먼저 달성한 사람이 앞서요.
            {boardQ.isError && " · 순위를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
          </p>
        </div>
      )}

      <FunChallengeArenaSheet open={arena.open} initialCode={arena.code} onClose={closeArena} />
      <NicknameLikeSheet open={likeOpen} onClose={closeLike} />
    </section>
  );
};

export default King153Board;
