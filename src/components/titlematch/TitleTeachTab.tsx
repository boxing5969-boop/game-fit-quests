/**
 * 🧤 타이틀미션 카드 '왜 미트를 잡아 줄까' 탭 — 3편 이야기 (2026-11-05 대표님).
 *
 *   위 칸 ①가르치기 ②번갈아 하기 ③왜 3번 → 고른 편: 큰 질문 → 한 줄 답 → (3-2-1 다리 · 숫자로 보기) →
 *   연구로 보면 → 체육관에서는(9동작 외우는 말 덩어리) → 오늘 해 볼 것 하나 → 출처(펼쳐 보기) → 다음 편.
 *   내용은 lib/titleTeachLessons.ts 한 곳. 알림(레벨 10 이 되면 하루 한 편)은 ?why=1~3 으로 이 탭의 그 편을 연다.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { titleMissionGuideFor } from "@/lib/titleMissionGuide";
import {
  TITLE_TEACH_LESSONS,
  chantChunks,
  fillWho,
  lessonFor,
  type TeachDay,
} from "@/lib/titleTeachLessons";
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

const TitleTeachTab = ({ day, onDay, who, league }: Props) => {
  const navigate = useNavigate();
  const [showSources, setShowSources] = useState(false);
  const lesson = lessonFor(day);
  const chunks = chantChunks(titleMissionGuideFor(league)?.chant ?? "");
  const prev = day > 1 ? ((day - 1) as TeachDay) : null;
  const next = day < 3 ? ((day + 1) as TeachDay) : null;

  const pick = (d: TeachDay) => {
    setShowSources(false);
    onDay(d);
  };

  return (
    <div className="px-4 pt-4">
      {/* 세 편 */}
      <div role="tablist" aria-label="타이틀미션 이야기 고르기" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1">
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
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-micro font-black",
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
        {/* 질문 → 답 */}
        <p className="mt-4 text-label font-bold text-reward">타이틀미션 이야기 {day}/3</p>
        <h4 className="mt-1 text-heading font-black leading-snug text-foreground">{lesson.hook}</h4>
        <p className="mt-2 text-body font-black leading-snug text-primary">{lesson.answer}</p>
        {lesson.bridge && <p className="mt-2 text-label leading-relaxed text-muted-foreground">{lesson.bridge}</p>}

        {/* 숫자로 보기 (3편) */}
        {lesson.numbers && (
          <div className="mt-4 rounded-xl bg-reward/10 p-3.5">
            <p className="text-label font-black text-foreground">숫자로 보면</p>
            <ul className="mt-1.5 space-y-1">
              {lesson.numbers.map((t, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-label leading-snug",
                    i === lesson.numbers!.length - 1 ? "font-black text-foreground" : "text-foreground",
                  )}
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 연구로 보면 */}
        <div className="mt-4 rounded-xl bg-secondary/70 p-3.5">
          <p className="text-label font-black text-foreground">연구로 보면</p>
          <ol className="mt-2 space-y-2.5">
            {lesson.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-reward/20 text-micro font-black text-reward">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-label leading-snug text-foreground">{p.text}</span>
                  <span className="mt-0.5 block text-micro text-muted-foreground">{p.by}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* 체육관에서는 */}
        <div className="mt-3 rounded-xl p-3.5 ring-1 ring-border/70">
          <p className="text-label font-black text-foreground">🥊 체육관에서는</p>
          {day === 1 && chunks.length > 0 && (
            <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="9동작 외우는 말">
              {chunks.map((c, i) => (
                <li key={i} className="rounded-full bg-secondary px-2.5 py-1 text-label font-bold text-foreground">
                  {c}
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-2 space-y-1.5">
            {lesson.gym.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-label leading-snug text-foreground">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 오늘 해 볼 것 — 하나 */}
        <div className="mt-3 rounded-xl bg-primary/10 px-3.5 py-3">
          <p className="text-label font-black text-primary">오늘 해 볼 것</p>
          <p className="mt-0.5 text-label font-bold leading-snug text-foreground">{fillWho(lesson.action.text, who)}</p>
          {lesson.action.kind === "partner" && (
            <button
              type="button"
              onClick={() => navigate("/myboxer/community?together=1")}
              className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-label font-bold text-primary-foreground transition-transform active:scale-95"
            >
              <Users className="h-3.5 w-3.5" /> 오늘 같이 해요에 미트 파트너 구하기 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {day === 3 && <p className="mt-3 text-center text-label font-black text-muted-foreground">153 건강과 행복</p>}

        {/* 출처 */}
        <button
          type="button"
          onClick={() => setShowSources((v) => !v)}
          aria-expanded={showSources}
          className="mt-3 inline-flex h-8 items-center gap-1 text-micro font-bold text-muted-foreground"
        >
          연구 출처 <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSources && "rotate-180")} />
        </button>
        {showSources && (
          <ul className="space-y-1 pb-1">
            {lesson.sources.map((s, i) => (
              <li key={i} className="break-words text-micro leading-snug text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        )}

        {/* 앞 · 다음 편 */}
        <div className="mt-2 flex items-center justify-between gap-2">
          {prev ? (
            <button
              type="button"
              onClick={() => pick(prev)}
              className="inline-flex h-9 items-center gap-0.5 rounded-full px-2 text-label font-bold text-muted-foreground active:scale-95"
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
              className="inline-flex h-9 items-center gap-0.5 rounded-full bg-secondary px-3.5 text-label font-bold text-foreground active:scale-95"
            >
              다음 이야기 · {lessonFor(next).tab} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TitleTeachTab;
