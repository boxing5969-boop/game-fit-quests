/**
 * 153 QUEST v2 22단계 — 코치 대시보드: 커뮤니티 (코너맨 + 짐 레이드 + RP) 패널.
 *
 * 표시 전용. 민감정보 미표시 (RPC 화이트리스트).
 */

import { Flag, Megaphone, Trophy, Users } from "lucide-react";

import type { CoachQuestCommunity } from "@/services/boxingEngagementService";
import { getRaidTypeEmoji } from "@/data/gymRaidMessages";

interface Props {
  community?: CoachQuestCommunity;
}

const QuestCommunityPanel = ({ community }: Props) => {
  if (!community || !community.gym_raid_progress) return null;

  const raids = community.gym_raid_progress ?? [];
  const topRespect = community.top_respect_members ?? [];
  const topContrib = community.gym_raid_top_contributors ?? [];

  return (
    <div>
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
        커뮤니티 활동
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3 w-3" />
            코너맨 활성
          </p>
          <p className="number-font mt-0.5 text-[14px] font-black text-foreground">
            {community.active_cornerman_pairs ?? 0}쌍
          </p>
        </div>
        <div className="rounded-card border border-border bg-background/40 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Megaphone className="h-3 w-3" />
            응원 7일
          </p>
          <p className="number-font mt-0.5 text-[14px] font-black text-foreground">
            {community.cheers_sent_7d ?? 0}회
          </p>
        </div>
      </div>

      {/* 짐 레이드 진척 */}
      {raids.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            <Flag className="h-3 w-3 text-primary" />
            짐 레이드 진척
          </p>
          <ul className="space-y-1.5">
            {raids.slice(0, 5).map((r) => (
              <li
                key={r.raid_id}
                className="rounded-card border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 truncate text-[11.5px] font-bold text-foreground">
                    <span>{getRaidTypeEmoji(r.raid_type)}</span>
                    {r.title}
                  </p>
                  <p className="shrink-0 text-[11px] font-bold text-foreground">
                    {r.percentage}%
                  </p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${
                      r.status === "completed" ? "bg-emerald-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, r.percentage)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {Math.round(r.current_value).toLocaleString()} /{" "}
                  {Math.round(r.target_value).toLocaleString()} ·{" "}
                  {new Date(r.end_date).toLocaleDateString("ko-KR")} 까지
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 상위 RP / 기여자 */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {topRespect.length > 0 && (
          <div className="rounded-card border border-border bg-background/40 p-3">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Trophy className="h-3 w-3" />
              상위 RP
            </p>
            <ul className="space-y-0.5 text-[11.5px]">
              {topRespect.slice(0, 5).map((m, i) => (
                <li key={m.user_id} className="flex justify-between">
                  <span className="truncate text-foreground">
                    {i + 1}. {m.display_name}
                  </span>
                  <span className="ml-2 shrink-0 font-bold text-reward">
                    {m.respect_points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topContrib.length > 0 && (
          <div className="rounded-card border border-border bg-background/40 p-3">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Flag className="h-3 w-3" />
              레이드 기여자
            </p>
            <ul className="space-y-0.5 text-[11.5px]">
              {topContrib.slice(0, 5).map((m, i) => (
                <li key={m.user_id} className="flex justify-between">
                  <span className="truncate text-foreground">
                    {i + 1}. {m.display_name}
                  </span>
                  <span className="ml-2 shrink-0 font-bold text-primary">
                    {m.contribution_count}회
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestCommunityPanel;
