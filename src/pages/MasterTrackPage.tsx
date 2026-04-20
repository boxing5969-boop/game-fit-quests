import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Info, Swords, Trophy } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  MASTER_LEVEL_DEFINITIONS,
  canEnterMasterTrack,
} from "@/data/masterTierData";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { MasterLevelCard, type MasterLevelState } from "@/components/master/MasterLevelCard";
import { MasterTrackBadge } from "@/components/master/MasterTrackBadge";
import { cn } from "@/lib/utils";

/**
 * 41~99 Master Track map (member-facing).
 *
 * Layout
 *   ┌──────────────────────────────────────────┐
 *   │ ← 마스터 트랙 (header + MASTER badge)    │
 *   ├──────────────────────────────────────────┤
 *   │ Hero card (current level title + info)   │
 *   ├──────────────────────────────────────────┤
 *   │ 단 1 (Lv 41~50)     [3 / 10 완료]        │
 *   │ ├─ MasterLevelCard × 10                  │
 *   │ 단 2 (Lv 51~60)                          │
 *   │ ...                                      │
 *   │ 단 6 (Lv 91~99) — 그랜드 챔피언 섹션     │
 *   └──────────────────────────────────────────┘
 *
 * Pre-entry members see the same map rendered as "locked preview" so
 * they know what lies beyond black Lv10. Entry condition hint is
 * shown at the top of the hero card.
 */
const DAN_SECTIONS = [
  { title: "단 1 · 챔피언 후보", range: [1, 10] as const },
  { title: "단 2 · 제1방어", range: [11, 20] as const },
  { title: "단 3 · 제2방어", range: [21, 30] as const },
  { title: "단 4 · 제3방어", range: [31, 40] as const },
  { title: "단 5 · 제4방어", range: [41, 50] as const },
  { title: "단 6 · 그랜드 챔피언", range: [51, 59] as const },
];

const MasterTrackPage = () => {
  const navigate = useNavigate();
  const { progress, loading } = useAuth();

  const p = progress as any;
  const unlocked = !!p?.master_track_unlocked;
  const masterLevel: number = unlocked ? (p?.master_level ?? 1) : 0;
  const overall = unlocked ? 40 + masterLevel : null;
  const eligible = canEnterMasterTrack({
    current_rank: p?.current_rank ?? "white",
    current_level: p?.current_level ?? 1,
    bosses_cleared: p?.bosses_cleared ?? 0,
    master_track_unlocked: unlocked,
  });

  const stateOf = useMemo(
    () => (ml: number): MasterLevelState => {
      if (!unlocked) return "locked";
      if (ml < masterLevel) return "completed";
      if (ml === masterLevel) return "current";
      return "upcoming";
    },
    [unlocked, masterLevel],
  );

  if (loading) {
    return (
      <AppPage>
        <div className="flex h-40 items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-reward/20" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        title="마스터 트랙"
        leftAction={
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        }
        rightAction={
          unlocked && overall ? (
            <MasterTrackBadge overallLevel={overall} />
          ) : null
        }
      />

      {/* Hero card — status summary */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4",
          unlocked
            ? "border-reward/40 bg-gradient-to-br from-[hsl(42_92%_12%)] via-card to-card shadow-glow-soft"
            : "border-border bg-card",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-reward/15 blur-3xl"
        />
        {unlocked ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-reward" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-reward">
                MASTER TRACK
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              Lv.{overall}{" "}
              <span className="text-base font-semibold text-muted-foreground">
                · 마스터 {masterLevel}단계
              </span>
            </h1>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              보스 레벨 (50/60/70/80/90/99) 에서는 코치 승인 심사가 필요합니다.
              실패하더라도 경험치의 50% 가 보존됩니다.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                MASTER TRACK · 잠김
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-foreground">
              블랙리그 마스터 이후 공개
            </h1>
            <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {eligible
                ? "조건 달성! 코치가 입장을 승인하면 마스터 트랙이 열립니다."
                : "블랙 Lv10 에서 보스 4회 클리어 시 마스터 트랙이 열립니다."}
            </p>
          </div>
        )}
      </section>

      {/* Boss summary strip */}
      <section className="grid grid-cols-6 gap-1.5">
        {[50, 60, 70, 80, 90, 99].map((lv) => {
          const ml = lv - 40;
          const done = unlocked && masterLevel > ml;
          const now = unlocked && masterLevel === ml;
          const isGrand = lv === 99;
          return (
            <div
              key={lv}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border px-1 py-2 text-center",
                done && "border-success/40 bg-success/8",
                now && "border-primary/60 bg-primary/10",
                !done && !now && !isGrand && "border-border bg-card",
                isGrand && !done && !now && "border-reward/30 bg-reward/5",
              )}
            >
              {isGrand ? (
                <Trophy className="h-3.5 w-3.5 text-reward" />
              ) : (
                <Swords className="h-3 w-3 text-primary" />
              )}
              <span className="number-font mt-0.5 text-[11px] font-bold leading-none text-foreground">
                {lv}
              </span>
            </div>
          );
        })}
      </section>

      {/* 6 sections × master levels */}
      <div className="space-y-5">
        {DAN_SECTIONS.map((section) => {
          const levels = MASTER_LEVEL_DEFINITIONS.filter(
            (d) =>
              d.masterLevel >= section.range[0] &&
              d.masterLevel <= section.range[1],
          );
          const completed = unlocked
            ? levels.filter((d) => d.masterLevel < masterLevel).length
            : 0;
          return (
            <section key={section.title} className="space-y-2">
              <header className="flex items-center justify-between px-0.5">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h2>
                <span className="number-font text-[11px] font-semibold text-muted-foreground">
                  {completed}/{levels.length}
                </span>
              </header>
              <div className="space-y-2">
                {levels.map((def) => (
                  <MasterLevelCard
                    key={def.masterLevel}
                    def={def}
                    state={stateOf(def.masterLevel)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppPage>
  );
};

export default MasterTrackPage;
