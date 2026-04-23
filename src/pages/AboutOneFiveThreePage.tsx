import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { cn } from "@/lib/utils";

/**
 * /about/153 — "153이란?" 브랜드 스토리 페이지.
 *
 * 가볍지 않은 서사라 타이포그래피 중심 구성:
 *   1. 히어로   — 큰 "153" + 한 줄 정의
 *   2. 서사    — 베드로의 밤, 순종, 153 마리의 충만함
 *   3. 의미 3축 — 실패 후 재시작 / 다시 채워짐 / 다시 세워짐
 *   4. 미션문  — "무너지지 않는 사람을 만드는 곳"
 *   5. CTA     — 홈으로 돌아가기
 *
 * 브랜드 포인트 컬러: primary(빨강) + accent(민트). 포인트는 한 줄당 1회만.
 */

interface Pillar {
  keyword: string;
  line1: string;
  line2: string;
}

const PILLARS: readonly Pillar[] = Object.freeze([
  {
    keyword: "증거",
    line1: "실패 이후에도",
    line2: "다시 시작할 수 있다는 증거",
  },
  {
    keyword: "약속",
    line1: "비어 있던 삶이",
    line2: "다시 채워질 수 있다는 약속",
  },
  {
    keyword: "희망",
    line1: "한 사람의 인생이",
    line2: "다시 세워질 수 있다는 희망",
  },
]);

const AboutOneFiveThreePage = () => {
  const navigate = useNavigate();

  return (
    <AppPage
      header={
        <PageHeader
          title="153이란?"
          subtitle="다시 시작하는 사람에게 주어진 숫자"
          leftAction={
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로"
              className="rounded-full bg-secondary p-2 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-7 pt-2 pb-4">
        {/* ══════════ 1. 히어로 ══════════ */}
        <section
          className="relative overflow-hidden rounded-2xl border border-primary/25 p-6"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(217, 54, 32, 0.12) 0%, rgba(41, 195, 156, 0.06) 55%, transparent 100%)",
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
            WHAT IS 153?
          </p>
          <h2 className="mt-3 flex items-baseline gap-2 leading-none">
            <span
              className="number-font font-black text-foreground"
              style={{ fontSize: "clamp(64px, 17vw, 104px)", letterSpacing: "-4px" }}
            >
              153
            </span>
            <span className="text-[22px] font-black text-primary">.</span>
          </h2>
          <p className="mt-4 text-[14px] font-bold leading-relaxed text-foreground">
            다시 시작하는 사람에게 주어진 숫자.
          </p>
        </section>

        {/* ══════════ 2. 서사 — 베드로의 밤 ══════════ */}
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            THE STORY
          </p>

          <p className="text-[13.5px] leading-[1.85] text-foreground">
            밤새도록 애썼지만
            <br />
            아무것도 얻지 못한 베드로에게
            <br />
            예수님은 다시 말씀하셨습니다.
          </p>

          <blockquote className="relative rounded-2xl border-l-[3px] border-primary bg-primary/5 px-4 py-3">
            <p className="text-[15px] font-extrabold leading-snug text-foreground">
              "그물을 던져라."
            </p>
          </blockquote>

          <p className="text-[13.5px] leading-[1.85] text-foreground">
            순종 끝에 돌아온 것은
            <br />
            겨우 한 마리가 아니라{" "}
            <span className="font-black text-accent">153의 충만함</span>
            이었습니다.
            <br />
            그 많은 것을 담고도 그물은{" "}
            <span className="font-black text-foreground">찢어지지 않았습니다.</span>
          </p>

          <p className="text-[13.5px] leading-[1.85] text-foreground">
            그리고 예수님은 베드로에게
            <br />
            다시 사명을 맡기셨습니다.
            <br />
            <span className="text-muted-foreground">넘어진 과거보다</span>{" "}
            <span className="font-bold">다시 일어설 미래</span>를 보셨기 때문입니다.
          </p>
        </section>

        {/* ══════════ 3. 의미 3축 ══════════ */}
        <section className="space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              MEANING
            </p>
            <h3 className="mt-1 text-[16px] font-extrabold leading-tight text-foreground">
              그래서 153은
              <br />
              우리에게 단순한 숫자가 아닙니다.
            </h3>
          </div>

          <ul className="space-y-2">
            {PILLARS.map((p, idx) => (
              <li
                key={p.keyword}
                className={cn(
                  "rounded-2xl border border-border bg-card p-4",
                  "transition-colors",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="number-font text-[11px] font-black leading-none text-primary"
                    style={{ letterSpacing: "-0.5px" }}
                  >
                    0{idx + 1}
                  </span>
                  <span className="rounded-md bg-accent/12 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent">
                    {p.keyword}
                  </span>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-foreground">
                  {p.line1}
                  <br />
                  <span className="font-extrabold">{p.line2}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ══════════ 4. 미션문 ══════════ */}
        <section
          className="relative overflow-hidden rounded-2xl border border-accent/30 p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(41, 195, 156, 0.10) 0%, rgba(217, 54, 32, 0.08) 100%)",
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-accent">
            OUR MISSION
          </p>
          <p className="mt-2 text-[16px] font-extrabold leading-snug text-foreground">
            <span className="text-primary">153 BOXING GYM</span>은
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.9] text-foreground">
            강한 몸을 만드는 곳이기 전에
            <br />
            <span className="text-[15px] font-black text-foreground">
              무너지지 않는 사람을
            </span>
            <br />
            <span className="text-[15px] font-black text-accent">
              만드는 곳입니다.
            </span>
          </p>
        </section>

        {/* ══════════ 5. 닫기 CTA ══════════ */}
        <button
          type="button"
          onClick={() => navigate("/home")}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 font-bold tracking-wide",
            "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
            "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
          )}
        >
          나의 링으로 돌아가기
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </AppPage>
  );
};

export default AboutOneFiveThreePage;
