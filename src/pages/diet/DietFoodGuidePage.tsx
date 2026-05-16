import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Info,
  RotateCcw,
  Soup,
  ThumbsUp,
  XCircle,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";

import { useAuth } from "@/contexts/AuthContext";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import {
  FOOD_GUIDE_CARDS,
  getYouthSafeGuide,
  type FoodGuideCard,
  type FoodGuideStance,
} from "@/data/diet/foodGuidance";
import type { DietTrack } from "@/lib/dietTrack";
import { cn } from "@/lib/utils";

/**
 * /diet/food — 음식 가이드 화면.
 *
 * 구성
 *   1. 권장 / 줄이기 두 축 토글
 *   2. 상황 별 팁 카드: 외식 · 운동 전후 · 무너진 날 복귀
 *
 * 청소년 트랙 사용자에게는 youthSafe=false 카드(술 등) 를 숨긴다.
 * 모든 문구는 자체 작성 — 외부 자료 직접 인용 없음.
 */
const DietFoodGuidePage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const progressQuery = useDietProgress();

  const track: DietTrack | null = useMemo(() => {
    const payload = progressQuery.data;
    if (payload && "success" in payload && payload.success && payload.has_active) {
      return payload.enrollment!.track;
    }
    return null;
  }, [progressQuery.data]);
  const isYouth = track === "youth_habit";

  const cards = useMemo(
    () => (isYouth ? getYouthSafeGuide() : FOOD_GUIDE_CARDS),
    [isYouth],
  );

  const [stance, setStance] = useState<FoodGuideStance>("encourage");
  const filtered = cards.filter((c) => c.stance === stance);

  const featureEnabled = !!profile?.diet_program_enabled;

  return (
    <AppPage
      header={
        <PageHeader
          title="음식 가이드"
          subtitle="지속 가능한 선택을 모았어요"
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
      <div data-tour="diet-page-food" className="space-y-4 pt-2">
        {!featureEnabled ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
            153 다이어트 프로그램이 아직 활성화되지 않았어요.
          </div>
        ) : (
          <>
            {/* 안내 */}
            <div
              className={cn(
                "rounded-2xl border p-3 text-[12px] leading-relaxed",
                "border-primary/25 bg-primary/5 text-foreground",
              )}
            >
              <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
                <Info className="h-3.5 w-3.5" />
                <span>칼로리 대신 선택</span>
              </div>
              <p className="text-muted-foreground">
                숫자 계산 대신 "조금 더 좋은 선택"을 고르는 습관을 만들어요.
                금지보다 <b className="text-foreground">비율 조정</b>이 우선입니다.
              </p>
            </div>

            {/* 토글 */}
            <div className="grid grid-cols-2 gap-1.5">
              <StanceToggle
                active={stance === "encourage"}
                onClick={() => setStance("encourage")}
                icon={<ThumbsUp className="h-4 w-4" />}
                label="권장"
              />
              <StanceToggle
                active={stance === "reduce"}
                onClick={() => setStance("reduce")}
                icon={<XCircle className="h-4 w-4" />}
                label="줄이기"
              />
            </div>

            {/* 카드 리스트 */}
            <ul className="space-y-2">
              {filtered.map((c) => (
                <FoodCard key={c.id} card={c} />
              ))}
            </ul>

            {/* 상황 팁 */}
            <section className="space-y-2">
              <h3 className="text-[13px] font-bold text-foreground">상황별 팁</h3>
              <ul className="space-y-2">
                <TipCard
                  icon={<Soup className="h-4 w-4" />}
                  title="외식 자리에서"
                  lines={[
                    "메뉴 먼저 보고 단백질 + 채소 1접시를 먼저 확보하세요.",
                    "국물·디저트는 절반만 — 맛은 충분히, 양은 조절.",
                    isYouth
                      ? "탄산·가당 대신 물 또는 무가당 차로 바꾸기."
                      : "술자리라면 무알콜·저알콜 옵션을 먼저 찾기.",
                  ]}
                />
                <TipCard
                  icon={<ThumbsUp className="h-4 w-4" />}
                  title="운동 전후"
                  lines={[
                    "운동 1시간 전: 바나나·요거트 등 가볍고 소화 빠른 탄수.",
                    "운동 직후 30분: 단백질 20g 기준 (계란 2~3개·닭가슴살 100g).",
                    "격한 훈련 뒤엔 수분·나트륨 복원이 우선. 물 500ml 나눠서.",
                  ]}
                />
                <TipCard
                  icon={<RotateCcw className="h-4 w-4" />}
                  title="무너진 날, 다시 시작"
                  lines={[
                    "한 끼 과식했다고 해서 하루가 끝난 게 아닙니다.",
                    "다음 끼니에 단백질 + 채소로 '제자리' 한 번만 해도 회복.",
                    "죄책감 대신 메모 한 줄 — 어떤 상황에서 무너졌는지 기록.",
                  ]}
                />
              </ul>
            </section>

            {isYouth && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                청소년 트랙은 단식·식사 거르기를 권하지 않습니다. 잘 먹고, 잘 자고, 잘 움직이는 쪽으로 무게중심.
              </div>
            )}
          </>
        )}
      </div>
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// UI parts
// ──────────────────────────────────────────────────────────────────
const StanceToggle = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13px] font-bold transition-colors",
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-card text-muted-foreground hover:border-primary/40",
    )}
    aria-pressed={active}
  >
    {icon}
    {label}
  </button>
);

const FoodCard = ({ card }: { card: FoodGuideCard }) => (
  <li
    className={cn(
      "rounded-xl border p-3",
      card.stance === "encourage"
        ? "border-primary/25 bg-primary/5"
        : "border-destructive/25 bg-destructive/5",
    )}
  >
    <div className="flex items-center gap-2">
      <p
        className={cn(
          "text-[13px] font-bold",
          card.stance === "encourage" ? "text-primary" : "text-destructive",
        )}
      >
        {card.title}
      </p>
      <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
        {card.category}
      </span>
    </div>
    <p className="mt-1 text-[11.5px] text-muted-foreground">{card.examples}</p>
    <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground">
      {card.coaching}
    </p>
  </li>
);

const TipCard = ({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
}) => (
  <li className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-foreground">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      {title}
    </div>
    <ul className="mt-1.5 space-y-1">
      {lines.map((ln) => (
        <li
          key={ln}
          className="pl-3 -indent-3 text-[12px] leading-relaxed text-muted-foreground"
        >
          <span className="mr-1 text-primary">·</span>
          {ln}
        </li>
      ))}
    </ul>
  </li>
);

export default DietFoodGuidePage;
