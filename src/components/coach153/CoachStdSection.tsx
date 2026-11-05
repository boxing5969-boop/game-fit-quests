/**
 * 📈 153 기준 — 153운영본부 › 전략 회의 › 「153 기준」 (2026-11-05 대표님 「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)
 *   대표님 말씀 「회원님들 짧은 시간 안에 행복을 드리자」를 코치님이 매 수업 할 수 있는 행동 다섯 가지로 —
 *   · 코치님: 나의 4주(주제 · 할 일) · 받은 피드백(잘한 것 2 · 바꿀 것 1 · 확인했어요) · 나의 다섯 가지 · 153 기준 다섯 가지
 *     — '오늘 수업 점검'은 수업 기록 창(ClassLogComposer)의 다섯 가지 점검표로 남긴다
 *   · 대표님 · 지점장님: 코치님들(4주 시작 · 수업 관찰 · 돌아보기) · 기준 다섯 가지(대표님만 고치기)
 *   서버: coach_growth_me 한 번에 다 받는다 · 권한은 서버가 다시 본다 (20261105005333_coach_std_growth.sql)
 *
 * 🧭 코치 성향 카드 · 맞춤 피드백 (2026-11-05 대표님 「코치님들의 mbti와 심리 상세한 정보를 먼저 획득한 뒤에 … 알아들을 수 있도록」)
 *   · 코치님: 성향 카드 부탁 · 받은 대표님 피드백(맞춘 글 + 원래 기준 + 스스로 물어볼 것 · 확인했어요 · 한마디) · 내 성향 카드
 *   · 대표님 · 지점장님: 맞춤 피드백(카드 현황 · 카드 부탁하기 · 피드백 쓰기 · 보낸 피드백 확인 현황) · 코치님 줄의 카드 표시
 *     — 카드 내용은 대표님만(지점장님은 있음/없음만)
 *   서버: coach_mind_state (20261105124544_coach_mind.sql) · 오삼코치 Edge Function coach-mind · 알림 링크 ?s=std · 카드 부탁 &mind=1
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCoachGrowthMe, useSeenObservations } from "@/services/coachGrowthService";
import { useAckNote, useAskMind, useCoachMindState, useMakeMindSummary, useSeenNotes } from "@/services/coachMindService";
import { needsObservation, type CoachStd, type GrowthPerson } from "@/lib/coachGrowth";
import type { ReceivedNote, SentNote, TeamMind } from "@/lib/coachMind";
import { toast } from "sonner";
import { Card, CoachRowCard, FeedbackCard, MyFiveCard, MyWeeksCard, StandardsCard } from "./CoachStdCards";
import { ObserveSheet, ReviewSheet, StartSheet, StdEditSheet } from "./CoachStdSheets";
import { MindChip, MindInviteCard, MindMyCard, MindTeamCard, NotesList } from "./CoachMindCards";
import { MindFormSheet, MindViewSheet, NoteComposeSheet, NoteReplySheet, NoteStatusSheet } from "./CoachMindSheets";

type View = "team" | "me";

const Skeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {[0, 1].map((i) => (
      <div key={i} className="h-36 animate-pulse rounded-3xl bg-card shadow-elev-1" />
    ))}
  </div>
);

export default function CoachStdSection({ branch, onCheckClass }: { branch: string | null; onCheckClass: () => void }) {
  const q = useCoachGrowthMe(branch);
  const seen = useSeenObservations();
  const [view, setView] = useState<View>("team");
  const [observeFor, setObserveFor] = useState<GrowthPerson | null>(null);
  const [startFor, setStartFor] = useState<GrowthPerson | null>(null);
  const [reviewFor, setReviewFor] = useState<GrowthPerson | null>(null);
  const [editStd, setEditStd] = useState<CoachStd | null>(null);

  // 🧭 성향 카드 · 맞춤 피드백
  const mq = useCoachMindState(branch, !!q.data?.staff);
  const md = mq.data;
  const askMind = useAskMind();
  const summarize = useMakeMindSummary();
  const seenNotes = useSeenNotes();
  const ackNote = useAckNote();
  const [formOpen, setFormOpen] = useState(false);
  const [viewMember, setViewMember] = useState<TeamMind | null>(null);
  const [compose, setCompose] = useState<{ open: boolean; preselect: string[] | null }>({ open: false, preselect: null });
  const [statusNote, setStatusNote] = useState<SentNote | null>(null);
  const [replyNote, setReplyNote] = useState<ReceivedNote | null>(null);
  const [params, setParams] = useSearchParams();
  const seenSent = useRef(new Set<string>());

  const team = useMemo(() => md?.team ?? [], [md?.team]);
  const teamById = useMemo(() => new Map(team.map((t) => [t.person?.user_id ?? "", t])), [team]);
  const canDirect = !!q.data?.can_direct;
  const showMine = !canDirect || (!q.data?.hq && view === "me");

  // 알림 '성향 카드를 부탁드려요'(&mind=1) — 들어오면 카드 창을 한 번 연다
  useEffect(() => {
    if (params.get("mind") !== "1" || !md?.staff) return;
    if (!md.mine) {
      if (canDirect && !md.hq) setView("me");
      setFormOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("mind");
    setParams(next, { replace: true });
  }, [params, md?.staff, md?.mine, md?.hq, canDirect, setParams]);

  // 받은 대표님 피드백 — 화면에 보이면 읽음(보낸 분 화면 '읽음'), 확인은 단추로
  useEffect(() => {
    if (!showMine) return;
    const ids = (md?.notes ?? []).filter((n) => !n.seen_at && !seenSent.current.has(n.id)).map((n) => n.id);
    if (ids.length === 0) return;
    ids.forEach((id) => seenSent.current.add(id));
    seenNotes.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [md?.notes, showMine]);

  if (q.isLoading) return <Skeleton />;
  if (q.isError || !q.data) {
    return (
      <Card className="text-center">
        <p className="text-body font-bold text-foreground">153 기준을 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="mt-4 rounded-full bg-secondary px-4 py-2 text-label font-bold active:scale-95"
        >
          다시 불러오기
        </button>
      </Card>
    );
  }
  const d = q.data;
  if (!d.staff) return null;
  const standards = d.standards ?? [];
  const me = d.me;
  const board = d.board ?? [];
  const mindReady = !!md?.staff;
  const ai = !!md?.ai;

  const onSeen = (ids: string[]) =>
    seen.mutate(ids, {
      onSuccess: () => toast.success("확인했어요 — 다음 수업에 바로 써 봐요"),
      onError: (e) => toast.error((e as Error).message),
    });

  const runSummary = () =>
    summarize.mutate(md?.branch ?? branch, {
      onSuccess: (r) => {
        if (!r.stale) toast.success("오삼코치가 내 전달 설명서를 만들었어요");
      },
      onError: (e) => toast.error((e as Error).message),
    });

  const onAck = (n: ReceivedNote) =>
    ackNote.mutate(
      { id: n.id },
      {
        onSuccess: () => toast.success("확인했어요 — 오늘 수업에서 한 가지만 해 봐요"),
        onError: (e) => toast.error((e as Error).message),
      },
    );

  const ask = () =>
    askMind.mutate(md?.branch ?? branch, {
      onSuccess: (n) => toast.success(n > 0 ? `${n}명께 카드를 부탁했어요` : "오늘은 이미 부탁했어요"),
      onError: (e) => toast.error((e as Error).message),
    });

  const unseenAll = (me?.unseen ?? 0) + (md?.unseen ?? 0);
  const mine = me ? (
    <>
      {mindReady && !md?.mine && <MindInviteCard asked={!!md?.asked_at} onStart={() => setFormOpen(true)} />}
      {mindReady && <NotesList notes={md?.notes ?? []} onAck={onAck} onReply={(n) => setReplyNote(n)} ackPending={ackNote.isPending} />}
      <MyWeeksCard person={me} standards={standards} onCheck={onCheckClass} />
      <FeedbackCard observations={me.observations ?? []} standards={standards} onSeen={onSeen} seenPending={seen.isPending} />
      {mindReady && md?.mine && (
        <MindMyCard mind={md.mine} ai={ai} summarizing={summarize.isPending} onEdit={() => setFormOpen(true)} onSummarize={runSummary} />
      )}
      <MyFiveCard person={me} standards={standards} />
    </>
  ) : null;

  const need = needsObservation(board);

  return (
    <div className="space-y-3">
      {canDirect && !d.hq && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1" role="tablist" aria-label="보기">
          {(
            [
              { v: "team", label: "코치님들" },
              { v: "me", label: "나" },
            ] as Array<{ v: View; label: string }>
          ).map((t) => (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={view === t.v}
              onClick={() => setView(t.v)}
              className={cn(
                "rounded-xl py-2 text-label font-black transition-all active:scale-[0.98]",
                view === t.v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
              )}
            >
              {t.label}
              {t.v === "me" && unseenAll > 0 && <span aria-hidden className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
            </button>
          ))}
        </div>
      )}

      {showMine ? (
        mine
      ) : (
        <>
          {mindReady && md?.can_direct && (
            <MindTeamCard
              team={team}
              sent={md?.sent ?? []}
              ai={ai}
              onWrite={() => setCompose({ open: true, preselect: null })}
              onAsk={ask}
              askPending={askMind.isPending}
              onOpenSent={(n) => setStatusNote(n)}
            />
          )}
          {need.length > 0 && (
            <p className="rounded-2xl bg-primary/10 px-4 py-3 text-label font-bold text-foreground">
              이번 주 관찰이 아직인 코치님 {need.length}명 — {need.map((p) => p.person?.name ?? "코치님").join(" · ")}
            </p>
          )}
          {board.length === 0 ? (
            <Card className="text-center">
              <p className="text-body font-bold text-foreground">이 지점에 코치님이 아직 없어요</p>
              <p className="mt-1 text-label text-muted-foreground">지도진으로 등록되면 여기에 보여요</p>
            </Card>
          ) : (
            board.map((p, i) => {
              const tm = teamById.get(p.person?.user_id ?? "");
              return (
                <CoachRowCard
                  key={p.person?.user_id ?? i}
                  person={p}
                  standards={standards}
                  onObserve={() => setObserveFor(p)}
                  onStart={() => setStartFor(p)}
                  onReview={() => setReviewFor(p)}
                  extra={mindReady ? <MindChip member={tm} onOpen={d.hq && tm?.has_mind ? () => setViewMember(tm) : undefined} /> : null}
                />
              );
            })
          )}
        </>
      )}

      <StandardsCard standards={standards} canEdit={!!d.hq} onEdit={(s) => setEditStd(s)} />

      <ObserveSheet open={!!observeFor} onClose={() => setObserveFor(null)} person={observeFor} standards={standards} aiPolish={!!d.ai_polish} branch={d.branch ?? branch} />
      <StartSheet open={!!startFor} onClose={() => setStartFor(null)} person={startFor} />
      <ReviewSheet open={!!reviewFor} onClose={() => setReviewFor(null)} person={reviewFor} standards={standards} />
      <StdEditSheet open={!!editStd} onClose={() => setEditStd(null)} std={editStd} />

      <MindFormSheet open={formOpen} onClose={() => setFormOpen(false)} mind={md?.mine ?? null} onSaved={() => ai && runSummary()} />
      <MindViewSheet
        open={!!viewMember}
        onClose={() => setViewMember(null)}
        member={viewMember}
        onWrite={(coach) => {
          setViewMember(null);
          setCompose({ open: true, preselect: [coach] });
        }}
      />
      <NoteComposeSheet
        open={compose.open}
        onClose={() => setCompose({ open: false, preselect: null })}
        team={team}
        branch={md?.branch ?? d.branch ?? branch}
        ai={ai}
        preselect={compose.preselect}
      />
      <NoteStatusSheet open={!!statusNote} onClose={() => setStatusNote(null)} note={statusNote} canRemove={!!statusNote && (statusNote.mine || !!md?.hq)} />
      <NoteReplySheet open={!!replyNote} onClose={() => setReplyNote(null)} note={replyNote} />
    </div>
  );
}
