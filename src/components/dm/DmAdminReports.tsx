/**
 * 본사 — 메시지 신고 확인 (2026-09-30 대표님: 신고 확인은 본사만).
 *
 * 신고할 때 남긴 최근 대화 50개 사본만 본다 — 신고되지 않은 대화는 본사도 볼 수 없다.
 * 처리: 문제 없음 · 7일/30일 보내기 제한 · 제한 풀기. 제한된 회원은 받은 메시지는 보고, 보내기만 막힌다.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { useDmReport, useDmReports, useResolveDmReport } from "@/hooks/useDm";
import {
  DM_ADMIN_ACTION_LABEL,
  dmReportReasonLabel,
  type DmAdminAction,
} from "@/services/dmService";
import { dmBubbleTime, dmListTime, dmUntilLabel } from "@/lib/dmTime";
import { shortBranch } from "@/lib/dmPeople";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";

/** 오늘이면 시각만, 아니면 날짜 + 시각 */
const whenLabel = (at: string) => {
  const d = dmListTime(at);
  const t = dmBubbleTime(at);
  return d === t ? t : `${d} ${t}`;
};

const ReportDetailSheet = ({ reportId, onClose }: { reportId: string | null; onClose: () => void }) => {
  const { data, isLoading, isError } = useDmReport(reportId);
  const resolve = useResolveDmReport();
  const [note, setNote] = useState("");
  // 다른 신고를 열면 메모를 비운다 (앞 신고에 쓰다 만 메모가 딸려 가지 않게)
  useEffect(() => setNote(""), [reportId]);

  const act = async (action: DmAdminAction) => {
    if (!reportId) return;
    try {
      await resolve.mutateAsync({ reportId, action, note });
      toast.success(`처리했어요 · ${DM_ADMIN_ACTION_LABEL[action]}`);
      setNote("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    }
  };

  const suspended = data?.reported.suspended_until ?? null;

  return (
    <DmSheet
      open={!!reportId}
      onClose={onClose}
      tall
      title={data ? `신고 · ${dmReportReasonLabel(data.reason)}` : "신고"}
      subtitle={data ? `${dmListTime(data.created_at)} 접수 · ${data.status === "open" ? "처리 전" : `처리 완료 (${data.action ? DM_ADMIN_ACTION_LABEL[data.action] : "-"})`}` : undefined}
      footer={
        data ? (
          <div className="space-y-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="처리 메모 (선택 · 본사만 봐요)"
              className="w-full rounded-xl bg-secondary/70 px-3.5 py-2.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="처리 메모"
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => act("dismiss")}
                disabled={resolve.isPending}
                className="h-11 rounded-xl bg-secondary text-[13px] font-bold text-foreground active:scale-[0.98] disabled:opacity-40"
              >
                문제 없음
              </button>
              <button
                type="button"
                onClick={() => act("suspend7")}
                disabled={resolve.isPending}
                className="h-11 rounded-xl bg-amber-500 text-[13px] font-bold text-white active:scale-[0.98] disabled:opacity-40"
              >
                7일 제한
              </button>
              <button
                type="button"
                onClick={() => act("suspend30")}
                disabled={resolve.isPending}
                className="h-11 rounded-xl bg-destructive text-[13px] font-bold text-white active:scale-[0.98] disabled:opacity-40"
              >
                30일 제한
              </button>
            </div>
            {suspended && (
              <button
                type="button"
                onClick={() => act("lift")}
                disabled={resolve.isPending}
                className="h-10 w-full rounded-xl text-[12.5px] font-bold text-primary active:scale-[0.99] disabled:opacity-40"
              >
                {dmUntilLabel(suspended)}까지 걸린 제한 풀기
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : isError || !data ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-8 text-center text-[13px] text-muted-foreground">신고를 열 수 없어요</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-secondary/60 px-3.5 py-3">
              <p className="text-[11px] font-bold text-muted-foreground">신고한 사람</p>
              <p className="truncate text-[14px] font-bold text-foreground">{data.reporter.display}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">{shortBranch(data.reporter.branch)}</p>
            </div>
            <div className="rounded-2xl bg-destructive/[0.07] px-3.5 py-3">
              <p className="text-[11px] font-bold text-destructive">신고된 사람</p>
              <p className="truncate text-[14px] font-bold text-foreground">{data.reported.display}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {shortBranch(data.reported.branch)}
                {suspended ? ` · ${dmUntilLabel(suspended)}까지 제한 중` : ""}
              </p>
            </div>
          </div>
          {data.detail && (
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-secondary/40 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
              “{data.detail}”
            </p>
          )}
          {data.note && <p className="mt-2 px-1 text-[12px] text-muted-foreground">처리 메모: {data.note}</p>}

          <h3 className="mb-2 mt-4 px-1 text-[12.5px] font-bold text-muted-foreground">
            신고할 때 남긴 대화 {data.messages.length}개
          </h3>
          {data.messages.length === 0 ? (
            <p className="rounded-2xl bg-muted/40 px-4 py-5 text-center text-[12.5px] text-muted-foreground">남은 메시지가 없어요</p>
          ) : (
            <ul className="space-y-1.5 pb-2">
              {data.messages.map((m, i) => {
                const reported = m.from === "reported";
                return (
                  <li key={i} className={cn("flex flex-col", reported ? "items-start" : "items-end")}>
                    <span className="mb-0.5 px-1 text-[10.5px] text-muted-foreground">
                      {reported ? data.reported.display : data.reporter.display} · {whenLabel(m.at)}
                    </span>
                    <span
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug",
                        reported ? "bg-destructive/[0.08] text-foreground ring-1 ring-destructive/20" : "bg-secondary text-foreground",
                      )}
                    >
                      {m.body}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </DmSheet>
  );
};

const DmAdminReports = () => {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useDmReports(status, true);
  const rows = data?.rows ?? [];

  return (
    <section aria-label="메시지 신고">
      <div className="mb-3 flex items-center gap-2">
        {(["open", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors active:scale-95",
              status === s ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
            )}
          >
            {s === "open" ? `처리 전${data && status === "open" ? ` ${data.open}` : ""}` : "처리 완료"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-card px-4 py-8 text-center shadow-elev-1">
          <p className="text-[14px] font-bold text-foreground">신고 목록을 불러오지 못했어요</p>
          <button type="button" onClick={() => refetch()} className="mt-3 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95">
            다시 불러오기
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card px-4 py-10 text-center shadow-elev-1">
          <ShieldAlert className="mx-auto h-7 w-7 text-muted-foreground/60" />
          <p className="mt-2 text-[14px] font-bold text-foreground">{status === "open" ? "처리할 신고가 없어요 👏" : "처리한 신고가 없어요"}</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">회원이 대화방에서 신고하면 여기로 와요</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left shadow-elev-1 active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-[1px] text-[10.5px] font-black",
                        r.status === "open" ? "bg-destructive text-white" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {dmReportReasonLabel(r.reason)}
                    </span>
                    <span className="truncate text-[14px] font-bold text-foreground">
                      {r.reporter.display} → {r.reported.display}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {shortBranch(r.reported.branch)} · {dmListTime(r.created_at)} · 대화 {r.message_count}개
                    {r.status === "resolved" && r.action ? ` · ${DM_ADMIN_ACTION_LABEL[r.action]}` : ""}
                    {r.reported.suspended_until ? ` · ${dmUntilLabel(r.reported.suspended_until)}까지 제한` : ""}
                  </span>
                  {r.detail && <span className="mt-1 line-clamp-2 block text-[12.5px] text-foreground/80">“{r.detail}”</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
        본사는 신고할 때 남긴 대화 사본만 볼 수 있어요. 신고되지 않은 대화는 본사도 볼 수 없어요.
      </p>

      <ReportDetailSheet reportId={openId} onClose={() => setOpenId(null)} />
    </section>
  );
};

export default DmAdminReports;
