/**
 * 🏁 같은 나이와 비교 — '내 운동 기록' (2026-11-12 대표님: "마이복서 153 운동기록에 비교할 수 있는 대상 —
 *   내 나이 평균 신체와 내 신체 정보, 나는 이만큼 좋아졌고 나는 평균에서 어느 정도, 상위 몇 %")
 *
 *   내가 넣은 체지방률 · 악력(코치 측정 포함)을 국민체력100 같은 나이 · 성별 백분위(55만 9천여 명)에 대어 보여 준다.
 *   숫자 · 문구는 lib/peerCompare153 한 곳(기준표 data/nfaNorms). DB 변경 없음 — 이미 읽는 내 값 그대로.
 *   화면 규칙(2026-10-28 리디자인): 주인공 하나 = 가장 앞선 지표의 '상위 N%'(평균 아래면 '평균까지 N') ·
 *     같은 숫자는 한 번(평균은 막대 눈금 아래에만) · 처음보다 오른 계단은 한 줄 · 출처 · 세는 법은 '계산 방법' 안으로.
 *   잘한 것만 — 평균 아래는 순위 대신 '평균까지' · 체지방률 남 7% · 여 16% 이하는 '아주 낮은 편' · 만 19세 아래는 카드 없음.
 *   성별 · 나이 · 값이 없으면 '같은 나이 평균'과 넣기 단추 → 내 신체 정보(BodyInfoSheet).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp, Users } from "lucide-react";
import { NFA_NORM_TOTAL } from "@/data/nfaNorms";
import { useMyBodyInfo, useMyFitnessExtra, useMyFitnessProfile } from "@/hooks/useMyBodyInfo";
import { kstToday } from "@/lib/attendanceCheer";
import {
  LEAN_FLOOR_PCT,
  PEER_METRIC_ORDER,
  PEER_METRICS,
  buildPeerCompare,
  gainParts,
  gainText,
  gapText,
  groupMean,
  inviteText,
  metricValueText,
  standingShort,
  valueText,
  type PeerCompare,
  type PeerMetricResult,
  type PeerStanding,
} from "@/lib/peerCompare153";
import BodyInfoSheet from "@/components/profile/BodyInfoSheet";
import { cn } from "@/lib/utils";

const clampBar = (v: number) => Math.min(97, Math.max(3, Number.isFinite(v) ? v : 50));
/** 앞선 정도가 10% 안이면 금색 */
const isGold = (s: PeerStanding) => s.atOrAboveAvg && !s.veryLean && s.topPct <= 10;
/** '55만 9천여 명' */
const totalLabel = `${Math.floor(NFA_NORM_TOTAL / 10_000)}만 ${Math.floor((NFA_NORM_TOTAL % 10_000) / 1000)}천여 명`;

/** 같은 나이 100명 줄 — 왼쪽이 뒤, 오른쪽이 앞 · 채움 = 내 자리 · 눈금 = 평균 */
const PeerBar = ({ s, avgLabel, className }: { s: PeerStanding; avgLabel: string; className?: string }) => {
  const me = clampBar(s.barMe);
  const avg = clampBar(s.barAvg);
  return (
    <div className={className} aria-hidden>
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", isGold(s) ? "bg-reward" : "bg-primary")}
          style={{ width: `${me}%` }}
        />
        <div className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-foreground/80" style={{ left: `calc(${avg}% - 1px)` }} />
      </div>
      <div className="relative mt-1.5 h-5 text-micro">
        <span className="absolute left-0 text-muted-foreground">뒤</span>
        <span
          className="absolute whitespace-nowrap font-bold tabular-nums text-foreground"
          style={{ left: `${avg}%`, transform: "translateX(-50%)" }}
        >
          {avgLabel}
        </span>
        <span className="absolute right-0 text-muted-foreground">앞</span>
      </div>
    </div>
  );
};

/** 큰 글 — '상위' · '평균까지'는 작게, 숫자는 크게 */
const HeroNumber = ({ m }: { m: PeerMetricResult }) => {
  const s = m.now;
  if (s.veryLean) return <p className="mt-1 text-title text-foreground">아주 낮은 편</p>;
  if (s.atOrAboveAvg) {
    return (
      <p className={cn("mt-1 text-display tracking-tight tabular-nums", isGold(s) ? "text-reward" : "text-foreground")}>
        <span className="mr-1.5 text-title">상위</span>
        {s.topPct <= 5 ? "5%" : `${s.topPct}%`}
        {s.topPct <= 5 && <span className="ml-1 text-title">안</span>}
      </p>
    );
  }
  return (
    <p className="mt-1 text-display tracking-tight tabular-nums text-foreground">
      <span className="mr-1.5 text-title">평균까지</span>
      {gapText(m)}
    </p>
  );
};

/** 처음보다 오른 계단 — 한 줄 (오르지 않았으면 그리지 않는다) · 주인공은 금색 띠, 나머지 줄은 글만 */
const GainLine = ({ m, compact, className }: { m: PeerMetricResult; compact?: boolean; className?: string }) => {
  const g = gainParts(m);
  if (!g) return null;
  if (compact) {
    return (
      <p className={cn("flex items-start gap-1.5 text-label font-bold leading-snug text-reward", className)}>
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0">{gainText(m)}</span>
      </p>
    );
  }
  return (
    <p className={cn("flex items-start gap-2 rounded-xl bg-reward/15 px-4 py-3 leading-snug text-foreground", className)}>
      <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-reward" aria-hidden />
      <span className="min-w-0">
        <span className="block text-body font-bold">{g.main}</span>
        <span className="mt-0.5 block text-label">{g.sub}</span>
      </span>
    </p>
  );
};

const avgOf = (m: PeerMetricResult) => `평균 ${metricValueText(m.key, m.now.mean)}`;

export interface PeerCompareBodyProps {
  compare: PeerCompare;
  /** 넣기 단추 — 내 신체 정보 열기 */
  onFill: () => void;
  className?: string;
}

/** 화면만 — 데이터는 PeerCompareCard 가 넣는다 (화면 확인 · 시험용으로 따로 둔다) */
export const PeerCompareBody = ({ compare, onFill, className }: PeerCompareBodyProps) => {
  const [howOpen, setHowOpen] = useState(false);
  const hero = compare.hero;
  const others = compare.metrics.filter((m) => m !== hero);
  const invite = inviteText(compare);
  const band = compare.band;
  const sex = compare.sex;

  return (
    <section aria-label="같은 나이와 비교" className={cn("rounded-2xl border border-border bg-card p-5 shadow-elev-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-heading text-foreground">같은 나이와 비교</h3>
        {compare.groupLabel && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-label font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            {compare.groupLabel}
          </span>
        )}
      </div>

      {hero ? (
        <>
          {/* ─── 주인공 — 가장 앞선 지표 ─── */}
          <div className="mt-4">
            <p className="text-label font-bold text-muted-foreground">
              {hero.label} <span className="tabular-nums">{valueText(hero)}</span>
            </p>
            <HeroNumber m={hero} />
            <GainLine m={hero} className="mt-3" />
            {!hero.now.veryLean && <PeerBar s={hero.now} avgLabel={avgOf(hero)} className="mt-4" />}
          </div>

          {/* ─── 나머지 지표 — 한 줄씩 ─── */}
          {others.map((m) => (
            <div key={m.key} className="mt-5 border-t border-border pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-body text-foreground">
                  {m.label} <b className="tabular-nums">{valueText(m)}</b>
                </span>
                <span className={cn("shrink-0 text-body font-black tabular-nums", isGold(m.now) ? "text-reward" : "text-foreground")}>
                  {standingShort(m)}
                </span>
              </div>
              {!m.now.veryLean && <PeerBar s={m.now} avgLabel={avgOf(m)} className="mt-2" />}
              <GainLine m={m} compact className="mt-1" />
            </div>
          ))}

          {/* ─── 아직 안 넣은 지표 — 한 줄 ─── */}
          {invite && (
            <button
              type="button"
              onClick={onFill}
              className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3 text-left text-body text-foreground transition-transform active:scale-[0.99]"
            >
              <span className="min-w-0">{invite}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}
        </>
      ) : (
        <div className="mt-4">
          {/* 성별 · 나이를 알면 내 값이 없어도 같은 나이 평균부터 */}
          {band && sex && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {PEER_METRIC_ORDER.map((k) => {
                const mean = groupMean(k, sex, band);
                if (mean == null) return null;
                return (
                  <div key={k} className="min-w-0 rounded-xl bg-muted/50 px-3 py-3">
                    <p className="truncate text-label font-bold text-muted-foreground">평균 {PEER_METRICS[k].label}</p>
                    <p className="mt-1 truncate text-heading font-black tabular-nums text-foreground">{metricValueText(k, mean)}</p>
                  </div>
                );
              })}
            </div>
          )}
          {invite && <p className="text-body leading-snug text-foreground">{invite}</p>}
          <button
            type="button"
            onClick={onFill}
            className="mt-3 h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.99]"
          >
            지금 넣기
          </button>
        </div>
      )}

      {/* ─── 출처 · 세는 법 — 접기 ─── */}
      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="mt-4 flex w-full items-center justify-between gap-2 text-left text-label text-muted-foreground"
      >
        <span className="min-w-0">국민체력100 {totalLabel} 기준</span>
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-foreground">
          계산 방법 <ChevronDown className={cn("h-4 w-4 transition-transform", howOpen && "rotate-180")} aria-hidden />
        </span>
      </button>
      {howOpen && (
        <ul className="mt-3 space-y-2 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">
          <li>
            <b>비교 기준</b> — 국민체력100(문화체육관광부 · 국민체육진흥공단)에서 2017~2019년에 잰 559,430명의 나이 · 성별 백분위예요 · Park 외(2022)
            운동과학 31(4)
          </li>
          <li>
            <b>상위 %</b> — 같은 나이 · 성별 100명 중 몇 번째인지예요. 평균보다 앞서면 순위를, 아직이면 평균까지 남은 만큼을 보여 드려요
          </li>
          <li>
            <b>체지방률</b> — 인바디로 잰 값 기준, 낮은 순서로 세요. 남 {LEAN_FLOOR_PCT.남}% · 여 {LEAN_FLOOR_PCT.여}% 이하는 순위 대신 '아주 낮은 편'으로
            보여 드려요
          </li>
          <li>
            <b>악력</b> — 악력계로 좌우 2번씩 잰 값 중 가장 높은 값, 높은 순서로 세요
          </li>
          <li>
            <b>나이</b> — 출생 연도로 계산해요(생일 전이면 만 나이와 1살 다를 수 있어요) · 만 19세부터 비교해요
          </li>
          <li>
            <b>처음보다</b> — 처음 잰 날의 나이로 그때 순위를 다시 세서 지금과 비교해요. 값이 좋아지고 순위도 올랐을 때만 보여 드려요
          </li>
        </ul>
      )}
    </section>
  );
};

/** '내 운동 기록' 카드 — 내 성별 · 출생 연도 · 체지방률 · 악력을 읽어 비교 */
const PeerCompareCard = ({ className }: { className?: string }) => {
  const { data: extra, isLoading: extraLoading } = useMyFitnessExtra();
  const { data: profile, isLoading: profileLoading } = useMyFitnessProfile();
  const { data: body } = useMyBodyInfo();
  const [sheetOpen, setSheetOpen] = useState(false);

  // 불러오는 중 · 실패는 조용히 — 위 카드들이 상태를 알려 준다
  if (extraLoading || profileLoading || !extra) return null;

  const grip = profile?.grip ?? null;
  const compare = buildPeerCompare({
    gender: extra.gender,
    birthYear: extra.birthYear,
    bodyFat: { pct: extra.bodyFatPct, on: extra.bodyFatOn, firstPct: extra.firstBodyFatPct, firstOn: extra.firstBodyFatOn },
    grip: grip ? { kg: grip.kg, on: grip.on, firstKg: grip.firstKg, firstOn: grip.firstOn } : null,
    today: kstToday(),
  });
  if (compare.tooYoung) return null;

  return (
    <>
      <PeerCompareBody compare={compare} onFill={() => setSheetOpen(true)} className={className} />
      <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />
    </>
  );
};

export default PeerCompareCard;
