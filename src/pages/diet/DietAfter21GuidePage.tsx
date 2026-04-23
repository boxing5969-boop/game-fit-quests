import { useNavigate } from "react-router-dom";
import {
  Award,
  CalendarCheck,
  ChevronLeft,
  Flag,
  HeartHandshake,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Trophy,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { cn } from "@/lib/utils";

/**
 * /diet/after-21 — 21일 이후 가이드.
 *
 * 실제 완주 후에야 보이는 분기 화면(PostProgramRouter)을 사용자가 진행 중에 미리
 * 이해할 수 있도록 설명만 모은 read-only 페이지. 실제 동작 상태와 분리 — 여기서 데이터
 * 쓰기나 경로 선택은 하지 않는다.
 */
const DietAfter21GuidePage = () => {
  const navigate = useNavigate();

  return (
    <AppPage
      header={
        <PageHeader
          title="21일 이후 가이드"
          subtitle="21일이 끝나도 끝이 아닙니다"
          leftAction={
            <button
              type="button"
              onClick={() => navigate(-1)}
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
        {/* Hero */}
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            NEXT STEP · 21일 이후
          </p>
          <h2 className="mt-1 text-display-sm leading-tight text-foreground">
            끝이 아니라 다음 단계로 갑니다
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            21일은 체중의 레이스가 아니라 몸 습관의 리셋이에요. 그 다음에는 지금까지
            만든 리듬을 유지하거나, 한 사이클을 안정적으로 이어가 감량을 마무리합니다.
          </p>
        </section>

        {/* 두 갈래 경로 */}
        <Section title="두 갈래 경로" icon={<Target className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-3">
            <PathCard
              tone="good"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="유지 컨설팅 모드"
              subtitle="유연하게 먹으면서도 무너지지 않는 유지 전략"
              bullets={[
                "주 1회 체중 또는 허리 체크",
                "외식·회식 이후 다음 끼니 복귀",
                "유지 범위 급증 시 3일 복귀 미션 자동 제안",
              ]}
            />
            <PathCard
              tone="focus"
              icon={<HeartHandshake className="h-5 w-5" />}
              title="건강리셋 연장 프로그램"
              subtitle="극단적 제한이 아니라 안정적인 감량 루틴"
              bullets={[
                "기본 14일 사이클 · 필요 시 21일 선택",
                "1주차 리듬 재정렬 + 2주차 감량 지속/정체기 대응",
                "코치 주간 피드백 · 사이클 종료 후 3갈래 선택",
              ]}
            />
          </div>
          <Quote>
            두 경로 중 어느 쪽을 골라도 21일 동안 만든 리듬을 이어가는 길이에요.
          </Quote>
        </Section>

        {/* 추천 기준 */}
        <Section title="어느 경로가 나에게 맞나요?" icon={<Sparkles className="h-4 w-4" />}>
          <div className="space-y-2">
            <CriteriaRow
              left="유지 모드 추천"
              right="목표 달성 · 21일 중 18일 이상 승인 · 최근 1주 수행률 80% 이상 · 코치가 유지 권장"
              tone="good"
            />
            <CriteriaRow
              left="연장 프로그램 추천"
              right="목표 미달성 · 21일 중 14일 미만 승인 · 최근 1주 수행률 60% 미만 · 야식·당 음료 빈발"
              tone="focus"
            />
            <CriteriaRow
              left="코치 상담 권장"
              right="두 경로 가중치가 비슷하거나 코치가 추가 점검 필요로 판단"
              tone="neutral"
            />
          </div>
          <Quote>
            앱이 자동으로 추천을 띄우지만, 최종 선택은 회원이 합니다. 언제든 경로
            전환도 가능해요.
          </Quote>
        </Section>

        {/* 유지 모드 상세 */}
        <Section
          title="유지 컨설팅 모드 · 한눈에"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
        >
          <ul className="space-y-1.5">
            <DetailItem
              label="유지 범위 설정"
              hint="목표 체중 기준 ±2kg · 허리 ±3cm (기본값). 본인 감각에 맞게 조절 가능."
            />
            <DetailItem
              label="주간 체크인"
              hint="체중 또는 허리 한 가지, 자유식 횟수, 늦은 폭식, 복싱 출석 수 기록."
            />
            <DetailItem
              label="복귀 미션 자동 제안"
              hint="유지 범위 초과 또는 늦은 폭식 3회 이상 시 3일 복귀 루틴이 자동 등장."
            />
            <DetailItem
              label="유지 점수"
              hint="최근 4주 수행률 평균. 공개 랭킹과 분리된 자기 점검용 숫자."
            />
            <DetailItem
              label="주간 미션 6종"
              hint="단백질 먼저 · 주 3회 운동 · 당 음료 피하기 · 자유식 후 복귀 · 주 1회 체크 · 늦은 폭식 0회"
            />
          </ul>
          <Quote tone="good">
            이제는 빼는 단계보다 지키는 단계가 중요합니다. 먹고 싶은 것을 즐기더라도
            다시 균형으로 돌아오는 힘을 만드는 과정이에요.
          </Quote>
        </Section>

        {/* 연장 프로그램 상세 */}
        <Section
          title="건강리셋 연장 프로그램 · 한눈에"
          icon={<HeartHandshake className="h-4 w-4 text-primary" />}
        >
          {/* 1. 시작 전 재평가 */}
          <SubStep
            step={1}
            title="시작 전 재평가 (3 스텝)"
            body={[
              "최근 21일 수행률, 가장 자주 무너진 습관, 주간 운동·수면·외식·야식 빈도 점검",
              "가장 큰 장애물 한 가지 선택 (야식/외식/주말 붕괴/수면/스트레스/기타)",
              "연장 목표 6종 재설정 — 체중·허리·출석·식단 인증·수면·주말 방어",
            ]}
          />
          {/* 2. 패턴 분류 */}
          <SubStep
            step={2}
            icon={<Tags className="h-4 w-4 text-primary" />}
            title="6가지 약점 패턴 자동 분류"
            body={[
              "야식형 · 외식형 · 주말붕괴형",
              "운동 잘하지만 식단 약함 · 식단은 되지만 출석 약함 · 수면 부족형",
              "회원이 체감하는 패턴을 추가 선택해 보강할 수 있어요",
            ]}
          />
          {/* 3. 주차별 미션 */}
          <SubStep
            step={3}
            icon={<CalendarCheck className="h-4 w-4 text-primary" />}
            title="주차별 미션 엔진"
            body={[
              "1주차 — 리듬 재정렬: 수면·물·단백질 기본부터",
              "2주차+ — 감량 지속 / 정체기 대응: 한 단계 정교하게",
              "패턴 플레이북 + 공통 미션을 자동 조합해 한 주 6개 이내로 추림",
            ]}
          />
          {/* 4. 사이클 종료 */}
          <SubStep
            step={4}
            icon={<RefreshCw className="h-4 w-4 text-primary" />}
            title="사이클 종료 후 3갈래 선택"
            body={[
              "유지 모드로 전환 — 이제는 지키는 단계",
              "한 번 더 연장 — 안정적인 감량 루틴을 한 사이클 더",
              "코치와 개별 상담 — 정체·이탈 전 1:1 점검",
            ]}
          />
          <Quote tone="focus">
            지금 필요한 것은 더 극단적인 제한이 아니라 더 안정적인 감량 루틴입니다.
          </Quote>
        </Section>

        {/* 배지 */}
        <Section title="이어서 받는 배지" icon={<Award className="h-4 w-4 text-reward" />}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <BadgeRow icon={<ShieldCheck className="h-3.5 w-3.5" />} name="유지 모드 시작" hint="21일 이후 유지 모드 진입" />
            <BadgeRow icon={<Trophy className="h-3.5 w-3.5" />} name="4주 유지 성공" hint="유지 모드 4주 연속 체크인" />
            <BadgeRow icon={<HeartHandshake className="h-3.5 w-3.5" />} name="건강리셋 연장 시작" hint="연장 프로그램 진입" />
            <BadgeRow icon={<Sparkles className="h-3.5 w-3.5" />} name="2차 리셋 완주" hint="연장 사이클 1회 완주" />
            <BadgeRow icon={<Flag className="h-3.5 w-3.5" />} name="복귀력 우수" hint="3일 복귀 미션 완주" />
          </div>
        </Section>

        {/* 원칙 */}
        <Section title="우리 약속" icon={<Sparkles className="h-4 w-4" />}>
          <ul className="space-y-1.5">
            <PrincipleItem tone="good" text="목표 미달성 = 실패로 부르지 않아요" />
            <PrincipleItem tone="good" text="유지 = 방심으로 부르지 않아요" />
            <PrincipleItem tone="good" text="극단적 제한을 기본값으로 두지 않아요" />
            <PrincipleItem tone="good" text="체중 경쟁 없음 — 공개 랭킹과 분리됩니다" />
          </ul>
        </Section>

        {/* CTA */}
        <div className="flex flex-col gap-2 pb-4">
          <button
            type="button"
            onClick={() => navigate("/diet/tracker")}
            className={cn(
              "h-12 rounded-2xl font-bold tracking-wide",
              "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
              "shadow-[0_6px_22px_-6px_hsl(var(--primary)/0.6)]",
            )}
          >
            오늘의 체크인 하러 가기
          </button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            21일 동안 오늘 하루에만 집중하면 충분해요. 그 다음 단계는 때가 되면 자동으로 열립니다.
          </p>
        </div>
      </div>
    </AppPage>
  );
};

// ───────────────────────────────────────────────────────────────────────
const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="space-y-2.5">
    <div className="flex items-center gap-1.5">
      {icon}
      <h3 className="text-[14px] font-extrabold text-foreground">{title}</h3>
    </div>
    {children}
  </section>
);

const PathCard = ({
  tone,
  icon,
  title,
  subtitle,
  bullets,
}: {
  tone: "good" | "focus";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
}) => (
  <div
    className={cn(
      "rounded-2xl border p-4",
      tone === "good"
        ? "border-emerald-400/40 bg-emerald-400/5"
        : "border-primary/35 bg-primary/5",
    )}
  >
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          tone === "good" ? "bg-emerald-400/15 text-emerald-500" : "bg-primary/15 text-primary",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-[14.5px] font-extrabold leading-tight text-foreground">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    <ul className="mt-3 space-y-1 text-[12.5px] text-foreground">
      {bullets.map((b) => (
        <li key={b} className="flex gap-1.5">
          <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span className="leading-relaxed">{b}</span>
        </li>
      ))}
    </ul>
  </div>
);

const CriteriaRow = ({
  left,
  right,
  tone,
}: {
  left: string;
  right: string;
  tone: "good" | "focus" | "neutral";
}) => (
  <div
    className={cn(
      "rounded-xl border p-3 text-[12px] leading-relaxed",
      tone === "good"
        ? "border-emerald-400/30 bg-emerald-400/5"
        : tone === "focus"
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-card",
    )}
  >
    <p
      className={cn(
        "text-[11.5px] font-extrabold",
        tone === "good"
          ? "text-emerald-500"
          : tone === "focus"
            ? "text-primary"
            : "text-foreground",
      )}
    >
      {left}
    </p>
    <p className="mt-0.5 text-muted-foreground">{right}</p>
  </div>
);

const DetailItem = ({ label, hint }: { label: string; hint: string }) => (
  <li className="rounded-xl border border-border bg-card px-3 py-2.5">
    <p className="text-[12.5px] font-bold text-foreground">{label}</p>
    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{hint}</p>
  </li>
);

const SubStep = ({
  step,
  icon,
  title,
  body,
}: {
  step: number;
  icon?: React.ReactNode;
  title: string;
  body: string[];
}) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-center gap-2">
      <span className="number-font flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[12px] font-extrabold text-primary">
        {step}
      </span>
      {icon}
      <p className="text-[13px] font-extrabold text-foreground">{title}</p>
    </div>
    <ul className="mt-2 space-y-0.5 text-[12px] text-foreground">
      {body.map((b) => (
        <li key={b} className="flex gap-1.5">
          <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span className="leading-relaxed">{b}</span>
        </li>
      ))}
    </ul>
  </div>
);

const BadgeRow = ({
  icon,
  name,
  hint,
}: {
  icon: React.ReactNode;
  name: string;
  hint: string;
}) => (
  <div className="flex items-start gap-2 rounded-xl border border-reward/25 bg-reward/5 px-3 py-2">
    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-reward/20 text-[#F6C453]">
      {icon}
    </span>
    <div>
      <p className="text-[12.5px] font-extrabold text-foreground">{name}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  </div>
);

const PrincipleItem = ({
  tone,
  text,
}: {
  tone: "good" | "warn";
  text: string;
}) => (
  <li
    className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]",
      tone === "good"
        ? "border-emerald-400/25 bg-emerald-400/5 text-foreground"
        : "border-border bg-card text-foreground",
    )}
  >
    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
    {text}
  </li>
);

const Quote = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "focus";
}) => (
  <p
    className={cn(
      "rounded-xl border px-3 py-2 text-[12px] leading-relaxed",
      tone === "good"
        ? "border-emerald-400/25 bg-emerald-400/5 text-foreground"
        : tone === "focus"
          ? "border-primary/25 bg-primary/5 text-foreground"
          : "border-border bg-muted/30 text-muted-foreground",
    )}
  >
    {children}
  </p>
);

export default DietAfter21GuidePage;
