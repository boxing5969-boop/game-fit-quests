/**
 * 🧭 153 코치 성향 카드 · 맞춤 피드백 — 아래에서 올라오는 창 다섯 (2026-11-05 대표님)
 *   성향 카드 쓰기(코치님) · 카드 보기(대표님) · 피드백 쓰기 3단계(메모 → 공통 기준 → 코치님마다) · 보낸 피드백 현황 · 한마디
 *   서버가 권한을 다시 본다(coach_mind_* · coach_note_* · Edge Function coach-mind) — 화면은 단추를 보여 줄 뿐
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import {
  agoKo,
  answeredCount,
  answerLabels,
  cleanMindAnswers,
  coreReady,
  emptyCore,
  isPicked,
  MBTI_TYPES,
  MIND_GROUPS,
  MIND_NOTE_LIMITS,
  MIND_QUESTIONS,
  noteCounts,
  requiredDone,
  tidyCore,
  toggleAnswer,
  type MbtiSource,
  type MindAnswers,
  type MindProfile,
  type NoteBody,
  type NoteCore,
  type ReceivedNote,
  type SentNote,
  type TeamMind,
} from "@/lib/coachMind";
import {
  makeNoteCore,
  makeNoteTailor,
  useAckNote,
  useClearMind,
  useRemoveNote,
  useSaveMind,
  useSendNote,
} from "@/services/coachMindService";
import { Avatar, GhostButton, PrimaryButton } from "./CoachStdCards";
import { FieldLabel, fieldCls } from "./CoachStdSheets";
import { CorePoints, MindSummaryBody, NoteBodyView } from "./CoachMindCards";

const Chip = ({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn(
      "min-h-[2.75rem] rounded-xl border px-3 py-2 text-label font-bold leading-snug active:scale-[0.97]",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
      className,
    )}
  >
    {children}
  </button>
);

/* ───────────── 코치님 — 성향 카드 쓰기 ───────────── */

export function MindFormSheet({
  open,
  onClose,
  mind,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  mind: MindProfile | null;
  onSaved: () => void;
}) {
  const save = useSaveMind();
  const clear = useClearMind();
  const [answers, setAnswers] = useState<MindAnswers>({});
  const [mbti, setMbti] = useState<string | null>(null);
  const [src, setSrc] = useState<MbtiSource>("guess");
  const [power, setPower] = useState("");
  const [know, setKnow] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnswers(cleanMindAnswers(mind?.answers ?? {}));
    setMbti(mind?.mbti ?? null);
    setSrc(mind?.mbti_source ?? "guess");
    setPower(mind?.note_power ?? "");
    setKnow(mind?.note_know ?? "");
    setConsent(!!mind?.consent_at);
    // 열 때 한 번만 — 저장된 카드가 다시 읽혀도 쓰던 답을 덮지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = MIND_QUESTIONS.length;
  const answered = answeredCount(answers);
  const must = requiredDone(answers);

  const submit = () =>
    save.mutate(
      { answers, mbti, mbtiSource: mbti ? src : null, notePower: power, noteKnow: know, consent },
      {
        onSuccess: () => {
          toast.success("저장했어요 — 오삼코치가 정리해요");
          onClose();
          onSaved();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  const wipe = () => {
    if (!window.confirm("성향 카드를 지울까요? 대표님 피드백은 기준 그대로 받게 돼요")) return;
    clear.mutate(null, {
      onSuccess: () => {
        toast.success("성향 카드를 지웠어요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="코치 성향 카드"
      subtitle={`${answered}/${total} 답함 · 5분`}
      footer={
        <PrimaryButton onClick={submit} disabled={!must || !consent || save.isPending}>
          {save.isPending ? "저장하는 중…" : !must ? "피드백 순서 · 말투를 골라 주세요" : !consent ? "맨 아래 안내에 동의해 주세요" : "저장"}
        </PrimaryButton>
      }
    >
      <div className="rounded-2xl bg-secondary/70 p-4">
        <p className="text-body font-bold text-foreground">대표님 · 지점장님이 코치님이 가장 잘 알아듣는 방식으로 피드백을 전하도록 돕는 카드예요.</p>
        <ul className="mt-2 space-y-1 text-label text-foreground">
          <li>· 평가 · 급여 · 근무에는 쓰지 않아요. 전하는 순서와 말투에만 써요</li>
          <li>· 볼 수 있는 사람: 나 · 대표님 (지점장님은 카드를 볼 수 없어요)</li>
          <li>· 오삼코치(AI · Anthropic, 미국)가 요약과 맞춤 글을 만들 때 읽어요</li>
          <li>· 쓰지 않아도 괜찮아요 — 그때는 기준 그대로 받아요. 언제든 고치거나 지울 수 있어요</li>
        </ul>
      </div>

      <FieldLabel hint="선택 · 몰라도 괜찮아요">MBTI</FieldLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {MBTI_TYPES.map((t) => (
          <Chip key={t} on={mbti === t} onClick={() => setMbti(mbti === t ? null : t)} className="px-0 tabular-nums">
            {t}
          </Chip>
        ))}
      </div>
      {mbti && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Chip on={src === "test"} onClick={() => setSrc("test")}>
            검사해서 나왔어요
          </Chip>
          <Chip on={src === "guess"} onClick={() => setSrc("guess")}>
            대충 이럴 것 같아요
          </Chip>
        </div>
      )}

      {MIND_GROUPS.map((g) => (
        <section key={g.id} className="mt-7">
          <h3 className="text-heading font-black text-foreground">{g.title}</h3>
          {g.hint && <p className="mt-0.5 text-label text-muted-foreground">{g.hint}</p>}
          {MIND_QUESTIONS.filter((q) => q.group === g.id).map((q) => (
            <div key={q.id} className="mt-4">
              <p className="mb-1.5 text-label font-bold text-foreground">
                {q.title}
                {q.required && <span className="ml-1 text-primary">*</span>}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {q.options.map((o) => (
                  <Chip key={o.v} on={isPicked(answers, q, o.v)} onClick={() => setAnswers((a) => toggleAnswer(a, q, o.v))}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      <section className="mt-7">
        <h3 className="text-heading font-black text-foreground">한 줄씩</h3>
        <p className="mt-0.5 text-label text-muted-foreground">선택 · 그대로 옮기지 않고 말투를 맞출 때만 써요</p>
        <FieldLabel hint={`${power.length}/${MIND_NOTE_LIMITS.power}`}>이렇게 말해 주시면 가장 힘이 나요</FieldLabel>
        <textarea
          value={power}
          onChange={(e) => setPower(e.target.value)}
          rows={2}
          maxLength={MIND_NOTE_LIMITS.power}
          placeholder="예: 회원님들 반응이 좋았다고 말해 주시면 힘이 나요"
          className={cn(fieldCls, "resize-none")}
        />
        <FieldLabel hint={`${know.length}/${MIND_NOTE_LIMITS.know}`}>이건 꼭 알아주셨으면 해요</FieldLabel>
        <textarea
          value={know}
          onChange={(e) => setKnow(e.target.value)}
          rows={3}
          maxLength={MIND_NOTE_LIMITS.know}
          placeholder="예: 새 동작은 혼자 먼저 연습해 보고 수업에 넣는 편이에요"
          className={cn(fieldCls, "resize-none")}
        />
      </section>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span className="text-body text-foreground">위 안내를 읽었어요. 성향 카드를 쓰고 오삼코치가 읽는 데 동의해요</span>
      </label>

      {mind && (
        <button type="button" onClick={wipe} disabled={clear.isPending} className="mt-4 w-full py-2 text-label font-bold text-destructive">
          성향 카드 지우기
        </button>
      )}
    </DmSheet>
  );
}

/* ───────────── 대표님 — 코치님 카드 보기 ───────────── */

const AnswerRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-3 py-2">
    <span className="w-28 shrink-0 text-label font-bold text-muted-foreground">{label}</span>
    <span className="min-w-0 flex-1 text-body text-foreground">{value}</span>
  </div>
);

export function MindViewSheet({
  open,
  onClose,
  member,
  onWrite,
}: {
  open: boolean;
  onClose: () => void;
  member: TeamMind | null;
  onWrite: (coach: string) => void;
}) {
  const clear = useClearMind();
  const m = member?.mind;
  const name = member?.person?.name ?? "코치님";
  const uid = member?.person?.user_id ?? null;
  const wipe = () => {
    if (!uid || !window.confirm(`${name}님 성향 카드를 지울까요? (근무가 끝난 분 등)`)) return;
    clear.mutate(uid, {
      onSuccess: () => {
        toast.success("성향 카드를 지웠어요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };
  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title={`성향 카드 · ${name}`}
      subtitle={m ? `${agoKo(m.updated_at)} 저장 · 본인과 대표님만 봐요` : undefined}
      footer={uid ? <PrimaryButton onClick={() => onWrite(uid)}>이 코치님께 피드백 쓰기</PrimaryButton> : undefined}
    >
      {!m ? (
        <p className="text-body text-muted-foreground">아직 카드가 없어요</p>
      ) : (
        <>
          {m.summary ? (
            <MindSummaryBody mind={m} />
          ) : (
            <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-body text-foreground">오삼코치 요약은 아직이에요 — 코치님 답은 아래에 있어요</p>
          )}
          <h4 className="mt-6 text-heading font-black text-foreground">코치님이 고른 답</h4>
          <div className="mt-1 divide-y divide-border">
            {m.mbti && <AnswerRow label="MBTI" value={`${m.mbti} · ${m.mbti_source === "test" ? "검사 결과" : "짐작"}`} />}
            {MIND_QUESTIONS.map((q) => {
              const ls = answerLabels(m.answers ?? {}, q);
              return ls.length ? <AnswerRow key={q.id} label={q.name} value={ls.join(" · ")} /> : null;
            })}
            {m.note_power && <AnswerRow label="힘이 나는 말" value={m.note_power} />}
            {m.note_know && <AnswerRow label="알아주셨으면" value={m.note_know} />}
          </div>
          <p className="mt-4 rounded-2xl bg-secondary px-3 py-2 text-label leading-snug text-muted-foreground">
            평가 · 급여 · 근무에는 쓰지 않기로 코치님께 약속했어요. 전하는 순서와 말투에만 써 주세요.
          </p>
          <button type="button" onClick={wipe} disabled={clear.isPending} className="mt-3 w-full py-2 text-label font-bold text-destructive">
            카드 지우기
          </button>
        </>
      )}
    </DmSheet>
  );
}

/* ───────────── 대표님 · 지점장님 — 피드백 쓰기 (메모 → 공통 기준 → 코치님마다) ───────────── */

type Step = "write" | "core" | "review";
type Tailor = { status: "loading" | "done" | "plain" | "error"; body: NoteBody | null; error?: string };

const MEMO_EXAMPLE =
  "예: 아직 스트레이트도 안 되어 있는데 어퍼나 훅 같은 동작을 지도하면 안 됨. 경력이나 실력별로 최소 2그룹으로 나눠 지도. 새 동작은 시범 먼저 → 단계별로 → 한 명 한 명 빠르게 잡아 주기(한 사람당 30초 넘기지 않기)…";

function BodyEditor({ body, onChange }: { body: NoteBody; onChange: (b: NoteBody) => void }) {
  return (
    <div className="mt-3 space-y-2">
      <input value={body.greeting} onChange={(e) => onChange({ ...body, greeting: e.target.value })} maxLength={160} placeholder="첫인사" className={fieldCls} />
      <textarea
        value={body.lines.join("\n")}
        onChange={(e) => onChange({ ...body, lines: e.target.value.split("\n") })}
        rows={Math.max(4, body.lines.length + 1)}
        placeholder="한 줄에 하나씩"
        className={cn(fieldCls, "resize-none")}
      />
      <input value={body.try_today} onChange={(e) => onChange({ ...body, try_today: e.target.value })} maxLength={160} placeholder="오늘 해 볼 것" className={fieldCls} />
      <input value={body.closing} onChange={(e) => onChange({ ...body, closing: e.target.value })} maxLength={120} placeholder="맺음" className={fieldCls} />
    </div>
  );
}

export function NoteComposeSheet({
  open,
  onClose,
  team,
  branch,
  ai,
  preselect,
}: {
  open: boolean;
  onClose: () => void;
  team: TeamMind[];
  branch: string | null;
  ai?: boolean;
  preselect?: string[] | null;
}) {
  const send = useSendNote();
  const [step, setStep] = useState<Step>("write");
  const [memo, setMemo] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [core, setCore] = useState<NoteCore>(emptyCore());
  const [coreBusy, setCoreBusy] = useState(false);
  const [tail, setTail] = useState<Record<string, Tailor>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const openRef = useRef(open);
  const tok = useRef<Record<string, number>>({});

  const members = useMemo(() => team.filter((t) => !!t.person?.user_id), [team]);
  const byId = useMemo(() => new Map(members.map((t) => [t.person!.user_id, t])), [members]);

  useEffect(() => {
    openRef.current = open;
    if (!open) {
      tok.current = {};
      return;
    }
    setStep("write");
    setMemo("");
    setCore(emptyCore());
    setTail({});
    setEditing(null);
    const all = members.map((t) => t.person!.user_id);
    setPicked(preselect?.length ? preselect.filter((id) => all.includes(id)) : all);
    // 열 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const withCard = picked.filter((id) => byId.get(id)?.has_mind).length;

  /* 1. 메모 */
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allOn = members.length > 0 && picked.length === members.length;

  const organize = async () => {
    if (memo.replace(/\s/g, "").length < 8) {
      toast.error("한두 줄만 더 적어 주세요");
      return;
    }
    setCoreBusy(true);
    try {
      const r = await makeNoteCore(memo.trim(), branch);
      if (!openRef.current) return;
      setCore({ ...r.core, checks: r.core.checks ?? [] });
      setStep("core");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCoreBusy(false);
    }
  };

  const manual = () => {
    const text = memo.trim();
    setCore({ ...emptyCore(), title: text.split("\n")[0].slice(0, 60), points: [{ head: "", body: text.slice(0, 200) }] });
    setStep("core");
  };

  /* 2. 공통 기준 */
  const setPoint = (i: number, k: "head" | "body", v: string) =>
    setCore((c) => ({ ...c, points: c.points.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const addPoint = () => setCore((c) => (c.points.length >= 8 ? c : { ...c, points: [...c.points, { head: "", body: "" }] }));
  const removePoint = (i: number) => setCore((c) => ({ ...c, points: c.points.filter((_, j) => j !== i) }));
  const setCheck = (i: number, v: string) =>
    setCore((c) => {
      const checks = [...c.checks];
      while (checks.length <= i) checks.push("");
      checks[i] = v;
      return { ...c, checks };
    });

  /* 3. 코치님마다 — 세 분씩 나눠 부른다 */
  const startTailor = (ids: string[], c: NoteCore) => {
    if (ids.length === 0) return;
    const queue = [...ids];
    const mine: Record<string, number> = {};
    for (const id of ids) {
      mine[id] = (tok.current[id] ?? 0) + 1;
      tok.current[id] = mine[id];
    }
    setTail((t) => ({ ...t, ...Object.fromEntries(ids.map((id) => [id, { status: "loading", body: null } as Tailor])) }));
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        let next: Tailor;
        try {
          const r = await makeNoteTailor(id, c, branch);
          next = r.body ? { status: "done", body: r.body } : { status: "plain", body: null };
        } catch (e) {
          next = { status: "error", body: null, error: (e as Error).message };
        }
        if (!openRef.current || tok.current[id] !== mine[id]) continue;
        setTail((t) => ({ ...t, [id]: next }));
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, ids.length) }, () => worker()));
  };

  const toReview = () => {
    const c = tidyCore(core);
    if (!coreReady(c)) {
      toast.error("제목과 기준을 한 가지 이상 써 주세요");
      return;
    }
    if (picked.length === 0) {
      toast.error("받을 코치님을 골라 주세요");
      return;
    }
    setCore(c);
    setEditing(null);
    const cards = picked.filter((id) => byId.get(id)?.has_mind);
    const plain = picked.filter((id) => !byId.get(id)?.has_mind || !ai);
    tok.current = {};
    setTail(Object.fromEntries(plain.map((id) => [id, { status: "plain", body: null } as Tailor])));
    setStep("review");
    if (ai) startTailor(cards, c);
  };

  const busy = picked.some((id) => tail[id]?.status === "loading");
  const failed = picked.filter((id) => tail[id]?.status === "error").length;

  const submit = () => {
    const items = picked.map((id) => {
      const t = tail[id];
      const b = t?.status === "done" && t.body ? { ...t.body, lines: t.body.lines.map((l) => l.trim()).filter(Boolean) } : null;
      return { coach: id, body: b && b.lines.length ? b : null };
    });
    send.mutate(
      { branch, core: tidyCore(core), items },
      {
        onSuccess: () => {
          toast.success(`${items.length}명에게 보냈어요 — 휴대폰 알림이 가요`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const title = step === "write" ? "피드백 쓰기" : step === "core" ? "공통 기준 확인" : "코치님마다 확인";
  const subtitle =
    step === "write"
      ? "생각나는 대로 — 오삼코치가 정리해요"
      : step === "core"
        ? "모든 코치님께 같은 기준이에요 · 고쳐도 돼요"
        : !ai
          ? "오삼코치가 꺼져 있어 모두 기준 그대로 가요"
          : withCard === 0
            ? "성향 카드가 있는 분이 없어 모두 기준 그대로 가요"
            : `카드 있는 ${withCard}명은 맞춤 · 나머지는 기준 그대로`;

  const footer =
    step === "write" ? (
      <div className="space-y-2">
        <PrimaryButton onClick={ai ? organize : manual} disabled={coreBusy || picked.length === 0 || memo.replace(/\s/g, "").length < 8}>
          {ai && <Sparkles aria-hidden className={cn("h-4 w-4", coreBusy && "animate-pulse")} />}
          {coreBusy ? "오삼코치가 정리하는 중…" : ai ? "오삼코치로 정리하기" : "다음"}
        </PrimaryButton>
        {ai && !coreBusy && (
          <button type="button" onClick={manual} className="w-full py-1 text-label font-bold text-muted-foreground">
            직접 정리하기
          </button>
        )}
      </div>
    ) : step === "core" ? (
      <div className="flex gap-2">
        <GhostButton onClick={() => setStep("write")} className="h-12 shrink-0">
          메모로
        </GhostButton>
        <PrimaryButton onClick={toReview} className="flex-1">
          {ai && withCard > 0 && <Sparkles aria-hidden className="h-4 w-4" />}
          {ai && withCard > 0 ? "코치님마다 맞추기" : "미리 보기"}
        </PrimaryButton>
      </div>
    ) : (
      <div className="flex gap-2">
        <GhostButton onClick={() => setStep("core")} className="h-12 shrink-0">
          기준으로
        </GhostButton>
        <PrimaryButton onClick={submit} disabled={busy || failed > 0 || send.isPending || picked.length === 0} className="flex-1">
          {send.isPending ? "보내는 중…" : busy ? "맞추는 중…" : failed > 0 ? "다시 만들기가 필요해요" : `${picked.length}명에게 보내기`}
        </PrimaryButton>
      </div>
    );

  return (
    <DmSheet open={open} onClose={onClose} tall title={title} subtitle={subtitle} footer={footer}>
      {step === "write" && (
        <>
          <FieldLabel hint={`${memo.length}/1500`}>피드백 메모</FieldLabel>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={8}
            maxLength={1500}
            placeholder={MEMO_EXAMPLE}
            className={cn(fieldCls, "resize-none")}
          />
          <div className="mb-1.5 mt-5 flex items-baseline justify-between gap-2">
            <p className="text-label font-bold text-foreground">받을 코치님</p>
            <button
              type="button"
              onClick={() => setPicked(allOn ? [] : members.map((t) => t.person!.user_id))}
              className="text-label font-bold text-primary"
            >
              {allOn ? "모두 빼기" : "모두 고르기"}
            </button>
          </div>
          {members.length === 0 ? (
            <p className="text-body text-muted-foreground">이 지점에 코치님이 아직 없어요</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {members.map((t) => {
                const id = t.person!.user_id;
                return (
                  <Chip key={id} on={picked.includes(id)} onClick={() => togglePick(id)} className="flex items-center justify-between gap-1 text-left">
                    <span className="min-w-0 truncate">{t.person?.name}</span>
                    <span className={cn("shrink-0 text-micro font-bold", picked.includes(id) ? "text-background/70" : "text-muted-foreground")}>
                      {t.has_mind ? "카드" : "기본"}
                    </span>
                  </Chip>
                );
              })}
            </div>
          )}
          <p className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-label leading-snug text-muted-foreground">
            메모는 저장하지 않아요. 오삼코치가 공통 기준으로 정리하면 확인하고 고친 뒤 보내요. 회원 이름 · 건강 이야기는 쓰지 말아 주세요.
          </p>
        </>
      )}

      {step === "core" && (
        <>
          <FieldLabel>제목</FieldLabel>
          <input value={core.title} onChange={(e) => setCore((c) => ({ ...c, title: e.target.value }))} maxLength={60} className={fieldCls} />

          <FieldLabel hint={`${core.points.length}/8`}>기준</FieldLabel>
          <div className="space-y-2">
            {core.points.map((p, i) => (
              <div key={i} className="rounded-2xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-micro font-black text-background">{i + 1}</span>
                  <input
                    value={p.head}
                    onChange={(e) => setPoint(i, "head", e.target.value)}
                    maxLength={40}
                    placeholder="짧은 이름"
                    className="min-w-0 flex-1 bg-transparent text-body font-bold text-foreground outline-none"
                  />
                  {core.points.length > 1 && (
                    <button type="button" onClick={() => removePoint(i)} aria-label="이 기준 빼기" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95">
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={p.body}
                  onChange={(e) => setPoint(i, "body", e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="무엇을 · 어떻게"
                  className="mt-2 w-full resize-none bg-transparent text-body text-foreground outline-none"
                />
              </div>
            ))}
          </div>
          {core.points.length < 8 && (
            <GhostButton onClick={addPoint} className="mt-2 w-full">
              <Plus aria-hidden className="mr-1 h-4 w-4" />
              기준 더하기
            </GhostButton>
          )}

          <FieldLabel hint="회원에게 생기는 일">왜</FieldLabel>
          <textarea
            value={core.why}
            onChange={(e) => setCore((c) => ({ ...c, why: e.target.value }))}
            rows={2}
            maxLength={240}
            className={cn(fieldCls, "resize-none")}
          />

          <FieldLabel hint="수업 끝나고 · 선택">스스로 물어볼 것</FieldLabel>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <input key={i} value={core.checks[i] ?? ""} onChange={(e) => setCheck(i, e.target.value)} maxLength={100} placeholder="예 · 아니오로 답할 질문" className={fieldCls} />
            ))}
          </div>
        </>
      )}

      {step === "review" && (
        <div className="space-y-3">
          {picked.map((id) => {
            const m = byId.get(id);
            const t = tail[id];
            const chip =
              t?.status === "done"
                ? { text: "맞춤", cls: "bg-primary/15 text-primary" }
                : t?.status === "loading"
                  ? { text: "만드는 중", cls: "bg-secondary text-muted-foreground" }
                  : t?.status === "error"
                    ? { text: "다시 필요", cls: "bg-destructive/15 text-destructive" }
                    : { text: "기준 그대로", cls: "bg-secondary text-muted-foreground" };
            return (
              <div key={id} className="rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Avatar person={m?.person ?? null} size={36} />
                  <p className="min-w-0 flex-1 truncate text-body font-black text-foreground">
                    {m?.person?.name ?? "코치님"} <span className="text-label font-bold text-muted-foreground">{m?.person?.title}</span>
                  </p>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-micro font-black", chip.cls)}>{chip.text}</span>
                </div>
                {t?.status === "loading" && (
                  <p className="mt-3 flex items-center gap-2 text-label text-muted-foreground">
                    <Sparkles aria-hidden className="h-4 w-4 shrink-0 animate-pulse text-primary" />
                    오삼코치가 이 코치님께 맞추는 중이에요
                  </p>
                )}
                {t?.status === "done" &&
                  t.body &&
                  (editing === id ? (
                    <BodyEditor body={t.body} onChange={(b) => setTail((x) => ({ ...x, [id]: { status: "done", body: b } }))} />
                  ) : (
                    <NoteBodyView body={t.body} className="mt-3" />
                  ))}
                {t?.status === "plain" && (
                  <p className="mt-3 text-label text-muted-foreground">
                    {m?.has_mind ? "공통 기준 그대로 보내요" : "성향 카드가 아직 없어 공통 기준 그대로 가요"}
                  </p>
                )}
                {t?.status === "error" && <p className="mt-3 text-label font-bold text-destructive">{t.error}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {ai && m?.has_mind && t?.status !== "loading" && (
                    <GhostButton onClick={() => startTailor([id], core)} className="h-10">
                      <RefreshCw aria-hidden className="mr-1 h-4 w-4" />
                      다시 만들기
                    </GhostButton>
                  )}
                  {t?.status === "done" && (
                    <GhostButton onClick={() => setEditing(editing === id ? null : id)} className="h-10">
                      {editing === id ? "고치기 끝" : "고치기"}
                    </GhostButton>
                  )}
                  {(t?.status === "error" || t?.status === "done") && (
                    <GhostButton onClick={() => setTail((x) => ({ ...x, [id]: { status: "plain", body: null } }))} className="h-10">
                      기준 그대로 보내기
                    </GhostButton>
                  )}
                  <GhostButton onClick={() => setPicked((p) => p.filter((x) => x !== id))} className="h-10">
                    빼기
                  </GhostButton>
                </div>
              </div>
            );
          })}
          <details className="rounded-2xl bg-secondary/70 px-4 py-3">
            <summary className="cursor-pointer text-label font-bold text-muted-foreground">공통 기준 보기</summary>
            <div className="mt-3">
              <p className="mb-2 text-body font-black text-foreground">{core.title}</p>
              <CorePoints core={core} />
            </div>
          </details>
        </div>
      )}
    </DmSheet>
  );
}

/* ───────────── 보낸 피드백 — 확인 현황 ───────────── */

export function NoteStatusSheet({
  open,
  onClose,
  note,
  canRemove,
}: {
  open: boolean;
  onClose: () => void;
  note: SentNote | null;
  canRemove?: boolean;
}) {
  const remove = useRemoveNote();
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (open) setOpenId(null);
  }, [open, note?.id]);
  const c = noteCounts(note?.items ?? []);
  const wipe = () => {
    if (!note || !window.confirm("이 피드백을 지울까요? 코치님 화면에서도 사라져요")) return;
    remove.mutate(note.id, {
      onSuccess: () => {
        toast.success("지웠어요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };
  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title={note?.title ?? "보낸 피드백"}
      subtitle={note ? [note.author ? `${note.author.name} ${note.author.title}` : "", agoKo(note.created_at)].filter(Boolean).join(" · ") : undefined}
      footer={
        canRemove ? (
          <button type="button" onClick={wipe} disabled={remove.isPending} className="w-full py-2 text-label font-bold text-destructive">
            이 피드백 지우기
          </button>
        ) : undefined
      }
    >
      {note && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "읽음", v: `${c.seen}/${c.total}` },
              { k: "확인", v: `${c.acked}/${c.total}` },
              { k: "한마디", v: `${c.replies}` },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-secondary/70 px-3 py-3 text-center">
                <p className="text-title font-black tabular-nums text-foreground">{x.v}</p>
                <p className="text-label font-bold text-muted-foreground">{x.k}</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-border">
            {note.items.map((i) => {
              const state = i.acked_at ? "확인" : i.seen_at ? "읽음" : "안 읽음";
              return (
                <li key={i.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar person={i.person} size={36} />
                    <p className="min-w-0 flex-1 truncate text-body font-bold text-foreground">
                      {i.person?.name ?? "코치님"}
                      <span className="ml-1 text-label font-bold text-muted-foreground">{i.tailored ? "맞춤" : "기준 그대로"}</span>
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-micro font-black",
                        i.acked_at ? "bg-primary/15 text-primary" : i.seen_at ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {state}
                    </span>
                  </div>
                  {i.reply && <p className="ml-12 mt-2 rounded-2xl bg-secondary px-3 py-2 text-body text-foreground">{i.reply}</p>}
                  {i.body && (
                    <div className="ml-12 mt-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === i.id ? null : i.id)}
                        className="flex items-center gap-1 text-label font-bold text-muted-foreground"
                        aria-expanded={openId === i.id}
                      >
                        보낸 글
                        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", openId === i.id && "rotate-180")} />
                      </button>
                      {openId === i.id && <NoteBodyView body={i.body} className="mt-2" />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {note.core && (
            <details className="mt-3 rounded-2xl bg-secondary/70 px-4 py-3">
              <summary className="cursor-pointer text-label font-bold text-muted-foreground">공통 기준 보기</summary>
              <div className="mt-3">
                <CorePoints core={note.core} />
                {note.core.why && <p className="mt-3 text-body text-foreground">{note.core.why}</p>}
              </div>
            </details>
          )}
        </>
      )}
    </DmSheet>
  );
}

/* ───────────── 코치님 — 한마디 ───────────── */

export function NoteReplySheet({ open, onClose, note }: { open: boolean; onClose: () => void; note: ReceivedNote | null }) {
  const ack = useAckNote();
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText(note?.reply ?? "");
  }, [open, note?.id, note?.reply]);
  const to = note?.from ? `${note.from.name} ${note.from.title}` : "보낸 분";
  const submit = () => {
    if (!note) return;
    ack.mutate(
      { id: note.id, reply: text },
      {
        onSuccess: () => {
          toast.success(`${to}님께 보냈어요`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };
  return (
    <DmSheet
      open={open}
      onClose={onClose}
      title="한마디 남기기"
      subtitle={`${to}님께만 가요`}
      footer={
        <PrimaryButton onClick={submit} disabled={!text.trim() || ack.isPending}>
          {ack.isPending ? "보내는 중…" : "보내기"}
        </PrimaryButton>
      }
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={300}
        placeholder="예: 내일 첫 수업부터 두 그룹으로 나눠 볼게요 / 한 명씩 잡아 주는 게 아직 어려워요 — 시범 한 번 보여 주실 수 있을까요?"
        className={cn(fieldCls, "resize-none")}
      />
      <p className="mt-2 text-right text-micro font-bold text-muted-foreground">{text.length}/300</p>
    </DmSheet>
  );
}
