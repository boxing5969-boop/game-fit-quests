/**
 * 🧠 전략 회의실 — 메시지 탭 '전략' (2026-10-16 대표님)
 *   코치진(지도진 · 관리 권한)만 — 회원에게는 탭이 없고 서버도 막는다. 새 페이지가 아니라 메시지 화면의 탭.
 *   하위 탭: 지시·전략(운영 원칙 고정) · 오늘 프로그램 · 수업 기록 · 영상
 *   기획안: claude.ai 문서 '전략 회의실 기획안' · DB: 20261016030000_strategy_room.sql
 */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import PushOptInCard from "@/components/notifications/PushOptInCard";
import StrategyItemCard from "@/components/strategy/StrategyItemCard";
import { ClassLogComposer, PostComposer, ProgramComposer } from "@/components/strategy/StrategyComposers";
import { VideoLibrary } from "@/components/strategy/StrategyVideos";
import {
  strategyVideoUrl,
  useAckStrategy,
  useStrategyFeed,
  useStrategyMe,
  useStrategyVideos,
  type StrategyItem,
  type StrategyVideo,
} from "@/services/strategyService";

type Section = "board" | "program" | "log" | "video";

const SECTIONS: Array<{ v: Section; label: string }> = [
  { v: "board", label: "지시·전략" },
  { v: "program", label: "오늘 프로그램" },
  { v: "log", label: "수업 기록" },
  { v: "video", label: "영상" },
];

const SECTION_KEY = "153strategy:section";
const readSection = (): Section => {
  try {
    const v = window.localStorage.getItem(SECTION_KEY);
    return v === "program" || v === "log" || v === "video" ? v : "board";
  } catch {
    return "board";
  }
};

const Empty = ({ emoji, title, body }: { emoji: string; title: string; body: string }) => (
  <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
    <p className="text-[32px]" aria-hidden>
      {emoji}
    </p>
    <p className="mt-2 text-[15px] font-bold text-foreground">{title}</p>
    <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
  </div>
);

const Skeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {[0, 1].map((i) => (
      <div key={i} className="h-28 animate-pulse rounded-3xl bg-card shadow-elev-1" />
    ))}
  </div>
);

const ActionButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground text-[14.5px] font-black text-background active:scale-[0.99]"
  >
    <Plus className="h-4 w-4" /> {children}
  </button>
);

const StrategyRoom = () => {
  const [branch, setBranch] = useState<string | null>(null);
  const meQ = useStrategyMe(branch);
  const me = meQ.data;
  const ok = !!me?.staff;
  const b = me?.branch ?? branch;
  const [section, setSectionState] = useState<Section>(readSection);
  const setSection = (s: Section) => {
    setSectionState(s);
    try {
      window.localStorage.setItem(SECTION_KEY, s);
    } catch {
      /* 무시 */
    }
  };

  const board = useStrategyFeed(b, ["principle", "directive", "strategy", "praise"], ok && section === "board");
  const programs = useStrategyFeed(b, ["program"], ok && (section === "program" || section === "log"));
  const logs = useStrategyFeed(b, ["class_log"], ok && section === "log");
  const videosQ = useStrategyVideos(b, ok && (section === "video" || section === "program"));
  const videos = useMemo(() => videosQ.data ?? [], [videosQ.data]);
  const videoMap = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);
  const ack = useAckStrategy();

  const [postOpen, setPostOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [programInit, setProgramInit] = useState<StrategyItem | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logProgram, setLogProgram] = useState<StrategyItem | null>(null);
  const [overlay, setOverlay] = useState<OverlayVideo | null>(null);
  const [managePrinciples, setManagePrinciples] = useState(false);

  const play = async (v: StrategyVideo) => {
    try {
      const url = await strategyVideoUrl(v);
      if (!url) throw new Error("영상 주소가 없어요");
      setOverlay({ url, title: v.title });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (meQ.isLoading) return <Skeleton />;
  if (meQ.isError) {
    return (
      <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
        <p className="text-[14px] font-bold text-foreground">전략 회의실을 불러오지 못했어요</p>
        <button type="button" onClick={() => meQ.refetch()} className="mt-4 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95">
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!me || !ok) {
    return <Empty emoji="🔒" title="코치진만 들어올 수 있어요" body="지도진으로 등록되면 바로 열려요" />;
  }

  const principles = (board.data ?? []).filter((i) => i.kind === "principle");
  const posts = (board.data ?? []).filter((i) => i.kind !== "principle");
  const programRows = programs.data ?? [];
  const templates = programRows.filter((p) => p.data?.template);
  const unackedPrinciples = principles.filter((p) => !p.mine && !p.my_ack?.acked_at);

  return (
    <div className="space-y-3">
      {!me.my_push && <PushOptInCard variant="inbox" />}

      {(me.branches?.length ?? 0) > 1 && (
        <select
          value={me.branch ?? ""}
          onChange={(e) => setBranch(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-[14px] font-bold"
          aria-label="지점 고르기"
        >
          {(me.branches ?? []).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      )}

      {/* 하위 탭 */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-secondary/70 p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => setSection(s.v)}
            className={cn(
              "rounded-xl py-2 text-[12.5px] font-black transition-all active:scale-[0.98]",
              section === s.v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "board" && (
        <>
          {me.can_direct && <ActionButton onClick={() => setPostOpen(true)}>지시 · 전략 쓰기</ActionButton>}
          {board.isLoading ? (
            <Skeleton />
          ) : (
            <>
              {principles.length > 0 && (
                <section className="rounded-3xl bg-foreground p-4 text-background shadow-elev-1">
                  <p className="text-[13px] font-black tracking-wide opacity-80">📏 우리 지점 운영 원칙</p>
                  <ol className="mt-2 space-y-2">
                    {principles.map((p) => (
                      <li key={p.id} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-[12px] font-black text-foreground">
                          {p.principle_no}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-bold leading-snug">{p.title}</span>
                          {p.body && <span className="block whitespace-pre-wrap text-[12.5px] leading-relaxed opacity-75">{p.body}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {unackedPrinciples.length > 0 && (
                    <button
                      type="button"
                      disabled={ack.isPending}
                      onClick={() =>
                        Promise.all(unackedPrinciples.map((p) => ack.mutateAsync({ id: p.id, what: "ack" })))
                          .then(() => toast.success("운영 원칙을 확인했어요"))
                          .catch((e) => toast.error((e as Error).message))
                      }
                      className="mt-3 h-10 w-full rounded-xl bg-background text-[13.5px] font-black text-foreground active:scale-[0.99] disabled:opacity-60"
                    >
                      ✓ 원칙 {unackedPrinciples.length}개 확인했어요
                    </button>
                  )}
                  {me.can_direct && (
                    <button
                      type="button"
                      onClick={() => setManagePrinciples((v) => !v)}
                      className="mt-2 text-[12px] font-bold underline underline-offset-2 opacity-75"
                    >
                      {managePrinciples ? "원칙 관리 닫기" : "원칙 관리 (확인 현황 · 지우기)"}
                    </button>
                  )}
                </section>
              )}
              {me.can_direct && managePrinciples && (
                <div className="space-y-2.5">
                  {principles.map((i) => (
                    <StrategyItemCard key={i.id} item={i} me={me} />
                  ))}
                </div>
              )}
              {posts.length === 0 ? (
                principles.length > 0 ? null : (
                <Empty
                  emoji="🧭"
                  title="아직 지시·전략이 없어요"
                  body={
                    me.can_direct
                      ? "화가 난 순간에는 '지시 · 전략 쓰기'에서 오삼코치에게 먼저 정리를 맡겨 보세요.\n되풀이되는 지시는 운영 원칙으로 고정하면 돼요."
                      : "대표님·지점장님의 지시와 전략이 여기에 올라와요."
                  }
                />
                )
              ) : (
                <div className="space-y-2.5">
                  {posts.map((i) => (
                    <StrategyItemCard key={i.id} item={i} me={me} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {section === "program" && (
        <>
          {me.can_direct && (
            <ActionButton
              onClick={() => {
                setProgramInit(null);
                setProgramOpen(true);
              }}
            >
              오늘 프로그램 만들기
            </ActionButton>
          )}
          {programs.isLoading ? (
            <Skeleton />
          ) : programRows.length === 0 ? (
            <Empty
              emoji="🥊"
              title="아직 받은 프로그램이 없어요"
              body={me.can_direct ? "영상 탭에 드릴 영상을 올리고, 영상을 골라 오늘 프로그램을 보내 보세요." : "대표님·지점장님이 보낸 오늘 프로그램이 여기에 와요.\n영상을 보고 준비한 뒤 '확인했어요'를 눌러 주세요."}
            />
          ) : (
            <div className="space-y-2.5">
              {programRows.map((i) => (
                <StrategyItemCard
                  key={i.id}
                  item={i}
                  me={me}
                  videos={videoMap}
                  onPlay={play}
                  onApplied={(p) => {
                    setLogProgram(p);
                    setLogOpen(true);
                  }}
                  onReuse={(p) => {
                    setProgramInit(p);
                    setProgramOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {section === "log" && (
        <>
          <ActionButton
            onClick={() => {
              setLogProgram(null);
              setLogOpen(true);
            }}
          >
            수업 기록 남기기
          </ActionButton>
          {logs.isLoading ? (
            <Skeleton />
          ) : (logs.data ?? []).length === 0 ? (
            <Empty emoji="📝" title="아직 수업 기록이 없어요" body={"수업이 끝나면 1분만 — 인원은 출석 기록에서 자동으로 채워요.\n잘 된 수업은 '추천 수업'으로 모두가 따라 할 수 있어요."} />
          ) : (
            <div className="space-y-2.5">
              {(logs.data ?? []).map((i) => (
                <StrategyItemCard key={i.id} item={i} me={me} />
              ))}
            </div>
          )}
        </>
      )}

      {section === "video" && <VideoLibrary me={me} branch={b} videos={videos} loading={videosQ.isLoading} onPlay={play} />}

      <PostComposer open={postOpen} onClose={() => setPostOpen(false)} me={me} branch={b} />
      <ProgramComposer
        open={programOpen}
        onClose={() => setProgramOpen(false)}
        me={me}
        branch={b}
        videos={videos}
        templates={templates}
        initial={programInit}
      />
      <ClassLogComposer open={logOpen} onClose={() => setLogOpen(false)} branch={b} programs={programRows} initialProgram={logProgram} />
      <VideoOverlay video={overlay} onClose={() => setOverlay(null)} />
    </div>
  );
};

export default StrategyRoom;
