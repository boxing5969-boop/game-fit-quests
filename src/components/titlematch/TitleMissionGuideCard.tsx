/**
 * 🏆 타이틀 미션 동작 외우기 카드 — 타이틀매치 화면 '레벨 N 타이틀매치' 바로 밑 (2026-10-20 대표님).
 *
 *   화이트(레벨 10) · 블루(레벨 20) — 동작 외우기:
 *     총 몇 동작인지(주인공 숫자) → 소리 내어 외우는 말 → 덩어리별 순서(번호) →
 *     허리와 다리 회전 · 가드 · 밸런스 · 동작별 하는 법 · 심사에서 보는 것 · 외우는 방법(펼쳐 보기).
 *   레드(레벨 30) — 도전 순서:
 *     153 PB 22분(주인공 숫자) → 한 줄로 외우기 → ① 153 PB ② 1분 쉬기 ③ 연타 3번 ④ 미트 3번 받아주기 →
 *     파트너 규칙 → 153 PB 요령 · 1분 쉬는 동안 · 연타 · 미트 · 파트너 · 심사(펼쳐 보기).
 *   내용은 lib/titleMissionGuide.ts 한 곳 — 블랙은 아직 없어서 그리지 않는다.
 */
import { Link } from "react-router-dom";
import { ChevronRight, Clapperboard } from "lucide-react";
import {
  titleMissionCourseFor,
  titleMissionGuideFor,
  totalMoves,
  type TitleGuideSection,
  type TitleGuideSectionKey,
  type TitleMissionCourse,
  type TitleMissionGuide,
} from "@/lib/titleMissionGuide";

const SECTION_ICON: Record<TitleGuideSectionKey, string> = {
  rotation: "🌀",
  guard: "🛡️",
  balance: "⚖️",
  moves: "🥊",
  judge: "✅",
  memorize: "🧠",
  pb: "⏱️",
  rest: "💨",
  combo: "🥊",
  mitt: "🧤",
  partner: "🤝",
};

/** 153 PB 종목·개수·순위 — 랭킹 › 153 PB 탭 */
const PB_LINK = "/halloffame?tab=test153";

const CARD = "mt-4 overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60";

const TitleMissionGuideCard = ({ league }: { league: string }) => {
  const guide = titleMissionGuideFor(league);
  if (guide) return <MovesCard guide={guide} />;
  const course = titleMissionCourseFor(league);
  if (course) return <CourseCard course={course} />;
  return null;
};

/** 화이트 · 블루 — 동작 외우기 */
const MovesCard = ({ guide }: { guide: TitleMissionGuide }) => {
  const total = totalMoves(guide);
  const headingId = `title-guide-${guide.league}`;
  let n = 0;

  return (
    <section aria-labelledby={headingId} className={CARD}>
      {/* 머리 — 총 동작 수가 주인공 */}
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold text-muted-foreground">타이틀 미션 {guide.level} · 동작 외우기</p>
          <h3 id={headingId} className="mt-0.5 text-[16px] font-black leading-snug text-foreground">
            {guide.headline}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold text-muted-foreground">총</p>
          <p className="text-[30px] font-black leading-none tabular-nums text-foreground">
            {total}
            <span className="ml-0.5 text-[14px] font-black">동작</span>
          </p>
        </div>
      </div>

      {/* 소리 내어 외우는 말 */}
      <div className="mx-4 rounded-xl bg-secondary/70 px-3.5 py-3">
        <p className="text-[11.5px] font-black text-muted-foreground">소리 내어 외우는 말</p>
        <p className="mt-1 text-[14px] font-bold leading-relaxed text-foreground">“{guide.chant}”</p>
      </div>

      {/* 순서 — 덩어리별 */}
      <ol className="space-y-3 px-4 pt-4" aria-label={`동작 순서 ${total}개`}>
        {guide.groups.map((g) => (
          <li key={g.title}>
            <p className="text-[12.5px] font-black text-foreground">
              {g.title} <span className="font-bold text-muted-foreground">· {g.moves.length}동작</span>
            </p>
            <ol className="mt-1.5 flex flex-wrap gap-1.5">
              {g.moves.map((mv) => {
                n += 1;
                return (
                  <li
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[12.5px] font-bold text-foreground ring-1 ring-border"
                  >
                    <span className="text-[11px] font-black tabular-nums text-primary">{n}</span>
                    {mv.name}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>

      {guide.note && <p className="px-4 pt-3 text-[12px] font-semibold leading-relaxed text-primary">{guide.note}</p>}

      <Sections sections={guide.sections} />
      <HandNote />
    </section>
  );
};

/** 레드 — 도전 순서 (153 PB → 1분 → 연타 3번 → 미트 3번) */
const CourseCard = ({ course }: { course: TitleMissionCourse }) => {
  const headingId = `title-guide-${course.league}`;

  return (
    <section aria-labelledby={headingId} className={CARD}>
      {/* 머리 — 153 PB 통과 시간이 주인공 */}
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold text-muted-foreground">타이틀 미션 {course.level} · 도전 순서</p>
          <h3 id={headingId} className="mt-0.5 text-[16px] font-black leading-snug text-foreground">
            {course.headline}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold text-muted-foreground">{course.hero.label}</p>
          <p className="text-[30px] font-black leading-none tabular-nums text-foreground">
            {course.hero.value}
            <span className="ml-0.5 text-[14px] font-black">{course.hero.unit}</span>
          </p>
        </div>
      </div>

      {/* 한 줄로 외우기 */}
      <div className="mx-4 rounded-xl bg-secondary/70 px-3.5 py-3">
        <p className="text-[11.5px] font-black text-muted-foreground">한 줄로 외우기</p>
        <p className="mt-1 text-[14px] font-bold leading-relaxed text-foreground">“{course.chant}”</p>
      </div>

      {/* 순서 */}
      <ol className="space-y-3 px-4 pt-4" aria-label={`도전 순서 ${course.steps.length}단계`}>
        {course.steps.map((st, i) => (
          <li key={st.title} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-black tabular-nums text-background"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black leading-snug text-foreground">{st.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{st.detail}</p>
              {st.pending && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-[11.5px] font-bold text-muted-foreground">
                  <Clapperboard className="h-3.5 w-3.5 shrink-0" />
                  준비 중 · {st.pending}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* 파트너 규칙 */}
      <div className="mx-4 mt-4 rounded-xl bg-primary/10 px-3.5 py-3">
        <p className="text-[12.5px] font-black text-foreground">
          <span aria-hidden className="mr-1">
            🤝
          </span>
          파트너
        </p>
        <p className="mt-0.5 text-[13px] font-semibold leading-relaxed text-foreground">{course.partner}</p>
      </div>

      <Link
        to={PB_LINK}
        className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-background px-3.5 py-2.5 ring-1 ring-border transition-transform active:scale-[0.99]"
      >
        <span className="text-[13px] font-bold text-foreground">153 PB 종목 · 개수 · 내 기록 보기</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <Sections sections={course.sections} />
      <HandNote />
    </section>
  );
};

/** 자세히 — 펼쳐 보기 */
const Sections = ({ sections }: { sections: readonly TitleGuideSection[] }) => (
  <div className="mt-4 divide-y divide-border/70 border-t border-border/70">
    {sections.map((sec) => (
      <details key={sec.key} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-[15px]">
            {SECTION_ICON[sec.key]}
          </span>
          <span className="min-w-0 flex-1 text-[14px] font-bold text-foreground">{sec.title}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <ul className="space-y-1.5 px-4 pb-3.5">
          {sec.points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
              <span aria-hidden className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0">{p}</span>
            </li>
          ))}
        </ul>
      </details>
    ))}
  </div>
);

const HandNote = () => (
  <p className="border-t border-border/70 px-4 py-2.5 text-[11.5px] text-muted-foreground">
    오른손잡이(왼발 앞) 기준이에요 · 왼손잡이는 좌우를 바꿔요
  </p>
);

export default TitleMissionGuideCard;
