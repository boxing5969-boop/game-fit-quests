/**
 * 🧭 153 코치 성향 카드 · 맞춤 피드백 — 보여 주기만 하는 카드들 (2026-11-05 대표님)
 *   코치님: 성향 카드 부탁 · 내 전달 설명서 · 받은 피드백(맞춘 글 + 원래 기준 + 스스로 물어볼 것)
 *   대표님 · 지점장님: 맞춤 피드백(카드 현황 · 피드백 쓰기 · 보낸 피드백 확인 현황)
 *   글씨 6단계만 · 카드마다 주인공 하나 (CLAUDE.md 「회원 화면 리디자인」)
 */
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Compass, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { agoKo, noteCounts, type MindProfile, type NoteBody, type NoteCore, type ReceivedNote, type SentNote, type TeamMind } from "@/lib/coachMind";
import { Card, GhostButton, PrimaryButton } from "./CoachStdCards";

/* ───────────── 코치님 — 카드 부탁 ───────────── */

export function MindInviteCard({ asked, onStart }: { asked?: boolean; onStart: () => void }) {
  return (
    <Card className={cn(asked && "ring-2 ring-primary")}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass aria-hidden className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="text-heading font-black text-foreground">코치 성향 카드</h3>
          <p className="mt-1 text-body text-foreground">
            {asked ? "대표님이 부탁했어요. " : ""}내가 잘 알아듣는 방식으로 피드백을 받을 수 있게 알려 주세요.
          </p>
          <p className="mt-1 text-label text-muted-foreground">5분 · 나와 대표님만 봐요</p>
        </div>
      </div>
      <PrimaryButton onClick={onStart} className="mt-4">
        시작하기
      </PrimaryButton>
    </Card>
  );
}

/* ───────────── 코치님 — 내 전달 설명서 ───────────── */

export function MindSummaryBody({ mind }: { mind: MindProfile }) {
  const s = mind.summary;
  if (!s) return null;
  return (
    <div className="space-y-3">
      <p className="text-body font-bold text-foreground">{s.one_line}</p>
      {s.do?.length > 0 && (
        <div>
          <p className="text-label font-bold text-muted-foreground">이렇게 전하면 잘 들어요</p>
          <ul className="mt-1 space-y-1">
            {s.do.map((x) => (
              <li key={x} className="flex items-start gap-2 text-body text-foreground">
                <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.avoid?.length > 0 && (
        <div>
          <p className="text-label font-bold text-muted-foreground">이건 피해 주세요</p>
          <ul className="mt-1 space-y-1">
            {s.avoid.map((x) => (
              <li key={x} className="flex items-start gap-2 text-body text-foreground">
                <span aria-hidden className="mt-2.5 h-1.5 w-3 shrink-0 rounded-full bg-destructive/70" />
                <span className="min-w-0">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.order?.length > 0 && (
        <div>
          <p className="text-label font-bold text-muted-foreground">전하는 순서</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {s.order.map((x, i) => (
              <span key={`${x}-${i}`} className="flex items-center gap-1">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-foreground">{x}</span>
                {i < s.order.length - 1 && <ArrowRight aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </div>
      )}
      {s.power_line && (
        <div className="rounded-2xl bg-primary/10 px-4 py-3">
          <p className="text-label font-bold text-primary">힘이 나는 한마디</p>
          <p className="mt-0.5 text-body font-bold text-foreground">“{s.power_line}”</p>
        </div>
      )}
    </div>
  );
}

export function MindMyCard({
  mind,
  ai,
  summarizing,
  onEdit,
  onSummarize,
}: {
  mind: MindProfile;
  ai?: boolean;
  summarizing?: boolean;
  onEdit: () => void;
  onSummarize: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-heading font-black text-foreground">내 성향 카드</h3>
        {mind.mbti && <span className="rounded-full bg-secondary px-2.5 py-1 text-micro font-black text-foreground">{mind.mbti}</span>}
      </div>
      <p className="mt-1 text-label text-muted-foreground">오삼코치가 정리한 '나에게 전하는 법' · 나와 대표님만 봐요</p>
      <div className="mt-3">
        {mind.summary ? (
          <MindSummaryBody mind={mind} />
        ) : summarizing ? (
          <p className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-4 py-3 text-body text-foreground">
            <Sparkles aria-hidden className="h-4 w-4 shrink-0 animate-pulse text-primary" />
            오삼코치가 정리하는 중이에요…
          </p>
        ) : ai ? (
          <button
            type="button"
            onClick={onSummarize}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary/10 text-label font-black text-primary active:scale-[0.99]"
          >
            <Sparkles aria-hidden className="h-4 w-4" />
            오삼코치 요약 만들기
          </button>
        ) : (
          <p className="text-body text-foreground">저장했어요 — 대표님 피드백이 내 방식대로 맞춰져요</p>
        )}
      </div>
      <GhostButton onClick={onEdit} className="mt-4 w-full">
        답 고치기
      </GhostButton>
    </Card>
  );
}

/* ───────────── 코치님 — 받은 피드백 ───────────── */

export const CorePoints = ({ core }: { core: NoteCore }) => (
  <ol className="space-y-2">
    {core.points.map((p, i) => (
      <li key={i} className="flex items-start gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-micro font-black text-background">{i + 1}</span>
        <span className="min-w-0">
          {p.head && <span className="block text-body font-bold text-foreground">{p.head}</span>}
          {p.body && <span className="block text-body text-foreground">{p.body}</span>}
        </span>
      </li>
    ))}
  </ol>
);

/** 코치님께 맞춘 글 — 받은 피드백 · 보내기 전 미리 보기 · 보낸 피드백이 같이 쓴다 */
export const NoteBodyView = ({ body, className }: { body: NoteBody; className?: string }) => (
  <div className={cn("space-y-3", className)}>
    {body.greeting && <p className="text-body text-foreground">{body.greeting}</p>}
    <ul className="space-y-2">
      {body.lines.filter(Boolean).map((l, i) => (
        <li key={i} className="flex items-start gap-2 text-body text-foreground">
          <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">{l}</span>
        </li>
      ))}
    </ul>
    {body.try_today && (
      <div className="flex items-start gap-2 rounded-2xl bg-primary/10 p-3">
        <ArrowRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-label font-bold text-primary">오늘 해 볼 것</p>
          <p className="text-body font-bold text-foreground">{body.try_today}</p>
        </div>
      </div>
    )}
    {body.closing && <p className="text-body text-foreground">{body.closing}</p>}
  </div>
);

const fromLine = (n: { from: ReceivedNote["from"]; created_at: string }) =>
  [n.from ? `${n.from.name} ${n.from.title}` : "", agoKo(n.created_at)].filter(Boolean).join(" · ");

export function NoteCard({
  note,
  onAck,
  onReply,
  ackPending,
}: {
  note: ReceivedNote;
  onAck: () => void;
  onReply: () => void;
  ackPending?: boolean;
}) {
  const [showCore, setShowCore] = useState(false);
  const b = note.body;
  return (
    <Card className={cn(!note.acked_at && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label font-bold text-muted-foreground">{fromLine(note)}</p>
        {!note.acked_at && <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-micro font-black text-primary-foreground">새 피드백</span>}
      </div>
      <h3 className="mt-1 text-heading font-black text-foreground">{note.core.title}</h3>

      {b ? (
        <NoteBodyView body={b} className="mt-3" />
      ) : (
        <div className="mt-3">
          <CorePoints core={note.core} />
          {note.core.why && <p className="mt-3 text-body text-foreground">{note.core.why}</p>}
        </div>
      )}

      {note.core.checks?.length > 0 && (
        <div className="mt-4 rounded-2xl bg-secondary/70 px-4 py-3">
          <p className="text-label font-bold text-muted-foreground">수업 끝나고 스스로 물어봐요</p>
          <ul className="mt-1 space-y-1">
            {note.core.checks.map((c) => (
              <li key={c} className="text-body text-foreground">
                · {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {b && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowCore((v) => !v)}
            className="flex w-full items-center justify-between text-label font-bold text-muted-foreground"
            aria-expanded={showCore}
          >
            모든 코치님께 같은 원래 기준
            <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", showCore && "rotate-180")} />
          </button>
          {showCore && (
            <div className="mt-3">
              <CorePoints core={note.core} />
              {note.core.why && <p className="mt-3 text-body text-foreground">{note.core.why}</p>}
            </div>
          )}
        </div>
      )}

      {note.reply && (
        <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-body text-foreground">
          <span className="mr-1 text-label font-bold text-muted-foreground">내 한마디</span>
          {note.reply}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {!note.acked_at ? (
          <PrimaryButton onClick={onAck} disabled={ackPending} className="h-11 flex-1">
            확인했어요
          </PrimaryButton>
        ) : (
          <span className="flex h-11 flex-1 items-center gap-1.5 text-label font-bold text-muted-foreground">
            <Check aria-hidden className="h-4 w-4 text-primary" />
            확인함 · {agoKo(note.acked_at)}
          </span>
        )}
        <GhostButton onClick={onReply} className="shrink-0">
          <MessageCircle aria-hidden className="mr-1 h-4 w-4" />
          {note.reply ? "한마디 고치기" : "한마디"}
        </GhostButton>
      </div>
    </Card>
  );
}

export function NotesList({
  notes,
  onAck,
  onReply,
  ackPending,
}: {
  notes: ReceivedNote[];
  onAck: (n: ReceivedNote) => void;
  onReply: (n: ReceivedNote) => void;
  ackPending?: boolean;
}) {
  const [openOld, setOpenOld] = useState(false);
  if (notes.length === 0) return null;
  // 확인 안 한 것은 모두 펼치고, 확인한 것은 가장 최근 하나만 — 나머지는 접기
  const open = notes.filter((n) => !n.acked_at);
  const done = notes.filter((n) => !!n.acked_at);
  const shown = open.length > 0 ? open : done.slice(0, 1);
  const rest = open.length > 0 ? done : done.slice(1);
  return (
    <div className="space-y-3">
      {shown.map((n) => (
        <NoteCard key={n.id} note={n} onAck={() => onAck(n)} onReply={() => onReply(n)} ackPending={ackPending} />
      ))}
      {rest.length > 0 && (
        <Card className="py-3">
          <button
            type="button"
            onClick={() => setOpenOld((v) => !v)}
            className="flex w-full items-center justify-between text-label font-bold text-muted-foreground"
            aria-expanded={openOld}
          >
            지난 대표님 피드백 {rest.length}개
            <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", openOld && "rotate-180")} />
          </button>
        </Card>
      )}
      {openOld && rest.map((n) => <NoteCard key={n.id} note={n} onAck={() => onAck(n)} onReply={() => onReply(n)} ackPending={ackPending} />)}
    </div>
  );
}

/* ───────────── 대표님 · 지점장님 — 맞춤 피드백 ───────────── */

export function MindTeamCard({
  team,
  sent,
  ai,
  onWrite,
  onAsk,
  askPending,
  onOpenSent,
}: {
  team: TeamMind[];
  sent: SentNote[];
  ai?: boolean;
  onWrite: () => void;
  onAsk: () => void;
  askPending?: boolean;
  onOpenSent: (n: SentNote) => void;
}) {
  const total = team.length;
  const have = team.filter((t) => t.has_mind).length;
  const missing = team.filter((t) => !t.has_mind);
  const askable = missing.filter((t) => !t.asked_at || Date.now() - Date.parse(t.asked_at) > 20 * 3600_000);
  return (
    <Card>
      <h3 className="text-heading font-black text-foreground">맞춤 피드백</h3>
      <p className="mt-1 text-label text-muted-foreground">기준은 모두 같게 · 말하는 순서와 말투만 코치님마다</p>

      {total > 0 && (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-2">
            <p className="text-label font-bold text-foreground">성향 카드</p>
            <p className="text-body font-black tabular-nums text-foreground">
              {have}
              <span className="text-label font-bold text-muted-foreground"> / {total}명</span>
            </p>
          </div>
          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${total ? Math.round((have / total) * 100) : 0}%` }} />
          </span>
          {missing.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {missing.map((t) => (
                <span key={t.person?.user_id} className="rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-muted-foreground">
                  {t.person?.name ?? "코치님"}
                  {t.asked_at ? " · 부탁함" : ""}
                </span>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <GhostButton onClick={onAsk} className={cn("mt-3 w-full", (askable.length === 0 || askPending) && "pointer-events-none opacity-50")}>
              {askable.length === 0 ? "오늘 부탁을 보냈어요" : `카드 부탁하기 · ${askable.length}명`}
            </GhostButton>
          )}
        </div>
      )}

      <PrimaryButton onClick={onWrite} className="mt-4">
        {ai && <Sparkles aria-hidden className="h-4 w-4" />}
        피드백 쓰기
      </PrimaryButton>

      {sent.length > 0 && (
        <div className="mt-4 border-t border-border pt-2">
          <p className="py-2 text-label font-bold text-muted-foreground">보낸 피드백</p>
          <ul className="divide-y divide-border">
            {sent.slice(0, 5).map((n) => {
              const c = noteCounts(n.items);
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => onOpenSent(n)} className="flex w-full items-center gap-3 py-3 text-left active:opacity-70">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-foreground">{n.title}</span>
                      <span className="block text-label text-muted-foreground">
                        {[n.mine ? "" : n.author?.name, agoKo(n.created_at)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn("block text-label font-black tabular-nums", c.acked === c.total ? "text-primary" : "text-foreground")}>
                        확인 {c.acked}/{c.total}
                      </span>
                      {c.replies > 0 && <span className="block text-micro font-bold text-muted-foreground">한마디 {c.replies}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** 코치님 줄에 붙는 작은 표시 — 대표님은 눌러서 카드를 본다 */
export function MindChip({ member, onOpen }: { member: TeamMind | undefined; onOpen?: () => void }) {
  if (!member) return null;
  const cls = "rounded-full px-2.5 py-1 text-micro font-bold";
  if (!member.has_mind) return <span className={cn(cls, "bg-secondary text-muted-foreground")}>성향 카드 아직</span>;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(cls, "bg-primary/15 text-primary active:scale-95")}>
      성향 카드 보기
    </button>
  ) : (
    <span className={cn(cls, "bg-primary/15 text-primary")}>성향 카드 있음</span>
  );
}

