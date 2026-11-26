/**
 * 🧭 지도자 홈 — 코치 · 관장 · 관리자 홈 맨 위 (2026-11-26 대표님 「추천대로 가자」 · 선릉역점만 · 앱 규칙 r_ad42f1de95)
 *   목표 = 신규 회원 재등록률 70% 이상. 숫자 하나(신규 재등록률) + ① 기간 임박 ② 재미 위험 신규.
 *   줄마다 얼굴 · 할 말(처방) 하나 · 단추 — 누가 언제 이야기했는지 보여 같은 회원에게 여러 번 말하지 않게.
 *   관장 = 이번 주 코치별 기록 · D-3 안인데 아무도 안 만난 회원 / 관리자 = 지점 고르기 · 얼굴 보이는 회원 비율.
 *   켠 지점 지도진 · 본사에게만 — 회원 · '회원으로 보기' · 꺼진 지점 · 함수가 없을 때는 아무것도 그리지 않는다.
 *   글 · 순서 = lib/leaderHome.ts · 데이터 = services/leaderHomeService.ts · 미리보기 예시 = 홈 주소 ?demo=leader (지도진만)
 */
import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, Check, ChevronRight, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import LeaderPhotoSheet, { type LeaderPhotoTarget } from "@/components/leader/LeaderPhotoSheet";
import OpsDayNoteSheet from "@/components/ops/OpsDayNoteSheet";
import { useAuth } from "@/contexts/AuthContext";
import { openMemberCard } from "@/lib/appEvents";
import {
  LEADER_DEMO,
  ROLE_LABEL,
  canUndo,
  contactLine,
  expiringSay,
  expiringSub,
  kpiView,
  photoCoverage,
  sortExpiring,
  sortStarters,
  sortWinback,
  starterChips,
  starterRx,
  winbackSay,
  type ContactKind,
  type ExpiringRow,
  type LeaderHomeData,
  type LeaderRow,
  type LeaderTopic,
  type RxKey,
  type StarterRow,
  type WinbackRow,
} from "@/lib/leaderHome";
import { kstHm } from "@/lib/promise153";
import { isStaffProfile } from "@/lib/staffDisplay";
import { cn } from "@/lib/utils";
import {
  useCoachPhotoUrls,
  useLeaderContact,
  useLeaderHome,
  useLeaderKpiRefresh,
  useLeaderUndo,
} from "@/services/leaderHomeService";

const SHOW = 4;

const CHIP = {
  here: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  plain: "bg-secondary text-foreground",
  line: "border border-foreground/25 text-foreground",
} as const;

const Chip = ({ tone, children }: { tone: keyof typeof CHIP; children: ReactNode }) => (
  <span className={cn("rounded-md px-1.5 py-0.5 text-micro font-black", CHIP[tone])}>{children}</span>
);

const Pill = ({
  children,
  onClick,
  strong = false,
  disabled = false,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  strong?: boolean;
  disabled?: boolean;
  label?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={cn(
      "inline-flex h-9 items-center gap-1 rounded-full px-3 text-label font-bold active:scale-95 disabled:opacity-50",
      strong ? "bg-foreground text-background" : "bg-secondary text-foreground",
    )}
  >
    {children}
  </button>
);

const shortBranch = (b: string | null): string => (b ?? "").replace(/^153복싱짐\s*/, "");

const Face = ({ row, url }: { row: LeaderRow; url: string | null }) => (
  <span
    className={cn(
      "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-label font-black text-muted-foreground",
      row.here && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-card",
    )}
  >
    {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : row.name.slice(0, 1)}
  </span>
);

interface RowProps {
  row: LeaderRow;
  url: string | null;
  chips: ReactNode;
  sub: string;
  say: string;
  today: string | null;
  actions: ReactNode;
  extra?: ReactNode;
  onUndo?: (id: string) => void;
}

const MemberRow = ({ row, url, chips, sub, say, today, actions, extra, onUndo }: RowProps) => (
  <li className="py-3">
    <div className="flex items-start gap-3">
      <button type="button" onClick={() => openMemberCard(row.userId)} aria-label={`${row.name}님 카드 열기`} className="mt-0.5 shrink-0 active:scale-95">
        <Face row={row} url={url} />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => openMemberCard(row.userId)} className="flex w-full min-w-0 items-center gap-0.5 text-left active:opacity-70">
          <span className="truncate text-body font-black text-foreground">{row.name}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        <div className="mt-1 flex flex-wrap gap-1">{chips}</div>
        <p className="mt-1 text-label text-muted-foreground">{sub}</p>
        {extra}
        <p className="mt-0.5 text-label font-bold leading-snug text-foreground">{say}</p>
        {row.contact && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-label text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            <span>{contactLine(row.contact, today)}</span>
            {onUndo && canUndo(row.contact) && (
              <button
                type="button"
                onClick={() => row.contact && onUndo(row.contact.id)}
                className="ml-1 text-label font-bold text-muted-foreground underline underline-offset-2"
              >
                되돌리기
              </button>
            )}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">{actions}</div>
      </div>
    </div>
  </li>
);

const MoreButton = ({ all, hidden, onClick }: { all: boolean; hidden: number; onClick: () => void }) =>
  hidden <= 0 && !all ? null : (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-label font-bold text-foreground active:bg-secondary/60"
    >
      {all ? "접기" : `${hidden}명 더 보기`}
    </button>
  );

export interface LeaderHomeViewProps {
  data: LeaderHomeData;
  photoUrls?: Record<string, string>;
  busyId?: string | null;
  onContact?: (row: LeaderRow, kind: ContactKind, topic: LeaderTopic, rx?: RxKey) => void;
  onUndo?: (contactId: string) => void;
  onPhoto?: (row: LeaderRow) => void;
  onNote?: (row: StarterRow) => void;
  onBranch?: (branch: string) => void;
  className?: string;
}

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 LeaderHome) */
export const LeaderHomeView = ({ data, photoUrls = {}, busyId = null, onContact, onUndo, onPhoto, onNote, onBranch, className }: LeaderHomeViewProps) => {
  const [tab, setTab] = useState<"expiring" | "winback">("expiring");
  const [allExp, setAllExp] = useState(false);
  const [allSt, setAllSt] = useState(false);
  const role = data.role === "none" ? "coach" : data.role;
  const k = kpiView(data.kpi, data.targetRate);
  const urlOf = (r: LeaderRow) => (r.photoPath ? photoUrls[r.photoPath] : undefined) ?? r.avatarUrl ?? null;
  const expiring = sortExpiring(data.expiring);
  const winback = sortWinback(data.winback);
  const starters = sortStarters(data.starters);
  const priorityHere = new Set([...data.expiring, ...data.winback, ...data.starters].filter((r) => r.here).map((r) => r.userId)).size;
  const list: (ExpiringRow | WinbackRow)[] = tab === "expiring" ? expiring : winback;
  const shownList = allExp ? list : list.slice(0, SHOW);
  const shownSt = allSt ? starters : starters.slice(0, SHOW);
  const onBranches = (data.admin?.branches ?? []).filter((b) => b.on);
  const rate = k.rate === null ? 0 : Math.max(0, Math.min(100, k.rate));
  const photoBtn = (r: LeaderRow) =>
    onPhoto && !r.photoPath ? (
      <Pill onClick={() => onPhoto(r)} label={`${r.name}님 사진 남기기`}>
        <Camera className="h-4 w-4" aria-hidden />
        사진
      </Pill>
    ) : null;

  return (
    <section aria-label="지도자 홈" className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      {/* 머리 — 지점 · 보기 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-heading font-black text-foreground">지도자 홈</h2>
          <p className="truncate text-label text-muted-foreground">
            {shortBranch(data.branch)} · {ROLE_LABEL[role]} 보기
          </p>
        </div>
        {role === "admin" && onBranch && onBranches.length > 1 ? (
          <select
            value={data.branch ?? ""}
            onChange={(e) => onBranch(e.target.value)}
            aria-label="지점 고르기"
            className="h-9 max-w-[45%] rounded-full border border-border bg-card px-3 text-label font-bold text-foreground"
          >
            {onBranches.map((b) => (
              <option key={b.name} value={b.name}>
                {shortBranch(b.name)}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-micro font-black text-foreground">{ROLE_LABEL[role]}</span>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-label font-bold text-emerald-700 dark:text-emerald-300">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        지금 체육관 {data.counts.here}명 · 우선 회원 {priorityHere}명
      </p>

      {/* 숫자 하나 — 신규 재등록률 */}
      <div className="mt-3 rounded-xl bg-secondary/70 p-3.5">
        <p className="text-label text-muted-foreground">신규 재등록률 · 첫 수강권 끝나고 30일 안</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-display tabular-nums text-foreground">{k.rateText}</span>
          <span className="text-label font-bold text-muted-foreground">목표 {data.targetRate}%</span>
        </div>
        <div className="relative mt-2 h-2 rounded-full bg-card" aria-hidden>
          <div className="h-2 rounded-full bg-primary" style={{ width: `${rate}%` }} />
          <div className="absolute -top-1 h-4 w-0.5 rounded bg-foreground" style={{ left: `${data.targetRate}%` }} />
        </div>
        {k.lines.map((line) => (
          <p key={line} className="mt-2 text-label leading-snug text-foreground">
            {line}
          </p>
        ))}
        <p className="mt-2 text-micro text-muted-foreground">{k.note}</p>
      </div>

      {/* ① 기간 임박 */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-body font-black text-foreground">① 기간 임박</h3>
          <span className="text-label text-muted-foreground">첫 수강권 {data.counts.expiringFirst}명</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="기간 임박 고르기">
          {(
            [
              ["expiring", `D-${data.conf.expiringDays} · ${data.counts.expiring}명`],
              ["winback", `끝난 지 ${data.conf.winbackDays}일 안 · ${data.counts.winback}명`],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setAllExp(false);
              }}
              className={cn(
                "h-8 rounded-full px-3 text-label font-bold active:scale-95",
                tab === key ? "bg-foreground text-background" : "border border-border text-muted-foreground",
              )}
            >
              {text}
            </button>
          ))}
        </div>
        {shownList.length === 0 ? (
          <p className="mt-3 text-label text-muted-foreground">
            {tab === "expiring" ? `${data.conf.expiringDays}일 안에 끝나는 회원이 없어요` : "끝난 지 얼마 안 된 회원이 없어요"}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {shownList.map((r) => {
              const topic: LeaderTopic = tab === "expiring" ? "expiring" : "winback";
              const isExp = "daysLeft" in r;
              const busy = busyId === r.userId;
              return (
                <MemberRow
                  key={r.userId}
                  row={r}
                  url={urlOf(r)}
                  today={data.today}
                  onUndo={onUndo}
                  chips={
                    <>
                      {isExp ? (
                        <Chip tone={(r as ExpiringRow).daysLeft <= 3 ? "warn" : "plain"}>
                          {(r as ExpiringRow).daysLeft === 0 ? "오늘 끝" : `D-${(r as ExpiringRow).daysLeft}`}
                        </Chip>
                      ) : (
                        <Chip tone="warn">끝난 지 {(r as WinbackRow).daysSince}일</Chip>
                      )}
                      {r.firstTerm && <Chip tone="line">첫 수강권</Chip>}
                      {r.here && <Chip tone="here">지금 체육관</Chip>}
                    </>
                  }
                  sub={isExp ? expiringSub(r as ExpiringRow) : expiringSub({ ...(r as WinbackRow), daysLeft: 0 })}
                  say={isExp ? expiringSay(r as ExpiringRow) : winbackSay(r as WinbackRow)}
                  actions={
                    <>
                      <Pill strong disabled={busy} onClick={() => onContact?.(r, "talk", topic)}>
                        이야기함
                      </Pill>
                      <Pill disabled={busy} onClick={() => onContact?.(r, "notice", topic)}>
                        안내 보냄
                      </Pill>
                      {photoBtn(r)}
                    </>
                  }
                />
              );
            })}
          </ul>
        )}
        <MoreButton all={allExp} hidden={list.length - SHOW} onClick={() => setAllExp((v) => !v)} />
      </div>

      {/* ② 재미 위험 신규 */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-body font-black text-foreground">② 재미 위험 신규</h3>
          <span className="text-label text-muted-foreground">
            첫 4주 {data.counts.starters}명 · 늦음 {data.counts.startersBehind}명
          </span>
        </div>
        {shownSt.length === 0 ? (
          <p className="mt-3 text-label text-muted-foreground">지금 챙길 신규 회원이 없어요</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {shownSt.map((r) => {
              const rx = starterRx(r);
              const busy = busyId === r.userId;
              const pct = Math.round((Math.min(r.count, r.goal) / Math.max(1, r.goal)) * 100);
              return (
                <MemberRow
                  key={r.userId}
                  row={r}
                  url={urlOf(r)}
                  today={data.today}
                  onUndo={onUndo}
                  chips={
                    <>
                      {starterChips(r).map((c, i) => (
                        <Chip key={c} tone={i > 0 ? "warn" : r.reasons.includes("first") ? "here" : "plain"}>
                          {c}
                        </Chip>
                      ))}
                      {r.here && !r.reasons.includes("first") && <Chip tone="here">지금 체육관</Chip>}
                    </>
                  }
                  sub={`첫 4주 ${r.count}/${r.goal}번${r.lastDay && !r.reasons.includes("first") ? ` · 마지막 ${Number(r.lastDay.slice(5, 7))}/${Number(r.lastDay.slice(8, 10))}` : ""}`}
                  extra={
                    <div className="mt-1 h-1.5 w-full max-w-[12rem] rounded-full bg-secondary" aria-hidden>
                      <div className={cn("h-1.5 rounded-full", r.count >= r.expected ? "bg-primary" : "bg-amber-500")} style={{ width: `${pct}%` }} />
                    </div>
                  }
                  say={`처방 · ${rx.label}`}
                  actions={
                    <>
                      {rx.key === "note" ? (
                        <Pill strong disabled={busy} onClick={() => onNote?.(r)}>
                          <MessageCircle className="h-4 w-4" aria-hidden />
                          한마디
                        </Pill>
                      ) : (
                        <>
                          <Pill strong disabled={busy} onClick={() => onContact?.(r, "rx", "starter", rx.key)}>
                            처방함
                          </Pill>
                          <Pill disabled={busy} onClick={() => onNote?.(r)}>
                            <MessageCircle className="h-4 w-4" aria-hidden />
                            한마디
                          </Pill>
                        </>
                      )}
                      {photoBtn(r)}
                    </>
                  }
                />
              );
            })}
          </ul>
        )}
        <MoreButton all={allSt} hidden={starters.length - SHOW} onClick={() => setAllSt((v) => !v)} />
      </div>

      {/* 관장 · 관리자 — 이번 주 코치별 */}
      {data.team && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-body font-black text-foreground">이번 주 코치별</h3>
          {data.counts.untouchedD3 > 0 && (
            <p className={cn("mt-2 rounded-lg px-3 py-2 text-label font-bold", CHIP.warn)}>
              D-3 안인데 아무도 안 만난 회원 {data.counts.untouchedD3}명
            </p>
          )}
          {data.team.length === 0 ? (
            <p className="mt-2 text-label text-muted-foreground">이번 주 기록이 아직 없어요</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {data.team.map((t) => (
                <li key={t.staffUserId || t.name} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate text-label font-bold text-foreground">{t.name}</span>
                  <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                    이야기 {t.talk} · 안내 {t.notice} · 처방 {t.rx}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 관리자 — 얼굴 보이는 회원 · 동기화 */}
      {data.admin && (
        <div className="mt-3 border-t border-border pt-3 text-label text-muted-foreground">
          <p>{photoCoverage(data.counts).text}</p>
          {data.admin.syncAt && <p className="mt-0.5">출석 동기화 {kstHm(data.admin.syncAt)}</p>}
        </div>
      )}
    </section>
  );
};

const TOAST: Record<ContactKind, string> = { talk: "이야기함", notice: "안내 보냄", rx: "처방함" };

const LeaderHome = ({ className }: { className?: string }) => {
  const { user, profile, realRole, viewAsMember } = useAuth();
  const [params] = useSearchParams();
  const maybeStaff = !!user && !viewAsMember && (isStaffProfile(profile) || (!!realRole && realRole !== "member"));
  const demo = maybeStaff && params.get("demo") === "leader";
  const [branch, setBranch] = useState<string | null>(null);
  const q = useLeaderHome(branch, maybeStaff && !demo);
  useLeaderKpiRefresh(demo ? undefined : q.data);
  const data = demo ? LEADER_DEMO : q.data;
  const paths = useMemo(
    () => (data ? [...data.expiring, ...data.winback, ...data.starters].map((r) => r.photoPath).filter((p): p is string => !!p) : []),
    [data],
  );
  const urls = useCoachPhotoUrls(demo ? [] : paths);
  const contact = useLeaderContact();
  const undo = useLeaderUndo();
  const [photoFor, setPhotoFor] = useState<LeaderPhotoTarget | null>(null);
  const [noteFor, setNoteFor] = useState<StarterRow | null>(null);

  if (!maybeStaff || !data?.on) return null;

  const onContact = async (row: LeaderRow, kind: ContactKind, topic: LeaderTopic, rx?: RxKey) => {
    if (demo) {
      toast("예시 화면이에요");
      return;
    }
    try {
      await contact.mutateAsync({ member: row.userId, kind, topic, rx });
      toast.success(`${row.name}님 · ${TOAST[kind]} 남겼어요`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const onUndo = async (id: string) => {
    try {
      await undo.mutateAsync(id);
      toast.success("되돌렸어요");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const busyId = contact.isPending ? contact.variables?.member ?? null : null;
  const photoUrl = photoFor?.photoPath ? urls.data?.[photoFor.photoPath] ?? null : null;

  return (
    <>
      <LeaderHomeView
        data={data}
        photoUrls={urls.data}
        busyId={busyId}
        onContact={onContact}
        onUndo={demo ? undefined : onUndo}
        onPhoto={demo ? undefined : (r) => setPhotoFor({ userId: r.userId, name: r.name, photoPath: r.photoPath })}
        onNote={demo ? undefined : (r) => setNoteFor(r)}
        onBranch={(b) => setBranch(b)}
        className={className}
      />
      {!demo && (
        <>
          <LeaderPhotoSheet open={!!photoFor} onOpenChange={(v) => !v && setPhotoFor(null)} target={photoFor} photoUrl={photoUrl} />
          <OpsDayNoteSheet
            open={!!noteFor}
            onOpenChange={(v) => !v && setNoteFor(null)}
            target={noteFor ? { userId: noteFor.userId, name: noteFor.name, notes: [] } : null}
            onSaved={() => {
              if (noteFor) contact.mutate({ member: noteFor.userId, kind: "rx", topic: "starter", rx: "note" });
            }}
          />
        </>
      )}
    </>
  );
};

export default LeaderHome;
