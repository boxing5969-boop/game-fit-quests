/**
 * 153 QUEST v1.5 16단계 — 숨겨진 미션 진척 패널.
 *
 * MyPage 복싱 전당 안에 작은 카드. 8 미션 모두 표시 (claim 여부 분기).
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정 — 표시 전용
 */

import { Lock, CheckCircle2 } from "lucide-react";

import { useMyHiddenMissionProgress } from "@/hooks/useHiddenMissions";
import { getHiddenMissionDisplay } from "@/data/hiddenMissionCatalog";

const HiddenMissionPanel = () => {
  const { data, isLoading } = useMyHiddenMissionProgress();
  const missions = data?.missions ?? [];

  const claimedCount = missions.filter((m) => m.claimed).length;
  const totalCount = missions.length;

  return (
    <section
      className="surface-card border border-border bg-card"
      aria-label="숨겨진 미션"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            숨겨진 미션
          </p>
          <h3 className="mt-0.5 text-[14px] font-bold text-foreground">
            예상하지 못한 좋은 행동 보상
          </h3>
        </div>
        <span className="badge-pill bg-reward/15 text-reward">
          {claimedCount} / {totalCount}
        </span>
      </div>

      {isLoading ? (
        <p className="text-[11.5px] text-muted-foreground">불러오는 중…</p>
      ) : missions.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground">
          아직 표시할 숨겨진 미션이 없습니다.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {missions.map((m) => {
            const d = getHiddenMissionDisplay(m.code);
            const isClaimed = m.claimed;
            return (
              <li
                key={m.code}
                className={`flex items-start gap-2 rounded-card border px-3 py-2.5 ${
                  isClaimed
                    ? "border-emerald-400/40 bg-emerald-400/5"
                    : "border-border bg-background/40"
                }`}
              >
                <span className="text-[16px]">{d.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[12.5px] font-bold ${
                      isClaimed ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {isClaimed ? m.title : "???"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {isClaimed ? m.description : "조건을 만족하면 공개됩니다."}
                  </p>
                </div>
                {isClaimed ? (
                  <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        ※ 숨겨진 미션 보상은 QUEST XP / 파이트 머니 / RP 입니다. 공식 1~40
        레벨업과 무관합니다.
      </p>
    </section>
  );
};

export default HiddenMissionPanel;
