import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Brain,
  ChevronLeft,
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
  HOW_TO_RESIST,
  SCIENCE_DISCLAIMER,
  TWENTY_ONE_DAY_TIMELINE,
  WHY_YOU_GAIN,
  type ScienceSection,
} from "@/data/diet/scienceContent";
import { cn } from "@/lib/utils";

/**
 * /diet/value — 153 다이어트가 "체중을 줄이는 게 아니라 살이 잘 안 붙는 몸"
 * 을 만드는 원리를 설명하는 가치·과학 탭.
 *
 * 섹션
 *   1. 히어로 (슬로건)
 *   2. 왜 살이 찌는 체질이 되는가 (5 섹션)
 *   3. 어떻게 안 찌는 체질이 되는가 (6 섹션)
 *   4. 21일 타임라인 (3 구간)
 *   5. 의학적 면책
 */
const DietValuePage = () => {
  const navigate = useNavigate();

  return (
    <AppPage
      header={
        <PageHeader
          title="왜 153 다이어트?"
          subtitle="살이 안 찌는 체질로 바꾸는 이유"
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
      <div className="space-y-5 pt-2">
        {/* 히어로 */}
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            WHY · SCIENCE
          </p>
          <h2 className="mt-1 text-[20px] font-extrabold leading-tight text-foreground">
            체중 숫자 대신, 체질을 바꿉니다
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            급하게 살을 빼면 대부분 돌아옵니다. 21일은 짧지만, 그 사이에 혈당·인슐린·장내 환경·식욕 호르몬·수면 리듬이 조금씩 정상 쪽으로 이동해요. 숫자보다 '살이 잘 안 찌는 체질'이 목표입니다.
          </p>
        </div>

        {/* 왜 살이 찌는 체질이 되는가 */}
        <Block
          tagline="WHY YOU GAIN"
          title="왜 살이 찌는 체질이 되는가"
          subtitle="의지력보다 환경·호르몬·수면이 먼저 흔들립니다."
        >
          {WHY_YOU_GAIN.map((s) => (
            <SectionCard key={s.id} data={s} tone="warn" />
          ))}
        </Block>

        {/* 어떻게 안 찌는 체질이 되는가 */}
        <Block
          tagline="HOW TO RESIST"
          title="어떻게 안 찌는 체질이 되는가"
          subtitle="식사 순서, 장내 환경, 리듬, 수면, 근육 — 5가지를 동시에 미세 조정합니다."
        >
          {HOW_TO_RESIST.map((s) => (
            <SectionCard key={s.id} data={s} tone="grow" />
          ))}
        </Block>

        {/* 21일 타임라인 */}
        <Block
          tagline="21 DAYS TIMELINE"
          title="몸 안에서 21일간 일어나는 일"
          subtitle="체중계 숫자 전에 수면·허리·컨디션·집중력부터 변합니다."
        >
          {TWENTY_ONE_DAY_TIMELINE.map((s) => (
            <SectionCard key={s.id} data={s} tone="accent" />
          ))}
        </Block>

        {/* 면책 */}
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
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
        </section>

        {/* 마무리 CTA */}
        <button
          type="button"
          onClick={() => navigate("/diet")}
          className={cn(
            "w-full rounded-2xl font-bold tracking-wide",
            "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
            "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
            "py-3.5",
          )}
        >
          시작해 볼까요? 프로그램으로 돌아가기
        </button>
      </div>
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// Pieces
// ──────────────────────────────────────────────────────────────────
const Block = ({
  tagline,
  title,
  subtitle,
  children,
}: {
  tagline: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2.5">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
        {tagline}
      </p>
      <h3 className="mt-0.5 text-[15px] font-extrabold text-foreground leading-tight">
        {title}
      </h3>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
    <div className="space-y-2">{children}</div>
  </section>
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
