/**
 * 📢 공지사항 — 일일경영리포트(153OS) '공지사항'에서 쓴 글 (2026-11-02 대표님 「둘 다 차례로」 · 153OS 33단계 앱 연결)
 *
 *   /notices      목록 — 고정 먼저 · 최신순, 우리 지점 공지 + 전 지점 공지(153OS 가 게시 중인 것만 보낸다)
 *   /notices/:id  한 글 — 153OS 공지 알림(notice:<id>)을 누르면 여기로
 * 글은 153OS 에만 있다 — Edge Function os-app-content(op notices · notice)가 그 회원 지점 것만 가져온다.
 *
 *   (2026-11-15 선릉역점 봄 회원 제안 · 대표님 「공지사항 안 '앱 업데이트' 칸」) 목록 위 두 칸 [지점 공지 | 앱 업데이트]
 *   · 앱 업데이트 = src/data/appUpdates.ts(앱과 함께 배포 — 153OS 와 안 이어진 회원도 보인다) · components/notices/AppUpdatesList
 *   · /notices?tab=updates 로 바로 · 아직 안 본 업데이트가 있으면 처음부터 그 칸(빨간 점 — 휴대폰 알림은 안 보낸다)
 */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, Megaphone, Pin } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { OsBackButton, OsChip, OsEmpty, OsErrorState, OsLoading } from "@/components/os/OsParts";
import AppUpdatesList from "@/components/notices/AppUpdatesList";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { useOsNotice, useOsNotices } from "@/services/osContentService";
import { dmDayLabel, dmListTime } from "@/lib/dmTime";
import type { OsNotice } from "@/lib/osContent";
import { cn } from "@/lib/utils";

function NoticeChips({ n }: { n: Pick<OsNotice, "pinned" | "scope"> }) {
  if (!n.pinned && n.scope !== "all") return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {n.pinned && (
        <OsChip tone="primary">
          <Pin className="mr-0.5 h-3 w-3" aria-hidden />
          고정
        </OsChip>
      )}
      {n.scope === "all" && <OsChip>전 지점</OsChip>}
    </span>
  );
}

function NoticeList() {
  const navigate = useNavigate();
  const list = useOsNotices();
  if (list.isLoading) return <OsLoading label="공지 불러오는 중" />;
  if (list.isError) return <OsErrorState error={list.error} onRetry={() => list.refetch()} what="공지사항" />;
  const rows = list.data ?? [];
  if (!rows.length) {
    return (
      <OsEmpty
        icon={<Megaphone className="h-7 w-7 text-muted-foreground" />}
        title="아직 공지가 없어요"
        line="지점 소식 · 휴관 안내 · 이벤트가 여기에 올라와요"
      />
    );
  }
  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-elev-1">
      {rows.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => navigate(`/notices/${n.id}`)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary/70"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <NoticeChips n={n} />
                <span className="ml-auto shrink-0 text-micro tabular-nums text-muted-foreground">{dmListTime(n.publish_at)}</span>
              </span>
              <span className="mt-1 block line-clamp-2 text-body font-bold leading-snug text-foreground">{n.title}</span>
              {n.preview && <span className="mt-0.5 block truncate text-label text-muted-foreground">{n.preview}</span>}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="열기" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function NoticeDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const q = useOsNotice(id);
  if (q.isLoading) return <OsLoading rows={1} label="공지 불러오는 중" />;
  if (q.isError) {
    const gone = (q.error as { code?: string } | null)?.code === "NOT_FOUND";
    if (gone) {
      return (
        <OsEmpty
          icon={<Megaphone className="h-7 w-7 text-muted-foreground" />}
          title="내려간 공지예요"
          line="게시 기간이 끝났거나 지점에서 내렸어요"
        />
      );
    }
    return <OsErrorState error={q.error} onRetry={() => q.refetch()} what="공지사항" />;
  }
  const n = q.data;
  if (!n) return null;
  return (
    <>
      <article className="rounded-2xl bg-card p-5 shadow-elev-1">
        <NoticeChips n={n} />
        <h2 className="mt-2 break-words text-title font-bold leading-snug text-foreground">{n.title}</h2>
        <p className="mt-1.5 text-label text-muted-foreground">{dmDayLabel(n.publish_at)}</p>
        <div className="my-4 h-px bg-border/70" />
        <p className="whitespace-pre-line break-words text-body leading-relaxed text-foreground">{n.body}</p>
      </article>
      <button
        type="button"
        onClick={() => navigate("/notices")}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-card text-body font-bold text-foreground shadow-elev-1 active:scale-[0.99]"
      >
        공지 목록
      </button>
    </>
  );
}

type NoticeTab = "notices" | "updates";
const TABS: readonly (readonly [NoticeTab, string])[] = [
  ["notices", "지점 공지"],
  ["updates", "앱 업데이트"],
];

/** 목록 — [지점 공지 | 앱 업데이트] */
function NoticeTabs() {
  const [params, setParams] = useSearchParams();
  const { hasNew } = useAppUpdates();
  // 처음 칸은 한 번만 정한다 — 앱 업데이트 칸을 열면 본 것으로 남아 빨간 점이 꺼지기 때문
  const [tab, setTab] = useState<NoticeTab>(() => {
    const q = params.get("tab");
    return q === "updates" || (q !== "notices" && hasNew) ? "updates" : "notices";
  });
  const pick = (t: NoticeTab) => {
    setTab(t);
    const next = new URLSearchParams(params);
    if (t === "updates") next.set("tab", "updates");
    else next.delete("tab");
    setParams(next, { replace: true });
  };
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1" role="tablist" aria-label="공지사항">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => pick(key)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-label font-bold transition-colors",
              tab === key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {label}
            {key === "updates" && hasNew && tab !== "updates" && (
              <span className="h-2 w-2 rounded-full bg-destructive" aria-label="새 업데이트" />
            )}
          </button>
        ))}
      </div>
      {tab === "updates" ? <AppUpdatesList /> : <NoticeList />}
    </>
  );
}

const NoticesPage = () => {
  const { id } = useParams<{ id?: string }>();
  return (
    <AppPage
      header={
        <PageHeader
          title="공지사항"
          sticky
          leftAction={<OsBackButton fallback={id ? "/notices" : "/home"} />}
        />
      }
    >
      {id ? <NoticeDetail id={id} /> : <NoticeTabs />}
    </AppPage>
  );
};

export default NoticesPage;
