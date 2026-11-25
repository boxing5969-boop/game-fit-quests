/**
 * 🎥 스파링 영상 — 훈련 탭 「오늘 할 것」 한 줄 (2026-11-25 · docs/features/64-스파링-영상.md)
 *   · 레벨 · 리그 상관없이 모든 회원 (2026-11-25 대표님 「레벨이랑 상관없이 회원님들이 본인의 영상과 다른 회원님들의 영상을 볼수있도록」)
 *   · 두 칸: 「내 영상」(내가 나온 영상 · 코치 피드백 · 공개 켜기) / 「우리 지점」(같은 지점 · 나온 사람이 모두 공개에 동의한 영상만)
 *   · 둘 다 비어 있으면 줄을 그리지 않는다.
 *   · 주소 `/missions?sparvid=<영상 id>` → 그 영상, `?sparvid=1`(전체 메뉴 「스파링 영상」) → 목록. 연 뒤 주소에서 지운다.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Video, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { thumbOf, whenLabel } from "@/lib/sparringVideo";
import { useMySparringVideos, useSharedVideos, type MyVideo, type SharedVideo } from "@/services/sparringVideoService";
import SparringVideoSheet, { type SheetVideo } from "./SparringVideoSheet";

type Tab = "mine" | "branch";

const fromMine = (v: MyVideo): SheetVideo => ({
  video_id: v.video_id,
  provider: v.provider,
  external_id: v.external_id,
  title: v.title,
  recorded_at: v.recorded_at,
  opponent_name: v.opponent_name,
  my_share_ok: v.my_share_ok,
  others_share_ok: v.others_share_ok,
  is_mine: true,
});

const fromShared = (v: SharedVideo): SheetVideo => ({
  video_id: v.video_id,
  provider: v.provider,
  external_id: v.external_id,
  title: v.title,
  recorded_at: v.recorded_at,
  names: v.names,
  is_mine: v.is_mine,
  my_share_ok: v.my_share_ok,
  others_share_ok: v.is_mine ? true : null,
});

const Row = ({
  thumb,
  title,
  when,
  note,
  noteStrong,
  badge,
  onClick,
}: {
  thumb: string | null;
  title: string;
  when: string;
  note: string;
  noteStrong?: boolean;
  badge?: string;
  onClick: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left active:scale-[0.99]"
    >
      <span className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
        {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body font-bold text-foreground">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-micro font-bold text-primary">{badge}</span>
          )}
        </span>
        <span className="block truncate text-label text-muted-foreground">{when}</span>
        <span className={cn("block truncate text-label", noteStrong ? "font-bold text-primary" : "text-muted-foreground")}>{note}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  </li>
);

const ListSheet = ({
  mine,
  shared,
  tab,
  setTab,
  onPick,
  onClose,
}: {
  mine: MyVideo[];
  shared: SharedVideo[];
  tab: Tab;
  setTab: (t: Tab) => void;
  onPick: (v: SheetVideo) => void;
  onClose: () => void;
}) => {
  useModalDismiss(true, onClose, { back: true });
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="스파링 영상" className="fixed inset-0 z-[118] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Video className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-heading text-foreground">스파링 영상</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="tablist" aria-label="내 영상 · 우리 지점">
        {(
          [
            ["mine", `내 영상 ${mine.length}`],
            ["branch", `우리 지점 ${shared.length}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "h-9 rounded-full text-label font-bold transition-all",
              tab === k ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {tab === "mine" ? (
          mine.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-label text-muted-foreground">
              아직 내 영상이 없어요 · 스파링 동의서에서 영상 촬영을 고르면 내 경기가 여기로 와요
            </p>
          ) : (
            <ul className="space-y-2">
              {mine.map((v) => (
                <Row
                  key={v.video_id}
                  thumb={thumbOf(v.provider, v.external_id)}
                  title={v.opponent_name ? `vs ${v.opponent_name}` : "스파링"}
                  when={whenLabel(v.recorded_at)}
                  note={v.comment_count > 0 ? `코치 피드백 ${v.comment_count}` : "피드백 기다리는 중"}
                  noteStrong={v.comment_count > 0}
                  badge={v.my_share_ok && v.others_share_ok ? "공개" : undefined}
                  onClick={() => onPick(fromMine(v))}
                />
              ))}
            </ul>
          )
        ) : (
          <>
            <p className="mb-2 text-label text-muted-foreground">같이 나온 회원 모두가 공개에 동의한 영상만 보여요</p>
            {shared.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-label text-muted-foreground">
                아직 공개된 영상이 없어요
              </p>
            ) : (
              <ul className="space-y-2">
                {shared.map((v) => (
                  <Row
                    key={v.video_id}
                    thumb={thumbOf(v.provider, v.external_id)}
                    title={v.names ?? "스파링"}
                    when={whenLabel(v.recorded_at)}
                    note={v.is_mine ? "내가 나온 영상" : "스파링"}
                    badge={v.is_mine ? "나" : undefined}
                    onClick={() => onPick(fromShared(v))}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

const SparringVideoEntry = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const want = params.get("sparvid");
  const mineQ = useMySparringVideos(!!user);
  const sharedQ = useSharedVideos(!!user);
  const mine = useMemo(() => mineQ.data ?? [], [mineQ.data]);
  const shared = useMemo(() => sharedQ.data ?? [], [sharedQ.data]);
  const ready = mineQ.isFetched && sharedQ.isFetched;
  const [listOpen, setListOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("mine");
  const [openVideo, setOpenVideo] = useState<SheetVideo | null>(null);

  // 알림 · 전체 메뉴로 들어오면 그 영상(또는 목록)을 연다
  useEffect(() => {
    if (!want || !ready) return;
    const m = mine.find((v) => v.video_id === want);
    const s = shared.find((v) => v.video_id === want);
    if (m) setOpenVideo(fromMine(m));
    else if (s) setOpenVideo(fromShared(s));
    else {
      setTab(mine.length > 0 ? "mine" : "branch");
      setListOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("sparvid");
    setParams(next, { replace: true });
  }, [want, ready, mine, shared, params, setParams]);

  const fb = mine.reduce((n, v) => n + (v.comment_count > 0 ? 1 : 0), 0);
  const show = mine.length + shared.length > 0;

  return (
    <>
      {show && (
        <button
          type="button"
          onClick={() => {
            setTab(mine.length > 0 ? "mine" : "branch");
            setListOpen(true);
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-all active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Video className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-bold text-foreground">스파링 영상</span>
            <span className="block truncate text-label text-muted-foreground">
              내 영상 {mine.length} · 우리 지점 {shared.length}
              {fb > 0 ? ` · 피드백 온 영상 ${fb}` : ""}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      )}
      {listOpen && (
        <ListSheet mine={mine} shared={shared} tab={tab} setTab={setTab} onPick={setOpenVideo} onClose={() => setListOpen(false)} />
      )}
      <SparringVideoSheet video={openVideo} onClose={() => setOpenVideo(null)} />
    </>
  );
};

export default SparringVideoEntry;
