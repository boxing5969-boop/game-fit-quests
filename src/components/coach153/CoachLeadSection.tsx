/**
 * 🧭 관장님 리드 가이드 · 관장님 이해 카드 — 153 기준 칸 안 (2026-11-26 대표님 · 성향 2단계)
 *   · mode "lead"(대표님 · 지점장님 · 관장님 보기): 내 이해 카드(만들기 · 코치님들께 보여 주기) · 코치님마다 리드 가이드
 *   · mode "follow"(코치님 보기): 이끄는 분들의 이해 카드(켠 것만) · '리드 가이드 허락' 스위치
 *   서버: coach_lead_state · coach_lead_share_set · 오삼코치 coach-lead — 카드 내용 규칙은 서버가 다시 본다
 */
import { useState } from "react";
import { ChevronDown, Compass, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DmSheet } from "@/components/dm/DmParts";
import { agoKo } from "@/lib/coachMind";
import { leadRowLine, leaderCallOf, type LeadCoachRow, type LeadGuide, type LeaderCard, type LeaderRow } from "@/lib/coachLead";
import { useCoachLeadState, useLeadShare, useMakeLeadGuide, useMakeTeamCard } from "@/services/coachLeadService";
import { Avatar, Card, GhostButton, PrimaryButton } from "./CoachStdCards";

const Dots = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((t, i) => (
      <li key={i} className="flex items-start gap-2 text-body text-foreground">
        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0">{t}</span>
      </li>
    ))}
  </ul>
);

const Sub = ({ children }: { children: React.ReactNode }) => <h4 className="mt-4 text-label font-black text-muted-foreground">{children}</h4>;

export function LeaderCardBody({ card }: { card: LeaderCard }) {
  return (
    <div>
      <p className="rounded-2xl bg-primary/10 px-4 py-3 text-body font-bold text-foreground">{card.one_line}</p>
      <Sub>이렇게 일해요</Sub>
      <div className="mt-1.5">
        <Dots items={card.way} />
      </div>
      {card.misread.length > 0 && (
        <>
          <Sub>이럴 땐 이런 뜻이에요</Sub>
          <div className="mt-1.5 space-y-2">
            {card.misread.map((m, i) => (
              <div key={i} className="rounded-2xl bg-secondary/70 px-4 py-3">
                <p className="text-label font-bold text-muted-foreground">{m.looks}</p>
                <p className="mt-0.5 text-body text-foreground">{m.really}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <Sub>이렇게 보고 · 질문하면 잘 통해요</Sub>
      <div className="mt-1.5">
        <Dots items={card.report} />
      </div>
      {card.values.length > 0 && (
        <>
          <Sub>중요하게 여기는 것</Sub>
          <div className="mt-1.5">
            <Dots items={card.values} />
          </div>
        </>
      )}
      {card.tired && (
        <>
          <Sub>바쁘거나 지쳐 보일 땐</Sub>
          <p className="mt-1.5 text-body text-foreground">{card.tired}</p>
        </>
      )}
      {card.open_line && (
        <>
          <Sub>먼저 말을 꺼낼 때</Sub>
          <p className="mt-1.5 rounded-2xl border border-border px-4 py-3 text-body text-foreground">“{card.open_line}”</p>
        </>
      )}
    </div>
  );
}

export function LeadGuideBody({ guide }: { guide: LeadGuide }) {
  return (
    <div>
      <p className="rounded-2xl bg-primary/10 px-4 py-3 text-body font-bold text-foreground">{guide.one_line}</p>
      <Sub>이렇게 맡겨요</Sub>
      <div className="mt-1.5">
        <Dots items={guide.delegate} />
      </div>
      {guide.motivate.length > 0 && (
        <>
          <Sub>이렇게 힘이 나요</Sub>
          <div className="mt-1.5">
            <Dots items={guide.motivate} />
          </div>
        </>
      )}
      <Sub>고칠 점은 이 순서로</Sub>
      <ol className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {guide.feedback.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="rounded-full bg-secondary px-3 py-1 text-label font-bold text-foreground">{s}</span>
            {i < guide.feedback.length - 1 && <span aria-hidden className="text-label text-muted-foreground">›</span>}
          </li>
        ))}
      </ol>
      <Sub>나와 엇갈리기 쉬운 곳</Sub>
      <div className="mt-1.5 space-y-2">
        {guide.clash.map((m, i) => (
          <div key={i} className="rounded-2xl bg-secondary/70 px-4 py-3">
            <p className="text-label font-bold text-muted-foreground">{m.when}</p>
            <p className="mt-0.5 text-body text-foreground">{m.try}</p>
          </div>
        ))}
      </div>
      {guide.down && (
        <>
          <Sub>힘들어 보일 땐</Sub>
          <p className="mt-1.5 text-body text-foreground">{guide.down}</p>
        </>
      )}
      {guide.first_line && (
        <>
          <Sub>다음에 건넬 첫 한마디</Sub>
          <p className="mt-1.5 rounded-2xl border border-border px-4 py-3 text-body text-foreground">“{guide.first_line}”</p>
        </>
      )}
    </div>
  );
}

const Working = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-4 py-3 text-body text-foreground">
    <Sparkles aria-hidden className="h-4 w-4 shrink-0 animate-pulse text-primary" />
    {text}
  </p>
);

function LeaderItem({ row }: { row: LeaderRow }) {
  const [open, setOpen] = useState(false);
  const call = leaderCallOf(row.person?.title);
  if (!row.card) return null;
  return (
    <div className="rounded-2xl border border-border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <Avatar person={row.person} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-black text-foreground">
            {row.person?.name ?? call} {call}
          </span>
          <span className="block truncate text-label text-muted-foreground">{row.card.one_line}</span>
        </span>
        <ChevronDown aria-hidden className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <LeaderCardBody card={row.card} />
        </div>
      )}
    </div>
  );
}

export default function CoachLeadSection({ branch, mode, onOpenMind }: { branch: string | null; mode: "lead" | "follow"; onOpenMind: () => void }) {
  const q = useCoachLeadState(branch);
  const share = useLeadShare();
  const makeTeam = useMakeTeamCard();
  const makeGuide = useMakeLeadGuide();
  const [guideFor, setGuideFor] = useState<LeadCoachRow | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);

  const d = q.data;
  if (!d?.staff || !d.me) return null;
  const me = d.me;
  const ai = !!d.ai;
  const hq = !!d.hq;
  const br = d.branch ?? branch;
  const leaders = (d.leaders ?? []).filter((l) => l.card);
  const coaches = d.coaches ?? [];

  const toggle = (v: { lead?: boolean; team?: boolean }, okText: string) =>
    share.mutate(v, { onSuccess: () => toast.success(okText), onError: (e) => toast.error((e as Error).message) });

  const runTeam = () =>
    makeTeam.mutate(br, {
      onSuccess: (r) => {
        if (!r.stale) {
          toast.success("오삼코치가 내 이해 카드를 만들었어요 — 읽어 보고 보여 주기를 켜 주세요");
          setTeamOpen(true);
        }
      },
      onError: (e) => toast.error((e as Error).message),
    });

  const runGuide = (row: LeadCoachRow) => {
    const id = row.person?.user_id;
    if (!id) return;
    makeGuide.mutate(
      { coach: id, branch: br },
      {
        onSuccess: (r) => setGuideFor({ ...row, guide: r.guide, stale: false, guide_at: new Date().toISOString() }),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  /* ───────────── 코치님 보기 ───────────── */
  if (mode === "follow") {
    const showAllow = me.has_mind && !d.can_direct;
    if (leaders.length === 0 && !showAllow) return null;
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Compass aria-hidden className="h-5 w-5 text-primary" />
          <h3 className="text-heading font-black text-foreground">관장님 이해 카드</h3>
        </div>
        <p className="mt-1 text-label text-muted-foreground">관장님이 원래 어떻게 말하고 일하는 분인지 — 오해 없이 함께 일하게</p>
        {leaders.length > 0 ? (
          <div className="mt-3 space-y-2">
            {leaders.map((l, i) => (
              <LeaderItem key={l.person?.user_id ?? i} row={l} />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-secondary/70 px-4 py-3 text-body text-foreground">관장님이 카드를 열면 여기에 보여요</p>
        )}
        {showAllow && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-secondary/70 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-body font-bold text-foreground">지점장님께 리드 가이드 허락</span>
              <span className="mt-0.5 block text-label text-muted-foreground">
                내 카드를 바탕으로 '나를 이끄는 법'을 지점장님께만 정리해 드려요. 카드 답은 보이지 않고, 끄면 바로 안 보여요
              </span>
            </span>
            <Switch
              checked={me.share_lead}
              disabled={share.isPending}
              onCheckedChange={(v) => toggle({ lead: v }, v ? "허락했어요 — 지점장님이 나에게 맞게 이끌 수 있어요" : "허락을 껐어요")}
              aria-label="지점장님께 리드 가이드 허락"
            />
          </div>
        )}
      </Card>
    );
  }

  /* ───────────── 관장님 보기 ───────────── */
  const call = hq ? "대표님" : "관장님";
  return (
    <>
      <Card>
        <div className="flex items-center gap-2">
          <Compass aria-hidden className="h-5 w-5 text-primary" />
          <h3 className="text-heading font-black text-foreground">내 이해 카드</h3>
        </div>
        <p className="mt-1 text-label text-muted-foreground">코치님들이 {call}의 말과 지시를 오해 없이 읽게 — 켜면 이 지점 코치님들이 봐요</p>
        <div className="mt-3">
          {!me.has_mind ? (
            <PrimaryButton onClick={onOpenMind}>내 성향 카드부터 쓰기 · 5분</PrimaryButton>
          ) : makeTeam.isPending ? (
            <Working text="오삼코치가 정리하는 중이에요…" />
          ) : me.team_card ? (
            <>
              <button
                type="button"
                onClick={() => setTeamOpen(true)}
                className="w-full rounded-2xl bg-primary/10 px-4 py-3 text-left text-body font-bold text-foreground active:scale-[0.99]"
              >
                {me.team_card.one_line}
                <span className="mt-1 block text-label font-bold text-primary">전체 보기 ›</span>
              </button>
              {me.team_stale && <p className="mt-2 text-label font-bold text-primary">성향 카드를 고쳤어요 — 다시 만들어야 코치님들께 보여요</p>}
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-secondary/70 px-4 py-3">
                <span className="text-body font-bold text-foreground">코치님들께 보여 주기</span>
                <Switch
                  checked={me.share_team}
                  disabled={share.isPending || me.team_stale}
                  onCheckedChange={(v) => toggle({ team: v }, v ? "코치님들께 보여 줘요" : "보여 주기를 껐어요")}
                  aria-label="코치님들께 이해 카드 보여 주기"
                />
              </div>
              {ai && (
                <GhostButton onClick={runTeam} className="mt-2 w-full">
                  다시 만들기
                </GhostButton>
              )}
            </>
          ) : ai ? (
            <button
              type="button"
              onClick={runTeam}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary/10 text-label font-black text-primary active:scale-[0.99]"
            >
              <Sparkles aria-hidden className="h-4 w-4" />
              오삼코치로 이해 카드 만들기
            </button>
          ) : (
            <p className="text-body text-foreground">오삼코치 정리가 켜지면 만들 수 있어요</p>
          )}
        </div>
      </Card>

      {coaches.length > 0 && (
        <Card>
          <div className="flex items-center gap-2">
            <Users aria-hidden className="h-5 w-5 text-primary" />
            <h3 className="text-heading font-black text-foreground">리드 가이드</h3>
          </div>
          <p className="mt-1 text-label text-muted-foreground">
            내 카드와 코치님 카드를 겹쳐 '이 코치님을 이끄는 법'을 정리해요 · {call}만 봐요
            {!hq && " · 코치님이 허락한 분만"}
          </p>
          {!me.has_mind && <p className="mt-3 rounded-2xl bg-secondary/70 px-4 py-3 text-body text-foreground">내 성향 카드가 있어야 만들 수 있어요</p>}
          <div className="mt-3 divide-y divide-border">
            {coaches.map((r, i) => {
              const can = me.has_mind && r.allowed && ai;
              const busy = makeGuide.isPending && makeGuide.variables?.coach === r.person?.user_id;
              return (
                <button
                  key={r.person?.user_id ?? i}
                  type="button"
                  disabled={!r.guide && !can}
                  onClick={() => (r.guide && !r.stale ? setGuideFor(r) : can ? runGuide(r) : r.guide ? setGuideFor(r) : undefined)}
                  className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-60"
                >
                  <Avatar person={r.person} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-foreground">
                      {r.person?.name ?? "코치님"} <span className="text-label text-muted-foreground">{r.person?.title ?? ""}</span>
                    </span>
                    <span className={cn("block text-label", r.guide && !r.stale ? "text-primary" : "text-muted-foreground")}>
                      {busy ? "오삼코치가 정리하는 중이에요…" : leadRowLine(r, hq)}
                    </span>
                  </span>
                  {busy ? <Sparkles aria-hidden className="h-4 w-4 animate-pulse text-primary" /> : <span aria-hidden className="text-label text-muted-foreground">›</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-label leading-snug text-muted-foreground">
            평가 · 급여 · 근무에는 쓰지 않아요. 맡기는 법 · 전하는 순서 · 말투에만 써 주세요.
          </p>
        </Card>
      )}

      <DmSheet open={teamOpen} onClose={() => setTeamOpen(false)} tall title="내 이해 카드" subtitle={me.team_card_at ? `${agoKo(me.team_card_at)} 만듦 · 코치님들이 읽는 글이에요` : undefined}>
        {me.team_card && <LeaderCardBody card={me.team_card} />}
      </DmSheet>

      <DmSheet
        open={!!guideFor}
        onClose={() => setGuideFor(null)}
        tall
        title={`리드 가이드 · ${guideFor?.person?.name ?? "코치님"}`}
        subtitle={guideFor?.guide_at ? `${agoKo(guideFor.guide_at)} 만듦 · ${call}만 봐요` : undefined}
        footer={
          guideFor && me.has_mind && guideFor.allowed && ai ? (
            <GhostButton onClick={() => runGuide(guideFor)} className="w-full">
              {makeGuide.isPending ? "정리하는 중…" : "다시 만들기"}
            </GhostButton>
          ) : undefined
        }
      >
        {guideFor?.guide && <LeadGuideBody guide={guideFor.guide} />}
      </DmSheet>
    </>
  );
}
