/**
 * 🧭 나의 153 성향 — 내 운동 기록 카드 + 검사 창 (2026-11-25 대표님 「회원님들도 mbti 검사를 통해 …
 *    코치님들이 회원님들의 성격 성향을 빠르게 파악하여 거기에 맞게 지도할수있도록」)
 *   처음 = 초대(5분 · 챔피언 머니 3,000) → 36문항 한 장에 하나(고르면 다음) → 결과(16유형 · 다섯 가지 성격 막대 · 코치님께 전해지는 지도법).
 *   답 원문은 나만 · 지도 카드는 우리 지점 코치님 · 대표님이 봐요. 문항 · 채점은 supabase/functions/_shared/memberStyle.ts 한 곳.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";
import {
  BIG5_ITEMS,
  BIG5_NAMES,
  PREF_ITEMS,
  SCALE_LABELS,
  STYLE_REWARD_GEMS,
  TYPE_ITEMS,
  cleanStyleAnswers,
  missingItems,
  scoreStyle,
  type Big5,
  type CoachCard,
  type StyleAnswers,
} from "../../../supabase/functions/_shared/memberStyle.ts";
import { makeStyleCard, useClearMemberStyle, useMemberStyleMe, useSaveMemberStyle } from "@/services/memberStyleService";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

type Step = { kind: "scale"; id: string; text: string; group: string } | { kind: "pref"; id: string; text: string; options: Array<{ v: string; label: string }> };

const STEPS: Step[] = [
  ...TYPE_ITEMS.map((i) => ({ kind: "scale" as const, id: i.id, text: i.text, group: "나의 운동 성향" })),
  ...BIG5_ITEMS.map((i) => ({ kind: "scale" as const, id: i.id, text: i.text, group: "나는 이런 사람" })),
  ...PREF_ITEMS.map((i) => ({ kind: "pref" as const, id: i.id, text: i.title, options: i.options })),
];

const Bar = ({ value }: { value: number }) => (
  <div className="h-2.5 flex-1 rounded-full bg-muted" aria-hidden>
    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(3, value))}%` }} />
  </div>
);

export function StyleResult({ answers, card, compact }: { answers: StyleAnswers; card: CoachCard | null; compact?: boolean }) {
  const s = useMemo(() => scoreStyle(cleanStyleAnswers(answers)), [answers]);
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-display font-black tracking-wider text-foreground">{s.type16}</span>
        <span className="text-label text-muted-foreground">153 성향 16유형(MBTI 방식)</span>
      </div>
      {card?.one_line && <p className="mt-1 text-heading font-bold leading-snug text-foreground">{card.one_line}</p>}
      <ul className="mt-4 space-y-2">
        {(Object.keys(BIG5_NAMES) as Big5[]).map((f) => (
          <li key={f} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-label font-bold text-foreground">{BIG5_NAMES[f]}</span>
            <Bar value={s.big5[f]} />
          </li>
        ))}
      </ul>
      {!compact && card && (
        <div className="mt-5 rounded-2xl bg-muted/50 p-4">
          <p className="text-label font-bold text-muted-foreground">코치님께는 이렇게 전해져요</p>
          <ul className="mt-2 space-y-1.5 text-body leading-relaxed text-foreground">
            <li>· 설명: {card.teach.explain}</li>
            <li>· 교정: {card.teach.correct}</li>
            <li>· 칭찬: {card.teach.praise}</li>
            <li>· 강도: {card.teach.intensity}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function StyleSheet({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: StyleAnswers | null }) {
  const [phase, setPhase] = useState<"intro" | "q" | "done">("intro");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<StyleAnswers>(initial ?? {});
  const [agree, setAgree] = useState(false);
  const [card, setCard] = useState<CoachCard | null>(null);
  const [making, setMaking] = useState(false);
  const save = useSaveMemberStyle();
  const qc = useQueryClient();
  const { user } = useAuth();

  const step = STEPS[i];
  const pick = async (v: number | string) => {
    const next = { ...answers, [step.id]: v };
    setAnswers(next);
    if (i < STEPS.length - 1) {
      setI(i + 1);
      return;
    }
    const clean = cleanStyleAnswers(next);
    if (missingItems(clean).length) {
      toast.error("빠진 문항이 있어요");
      return;
    }
    try {
      const r = await save.mutateAsync(clean);
      setPhase("done");
      if (r.reward > 0) toast.success(`검사 완료! 챔피언 머니 ${r.reward.toLocaleString()} 받았어요`);
      setMaking(true);
      const made = await makeStyleCard();
      setMaking(false);
      if (made.ok && made.card) {
        setCard(made.card);
        qc.invalidateQueries({ queryKey: ["153style", "me", user?.id] });
      }
    } catch (e: any) {
      toast.error(e?.message || "저장하지 못했어요");
    }
  };

  return (
    <DmSheet open={open} onClose={onClose} title="나의 153 성향 검사" tall backClose>
      <div className="px-5 pb-6 pt-2">
        {phase === "intro" && (
          <div>
            <p className="text-title font-black leading-snug text-foreground">나에게 맞는 지도법을 코치님께 알려 드려요</p>
            <p className="mt-2 text-body leading-relaxed text-foreground">36문항 · 5분이면 끝나요. 정답은 없어요 — 지금의 나에게 가까운 쪽으로 골라 주세요.</p>
            <ul className="mt-4 space-y-1.5 text-label leading-relaxed text-foreground">
              <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /><span>고른 답은 나만 봐요 · 코치님 · 대표님은 「지도 카드」만 봐요</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /><span>진단 · 평가가 아니에요 — 나에게 맞게 가르치는 데만 써요</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /><span>언제든 다시 하거나 지울 수 있어요</span></li>
            </ul>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
              <span className="text-body leading-snug text-foreground">
                검사 답으로 만든 지도 카드를 우리 지점 코치님이 수업에 참고하는 데 동의해요
                <span className="mt-1 block text-label text-muted-foreground">보관: 내가 지울 때까지 · 회원 탈퇴 때 파기</span>
              </span>
            </label>
            <button
              type="button"
              disabled={!agree}
              onClick={() => { setPhase("q"); setI(0); }}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-body font-bold text-primary-foreground disabled:opacity-50"
            >
              {agree ? `시작하기 · 처음이면 챔피언 머니 ${STYLE_REWARD_GEMS.toLocaleString()}` : "동의하면 시작할 수 있어요"}
            </button>
          </div>
        )}

        {phase === "q" && step && (
          <div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => (i > 0 ? setI(i - 1) : setPhase("intro"))} className="flex h-10 items-center gap-1 text-label font-bold text-muted-foreground">
                <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
              </button>
              <span className="text-label font-bold tabular-nums text-muted-foreground">{i + 1} / {STEPS.length}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>
            <p className="mt-6 text-label font-bold text-primary">{step.kind === "scale" ? step.group : "복싱 지도 선호"}</p>
            <p className="mt-1 text-title font-black leading-snug text-foreground">{step.text}</p>
            <div className="mt-6 space-y-2">
              {step.kind === "scale"
                ? SCALE_LABELS.map((label, k) => (
                    <button key={label} type="button" disabled={save.isPending} onClick={() => pick(k + 1)}
                      className={cn("h-14 w-full rounded-2xl border px-4 text-left text-body font-bold transition-transform active:scale-[0.99]",
                        answers[step.id] === k + 1 ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground")}>
                      {label}
                    </button>
                  ))
                : step.options.map((o) => (
                    <button key={o.v} type="button" disabled={save.isPending} onClick={() => pick(o.v)}
                      className={cn("min-h-14 w-full rounded-2xl border px-4 py-3 text-left text-body font-bold transition-transform active:scale-[0.99]",
                        answers[step.id] === o.v ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground")}>
                      {o.label}
                    </button>
                  ))}
            </div>
            {save.isPending && <p className="mt-4 text-center text-label text-muted-foreground">저장하는 중…</p>}
          </div>
        )}

        {phase === "done" && (
          <div>
            <p className="text-label font-bold text-primary">검사 완료</p>
            <StyleResult answers={answers} card={card} />
            {making && (
              <p className="mt-5 flex items-center gap-2 rounded-2xl bg-muted/50 p-4 text-body text-foreground">
                <Sparkles className="h-5 w-5 shrink-0 animate-pulse text-primary" aria-hidden /> 오삼코치가 코치님께 드릴 지도 카드를 만들고 있어요…
              </p>
            )}
            <button type="button" onClick={onClose} className="mt-6 h-14 w-full rounded-2xl bg-foreground text-body font-bold text-background">닫기</button>
          </div>
        )}
      </div>
    </DmSheet>
  );
}

const MemberStyleCard = () => {
  const { data } = useMemberStyleMe();
  const clear = useClearMemberStyle();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);

  // TV 2번 「체육관 공지사항」 QR(?style=1 · 2026-11-26) — 이 카드로 내려오고, 아직 검사 전이면 검사 창을 연다 (한 번만 · 주소에서 지운다)
  useEffect(() => {
    if (handled.current || !data?.available || !data.on || params.get("style") !== "1") return;
    handled.current = true;
    window.setTimeout(() => document.getElementById("member-style")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    if (!data.profile?.answers) setOpen(true);
    const next = new URLSearchParams(params);
    next.delete("style");
    setParams(next, { replace: true });
  }, [data, params, setParams]);

  if (!data?.available || !data.on) return null;
  const p = data.profile;

  return (
    <section id="member-style" className="scroll-mt-20 rounded-2xl border bg-card p-5">
      <h2 className="text-heading font-bold text-foreground">나의 153 성향</h2>
      {!p?.answers ? (
        <>
          <p className="mt-2 text-body leading-relaxed text-foreground">5분 검사로 나에게 맞는 지도법을 코치님께 알려 드려요.</p>
          <p className="mt-1 text-label text-muted-foreground">처음 하면 챔피언 머니 {STYLE_REWARD_GEMS.toLocaleString()} — 캐릭터 꾸미기에 써요</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-4 h-14 w-full rounded-2xl bg-primary text-body font-bold text-primary-foreground">
            성향 검사 시작하기
          </button>
        </>
      ) : (
        <>
          <div className="mt-3"><StyleResult answers={p.answers} card={p.card} /></div>
          {!p.card && <p className="mt-3 text-label text-muted-foreground">지도 카드를 만드는 중이에요 — 코치님이 열면 다시 만들어져요</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOpen(true)} className="h-12 rounded-xl border border-border text-body font-bold text-foreground">다시 검사</button>
            <button
              type="button"
              disabled={clear.isPending}
              onClick={async () => {
                if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 4000); return; }
                await clear.mutateAsync().catch((e) => toast.error(e.message));
                setConfirmClear(false);
              }}
              className="h-12 rounded-xl border border-border text-body font-bold text-muted-foreground"
            >
              {confirmClear ? "한 번 더 누르면 지워요" : "지우기"}
            </button>
          </div>
        </>
      )}
      {open && <StyleSheet open={open} onClose={() => setOpen(false)} initial={p?.answers ?? null} />}
    </section>
  );
};

export default MemberStyleCard;
