/**
 * 📊 영상으로 배우기 데이터 창 — 대표님 · 운영진 (2026-11-15 대표님 「다음 4단계진행」 4단계)
 *
 *   기간(지난 7일 · 지난 4주 · 1년) · 지점 → 한눈에(본 회원 · 끝까지 · 담기 · 반응 · 리그별) →
 *   「다음 촬영 목록」(회원용 영상이 없는 카드 + 찾았는데 없는 동작 · 맨 위 5개 추천 · 목록 복사) →
 *   「줄 세우기」(본 회원 · 끝까지 · 담기 · ♥ · 어려워요 · 의견 · 영상 요청) → 새 의견(전략 회의에서 답하기) →
 *   「카드에 숫자 붙이기」 스위치. 사람 수만(이름 없음) · 회원 줄만. 월요일 요약 알림(?data=1)도 이 창으로 연다.
 *   계산은 lib/cardData · 숫자는 services/cardDataService.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";
import {
  DATA_PERIODS,
  FILM_PICK,
  METRICS,
  filmListText,
  filmPlan,
  leagueLine,
  metricText,
  periodLabel,
  rankBy,
  statParts,
  totalsLeagueLine,
  type CardStats,
  type FilmTarget,
  type Metric,
} from "@/lib/cardData";
import { Toggle } from "./ShelfEditUi";

const shortBranch = (b: string) => b.replace(/^153복싱짐\s*/, "");
/** 다음 촬영 목록 — 처음엔 추천 5개 + 하나 */
const FILM_SHOWN = FILM_PICK + 1;

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn(
      "flex h-10 shrink-0 items-center rounded-full border px-3.5 text-label font-bold transition-transform active:scale-95",
      on ? "border-transparent bg-foreground text-background" : "border-border bg-card text-foreground",
    )}
  >
    {children}
  </button>
);

export default function ShelfDataSheet({
  open,
  onClose,
  days,
  onDays,
  branch,
  onBranch,
  stats,
  loading,
  error,
  nameOf,
  targets,
  matchQuery,
  tileNumbers,
  onTileNumbers,
  onOpenItem,
  onOpenOpinions,
}: {
  open: boolean;
  onClose: () => void;
  days: number;
  onDays: (d: number) => void;
  branch: string | null;
  onBranch: (b: string | null) => void;
  stats: CardStats | null;
  loading: boolean;
  error: string | null;
  /** 'c:<카드>' · 'm:<미션>' → 이름 */
  nameOf: (key: string) => string;
  /** 회원에게 보이는 카드 — 다음 촬영 목록 */
  targets: ReadonlyMap<string, FilmTarget>;
  matchQuery: (q: string) => FilmTarget | null;
  tileNumbers: boolean;
  onTileNumbers: (v: boolean) => void;
  onOpenItem: (key: string) => void;
  onOpenOpinions: () => void;
}) {
  const [metric, setMetric] = useState<Metric>("viewers");
  const [filmAll, setFilmAll] = useState(false);
  const plan = useMemo(() => (stats ? filmPlan(stats, { targets, matchQuery }) : []), [stats, targets, matchQuery]);
  const ranked = useMemo(() => (stats ? rankBy(stats.list, metric) : []), [stats, metric]);
  const t = stats?.totals;
  const label = periodLabel(days);

  const copyPlan = async () => {
    const text = filmListText(plan, label, branch);
    try {
      if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      toast.success("촬영 목록을 복사했어요", { description: "코치님 단톡방 · 전략 회의에 붙여 넣으면 돼요" });
    } catch {
      toast.error("복사하지 못했어요");
    }
  };

  const summary = t
    ? [
        t.completers ? `끝까지 본 회원 ${t.completers}명` : null,
        t.savers ? `담은 회원 ${t.savers}명` : null,
        t.reactors ? `반응 남긴 회원 ${t.reactors}명` : null,
        t.askers ? `찾기 · 요청 ${t.askers}명` : null,
      ].filter((x): x is string => !!x)
    : [];
  const leagues = t ? totalsLeagueLine(t) : null;

  return (
    <DmSheet backClose
      open={open}
      onClose={onClose}
      title="영상으로 배우기 데이터"
      subtitle={`회원 기준 · 사람 수만 (이름 없음)${stats?.demo ? " · 예시 숫자" : ""}`}
      tall
    >
      <div className="space-y-5 pb-4">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {DATA_PERIODS.map((p) => (
              <Chip key={p.days} on={days === p.days} onClick={() => onDays(p.days)}>
                {p.label}
              </Chip>
            ))}
          </div>
          {stats && stats.branches.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip on={!branch} onClick={() => onBranch(null)}>
                전 지점
              </Chip>
              {stats.branches.map((b) => (
                <Chip key={b} on={branch === b} onClick={() => onBranch(b)}>
                  {shortBranch(b)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {loading && !stats && <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">숫자를 모으는 중…</p>}
        {error && !stats && <p className="rounded-2xl bg-destructive/10 px-4 py-4 text-body text-destructive">{error}</p>}

        {stats && t && (
          <>
            {/* 한눈에 */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="text-label font-bold text-muted-foreground">
                {label}
                {branch ? ` · ${shortBranch(branch)}` : " · 전 지점"}
              </p>
              {t.members > 0 ? (
                <p className="mt-1 text-body font-bold text-foreground">
                  <span className="text-display font-black">{t.members}</span>명이 카드를 봤어요
                </p>
              ) : (
                <p className="mt-1 text-body text-muted-foreground">이 기간에는 아직 카드를 연 회원이 없어요</p>
              )}
              {summary.length > 0 && <p className="mt-2 text-label text-muted-foreground">{summary.join(" · ")}</p>}
              {leagues && <p className="mt-1 text-label text-muted-foreground">본 회원 리그별 · {leagues}</p>}
            </section>

            {/* 다음 촬영 목록 */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-heading font-black text-foreground">다음 촬영 목록</h3>
                {plan.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void copyPlan()}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-label font-bold text-foreground active:scale-95"
                  >
                    <Copy className="h-4 w-4" aria-hidden /> 목록 복사
                  </button>
                )}
              </div>
              <p className="text-label text-muted-foreground">회원용 영상이 없는 카드 · 찾았는데 없는 동작 — 점수 순 · 맨 위 {FILM_PICK}개 추천</p>
              {plan.length === 0 ? (
                <p className="rounded-2xl bg-secondary px-4 py-4 text-body text-muted-foreground">영상 요청 · 찾기 기록이 쌓이면 여기에 촬영할 동작이 줄을 서요</p>
              ) : (
                <ol className="space-y-2">
                  {(filmAll ? plan : plan.slice(0, FILM_SHOWN)).map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={!c.key}
                        onClick={() => c.key && onOpenItem(c.key)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left transition-transform enabled:active:scale-[0.99]",
                          c.recommended ? "border-primary/40" : "border-border",
                        )}
                      >
                        <span className={cn("w-6 shrink-0 text-center text-heading font-black", c.recommended ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-body font-bold text-foreground">{c.name}</span>
                            {c.recommended && (
                              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-micro font-bold text-primary-foreground">추천</span>
                            )}
                            {c.kind === "query" && (
                              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-micro font-bold text-muted-foreground">찾은 말</span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-label text-muted-foreground">{c.reasons.join(" · ")}</span>
                        </span>
                        {c.key && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {plan.length > FILM_SHOWN && (
                <button
                  type="button"
                  onClick={() => setFilmAll((v) => !v)}
                  className="flex h-11 w-full items-center justify-center rounded-2xl bg-secondary text-label font-bold text-foreground active:scale-[0.99]"
                >
                  {filmAll ? "접기" : `촬영 목록 더 보기 · ${plan.length - FILM_SHOWN}개`}
                </button>
              )}
            </section>

            {/* 줄 세우기 */}
            <section className="space-y-2.5">
              <h3 className="text-heading font-black text-foreground">줄 세우기</h3>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {METRICS.map((m) => (
                  <Chip key={m.id} on={metric === m.id} onClick={() => setMetric(m.id)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
              {ranked.length === 0 ? (
                <p className="rounded-2xl bg-secondary px-4 py-4 text-body text-muted-foreground">
                  {metric === "complete" || metric === "hard" ? "3명 이상 모인 카드가 생기면 비율로 줄을 세워요" : "이 기간에 숫자가 있는 카드가 아직 없어요"}
                </p>
              ) : (
                <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {ranked.map((s, i) => {
                    const league = metric === "savers" ? leagueLine(s, "savers") : metric === "hard" ? leagueLine(s, "hard") : null;
                    const others = statParts(s).join(" · ");
                    return (
                      <li key={s.item}>
                        <button type="button" onClick={() => onOpenItem(s.item)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary">
                          <span className="w-5 shrink-0 text-label font-bold text-muted-foreground">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-bold text-foreground">{nameOf(s.item)}</span>
                            {others && <span className="block truncate text-label text-muted-foreground">{others}</span>}
                            {league && <span className="block truncate text-label text-muted-foreground">리그별 · {league}</span>}
                          </span>
                          <span className="shrink-0 text-heading font-black text-foreground">{metricText(s, metric)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* 새 의견 */}
            {t.opinions > 0 && (
              <button
                type="button"
                onClick={onOpenOpinions}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-left active:scale-[0.99]"
              >
                <span className="text-body font-bold text-foreground">
                  새 의견 {t.opinions}개{t.waiting ? ` · 답 기다려요 ${t.waiting}` : ""}
                </span>
                <span className="shrink-0 text-label font-bold text-primary">전략 회의에서 답하기 ›</span>
              </button>
            )}

            <Toggle
              label="카드에 숫자 붙이기"
              sub="영상으로 배우기 카드마다 본 회원 · 담기 · ♥ · 어려워요 — 대표님 · 운영진 화면에만"
              on={tileNumbers}
              onChange={onTileNumbers}
            />
            <p className="px-1 text-label text-muted-foreground">
              회원 줄만 세요(코치진 · 운영진 · 체험 계정 빼고) · 1년 지난 기록은 저절로 지워져요 · 월요일 아침에 지난주 요약이 알림으로 와요
            </p>
          </>
        )}

        {!loading && !error && !stats && (
          <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">이 서버에는 아직 데이터 기능이 없어요</p>
        )}
      </div>
    </DmSheet>
  );
}
