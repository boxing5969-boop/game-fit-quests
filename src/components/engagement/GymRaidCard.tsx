/**
 * 153 QUEST v2 21단계 — 짐 레이드 진입 카드 (Home).
 *
 * 진행 중 raid 가 있으면 가장 임박한 raid 의 진척바 미리보기.
 * 클릭 시 시트 열기.
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 기존 /challenges 21일 챌린지 무수정
 */

import { useState } from "react";
import { Flag } from "lucide-react";

import { useActiveGymRaids } from "@/hooks/useGymRaid";
import {
  getRaidTypeEmoji,
  getRaidTypeLabel,
} from "@/data/gymRaidMessages";

import GymRaidSheet from "./GymRaidSheet";

const GymRaidCard = () => {
  const [showSheet, setShowSheet] = useState(false);
  const { data, isLoading } = useActiveGymRaids();

  const raids = data?.raids ?? [];
  const featured = raids.find((r) => r.status === "active") ?? raids[0];
  const claimableCount = raids.filter(
    (r) => r.status === "completed" && !r.reward_claimed && r.my_contribution > 0,
  ).length;

  if (!isLoading && raids.length === 0) {
    // 운영자가 raid 생성 안 한 경우 — 카드 표시 안 함
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowSheet(true)}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
        aria-label="짐 레이드 열기"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Flag className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            짐 레이드 · 함께 깨는 목표
          </p>
          {isLoading ? (
            <p className="mt-0.5 text-[13px] font-bold text-foreground">
              불러오는 중…
            </p>
          ) : featured ? (
            <>
              <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
                {getRaidTypeEmoji(featured.raid_type)} {featured.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${
                      featured.status === "completed"
                        ? "bg-emerald-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, featured.percentage)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground">
                  {featured.percentage}%
                </span>
              </div>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                {getRaidTypeLabel(featured.raid_type)} · 내 기여 {featured.my_contribution}회
              </p>
            </>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          {claimableCount > 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
              보상 {claimableCount}건
            </p>
          ) : raids.length > 1 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              총 {raids.length}건
            </p>
          ) : null}
        </div>
        <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">
          열기 →
        </span>
      </button>

      <GymRaidSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
      />
    </>
  );
};

export default GymRaidCard;
