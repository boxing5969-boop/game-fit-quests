/**
 * 전략 회의실 쓰기 시트 (2026-10-16)
 *   · PostComposer    — 지시(상황·기준·요청·대상 4칸) · 전략 · 칭찬 · 운영 원칙 — 대표님·지점장님
 *   · ProgramComposer — 오늘 프로그램: 50분 4블록 틀 + 영상 붙이기 + 받을 코치 — 대표님·지점장님
 *   · ClassLogComposer — 수업 기록: 그 시간 입실 인원은 출석 기록에서 자동 — 모든 코치
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import {
  BLOCK_LABEL,
  DEFAULT_BLOCKS,
  fetchHeadcount,
  kstHour,
  kstToday,
  polishDirective,
  programTotal,
  shortDate,
  useSaveStrategy,
  type BlockKind,
  type ProgramBlock,
  type StrategyItem,
  type StrategyKind,
  type StrategyMe,
  type StrategyVideo,
} from "@/services/strategyService";

export const inputCls =
  "w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-label text-foreground outline-none focus:border-primary/60";

export const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <p className="mb-1.5 mt-3 flex items-baseline gap-1.5 text-label font-bold text-muted-foreground first:mt-0">
    {children}
    {hint && <span className="text-micro font-medium">{hint}</span>}
  </p>
);

export const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1.5 text-label font-bold active:scale-95",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
    )}
  >
    {children}
  </button>
);

const SubmitButton = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.99] disabled:opacity-50"
  >
    {children}
  </button>
);

/** 받을 사람 — 비우면 지점 코치 전체 */
const TargetPicker = ({ me, value, onChange }: { me: StrategyMe; value: string[]; onChange: (v: string[]) => void }) => {
  const staff = (me.staff_list ?? []).filter((s) => s.user_id !== me.me);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip on={value.length === 0} onClick={() => onChange([])}>
        코치 전체 {staff.length}명
      </Chip>
      {staff.map((s) => (
        <Chip key={s.user_id} on={value.includes(s.user_id)} onClick={() => toggle(s.user_id)}>
          {s.name}
        </Chip>
      ))}
    </div>
  );
};

/* ───────────────────────── 지시 · 전략 · 칭찬 · 운영 원칙 ───────────────────────── */

type PostKind = Extract<StrategyKind, "directive" | "strategy" | "praise" | "principle">;
const POST_KINDS: Array<{ v: PostKind; label: string; hint: string }> = [
  { v: "directive", label: "📌 지시", hint: "꼭 해 주셔야 하는 것 — 4칸으로 정리해서 보내요" },
  { v: "strategy", label: "🧭 전략", hint: "방향·계획을 나눠요" },
  { v: "praise", label: "👏 칭찬", hint: "잘한 점을 모두가 보게 남겨요" },
  { v: "principle", label: "📏 운영 원칙", hint: "되풀이되는 지시는 원칙으로 — 번호가 붙고 맨 위에 고정돼요" },
];

export const PostComposer = ({
  open,
  onClose,
  me,
  branch,
}: {
  open: boolean;
  onClose: () => void;
  me: StrategyMe;
  branch: string | null;
}) => {
  const save = useSaveStrategy();
  const [kind, setKind] = useState<PostKind>("directive");
  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [standard, setStandard] = useState("");
  const [request, setRequest] = useState("");
  const [target, setTarget] = useState("");
  const [body, setBody] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [raw, setRaw] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [showPolish, setShowPolish] = useState(false);

  useEffect(() => {
    if (!open) {
      setKind("directive");
      setTitle("");
      setSituation("");
      setStandard("");
      setRequest("");
      setTarget("");
      setBody("");
      setTargets([]);
      setRaw("");
      setShowPolish(false);
    }
  }, [open]);

  const valid =
    kind === "directive" ? !!title.trim() && !!request.trim() : !!title.trim() || !!body.trim();

  const polish = async () => {
    if (!raw.trim()) return;
    setPolishing(true);
    try {
      const r = await polishDirective(raw.trim());
      setTitle(r.title || title);
      setSituation(r.situation || "");
      setStandard(r.standard || "");
      setRequest(r.request || "");
      if (r.target) setTarget(r.target);
      setShowPolish(false);
      toast.success("오삼코치가 4칸으로 정리했어요 — 확인하고 보내 주세요");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPolishing(false);
    }
  };

  const submit = () =>
    save.mutate(
      {
        branch,
        kind,
        title: title.trim(),
        body: kind === "directive" ? "" : body.trim(),
        data: kind === "directive" ? { situation: situation.trim(), standard: standard.trim(), request: request.trim(), target: target.trim() } : {},
        targets: kind === "principle" ? null : targets,
      },
      {
        onSuccess: () => {
          toast.success(kind === "principle" ? "운영 원칙을 고정했어요" : "코치님들께 보냈어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="지시 · 전략 쓰기"
      subtitle={POST_KINDS.find((k) => k.v === kind)?.hint}
      footer={
        <SubmitButton onClick={submit} disabled={!valid || save.isPending}>
          {save.isPending ? "보내는 중…" : kind === "principle" ? "원칙으로 고정하기" : "코치님들께 보내기"}
        </SubmitButton>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {POST_KINDS.map((k) => (
          <Chip key={k.v} on={kind === k.v} onClick={() => setKind(k.v)}>
            {k.label}
          </Chip>
        ))}
      </div>

      {kind === "directive" && (
        <>
          <div className="mt-3 rounded-2xl bg-amber-500/10 p-3">
            <button
              type="button"
              onClick={() => setShowPolish((v) => !v)}
              className="flex w-full items-center gap-1.5 text-left text-label font-black text-amber-800 dark:text-amber-300"
            >
              <Sparkles className="h-4 w-4" /> 화가 난 채로 써도 돼요 — 오삼코치가 차분하게 정리해 드려요
            </button>
            {showPolish && (
              <>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={4}
                  maxLength={1500}
                  placeholder="하고 싶은 말을 그대로 써 주세요. 보내기 전까지 코치님들께는 아무것도 가지 않아요."
                  className={cn(inputCls, "mt-2 resize-none")}
                />
                <button
                  type="button"
                  onClick={polish}
                  disabled={!raw.trim() || polishing}
                  className="mt-2 h-10 w-full rounded-xl bg-amber-500 text-label font-black text-white active:scale-[0.99] disabled:opacity-50"
                >
                  {polishing ? "정리하는 중…" : "4칸으로 정리하기"}
                </button>
                <p className="mt-1.5 text-micro text-amber-800/80 dark:text-amber-300/80">쓴 원문은 저장하지 않아요.</p>
              </>
            )}
          </div>
          <Label>한 줄 요약</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="예: 그룹 수업 중에는 모든 회원을 순회해 주세요" className={inputCls} />
          <Label hint="무슨 일이 있었나">① 상황</Label>
          <textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={2} maxLength={600} placeholder="예: 어제 19시 수업, 회원 6명 중 1명에게만 오래 머물렀어요" className={cn(inputCls, "resize-none")} />
          <Label hint="우리가 지키는 원칙">② 기준</Label>
          <textarea value={standard} onChange={(e) => setStandard(e.target.value)} rows={2} maxLength={600} placeholder="예: 그룹 수업 중에는 모든 회원을 고르게 봐 줘요" className={cn(inputCls, "resize-none")} />
          <Label hint="앞으로 할 일">③ 요청</Label>
          <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={2} maxLength={600} placeholder="예: 오래 봐야 하는 회원은 수업 뒤 PT 로 안내해 주세요" className={cn(inputCls, "resize-none")} />
          <Label hint="누구에게 · 언제부터">④ 대상·기한</Label>
          <input value={target} onChange={(e) => setTarget(e.target.value)} maxLength={120} placeholder="예: 전 코치 · 오늘 저녁 수업부터" className={inputCls} />
        </>
      )}

      {kind !== "directive" && (
        <>
          <Label>{kind === "principle" ? "원칙 (한 문장)" : "제목"}</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={
              kind === "principle"
                ? "예: 그룹 수업 중에는 모든 회원을 순회한다"
                : kind === "praise"
                  ? "예: 강건형 코치님, 오늘 미트 정말 좋았어요"
                  : "예: 11월은 신규 회원 첫 3회 수업에 집중"
            }
            className={inputCls}
          />
          <Label>{kind === "principle" ? "설명 (선택)" : "내용"}</Label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={3000} className={cn(inputCls, "resize-none")} />
        </>
      )}

      {kind !== "principle" && (
        <>
          <Label>받는 코치</Label>
          <TargetPicker me={me} value={targets} onChange={setTargets} />
        </>
      )}
    </DmSheet>
  );
};

/* ───────────────────────── 오늘 프로그램 ───────────────────────── */

const BLOCK_KINDS = Object.keys(BLOCK_LABEL) as BlockKind[];
const SLOTS = ["07:00", "12:00", "19:00", "20:00", "21:00"];

export const ProgramComposer = ({
  open,
  onClose,
  me,
  branch,
  videos,
  templates,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  me: StrategyMe;
  branch: string | null;
  videos: StrategyVideo[];
  templates: StrategyItem[];
  initial?: StrategyItem | null;
}) => {
  const save = useSaveStrategy();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(kstToday());
  const [slot, setSlot] = useState("");
  const [blocks, setBlocks] = useState<ProgramBlock[]>(DEFAULT_BLOCKS);
  const [note, setNote] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [template, setTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDate(kstToday());
      setSlot(initial?.data?.slot ?? "");
      setBlocks(initial?.data?.blocks?.length ? initial.data.blocks.map((b) => ({ ...b })) : DEFAULT_BLOCKS.map((b) => ({ ...b })));
      setNote(initial?.body ?? "");
      setTargets([]);
      setTemplate(false);
    }
  }, [open, initial]);

  const total = programTotal(blocks);
  const set = (i: number, patch: Partial<ProgramBlock>) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const valid = blocks.length > 0 && blocks.every((b) => (b.title.trim() || b.video_id) && Number(b.minutes) > 0);

  const submit = () =>
    save.mutate(
      {
        branch,
        kind: "program",
        title: title.trim() || `${shortDate(date)} 오늘 프로그램`,
        body: note.trim(),
        eventDate: date,
        targets,
        data: {
          slot: slot.trim() || null,
          blocks: blocks.map((b) => ({
            kind: b.kind,
            title: b.title.trim() || videos.find((v) => v.id === b.video_id)?.title || "",
            minutes: Math.max(1, Math.min(120, Math.round(Number(b.minutes) || 1))),
            video_id: b.video_id || null,
            note: (b.note ?? "").trim(),
          })),
          total_min: total,
          template,
        },
      },
      {
        onSuccess: () => {
          toast.success("오늘 프로그램을 보냈어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="오늘 프로그램 만들기"
      subtitle="영상을 골라 블록을 쌓으면 코치님들이 보고 그대로 수업해요"
      footer={
        <SubmitButton onClick={submit} disabled={!valid || save.isPending}>
          {save.isPending ? "보내는 중…" : `코치님께 보내기 · ${total}분`}
        </SubmitButton>
      }
    >
      {templates.length > 0 && (
        <>
          <Label>자주 쓰는 프로그램 불러오기</Label>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {templates.slice(0, 12).map((t) => (
              <Chip
                key={t.id}
                on={false}
                onClick={() => {
                  setTitle(t.title);
                  setSlot(t.data?.slot ?? "");
                  setBlocks((t.data?.blocks ?? DEFAULT_BLOCKS).map((b) => ({ ...b })));
                  setNote(t.body ?? "");
                }}
              >
                {t.title}
              </Chip>
            ))}
          </div>
        </>
      )}
      <Label>프로그램 이름</Label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="예: 원·투 스텝 + 미트 3R" className={inputCls} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label>날짜</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <Label hint="비우면 하루 종일">수업 시간</Label>
          <input value={slot} onChange={(e) => setSlot(e.target.value)} maxLength={20} placeholder="예: 19:00" className={inputCls} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SLOTS.map((s) => (
          <Chip key={s} on={slot === s} onClick={() => setSlot(slot === s ? "" : s)}>
            {s}
          </Chip>
        ))}
      </div>

      <Label hint={`합계 ${total}분`}>블록</Label>
      <ol className="space-y-2">
        {blocks.map((b, i) => (
          <li key={i} className="rounded-2xl border border-border bg-secondary/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-5 text-center text-label font-black text-muted-foreground">{i + 1}</span>
              <select
                value={b.kind}
                onChange={(e) => set(i, { kind: e.target.value as BlockKind })}
                className="h-9 rounded-xl border border-border bg-background px-2 text-label font-bold"
                aria-label="블록 종류"
              >
                {BLOCK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {BLOCK_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={b.minutes}
                onChange={(e) => set(i, { minutes: Number(e.target.value) })}
                className="h-9 w-16 rounded-xl border border-border bg-background px-2 text-right text-label font-bold tabular-nums"
                aria-label="분"
              />
              <span className="text-label font-bold text-muted-foreground">분</span>
              <span className="flex-1" />
              <button type="button" onClick={() => move(i, -1)} aria-label="위로" className="flex h-8 w-8 items-center justify-center rounded-full active:bg-secondary">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} aria-label="아래로" className="flex h-8 w-8 items-center justify-center rounded-full active:bg-secondary">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}
                aria-label="블록 빼기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={b.title}
              onChange={(e) => set(i, { title: e.target.value })}
              maxLength={80}
              placeholder="무엇을 하나요 (예: 원·투 스텝 드릴)"
              className={cn(inputCls, "mt-2 py-2")}
            />
            <select
              value={b.video_id ?? ""}
              onChange={(e) => set(i, { video_id: e.target.value || null })}
              className={cn(inputCls, "mt-2 py-2")}
              aria-label="영상 붙이기"
            >
              <option value="">🎬 영상 붙이기 (선택)</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                  {v.minutes ? ` · ${v.minutes}분` : ""}
                </option>
              ))}
            </select>
            <input
              value={b.note ?? ""}
              onChange={(e) => set(i, { note: e.target.value })}
              maxLength={200}
              placeholder="코칭 포인트 (선택)"
              className={cn(inputCls, "mt-2 py-2")}
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setBlocks((bs) => [...bs, { kind: "skill", title: "", minutes: 8 }])}
        className="mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-label font-bold text-muted-foreground active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" /> 블록 더하기
      </button>
      {videos.length === 0 && (
        <p className="mt-2 text-label text-muted-foreground">'영상' 탭에서 드릴 영상을 올리면 블록에 붙일 수 있어요.</p>
      )}

      <Label>코치님께 한마디 (선택)</Label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="예: 신규 회원이 많은 시간이라 스텝을 천천히" className={cn(inputCls, "resize-none")} />
      <Label>받는 코치</Label>
      <TargetPicker me={me} value={targets} onChange={setTargets} />
      <label className="mt-3 flex items-center gap-2 text-label font-bold text-foreground">
        <input type="checkbox" checked={template} onChange={(e) => setTemplate(e.target.checked)} className="h-4 w-4" />
        자주 쓰는 프로그램으로 저장 (다음에 불러오기)
      </label>
    </DmSheet>
  );
};

/* ───────────────────────── 수업 기록 ───────────────────────── */

export const ClassLogComposer = ({
  open,
  onClose,
  branch,
  programs,
  initialProgram,
}: {
  open: boolean;
  onClose: () => void;
  branch: string | null;
  programs: StrategyItem[];
  initialProgram?: StrategyItem | null;
}) => {
  const save = useSaveStrategy();
  const [date, setDate] = useState(kstToday());
  const [hour, setHour] = useState<number>(kstHour());
  const [attendees, setAttendees] = useState<string>("");
  const [staffIn, setStaffIn] = useState<string[]>([]);
  const [programId, setProgramId] = useState<string>("");
  const [programTitle, setProgramTitle] = useState("");
  const [wentWell, setWentWell] = useState("");
  const [issues, setIssues] = useState("");
  const [nextFocus, setNextFocus] = useState("");

  useEffect(() => {
    if (open) {
      setDate(kstToday());
      setHour(Math.max(5, Math.min(23, kstHour() - (new Date().getMinutes() < 30 ? 1 : 0))));
      setProgramId(initialProgram?.id ?? "");
      setProgramTitle(initialProgram?.title ?? "");
      setWentWell("");
      setIssues("");
      setNextFocus("");
    }
  }, [open, initialProgram]);

  // 그 시간 입실 인원 — 출석 기록에서 자동 (고쳐 쓸 수 있다)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchHeadcount(branch, date, hour)
      .then((r) => {
        if (!alive) return;
        setAttendees(String(r?.attendees ?? ""));
        setStaffIn(r?.staff_checked_in ?? []);
      })
      .catch(() => alive && setStaffIn([]));
    return () => {
      alive = false;
    };
  }, [open, branch, date, hour]);

  const nearPrograms = useMemo(() => programs.slice(0, 20), [programs]);
  const valid = !!(wentWell.trim() || issues.trim() || nextFocus.trim() || programTitle.trim());

  const submit = () =>
    save.mutate(
      {
        branch,
        kind: "class_log",
        title: `${shortDate(date)} ${hour}시 수업`,
        eventDate: date,
        data: {
          hour,
          attendees: attendees.trim() === "" ? null : Math.max(0, Math.round(Number(attendees) || 0)),
          program_id: programId || null,
          program_title: programTitle.trim() || null,
          went_well: wentWell.trim(),
          issues: issues.trim(),
          next_focus: nextFocus.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success("수업 기록을 남겼어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="수업 기록"
      subtitle="1분이면 돼요 — 인원은 출석 기록에서 자동으로 채워요"
      footer={
        <SubmitButton onClick={submit} disabled={!valid || save.isPending}>
          {save.isPending ? "저장하는 중…" : "기록 남기기"}
        </SubmitButton>
      }
    >
      <div className="grid grid-cols-[1fr_6rem_6rem] gap-2">
        <div>
          <Label>날짜</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <Label>시간</Label>
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={inputCls} aria-label="수업 시간">
            {Array.from({ length: 19 }, (_, i) => i + 5).map((h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>입실 인원</Label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            className={cn(inputCls, "text-right tabular-nums")}
          />
        </div>
      </div>
      {staffIn.length > 0 && (
        <p className="mt-1.5 text-label text-muted-foreground">이날 그 시간까지 출근한 코치: {staffIn.join(" · ")}</p>
      )}

      <Label>진행한 프로그램</Label>
      <select
        value={programId}
        onChange={(e) => {
          const id = e.target.value;
          setProgramId(id);
          setProgramTitle(nearPrograms.find((p) => p.id === id)?.title ?? programTitle);
        }}
        className={inputCls}
        aria-label="프로그램 고르기"
      >
        <option value="">직접 쓰기</option>
        {nearPrograms.map((p) => (
          <option key={p.id} value={p.id}>
            {shortDate(p.event_date)} {p.title}
          </option>
        ))}
      </select>
      {!programId && (
        <input
          value={programTitle}
          onChange={(e) => setProgramTitle(e.target.value)}
          maxLength={120}
          placeholder="예: 원·투 스텝 드릴 + 미트 3R"
          className={cn(inputCls, "mt-2")}
        />
      )}
      <Label>잘된 점</Label>
      <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} rows={2} maxLength={600} placeholder="예: 미트 타이밍이 좋았어요" className={cn(inputCls, "resize-none")} />
      <Label>어려웠던 점 · 특이사항</Label>
      <textarea value={issues} onChange={(e) => setIssues(e.target.value)} rows={2} maxLength={600} placeholder="예: 처음 온 회원 2명, 스텝을 어려워함" className={cn(inputCls, "resize-none")} />
      <Label>다음 수업에 이어갈 것</Label>
      <textarea value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} rows={2} maxLength={600} placeholder="예: 가드 자세 복습" className={cn(inputCls, "resize-none")} />
      <p className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-micro leading-snug text-muted-foreground">
        회원의 건강·부상 같은 민감한 내용은 쓰지 말아 주세요. 코치진 모두가 보는 기록이에요.
      </p>
    </DmSheet>
  );
};
