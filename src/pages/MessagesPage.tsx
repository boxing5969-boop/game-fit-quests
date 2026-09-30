/**
 * 메시지(DM) 받은함 — /messages (2026-09-30 대표님: "인스타그램처럼 DM").
 *
 * 탭: 대화 · 요청(같은 지점 회원이 처음 보낸 메시지 — 수락하면 대화) · 신고(본사 계정만)
 * 오른쪽 위: 설정(메시지 요청 받기·차단 목록) · 새 메시지(보낼 사람 고르기)
 * 탭은 주소(?tab=)에 남겨 대화방에서 돌아와도 그대로.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Settings, SquarePen } from "lucide-react";

import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { useDmSettings, useDmSummary, useDmThreads } from "@/hooks/useDm";
import { openCredentialChange } from "@/lib/appEvents";
import { dmListTime, dmUntilLabel } from "@/lib/dmTime";
import { cn } from "@/lib/utils";
import type { DmThreadRow } from "@/services/dmService";
import { DmAvatar, DmKindBadge } from "@/components/dm/DmParts";
import NewMessageSheet from "@/components/dm/NewMessageSheet";
import DmSettingsSheet from "@/components/dm/DmSettingsSheet";
import DmAdminReports from "@/components/dm/DmAdminReports";

type Tab = "inbox" | "requests" | "reports";

const previewLine = (r: DmThreadRow): string => {
  const text = r.last_preview ?? "";
  if (r.status === "request" && r.i_am_initiator) return `수락 대기 중 · ${text}`;
  return r.last_from_me ? `나: ${text}` : text;
};

const ThreadRow = ({ r, onOpen }: { r: DmThreadRow; onOpen: () => void }) => {
  const unread = r.unread > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary/70"
      >
        <DmAvatar person={r.peer} size={50} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn("truncate text-[15px] text-foreground", unread ? "font-extrabold" : "font-bold")}>
              {r.peer?.display ?? "알 수 없는 회원"}
            </span>
            <DmKindBadge kind={r.peer?.kind} />
          </span>
          <span
            className={cn(
              "mt-0.5 block truncate text-[13px]",
              unread ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {previewLine(r)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 self-stretch pt-0.5">
          <span className="text-[11.5px] text-muted-foreground">{dmListTime(r.last_message_at)}</span>
          {unread ? (
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black leading-none text-primary-foreground">
              {r.unread > 99 ? "99+" : r.unread}
            </span>
          ) : r.seen ? (
            <span className="text-[11px] font-medium text-muted-foreground">읽음</span>
          ) : null}
        </span>
      </button>
    </li>
  );
};

const ListSkeleton = () => (
  <ul className="overflow-hidden rounded-3xl bg-card shadow-elev-1" aria-hidden>
    {[0, 1, 2].map((i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-3">
        <span className="h-[50px] w-[50px] animate-pulse rounded-full bg-muted" />
        <span className="flex-1 space-y-2">
          <span className="block h-4 w-28 animate-pulse rounded bg-muted" />
          <span className="block h-3 w-44 animate-pulse rounded bg-muted" />
        </span>
      </li>
    ))}
  </ul>
);

const MessagesPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: summary } = useDmSummary();
  const isHq = summary?.kind === "hq";
  // 메시지 요청은 회원끼리만 생긴다 — 코치님·본사 계정에는 요청 탭이 없다
  const isMember = summary?.kind === "member";
  const raw = params.get("tab");
  const tab: Tab = (raw === "requests" && (isMember || !summary)) || (raw === "reports" && isHq) ? raw : "inbox";
  const setTab = (t: Tab) => setParams(t === "inbox" ? {} : { tab: t }, { replace: true });

  const inbox = useDmThreads("inbox");
  const requests = useDmThreads("requests");
  const { data: settings } = useDmSettings();
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  const requestCount = requests.data?.requests ?? summary?.requests ?? 0;
  const newRequests = summary?.new_requests ?? 0;
  const reportCount = summary?.open_reports ?? 0;
  const disabled = summary ? !summary.enabled : false;
  const active = tab === "requests" ? requests : inbox;
  const rows = active.data?.rows ?? [];

  const tabs: Array<{ value: Tab; label: string; badge: number; urgent?: boolean }> = [
    { value: "inbox", label: "대화", badge: summary?.unread_threads ?? 0 },
    ...(isMember || !summary
      ? [{ value: "requests" as const, label: requestCount > 0 ? `요청 ${requestCount}` : "요청", badge: newRequests }]
      : []),
    ...(isHq ? [{ value: "reports" as const, label: reportCount > 0 ? `신고 ${reportCount}` : "신고", badge: reportCount, urgent: true }] : []),
  ];

  return (
    <AppPage
      header={
        <PageHeader
          title="메시지"
          subtitle={isHq ? "본사 · 전 지점 회원·코치님과 1:1" : "같은 지점 회원 · 코치님과 1:1 대화"}
          leftAction={
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          rightAction={
            disabled ? undefined : (
              <>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="메시지 설정"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
                >
                  <Settings className="h-[17px] w-[17px] text-secondary-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => setNewOpen(true)}
                  aria-label="새 메시지"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground transition-transform active:scale-95"
                >
                  <SquarePen className="h-[17px] w-[17px] text-background" />
                </button>
              </>
            )
          }
          sticky
        />
      }
    >
      {disabled ? (
        <div className="mt-6 rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
          <p className="text-[34px]" aria-hidden>
            ✉️
          </p>
          <p className="mt-2 text-[15px] font-bold text-foreground">지점 회원·코치님만 메시지를 쓸 수 있어요</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">지점 등록이 확인되면 바로 열려요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summary?.suspended_until && (
            <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-[12.5px] leading-snug text-amber-800 dark:text-amber-300">
              신고 처리로 {dmUntilLabel(summary.suspended_until)}까지 메시지를 보낼 수 없어요. 받은 메시지는 그대로 볼 수 있어요.
            </p>
          )}
          {settings?.reason === "change_credentials" && (
            <button
              type="button"
              onClick={openCredentialChange}
              className="w-full rounded-2xl bg-primary/10 px-4 py-3 text-left text-[12.5px] leading-snug text-foreground active:scale-[0.99]"
            >
              {settings.reason_text}
              <span className="font-bold text-primary"> 지금 바꾸기 →</span>
            </button>
          )}

          {/* 탭 — 대화 · 요청 · (본사) 신고 */}
          <div role="tablist" className="flex gap-1 rounded-full bg-secondary p-1">
            {tabs.map((t) => {
              const on = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => !on && setTab(t.value)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-[13.5px] font-bold transition-all active:scale-[0.98]",
                    on ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
                  )}
                >
                  {t.label}
                  {t.badge > 0 && !on && (
                    <span
                      className={cn(
                        "ml-0.5 h-[7px] w-[7px] rounded-full",
                        t.urgent ? "bg-destructive" : "bg-primary",
                      )}
                      aria-label="새 소식"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {tab === "reports" ? (
            <DmAdminReports />
          ) : active.isLoading ? (
            <ListSkeleton />
          ) : active.isError && !active.data ? (
            <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
              <p className="text-[14px] font-bold text-foreground">메시지를 불러오지 못했어요</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">인터넷 연결을 확인하고 다시 눌러 주세요</p>
              <button
                type="button"
                onClick={() => active.refetch()}
                className="mt-4 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95"
              >
                다시 불러오기
              </button>
            </div>
          ) : rows.length === 0 ? (
            tab === "requests" ? (
              <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
                <p className="text-[15px] font-bold text-foreground">새 메시지 요청이 없어요</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  같은 지점 회원이 처음 보낸 메시지는 여기로 와요.
                  <br />
                  수락하면 대화가 시작되고, 삭제해도 상대에게 알리지 않아요.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
                <p className="text-[34px]" aria-hidden>
                  🥊
                </p>
                <p className="mt-2 text-[15px] font-bold text-foreground">아직 나눈 대화가 없어요</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  같은 지점 회원·코치님께 먼저 인사해 보세요.
                  <br />
                  랭킹에서 회원을 눌러도 메시지를 보낼 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setNewOpen(true)}
                  className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-5 text-[14px] font-bold text-background active:scale-[0.98]"
                >
                  <SquarePen className="h-4 w-4" /> 새 메시지
                </button>
              </div>
            )
          ) : (
            <ul className="overflow-hidden rounded-3xl bg-card py-1 shadow-elev-1">
              {rows.map((r) => (
                <ThreadRow key={r.thread_id} r={r} onOpen={() => navigate(`/messages/${r.thread_id}`)} />
              ))}
            </ul>
          )}

          {tab !== "reports" && (
            <p className="px-1 pt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              {tab === "requests"
                ? "처음 보낸 사람은 수락 전까지 메시지를 1개만 보낼 수 있어요."
                : "글자·이모지로 대화해요 · 불편한 메시지는 대화방 ⋯ 에서 신고하면 본사가 확인해요."}
            </p>
          )}
        </div>
      )}

      <NewMessageSheet open={newOpen} onClose={() => setNewOpen(false)} />
      <DmSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppPage>
  );
};

export default MessagesPage;
