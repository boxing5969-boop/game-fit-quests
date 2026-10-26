/**
 * 💚 홈 '153과 함께하며' (2026-10-22 대표님 — 처음 이름 '운동이 내게 준 것' → "153과 함께하며"로)
 *   ① "긍정적인 정보들 — 운동하길 잘했다고 느껴질 수 있고 지속하는 힘이 될 수 있도록:
 *      건강 수명이 얼마나 올랐고, 근력이 얼마나 늘었고, 심폐지구력이 얼마나 좋아졌고, 행복도가 얼마나 올라갔는지"
 *      → 숫자로 · "개인 상태에 따라 다를 수 있다"고 함께 쓴다 (대표님 확정).
 *   ② "주 2회 1회 나온 분들도 내가 이렇게 많은 가치를 얻었구나를 느끼고 지속할 수 있도록 — 직관적인 그래프와 %,
 *      손을 뻗은 숫자, 그로 인한 칼로리 · 심폐 지구력 · 근지구력 · 근력 · 체력 · 체지방률 상세히 + 피드백까지.
 *      고객 데이터를 상세하게 기록할수록 정확도는 올라간다고 해 · 아무 정보도 없으면 출석 기록으로만 평균치(남자 · 여자)"
 *
 *   순서: 응원 한 줄 → 지금까지 얻은 것(펀치 · 칼로리 · 지방) + 한 번 올 때마다 → 내 몸이 좋아진 정도(막대 + %)
 *        → 건강 수명 · 행복도 → 오삼코치 피드백 → 정확도(넣을수록 ↑) → 계산 방법.
 *   숫자는 lib/healthGains153(효과 · 피드백) · lib/fitnessProfile153(정확도 · 남녀 평균) · lib/achievement153(펀치 · 칼로리) 한 곳.
 *   앱이 몸을 직접 재지 않으므로 '연구 평균으로 추정'을 늘 같이 쓰고, 153 PB · 인바디처럼 실제로 잰 기록이 있으면 그걸 먼저 보여 준다.
 *   잘한 것만 — 줄어든 것 · 손해 · 진단 · 의료 표현은 쓰지 않는다.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Dumbbell, Flame, Gauge, HeartPulse, Smile, Sparkles, Swords, Target, Timer, Wind, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMyBodyInfo, useMyFitnessExtra } from "@/hooks/useMyBodyInfo";
import { bodyInfoEmpty, minutesToHours, weightLost } from "@/lib/achievement153";
import { attendanceCheer, kstToday } from "@/lib/attendanceCheer";
import { bodyFatDrop, reportAccuracy, weightBasis } from "@/lib/fitnessProfile153";
import {
  BODY_FAT_MAX_PP,
  CARDIO_MAX_PCT,
  ENDURANCE_MAX_PCT,
  HEALTH_GAIN_NOTE,
  KCAL_PER_FAT_KG,
  LIFE_HOURS_PER_EXERCISE_HOUR,
  MOOD_DAYS_PER_ACTIVE_MONTH,
  STRENGTH_MAX_PCT,
  formatPct,
  PREVIEW_PER_WEEK,
  PREVIEW_WEEKS,
  formatWeeks,
  healthGains,
  perVisit,
  previewGains,
  valueFeedback,
  valueTotals,
} from "@/lib/healthGains153";
import { fetchTest153Summary } from "@/services/test153Service";
import BodyInfoSheet from "@/components/profile/BodyInfoSheet";
import BodyInfoInvite from "@/components/profile/BodyInfoInvite";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ko-KR");
/** 칸이 좁은 큰 숫자 — 1만 넘으면 '3.1만' (내림) */
const compact = (v: number) => (v >= 10_000 ? `${(Math.floor(v / 1000) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만` : n(v));
/** 체지방률 -%p — 0이면 '0%p' */
const ppLabel = (v: number) => (v > 0 ? `-${one(v)}%p` : "0%p");
const one = (v: number) => (Math.floor(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
/** '2026-10-21' → '10월 21일' */
const md = (d: string | null) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : "";
};

/** 지금까지 얻은 것 — 큰 숫자 칸 */
const Counter = ({ icon, label, value, unit, sub }: { icon: ReactNode; label: string; value: string; unit: string; sub: string }) => (
  <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2.5">
    <p className="flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground">
      <span className="text-primary" aria-hidden>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </p>
    <p className="mt-1 truncate text-[19px] font-black leading-none tabular-nums text-foreground">
      {value}
      <span className="ml-0.5 text-[11px] font-bold text-muted-foreground">{unit}</span>
    </p>
    <p className="mt-1 truncate text-[10.5px] text-muted-foreground">{sub}</p>
  </div>
);

/** 내 몸이 좋아진 정도 — 한 줄 막대 (채움 = 연구 상한 대비) · 상한의 80% 넘으면 금색 */
const GainBar = ({
  icon,
  label,
  value,
  ratio,
  sub,
  measured,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ratio: number;
  sub: ReactNode;
  measured?: boolean;
}) => {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const high = r >= 0.8;
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
          {label}
          {measured && <span className="ml-1.5 rounded-full bg-reward/20 px-1.5 py-px align-middle text-[10px] font-black text-reward">실측</span>}
        </span>
        <span className={cn("shrink-0 text-[17px] font-black tabular-nums", high ? "text-reward" : "text-foreground")}>{value}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", high ? "bg-reward" : "bg-primary")}
          style={{ width: `${Math.max(r > 0 ? 3 : 0, Math.round(r * 100))}%` }}
        />
      </div>
      <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{sub}</p>
    </li>
  );
};

const HealthGainsCard = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const { data, isLoading, isError } = useAttendanceHistory(null);
  const { data: body } = useMyBodyInfo();
  const { data: extra } = useMyFitnessExtra();
  // 153 PB — 지금까지 이룬 것 카드와 같은 캐시 키
  const { data: pb } = useQuery({
    queryKey: ["test153", "summary", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchTest153Summary(undefined),
  });
  const [howOpen, setHowOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 불러오는 중 · 실패는 위 '내 운동 기록' 카드가 알려 준다 — 여기는 조용히 둔다
  if (isLoading || isError || !data) return null;

  const wb = weightBasis(body?.weightKg, extra?.gender);
  const has = data.total > 0;
  // 첫 운동 전에는 '주 2번씩 8주 하면' 미리 보기 (0% 막대 대신)
  const g = has ? healthGains(data.list, data.totalMinutes, pb?.records) : previewGains();
  const totals = valueTotals(data.total, data.totalMinutes, wb.kg);
  const per = perVisit(data.total, data.totalMinutes, wb.kg);
  const today = kstToday();
  const feedback = valueFeedback({
    days: data.list,
    today,
    total: data.total,
    totalMinutes: data.totalMinutes,
    monthMinutes: data.monthMinutes,
    lastMonthMinutes: data.lastMonthMinutes,
    per,
    punches: totals.punches,
  });
  const lost = weightLost(body);
  if (lost != null) feedback.unshift({ emoji: "⚖️", text: `처음 잰 몸무게보다 ${one(lost)}kg 가벼워졌어요 (${md(body?.firstWeightOn ?? null)} → ${md(body?.weightOn ?? null)})` });
  const acc = reportAccuracy({
    days: data.list,
    gender: extra?.gender,
    birthYear: extra?.birthYear,
    heightCm: body?.heightCm,
    weightKg: body?.weightKg,
    bodyFatPct: extra?.bodyFatPct,
  });
  const fatDrop = bodyFatDrop(extra);
  const cheer = has ? attendanceCheer({ ...data, next: 0 }) : null;
  // 태운 지방 — 1kg 아래는 g 으로 (첫 운동 전이면 한 번 올 때 기준)
  const fatKg = has ? totals.kcal / KCAL_PER_FAT_KG : per.kcal / KCAL_PER_FAT_KG;

  return (
    <section aria-label="153과 함께하며" className={cn("rounded-2xl border border-border bg-card p-4 shadow-elev-1", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-reward">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-black text-foreground">153과 함께하며</h2>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-foreground active:scale-95"
          aria-label={`정확도 ${acc.pct}% — 내 정보 넣기`}
        >
          <Gauge className="h-3.5 w-3.5 text-primary" aria-hidden />
          정확도 {acc.pct}%
        </button>
      </div>

      {cheer && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] font-bold leading-snug text-foreground">
          <span aria-hidden>{cheer.emoji}</span>
          <span className="min-w-0">{cheer.text}</span>
        </p>
      )}

      {/* ─── 지금까지 얻은 것 ─── */}
      <div className="mt-3">
        <p className="text-[12px] font-bold text-muted-foreground">
          {has ? `지금까지 ${minutesToHours(data.totalMinutes)}시간 운동으로 얻은 것` : "첫 운동 한 번이면 이만큼 쌓여요"}
        </p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <Counter icon={<Swords className="h-3.5 w-3.5" />} label="뻗은 펀치" value={has ? compact(totals.punches) : n(per.punches)} unit="번" sub="잽+스트레이트" />
          <Counter icon={<Flame className="h-3.5 w-3.5" />} label="칼로리" value={has ? compact(totals.kcal) : n(per.kcal)} unit="kcal" sub={wb.source === "me" ? "내 몸무게 기준" : wb.source === "gender" ? `${extra?.gender === "남" ? "남성" : "여성"} 평균 기준` : "성인 평균 기준"} />
          <Counter icon={<Zap className="h-3.5 w-3.5" />} label="태운 지방" value={fatKg >= 1 ? one(fatKg) : n(Math.floor(fatKg * 1000))} unit={fatKg >= 1 ? "kg" : "g"} sub="에너지로 환산" />
        </div>
        {has && (
          <p className="mt-2 rounded-xl border border-dashed border-primary/40 px-3 py-2 text-[12px] leading-snug text-foreground">
            <b className="text-primary">한 번 올 때마다</b> 펀치 약 {n(per.punches)}번 · 약 {n(per.kcal)}kcal · 건강 수명 +{one(per.lifeHours)}시간
          </p>
        )}
      </div>

      {/* ─── 내 몸이 좋아진 정도 ─── */}
      <div className="mt-3.5">
        <p className="text-[12px] font-bold text-muted-foreground">
          {has ? "내 몸이 좋아진 정도" : `주 ${PREVIEW_PER_WEEK}번씩 ${PREVIEW_WEEKS}주 하면 이만큼 좋아져요`}
        </p>
        <ul className="mt-0.5 divide-y divide-border/60">
          <GainBar
            icon={<Wind className="h-3.5 w-3.5" />}
            label="심폐지구력"
            value={`+${formatPct(g.cardioPct)}%`}
            ratio={g.cardioPct / CARDIO_MAX_PCT}
            sub={
              g.pbFasterPct != null
                ? `153 PB 실측 — 첫 기록보다 ${formatPct(g.pbFasterPct)}% 빨라졌어요`
                : has
                  ? `운동한 ${formatWeeks(g.cardioDose)}주 분량이 쌓였어요 · 최대 +${CARDIO_MAX_PCT}%까지`
                  : `주 1번만 와도 쌓이기 시작해요 · 최대 +${CARDIO_MAX_PCT}%까지`
            }
          />
          <GainBar
            icon={<Timer className="h-3.5 w-3.5" />}
            label="근지구력"
            value={`+${formatPct(g.endurancePct)}%`}
            ratio={g.endurancePct / ENDURANCE_MAX_PCT}
            sub={`팔굽혀펴기 · 윗몸일으키기 버티는 힘 · 최대 +${ENDURANCE_MAX_PCT}%까지`}
          />
          <GainBar
            icon={<Dumbbell className="h-3.5 w-3.5" />}
            label="근력"
            value={`+${formatPct(g.strengthPct)}%`}
            ratio={g.strengthPct / STRENGTH_MAX_PCT}
            sub={`악력 · 펀치에 실리는 힘 · 최대 +${STRENGTH_MAX_PCT}%까지`}
          />
          <GainBar
            icon={<Zap className="h-3.5 w-3.5" />}
            label="체력 (종합)"
            value={`+${formatPct(g.fitnessPct)}%`}
            ratio={g.fitnessPct / ((CARDIO_MAX_PCT + ENDURANCE_MAX_PCT + STRENGTH_MAX_PCT) / 3)}
            sub="심폐지구력 · 근지구력 · 근력의 평균"
          />
          {fatDrop != null ? (
            <GainBar
              icon={<Flame className="h-3.5 w-3.5" />}
              label="체지방률"
              value={`-${one(fatDrop)}%p`}
              ratio={fatDrop / BODY_FAT_MAX_PP}
              measured
              sub={`내가 잰 체지방률 ${md(extra?.firstBodyFatOn ?? null)} ${one(extra?.firstBodyFatPct ?? 0)}% → ${md(extra?.bodyFatOn ?? null)} ${one(extra?.bodyFatPct ?? 0)}%`}
            />
          ) : (
            <GainBar
              icon={<Flame className="h-3.5 w-3.5" />}
              label="체지방률"
              value={ppLabel(g.bodyFatPp)}
              ratio={g.bodyFatPp / BODY_FAT_MAX_PP}
              sub={`식단 조절 없이 운동만 했을 때 · 최대 -${BODY_FAT_MAX_PP}%p까지 · 인바디 값을 넣으면 실측으로`}
            />
          )}
        </ul>
      </div>

      {/* ─── 건강 수명 · 행복도 (첫 운동 전에는 숨김 — 위 미리 보기로 충분) ─── */}
      {has && (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
            <HeartPulse className="h-3.5 w-3.5 text-primary" aria-hidden />
            건강 수명
          </p>
          <p className="mt-1 text-[22px] font-black leading-none tabular-nums text-foreground">+{g.lifeLabel}</p>
          <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">운동 1시간마다 약 {LIFE_HOURS_PER_EXERCISE_HOUR}시간씩</p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
            <Smile className="h-3.5 w-3.5 text-primary" aria-hidden />
            행복도
          </p>
          <p className="mt-1 text-[22px] font-black leading-none tabular-nums text-foreground">+{n(g.moodDays)}일</p>
          <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
            {g.activeMonths > 0 ? `마음이 가벼운 날 (꾸준히 한 ${n(g.activeMonths)}개월)` : "한 달에 4번 오면 쌓이기 시작해요"}
          </p>
        </div>
      </div>
      )}

      {/* ─── 오삼코치 피드백 ─── */}
      {feedback.length > 0 && (
        <div className="mt-3.5">
          <p className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-primary" aria-hidden />
            오삼코치 피드백
          </p>
          <ul className="mt-1 space-y-1.5">
            {feedback.slice(0, 3).map((f) => (
              <li key={f.text} className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[12.5px] leading-snug text-foreground">
                <span aria-hidden className="shrink-0">
                  {f.emoji}
                </span>
                <span className="min-w-0">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── 정확도 — 넣을수록 올라간다. 신체 정보를 하나도 안 넣었으면 눈에 띄게 권한다 (2026-10-27 대표님) ─── */}
      {bodyInfoEmpty(body) ? (
        <BodyInfoInvite className="mt-3.5" accuracyPct={acc.pct} onClick={() => setSheetOpen(true)} />
      ) : (
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="mt-3.5 block w-full rounded-xl border border-border px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex items-center gap-2">
          <Gauge className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 text-[13px] font-black text-foreground">정확도 {acc.pct}%</span>
          {acc.next && (
            <span className="flex shrink-0 items-center text-[12px] font-bold text-primary">
              내 정보 넣기 <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full rounded-full bg-primary" style={{ width: `${acc.pct}%` }} />
        </span>
        <span className="mt-1.5 block text-[11.5px] leading-relaxed text-muted-foreground">
          {acc.next
            ? `내 기록을 자세히 넣을수록 정확해져요 · 지금은 출석 기록 + ${wb.label}`
            : acc.pct < 100
              ? "내 몸에 맞춘 값으로 계산하고 있어요 · 운동 끝나고 얼굴 인식을 한 번 더 하면 실제 시간까지 더 정확해져요"
              : "내 몸에 맞춘 값으로 계산하고 있어요"}
        </span>
        {acc.missing.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {acc.missing.map((m) => (
              <span key={m.key} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {m.label} +{m.max}%
              </span>
            ))}
          </span>
        )}
      </button>
      )}

      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="mt-2.5 flex w-full items-center justify-between gap-2 text-left text-[11px] leading-relaxed text-muted-foreground"
      >
        <span>{HEALTH_GAIN_NOTE}</span>
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-foreground">
          계산 방법 <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", howOpen && "rotate-180")} aria-hidden />
        </span>
      </button>
      {howOpen && (
        <ul className="mt-2 space-y-1.5 rounded-xl bg-muted/50 px-3.5 py-3 text-[11.5px] leading-relaxed text-foreground">
          <li>
            <b>운동한 주 분량</b> — 한 주에 운동한 만큼만 셉니다. 주 1번 오면 0.8주, 2번이면 1주(건강 권장량). 주 1번만 와도 쌓여요
          </li>
          <li>
            <b>펀치 · 칼로리</b> — 복싱 1시간에 잽 200 · 스트레이트 150번 기준, 신체활동 MET 표(2024) × 몸무게. 몸무게가 없으면 남녀 평균(남 75kg · 여 60kg), 성별도 없으면 65kg
          </li>
          <li>
            <b>태운 지방</b> — 쓴 칼로리 ÷ 7,700kcal(지방 1kg 에너지)로 환산한 양이에요
          </li>
          <li>
            <b>심폐지구력</b> — 꾸준한 유산소 운동으로 보통 10~15% 좋아져요. 쌓일수록 최대 {CARDIO_MAX_PCT}%까지 · 연구 모음(2015)
          </li>
          <li>
            <b>근지구력 · 근력</b> — 복싱 + 맨몸 운동 8주에 팔굽혀펴기 +6% · 윗몸일으키기 +8% · 악력 +4%(2025 연구). 처음 시작하면 보통 더 크게 늘어요
          </li>
          <li>
            <b>체지방률</b> — 운동만으로 8~24주에 약 2~3%p 내려갔다는 연구 모음(메타분석) 기준, 보수적으로 최대 {BODY_FAT_MAX_PP}%p
          </li>
          <li>
            <b>건강 수명</b> — 운동 1시간 ≈ 기대 수명 {LIFE_HOURS_PER_EXERCISE_HOUR}시간 (최대 약 3년) · 미국 연구(2017) · 대만 41만 명 연구(2011)
          </li>
          <li>
            <b>행복도</b> — 운동하는 사람은 마음이 힘든 날이 한 달에 약 {MOOD_DAYS_PER_ACTIVE_MONTH}일 적었어요 · 미국 120만 명 연구(2018)
          </li>
          <li>
            <b>정확도</b> — 출석 기록 40% + 실제 운동 시간(운동 끝 얼굴 인식) 10% + 몸무게 15% · 성별 10% · 나이 10% · 체지방률 10% · 키 5%
          </li>
        </ul>
      )}

      <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />
    </section>
  );
};

export default HealthGainsCard;
