/**
 * 🧤 타이틀미션 카드 '설계 노트' 탭 — 3번 공격 · 3번 미트로 만든 이유 3편 (2026-11-05 대표님 · 11:24 다시 그림).
 *
 *   대표님 "글씨 크기 · 밸런스 UI 는 토스와 세계적 테크 기업처럼" — 상자를 줄이고 여백 · 굵기 · 크기로 나눈다.
 *   위 칸 ①가르치기 ②함께 자라기 ③반복 → 고른 편: 작은 머리말 → 큰 제목 한 문장(text-title) → 설명 →
 *   (숫자 두 칸) → 연구로 보면(번호 줄 · '실험 자세히'를 펼치면 누가 · 몇 명 · 무엇을) → (153의 성장 순서) →
 *   공부 · 세계 최고 팀 이야기 → 153 체육관에서는 → 오늘 해 볼 것 하나 → (마무리 한 줄) → 출처 → 앞 · 다음 편.
 *   내용은 lib/titleTeachLessons.ts 한 곳. 알림(레벨 10 이 되면 하루 한 편)은 ?why=1~3 으로 이 탭의 그 편을 연다.
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { titleMissionGuideFor } from "@/lib/titleMissionGuide";
import { TITLE_TEACH_LESSONS, chantChunks, fillWho, lessonFor, type TeachDay } from "@/lib/titleTeachLessons";
import { cn } from "@/lib/utils";

interface Props {
  day: TeachDay;
  onDay: (d: TeachDay) => void;
  /** 심사하는 사람 — 지점장님 · 관장님 · 코치님 */
  who: string;
  /** 지금 보는 리그 (외우는 말 덩어리를 그 리그 것으로) */
  league: string;
}

const PANEL_ID = "title-teach-panel";

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h5 className="text-label font-bold text-muted-foreground">{children}</h5>
);

const TitleTeachTab = ({ day, onDay, who, league }: Props) => {
  const navigate = useNavigate();
  const [showDetail, setShowDetail] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const lesson = lessonFor(day);
  const chunks = chantChunks(titleMissionGuideFor(league)?.chant ?? "");
  const hasDetail = lesson.research.some((r) => r.detail);
  const prev = day > 1 ? ((day - 1) as TeachDay) : null;
  const next = day < 3 ? ((day + 1) as TeachDay) : null;

  const pick = (d: TeachDay) => {
    setShowDetail(false);
    setShowSources(false);
    onDay(d);
  };

  return (
    <div className="px-5 pt-4">
      {/* 세 편 */}
      <div role="tablist" aria-label="설계 노트 고르기" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1">
        {TITLE_TEACH_LESSONS.map((l) => (
          <button
            key={l.day}
            type="button"
            role="tab"
            aria-selected={l.day === day}
            aria-controls={PANEL_ID}
            onClick={() => pick(l.day)}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-label font-bold transition-colors",
              l.day === day ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-micro font-bold",
                l.day === day ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {l.day}
            </span>
            <span className="truncate">{l.tab}</span>
          </button>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-live="polite">
        {/* 머리 — 작은 머리말 · 큰 제목 한 문장 · 설명 */}
        <p className="mt-6 text-label font-bold text-primary">{lesson.kicker}</p>
        <h4 className="mt-1.5 text-title font-bold leading-snug tracking-tight text-foreground">{lesson.title}</h4>
        <p className="mt-3 text-body leading-relaxed text-muted-foreground">{lesson.lead}</p>

        {/* 숫자로 보기 (3편) */}
        {lesson.stats && (
          <section className="mt-7">
            <SectionTitle>{lesson.stats.title}</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {lesson.stats.items.map((s) => (
                <div key={s.value} className="rounded-2xl bg-secondary/70 px-4 py-4">
                  <p className="text-title font-bold tabular-nums tracking-tight text-foreground">{s.value}</p>
                  <p className="mt-1 text-label leading-snug text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-body font-bold leading-snug text-foreground">{lesson.stats.note}</p>
          </section>
        )}

        {/* 연구로 보면 */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <SectionTitle>연구로 보면</SectionTitle>
            {hasDetail && (
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                aria-expanded={showDetail}
                className="inline-flex h-8 items-center gap-0.5 text-label font-bold text-primary"
              >
                실험 자세히 <ChevronDown className={cn("h-4 w-4 transition-transform", showDetail && "rotate-180")} />
              </button>
            )}
          </div>
          <ol className="mt-1 divide-y divide-border/70">
            {lesson.research.map((r, i) => (
              <li key={i} className="flex gap-3 py-4">
                <span aria-hidden className="w-4 shrink-0 text-body font-bold tabular-nums text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-body leading-relaxed text-foreground">{r.text}</p>
                  {showDetail && r.detail && (
                    <p className="mt-2 rounded-xl bg-secondary/60 px-3 py-2.5 text-label leading-relaxed text-muted-foreground">
                      {r.detail}
                    </p>
                  )}
                  <p className="mt-1.5 text-label text-muted-foreground">{r.by}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 153의 성장 순서 (3편) */}
        {lesson.steps && (
          <section className="mt-6">
            <SectionTitle>{lesson.steps.title}</SectionTitle>
            <ol className="mt-3">
              {lesson.steps.items.map((s, i, all) => (
                <li key={s.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-micro font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    {i < all.length - 1 && <span aria-hidden className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className={cn("min-w-0", i < all.length - 1 && "pb-4")}>
                    <p className="text-body font-bold leading-7 text-foreground">{s.label}</p>
                    <p className="text-body leading-relaxed text-muted-foreground">{s.text}</p>
                    {s.by && <p className="mt-1 text-label text-muted-foreground">{s.by}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 공부 · 세계 최고 팀 이야기 */}
        {lesson.stories && (
          <section className="mt-6">
            <SectionTitle>{lesson.stories.title}</SectionTitle>
            <ul className="mt-1 divide-y divide-border/70">
              {lesson.stories.items.map((s) => (
                <li key={s.who} className="py-4">
                  <p className="text-body font-bold text-foreground">{s.who}</p>
                  <p className="mt-1 text-body leading-relaxed text-foreground">{s.text}</p>
                  {s.by && <p className="mt-1.5 text-label text-muted-foreground">{s.by}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 153 체육관에서는 */}
        <section className="mt-6">
          <SectionTitle>153 체육관에서는</SectionTitle>
          {day === 1 && chunks.length > 0 && (
            <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="9동작 외우는 말">
              {chunks.map((c, i) => (
                <li key={i} className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground">
                  {c}
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-3 space-y-2.5">
            {lesson.gym.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-body leading-relaxed text-foreground">
                <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 오늘 해 볼 것 — 하나 */}
        <div className="mt-8 rounded-2xl bg-primary/10 p-5">
          <p className="text-label font-bold text-primary">오늘 해 볼 것</p>
          <p className="mt-1 text-heading font-bold leading-snug text-foreground">{fillWho(lesson.action.text, who)}</p>
          {lesson.action.kind === "partner" && (
            <button
              type="button"
              onClick={() => navigate("/myboxer/community?together=1")}
              className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <Users className="h-4 w-4" /> 오늘 같이 해요에서 파트너 찾기
            </button>
          )}
        </div>

        {/* 마무리 한 줄 (3편) */}
        {lesson.closing && (
          <div className="mt-8 text-center">
            <p className="text-heading font-bold text-foreground">{lesson.closing.line}</p>
            <p className="mt-1 text-label font-bold text-muted-foreground">{lesson.closing.sub}</p>
          </div>
        )}

        {/* 출처 */}
        <button
          type="button"
          onClick={() => setShowSources((v) => !v)}
          aria-expanded={showSources}
          className="mt-6 inline-flex h-8 items-center gap-0.5 text-label font-bold text-muted-foreground"
        >
          연구 · 기사 출처 <ChevronDown className={cn("h-4 w-4 transition-transform", showSources && "rotate-180")} />
        </button>
        {showSources && (
          <ul className="space-y-1.5 pb-1">
            {lesson.sources.map((s, i) => (
              <li key={i} className="break-words text-micro leading-snug text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        )}

        {/* 앞 · 다음 편 */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {prev ? (
            <button
              type="button"
              onClick={() => pick(prev)}
              className="inline-flex h-10 items-center gap-0.5 rounded-full px-2 text-label font-bold text-muted-foreground active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" /> {prev}편
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              type="button"
              onClick={() => pick(next)}
              className="inline-flex h-10 items-center gap-0.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
            >
              다음 · {lessonFor(next).tab} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TitleTeachTab;
