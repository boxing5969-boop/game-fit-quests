/**
 * 🏁 같은 나이와 비교 — '내 운동 기록' (2026-11-12 대표님: "마이복서 153 운동기록에 비교할 수 있는 대상 —
 *   내 나이 평균 신체와 내 신체 정보, 나는 이만큼 좋아졌고 나는 평균에서 어느 정도, 상위 몇 %")
 *   2026-11-13 넓힘 (대표님 「심폐지구력 근력 건강나이등등도 모두 같은나이 평균과 비교해서 우리목적은 회원님들의 동기부여와
 *     153복싱짐의 가치전달이야 그걸 통해 회원님들이 153복싱짐은 가치있다를 느껴야해」):
 *     · 주인공 = 체력 나이(심폐 체력 기준 · 추정) — '153 운동 −6살' 처럼 무엇이 젊게 만들었는지 이름표로 (153의 몫이 보이게)
 *     · 심폐 체력 줄 = 같은 나이 · 성별 국민체력100(19~64세) 안 상위 %(추정 · 5% 단위) · 평균 아래면 다음 한 걸음
 *     · 근력 = 악력(코치 측정 포함) · 체지방률은 그대로 — 잰 값은 '상위 N%' (추정 아님)
 *     · 아직 권장 운동량(주 2번)을 못 채우면 주인공 = 다음 목표 — '주 2번씩, 4주 중 3주 → 실제보다 N살 젊은 체력'
 *   숫자 · 문구는 lib/fitnessAge153(체력 나이 · 심폐 · 권장 운동량) · lib/peerCompare153(잰 값 백분위) 한 곳.
 *   기준표 data/nfaNorms(국민체력100) · data/knhanesActivity(국민건강영양조사). DB 변경 없음 — 이미 읽는 내 값 · 출석 기록 그대로.
 *   화면 규칙(2026-10-28 리디자인): 주인공 하나 · 같은 숫자는 한 번 · 회색 설명 줄은 하나 · 출처 · 세는 법은 '계산 방법' 안으로.
 *   잘한 것만 — 체력 나이가 실제보다 많으면 숫자로 말하지 않고 다음 목표로 · 평균 아래는 순위 대신 '평균까지' · 만 19세 아래는 카드 없음.
 *   성별 · 나이 · 값이 없으면 넣기 단추 → 내 신체 정보(BodyInfoSheet).
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { NFA_NORM_TOTAL, type NormSex } from "@/data/nfaNorms";
import { KNHANES_ACTIVITY_YEAR } from "@/data/knhanesActivity";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMyBodyInfo, useMyFitnessExtra, useMyFitnessProfile, useSaveFitnessExtra } from "@/hooks/useMyBodyInfo";
import { kstToday } from "@/lib/attendanceCheer";
import {
  ACTIVE_WEEKS_NEEDED,
  ACTIVITY_WEEKS,
  CARDIO_MAX_AGE,
  FITNESS_AGE_MIN,
  LEE2022,
  REF_REST_HR,
  buildBodyCompare,
  cardioNextStep,
  cardioShort,
  fitnessPartChips,
  goalProgressText,
  peopleOf100,
  weeksMetText,
  type ActivityStatus,
  type BodyCompare,
  type CardioEstimate,
} from "@/lib/fitnessAge153";
import {
  LEAN_FLOOR_PCT,
  PEER_METRIC_ORDER,
  PEER_METRICS,
  gainParts,
  gainText,
  gapText,
  groupMean,
  metricValueText,
  standingShort,
  valueText,
  type PeerMetricResult,
  type PeerStanding,
} from "@/lib/peerCompare153";
import BodyInfoSheet from "@/components/profile/BodyInfoSheet";
import { cn } from "@/lib/utils";

const clampBar = (v: number) => Math.min(97, Math.max(3, Number.isFinite(v) ? v : 50));
/** 앞선 정도가 10% 안이면 금색 */
const isGold = (s: PeerStanding) => s.atOrAboveAvg && !s.veryLean && s.topPct <= 10;
const cardioGold = (c: CardioEstimate) => c.atOrAboveAvg && c.topPct <= 10;
/** 또래 운동 비율 한 줄은 이만큼 아래일 때만 ('100명 중 65명이'는 자랑이 아니라서) */
const PEER_ACTIVE_SHOW_BELOW = 60;
/** '55만 9천여 명' */
const totalLabel = `${Math.floor(NFA_NORM_TOTAL / 10_000)}만 ${Math.floor((NFA_NORM_TOTAL % 10_000) / 1000)}천여 명`;
const one = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

/** '추정' 이름표 — 잰 값과 어림한 값을 늘 나눠 보여 준다 */
const EstimateTag = () => (
  <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 align-middle text-micro font-bold text-muted-foreground">
    추정
  </span>
);

/** 같은 나이 100명 줄 — 왼쪽이 뒤, 오른쪽이 앞 · 채움 = 내 자리 · 눈금 = 평균 */
const PeerBar = ({ me, avg, gold, avgLabel, className }: { me: number; avg: number; gold: boolean; avgLabel: string; className?: string }) => {
  const m = clampBar(me);
  const a = clampBar(avg);
  return (
    <div className={className} aria-hidden>
      <div className="relative h-3 rounded-full bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", gold ? "bg-reward" : "bg-primary")} style={{ width: `${m}%` }} />
        <div className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-foreground/80" style={{ left: `calc(${a}% - 1px)` }} />
      </div>
      <div className="relative mt-1.5 h-5 text-micro">
        <span className="absolute left-0 text-muted-foreground">뒤</span>
        <span className="absolute whitespace-nowrap font-bold tabular-nums text-foreground" style={{ left: `${a}%`, transform: "translateX(-50%)" }}>
          {avgLabel}
        </span>
        <span className="absolute right-0 text-muted-foreground">앞</span>
      </div>
    </div>
  );
};

const StandingBar = ({ s, avgLabel, className }: { s: PeerStanding; avgLabel: string; className?: string }) => (
  <PeerBar me={s.barMe} avg={s.barAvg} gold={isGold(s)} avgLabel={avgLabel} className={className} />
);

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

/** 처음보다 — 주인공은 금색 띠, 나머지 줄은 글만 */
const GainBand = ({ main, sub, className }: { main: string; sub: string; className?: string }) => (
  <p className={cn("flex items-start gap-2 rounded-xl bg-reward/15 px-4 py-3 leading-snug text-foreground", className)}>
    <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-reward" aria-hidden />
    <span className="min-w-0">
      <span className="block text-body font-bold">{main}</span>
      <span className="mt-0.5 block text-label">{sub}</span>
    </span>
  </p>
);

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
  return <GainBand main={g.main} sub={g.sub} className={className} />;
};

const avgOf = (m: PeerMetricResult) => `평균 ${metricValueText(m.key, m.now.mean)}`;

/** 지난 4주 — 권장 운동량을 채운 주는 채운 동그라미 */
const WeekDots = ({ a, className }: { a: ActivityStatus; className?: string }) => (
  <div className={cn("flex items-center gap-2", className)} aria-label={`지난 ${ACTIVITY_WEEKS}주 중 ${a.weeksMet}주 권장 운동량을 채웠어요`}>
    {a.weeks.map((w, i) => (
      <span key={w.monday} className="flex flex-col items-center gap-1">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2",
            w.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
          )}
          aria-hidden
        >
          {w.done && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
        <span className="text-micro text-muted-foreground">{i === a.weeks.length - 1 ? "이번 주" : `${a.weeks.length - 1 - i}주 전`}</span>
      </span>
    ))}
  </div>
);

/** 또래 운동 비율 — 권장 운동량을 채우는 회원에게만, 비율이 낮을 때만 (숫자만 — 글은 쓰는 자리에서) */
const peerActivePct = (c: BodyCompare): number | null =>
  c.activity.active && c.activePct != null && c.activePct < PEER_ACTIVE_SHOW_BELOW ? c.activePct : null;

/** 주인공 — 체력 나이 */
const FitnessAgeHero = ({ c }: { c: BodyCompare }) => {
  const f = c.fitness!;
  const chips = fitnessPartChips(f);
  const peerPct = peerActivePct(c);
  const gold = f.younger >= 10;
  return (
    <div className="mt-4">
      <p className="flex items-center text-label font-bold text-muted-foreground">
        체력 나이
        <EstimateTag />
      </p>
      <p className={cn("mt-1 text-display tracking-tight tabular-nums", gold ? "text-reward" : "text-foreground")}>
        {f.fitnessAge}
        <span className="ml-0.5 text-title">세</span>
      </p>
      <p className="text-body font-bold text-foreground">
        실제 {f.age}세보다 <span className={gold ? "text-reward" : "text-primary"}>{f.younger}살</span> 젊어요
      </p>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((ch) => (
            <span
              key={ch.key}
              className={cn(
                "rounded-full px-3 py-1 text-label font-bold",
                ch.key === "activity" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
              )}
            >
              {ch.text}
            </span>
          ))}
        </div>
      )}
      {peerPct != null && <p className="mt-2 text-label text-muted-foreground">또래 {peopleOf100(peerPct)}만 권장 운동량을 채워요</p>}
      {c.fitnessFirst && (
        <GainBand
          main={`처음보다 체력 나이 ${c.fitnessFirst.gain}살 젊어졌어요`}
          sub={`처음엔 ${c.fitnessFirst.fitnessAge}세`}
          className="mt-3"
        />
      )}
    </div>
  );
};

/** 주인공 — 다음 목표 (아직 권장 운동량을 못 채울 때) */
const GoalHero = ({ c }: { c: BodyCompare }) => (
  <div className="mt-4">
    <p className="flex items-center text-label font-bold text-muted-foreground">
      체력 나이 · 다음 목표
      <EstimateTag />
    </p>
    <p className="mt-1 text-title text-foreground">주 2번씩, {ACTIVITY_WEEKS}주 중 {ACTIVE_WEEKS_NEEDED}주</p>
    <p className="mt-1 text-body font-bold text-foreground">
      채우면 실제보다 <span className="text-primary">{c.goalYears}살</span> 젊은 체력이에요
    </p>
    <WeekDots a={c.activity} className="mt-4" />
    <p className="mt-2 text-label text-muted-foreground">{goalProgressText(c.activity)}</p>
  </div>
);

/** 심폐 체력 한 줄 — 같은 나이 안 상위 %(추정) · 평균 아래면 다음 한 걸음 */
const CardioRow = ({ c, active }: { c: CardioEstimate; active: boolean }) => {
  const next = cardioNextStep(c, active);
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center text-body text-foreground">
          <span className="truncate">심폐 체력</span>
          <EstimateTag />
        </span>
        <span className={cn("shrink-0 text-body font-black tabular-nums", cardioGold(c) ? "text-reward" : c.atOrAboveAvg ? "text-foreground" : "text-muted-foreground")}>
          {cardioShort(c)}
        </span>
      </div>
      <PeerBar me={c.barMe} avg={c.barAvg} gold={cardioGold(c)} avgLabel="평균" className="mt-2" />
      {next && <p className="mt-1 text-label font-bold leading-snug text-foreground">{next}</p>}
    </div>
  );
};

const MetricRow = ({ m }: { m: PeerMetricResult }) => (
  <div className="mt-5 border-t border-border pt-4">
    <div className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 truncate text-body text-foreground">
        {m.label} <b className="tabular-nums">{valueText(m)}</b>
      </span>
      <span className={cn("shrink-0 text-body font-black tabular-nums", isGold(m.now) ? "text-reward" : "text-foreground")}>{standingShort(m)}</span>
    </div>
    {!m.now.veryLean && <StandingBar s={m.now} avgLabel={avgOf(m)} className="mt-2" />}
    <GainLine m={m} compact className="mt-1" />
  </div>
);

const Li = ({ k, children }: { k: string; children: ReactNode }) => (
  <li>
    <b>{k}</b> — {children}
  </li>
);

export interface PeerCompareBodyProps {
  compare: BodyCompare;
  /** 넣기 단추 — 내 신체 정보 열기 */
  onFill: () => void;
  /** 성별만 비었을 때 카드에서 바로 고르기 (선릉 활동 회원 129명 중 108명이 성별 없음 — 2026-11-13) */
  onPickGender?: (g: NormSex) => void;
  pickingGender?: boolean;
  className?: string;
}

/** 화면만 — 데이터는 PeerCompareCard 가 넣는다 (화면 확인 · 시험용으로 따로 둔다) */
export const PeerCompareBody = ({ compare, onFill, onPickGender, pickingGender, className }: PeerCompareBodyProps) => {
  const [howOpen, setHowOpen] = useState(false);
  const { peer, hero, cardio, activity } = compare;
  const metricHero = hero?.kind === "metric" ? hero.metric : null;
  const others = peer.metrics.filter((m) => m !== metricHero);
  const invite = compare.invite;
  const band = peer.band;
  const sex = peer.sex;
  const peerPct = peerActivePct(compare);
  // 출생 연도는 있고 성별만 없으면 — 고르는 단추 둘이 '지금 넣기'를 대신한다 (한 번 누르면 체력 나이)
  const canPickGender =
    !!onPickGender && peer.missing.includes("gender") && !peer.missing.includes("age") && peer.age != null && peer.age <= CARDIO_MAX_AGE;

  return (
    <section aria-label="같은 나이와 비교" className={cn("rounded-2xl border border-border bg-card p-5 shadow-elev-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-heading text-foreground">같은 나이와 비교</h3>
        {peer.groupLabel && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-label font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            {peer.groupLabel}
          </span>
        )}
      </div>

      {hero ? (
        <>
          {/* ─── 주인공 ─── */}
          {hero.kind === "fitnessAge" && <FitnessAgeHero c={compare} />}
          {hero.kind === "goal" && <GoalHero c={compare} />}
          {metricHero && (
            <div className="mt-4">
              <p className="text-label font-bold text-muted-foreground">
                {metricHero.label} <span className="tabular-nums">{valueText(metricHero)}</span>
              </p>
              <HeroNumber m={metricHero} />
              <GainLine m={metricHero} className="mt-3" />
              {!metricHero.now.veryLean && <StandingBar s={metricHero.now} avgLabel={avgOf(metricHero)} className="mt-4" />}
            </div>
          )}

          {/* ─── 심폐 체력(추정) — 다음 목표가 주인공이면 같은 말이라 뺀다 ─── */}
          {cardio && hero.kind !== "goal" && <CardioRow c={cardio} active={activity.active} />}

          {/* ─── 잰 값 — 한 줄씩 ─── */}
          {others.map((m) => (
            <MetricRow key={m.key} m={m} />
          ))}

          {/* ─── 아직 안 넣은 것 — 한 줄 ─── */}
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
          {/* 성별을 몰라도 나이를 알면 — 권장 운동량을 채우는 회원에게 또래 비율부터 */}
          {activity.active && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-body font-bold text-foreground">지난 {weeksMetText(activity)} 권장 운동량을 채웠어요</span>
                {peerPct != null && <span className="mt-0.5 block text-label text-muted-foreground">또래는 {peopleOf100(peerPct)}만 채워요</span>}
              </span>
            </div>
          )}
          {/* 성별 · 나이를 알면 내 값이 없어도 같은 나이 평균부터 (65세 이상 — 심폐 기준표가 없는 나이) */}
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
          {canPickGender ? (
            <>
              <p className="text-body leading-snug text-foreground">성별만 고르면 체력 나이를 알려 드려요</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["남", "여"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={pickingGender}
                    onClick={() => onPickGender?.(g)}
                    className="h-12 rounded-xl border-2 border-primary bg-card text-body font-bold text-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
                  >
                    {g === "남" ? "남성" : "여성"}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {invite && <p className="text-body leading-snug text-foreground">{invite}</p>}
              <button
                type="button"
                onClick={onFill}
                className="mt-3 h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.99]"
              >
                지금 넣기
              </button>
            </>
          )}
        </div>
      )}

      {/* ─── 출처 · 세는 법 — 접기 ─── */}
      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="mt-4 flex w-full items-center justify-between gap-2 text-left text-label text-muted-foreground"
      >
        <span className="min-w-0 truncate">국민체력100 · 국민건강영양조사 기준</span>
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-foreground">
          계산 방법 <ChevronDown className={cn("h-4 w-4 transition-transform", howOpen && "rotate-180")} aria-hidden />
        </span>
      </button>
      {howOpen && (
        <ul className="mt-3 space-y-2 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">
          {cardio && (
            <Li k="내 숫자">
              추정 최대산소섭취량 {one(cardio.est)}mL/kg/분 · 같은 나이 · 성별 가운데 {one(cardio.median)} · 지난 4주 중 {activity.weeksMet}주 권장 운동량을
              채웠어요
            </Li>
          )}
          <Li k="비교 기준">
            국민체력100(문화체육관광부 · 국민체육진흥공단)에서 2017~2019년에 잰 {totalLabel}의 나이 · 성별 백분위예요 · Park 외(2022) 운동과학 31(4). 심폐
            체력은 20m 왕복오래달리기로 추정한 최대산소섭취량이에요(19~64세)
          </Li>
          <Li k="체력 나이 · 심폐 체력은 추정">
            운동 검사 없이 어림했어요. 같은 나이 · 성별 가운데 값에서 시작해, 그 나이 보통 사람과 다른 만큼 더하고 빼요 — 권장 운동량을 채우면 +
            {one(LEE2022.activity)} · 체지방률이 가운데 값보다 1%p 낮을 때마다 +{one(LEE2022.bodyFat)} · 안정시 심박이 {REF_REST_HR}보다 1회 낮을 때마다 +
            {LEE2022.restHr.toFixed(2)}. 이 크기는 한국 대학생 1,162명을 러닝머신 최대 검사로 잰 연구(이인환 외 2022, 대한스포츠의학회지)의 숫자예요
          </Li>
          <Li k="보통 사람">
            같은 나이 · 성별 한국인 중 권장 운동량을 채우는 비율(국민건강영양조사 {KNHANES_ACTIVITY_YEAR}
            {compare.activePct != null && compare.activeGroupLabel ? ` — ${compare.activeGroupLabel} ${peopleOf100(compare.activePct)}` : ""}) · 체지방률은
            국민체력100 가운데 값 · 안정시 심박 {REF_REST_HR}(국민건강영양조사 가운데)
          </Li>
          <Li k="권장 운동량">
            지난 {ACTIVITY_WEEKS}주 중 {ACTIVE_WEEKS_NEEDED}주 이상 주 500 MET·분(153 기본 수업 2번)을 채웠는지 153 출석으로 세요. 153 밖에서 한 운동은
            몰라서 넣지 않았어요
          </Li>
          <Li k="체력 나이">
            그 연구에서 나이 1살마다 심폐 체력이 {LEE2022.age}씩 낮았어요. 보통 사람보다 높은 만큼을 나이로 바꿔요(내림 · {FITNESS_AGE_MIN}세 아래로는
            말하지 않아요). 이름표는 무엇이 젊게 만들었는지예요
          </Li>
          <Li k="추정이라">
            실제와 다를 수 있어요 — 심폐 체력 상위 %는 5% 단위로 보여 드려요. 직접 재 보고 싶으면 국민체력100 체력인증센터(무료)에서 왕복오래달리기를 해
            보세요
          </Li>
          <Li k="상위 %">같은 나이 · 성별 100명 중 몇 번째인지예요. 평균보다 앞서면 순위를, 아직이면 평균까지 남은 만큼을 보여 드려요</Li>
          <Li k="체지방률">
            인바디로 잰 값 기준, 낮은 순서로 세요. 남 {LEAN_FLOOR_PCT.남}% · 여 {LEAN_FLOOR_PCT.여}% 이하는 순위 대신 '아주 낮은 편'으로 보여 드려요
          </Li>
          <Li k="악력(근력)">악력계로 좌우 2번씩 잰 값 중 가장 높은 값, 높은 순서로 세요</Li>
          <Li k="나이">출생 연도로 계산해요(생일 전이면 만 나이와 1살 다를 수 있어요) · 만 19세부터 비교해요</Li>
          <Li k="처음보다">
            체지방률 · 악력은 처음 잰 날의 나이로 그때 순위를 다시 세서, 체력 나이는 첫 출석 뒤 4주(그때 체지방률)로 다시 세서 지금과 비교해요. 좋아졌을 때만
            보여 드려요
          </Li>
        </ul>
      )}
    </section>
  );
};

/** '내 운동 기록' 카드 — 내 성별 · 출생 연도 · 체지방률 · 악력 · 안정시 심박 · 출석 기록을 읽어 비교 */
const PeerCompareCard = ({ className }: { className?: string }) => {
  const { data: extra, isLoading: extraLoading } = useMyFitnessExtra();
  const { data: profile, isLoading: profileLoading } = useMyFitnessProfile();
  const { data: att, isLoading: attLoading } = useAttendanceHistory();
  const { data: body } = useMyBodyInfo();
  const saveExtra = useSaveFitnessExtra();
  const [sheetOpen, setSheetOpen] = useState(false);

  // 불러오는 중 · 실패는 조용히 — 위 카드들이 상태를 알려 준다
  if (extraLoading || profileLoading || attLoading || !extra) return null;

  const grip = profile?.grip ?? null;
  const compare = buildBodyCompare({
    gender: extra.gender,
    birthYear: extra.birthYear,
    bodyFat: { pct: extra.bodyFatPct, on: extra.bodyFatOn, firstPct: extra.firstBodyFatPct, firstOn: extra.firstBodyFatOn },
    grip: grip ? { kg: grip.kg, on: grip.on, firstKg: grip.firstKg, firstOn: grip.firstOn } : null,
    restHr: profile?.restHr?.bpm ?? null,
    days: att?.list ?? [],
    firstDay: att?.firstDay ?? null,
    today: kstToday(),
  });
  if (compare.peer.tooYoung) return null;

  return (
    <>
      <PeerCompareBody
        compare={compare}
        onFill={() => setSheetOpen(true)}
        // 성별만 저장 — 출생 연도 · 체지방률은 비워 보내면 서버가 그대로 둔다 (save_my_fitness_extra 의 coalesce)
        onPickGender={(g) =>
          saveExtra.mutate(
            { gender: g, birthYear: null, bodyFatPct: null },
            { onError: () => toast.error("저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요") },
          )
        }
        pickingGender={saveExtra.isPending}
        className={className}
      />
      <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />
    </>
  );
};

export default PeerCompareCard;
