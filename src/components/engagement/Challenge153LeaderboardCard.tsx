/**
 * 153 챌린지 — 회원 간 별도 랭킹 카드.
 *
 * 기간 토글 (주간 / 월간 / 전체) + 내 순위 요약 + Top N 리스트.
 * 기존 명예의 전당 (/halloffame) 과 별개. quest_xp 누적 기반.
 *
 * 보호 원칙: 읽기 전용 — 공식 XP / wallet / level 변경 0건.
 */

import { useState } from "react";
import { Trophy, Crown } from "lucide-react";

import {
  use153ChallengeLeaderboard,
  useMy153ChallengeRank,
} from "@/hooks/use153ChallengeLeaderboard";
import type { Challenge153Period } from "@/services/challenge153LeaderboardService";

const PERIOD_OPTIONS: Array<{ key: Challenge153Period; label: string }> = [
  { key: "weekly", label: "주간" },
  { key: "monthly", label: "월간" },
  { key: "all_time", label: "전체" },
];

function rankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

const Challenge153LeaderboardCard = () => {
  const [period, setPeriod] = useState<Challenge153Period>("weekly");
  const { data: rows, isLoading } = use153ChallengeLeaderboard(period, 20);
  const { data: my } = useMy153ChallengeRank(period);

  const list = rows ?? [];

  return (
    <section
      className="surface-card border border-border bg-card"
      aria-label="153 챌린지 랭킹"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-amber-500/15 text-amber-400">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              153 챌린지 랭킹
            </p>
            <h3 className="mt-0.5 text-display-sm">회원 간 도전 점수</h3>
          </div>
        </div>
      </div>

      {/* 기간 토글 */}
      <div className="mb-3 flex gap-1.5">
        {PERIOD_OPTIONS.map((o) => {
          const active = o.key === period;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setPeriod(o.key)}
              className={`rounded-pill border px-3 py-1 text-[11px] font-bold transition-all active:scale-[0.98] ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* 내 순위 요약 */}
      <div className="mb-3 rounded-card border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-primary">내 순위</p>
          <p className="text-[10px] text-muted-foreground">
            참여자 {my?.total_participants ?? 0}명
          </p>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div>
            <p className="number-font text-[22px] font-black text-foreground">
              {my?.my_rank && my.my_rank > 0 ? `${my.my_rank}위` : "—"}
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              {period === "weekly"
                ? "최근 7일 누적"
                : period === "monthly"
                  ? "최근 30일 누적"
                  : "전체 기간 누적"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
              QUEST XP
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-reward">
              {(my?.my_score ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Top 리스트 */}
      {isLoading ? (
        <p className="text-[11.5px] text-muted-foreground">불러오는 중…</p>
      ) : list.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-muted/30 px-3.5 py-4 text-center">
          <p className="text-[12px] font-bold text-foreground">
            아직 이 기간 랭킹에 오른 회원이 없습니다
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            복싱 IQ 퀴즈 / 챌린지 아레나 / 챔피언 일기로
            <br />
            QUEST XP 를 쌓으면 자동으로 랭킹에 반영됩니다.
          </p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {list.map((r) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 rounded-card border px-3 py-2 ${
                r.is_me
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${
                  r.rank <= 3
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {rankBadge(r.rank)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[12.5px] font-bold text-foreground">
                  {r.is_me && (
                    <Crown
                      className="h-3 w-3 shrink-0 text-primary"
                      aria-label="나"
                    />
                  )}
                  {r.display_name}
                  {r.is_me && (
                    <span className="ml-1 rounded-pill bg-primary/20 px-1.5 py-0.5 text-[9px] font-black text-primary">
                      나
                    </span>
                  )}
                </p>
                <p className="truncate text-[10.5px] text-muted-foreground">
                  {r.branch_name}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="number-font text-[13px] font-black text-reward">
                  {r.score.toLocaleString()}
                </p>
                <p className="text-[9.5px] text-muted-foreground">QUEST XP</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 153 챌린지 랭킹은 보조 챌린지 QUEST XP 누적입니다. 공식 1~40 레벨업과
        공식 명예의 전당(랭킹) 과 별개입니다.
      </p>
    </section>
  );
};

export default Challenge153LeaderboardCard;
