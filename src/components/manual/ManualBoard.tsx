/**
 * 📘 153 매뉴얼 — 읽음 현황 (대표님 · 지점장님)
 *   코치님마다 필독 장 서명 n/필독 장 수(DB 1권 = 12) · 장마다 점(서명 · 새 판 · 안 읽음) · 마지막 서명 날짜
 *   누르면 장별 서명 날짜 · 다시 고른 횟수 · '읽어 주세요' 알림(사람마다 20시간에 한 번 — 서버 coach_manual_nudge)
 *   대표님은 지점을 고른다(서버 _strategy_scope) · 대표님 계정은 목록에 없다
 */
import { useMemo, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import type { ManualBook, ManualBoardPerson } from "@/lib/coachManual/types";
import { canNudge, latestRead, manualDate, personSummary } from "@/lib/coachManual/progress";
import { useManualBoard, useManualNudge } from "@/services/coachManualService";

export default function ManualBoard({ book }: { book: ManualBook }) {
  const [branch, setBranch] = useState<string | null>(null);
  const boardQ = useManualBoard(book.id, branch);
  const board = boardQ.data;
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      (board?.people ?? [])
        .map((p) => ({ p, s: personSummary(book, p.reads) }))
        .sort((a, b) => Number(a.p.me) - Number(b.p.me) || a.s.done - b.s.done || a.p.name.localeCompare(b.p.name, "ko")),
    [board, book],
  );
  const finished = rows.filter((r) => r.s.done === r.s.total).length;
  const open = rows.find((r) => r.p.user_id === openId) ?? null;

  if (boardQ.isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-24 animate-pulse rounded-3xl bg-card shadow-elev-1" />
        <div className="h-48 animate-pulse rounded-3xl bg-card shadow-elev-1" />
      </div>
    );
  }
  if (boardQ.isError || !board) {
    return (
      <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
        <p className="text-body font-bold text-foreground">읽음 현황을 불러오지 못했어요</p>
        <p className="mt-1.5 text-label text-muted-foreground">{(boardQ.error as Error | null)?.message ?? "잠시 뒤 다시 열어 주세요"}</p>
        <button
          type="button"
          onClick={() => void boardQ.refetch()}
          className="mt-4 rounded-2xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {board.branches.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {board.branches.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBranch(b)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-label font-bold active:scale-95",
                b === board.branch ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5">
        <p className="text-label font-bold text-muted-foreground">
          {board.branch} · {book.no} 필독 {rows[0]?.s.total ?? book.chapters.filter((c) => c.required).length}장
        </p>
        <p className="mt-1 text-title font-black tabular-nums text-foreground">
          {finished}
          <span className="text-heading font-bold text-muted-foreground"> / {rows.length}명 다 읽음</span>
        </p>
        {board.demo && (
          <p className="mt-2 text-label text-muted-foreground">미리보기 예시예요 — 실제 코치님 현황은 DB 를 적용하면 보여요</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card px-5 py-8 text-center text-body text-muted-foreground shadow-elev-1">
          이 지점에 코치님이 아직 없어요
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {rows.map(({ p, s }) => (
            <li key={p.user_id} className="border-b border-border/70 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(p.user_id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-secondary/60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-body font-black text-foreground">
                  {p.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-body font-black text-foreground">{p.name}</span>
                    <span className="shrink-0 text-label text-muted-foreground">{p.me ? "나" : p.title}</span>
                  </span>
                  <span className="mt-1.5 flex gap-1" aria-hidden>
                    {s.marks.map((m) => (
                      <span
                        key={m.id}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          m.state === "signed" ? "bg-primary" : m.state === "resign" ? "bg-reward" : "bg-secondary",
                        )}
                      />
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn("block text-body font-black tabular-nums", s.done === s.total ? "text-primary" : "text-foreground")}>
                    {s.done}/{s.total}
                  </span>
                  <span className="block text-micro font-bold text-muted-foreground">
                    {s.resign > 0 ? `새 판 ${s.resign}` : s.lastSignedAt ? manualDate(s.lastSignedAt) : "시작 전"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-label text-muted-foreground">점 하나가 필독 장 하나예요 · 민트 = 서명 · 금색 = 새 판이라 다시 서명</p>

      <PersonSheet book={book} person={open?.p ?? null} demo={board.demo} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PersonSheet({
  book,
  person,
  demo,
  onClose,
}: {
  book: ManualBook;
  person: ManualBoardPerson | null;
  demo: boolean;
  onClose: () => void;
}) {
  const nudge = useManualNudge(book.id);
  const s = person ? personSummary(book, person.reads) : null;
  const left = s ? s.total - s.done : 0;
  const nudgeOk = !!person && !person.me && left > 0 && canNudge(person.nudged_at);

  const send = () => {
    if (!person) return;
    nudge.mutate(
      { user: person.user_id, left },
      {
        onSuccess: (r) => {
          if (r === "sent") toast.success(`${person.name}님께 알림을 보냈어요`);
          else if (r === "too_soon") toast.message("오늘 이미 보냈어요 · 20시간 뒤에 다시 보낼 수 있어요");
          else toast.message("미리보기에서는 알림이 가지 않아요");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <DmSheet
      open={!!person}
      onClose={onClose}
      title={person ? `${person.name} ${person.me ? "· 나" : person.title}` : ""}
      subtitle={s ? `${book.no} 필독 ${s.done}/${s.total}장 서명${s.resign ? ` · 새 판 ${s.resign}장` : ""}` : undefined}
      footer={
        person && !person.me ? (
          <button
            type="button"
            disabled={!nudgeOk || nudge.isPending || demo}
            onClick={send}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-40"
          >
            <Bell className="h-4 w-4" />
            {left === 0
              ? "다 읽었어요"
              : !canNudge(person.nudged_at)
                ? `${manualDate(person.nudged_at)} 보냄 · 20시간에 한 번`
                : demo
                  ? "미리보기에서는 보내지 않아요"
                  : "읽어 주세요 알림 보내기"}
          </button>
        ) : undefined
      }
    >
      {person && (
        <ul className="space-y-1.5 pb-2">
          {book.chapters
            .filter((c) => c.required)
            .map((c) => {
              const r = latestRead(person.reads, c.id);
              const st = !r ? "none" : r.version >= c.version ? "signed" : "resign";
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-3.5 py-2.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      st === "signed" ? "bg-primary" : st === "resign" ? "bg-reward" : "bg-border",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-foreground">
                      {c.no} · {c.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-label font-bold text-muted-foreground">
                    {st === "none"
                      ? "안 읽음"
                      : `${manualDate(r!.signed_at)}${st === "resign" ? " · 새 판" : ""}${r!.quiz_tries > 0 ? ` · 다시 ${r!.quiz_tries}` : ""}`}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </DmSheet>
  );
}
