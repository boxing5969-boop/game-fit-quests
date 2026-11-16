/**
 * 👀 홈 「다음 레벨까지」 예시 띠 — 주소에 ?lvdemo= 가 있을 때만 (운영진 미리 보기 · lib/nextLevelGuideSample.ts).
 * 지도진 · 마스터 계정의 홈에는 이 카드가 없어서, 회원에게 무엇이 보이는지 예시로 바꿔 보고 닫는다.
 */
import { Link } from "react-router-dom";
import { NEXT_LEVEL_DEMOS, nextLevelDemoLink, type NextLevelDemo } from "@/lib/nextLevelGuideSample";
import { cn } from "@/lib/utils";

const NextLevelDemoStrip = ({ current }: { current: NextLevelDemo }) => (
  <div className="rounded-2xl bg-muted/60 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <p className="min-w-0 break-keep text-label font-bold text-foreground">예시 화면 · {current.label}</p>
      <Link to="/home" replace className="-my-1.5 flex h-8 shrink-0 items-center text-label font-bold text-muted-foreground">
        닫기
      </Link>
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {NEXT_LEVEL_DEMOS.map((d) => (
        <Link
          key={d.key}
          to={nextLevelDemoLink(d.key)}
          replace
          aria-current={d.key === current.key ? "true" : undefined}
          className={cn(
            "flex h-9 items-center rounded-full px-3.5 text-label font-bold",
            d.key === current.key ? "bg-foreground text-background" : "bg-card text-foreground ring-1 ring-border",
          )}
        >
          {d.chip}
        </Link>
      ))}
    </div>
  </div>
);

export default NextLevelDemoStrip;
