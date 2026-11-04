/**
 * 📈 153 기준 — 153운영본부 › 전략 회의 › 「153 기준」 (2026-11-05 대표님 「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)
 *   대표님 말씀 「회원님들 짧은 시간 안에 행복을 드리자」를 코치님이 매 수업 할 수 있는 행동 다섯 가지로 —
 *   · 코치님: 나의 4주(주제 · 할 일) · 받은 피드백(잘한 것 2 · 바꿀 것 1 · 확인했어요) · 나의 다섯 가지 · 153 기준 다섯 가지
 *     — '오늘 수업 점검'은 수업 기록 창(ClassLogComposer)의 다섯 가지 점검표로 남긴다
 *   · 대표님 · 지점장님: 코치님들(4주 시작 · 수업 관찰 · 돌아보기) · 기준 다섯 가지(대표님만 고치기)
 *   서버: coach_growth_me 한 번에 다 받는다 · 권한은 서버가 다시 본다 (20261105005333_coach_std_growth.sql)
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCoachGrowthMe, useSeenObservations } from "@/services/coachGrowthService";
import { needsObservation, type CoachStd, type GrowthPerson } from "@/lib/coachGrowth";
import { toast } from "sonner";
import { Card, CoachRowCard, FeedbackCard, MyFiveCard, MyWeeksCard, StandardsCard } from "./CoachStdCards";
import { ObserveSheet, ReviewSheet, StartSheet, StdEditSheet } from "./CoachStdSheets";

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
  const canDirect = !!d.can_direct;
  const showMine = !canDirect || (!d.hq && view === "me");

  const onSeen = (ids: string[]) =>
    seen.mutate(ids, {
      onSuccess: () => toast.success("확인했어요 — 다음 수업에 바로 써 봐요"),
      onError: (e) => toast.error((e as Error).message),
    });

  const mine = me ? (
    <>
      <MyWeeksCard person={me} standards={standards} onCheck={onCheckClass} />
      <FeedbackCard observations={me.observations ?? []} standards={standards} onSeen={onSeen} seenPending={seen.isPending} />
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
              {t.v === "me" && (me?.unseen ?? 0) > 0 && <span aria-hidden className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
            </button>
          ))}
        </div>
      )}

      {showMine ? (
        mine
      ) : (
        <>
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
            board.map((p, i) => (
              <CoachRowCard
                key={p.person?.user_id ?? i}
                person={p}
                standards={standards}
                onObserve={() => setObserveFor(p)}
                onStart={() => setStartFor(p)}
                onReview={() => setReviewFor(p)}
              />
            ))
          )}
        </>
      )}

      <StandardsCard standards={standards} canEdit={!!d.hq} onEdit={(s) => setEditStd(s)} />

      <ObserveSheet open={!!observeFor} onClose={() => setObserveFor(null)} person={observeFor} standards={standards} aiPolish={!!d.ai_polish} branch={d.branch ?? branch} />
      <StartSheet open={!!startFor} onClose={() => setStartFor(null)} person={startFor} />
      <ReviewSheet open={!!reviewFor} onClose={() => setReviewFor(null)} person={reviewFor} standards={standards} />
      <StdEditSheet open={!!editStd} onClose={() => setEditStd(null)} std={editStd} />
    </div>
  );
}
