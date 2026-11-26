/**
 * 153운영본부 · 「CRM」 탭 (2026-11-27 대표님 「다음가자」 · 관장님 앱 ② 153OS CRM 보기 · docs/features/69)
 *
 *   보는 분: 관장 · 지점장 · 본사(서버 crm_scope · 선릉역점부터). 읽기만 — 고치기는 브로제이 · 153OS(앱 안 쓰기는 ④).
 *   맨 위: 지점(본사는 고르기) · 브로제이 기준 시각 · 안내
 *   작은 탭 세 개(?crm=todo|members|customers):
 *     할 일 — 기간 임박 · 7일 안 옴 · 첫 4주 · 끝난 회원 · 한 달 넘게 안 옴(?g=…) 칸을 누르면 그 명단
 *     회원 — 이름 · 전화 뒷자리 찾기 + 유효 · 14일 안 끝남 · 홀딩 · 끝남 거르기
 *     고객 — 이번 달 손님 흐름(톡톡 첫 인사 · 번호 남김 · 첫 결제 · 재등록) · 톡톡 손님 · 문의 기록
 *   줄을 누르면 회원 카드(아래에서 올라오는 창 · 뒤로가기 = 닫기): 전화 걸기 · 수강권 · 홀딩 · PT · 13주 방문 칸 · 결제 · 후속 연락
 *   자료: Edge Function os-crm → 153OS. 글 · 계산 = lib/crm153.ts · 예시 = ?demo=1
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Info, Phone, Search, X } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useBackClose } from "@/hooks/useBackClose";
import { cn } from "@/lib/utils";
import {
  CRM_FILTERS,
  CRM_HELP,
  CRM_TODO_GROUPS,
  addDays,
  crmStamp,
  customerSteps,
  filterRows,
  isTodoGroup,
  kstStampOf,
  md,
  phoneText,
  statusPill,
  todoRows,
  visitText,
  visitWeeks,
  wonText,
  type CrmCard,
  type CrmCounts,
  type CrmMemberFilter,
  type CrmMemberRow,
  type CrmStatus,
  type CrmTodoGroup,
  type CrmTone,
  type CrmView,
} from "@/lib/crm153";
import type { CrmScopeLite } from "@/services/crmOn";
import { useCrmCard, useCrmCustomers, useCrmMembers } from "@/services/crmService";
import { readOpsBranch, saveOpsBranch, shortBranch } from "@/services/opsService";
import { OpsChip, kstToday, opsInput } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-4";
const PAGE = 60;

const VIEWS: readonly { key: CrmView; label: string }[] = [
  { key: "todo", label: "할 일" },
  { key: "members", label: "회원" },
  { key: "customers", label: "고객" },
];

const TONE: Record<CrmTone, string> = {
  red: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  gray: "bg-secondary text-muted-foreground",
};

const Pill = ({ text, tone }: { text: string; tone: CrmTone }) => (
  <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-bold", TONE[tone])}>{text}</span>
);

/** 글을 칠 때마다 서버를 부르지 않게 — 멈춘 뒤 0.35초 */
function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const OpsCrmTab = ({ scope }: { scope: CrmScopeLite }) => {
  const today = kstToday();
  const [params, setParams] = useSearchParams();
  const crmParam = params.get("crm");
  const view: CrmView = crmParam === "members" || crmParam === "customers" ? crmParam : "todo";
  const gParam = params.get("g");
  const group: CrmTodoGroup = isTodoGroup(gParam) ? gParam : "expiring";
  const setParam = (k: "crm" | "g", v: string | null) =>
    setParams(
      (p) => {
        if (v) p.set(k, v);
        else p.delete(k);
        return p;
      },
      { replace: true },
    );

  const branches = useMemo(
    () => (scope.branches.length > 0 ? scope.branches : scope.branch ? [scope.branch] : []),
    [scope.branches, scope.branch],
  );
  const [branch, setBranchState] = useState<string | null>(() => {
    const saved = readOpsBranch();
    return saved && branches.includes(saved) ? saved : scope.branch ?? branches[0] ?? null;
  });
  useEffect(() => {
    if (!branch || !branches.includes(branch)) setBranchState(scope.branch ?? branches[0] ?? null);
  }, [branch, branches, scope.branch]);
  const setBranch = (b: string) => {
    setBranchState(b);
    saveOpsBranch(b);
  };

  const membersQ = useCrmMembers(branch, "");
  const data = membersQ.data;
  const stamp = crmStamp(data?.snapAt ?? null);

  const [cardRow, setCardRow] = useState<CrmMemberRow | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  useBackClose(helpOpen, () => setHelpOpen(false));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {branches.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {branches.map((b) => (
              <OpsChip key={b} on={b === branch} onClick={() => setBranch(b)}>
                {shortBranch(b)}
              </OpsChip>
            ))}
          </div>
        ) : (
          <p className="truncate text-body font-black text-foreground">{branch ? shortBranch(branch) : ""}</p>
        )}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
        >
          <Info className="h-4 w-4" aria-hidden />
          숫자 기준
        </button>
      </div>
      <p className="-mt-1 text-micro text-muted-foreground">{stamp.text ? `${stamp.text} · 읽기만 해요` : "브로제이 회원 명부 · 읽기만 해요"}</p>
      {stamp.warn && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-label font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">{stamp.warn}</p>
      )}

      <div role="tablist" aria-label="CRM" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => view !== v.key && setParam("crm", v.key === "todo" ? null : v.key)}
            className={cn(
              "h-10 rounded-lg text-label font-black transition-all active:scale-[0.98]",
              view === v.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "customers" ? (
        <CustomersView branch={branch} />
      ) : membersQ.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-36 animate-pulse rounded-2xl bg-card" />
          <div className="h-72 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : !data ? (
        <div className={cn(card, "text-center")}>
          <p className="text-body font-bold text-foreground">회원 명부를 불러오지 못했어요</p>
          <p className="mt-1 text-label text-muted-foreground">{(membersQ.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
          <button
            type="button"
            onClick={() => void membersQ.refetch()}
            className="mt-4 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : view === "members" ? (
        <MembersView branch={branch} rows={data.rows} counts={data.counts} today={today} onOpen={setCardRow} />
      ) : (
        <TodoView
          rows={data.rows}
          counts={data.counts}
          group={group}
          onGroup={(g) => setParam("g", g === "expiring" ? null : g)}
          today={today}
          onOpen={setCardRow}
        />
      )}

      <MemberCard branch={branch} row={cardRow} today={today} onClose={() => setCardRow(null)} />

      <Drawer open={helpOpen} onOpenChange={(v) => !v && setHelpOpen(false)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-heading font-black">숫자 기준</DrawerTitle>
            <DrawerDescription className="text-label">{stamp.text ?? "브로제이 회원 명부 기준"}</DrawerDescription>
          </DrawerHeader>
          <ul className="space-y-2 overflow-y-auto px-4 pb-6">
            {CRM_HELP.map((line) => (
              <li key={line} className="text-body leading-relaxed text-foreground">
                {line}
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

// ─── 명단 한 줄 ───────────────────────────────────────────
type OpenRow = (r: CrmMemberRow) => void;

const MemberRow = ({ r, today, onOpen }: { r: CrmMemberRow; today: string; onOpen: OpenRow }) => {
  const pill = statusPill(r);
  return (
    <li>
      <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center gap-2.5 py-3 text-left active:opacity-70">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-body font-bold text-foreground">{r.name}</span>
            {r.last4 && <span className="shrink-0 text-micro tabular-nums text-muted-foreground">···{r.last4}</span>}
          </span>
          <span className="block truncate text-label text-muted-foreground">
            {[r.product ?? "수강권 정보 없음", r.end ? `${md(r.end)} 끝` : null].filter(Boolean).join(" · ")}
          </span>
          <span className="block truncate text-micro text-muted-foreground">
            {[visitText(r.lastVisit, today), `30일 ${r.v30}번`, r.coach].filter(Boolean).join(" · ")}
          </span>
        </span>
        <Pill {...pill} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
};

const RowList = ({ rows, today, onOpen, empty }: { rows: CrmMemberRow[]; today: string; onOpen: OpenRow; empty: string }) => {
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [rows]);
  if (rows.length === 0) return <p className="py-6 text-center text-label text-muted-foreground">{empty}</p>;
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.slice(0, limit).map((r) => (
          <MemberRow key={r.id} r={r} today={today} onOpen={onOpen} />
        ))}
      </ul>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="mt-2 w-full rounded-xl bg-secondary py-2.5 text-label font-bold text-foreground active:scale-[0.99]"
        >
          {rows.length - limit}명 더 보기
        </button>
      )}
    </>
  );
};

// ─── 할 일 ───────────────────────────────────────────────
const TodoView = ({
  rows,
  counts,
  group,
  onGroup,
  today,
  onOpen,
}: {
  rows: CrmMemberRow[];
  counts: CrmCounts;
  group: CrmTodoGroup;
  onGroup: (g: CrmTodoGroup) => void;
  today: string;
  onOpen: OpenRow;
}) => {
  const meta = CRM_TODO_GROUPS.find((g) => g.key === group) ?? CRM_TODO_GROUPS[0];
  const list = useMemo(() => todoRows(rows, group), [rows, group]);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {CRM_TODO_GROUPS.map((g) => {
          const n = g.count(counts);
          const on = g.key === group;
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => onGroup(g.key)}
              className={cn(
                "flex min-w-0 flex-col items-start rounded-xl border p-2.5 text-left transition-colors active:scale-[0.98]",
                on ? "border-foreground bg-card shadow-elev-1" : "border-transparent bg-secondary/70",
              )}
            >
              <span className="text-micro font-bold leading-tight text-muted-foreground">{g.label}</span>
              <span className={cn("mt-0.5 text-title tabular-nums", n > 0 ? "text-foreground" : "text-muted-foreground")}>{n}</span>
            </button>
          );
        })}
      </div>
      <section className={card}>
        <p className="text-body font-black text-foreground">
          {meta.label} {list.length}명
        </p>
        <p className="text-label text-muted-foreground">{meta.sub}</p>
        <div className="mt-1">
          <RowList rows={list} today={today} onOpen={onOpen} empty="챙길 회원이 없어요" />
        </div>
      </section>
    </>
  );
};

// ─── 회원 ───────────────────────────────────────────────
const MembersView = ({
  branch,
  rows,
  counts,
  today,
  onOpen,
}: {
  branch: string | null;
  rows: CrmMemberRow[];
  counts: CrmCounts;
  today: string;
  onOpen: OpenRow;
}) => {
  const [q, setQ] = useState("");
  const qd = useDebounced(q.trim(), 350);
  const searchQ = useCrmMembers(branch, qd, qd.length > 0);
  const [filter, setFilter] = useState<CrmMemberFilter>("valid");
  const list = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const searching = qd.length > 0;
  const found = searchQ.data && searchQ.data.query ? searchQ.data.rows : [];

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 전화 뒷자리로 찾기"
          aria-label="회원 찾기"
          className={cn(opsInput, "pl-9 pr-9")}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="찾기 지우기"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching ? (
        <section className={card}>
          <p className="text-body font-black text-foreground">
            {searchQ.isFetching && !searchQ.data?.query ? "찾는 중…" : `찾은 회원 ${found.length}명`}
          </p>
          <p className="text-label text-muted-foreground">끝난 지 오래된 회원까지 · 이름 일부나 전화 뒷자리</p>
          {searchQ.isError ? (
            <p className="py-6 text-center text-label text-muted-foreground">{(searchQ.error as Error).message}</p>
          ) : (
            <div className="mt-1">
              <RowList rows={found} today={today} onOpen={onOpen} empty={searchQ.isFetching ? "찾는 중…" : "맞는 회원이 없어요"} />
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {CRM_FILTERS.map((f) => (
              <OpsChip key={f.key} on={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} {f.count(counts)}
              </OpsChip>
            ))}
          </div>
          <section className={card}>
            <RowList rows={list} today={today} onOpen={onOpen} empty="회원이 없어요" />
          </section>
        </>
      )}
    </>
  );
};

// ─── 고객 ───────────────────────────────────────────────
const CustomersView = ({ branch }: { branch: string | null }) => {
  const q = useCrmCustomers(branch);
  if (q.isLoading)
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
        <div className="h-56 animate-pulse rounded-2xl bg-card" />
      </div>
    );
  if (!q.data)
    return (
      <div className={cn(card, "text-center")}>
        <p className="text-body font-bold text-foreground">고객 자료를 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="mt-4 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
        >
          다시 불러오기
        </button>
      </div>
    );
  const c = q.data;
  const steps = customerSteps(c);
  return (
    <>
      <section className={card}>
        <p className="text-body font-black text-foreground">{c.funnel.month ? `${Number(c.funnel.month.slice(5, 7))}월` : "이번 달"} 손님 흐름</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {steps.map((s) => (
            <div key={s.key} className="min-w-0 rounded-xl bg-secondary/70 p-3">
              <p className="text-label text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 text-title tabular-nums text-foreground">{s.value}</p>
              <p className="mt-0.5 text-micro leading-snug text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-micro leading-relaxed text-muted-foreground">
          칸마다 따로 센 숫자예요. 톡톡 없이 바로 등록한 회원도 첫 결제에 들어가요.
        </p>
      </section>

      <section className={card}>
        <p className="text-body font-black text-foreground">톡톡 손님 · 최근 60일</p>
        <p className="text-label text-muted-foreground">번호를 남긴 손님 · 그 번호로 회원 등록이 됐는지</p>
        {c.talk.length === 0 ? (
          <p className="py-6 text-center text-label text-muted-foreground">번호를 남긴 톡톡 손님이 없어요</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {c.talk.map((t) => (
              <li key={`${t.at}-${t.last4}`} className="py-3">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-label font-bold tabular-nums text-foreground">
                    {kstStampOf(t.at)}
                    {t.last4 ? ` · ···${t.last4}` : ""}
                  </span>
                  <Pill text={t.member ? "회원 등록됨" : "아직 회원 아님"} tone={t.member ? "green" : "gray"} />
                </p>
                <p className="mt-0.5 line-clamp-2 text-label text-muted-foreground">{t.first || "(첫 말 없음)"}</p>
                <p className="text-micro text-muted-foreground">말 {t.msgs}번</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <p className="text-body font-black text-foreground">문의 기록</p>
        <p className="text-label text-muted-foreground">153OS 문의함에 적힌 손님</p>
        {c.inquiries.length === 0 ? (
          <p className="py-6 text-center text-label text-muted-foreground">문의 기록이 없어요 · 153OS 문의함에 적으면 여기에 보여요</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {c.inquiries.map((it) => (
              <li key={`${it.at}-${it.last4}`} className="py-3">
                <p className="flex items-center justify-between gap-2">
                  <span className="truncate text-body font-bold text-foreground">
                    {it.name ?? "이름 없음"}
                    {it.last4 ? <span className="ml-1.5 text-micro font-normal text-muted-foreground">···{it.last4}</span> : null}
                  </span>
                  {it.status && <Pill text={it.status} tone="gray" />}
                </p>
                <p className="text-label text-muted-foreground">
                  {[kstStampOf(it.at), it.interest, it.trialAt ? `체험 ${kstStampOf(it.trialAt)}` : null].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

// ─── 회원 카드 ───────────────────────────────────────────
const Line = ({ label, value }: { label: string; value: string | null | undefined }) =>
  value ? (
    <p className="flex justify-between gap-3 py-1.5">
      <span className="shrink-0 text-label text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-label font-bold text-foreground">{value}</span>
    </p>
  ) : null;

const WEEKDAY = ["월", "화", "수", "목", "금", "토", "일"];

/** 카드만 있을 때(찾기 결과에서 열었을 때)의 상태 — 목록 줄이 있으면 그 상태를 쓴다 */
const cardStatus = (c: CrmCard): CrmStatus => {
  if (!c.active) return "ended";
  if (c.hold.status === "HOLDING") return "hold";
  return c.daysLeft != null && c.daysLeft <= 14 ? "soon" : "active";
};

const contactKinds = (f: { met: boolean; called: boolean; texted: boolean }) =>
  [f.met ? "만남" : null, f.called ? "전화" : null, f.texted ? "문자" : null].filter((x): x is string => !!x);

const MemberCard = ({
  branch,
  row,
  today,
  onClose,
}: {
  branch: string | null;
  row: CrmMemberRow | null;
  today: string;
  onClose: () => void;
}) => {
  const id = row?.id ?? null;
  useBackClose(!!id, onClose);
  const q = useCrmCard(branch, id);
  const c = q.data && q.data.id === id ? q.data : null;
  const name = c?.name ?? row?.name ?? "회원 카드";
  const pill = row ? statusPill(row) : c ? statusPill({ status: cardStatus(c), daysLeft: c.daysLeft }) : null;
  const weeks = useMemo(() => (c ? visitWeeks(c.visits, today) : []), [c, today]);
  const from30 = addDays(today, -29);
  const visits30 = c ? c.visits.filter((d) => d >= from30 && d <= today).length : 0;
  const digits = (c?.phone ?? "").replace(/\D/g, "");
  const holding = c?.hold.status === "HOLDING";

  return (
    <Drawer open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2 text-heading font-black">
            <span className="truncate">{name}</span>
            {pill && <Pill {...pill} />}
          </DrawerTitle>
          <DrawerDescription className="text-label">
            {c
              ? [c.product, c.end ? `${md(c.end)} 끝` : null, holding ? "홀딩 중" : null].filter(Boolean).join(" · ") || "수강권 정보 없음"
              : q.isError
                ? "회원 카드"
                : "불러오는 중…"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          {!c && !q.isError ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-14 animate-pulse rounded-xl bg-secondary" />
              <div className="h-32 animate-pulse rounded-xl bg-secondary" />
            </div>
          ) : !c ? (
            <p className="py-6 text-center text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "회원 카드를 불러오지 못했어요"}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-2.5">
                <span className="text-body font-bold tabular-nums text-foreground">
                  {c.phone ? phoneText(c.phone) : c.last4 ? `···${c.last4}` : "전화 없음"}
                </span>
                {digits.length >= 9 && (
                  <a
                    href={`tel:${digits}`}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-foreground px-3 text-label font-bold text-background active:scale-95"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    전화 걸기
                  </a>
                )}
              </div>

              <section>
                <p className="text-label font-bold text-muted-foreground">수강권</p>
                <div className="divide-y divide-border">
                  <Line label="상품" value={c.product} />
                  <Line label="기간" value={c.start || c.end ? `${c.start ? md(c.start) : "?"} ~ ${c.end ? md(c.end) : "?"}` : null} />
                  <Line label="남은 날" value={c.daysLeft == null ? null : c.daysLeft >= 0 ? `${c.daysLeft}일` : `끝난 지 ${-c.daysLeft}일`} />
                  <Line label="브로제이 상태" value={c.statusText} />
                  <Line label="홀딩" value={holding ? `${c.hold.start ? md(c.hold.start) : "?"} ~ ${c.hold.end ? md(c.hold.end) : "?"}` : null} />
                  <Line label="횟수" value={c.sessions.total ? `남은 ${c.sessions.remaining ?? 0}회 / ${c.sessions.total}회` : null} />
                  <Line
                    label="PT"
                    value={c.pt.active ? `${c.pt.ticket ?? "PT"} · 남은 ${c.pt.remaining ?? 0}회${c.pt.end ? ` · ${md(c.pt.end)}까지` : ""}` : null}
                  />
                </div>
              </section>

              <section>
                <p className="text-label font-bold text-muted-foreground">
                  방문 · 최근 30일 {visits30}번 · {visitText(c.lastVisit ?? c.visits[c.visits.length - 1] ?? null, today)}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <div className="grid grid-rows-7 gap-[3px]" aria-hidden>
                    {WEEKDAY.map((w, i) => (
                      <span key={w} className={cn("h-3.5 text-micro leading-[0.875rem] text-muted-foreground", i % 2 === 1 && "invisible")}>
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-[3px]" role="img" aria-label={`최근 13주 중 ${c.visits.length}일 출입`}>
                    {weeks.map((wk) => (
                      <div key={wk.monday} className="grid grid-rows-7 gap-[3px]">
                        {wk.days.map((on, i) => (
                          <span
                            key={i}
                            className={cn("h-3.5 w-3.5 rounded-[3px]", on === null ? "bg-transparent" : on ? "bg-primary" : "bg-muted-foreground/15")}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-micro text-muted-foreground">13주 · 색칠한 칸 = 출입한 날</p>
              </section>

              <section>
                <p className="text-label font-bold text-muted-foreground">회원 정보</p>
                <div className="divide-y divide-border">
                  <Line label="가입" value={c.joined ? md(c.joined) : null} />
                  <Line label="들어온 길" value={c.route} />
                  <Line label="운동 목적" value={c.purpose} />
                  <Line label="담당" value={c.coach} />
                  <Line label="마지막 결제" value={c.lastBought ? md(c.lastBought) : null} />
                </div>
                {!c.joined && !c.route && !c.purpose && !c.coach && !c.lastBought && (
                  <p className="py-1.5 text-label text-muted-foreground">브로제이에 적힌 정보가 없어요</p>
                )}
              </section>

              <section>
                <p className="text-label font-bold text-muted-foreground">결제 · 최근 2년</p>
                {c.sameName > 1 && (
                  <p className="mt-1 rounded-lg bg-amber-100 px-3 py-2 text-micro font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                    같은 이름 회원이 {c.sameName}명 있어요 · 결제 · 연락 기록이 섞여 보일 수 있어요
                  </p>
                )}
                {c.payments.length === 0 ? (
                  <p className="py-1.5 text-label text-muted-foreground">결제 기록이 없어요</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {c.payments.map((p, i) => (
                      <li key={`${p.day}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate text-label text-foreground">
                          <span className="tabular-nums text-muted-foreground">{md(p.day)}</span> {p.product ?? p.category ?? "결제"}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-label font-bold tabular-nums",
                            p.amount < 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground",
                          )}
                        >
                          {p.amount < 0 ? `환불 ${wonText(-p.amount)}` : wonText(p.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <p className="text-label font-bold text-muted-foreground">연락 기록 · 153OS</p>
                {c.followups.length === 0 ? (
                  <p className="py-1.5 text-label text-muted-foreground">153OS 에 남긴 연락 기록이 없어요</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {c.followups.map((f, i) => {
                      const kinds = contactKinds(f);
                      return (
                        <li key={`${f.at}-${i}`} className="py-2">
                          <p className="text-label font-bold text-foreground">
                            {[kstStampOf(f.at), f.status, kinds.length > 0 ? kinds.join(" · ") : null].filter(Boolean).join(" · ")}
                          </p>
                          {f.memo && <p className="text-label text-muted-foreground">{f.memo}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <p className="rounded-lg bg-secondary/70 px-3 py-2 text-micro leading-relaxed text-muted-foreground">
                읽기만 해요 · 고치기는 브로제이 · 153OS{c.updatedAt ? ` · ${kstStampOf(c.updatedAt)} 브로제이 기준` : ""}
              </p>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OpsCrmTab;
