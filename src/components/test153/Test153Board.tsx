/**
 * 🏃 153 PB (Personal Best · 내 최고 기록) — 랭킹 화면 '153 PB' 칸 (2026-10-15 대표님: "기록을 체크하고 본인의 기록이 얼마나 좋아졌는지")
 *   2026-10-18 이름 153 TEST → 153 PB · "복싱은 상대방을 이기기 위해 자신과의 싸움에서 승리해야 한다는 메시지도 함께"
 *   · 내 기록: 개인 최고(PB) · 순위(우리 지점 / 전체) · 첫 기록보다 얼마나 빨라졌는지 · 구간별 최고 vs 최근 · 지난 기록
 *   · 순위: 부문(스타터/오픈) · 우리 지점/전체 · 성별 · 연령대
 *   · 안내 (2026-10-18 대표님: "자신과의 싸움 — 마라토너가 자신의 기록 1초를 당기기 위해 노력하는 것처럼 …
 *     이 방향성을 회원님들이 알 수 있도록 그 탭에 설명 자세히, 어떤 동작을 어떻게 하고 어떻게 평가하는지도")
 *     맨 위 '상대는 지난번의 나' 카드 → 맨 아래 안내(왜 하나요 · 진행 · 동작별 하는 법·인정 기준 · 평가 · 1초 당기는 법)
 *     내 기록에는 '다음 목표'(PB보다 1초 빠르게)를 보인다.
 *   기록은 코치가 관리자 홈 '153 PB 측정'에서 잰 공식 기록만 (회원이 직접 넣는 길은 없다).
 */
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Gauge, PenLine, Timer, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MedalMark from "@/components/MedalMark";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  buildSegments,
  DIVISION_LABEL,
  fmtMs,
  fmtScore,
  stationReps,
  TEST153_AGE_GROUPS,
  TEST153_NAME,
  TEST153_NAME_EN,
  TEST153_NAME_KO,
  TEST153_RUN_GUIDE,
  TEST153_STATIONS,
  type Test153Division,
} from "@/lib/test153";
import { fetchTest153Ranking, fetchTest153Summary } from "@/services/test153Service";

type GuideKey = "why" | "flow" | "moves" | "score" | "tips";

const PILLARS = [
  { icon: Gauge, title: "알기", desc: "내 체력을 숫자로 정확히" },
  { icon: PenLine, title: "기록", desc: "코치님이 잰 공식 기록" },
  { icon: Trophy, title: "이기기", desc: "1초라도 당기면 승리" },
] as const;

/** 안내 문단 — 굵은 제목 + 설명 */
const Point = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <li>
    <b className="text-foreground">{title}</b>
    <span className="block">{children}</span>
  </li>
);

/** 동작 카드 — 하는 법 · 인정 기준 · 요령 */
const MoveCard = ({
  no,
  name,
  reps,
  howTo,
  standard,
  tip,
  boxing,
}: {
  no: string;
  name: string;
  reps: React.ReactNode;
  howTo: string;
  standard: string;
  tip: string;
  boxing?: boolean;
}) => (
  <li className="rounded-xl border border-border bg-background/60 p-3">
    <div className="flex items-baseline justify-between gap-2">
      <p className="min-w-0 text-sm font-black text-foreground">
        {no && <span className="mr-1 text-primary">{no}</span>}
        {name}
        {boxing && " 🥊"}
      </p>
      <p className="shrink-0 text-right text-xs font-bold tabular-nums text-foreground">{reps}</p>
    </div>
    <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/90">{howTo}</p>
    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
      <span className="mr-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-black text-primary">인정</span>
      {standard}
    </p>
    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
      <span className="mr-1.5 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10.5px] font-black text-amber-700 dark:text-amber-300">
        요령
      </span>
      {tip}
    </p>
  </li>
);

interface Props {
  onOpenMember?: (m: { id: string; nickname: string }) => void;
}

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "numeric", day: "numeric" });

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors active:scale-95",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
    )}
  >
    {children}
  </button>
);

const Test153Board = ({ onOpenMember }: Props) => {
  const { user, profile } = useAuth();
  const myBranch = profile?.branch_name ?? null;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["test153", "summary", user?.id],
    enabled: !!user,
    queryFn: () => fetchTest153Summary(),
  });

  const hasOpen = !!summary?.best.open;
  const hasStarter = !!summary?.best.starter;
  const [divPick, setDivPick] = useState<Test153Division | null>(null);
  const division: Test153Division = divPick ?? (hasOpen || !hasStarter ? "open" : "starter");

  const [scope, setScope] = useState<"branch" | "all">("branch");
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);

  // 안내 — 위 카드·빈 기록 칸의 버튼이 해당 칸을 열고 그 자리로 내려간다
  const [guideOpen, setGuideOpen] = useState<string[]>([]);
  const guideRef = useRef<HTMLElement | null>(null);
  const openGuide = (key: GuideKey) => {
    setGuideOpen((v) => (v.includes(key) ? v : [...v, key]));
    // 펼쳐지는 애니메이션(0.2초)이 끝나 페이지가 길어진 뒤에 내려가야 안내 제목이 맨 위에 온다
    window.setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 230);
  };

  const { data: ranking = [], isLoading: rankLoading } = useQuery({
    queryKey: ["test153", "ranking", division, scope, myBranch, gender, age],
    enabled: !!user,
    queryFn: () =>
      fetchTest153Ranking({ division, branch: scope === "branch" ? myBranch : null, gender, age, limit: 100 }),
  });

  const segments = useMemo(() => buildSegments(division), [division]);
  const best = summary?.best[division];
  const rank = summary?.rank[division];
  const divRecords = useMemo(
    () => (summary?.records ?? []).filter((r) => r.division === division),
    [summary?.records, division],
  );
  const first = divRecords.length ? divRecords[divRecords.length - 1] : null;
  const latest = divRecords[0] ?? null;
  const improvedMs = first && best && first.id !== best.id && first.finished && best.finished ? first.score_ms - best.score_ms : 0;

  // 다음 목표 — 완주했으면 PB보다 1초, 타임캡이면 남은 개수 1개 줄이기
  const capLeft = best && !best.finished ? best.remaining_reps ?? 0 : 0;
  const nextGoal = !best
    ? null
    : best.finished
      ? { value: fmtMs(Math.max(0, best.score_ms - 1000)), hint: "PB보다 1초만 빠르게" }
      : capLeft > 1
        ? { value: `캡 + ${capLeft - 1}개`, hint: "남은 개수 1개 줄이기" }
        : { value: "25분 안에 완주", hint: "이제 완주가 목표" };

  return (
    <div className="space-y-4">
      {/* 방향 — 153 PB (Personal Best)(내 최고 기록) · 상대는 지난번의 나 · 복싱은 먼저 나와의 싸움에서 이긴다 */}
      <section className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-elev-1">
        <div className="flex items-start gap-2">
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-2xl font-black leading-none tracking-tight text-primary">{TEST153_NAME}</p>
            <p className="mt-1 text-[11.5px] font-bold text-muted-foreground">
              ({TEST153_NAME_EN}) ({TEST153_NAME_KO})
            </p>
          </div>
        </div>
        <h2 className="mt-3 text-xl font-black leading-tight text-foreground [text-wrap:balance]">상대는 지난번의 나</h2>
        <p className="mt-2 border-l-[3px] border-primary pl-3 text-[13.5px] font-bold leading-relaxed text-foreground">
          복싱은 상대를 이기기 위해, 먼저 나와의 싸움에서 이겨야 하는 운동이에요.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          마라토너가 지난 기록에서 1초를 당기려고 달리듯, 내 체력을 정확히 재고 기록해서{" "}
          <b className="text-foreground">지난번의 나를 이기는</b> 체력 평가예요.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="min-w-0 rounded-2xl bg-background/70 px-2.5 py-2">
              <p.icon className="h-4 w-4 text-primary" />
              <p className="mt-1 text-xs font-black text-foreground">{p.title}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openGuide("flow")}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-border bg-card py-2 text-xs font-bold text-foreground active:scale-[0.98]"
        >
          어떻게 하고 어떻게 평가하는지 보기
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </section>

      {/* 부문 */}
      <div className="flex gap-2">
        {(["open", "starter"] as const).map((d) => (
          <Chip key={d} active={division === d} onClick={() => setDivPick(d)}>
            {DIVISION_LABEL[d]}
          </Chip>
        ))}
      </div>

      {/* 내 기록 */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-elev-1">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <p className="text-sm font-black text-foreground">
            내 {TEST153_NAME} · {DIVISION_LABEL[division]}
          </p>
        </div>

        {isLoading ? (
          <div className="mt-3 h-24 animate-pulse rounded-2xl bg-muted/40" />
        ) : !best ? (
          <div className="mt-3 rounded-2xl bg-muted/30 p-4 text-center">
            <p className="text-sm font-bold text-foreground">아직 {DIVISION_LABEL[division]} 공식 기록이 없어요</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              체육관에서 코치님께 “{TEST153_NAME} 도전할게요” 하면 코치님이 시간을 재서 기록해 줘요.
              <br />
              처음이면 스타터부터 추천해요. 첫 기록이 앞으로 이겨야 할 ‘지난번의 나’가 돼요.
            </p>
            <button
              type="button"
              onClick={() => openGuide("moves")}
              className="mt-3 rounded-xl border border-primary/40 bg-card px-3 py-1.5 text-xs font-bold text-primary active:scale-[0.98]"
            >
              동작별 하는 법 먼저 보기
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{TEST153_NAME_KO} (PB)</p>
                <p className="text-4xl font-black tabular-nums text-foreground">{fmtScore(best)}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(best.measured_at)}</p>
              </div>
              {rank && (
                <div className="text-right">
                  {rank.branch != null && (
                    <p className="text-sm font-black text-primary">
                      우리 지점 {rank.branch}위 <span className="font-medium text-muted-foreground">/ {rank.branch_total}명</span>
                    </p>
                  )}
                  {rank.all != null && (
                    <p className="text-xs font-bold text-foreground">
                      전체 {rank.all}위 <span className="font-medium text-muted-foreground">/ {rank.all_total}명</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {improvedMs > 0 && first && (
              <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                📈 첫 기록({fmtMs(first.score_ms)})보다 {(improvedMs / 1000).toFixed(1)}초 빨라졌어요 (
                {((improvedMs / first.score_ms) * 100).toFixed(1)}%)
              </p>
            )}

            {/* 다음 목표 — 지난번의 나보다 1초 */}
            {nextGoal && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">다음 목표</span>
                  <span className="block text-[11px] text-muted-foreground">{nextGoal.hint}</span>
                </span>
                <span className="shrink-0 text-lg font-black tabular-nums text-primary">{nextGoal.value}</span>
              </div>
            )}

            {/* 구간별 최고 vs 최근 */}
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">
                구간 기록 · 최고{latest && latest.id !== best.id ? " vs 최근" : ""}
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border text-[13px]">
                {segments.map((s, i) => {
                  const b = best.splits_ms[i];
                  const l = latest && latest.id !== best.id ? latest.splits_ms[i] : undefined;
                  if (b == null && l == null) return null;
                  const diff = b != null && l != null ? l - b : null;
                  return (
                    <li key={s.index} className="flex items-center gap-2 px-3 py-1.5">
                      <span className={cn("min-w-0 flex-1 truncate", s.kind === "run" ? "text-muted-foreground" : "text-foreground")}>
                        {s.kind === "run" ? `셀트런 ${s.round}` : `${s.round}. ${s.short}`}
                      </span>
                      <span className="tabular-nums font-semibold text-foreground">{b != null ? fmtMs(b) : "—"}</span>
                      {l != null && (
                        <span
                          className={cn(
                            "w-16 text-right tabular-nums text-xs",
                            diff != null && diff > 0 ? "text-destructive" : "text-primary",
                          )}
                        >
                          {diff != null ? `${diff > 0 ? "+" : ""}${(diff / 1000).toFixed(1)}s` : fmtMs(l)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 지난 기록 */}
            {divRecords.length > 1 && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">지난 기록 {divRecords.length}번</p>
                <ul className="space-y-1 text-[13px]">
                  {divRecords.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {fmtDate(r.measured_at)} · {r.coach_name}
                      </span>
                      <span className={cn("tabular-nums font-bold", r.id === best.id ? "text-primary" : "text-foreground")}>
                        {fmtScore(r)} {r.id === best.id && "🏆"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* 순위 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-foreground">{DIVISION_LABEL[division]} 순위</h3>
          <div className="flex gap-1.5">
            <Chip active={scope === "branch"} onClick={() => setScope("branch")}>
              우리 지점
            </Chip>
            <Chip active={scope === "all"} onClick={() => setScope("all")}>
              전체
            </Chip>
          </div>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={gender === null} onClick={() => setGender(null)}>
            남녀 전체
          </Chip>
          <Chip active={gender === "남"} onClick={() => setGender("남")}>
            남
          </Chip>
          <Chip active={gender === "여"} onClick={() => setGender("여")}>
            여
          </Chip>
          <span className="mx-1 w-px shrink-0 bg-border" />
          <Chip active={age === null} onClick={() => setAge(null)}>
            전 연령
          </Chip>
          {TEST153_AGE_GROUPS.map((a) => (
            <Chip key={a} active={age === a} onClick={() => setAge(a)}>
              {a}
            </Chip>
          ))}
        </div>

        {rankLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {ranking.map((r, i) => {
              const me = r.r_user_id === user?.id;
              return (
                <li key={r.r_user_id} className={cn(i > 0 && "border-t border-border", me && "bg-primary/10")}>
                  <button
                    type="button"
                    onClick={() => onOpenMember?.({ id: r.r_user_id, nickname: r.r_nickname })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary/40"
                  >
                    <span
                      className={cn(
                        "w-7 text-center text-sm font-black tabular-nums",
                        r.r_position === 1 ? "text-amber-500" : r.r_position <= 3 ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {r.r_position <= 3 ? ["🥇", "🥈", "🥉"][r.r_position - 1] : r.r_position}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">
                        {r.r_nickname}
                        <MedalMark userId={r.r_user_id} className="ml-1 text-sm" />
                        {me && <span className="ml-1 text-xs text-primary">나</span>}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {[scope === "all" ? shortBranch(r.r_branch_name) : null, r.r_gender, r.r_age_group, fmtDate(r.r_measured_at)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="tabular-nums text-sm font-black text-foreground">
                      {fmtScore({ finished: r.r_finished, score_ms: r.r_score_ms, remaining_reps: r.r_remaining_reps })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 안내 — 왜 하나요 · 진행 · 동작별 하는 법 · 평가 · 1초 당기는 법 */}
      <section ref={guideRef} className="scroll-mt-20 space-y-2">
        <h3 className="text-base font-black text-foreground">{TEST153_NAME} 안내</h3>
        <Accordion
          type="multiple"
          value={guideOpen}
          onValueChange={setGuideOpen}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <AccordionItem value="why" className="border-border px-4 last:border-b-0">
            <AccordionTrigger className="py-3 text-left text-sm font-bold text-foreground hover:no-underline">
              왜 하나요? — 나와의 싸움
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <p>
                복싱은 상대를 이기기 위해, 먼저 <b className="text-foreground">나와의 싸움</b>에서 이겨야 하는 운동이에요. 숨이 턱까지
                차도 가드를 올리고, 다리가 무거워도 한 발 더 나가는 힘 — 링 위에서 상대를 이기는 힘은 거기서 나와요.
              </p>
              <p>
                마라토너도 옆 사람이 아니라 지난번 자기 기록에서 <b className="text-foreground">1초</b>를 당기려고 달려요.{" "}
                {TEST153_NAME}도 같아요 — 이 평가의 상대는 단 한 명, <b className="text-foreground">지난번의 나</b>예요. 그래서 이름도{" "}
                <b className="text-foreground">{TEST153_NAME}</b>({TEST153_NAME_EN} · {TEST153_NAME_KO})예요.
              </p>
              <ol className="space-y-2">
                <Point title="① 내 체력을 정확히 알아요">
                  달리기 · 근력 · 복싱 스텝 · 줄넘기를 한 번에 재서, 어디가 강하고 어디가 약한지 구간 16개의 기록으로 보여 줘요.
                </Point>
                <Point title="② 기록으로 남겨요">
                  코치님이 잰 공식 기록만 쌓여요. 느낌이 아니라 숫자로, 첫 기록부터 지금까지 얼마나 좋아졌는지 알 수 있어요.
                </Point>
                <Point title="③ 나를 이겨요">
                  순위는 참고예요. 지난 기록보다 1초라도 빠르면, 그날은 내가 이긴 날이에요. 나를 이긴 만큼 링 위의 상대도 이길 수
                  있어요.
                </Point>
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="flow" className="border-border px-4 last:border-b-0">
            <AccordionTrigger className="py-3 text-left text-sm font-bold text-foreground hover:no-underline">
              어떻게 진행되나요?
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <p>
                모두 같은 운동을 같은 순서로 해요. <b className="text-foreground">8라운드</b> — 매 라운드{" "}
                <b className="text-foreground">셀트런 100m</b>를 달리고 바로 <b className="text-foreground">종목 하나</b>를 해요.
              </p>
              <ol className="grid grid-cols-2 gap-1.5">
                {TEST153_STATIONS.map((s, i) => (
                  <li key={s.name} className="flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 text-xs">
                    <span className="shrink-0 font-black tabular-nums text-primary">{i + 1}R</span>
                    <span className="truncate font-bold text-foreground">{s.name}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs">각 라운드 = 셀트런 100m → 위 종목. 8라운드 줄넘기까지 끝내면 완주예요.</p>
              <ul className="space-y-2">
                <Point title="시계는 멈추지 않아요">
                  첫 셀트런 출발부터 마지막 줄넘기까지 한 번에 재요. 숨 고르는 시간도 기록에 들어가요.
                </Point>
                <Point title="타임캡 25분">
                  25분이 되면 멈춰요. 다 못 끝내도 괜찮아요 — 거기까지가 오늘의 기록이고, 다음에 이길 ‘지난번의 나’예요.
                </Point>
                <Point title="오픈 · 스타터">
                  오픈은 기본 개수, 스타터는 모든 개수가 절반이에요(셀트런 거리는 같고, 푸시업은 무릎을 대도 돼요). 처음이면
                  스타터부터 추천해요.
                </Point>
                <Point title="재는 법">
                  체육관에서 코치님께 “{TEST153_NAME} 도전할게요” 하면 코치님이 옆에서 시간을 재고 개수를 세요. 회원이 직접 기록을
                  넣는 방법은 없어서 모든 기록이 공평해요.
                </Point>
                <Point title="안전이 먼저">어지럽거나 가슴이 아프면 바로 멈추고 코치님께 말해요. 기록보다 몸이 먼저예요.</Point>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="moves" className="border-border px-4 last:border-b-0">
            <AccordionTrigger className="py-3 text-left text-sm font-bold text-foreground hover:no-underline">
              동작별 하는 법 · 인정 기준
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <p>
                기준을 안 지키면 코치님이 <b className="text-foreground">“노렙(No rep)”</b> — 그 한 번은 개수에 안 들어가요. 오른쪽
                숫자는 오픈 개수, 아래는 스타터 개수예요.
              </p>
              <ul className="space-y-2">
                <MoveCard
                  no=""
                  name={TEST153_RUN_GUIDE.name}
                  reps={
                    <>
                      매 라운드 8번
                      <span className="block text-[11px] font-medium text-muted-foreground">스타터도 같아요</span>
                    </>
                  }
                  howTo={TEST153_RUN_GUIDE.howTo}
                  standard={TEST153_RUN_GUIDE.standard}
                  tip={TEST153_RUN_GUIDE.tip}
                />
                {TEST153_STATIONS.map((s, i) => (
                  <MoveCard
                    key={s.name}
                    no={`${i + 1}`}
                    name={s.name}
                    reps={
                      <>
                        {s.open}
                        {s.unit}
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          스타터 {stationReps(s, "starter")}
                          {s.unit}
                        </span>
                      </>
                    }
                    howTo={s.howTo}
                    standard={s.standard}
                    tip={s.tip}
                    boxing={s.boxing}
                  />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="score" className="border-border px-4 last:border-b-0">
            <AccordionTrigger className="py-3 text-left text-sm font-bold text-foreground hover:no-underline">
              어떻게 평가하나요?
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <ul className="space-y-2">
                <Point title="기록 = 걸린 시간">첫 셀트런 출발부터 마지막 줄넘기까지 걸린 시간이에요. 짧을수록 좋은 기록이에요.</Point>
                <Point title="구간 기록 16개">
                  구간이 끝날 때마다 코치님이 눌러서 셀트런 8번과 종목 8개의 시간이 따로 남아요. 다시 재면 구간마다 몇 초
                  줄었는지 · 늘었는지 보여 줘요.
                </Point>
                <Point title="타임캡 기록 ‘캡 + 남은 개수’">
                  25:00까지 못 끝내면 남은 개수로 기록해요. 남은 개수 = 하던 구간에서 남은 개수 + 그 뒤 구간 전부(셀트런 1번은
                  10개로 세요).
                </Point>
                <li className="rounded-xl bg-muted/40 px-3 py-2 text-xs">
                  예) 오픈에서 25:00에 7라운드 런지가 10걸음 남았다면 → 10 + 셀트런 10 + 줄넘기 200 ={" "}
                  <b className="whitespace-nowrap text-foreground">캡 + 220개</b>
                </li>
                <Point title="누가 앞인가요?">
                  완주한 기록은 언제나 캡 기록보다 앞이에요. 완주끼리는 시간이 짧을수록, 캡끼리는 남은 개수가 적을수록 앞이에요.
                </Point>
                <Point title={`PB (${TEST153_NAME_EN} · ${TEST153_NAME_KO})`}>
                  부문마다 가장 좋은 기록이 내 PB예요. 새 기록이 PB보다 좋으면 PB가 바뀌어요 — 그 순간이 지난번의 나를 이긴
                  거예요.
                </Point>
                <Point title="얼마나 좋아졌나">
                  첫 기록과 PB를 비교해서 몇 초(몇 %) 빨라졌는지 보여 줘요. 다음 목표는 언제나 PB보다 1초 빠르게.
                </Point>
                <Point title="오픈 · 스타터는 따로">기록도 순위도 따로 매겨요. 스타터가 편해지면 오픈에 도전해 보세요.</Point>
                <Point title="순위는 참고">
                  회원마다 부문별 PB 하나로 줄을 세워요. 우리 지점 · 전체, 성별, 연령대로 볼 수 있어요. 코치님 등 운영진 계정은
                  순위에 들어가지 않아요.
                </Point>
                <Point title="잘못 잰 기록">코치님이 7일 안에 취소할 수 있어요.</Point>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tips" className="border-border px-4 last:border-b-0">
            <AccordionTrigger className="py-3 text-left text-sm font-bold text-foreground hover:no-underline">
              1초 당기는 법
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <ol className="space-y-2">
                <Point title="1. 페이스를 나눠요">
                  처음부터 전력은 금물이에요. 첫 셀트런과 마지막 셀트런 시간이 비슷하면 잘 나눈 거예요.
                </Point>
                <Point title="2. 약한 구간을 찾아요">
                  지난번보다 늘어난 구간, 유난히 오래 걸린 종목이 다음 숙제예요. 수업 때 그 종목을 더 연습해요.
                </Point>
                <Point title="3. 미리 끊어 쉬어요">
                  힘이 다 빠질 때까지 버티지 말고, 힘이 남았을 때 짧게 끊어 쉬면 전체 시간이 줄어요.
                </Point>
                <Point title="4. 노렙을 줄여요">
                  노렙 한 번은 그만큼 더 해야 하는 시간이에요. 기준대로 정확히 하는 게 가장 빠른 길이에요.
                </Point>
                <Point title="5. 4주 이상 훈련하고 다시 재요">
                  자주 재는 것보다 꾸준히 운동하고 4~6주 뒤에 재야 변화가 잘 보여요.
                </Point>
                <Point title="6. 컨디션을 맞춰요">잘 자고, 식사는 2시간쯤 전에 하고, 몸을 충분히 풀고 시작해요.</Point>
              </ol>
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-[13px] font-bold text-primary">
                순위가 내려가도 PB가 1초 줄었다면, 오늘은 이긴 날이에요. 나를 이긴 만큼 링 위에서도 강해져요. 🏆
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
};

export default Test153Board;
