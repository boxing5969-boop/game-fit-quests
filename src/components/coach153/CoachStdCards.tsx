/**
 * 📈 153 기준 — 보여 주기만 하는 카드들 (자료는 props 로 — CoachStdSection 이 서버에서 받아 넘긴다)
 *   글씨 6단계만 · 카드마다 주인공 하나 · 빈 것은 그리지 않기 (CLAUDE.md 「회원 화면 리디자인」)
 */
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markTrend,
  pct,
  planPhase,
  sayLines,
  shortDay,
  weakestStd,
  weekPlan,
  type CoachStd,
  type GrowthPerson,
  type Observation,
  type StaffDisplay,
} from "@/lib/coachGrowth";

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section className={cn("rounded-3xl bg-card p-5 shadow-elev-1", className)}>{children}</section>
);

export const PrimaryButton = ({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-50",
      className,
    )}
  >
    {children}
  </button>
);

export const GhostButton = ({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn("flex h-11 items-center justify-center rounded-2xl bg-secondary px-4 text-label font-bold text-foreground active:scale-[0.98]", className)}
  >
    {children}
  </button>
);

export const Avatar = ({ person, size = 40 }: { person: StaffDisplay | null; size?: number }) =>
  person?.avatar_url ? (
    <img
      src={person.avatar_url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-secondary object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-label font-black text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {(person?.name ?? "?").slice(0, 1)}
    </span>
  );

export const stdTitle = (stds: CoachStd[], no: number | null | undefined) => stds.find((s) => s.no === no)?.title ?? "";

/** 주차 점 — 지난 주는 꽉 찬 점 · 이번 주는 큰 점 · 남은 주는 빈 점 */
export const WeekDots = ({ weeks, current }: { weeks: number; current: number }) => (
  <div className="flex items-center gap-1.5" aria-label={`${weeks}주 중 ${Math.max(0, current)}주차`}>
    {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
      <span
        key={w}
        className={cn(
          "h-2.5 rounded-full transition-all",
          w < current ? "w-2.5 bg-foreground" : w === current ? "w-7 bg-primary" : "w-2.5 bg-secondary",
        )}
      />
    ))}
  </div>
);

/* ───────────── 나의 4주 ───────────── */

export function MyWeeksCard({
  person,
  standards,
  onCheck,
}: {
  person: GrowthPerson;
  standards: CoachStd[];
  onCheck: () => void;
}) {
  const plan = person.plan;
  const phase = planPhase(plan);
  const stdNos = standards.map((s) => s.no);
  const weakest = weakestStd(Object.keys(person.obs ?? {}).length ? person.obs : person.self, stdNos);

  if (!plan || phase === "none") {
    return (
      <Card>
        <h3 className="text-heading font-black text-foreground">153 기준으로 수업해요</h3>
        <p className="mt-1 text-label text-muted-foreground">4주 과정은 대표님 · 지점장님이 시작해요</p>
        {person.checks_week > 0 && <p className="mt-3 text-body font-bold text-foreground">이번 주 1분 점검 {person.checks_week}번</p>}
        <PrimaryButton onClick={onCheck} className="mt-4">
          오늘 수업 점검
        </PrimaryButton>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <p className="text-label font-bold text-muted-foreground">153 코치 과정</p>
        <p className="mt-1 text-title font-black text-foreground">{plan.weeks}주 완료</p>
        <p className="mt-1 text-label text-muted-foreground">다섯 가지는 앞으로도 매 수업 그대로예요</p>
        <PrimaryButton onClick={onCheck} className="mt-4">
          오늘 수업 점검
        </PrimaryButton>
      </Card>
    );
  }

  const wp = weekPlan(phase === "before" ? 1 : Math.min(plan.week_no, plan.weeks), weakest);
  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-bold text-muted-foreground">나의 {plan.weeks}주</p>
          <p className="mt-0.5 text-title font-black text-foreground">
            {phase === "before" ? `${shortDay(plan.start_on)} 시작` : phase === "review" ? "돌아보기 차례" : `${plan.week_no}주차`}
          </p>
        </div>
        <WeekDots weeks={plan.weeks} current={phase === "review" ? plan.weeks + 1 : phase === "before" ? 0 : plan.week_no} />
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/70 p-4">
        <p className="text-label font-bold text-muted-foreground">
          {phase === "before" ? "1주차" : phase === "review" ? `${plan.weeks}주차` : "이번 주"} · {wp.theme}
        </p>
        <ul className="mt-2 space-y-1">
          {wp.focus.map((no) => (
            <li key={no} className="text-body font-bold text-foreground">
              {no}. {stdTitle(standards, no)}
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-3 space-y-1.5">
        {wp.todo.map((t) => (
          <li key={t} className="flex items-start gap-2 text-body text-foreground">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">{t}</span>
          </li>
        ))}
      </ul>

      {person.checks_week > 0 && <p className="mt-3 text-label font-bold text-foreground">이번 주 1분 점검 {person.checks_week}번</p>}
      <PrimaryButton onClick={onCheck} className="mt-4">
        오늘 수업 점검
      </PrimaryButton>
    </Card>
  );
}

/* ───────────── 받은 피드백 ───────────── */

const ObservationBody = ({ o, standards }: { o: Observation; standards: CoachStd[] }) => (
  <div className="space-y-2">
    {[o.good1, o.good2].filter(Boolean).map((g, i) => (
      <p key={i} className="flex items-start gap-2 text-body text-foreground">
        <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0">{g}</span>
      </p>
    ))}
    <div className="flex items-start gap-2 rounded-2xl bg-primary/10 p-3">
      <ArrowRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-body font-bold text-foreground">{o.fix1}</p>
        {o.fix_no ? <p className="mt-0.5 text-label text-muted-foreground">{o.fix_no}. {stdTitle(standards, o.fix_no)}</p> : null}
      </div>
    </div>
  </div>
);

const obsMeta = (o: Observation) =>
  [`${shortDay(o.class_on)}${o.class_hour != null ? ` ${o.class_hour}시` : ""} 수업`, o.observer ? `${o.observer.name} ${o.observer.title}` : ""]
    .filter(Boolean)
    .join(" · ");

export function FeedbackCard({
  observations,
  standards,
  onSeen,
  seenPending,
}: {
  observations: Observation[];
  standards: CoachStd[];
  onSeen: (ids: string[]) => void;
  seenPending?: boolean;
}) {
  const [openOld, setOpenOld] = useState(false);
  if (observations.length === 0) return null;
  const [latest, ...older] = observations;
  const unseenIds = observations.filter((o) => !o.seen_at).map((o) => o.id);
  return (
    <Card className={cn(!latest.seen_at && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-heading font-black text-foreground">받은 피드백</h3>
        {unseenIds.length > 0 && <span className="rounded-full bg-primary px-2.5 py-0.5 text-micro font-black text-primary-foreground">새 피드백</span>}
      </div>
      <p className="mt-1 text-label text-muted-foreground">{obsMeta(latest)}</p>
      <div className="mt-3">
        <ObservationBody o={latest} standards={standards} />
      </div>
      {unseenIds.length > 0 && (
        <PrimaryButton onClick={() => onSeen(unseenIds)} disabled={seenPending} className="mt-4">
          확인했어요
        </PrimaryButton>
      )}
      {older.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setOpenOld((v) => !v)}
            className="flex w-full items-center justify-between text-label font-bold text-muted-foreground"
            aria-expanded={openOld}
          >
            지난 피드백 {older.length}개
            <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", openOld && "rotate-180")} />
          </button>
          {openOld && (
            <div className="mt-3 space-y-4">
              {older.map((o) => (
                <div key={o.id}>
                  <p className="mb-2 text-label text-muted-foreground">{obsMeta(o)}</p>
                  <ObservationBody o={o} standards={standards} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ───────────── 나의 다섯 가지 ───────────── */

const Bar = ({ label, value, tone }: { label: string; value: number | null; tone: "me" | "obs" }) =>
  value == null ? null : (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-micro font-bold text-muted-foreground">{label}</span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
        <span className={cn("block h-full rounded-full", tone === "me" ? "bg-foreground/70" : "bg-primary")} style={{ width: `${value}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-micro font-bold tabular-nums text-foreground">{value}%</span>
    </div>
  );

export function MyFiveCard({ person, standards, title = "나의 다섯 가지" }: { person: GrowthPerson; standards: CoachStd[]; title?: string }) {
  const rows = standards
    .map((s) => ({ s, me: pct(person.self?.[String(s.no)]?.rate), obs: pct(person.obs?.[String(s.no)]?.rate) }))
    .filter((r) => r.me != null || r.obs != null);
  if (rows.length === 0) return null;
  const hasObs = rows.some((r) => r.obs != null);
  return (
    <Card>
      <h3 className="text-heading font-black text-foreground">{title}</h3>
      <p className="mt-1 text-label text-muted-foreground">{hasObs ? "나 = 1분 점검 · 관찰 = 대표님 · 지점장님" : "1분 점검으로 쌓여요"}</p>
      <div className="mt-4 space-y-3">
        {rows.map(({ s, me, obs }) => (
          <div key={s.no}>
            <p className="truncate text-label font-bold text-foreground">
              {s.no}. {s.title}
            </p>
            <div className="mt-1.5 space-y-1">
              <Bar label="나" value={me} tone="me" />
              <Bar label="관찰" value={obs} tone="obs" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ───────────── 153 기준 다섯 가지 ───────────── */

export function StandardsCard({ standards, canEdit, onEdit }: { standards: CoachStd[]; canEdit?: boolean; onEdit?: (s: CoachStd) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  if (standards.length === 0) return null;
  return (
    <Card>
      <h3 className="text-heading font-black text-foreground">153 기준 {standards.length === 5 ? "다섯 가지" : `${standards.length}가지`}</h3>
      <p className="mt-1 text-label text-muted-foreground">짧은 시간 안에 회원님께 행복을 드리는 방법</p>
      <ul className="mt-3 divide-y divide-border">
        {standards.map((s) => {
          const on = open === s.no;
          return (
            <li key={s.no} className="py-3">
              <button
                type="button"
                onClick={() => setOpen(on ? null : s.no)}
                className="flex w-full items-start gap-3 text-left"
                aria-expanded={on}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-label font-black text-background">
                  {s.no}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-black text-foreground">{s.title}</span>
                  <span className={cn("mt-0.5 block text-label text-muted-foreground", !on && "truncate")}>{s.why}</span>
                </span>
                <ChevronDown aria-hidden className={cn("mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", on && "rotate-180")} />
              </button>
              {on && (
                <div className="ml-11 mt-3 space-y-3">
                  {s.how && (
                    <div>
                      <p className="text-label font-bold text-muted-foreground">이렇게 해요</p>
                      <p className="mt-0.5 text-body text-foreground">{s.how}</p>
                    </div>
                  )}
                  {sayLines(s.say).length > 0 && (
                    <div>
                      <p className="text-label font-bold text-muted-foreground">이렇게 말해요</p>
                      <ul className="mt-1 space-y-1">
                        {sayLines(s.say).map((line) => (
                          <li key={line} className="rounded-xl bg-secondary/70 px-3 py-2 text-body text-foreground">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.check_q && (
                    <div>
                      <p className="text-label font-bold text-muted-foreground">스스로 물어봐요</p>
                      <p className="mt-0.5 text-body text-foreground">{s.check_q}</p>
                    </div>
                  )}
                  {canEdit && onEdit && (
                    <GhostButton onClick={() => onEdit(s)} className="h-10">
                      고치기
                    </GhostButton>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ───────────── 대표님 · 지점장님 — 코치님 한 분 ───────────── */

export const planChip = (p: GrowthPerson) => {
  const phase = planPhase(p.plan);
  if (!p.plan || phase === "none") return "시작 전";
  if (phase === "before") return `${shortDay(p.plan.start_on)} 시작`;
  if (phase === "review") return "돌아보기";
  if (phase === "done") return `${p.plan.weeks}주 완료`;
  return `${p.plan.week_no}주차 / ${p.plan.weeks}주`;
};

export function CoachRowCard({
  person,
  standards,
  onObserve,
  onStart,
  onReview,
  extra,
}: {
  person: GrowthPerson;
  standards: CoachStd[];
  onObserve: () => void;
  onStart: () => void;
  onReview: () => void;
  /** 표시 줄 끝에 붙는 것 — 성향 카드 표시(MindChip) */
  extra?: React.ReactNode;
}) {
  const phase = planPhase(person.plan);
  const stdNos = standards.map((s) => s.no);
  const hasObs = Object.keys(person.obs ?? {}).length > 0;
  const weakest = weakestStd(hasObs ? person.obs : person.self, stdNos);
  const canStart = phase === "none" || phase === "done";
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Avatar person={person.person} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-black text-foreground">
            {person.person?.name ?? "코치님"} <span className="text-label font-bold text-muted-foreground">{person.person?.title}</span>
          </p>
          <p className="mt-0.5 text-label text-muted-foreground">
            이번 주 점검 {person.checks_week} · 관찰 {person.obs_week}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-micro font-black",
            phase === "review" ? "bg-primary text-primary-foreground" : phase === "running" || phase === "before" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
          )}
        >
          {planChip(person)}
        </span>
      </div>

      {(weakest || person.unseen > 0 || extra) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {weakest && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-foreground">
              키울 것 · {stdTitle(standards, weakest)}
            </span>
          )}
          {person.unseen > 0 && (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-micro font-bold text-primary">안 읽은 피드백 {person.unseen}</span>
          )}
          {extra}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <PrimaryButton onClick={onObserve} className="h-11 flex-1">
          수업 관찰
        </PrimaryButton>
        {canStart && (
          <GhostButton onClick={onStart} className="shrink-0">
            4주 시작
          </GhostButton>
        )}
        {(phase === "review" || phase === "running") && person.plan && (
          <GhostButton onClick={onReview} className={cn("shrink-0", phase === "review" && "bg-primary text-primary-foreground")}>
            돌아보기
          </GhostButton>
        )}
      </div>
    </Card>
  );
}

/** 돌아보기 한 줄 — 나 · 관찰 점수 + 첫 관찰 → 마지막 관찰 */
export function ReviewRow({ std, person }: { std: CoachStd; person: GrowthPerson }) {
  const me = pct(person.self?.[String(std.no)]?.rate);
  const obs = pct(person.obs?.[String(std.no)]?.rate);
  const t = markTrend(person.first_marks, person.last_marks, std.no);
  const Icon = t === "up" ? ArrowUp : t === "down" ? ArrowDown : t === "same" ? Minus : null;
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1 truncate text-label font-bold text-foreground">
        {std.no}. {std.title}
      </span>
      <span className="w-14 shrink-0 text-right text-micro font-bold tabular-nums text-muted-foreground">{me == null ? "–" : `나 ${me}`}</span>
      <span className="w-16 shrink-0 text-right text-micro font-bold tabular-nums text-foreground">{obs == null ? "–" : `관찰 ${obs}`}</span>
      <span className="flex w-5 shrink-0 justify-end">
        {Icon && <Icon aria-label={t === "up" ? "좋아짐" : t === "down" ? "내려감" : "그대로"} className={cn("h-4 w-4", t === "up" ? "text-primary" : t === "down" ? "text-destructive" : "text-muted-foreground")} />}
      </span>
    </div>
  );
}
