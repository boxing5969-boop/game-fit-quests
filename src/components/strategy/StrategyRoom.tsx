/**
 * 🧠 전략 회의 — 지점 회의실(/office) '전략 회의' 탭 (2026-10-16 대표님 · 2026-10-29 메시지 '전략' 탭에서 지점 회의실로 옮김)
 *   코치진(지도진 · 관리 권한)만 — 회원에게는 입구가 없고 서버도 막는다. 새 페이지가 아니라 지점 회의실의 탭.
 *   하위 탭: 지시·전략(운영 원칙 고정) · 오늘 프로그램 · 수업 기록 · 영상
 *   2026-11-13 세 칸(오늘 프로그램 · 수업 기록 · 영상)이 153 콘텐츠 카드로 이어진다 — 카드 서랍(CardDrawer) · 영상 칸 맨 위 카드 선반
 *   2026-11-13 코치님 「내 수업 짜기」 — 오늘 프로그램 칸에서 카드를 조합해 수업안을 저장(수업 기록 중 data.stage 'plan' · lib/classPlan)
 *     → 대표님 · 지점장님 피드백 → 수업이 끝나면 「기록 쓰기」로 같은 글이 수업 기록이 된다. 수업 기록 칸에는 수업안을 빼고 보인다.
 *   기획안: claude.ai 문서 '전략 회의실 기획안' · DB: 20261016030000_strategy_room.sql
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import CoachStdSection from "@/components/coach153/CoachStdSection";
import { COACH153_KEY, useCoachGrowthMe } from "@/services/coachGrowthService";
import { useCoachMindState } from "@/services/coachMindService";

import { cn } from "@/lib/utils";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import PushOptInCard from "@/components/notifications/PushOptInCard";
import StrategyItemCard from "@/components/strategy/StrategyItemCard";
import { ClassLogComposer, PostComposer, ProgramComposer } from "@/components/strategy/StrategyComposers";
import ClassTemplateList from "@/components/strategy/ClassTemplates";
import { templateVideoKey, templateVideoTitle, type ClassTemplate } from "@/lib/classTemplates";
import {
  classTemplateVideoUrl,
  useAttachClassTemplateVideo,
  useClassTemplateVideos,
  useClearClassTemplateVideo,
} from "@/services/classTemplateVideoService";
import { VideoLibrary } from "@/components/strategy/StrategyVideos";
import { missionsForDrawer } from "@/components/strategy/CardDrawer";
import TrainingShelf from "@/components/training/TrainingShelf";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";
import { useMissions } from "@/hooks/useMissionData";
import { primaryMissionVideo } from "@/lib/missionVideos";
import { cardMedia, type TrainingCard } from "@/lib/trainingCards";
import { onlyClassLogs, plansAwaitingFeedback, plansForBoard } from "@/lib/classPlan";
import { trainingVideoUrl, useTrainingCards } from "@/services/trainingCardService";
import {
  kstToday,
  strategyVideoUrl,
  useAckStrategy,
  useStrategyFeed,
  useStrategyMe,
  useStrategyVideos,
  type StrategyItem,
  type StrategyVideo,
} from "@/services/strategyService";

type Section = "board" | "std" | "program" | "log" | "video";

// 153 기준 (2026-11-05) — 코치 기준 다섯 가지 · 4주 성장 · 수업 관찰 (components/coach153). 알림 링크 ?s=std 로 바로 연다
const SECTIONS: Array<{ v: Section; label: string }> = [
  { v: "board", label: "지시·전략" },
  { v: "std", label: "153 기준" },
  { v: "program", label: "오늘 프로그램" },
  { v: "log", label: "수업 기록" },
  { v: "video", label: "영상" },
];

const SECTION_KEY = "153strategy:section";
const readSection = (): Section => {
  try {
    const v = window.localStorage.getItem(SECTION_KEY);
    return v === "std" || v === "program" || v === "log" || v === "video" ? v : "board";
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

const SubActionButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-[14px] font-black text-foreground active:scale-[0.99]"
  >
    <Plus className="h-4 w-4" /> {children}
  </button>
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
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [section, setSectionState] = useState<Section>(() => {
    const s = params.get("s");
    return s === "std" || s === "board" || s === "program" || s === "log" || s === "video" ? s : readSection();
  });
  const growth = useCoachGrowthMe(me?.branch ?? branch, ok);
  const mindQ = useCoachMindState(me?.branch ?? branch, ok);
  // 153 기준 점 — 안 읽은 수업 관찰 + 안 읽은 대표님 피드백(성향 카드 맞춤)
  const growthUnseen = (growth.data?.me?.unseen ?? 0) + (mindQ.data?.unseen ?? 0);
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
  // 수업 기록 + 코치님 수업안(오늘 프로그램 칸) — 대표님 · 지점장님은 칸 점(오늘 피드백 기다리는 수업안)을 위해 늘
  const logs = useStrategyFeed(b, ["class_log"], ok && (section === "log" || section === "program" || !!me?.can_direct));
  const videosQ = useStrategyVideos(b, ok && (section === "video" || section === "program"));
  const videos = useMemo(() => videosQ.data ?? [], [videosQ.data]);
  const videoMap = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);
  const ack = useAckStrategy();
  // 153 수업 템플릿 — 순서마다 참고 영상 (모든 지점 공통 · 넣기는 대표님만, 2026-11-12)
  const tplVideosQ = useClassTemplateVideos(ok && section === "program");
  const attachTpl = useAttachClassTemplateVideo();
  const clearTpl = useClearClassTemplateVideo();
  const [tplBusy, setTplBusy] = useState<string | null>(null);

  const [postOpen, setPostOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [programInit, setProgramInit] = useState<StrategyItem | null>(null);
  const [programTpl, setProgramTpl] = useState<ClassTemplate | null>(null);
  const [programCard, setProgramCard] = useState<TrainingCard | null>(null);
  // program = 오늘 프로그램(대표님 · 지점장님) · plan = 코치님 「내 수업 짜기」
  const [programMode, setProgramMode] = useState<"program" | "plan">("program");
  const [logPlan, setLogPlan] = useState<StrategyItem | null>(null);
  // 받은 프로그램 · 수업 기록의 카드를 눌렀는데 영상이 아직 없으면 카드 시트(포인트 · 실수)
  const [sheetCard, setSheetCard] = useState<TrainingCard | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logProgram, setLogProgram] = useState<StrategyItem | null>(null);
  const [overlay, setOverlay] = useState<OverlayVideo | null>(null);
  const [managePrinciples, setManagePrinciples] = useState(false);

  // 153 콘텐츠 카드 · 레벨 미션 (2026-11-13) — 블록 · 칩 이름, 카드 서랍의 「레벨 미션」 칸
  const cardsQ = useTrainingCards(ok);
  const cardMap = useMemo(() => new Map((cardsQ.data ?? []).map((c) => [c.id, c])), [cardsQ.data]);
  const missionsQ = useMissions();
  const drawerMissions = useMemo(() => missionsForDrawer(missionsQ.data as Parameters<typeof missionsForDrawer>[0]), [missionsQ.data]);
  const missionMap = useMemo(() => new Map(drawerMissions.map((m) => [m.id, m])), [drawerMissions]);

  const openCard = async (card: TrainingCard) => {
    const media = cardMedia(card, "coach");
    if (!media) {
      setSheetCard(card);
      return;
    }
    try {
      const url = media.kind === "storage" ? await trainingVideoUrl(media.path) : media.url;
      setOverlay({ url, title: card.coach_video_path ? `${card.name} · 코치용` : card.name });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const playMission = (missionId: string) => {
    const row = (missionsQ.data ?? []).find((m) => m.id === missionId);
    const v = row ? primaryMissionVideo(row.mission_videos) : null;
    if (!row || !v?.video_url) {
      toast.error("영상이 아직 등록되지 않았어요");
      return;
    }
    setOverlay({ url: v.video_url, title: row.title });
  };

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
  // 코치님 수업안 — 내 것(지난 기록 전 포함) 먼저 · 다른 코치님 것은 오늘 · 앞으로 / 수업 기록 칸은 수업안을 빼고
  const today = kstToday();
  const logRows = logs.data ?? [];
  const { mine: myPlans, others: otherPlans } = plansForBoard(logRows, today);
  const classLogs = onlyClassLogs(logRows);
  const planWaiting = me.can_direct ? plansAwaitingFeedback(logRows, today) : 0;
  const openPlan = (init: { item?: StrategyItem | null; tpl?: ClassTemplate | null; card?: TrainingCard | null }) => {
    setProgramMode("plan");
    setProgramInit(init.item ?? null);
    setProgramTpl(init.tpl ?? null);
    setProgramCard(init.card ?? null);
    setProgramOpen(true);
  };
  const openProgram = (init: { item?: StrategyItem | null; tpl?: ClassTemplate | null; card?: TrainingCard | null }) => {
    setProgramMode("program");
    setProgramInit(init.item ?? null);
    setProgramTpl(init.tpl ?? null);
    setProgramCard(init.card ?? null);
    setProgramOpen(true);
  };

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
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-secondary/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => setSection(s.v)}
            className={cn(
              "relative flex-1 shrink-0 whitespace-nowrap rounded-xl px-2.5 py-2 text-[12.5px] font-black transition-all active:scale-[0.98]",
              section === s.v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {s.label}
            {s.v === "std" && growthUnseen > 0 && (
              <span aria-label="새 피드백" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
            {s.v === "program" && planWaiting > 0 && (
              <span aria-label={`피드백을 기다리는 수업안 ${planWaiting}개`} className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
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
          {me.can_direct ? (
            <>
              <ActionButton onClick={() => openProgram({})}>오늘 프로그램 만들기</ActionButton>
              <SubActionButton onClick={() => openPlan({})}>내 수업 짜기</SubActionButton>
            </>
          ) : (
            <ActionButton onClick={() => openPlan({})}>내 수업 짜기</ActionButton>
          )}
          {/* 코치님 수업안 — 카드를 조합해 짠 수업 (대표님 · 지점장님은 피드백) */}
          {(myPlans.length > 0 || otherPlans.length > 0) && (
            <div className="space-y-2.5">
              <h2 className="px-1 text-[15px] font-black text-foreground">
                수업안 <span className="text-muted-foreground">{myPlans.length + otherPlans.length}</span>
                {planWaiting > 0 && <span className="ml-1.5 text-[12.5px] font-bold text-primary">피드백 기다림 {planWaiting}</span>}
              </h2>
              {[...myPlans, ...otherPlans].map((i) => (
                <StrategyItemCard
                  key={i.id}
                  item={i}
                  me={me}
                  videos={videoMap}
                  onPlay={play}
                  cards={cardMap}
                  missions={missionMap}
                  onOpenCard={openCard}
                  onPlayMission={playMission}
                  onEditPlan={(p) => openPlan({ item: p })}
                  onRecordPlan={(p) => {
                    setLogProgram(null);
                    setLogPlan(p);
                    setLogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
          <ClassTemplateList
            canDirect={!!me.can_direct}
            isHq={!!me.hq}
            videos={tplVideosQ.data ?? []}
            busy={tplBusy}
            onUse={(t) => openProgram({ tpl: t })}
            onPlan={(t) => openPlan({ tpl: t })}
            onPlay={async (t, step, v) => {
              try {
                const url = await classTemplateVideoUrl(v.storage_path);
                setOverlay({ url, title: templateVideoTitle(t, step) });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            onAttach={(t, step, file) => {
              setTplBusy(templateVideoKey(t.id, step));
              attachTpl
                .mutateAsync({ templateId: t.id, step, file })
                .then(() => toast.success("참고 영상을 붙였어요 — 모든 지점 코치님께 보여요"))
                .catch((e) => toast.error((e as Error).message))
                .finally(() => setTplBusy(null));
            }}
            onClear={(t, step) => {
              if (!window.confirm("이 순서의 참고 영상을 뺄까요? (파일은 남아 있어요)")) return;
              setTplBusy(templateVideoKey(t.id, step));
              clearTpl
                .mutateAsync({ templateId: t.id, step })
                .then(() => toast.success("참고 영상을 뺐어요"))
                .catch((e) => toast.error((e as Error).message))
                .finally(() => setTplBusy(null));
            }}
          />
          {programs.isLoading ? (
            <Skeleton />
          ) : programRows.length === 0 ? (
            <Empty
              emoji="🥊"
              title="아직 받은 프로그램이 없어요"
              body={me.can_direct ? "'오늘 프로그램 만들기'에서 블록마다 카드를 골라 보내 보세요." : "대표님·지점장님이 보낸 오늘 프로그램이 여기에 와요.\n블록을 눌러 영상을 보고 준비한 뒤 '확인했어요'를 눌러 주세요."}
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
                  cards={cardMap}
                  missions={missionMap}
                  onOpenCard={openCard}
                  onPlayMission={playMission}
                  onApplied={(p) => {
                    setLogPlan(null);
                    setLogProgram(p);
                    setLogOpen(true);
                  }}
                  onReuse={(p) => openProgram({ item: p })}
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
              setLogPlan(null);
              setLogOpen(true);
            }}
          >
            수업 기록 남기기
          </ActionButton>
          {logs.isLoading ? (
            <Skeleton />
          ) : classLogs.length === 0 ? (
            <Empty emoji="📝" title="아직 수업 기록이 없어요" body={"수업이 끝나면 1분만 — 인원은 출석 기록에서 자동으로 채워요.\n잘 된 수업은 '추천 수업'으로 모두가 따라 할 수 있어요."} />
          ) : (
            <div className="space-y-2.5">
              {classLogs.map((i) => (
                <StrategyItemCard key={i.id} item={i} me={me} cards={cardMap} onOpenCard={openCard} />
              ))}
            </div>
          )}
        </>
      )}

      {section === "std" && (
        <CoachStdSection
          branch={b}
          onCheckClass={() => {
            setLogProgram(null);
            setLogPlan(null);
            setLogOpen(true);
          }}
        />
      )}

      {section === "video" && (
        <div className="space-y-5">
          {/* 153 콘텐츠 카드 — 모든 지점이 같이 보는 카드(코치용 영상 · 포인트 · 실수) · 「이 카드로 오늘 프로그램 만들기」 */}
          <TrainingShelf
            audience="staff"
            sheetFooter={(card, close) => (
              <>
                {me.can_direct && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openProgram({ card });
                    }}
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99]"
                  >
                    이 카드로 오늘 프로그램 만들기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    close();
                    openPlan({ card });
                  }}
                  className={cn(
                    "flex h-12 w-full items-center justify-center rounded-2xl text-body font-black active:scale-[0.99]",
                    me.can_direct ? "mt-2 border border-border bg-card text-foreground" : "mt-4 bg-foreground text-background",
                  )}
                >
                  이 카드로 내 수업 짜기
                </button>
              </>
            )}
          />
          {/* 우리 지점 영상 — 지금 그대로(올리기 · 지우기 · 코치진만) */}
          <div className="space-y-3">
            <h2 className="px-1 text-[17px] font-black text-foreground">우리 지점 영상</h2>
            <VideoLibrary me={me} branch={b} videos={videos} loading={videosQ.isLoading} onPlay={play} />
          </div>
        </div>
      )}

      <PostComposer open={postOpen} onClose={() => setPostOpen(false)} me={me} branch={b} />
      <ProgramComposer
        open={programOpen}
        onClose={() => setProgramOpen(false)}
        me={me}
        branch={b}
        videos={videos}
        templates={templates}
        initial={programInit}
        initialTemplate={programTpl}
        initialCard={programCard}
        missions={drawerMissions}
        mode={programMode}
      />
      <ClassLogComposer
        open={logOpen}
        onClose={() => {
          setLogOpen(false);
          qc.invalidateQueries({ queryKey: COACH153_KEY });
        }}
        branch={b}
        programs={programRows}
        initialProgram={logProgram}
        standards={growth.data?.standards}
        plans={myPlans}
        fromPlan={logPlan}
      />
      <VideoOverlay video={overlay} onClose={() => setOverlay(null)} />
      <TrainingDrillSheet exercise={sheetCard} onClose={() => setSheetCard(null)} />
    </div>
  );
};

export default StrategyRoom;
