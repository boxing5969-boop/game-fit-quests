import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Leaf,
  Moon,
  Sparkles,
  Target,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";

import {
  BALANCE_PILLARS,
  BALANCE_PILLARS_HEADER,
  BALANCE_SELF_CHECK,
  DEFICIENCY_SPIRAL,
  DEFICIENCY_SPIRAL_HEADER,
  HOW_TO_RESIST,
  PARADOX_HERO,
  RESTORATION_HEADER,
  RESTORATION_RULES,
  SCIENCE_DISCLAIMER,
  SELF_CHECK_HEADER,
  TWENTY_ONE_DAY_TIMELINE,
  WHY_YOU_GAIN,
  type BalancePillar,
  type PillarId,
  type ScienceSection,
} from "@/data/diet/scienceContent";
import { cn } from "@/lib/utils";

/**
 * /diet/value — 153 다이어트 가치·교육 탭.
 *
 * 스토리텔링 구조
 *   1. Paradox 히어로 ("왜 덜 먹는데도 찌는가?")
 *   2. 챕터 챕 (sticky 서브네비)
 *   3. 7가지 밸런스 기둥 (5대 영양소 + 물 + 휴식) — 탭하면 결핍 신호/153 답 펼침
 *   4. 결핍성 축적 악순환 5단계
 *   5. 복구 3원칙 + 구체 실천 (HOW_TO_RESIST)
 *   6. 과학적 배경 (WHY_YOU_GAIN) + 21일 타임라인
 *   7. 자가 진단 체크리스트 — 흔들리는 기둥 실시간 카운트 + 맞춤 메시지
 *   8. 의학적 면책 + CTA
 */

type Chapter =
  | "paradox"
  | "pillars"
  | "spiral"
  | "restore"
  | "timeline"
  | "selfcheck";

const CHAPTER_ORDER: { id: Chapter; label: string }[] = [
  { id: "paradox",   label: "문제"   },
  { id: "pillars",   label: "7기둥"  },
  { id: "spiral",    label: "악순환" },
  { id: "restore",   label: "복구"   },
  { id: "timeline",  label: "21일"   },
  { id: "selfcheck", label: "자가진단" },
];

const DietValuePage = () => {
  const navigate = useNavigate();
  const [openPillar, setOpenPillar] = useState<PillarId | null>(null);
  const [checkedPillars, setCheckedPillars] = useState<Set<PillarId>>(
    () => new Set(),
  );

  const toggleCheck = (id: PillarId) => {
    setCheckedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollTo = (id: Chapter) => {
    const el = document.getElementById(`ch-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selfCheckVerdict = useMemo(
    () => classifySelfCheck(checkedPillars.size),
    [checkedPillars.size],
  );

  return (
    <AppPage
      header={
        <PageHeader
          title="왜 153 다이어트?"
          subtitle="안 먹어도 찌는 몸을, 안 찌는 체질로"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="돌아가기"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      {/* 챕터 챕 — sticky sub-nav */}
      <div className="sticky top-[56px] z-20 -mx-5 mb-4 border-b border-border bg-background/90 px-5 py-2 backdrop-blur-md">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {CHAPTER_ORDER.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => scrollTo(c.id)}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary active:scale-95"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="diet-page-value" className="space-y-8 pt-2">
        {/* ══════════ 1. THE PARADOX ══════════ */}
        <section id="ch-paradox">
          <div className="rounded-2xl border border-destructive/30 bg-gradient-to-b from-destructive/10 to-transparent p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">
              {PARADOX_HERO.tagline}
            </p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-foreground">
              {PARADOX_HERO.title}
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {PARADOX_HERO.body}
            </p>
            <div className="mt-3 rounded-xl border-l-4 border-destructive bg-destructive/10 px-3 py-2.5">
              <p className="text-[13px] font-extrabold leading-snug text-foreground">
                "{PARADOX_HERO.punchline}"
              </p>
            </div>
          </div>
        </section>

        {/* ══════════ 2. 7 PILLARS ══════════ */}
        <section id="ch-pillars" className="space-y-3">
          <ChapterHeader
            tagline={BALANCE_PILLARS_HEADER.tagline}
            title={BALANCE_PILLARS_HEADER.title}
            subtitle={BALANCE_PILLARS_HEADER.subtitle}
          />
          <div className="grid grid-cols-2 gap-2">
            {BALANCE_PILLARS.map((p) => (
              <PillarCard
                key={p.id}
                pillar={p}
                open={openPillar === p.id}
                onToggle={() =>
                  setOpenPillar((prev) => (prev === p.id ? null : p.id))
                }
              />
            ))}
          </div>
          <p className="rounded-xl border border-border bg-muted/30 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">기억할 한 줄 —</strong> 이 7개
            중 어느 하나라도 오래 부족하면 몸은 "살을 빼는" 방향이 아니라 "살을
            지키고 저장하는" 방향으로 기울어요.
          </p>
        </section>

        {/* ══════════ 3. DEFICIENCY SPIRAL ══════════ */}
        <section id="ch-spiral" className="space-y-3">
          <ChapterHeader
            tagline={DEFICIENCY_SPIRAL_HEADER.tagline}
            title={DEFICIENCY_SPIRAL_HEADER.title}
            subtitle={DEFICIENCY_SPIRAL_HEADER.subtitle}
          />
          <div>
            {DEFICIENCY_SPIRAL.map((s, idx) => (
              <div key={s.id}>
                <SpiralStepCard step={s} />
                {idx < DEFICIENCY_SPIRAL.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-destructive/60" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-[12px] leading-relaxed text-foreground">
              <strong className="text-destructive">악순환의 고리 —</strong>{" "}
              피로 → 단 음식 갈망 → 폭식 → 죄책감 → 또 굶기 → 더 깊은 결핍.
              이걸 끊지 않으면 칼로리 계산은 아무 의미가 없어요.
            </p>
          </div>
        </section>

        {/* ══════════ 4. RESTORATION ══════════ */}
        <section id="ch-restore" className="space-y-3">
          <ChapterHeader
            tagline={RESTORATION_HEADER.tagline}
            title={RESTORATION_HEADER.title}
            subtitle={RESTORATION_HEADER.subtitle}
            tone="reward"
          />
          <div className="grid gap-2">
            {RESTORATION_RULES.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-primary/25 bg-primary/5 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[22px] font-black tracking-tight text-primary">
                    {r.num}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-[15px] font-extrabold leading-snug text-foreground">
                      {r.title}
                    </h4>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                      {r.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 구체 실천 — 기존 HOW_TO_RESIST 재활용 */}
          <div className="mt-1 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-primary">
              구체 실천 · 복구 세부 전술
            </p>
            {HOW_TO_RESIST.map((s) => (
              <SectionCard key={s.id} data={s} tone="grow" />
            ))}
          </div>
        </section>

        {/* ══════════ 5. SCIENCE & TIMELINE ══════════ */}
        <section id="ch-timeline" className="space-y-4">
          <ChapterHeader
            tagline="SCIENCE BEHIND THE PROBLEM"
            title="왜 살이 잘 찌는 체질이 되는가"
            subtitle="의지력이 문제가 아니라 환경·호르몬·수면이 먼저 흔들립니다."
          />
          <div className="space-y-2">
            {WHY_YOU_GAIN.map((s) => (
              <SectionCard key={s.id} data={s} tone="warn" />
            ))}
          </div>

          <ChapterHeader
            tagline="21 DAYS TIMELINE"
            title="21일간 몸 안에서 일어나는 일"
            subtitle="체중계 숫자 전에 수면·허리·컨디션·집중력부터 변합니다."
            tone="accent"
          />
          <div className="space-y-2">
            {TWENTY_ONE_DAY_TIMELINE.map((s) => (
              <SectionCard key={s.id} data={s} tone="accent" />
            ))}
          </div>
        </section>

        {/* ══════════ 6. SELF-CHECK ══════════ */}
        <section id="ch-selfcheck" className="space-y-3">
          <ChapterHeader
            tagline={SELF_CHECK_HEADER.tagline}
            title={SELF_CHECK_HEADER.title}
            subtitle={SELF_CHECK_HEADER.subtitle}
            tone="reward"
          />
          <ul className="space-y-1.5">
            {BALANCE_SELF_CHECK.map((q) => {
              const checked = checkedPillars.has(q.pillarId);
              return (
                <li key={q.pillarId}>
                  <button
                    type="button"
                    onClick={() => toggleCheck(q.pillarId)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border p-3 text-left transition-colors active:scale-[0.99]",
                      checked
                        ? "border-destructive/40 bg-destructive/10"
                        : "border-border bg-card hover:border-primary/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-black transition-colors",
                        checked
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : "border-border bg-background text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    <span className="flex-1 text-[12.5px] leading-relaxed text-foreground">
                      {q.question}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <SelfCheckSummary
            count={checkedPillars.size}
            total={BALANCE_SELF_CHECK.length}
            verdict={selfCheckVerdict}
          />
        </section>

        {/* ══════════ 7. 면책 + CTA ══════════ */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              의학적 안내
            </p>
            <ul className="mt-2 space-y-1.5">
              {SCIENCE_DISCLAIMER.map((line) => (
                <li
                  key={line}
                  className="pl-3 -indent-3 text-[12px] leading-relaxed text-foreground"
                >
                  <span className="mr-1 text-destructive">·</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => navigate("/diet")}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-2xl font-bold tracking-wide",
              "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
              "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
              "py-3.5",
            )}
          >
            밸런스 복구 시작하기
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>
      </div>
    </AppPage>
  );
};

// ══════════════════════════════════════════════════════════════════
// Pieces
// ══════════════════════════════════════════════════════════════════
const ChapterHeader = ({
  tagline,
  title,
  subtitle,
  tone = "primary",
}: {
  tagline: string;
  title: string;
  subtitle: string;
  tone?: "primary" | "reward" | "accent";
}) => {
  const taglineCls =
    tone === "reward"
      ? "text-reward"
      : tone === "accent"
        ? "text-accent"
        : "text-primary";
  return (
    <div>
      <p
        className={cn(
          "text-[10px] font-black uppercase tracking-[0.2em]",
          taglineCls,
        )}
      >
        {tagline}
      </p>
      <h3 className="mt-0.5 text-[16px] font-extrabold leading-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
};

const PillarCard = ({
  pillar,
  open,
  onToggle,
}: {
  pillar: BalancePillar;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className={cn(
      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors active:scale-[0.99]",
      open
        ? "border-primary/50 bg-primary/5"
        : "border-border bg-card hover:border-primary/30",
    )}
  >
    <div className="flex w-full items-center gap-2">
      <span className="text-[22px] leading-none">{pillar.emoji}</span>
      <span className="flex-1 text-[13px] font-extrabold text-foreground">
        {pillar.name}
      </span>
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-transform",
          open && "rotate-90 text-primary",
        )}
      />
    </div>
    <p className="text-[11.5px] leading-snug text-muted-foreground">
      {pillar.role}
    </p>
    {open && (
      <div className="mt-1.5 w-full space-y-1.5 border-t border-border pt-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-destructive">
            결핍 신호
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {pillar.deficiencySigns.map((s) => (
              <li
                key={s}
                className="pl-2.5 -indent-2.5 text-[11px] leading-relaxed text-foreground"
              >
                <span className="mr-1 text-destructive">·</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            153 답
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-foreground">
            {pillar.answer153}
          </p>
        </div>
      </div>
    )}
  </button>
);

const SpiralStepCard = ({
  step,
}: {
  step: (typeof DEFICIENCY_SPIRAL)[number];
}) => (
  <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-card p-3">
    <div className="flex shrink-0 flex-col items-center">
      <span className="text-[20px] leading-none">{step.emoji}</span>
      <span className="mt-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-destructive">
        STEP {step.step}
      </span>
    </div>
    <div className="flex-1">
      <p className="text-[13px] font-extrabold text-foreground">{step.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        {step.body}
      </p>
    </div>
  </div>
);

const SectionCard = ({
  data,
  tone,
}: {
  data: ScienceSection;
  tone: "warn" | "grow" | "accent";
}) => {
  const Icon = resolveIcon(data.icon);
  const palette =
    tone === "warn"
      ? "border-border bg-card"
      : tone === "grow"
        ? "border-primary/25 bg-primary/5"
        : "border-accent/25 bg-accent/5";
  const iconBg =
    tone === "warn"
      ? "bg-muted text-muted-foreground"
      : tone === "grow"
        ? "bg-primary/15 text-primary"
        : "bg-accent/15 text-accent";

  return (
    <div className={cn("rounded-xl border p-3", palette)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            iconBg,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13px] font-bold text-foreground">{data.title}</p>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
        {data.summary}
      </p>
      <ul className="mt-2 space-y-1">
        {data.bullets.map((b) => (
          <li
            key={b}
            className="pl-3 -indent-3 text-[11.5px] leading-relaxed text-foreground"
          >
            <span className="mr-1 text-primary">·</span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
};

const SelfCheckSummary = ({
  count,
  total,
  verdict,
}: {
  count: number;
  total: number;
  verdict: { label: string; body: string; tone: "ok" | "warn" | "danger" };
}) => {
  const toneCls =
    verdict.tone === "ok"
      ? "border-primary/40 bg-primary/5"
      : verdict.tone === "warn"
        ? "border-reward/40 bg-reward/5"
        : "border-destructive/40 bg-destructive/5";
  return (
    <div className={cn("rounded-2xl border p-4", toneCls)}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          내 밸런스 점수
        </span>
        <span className="number-font text-[20px] font-black leading-none text-foreground">
          {count}
          <span className="text-[12px] text-muted-foreground"> / {total}</span>
        </span>
      </div>
      <p className="mt-2 text-[13px] font-extrabold leading-snug text-foreground">
        {verdict.label}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        {verdict.body}
      </p>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// utils
// ──────────────────────────────────────────────────────────────────
function classifySelfCheck(count: number): {
  label: string;
  body: string;
  tone: "ok" | "warn" | "danger";
} {
  if (count === 0) {
    return {
      label: "밸런스가 잘 유지되고 있어요",
      body: "지금 체감은 괜찮은 편. 153 다이어트의 리듬을 얹으면 더 오래 갈 수 있어요.",
      tone: "ok",
    };
  }
  if (count <= 2) {
    return {
      label: "기둥 1~2개가 흔들리는 초기 신호",
      body: "아직 되돌리기 쉬운 단계. 흔들리는 기둥부터 먼저 채우면 악순환 진입을 막을 수 있어요.",
      tone: "warn",
    };
  }
  if (count <= 4) {
    return {
      label: "밸런스 붕괴 초입 — 결핍성 축적 가능",
      body: "적게 먹어도 찌는 체감이 시작될 수 있는 구간. 153의 복구 3원칙(굶지 않기·먼저 넣기·리듬 잡기)을 지금 시작하는 게 가장 빠른 반등입니다.",
      tone: "warn",
    };
  }
  return {
    label: "여러 기둥이 동시에 흔들림",
    body: "의지력 문제가 아니라 몸이 '비상 모드' 에 들어간 상태예요. 21일 리셋으로 기둥을 하나씩 세우는 쪽이 칼로리 제한보다 훨씬 효과적입니다.",
    tone: "danger",
  };
}

function resolveIcon(key: ScienceSection["icon"]) {
  switch (key) {
    case "insulin":
      return Flame;
    case "gut":
      return Leaf;
    case "rhythm":
      return Clock;
    case "sleep":
      return Moon;
    case "muscle":
      return Dumbbell;
    case "reset":
      return Target;
    case "burning":
      return Flame;
    case "lifestyle":
      return Sparkles;
    case "warn":
      return AlertTriangle;
    case "metabolism":
      return Brain;
    default:
      return Sparkles;
  }
}

export default DietValuePage;
