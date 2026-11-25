/**
 * 🎥 훈련 영상 — 훈련 탭 「오늘 할 것」 한 줄 (2026-11-25 · docs/features/64-스파링-영상.md)
 *   · 레벨 · 리그 상관없이 모든 회원 (2026-11-25 대표님 「레벨이랑 상관없이 회원님들이 본인의 영상과 다른 회원님들의 영상을 볼수있도록」)
 *   · 2026-11-26 회원이 직접 올리기(인스타처럼) — 대표님 「일단은 인스타그램처럼 회원님들 스스로가 직접 올리는 기능만 활성화해놓고
 *     노트북 카메라 등등 준비되면 시작하자」 → 줄은 늘 보이고 「+ 올리기」(VideoUploadSheet)
 *   · 칸: 「우리 지점」(같은 지점 · 나온 사람이 모두 공개를 켠 영상) / 「내 영상」(내가 나오거나 올린 영상 · 피드백 · 가려짐)
 *     / 「코치 확인」(코치 · 지점장만 — 신고로 가려진 영상 · 피드백 요청)
 *   · 주소 `/missions?sparvid=<영상 id>` → 그 영상, `?sparvid=1`(전체 메뉴 「훈련 영상」 · 신고 알림) → 목록. 연 뒤 주소에서 지운다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Film, Plus, Video, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import { cn } from "@/lib/utils";
import { kindLabel, thumbOf, whenLabel } from "@/lib/sparringVideo";
import {
  useFeedbackRequests,
  useMySparringVideos,
  usePosterUrls,
  useReported,
  useSharedVideos,
  type FeedbackRequest,
  type MyVideo,
  type ReportedVideo,
  type SharedVideo,
} from "@/services/sparringVideoService";
import SparringVideoSheet, { type SheetVideo } from "./SparringVideoSheet";
import VideoUploadSheet from "./VideoUploadSheet";

type Tab = "branch" | "mine" | "coach";

const fromMine = (v: MyVideo): SheetVideo => ({
  video_id: v.video_id,
  provider: v.provider,
  external_id: v.external_id,
  kind: v.kind,
  title: v.title,
  caption: v.caption,
  recorded_at: v.recorded_at,
  opponent_name: v.opponent_name,
  my_share_ok: v.my_share_ok,
  others_share_ok: v.others_share_ok,
  is_mine: true,
  is_upload: !!v.is_upload,
  status: v.status ?? "ready",
});

const fromShared = (v: SharedVideo, staff: boolean): SheetVideo => ({
  video_id: v.video_id,
  provider: v.provider,
  external_id: v.external_id,
  kind: v.kind,
  title: v.title,
  caption: v.caption,
  recorded_at: v.recorded_at,
  names: v.names,
  is_mine: v.is_mine,
  my_share_ok: v.my_share_ok,
  others_share_ok: v.is_mine ? true : null,
  staff_view: staff,
});

const fromReported = (v: ReportedVideo): SheetVideo => ({
  video_id: v.video_id,
  provider: v.provider,
  external_id: v.external_id,
  kind: v.kind,
  caption: v.caption,
  recorded_at: v.recorded_at,
  names: v.names,
  is_mine: false,
  status: "hidden",
  reasons: v.reasons,
  staff_view: true,
});

const fromRequest = (v: FeedbackRequest): SheetVideo => ({
  video_id: v.video_id,
  provider: v.provider,
  external_id: v.external_id,
  kind: v.kind,
  caption: v.caption,
  recorded_at: v.recorded_at,
  names: v.names,
  is_mine: false,
  staff_view: true,
});

const isPublic = (v: MyVideo) => v.my_share_ok && v.others_share_ok !== false;

const Row = ({
  thumb,
  title,
  sub,
  note,
  noteStrong,
  badge,
  badgeWarn,
  onClick,
}: {
  thumb: string | null;
  title: string;
  sub: string;
  note?: string;
  noteStrong?: boolean;
  badge?: string;
  badgeWarn?: boolean;
  onClick: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left active:scale-[0.99]"
    >
      <span className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Film className="h-6 w-6 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body font-bold text-foreground">{title}</span>
          {badge && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-micro font-bold",
                badgeWarn ? "bg-amber-100 text-amber-800" : "bg-primary/15 text-primary",
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="block truncate text-label text-muted-foreground">{sub}</span>
        {note && (
          <span className={cn("block truncate text-label", noteStrong ? "font-bold text-primary" : "text-muted-foreground")}>{note}</span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  </li>
);

const Empty = ({ children }: { children: string }) => (
  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-label leading-relaxed text-muted-foreground">{children}</p>
);

const ListSheet = ({
  mine,
  shared,
  reported,
  requests,
  coach,
  posters,
  tab,
  setTab,
  onPick,
  onUpload,
  onClose,
}: {
  mine: MyVideo[];
  shared: SharedVideo[];
  reported: ReportedVideo[];
  requests: FeedbackRequest[];
  coach: boolean;
  posters: Record<string, string>;
  tab: Tab;
  setTab: (t: Tab) => void;
  onPick: (v: SheetVideo) => void;
  onUpload: () => void;
  onClose: () => void;
}) => {
  useModalDismiss(true, onClose, { back: true });
  const thumb = (provider: string, externalId: string, poster?: string | null) =>
    provider === "storage" ? (poster ? (posters[poster] ?? null) : null) : thumbOf(provider, externalId);
  const waiting = requests.filter((r) => r.comment_count === 0).length;
  const tabs: [Tab, string][] = [
    ["branch", `우리 지점 ${shared.length}`],
    ["mine", `내 영상 ${mine.length}`],
  ];
  if (coach) tabs.push(["coach", `코치 확인 ${reported.length + waiting}`]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="훈련 영상" className="fixed inset-0 z-[118] flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Video className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-heading text-foreground">훈련 영상</p>
        <button
          type="button"
          onClick={onUpload}
          className="flex h-10 items-center gap-1 rounded-full bg-primary px-3.5 text-label font-bold text-primary-foreground active:scale-95"
        >
          <Plus className="h-4 w-4" /> 올리기
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className={cn("mx-4 mb-3 grid gap-1 rounded-full bg-secondary p-1", coach ? "grid-cols-3" : "grid-cols-2")}
        role="tablist"
        aria-label="훈련 영상 칸"
      >
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "h-9 truncate rounded-full px-1 text-label font-bold transition-all",
              tab === k ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {tab === "branch" && (
          <>
            <p className="mb-2 text-label text-muted-foreground">우리 지점 회원이 공개로 올린 영상이에요</p>
            {shared.length === 0 ? (
              <Empty>아직 공개된 영상이 없어요 · 「+ 올리기」로 첫 영상을 올려 보세요</Empty>
            ) : (
              <ul className="space-y-2">
                {shared.map((v) => (
                  <Row
                    key={v.video_id}
                    thumb={thumb(v.provider, v.external_id, v.poster_path)}
                    title={v.caption || v.names || `${kindLabel(v.kind)} 영상`}
                    sub={`${whenLabel(v.recorded_at)} · ${kindLabel(v.kind)}`}
                    note={v.caption ? (v.names ?? undefined) : v.is_mine ? "내가 나온 영상" : undefined}
                    badge={v.is_mine ? "나" : undefined}
                    onClick={() => onPick(fromShared(v, coach))}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "mine" &&
          (mine.length === 0 ? (
            <Empty>아직 내 영상이 없어요 · 미트 · 스파링 영상을 올리고 코치님 피드백을 받아 보세요</Empty>
          ) : (
            <ul className="space-y-2">
              {mine.map((v) => {
                const hidden = v.status === "hidden";
                const upload = !!v.is_upload;
                return (
                  <Row
                    key={v.video_id}
                    thumb={thumb(v.provider, v.external_id, v.poster_path)}
                    title={v.caption || (upload ? `${kindLabel(v.kind)} 영상` : v.opponent_name ? `vs ${v.opponent_name}` : "스파링")}
                    sub={`${whenLabel(v.recorded_at)} · ${kindLabel(v.kind)}`}
                    note={
                      hidden
                        ? "신고가 들어와 코치님이 확인하고 있어요"
                        : v.comment_count > 0
                          ? `코치 피드백 ${v.comment_count}`
                          : !upload || v.want_feedback
                            ? "피드백 기다리는 중"
                            : isPublic(v)
                              ? "우리 지점에 공개"
                              : "나만 보기"
                    }
                    noteStrong={!hidden && v.comment_count > 0}
                    badge={hidden ? "가려짐" : isPublic(v) ? "공개" : undefined}
                    badgeWarn={hidden}
                    onClick={() => onPick(fromMine(v))}
                  />
                );
              })}
            </ul>
          ))}

        {tab === "coach" && (
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-body font-bold text-foreground">🚩 신고 {reported.length > 0 ? reported.length : ""}</p>
              {reported.length === 0 ? (
                <Empty>신고로 가려진 영상이 없어요</Empty>
              ) : (
                <ul className="space-y-2">
                  {reported.map((v) => (
                    <Row
                      key={v.video_id}
                      thumb={thumb(v.provider, v.external_id, v.poster_path)}
                      title={v.caption || v.names || `${kindLabel(v.kind)} 영상`}
                      sub={`${whenLabel(v.recorded_at)} · ${v.names ?? kindLabel(v.kind)}`}
                      note={v.reasons?.length ? `신고 이유: ${Array.from(new Set(v.reasons)).join(" · ")}` : undefined}
                      badge="가려짐"
                      badgeWarn
                      onClick={() => onPick(fromReported(v))}
                    />
                  ))}
                </ul>
              )}
            </section>
            <section>
              <p className="mb-2 text-body font-bold text-foreground">
                피드백 요청 {requests.length > 0 ? requests.length : ""}
                {waiting > 0 && <span className="ml-1 text-label font-bold text-primary">· 기다리는 영상 {waiting}</span>}
              </p>
              {requests.length === 0 ? (
                <Empty>회원이 「코치님 피드백 받기」를 켜고 올린 영상이 여기에 모여요</Empty>
              ) : (
                <ul className="space-y-2">
                  {requests.map((v) => (
                    <Row
                      key={v.video_id}
                      thumb={thumb(v.provider, v.external_id, v.poster_path)}
                      title={v.caption || v.names || `${kindLabel(v.kind)} 영상`}
                      sub={`${whenLabel(v.recorded_at)} · ${v.names ?? ""} · ${kindLabel(v.kind)}`}
                      note={v.comment_count > 0 ? `피드백 ${v.comment_count}개 보냄` : "피드백 기다리는 중"}
                      noteStrong={v.comment_count === 0}
                      badge={v.share_ok ? undefined : "나만 보기"}
                      onClick={() => onPick(fromRequest(v))}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

const SparringVideoEntry = () => {
  const { user, role, profile } = useAuth();
  // 코치 · 지점장 칸은 서버가 다시 본다 — 여기서는 부를지 말지만 (BoxingTimerSheet 와 같은 기준)
  const staffGuess = !!user && (isManagerRole(role) || (!!profile && isStaffProfile(profile)));
  const [params, setParams] = useSearchParams();
  const want = params.get("sparvid");
  const mineQ = useMySparringVideos(!!user);
  const sharedQ = useSharedVideos(!!user);
  const reportedQ = useReported(staffGuess);
  const requestsQ = useFeedbackRequests(staffGuess);
  const mine = useMemo(() => mineQ.data ?? [], [mineQ.data]);
  const shared = useMemo(() => sharedQ.data ?? [], [sharedQ.data]);
  const reported = useMemo(() => reportedQ.data ?? [], [reportedQ.data]);
  const requests = useMemo(() => requestsQ.data ?? [], [requestsQ.data]);
  // 서버가 코치진으로 인정했을 때만 「코치 확인」 칸
  const coach = staffGuess && (reportedQ.isSuccess || requestsQ.isSuccess);
  const ready = mineQ.isFetched && sharedQ.isFetched && (!staffGuess || (reportedQ.isFetched && requestsQ.isFetched));

  const posterPaths = useMemo(() => {
    const s = new Set<string>();
    for (const v of [...mine, ...shared, ...reported, ...requests]) if (v.provider === "storage" && v.poster_path) s.add(v.poster_path);
    return Array.from(s).sort();
  }, [mine, shared, reported, requests]);
  const postersQ = usePosterUrls(posterPaths);
  const posters = useMemo(() => postersQ.data ?? {}, [postersQ.data]);

  const [listOpen, setListOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("branch");
  const [openVideo, setOpenVideo] = useState<SheetVideo | null>(null);

  const firstTab = useCallback(
    (): Tab => (coach && reported.length > 0 ? "coach" : shared.length > 0 ? "branch" : mine.length > 0 ? "mine" : "branch"),
    [coach, reported.length, shared.length, mine.length],
  );

  // 알림 · 전체 메뉴로 들어오면 그 영상(또는 목록)을 연다
  useEffect(() => {
    if (!want || !ready) return;
    const m = mine.find((v) => v.video_id === want);
    const s = shared.find((v) => v.video_id === want);
    const q = requests.find((v) => v.video_id === want);
    const r = reported.find((v) => v.video_id === want);
    if (m) setOpenVideo(fromMine(m));
    else if (r) setOpenVideo(fromReported(r));
    else if (s) setOpenVideo(fromShared(s, coach));
    else if (q) setOpenVideo(fromRequest(q));
    else {
      setTab(firstTab());
      setListOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("sparvid");
    setParams(next, { replace: true });
  }, [want, ready, mine, shared, requests, reported, coach, firstTab, params, setParams]);

  if (!user) return null;

  const fb = mine.reduce((n, v) => n + (v.comment_count > 0 ? 1 : 0), 0);
  const todo = coach ? reported.length + requests.filter((r) => r.comment_count === 0).length : 0;
  const empty = mine.length + shared.length === 0;

  return (
    <>
      <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card py-2 pl-4 pr-2">
        <button
          type="button"
          onClick={() => {
            setTab(firstTab());
            setListOpen(true);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left transition-all active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Video className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-bold text-foreground">훈련 영상</span>
            <span className="block truncate text-label text-muted-foreground">
              {empty && todo === 0
                ? "미트 · 스파링 영상을 올리고 코치님 피드백을 받아요"
                : [
                    `우리 지점 ${shared.length}`,
                    `내 영상 ${mine.length}`,
                    fb > 0 ? `피드백 온 영상 ${fb}` : "",
                    todo > 0 ? `확인할 영상 ${todo}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 text-label font-bold text-primary-foreground active:scale-95"
        >
          <Plus className="h-4 w-4" /> 올리기
        </button>
      </div>
      {listOpen && (
        <ListSheet
          mine={mine}
          shared={shared}
          reported={reported}
          requests={requests}
          coach={coach}
          posters={posters}
          tab={tab}
          setTab={setTab}
          onPick={setOpenVideo}
          onUpload={() => setUploadOpen(true)}
          onClose={() => setListOpen(false)}
        />
      )}
      <VideoUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false);
          setTab("mine");
          setListOpen(true);
        }}
      />
      <SparringVideoSheet video={openVideo} onClose={() => setOpenVideo(null)} />
    </>
  );
};

export default SparringVideoEntry;
