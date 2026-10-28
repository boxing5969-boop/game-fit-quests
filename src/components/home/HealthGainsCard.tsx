/**
 * 💚 '153과 함께하며' (2026-10-22 대표님 — 처음 이름 '운동이 내게 준 것' → "153과 함께하며"로)
 *   ① "긍정적인 정보들 — 운동하길 잘했다고 느껴질 수 있고 지속하는 힘이 될 수 있도록:
 *      건강 수명이 얼마나 올랐고, 근력이 얼마나 늘었고, 심폐지구력이 얼마나 좋아졌고, 행복도가 얼마나 올라갔는지"
 *      → 숫자로 · "개인 상태에 따라 다를 수 있다"고 함께 쓴다 (대표님 확정).
 *   ② "주 2회 1회 나온 분들도 내가 이렇게 많은 가치를 얻었구나를 느끼고 지속할 수 있도록 — 직관적인 그래프와 %,
 *      손을 뻗은 숫자, 그로 인한 칼로리 · 심폐 지구력 · 근지구력 · 근력 · 체력 · 체지방률 상세히 + 피드백까지.
 *      고객 데이터를 상세하게 기록할수록 정확도는 올라간다고 해 · 아무 정보도 없으면 출석 기록으로만 평균치(남자 · 여자)"
 *   2026-10-28 리디자인 (대표님 "위보고한 기준대로 전면 리 디자인하자" · 화면 규칙 7가지):
 *     · 주인공 하나 = 늘어난 건강 수명 (큰 숫자) · 행복도는 쌓였을 때만 한 줄
 *     · 숫자 2개(쓴 칼로리 · 태운 지방 — 펀치는 '지금까지 이룬 것'의 주인공) → 막대 5개(이름 + % 만) → 오삼코치 피드백 한 줄 → (신체 정보가 없으면) 한 줄 권유
 *     · 막대마다 붙던 설명 · '한 번 올 때마다' 줄 · 정확도 칸은 '계산 방법' 안으로 접었다 (정확도는 머리의 칩)
 *     · 응원 한 줄은 '이번 주' 카드로 옮겼다 (같은 문장이 두 번 나오지 않게)
 *     · 홈에서는 뺐다 — 홈 '내 운동' 카드가 이번 달 펀치 · 칼로리를 한 줄로 보여 주고, 자세히는 '내 운동 기록'(여기)
 *   2026-10-28 대표님 "정확도 80% 이라고만 표기되어있어서 사람들이 정보입력해야하는건지 모를것같아 — 버튼에 홀로그램 임펙트 효과 ·
 *     클릭해서 정보입력하라는 카톡 메시지 같이 팝업": 넣을 정보가 남았으면 정확도 칩이 홀로그램(index.css holo-chip) + 안 읽은 '1'
 *     → 누르면 오삼코치 카톡 메시지(BodyInfoCoachNote) → '지금 넣기' = 내 신체 정보. '1'은 남은 정보가 바뀔 때까지 이 기기에서 한 번만.
 *   숫자는 lib/healthGains153(효과 · 피드백) · lib/fitnessProfile153(정확도 · 남녀 평균) · lib/achievement153(펀치 · 칼로리) 한 곳.
 *   앱이 몸을 직접 재지 않으므로 '연구 평균으로 추정'을 늘 같이 쓰고, 153 PB · 인바디처럼 실제로 잰 기록이 있으면 그걸 먼저 보여 준다.
 *   잘한 것만 — 줄어든 것 · 손해 · 진단 · 의료 표현은 쓰지 않는다.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Flame, Gauge, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMyBodyInfo, useMyFitnessExtra } from "@/hooks/useMyBodyInfo";
import { bodyInfoEmpty, weightLost } from "@/lib/achievement153";
import { kstToday } from "@/lib/attendanceCheer";
import { accuracyNote, bodyFatDrop, reportAccuracy, weightBasis } from "@/lib/fitnessProfile153";
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
  healthGains,
  perVisit,
  previewGains,
  valueFeedback,
  valueTotals,
} from "@/lib/healthGains153";
import { fetchTest153Summary } from "@/services/test153Service";
import BodyInfoSheet from "@/components/profile/BodyInfoSheet";
import BodyInfoInvite, { BodyInfoCoachNote } from "@/components/profile/BodyInfoInvite";
import { cn } from "@/lib/utils";

/** 오삼코치 메시지를 읽었나 — 그때 남아 있던 정보(몸무게,나이 …)를 이 기기에 남긴다. 남은 정보가 바뀌면 다시 '1' */
const noteSeenKey = (uid: string | undefined) => `153.accuracyNoteSeen:${uid ?? "anon"}`;
const readNoteSeen = (uid: string | undefined): string | null => {
  try {
    return localStorage.getItem(noteSeenKey(uid));
  } catch {
    return null;
  }
};
const writeNoteSeen = (uid: string | undefined, sig: string) => {
  try {
    localStorage.setItem(noteSeenKey(uid), sig);
  } catch {
    /* 저장이 막힌 기기 — '1'이 다시 보일 뿐 */
  }
};

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

/** 지금까지 얻은 것 — 숫자 칸 (이름표 + 숫자만) */
const Counter = ({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) => (
  <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-3">
    <p className="flex items-center gap-1 text-label font-bold text-muted-foreground">
      <span className="shrink-0 text-primary" aria-hidden>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </p>
    <p className="mt-1 truncate text-heading font-black tabular-nums text-foreground">
      {value}
      <span className="ml-0.5 text-label font-bold text-muted-foreground">{unit}</span>
    </p>
  </div>
);

/** 내 몸이 좋아진 정도 — 이름 + % 와 막대 하나 (채움 = 연구 상한 대비) · 상한의 80% 넘으면 금색 */
const GainBar = ({ label, value, ratio, measured }: { label: string; value: string; ratio: number; measured?: boolean }) => {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const high = r >= 0.8;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-body text-foreground">
          {label}
          {measured && <span className="ml-1.5 rounded-full bg-reward/20 px-2 py-0.5 align-middle text-micro font-black text-reward">실측</span>}
        </span>
        <span className={cn("shrink-0 text-body font-black tabular-nums", high ? "text-reward" : "text-foreground")}>{value}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", high ? "bg-reward" : "bg-primary")}
          style={{ width: `${Math.max(r > 0 ? 3 : 0, Math.round(r * 100))}%` }}
        />
      </div>
    </li>
  );
};

const HealthGainsCard = ({ className }: { className?: string }) => {
  const { user, profile } = useAuth();
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
  const [noteOpen, setNoteOpen] = useState(false);
  const [, setSeenTick] = useState(0); // 읽음을 남긴 뒤 '1'을 바로 지우려고 다시 그린다

  // 불러오는 중 · 실패는 위 요약 카드가 알려 준다 — 여기는 조용히 둔다
  if (isLoading || isError || !data) return null;

  const wb = weightBasis(body?.weightKg, extra?.gender);
  const has = data.total > 0;
  // 첫 운동 전에는 '주 2번씩 8주 하면' 미리 보기 (0% 막대 대신)
  const g = has ? healthGains(data.list, data.totalMinutes, pb?.records) : previewGains();
  const totals = valueTotals(data.total, data.totalMinutes, wb.kg);
  const per = perVisit(data.total, data.totalMinutes, wb.kg);
  const feedback = valueFeedback({
    days: data.list,
    today: kstToday(),
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
  // 정확도 칩 — 넣을 정보가 남았으면 홀로그램 + 안 읽은 '1' · 누르면 오삼코치 메시지 (100%면 바로 내 신체 정보)
  const note = accuracyNote(profile?.nickname || profile?.name, acc);
  const canRaise = note.target != null;
  const noteSig = acc.missing.map((m) => m.key).join(",");
  const unread = canRaise && readNoteSeen(user?.id) !== noteSig;
  const openNote = () => {
    if (acc.pct >= 100) {
      setSheetOpen(true);
      return;
    }
    if (canRaise) {
      writeNoteSeen(user?.id, noteSig);
      setSeenTick((t) => t + 1);
    }
    setNoteOpen(true);
  };
  const fatDrop = bodyFatDrop(extra);
  // 태운 지방 — 1kg 아래는 g 으로 (첫 운동 전이면 한 번 올 때 기준)
  const fatKg = has ? totals.kcal / KCAL_PER_FAT_KG : per.kcal / KCAL_PER_FAT_KG;
  const top = feedback[0];

  return (
    <section aria-label="153과 함께하며" className={cn("rounded-2xl border border-border bg-card p-5 shadow-elev-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-heading text-foreground">153과 함께하며</h3>
        <button
          type="button"
          onClick={openNote}
          aria-haspopup={acc.pct >= 100 ? undefined : "dialog"}
          aria-label={
            canRaise
              ? `정확도 ${acc.pct}% — 올리는 법 보기${unread ? " (새 메시지)" : ""}`
              : acc.pct >= 100
                ? `정확도 ${acc.pct}% — 내 정보 보기`
                : `정확도 ${acc.pct}% — 더 정확해지는 법 보기`
          }
          className="relative shrink-0 rounded-full transition-transform active:scale-95"
        >
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-label font-bold tabular-nums",
              canRaise ? "holo-chip" : "bg-muted text-foreground",
            )}
          >
            <Gauge className={cn("h-4 w-4", canRaise ? "text-violet-600" : "text-primary")} aria-hidden />
            정확도 {acc.pct}%
          </span>
          {unread && (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF3B30] px-1 text-micro font-bold leading-none text-white ring-2 ring-card"
            >
              1
            </span>
          )}
        </button>
      </div>

      {/* ─── 주인공 — 늘어난 건강 수명 ─── */}
      {has ? (
        <div className="mt-4">
          <p className="text-label font-bold text-muted-foreground">늘어난 건강 수명</p>
          <p className="mt-1 text-display tracking-tight tabular-nums text-foreground">+{g.lifeLabel}</p>
          {g.moodDays > 0 && (
            <p className="mt-2 text-body text-foreground">
              마음이 가벼운 날 <b className="tabular-nums">+{n(g.moodDays)}일</b>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-body font-bold text-foreground">첫 운동 한 번이면 이만큼 쌓여요</p>
      )}

      {/* ─── 지금까지 얻은 것 — 숫자 2개 (펀치는 아래 '지금까지 이룬 것'의 주인공이라 여기서는 뺀다) ─── */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Counter icon={<Flame className="h-4 w-4" />} label={has ? "쓴 칼로리" : "칼로리"} value={has ? compact(totals.kcal) : n(per.kcal)} unit="kcal" />
        <Counter icon={<Zap className="h-4 w-4" />} label="태운 지방" value={fatKg >= 1 ? one(fatKg) : n(Math.floor(fatKg * 1000))} unit={fatKg >= 1 ? "kg" : "g"} />
      </div>

      {/* ─── 내 몸이 좋아진 정도 ─── */}
      <p className="mt-6 text-label font-bold text-foreground">{has ? "내 몸이 좋아진 정도" : `주 ${PREVIEW_PER_WEEK}번씩 ${PREVIEW_WEEKS}주 하면`}</p>
      <ul className="mt-3 space-y-3.5">
        <GainBar label="심폐지구력" value={`+${formatPct(g.cardioPct)}%`} ratio={g.cardioPct / CARDIO_MAX_PCT} measured={g.pbFasterPct != null} />
        <GainBar label="근지구력" value={`+${formatPct(g.endurancePct)}%`} ratio={g.endurancePct / ENDURANCE_MAX_PCT} />
        <GainBar label="근력" value={`+${formatPct(g.strengthPct)}%`} ratio={g.strengthPct / STRENGTH_MAX_PCT} />
        <GainBar
          label="체력 (종합)"
          value={`+${formatPct(g.fitnessPct)}%`}
          ratio={g.fitnessPct / ((CARDIO_MAX_PCT + ENDURANCE_MAX_PCT + STRENGTH_MAX_PCT) / 3)}
        />
        {fatDrop != null ? (
          <GainBar label="체지방률" value={`-${one(fatDrop)}%p`} ratio={fatDrop / BODY_FAT_MAX_PP} measured />
        ) : (
          <GainBar label="체지방률" value={ppLabel(g.bodyFatPp)} ratio={g.bodyFatPp / BODY_FAT_MAX_PP} />
        )}
      </ul>

      {/* ─── 오삼코치 피드백 — 한 줄 ─── */}
      {top && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-primary/10 px-4 py-3 text-body leading-snug text-foreground">
          <span aria-hidden className="shrink-0">
            {top.emoji}
          </span>
          <span className="min-w-0">{top.text}</span>
        </p>
      )}

      {/* ─── 신체 정보를 하나도 안 넣었으면 한 줄로 눈에 띄게 (2026-10-27 대표님) ─── */}
      {bodyInfoEmpty(body) && <BodyInfoInvite className="mt-4" accuracyPct={acc.pct} onClick={() => setSheetOpen(true)} />}

      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        aria-expanded={howOpen}
        className="mt-4 flex w-full items-center justify-between gap-2 text-left text-label text-muted-foreground"
      >
        <span className="min-w-0">{HEALTH_GAIN_NOTE}</span>
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-foreground">
          계산 방법 <ChevronDown className={cn("h-4 w-4 transition-transform", howOpen && "rotate-180")} aria-hidden />
        </span>
      </button>
      {howOpen && (
        <ul className="mt-3 space-y-2 rounded-xl bg-muted/50 px-4 py-3 text-label leading-relaxed text-foreground">
          {g.pbFasterPct != null && (
            <li>
              <b>심폐지구력 실측</b> — 153 PB 첫 기록보다 {formatPct(g.pbFasterPct)}% 빨라졌어요
            </li>
          )}
          {fatDrop != null && (
            <li>
              <b>체지방률 실측</b> — 내가 잰 체지방률 {md(extra?.firstBodyFatOn ?? null)} {one(extra?.firstBodyFatPct ?? 0)}% → {md(extra?.bodyFatOn ?? null)} {one(extra?.bodyFatPct ?? 0)}%
            </li>
          )}
          {has && (
            <li>
              <b>한 번 올 때마다</b> — 펀치 약 {n(per.punches)}번 · 약 {n(per.kcal)}kcal · 건강 수명 +{one(per.lifeHours)}시간
            </li>
          )}
          <li>
            <b>운동한 주 분량</b> — 한 주에 운동한 만큼만 셉니다. 주 1번 오면 0.8주, 2번이면 1주(건강 권장량). 주 1번만 와도 쌓여요
          </li>
          <li>
            <b>펀치 · 칼로리</b> — 복싱 1시간에 잽 200 · 스트레이트 150번 기준, 신체활동 MET 표(2024) × 몸무게. 몸무게가 없으면 남녀 평균(남 75kg · 여 60kg), 성별도 없으면 65kg · 지금은 {wb.label}
          </li>
          <li>
            <b>태운 지방</b> — 쓴 칼로리 ÷ 7,700kcal(지방 1kg 에너지)로 환산한 양이에요
          </li>
          <li>
            <b>심폐지구력</b> — 꾸준한 유산소 운동으로 보통 10~15% 좋아져요. 쌓일수록 최대 {CARDIO_MAX_PCT}%까지 · 연구 모음(2015)
          </li>
          <li>
            <b>근지구력 · 근력</b> — 팔굽혀펴기 · 윗몸일으키기 버티는 힘, 악력 · 펀치에 실리는 힘. 복싱 + 맨몸 운동 8주에 팔굽혀펴기 +6% · 윗몸일으키기 +8% · 악력 +4%(2025 연구) · 최대 근지구력 +{ENDURANCE_MAX_PCT}% · 근력 +{STRENGTH_MAX_PCT}%
          </li>
          <li>
            <b>체력 (종합)</b> — 심폐지구력 · 근지구력 · 근력의 평균이에요
          </li>
          <li>
            <b>체지방률</b> — 식단 조절 없이 운동만으로 8~24주에 약 2~3%p 내려갔다는 연구 모음(메타분석) 기준, 보수적으로 최대 {BODY_FAT_MAX_PP}%p · 인바디 값을 넣으면 실측으로
          </li>
          <li>
            <b>건강 수명</b> — 운동 1시간 ≈ 기대 수명 {LIFE_HOURS_PER_EXERCISE_HOUR}시간 (최대 약 3년) · 미국 연구(2017) · 대만 41만 명 연구(2011)
          </li>
          <li>
            <b>행복도</b> — 운동하는 사람은 마음이 힘든 날이 한 달에 약 {MOOD_DAYS_PER_ACTIVE_MONTH}일 적었어요 · 미국 120만 명 연구(2018)
          </li>
          <li>
            <b>정확도</b> — 출석 기록 40% + 실제 운동 시간(운동 끝 얼굴 인식) 10% + 몸무게 15% · 성별 10% · 나이 10% · 체지방률 10% · 키 5%
            {acc.missing.length > 0 && ` · 아직 안 넣은 것: ${acc.missing.map((m) => `${m.label} +${m.max}%`).join(", ")}`}
          </li>
        </ul>
      )}

      <BodyInfoCoachNote
        open={noteOpen}
        note={note}
        onClose={() => setNoteOpen(false)}
        onFill={() => {
          setNoteOpen(false);
          setSheetOpen(true);
        }}
      />
      <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />
    </section>
  );
};

export default HealthGainsCard;
