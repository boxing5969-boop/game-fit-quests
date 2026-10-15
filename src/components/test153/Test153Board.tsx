/**
 * 🏃 153 TEST — 랭킹 화면 '153 TEST' 칸 (2026-10-15 대표님: "기록을 체크하고 본인의 기록이 얼마나 좋아졌는지")
 *   · 내 기록: 개인 최고(PB) · 순위(우리 지점 / 전체) · 첫 기록보다 얼마나 빨라졌는지 · 구간별 최고 vs 최근 · 지난 기록
 *   · 순위: 부문(스타터/오픈) · 우리 지점/전체 · 성별 · 연령대
 *   · 종목과 인정 기준
 *   기록은 코치가 관리자 홈 '153 TEST 측정'에서 잰 공식 기록만 (회원이 직접 넣는 길은 없다).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Timer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  buildSegments,
  DIVISION_LABEL,
  fmtMs,
  fmtScore,
  stationReps,
  TEST153_AGE_GROUPS,
  TEST153_NAME,
  TEST153_STATIONS,
  type Test153Division,
} from "@/lib/test153";
import { fetchTest153Ranking, fetchTest153Summary } from "@/services/test153Service";

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
  const [showRules, setShowRules] = useState(false);

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

  return (
    <div className="space-y-4">
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
              체육관에서 코치님께 “153 TEST 재 주세요” 하면 코치님이 시간을 재서 기록해 줘요.
              <br />
              처음이면 스타터부터 추천해요.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">개인 최고 기록</p>
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

      {/* 종목·기준 */}
      <section className="rounded-2xl border border-border bg-muted/20">
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-bold text-foreground">{TEST153_NAME} 종목과 인정 기준</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showRules && "rotate-180")} />
        </button>
        {showRules && (
          <div className="space-y-2 px-4 pb-4 text-[13px] leading-relaxed">
            <p className="text-muted-foreground">
              매 라운드 <b className="text-foreground">셀트런 100m(10m × 10번) → 스테이션</b>, 8라운드. 모두 같은 일을 하고 걸린 시간으로
              겨뤄요. 타임캡 25분 — 못 끝내면 ‘25:00 + 남은 개수’. 스타터는 개수 절반.
            </p>
            <ol className="space-y-1.5">
              {TEST153_STATIONS.map((s, i) => (
                <li key={s.name}>
                  <b className="text-foreground">
                    {i + 1}. {s.name} {stationReps(s, division)}
                    {s.unit}
                  </b>
                  {s.boxing && " 🥊"}
                  <span className="block text-muted-foreground">{s.standard}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              원투는 세게 쳤는지가 아니라 팔을 끝까지 뻗고 가드로 돌아왔는지로만 세요. 기준을 안 지키면 코치님이 “노렙” — 그 한 번은 세지 않아요.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Test153Board;
