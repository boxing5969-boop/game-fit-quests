/**
 * 📈 153 기준 — 아래에서 올라오는 창 넷: 수업 관찰 · 4주 시작 · 돌아보기 · 기준 고치기
 *   서버가 권한을 다시 확인한다(coach_* 함수) — 화면은 대표님 · 지점장님께만 단추를 보여 줄 뿐
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import { kstHour, kstToday } from "@/services/strategyService";
import {
  polishObservation,
  useReviewGrowth,
  useSaveObservation,
  useSaveStd,
  useStartGrowth,
} from "@/services/coachGrowthService";
import {
  DECISION_LABEL,
  defaultFixNo,
  GROWTH_WEEKS,
  MARK_LABEL,
  MARKS,
  markedCount,
  toggleMark,
  type CoachStd,
  type GrowthPerson,
  type Marks,
  type PlanDecision,
} from "@/lib/coachGrowth";
import { PrimaryButton, ReviewRow } from "./CoachStdCards";

export const fieldCls =
  "w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-body text-foreground outline-none focus:border-foreground";

export const FieldLabel = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <p className="mb-1.5 mt-4 flex items-baseline justify-between gap-2 text-label font-bold text-foreground first:mt-0">
    <span>{children}</span>
    {hint && <span className="text-micro font-bold text-muted-foreground">{hint}</span>}
  </p>
);

const MarkChip = ({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone: "y" | "s" | "n" }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn(
      "h-10 flex-1 rounded-xl border text-label font-bold active:scale-[0.97]",
      on
        ? tone === "y"
          ? "border-foreground bg-foreground text-background"
          : tone === "s"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-destructive bg-destructive text-destructive-foreground"
        : "border-border bg-background text-foreground",
    )}
  >
    {children}
  </button>
);

/** 다섯 가지 점검표 — 수업 관찰 창 · 수업 기록 창이 같이 쓴다 */
export function StdMarksEditor({ standards, marks, onChange }: { standards: CoachStd[]; marks: Marks; onChange: (m: Marks) => void }) {
  return (
    <div className="space-y-3">
      {standards.map((s) => (
        <div key={s.no}>
          <p className="truncate text-label font-bold text-foreground">
            {s.no}. {s.title}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            {MARKS.map((m) => (
              <MarkChip key={m} tone={m} on={marks[String(s.no)] === m} onClick={() => onChange(toggleMark(marks, s.no, m))}>
                {MARK_LABEL[m]}
              </MarkChip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const defaultHour = () => Math.max(5, Math.min(23, kstHour() - (new Date().getMinutes() < 30 ? 1 : 0)));

/* ───────────── 수업 관찰 ───────────── */

export function ObserveSheet({
  open,
  onClose,
  person,
  standards,
  aiPolish,
  branch = null,
}: {
  open: boolean;
  onClose: () => void;
  person: GrowthPerson | null;
  standards: CoachStd[];
  aiPolish?: boolean;
  branch?: string | null;
}) {
  const save = useSaveObservation();
  const [date, setDate] = useState(kstToday());
  const [hour, setHour] = useState<number | null>(defaultHour());
  const [marks, setMarks] = useState<Marks>({});
  const [good1, setGood1] = useState("");
  const [good2, setGood2] = useState("");
  const [fix1, setFix1] = useState("");
  const [fixNo, setFixNo] = useState<number | null>(null);
  const [fixPicked, setFixPicked] = useState(false);
  const [memo, setMemo] = useState("");
  const [polishing, setPolishing] = useState(false);
  const stdNos = useMemo(() => standards.map((s) => s.no), [standards]);

  useEffect(() => {
    if (!open) return;
    setDate(kstToday());
    setHour(defaultHour());
    setMarks({});
    setGood1("");
    setGood2("");
    setFix1("");
    setFixNo(null);
    setFixPicked(false);
    setMemo("");
  }, [open, person?.person?.user_id]);

  // 바꿀 것의 기준 — 직접 고르기 전까지는 점검표에서 가장 낮은 칸
  useEffect(() => {
    if (!fixPicked) setFixNo(defaultFixNo(marks, stdNos));
  }, [marks, fixPicked, stdNos]);

  const name = person?.person?.name ?? "코치님";
  const valid = !!(good1.trim() && fix1.trim() && person?.person?.user_id);

  const polish = async () => {
    if (!person?.person?.user_id) return;
    if (!memo.trim() && markedCount(marks) === 0) {
      toast.error("메모를 한두 줄 적거나 점검표를 눌러 주세요");
      return;
    }
    setPolishing(true);
    try {
      const r = await polishObservation({ coach: person.person.user_id, memo: memo.trim(), marks, branch });
      setGood1(r.good1);
      setGood2(r.good2);
      setFix1(r.fix1);
      if (r.fix_no) {
        setFixNo(r.fix_no);
        setFixPicked(true);
      }
      toast.success("오삼코치가 다듬었어요 — 읽어 보고 고쳐 써도 돼요");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPolishing(false);
    }
  };

  const submit = () => {
    if (!person?.person?.user_id) return;
    save.mutate(
      { coach: person.person.user_id, classOn: date, classHour: hour, marks, good1, good2, fix1, fixNo },
      {
        onSuccess: () => {
          toast.success(`${name}님께 보냈어요`);
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
      tall
      title={`수업 관찰 · ${name}`}
      subtitle="잘한 것 두 가지 · 바꿀 것 한 가지만"
      footer={
        <PrimaryButton onClick={submit} disabled={!valid || save.isPending}>
          {save.isPending ? "보내는 중…" : "보내기"}
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div>
          <FieldLabel>날짜</FieldLabel>
          <input type="date" value={date} max={kstToday()} onChange={(e) => setDate(e.target.value)} className={cn(fieldCls, "h-12")} />
        </div>
        <div>
          <FieldLabel>시간</FieldLabel>
          <select
            value={hour ?? ""}
            onChange={(e) => setHour(e.target.value === "" ? null : Number(e.target.value))}
            className={cn(fieldCls, "h-12")}
            aria-label="수업 시간"
          >
            <option value="">모름</option>
            {Array.from({ length: 19 }, (_, i) => i + 5).map((h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
        </div>
      </div>

      <FieldLabel hint="누르면 표시 · 다시 누르면 지움">다섯 가지</FieldLabel>
      <StdMarksEditor standards={standards} marks={marks} onChange={setMarks} />

      {aiPolish && (
        <>
          <FieldLabel hint="선택">메모</FieldLabel>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="본 대로 짧게 — 예: 이름 잘 부름 · 처음 온 회원 끝나고 말 안 걸음"
            className={cn(fieldCls, "resize-none")}
          />
          <button
            type="button"
            onClick={polish}
            disabled={polishing}
            className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary/10 text-label font-black text-primary active:scale-[0.99] disabled:opacity-50"
          >
            <Sparkles aria-hidden className="h-4 w-4" />
            {polishing ? "다듬는 중…" : "오삼코치로 다듬기"}
          </button>
        </>
      )}

      <FieldLabel>잘한 것</FieldLabel>
      <input
        value={good1}
        onChange={(e) => setGood1(e.target.value)}
        maxLength={120}
        placeholder="예: 회원마다 이름을 불러 주셨어요"
        className={fieldCls}
      />
      <input
        value={good2}
        onChange={(e) => setGood2(e.target.value)}
        maxLength={120}
        placeholder="하나 더 (선택)"
        className={cn(fieldCls, "mt-2")}
      />

      <FieldLabel>바꿀 것 한 가지</FieldLabel>
      <input
        value={fix1}
        onChange={(e) => setFix1(e.target.value)}
        maxLength={120}
        placeholder={'예: 처음 온 회원께 "다음엔 언제 오세요?" 물어봐 주세요'}
        className={fieldCls}
      />
      <select
        value={fixNo ?? ""}
        onChange={(e) => {
          setFixPicked(true);
          setFixNo(e.target.value === "" ? null : Number(e.target.value));
        }}
        className={cn(fieldCls, "mt-2")}
        aria-label="바꿀 것의 기준"
      >
        <option value="">기준 고르기 (선택)</option>
        {standards.map((s) => (
          <option key={s.no} value={s.no}>
            {s.no}. {s.title}
          </option>
        ))}
      </select>
      <p className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-label leading-snug text-muted-foreground">
        보내면 {name}님 휴대폰에 알림이 가요. 회원 건강 · 부상 같은 내용은 쓰지 말아 주세요.
      </p>
    </DmSheet>
  );
}

/* ───────────── 4주 시작 ───────────── */

export function StartSheet({ open, onClose, person }: { open: boolean; onClose: () => void; person: GrowthPerson | null }) {
  const start = useStartGrowth();
  const [date, setDate] = useState(kstToday());
  useEffect(() => {
    if (open) setDate(kstToday());
  }, [open]);
  const name = person?.person?.name ?? "코치님";
  const submit = () => {
    if (!person?.person?.user_id) return;
    start.mutate(
      { coach: person.person.user_id, startOn: date },
      {
        onSuccess: () => {
          toast.success(`${name}님 4주 과정을 시작했어요`);
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
      title={`4주 시작 · ${name}`}
      subtitle="주마다 주제 하나 · 4주 뒤 함께 돌아봐요"
      footer={
        <PrimaryButton onClick={submit} disabled={start.isPending}>
          {start.isPending ? "시작하는 중…" : "시작하기"}
        </PrimaryButton>
      }
    >
      <FieldLabel>시작일</FieldLabel>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(fieldCls, "h-12")} />
      <ol className="mt-4 space-y-2">
        {GROWTH_WEEKS.map((w) => (
          <li key={w.week} className="flex items-center gap-3 rounded-2xl bg-secondary/70 px-4 py-3">
            <span className="w-10 shrink-0 text-label font-black text-muted-foreground">{w.week}주</span>
            <span className="min-w-0 flex-1 text-body font-bold text-foreground">{w.theme}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-label text-muted-foreground">시작하면 {name}님께 알림이 가요</p>
    </DmSheet>
  );
}

/* ───────────── 돌아보기 ───────────── */

export function ReviewSheet({
  open,
  onClose,
  person,
  standards,
}: {
  open: boolean;
  onClose: () => void;
  person: GrowthPerson | null;
  standards: CoachStd[];
}) {
  const review = useReviewGrowth();
  const [decision, setDecision] = useState<PlanDecision | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    setDecision(null);
    setNote(person?.plan?.decision_note ?? "");
  }, [open, person?.plan?.id, person?.plan?.decision_note]);

  const name = person?.person?.name ?? "코치님";
  const submit = () => {
    if (!person?.plan?.id || !decision) return;
    review.mutate(
      { plan: person.plan.id, decision, note },
      {
        onSuccess: () => {
          toast.success(decision === "extend" ? "2주 더 이어져요" : "돌아보기를 남겼어요");
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
      tall
      title={`돌아보기 · ${name}`}
      subtitle={person ? `1분 점검 ${person.checks_total}번 · 관찰 ${person.obs_total}번` : undefined}
      footer={
        <PrimaryButton onClick={submit} disabled={!decision || review.isPending}>
          {review.isPending ? "저장하는 중…" : "저장"}
        </PrimaryButton>
      }
    >
      {person && (
        <div className="divide-y divide-border rounded-2xl bg-secondary/50 px-4">
          {standards.map((s) => (
            <ReviewRow key={s.no} std={s} person={person} />
          ))}
        </div>
      )}
      <p className="mt-2 text-micro font-bold text-muted-foreground">화살표 = 첫 관찰 → 마지막 관찰</p>

      <FieldLabel>정하기</FieldLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(DECISION_LABEL) as PlanDecision[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDecision(d)}
            aria-pressed={decision === d}
            className={cn(
              "min-h-[3rem] rounded-2xl border px-2 py-2 text-label font-black leading-tight active:scale-[0.97]",
              decision === d ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
            )}
          >
            {DECISION_LABEL[d]}
          </button>
        ))}
      </div>
      <FieldLabel hint="대표님 · 지점장님만 봐요">메모</FieldLabel>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="예: 이름 · 인사는 자리 잡음, 칭찬은 2주 더"
        className={cn(fieldCls, "resize-none")}
      />
      <p className="mt-3 text-label text-muted-foreground">
        {decision === "extend"
          ? `${name}님께 '2주 더' 알림이 가요`
          : decision === "keep"
            ? `${name}님께 '4주 완료' 알림이 가요`
            : decision === "talk"
              ? "알림은 가지 않아요 — 직접 이야기해 주세요"
              : "고르면 무엇이 가는지 알려 드려요"}
      </p>
    </DmSheet>
  );
}

/* ───────────── 기준 고치기 (대표님) ───────────── */

export function StdEditSheet({ open, onClose, std }: { open: boolean; onClose: () => void; std: CoachStd | null }) {
  const save = useSaveStd();
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [how, setHow] = useState("");
  const [say, setSay] = useState("");
  const [check, setCheck] = useState("");
  useEffect(() => {
    if (!open || !std) return;
    setTitle(std.title);
    setWhy(std.why);
    setHow(std.how);
    setSay(std.say);
    setCheck(std.check_q);
  }, [open, std]);
  const submit = () => {
    if (!std) return;
    save.mutate(
      { no: std.no, title, why, how, say, check },
      {
        onSuccess: () => {
          toast.success("기준을 고쳤어요 — 코치님들 화면에도 바로 보여요");
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
      tall
      title={std ? `${std.no}번 기준 고치기` : "기준 고치기"}
      subtitle="모든 지점 코치님께 같은 글이 보여요"
      footer={
        <PrimaryButton onClick={submit} disabled={!title.trim() || save.isPending}>
          {save.isPending ? "저장하는 중…" : "저장"}
        </PrimaryButton>
      }
    >
      <FieldLabel>이름</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} className={fieldCls} />
      <FieldLabel>왜</FieldLabel>
      <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={300} className={cn(fieldCls, "resize-none")} />
      <FieldLabel>이렇게 해요</FieldLabel>
      <textarea value={how} onChange={(e) => setHow(e.target.value)} rows={3} maxLength={400} className={cn(fieldCls, "resize-none")} />
      <FieldLabel hint="한 줄에 한 문장">이렇게 말해요</FieldLabel>
      <textarea value={say} onChange={(e) => setSay(e.target.value)} rows={3} maxLength={400} className={cn(fieldCls, "resize-none")} />
      <FieldLabel>스스로 물어봐요</FieldLabel>
      <input value={check} onChange={(e) => setCheck(e.target.value)} maxLength={200} className={fieldCls} />
    </DmSheet>
  );
}
