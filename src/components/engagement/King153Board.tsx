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
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, ChevronUp, Info } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { KING_153_KEY, use153KingBoard, use153KingSummary } from "@/hooks/use153King";
import {
  KING_CATEGORIES, KING_META, KING_PERIOD_LABEL, KING_PERIOD_RESET, LAUNCH_EVENT_CATEGORIES, formatKingScore,
  type KingBoardRow, type KingCategory, type KingMeta, type KingPeriod, type KingScope,
} from "@/services/king153Service";
import FunChallengeArenaSheet from "./FunChallengeArenaSheet";
import NicknameLikeSheet from "./NicknameLikeSheet";

const PERIODS: Array<{ key: KingPeriod; label: string }> = [
  { key: "weekly", label: "이번 주" },
  { key: "monthly", label: "이번 달" },
];
const SCOPES: Array<{ key: KingScope; label: string }> = [
  { key: "branch", label: "내 지점" },
  { key: "all", label: "전체" },
];

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`);
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
          className={`rounded-pill px-3 py-1 text-[11px] font-bold transition-all active:scale-95 ${
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

  const [period, setPeriod] = useState<KingPeriod>("weekly");
  const [scope, setScope] = useState<KingScope>(hasBranch ? "branch" : "all");
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
  const branchEmpty =
    scope === "branch" && !summaryQ.isLoading && !!summaryQ.data && summaryQ.data.items.every((i) => i.total === 0);

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
  const gapToKing = king && me && me.rank > 1 ? Number(king.score) - Number(me.score) : null;

  return (
    <section data-tour="challenge153-leaderboard" aria-label="153 챌린지 킹 보드" className="space-y-3">
      {/* 컨트롤 */}
      <div className="flex items-center justify-between gap-2">
        <Segmented<KingPeriod> value={period} options={PERIODS} onChange={setPeriod} ariaLabel="기간" />
        {hasBranch && <Segmented<KingScope> value={scope} options={SCOPES} onChange={setScope} ariaLabel="범위" />}
      </div>

      {/* 왕좌 버튼 8개 — 앞 세 개가 런칭 이벤트 ①②③ */}
      <div className="grid grid-cols-4 gap-1.5">
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
              ) : kingName ? (
                <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] font-bold text-reward">
                  <Crown className="h-3 w-3 shrink-0" /> <span className="truncate">{kingName}</span>
                </p>
              ) : (
                <p className="mt-1 truncate text-[10.5px] text-muted-foreground">왕좌 비어 있음</p>
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
          onClick={() => setScope("all")}
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
                  {meta.periodless ? "지금 연속" : KING_PERIOD_LABEL[period]}
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
            ) : king ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">현재 {meta.title}</p>
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
          {!boardQ.isLoading && (
            <div className="flex items-center justify-between rounded-card border border-primary/20 bg-primary/5 px-4 py-2.5">
              <p className="text-[12px] font-bold text-foreground">
                나 · {me ? `${me.rank}위` : "기록 없음"}
              </p>
              <p className="text-[12px] tabular-nums text-muted-foreground">
                {me ? (
                  <>
                    <span className="font-black text-primary">{formatKingScore(me.score, meta.key)}</span>
                    {gapToKing !== null && gapToKing > 0 && <span> · 왕까지 {formatKingScore(gapToKing, meta.key)}</span>}
                    {me.rank === 1 && <span> · 👑 지금 왕은 나</span>}
                  </>
                ) : (
                  <span>{meta.periodless ? "이어지는 출석이 없어요" : `${KING_PERIOD_LABEL[period]} 기록이 없어요`}</span>
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

          {/* 행동 */}
          {meta.action && (
            <button
              type="button"
              onClick={() => runAction(meta.action!)}
              className="w-full rounded-xl bg-primary py-3 text-[13px] font-black text-primary-foreground transition-all active:scale-[0.98]"
            >
              {meta.actionLabel}
            </button>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {meta.periodless ? "하루라도 빠지면 연속이 끊어져요." : KING_PERIOD_RESET[period]}
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
