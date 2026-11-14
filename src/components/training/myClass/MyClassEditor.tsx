/**
 * 🎬 내 수업 편집 — 이름 · 카드 순서(↑↓) · 분/라운드 · 한 줄 메모 · 코치님께 보여드리기 · 코치 한마디 · 지우기 (2026-11-14 2단계)
 *
 *   · 고치는 즉시 화면, 0.7초 모아 저장(창을 닫을 때도 남은 것을 저장) — 위에 「저장됨 · 저장 중」
 *   · 카드를 누르면 카드 시트(포인트 · 실수 · 영상) · 「카드 더 담기」는 이 창 위에 고르기
 *   · 아래 「▶ 시작」 = 재생 화면(편집 중인 순서 그대로) · 코치님은 「이 수업으로 수업안 만들기」(전략 회의 「내 수업 짜기」)
 *   · 코치님께 보여드리기는 회원님만(코치진 수업은 나만 보기 — 서버도 끈다)
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Minus, Play, Plus, X } from "lucide-react";
import { DmSheet } from "@/components/dm/DmParts";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";
import { cn } from "@/lib/utils";
import { cardMinutes, type TrainingCard } from "@/lib/trainingCards";
import type { ArrangedShelf, ShelfLeaf } from "@/lib/shelfLayout";
import {
  MAX_ITEMS,
  MISSION_MINUTES,
  NAME_MAX,
  NOTE_MAX,
  addItem,
  classSummary,
  cleanName,
  itemAmountText,
  moveItem,
  playedText,
  removeItemAt,
  setItemN,
  setItemNote,
  toggleUnit,
  validateItems,
  type ClassItem,
  type MyClass,
} from "@/lib/myClass";
import { BigButton, ItemThumb, NoteList, Switch } from "./MyClassParts";
import MyClassCardPicker from "./MyClassCardPicker";
import { primeAudio, type MyClassFlow, type PosterOf } from "./useMyClassFlow";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const Step = ({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    disabled={disabled}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-all active:scale-90 disabled:opacity-40"
  >
    {children}
  </button>
);

const EditorBody = ({
  cls,
  flow,
  posterOf,
  sections,
  startWithPicker,
  onToPlan,
  onClose,
}: {
  cls: MyClass;
  flow: MyClassFlow;
  posterOf: PosterOf;
  sections: readonly ArrangedShelf[];
  startWithPicker: boolean;
  onToPlan?: (c: { name: string; items: ClassItem[] }) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState(cls.name);
  const [items, setItems] = useState<ClassItem[]>(cls.items);
  const [shared, setShared] = useState(cls.shared);
  const [shareBusy, setShareBusy] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [pickerOpen, setPickerOpen] = useState(startWithPicker);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [sheetCard, setSheetCard] = useState<TrainingCard | null>(null);
  const pending = useRef<{ name: string; items: ClassItem[] } | null>(null);
  const timer = useRef<number | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ name, items });
  latest.current = { name, items };

  // 저장 — 함수는 그리기마다 새로 만들되 ref 로 들고 부른다(디바운스 · 닫을 때 저장이 그리기마다 끊기지 않게)
  const flushRef = useRef<() => Promise<unknown>>(() => Promise.resolve());
  flushRef.current = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const snap = pending.current;
    if (!snap) return chain.current;
    pending.current = null;
    setStatus("saving");
    const save = flow.actions.save;
    chain.current = chain.current
      .then(() => {
        const bad = validateItems(snap.items);
        if (bad) throw new Error(bad);
        return save({ id: cls.id, name: cleanName(snap.name) || cls.name, items: snap.items, shared: null });
      })
      .then(() => setStatus(pending.current ? "saving" : "saved"))
      .catch((e) => {
        setStatus("error");
        toast.error((e as Error).message);
      });
    return chain.current;
  };
  const flush = () => flushRef.current();

  const schedule = (next: { name?: string; items?: ClassItem[] }) => {
    const n = next.name ?? latest.current.name;
    const it = next.items ?? latest.current.items;
    if (next.name !== undefined) setName(n);
    if (next.items !== undefined) setItems(it);
    pending.current = { name: n, items: it };
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushRef.current(), 700);
  };

  // 창이 닫힐 때 남은 것을 저장 (한 번만 — 닫힐 때)
  useEffect(() => () => void flushRef.current(), []);

  // 새 한마디는 열면 읽음
  useEffect(() => {
    if (cls.newNotes > 0) void flow.actions.seen(cls.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 보여드리기 — 고치던 이름 · 카드도 같이 바로 저장
  const toggleShare = async (on: boolean) => {
    if (shareBusy) return;
    setShared(on);
    setShareBusy(true);
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    pending.current = null;
    setStatus("saving");
    try {
      await chain.current;
      const r = await flow.actions.save({ id: cls.id, name: cleanName(latest.current.name) || cls.name, items: latest.current.items, shared: on });
      setShared(r.shared);
      setStatus("saved");
      toast.success(on ? "코치님께 보여드렸어요" : "나만 보기로 바꿨어요", {
        description: on ? "우리 지점 코치님이 보고 한마디를 남길 수 있어요" : undefined,
      });
    } catch (e) {
      setShared(!on);
      setStatus("error");
      toast.error((e as Error).message);
    } finally {
      setShareBusy(false);
    }
  };

  const addLeaf = (leaf: ShelfLeaf) => {
    const minutes = leaf.kind === "card" ? cardMinutes(leaf.card) : MISSION_MINUTES;
    const r = addItem(latest.current.items, leaf.key, minutes);
    if (r.full) toast.error(`한 수업에 ${MAX_ITEMS}장까지 담을 수 있어요`);
    if (r.added) schedule({ items: r.items });
  };

  const start = async () => {
    primeAudio();
    await flush();
    const playable = latest.current.items.filter((x) => !!flow.resolve(x.k));
    if (playable.length === 0) {
      toast.error("재생할 카드가 없어요");
      return;
    }
    flow.openPlayer({ id: cls.id, name: cleanName(latest.current.name) || cls.name, items: latest.current.items, mine: true });
  };

  const remove = async () => {
    try {
      if (timer.current) window.clearTimeout(timer.current);
      pending.current = null;
      await flow.actions.remove(cls.id);
      toast.success("수업을 지웠어요");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const avail = (k: string) => !!flow.resolve(k);
  const played = playedText(cls.plays);
  const canPlay = items.some((x) => avail(x.k));

  return (
    <>
      <DmSheet
        open
        onClose={onClose}
        tall
        title="내 수업"
        subtitle={`${items.length ? classSummary(items, avail) : "카드를 담아 주세요"}${played ? ` · ${played}` : ""}`}
        footer={
          <div className="space-y-2">
            <BigButton onClick={() => void start()} disabled={!canPlay}>
              <Play className="h-4 w-4 fill-current" aria-hidden /> 시작
            </BigButton>
            {flow.staff && onToPlan && (
              <BigButton
                tone="light"
                disabled={!canPlay}
                onClick={() => {
                  void flush();
                  onToPlan({ name: cleanName(latest.current.name) || cls.name, items: latest.current.items });
                }}
              >
                이 수업으로 수업안 만들기
              </BigButton>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => schedule({ name: e.target.value.slice(0, NAME_MAX) })}
            onBlur={() => void flush()}
            placeholder="수업 이름 (예: 퇴근 20분 기본기)"
            aria-label="수업 이름"
            maxLength={NAME_MAX}
            className="min-w-0 flex-1 border-b border-border bg-transparent py-2 text-heading font-black text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
          <span className={cn("shrink-0 text-label", status === "error" ? "font-bold text-destructive" : "text-muted-foreground")} aria-live="polite">
            {status === "saving" ? "저장 중…" : status === "saved" ? "저장됨" : status === "error" ? "저장 안 됨" : ""}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-6 text-center text-body text-muted-foreground">아직 카드가 없어요 — 아래 「카드 더 담기」로 골라요</p>
        ) : (
          <ol className="mt-4 space-y-2.5">
            {items.map((x, i) => {
              const r = flow.resolve(x.k);
              return (
                <li key={`${x.k}-${i}`} className={cn("rounded-2xl border border-border bg-background p-3", !r && "opacity-60")}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!r || r.kind !== "card"}
                      onClick={() => r?.kind === "card" && setSheetCard(r.card)}
                      aria-label={r ? `${r.name} 카드 보기` : "찾지 못한 카드"}
                      className="shrink-0"
                    >
                      <ItemThumb item={r} posterOf={posterOf} className="h-14 w-14" />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-foreground">
                        {i + 1}. {r?.name ?? "찾지 못한 카드"}
                      </span>
                      <span className="block truncate text-label text-muted-foreground">{r ? `${r.label} · ${itemAmountText(x)}` : "지금은 볼 수 없어요"}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => schedule({ items: removeItemAt(latest.current.items, i) })}
                      aria-label={`${r?.name ?? "카드"} 빼기`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-90"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {r && (
                    <>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <Step onClick={() => schedule({ items: setItemN(latest.current.items, i, x.n - 1) })} label="줄이기" disabled={x.n <= 1}>
                          <Minus className="h-4 w-4" />
                        </Step>
                        <span className="min-w-[4.5rem] text-center text-body font-bold text-foreground">{itemAmountText(x)}</span>
                        <Step onClick={() => schedule({ items: setItemN(latest.current.items, i, x.n + 1) })} label="늘리기" disabled={x.u === "r" ? x.n >= 12 : x.n >= 30}>
                          <Plus className="h-4 w-4" />
                        </Step>
                        <button
                          type="button"
                          onClick={() => schedule({ items: toggleUnit(latest.current.items, i) })}
                          className="ml-1 shrink-0 rounded-full border border-border px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
                        >
                          {x.u === "r" ? "분으로" : "라운드로"}
                        </button>
                        <span className="ml-auto flex gap-1">
                          <Step onClick={() => schedule({ items: moveItem(latest.current.items, i, -1) })} label="위로" disabled={i === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Step>
                          <Step onClick={() => schedule({ items: moveItem(latest.current.items, i, 1) })} label="아래로" disabled={i === items.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Step>
                        </span>
                      </div>
                      <input
                        value={x.note}
                        onChange={(e) => schedule({ items: setItemNote(latest.current.items, i, e.target.value) })}
                        onBlur={() => void flush()}
                        maxLength={NOTE_MAX}
                        placeholder="한 줄 메모 (예: 천천히 정확하게)"
                        aria-label={`${r.name} 메모`}
                        className="mt-2 h-10 w-full rounded-xl bg-secondary px-3 text-label text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={items.length >= MAX_ITEMS}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-body font-bold text-foreground active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> {items.length >= MAX_ITEMS ? `${MAX_ITEMS}장이 다 찼어요` : "카드 더 담기"}
        </button>

        {!flow.staff && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-foreground">코치님께 보여드리기</span>
              <span className="block text-label text-muted-foreground">켜면 우리 지점 코치님이 보고 한마디를 남겨요</span>
            </span>
            <Switch on={shared} onChange={(v) => void toggleShare(v)} label="코치님께 보여드리기" disabled={shareBusy} />
          </div>
        )}

        {cls.notes.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-body font-black text-foreground">💬 코치님 한마디</p>
            <NoteList notes={cls.notes} />
          </div>
        )}

        <div className="mt-6 pb-2">
          {confirmRemove ? (
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-body font-bold text-foreground">이 수업을 지울까요?</p>
              <p className="mt-0.5 text-label text-muted-foreground">{cls.notes.length ? "코치님 한마디도 함께 지워져요" : "지우면 되돌릴 수 없어요"}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirmRemove(false)} className="h-11 flex-1 rounded-xl border border-border bg-card text-body font-bold text-foreground">
                  그만
                </button>
                <button type="button" onClick={() => void remove()} className="h-11 flex-1 rounded-xl bg-destructive text-body font-bold text-destructive-foreground">
                  지우기
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="text-label font-bold text-muted-foreground underline underline-offset-2">
              이 수업 지우기
            </button>
          )}
        </div>
      </DmSheet>

      <MyClassCardPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        flow={flow}
        sections={sections}
        picked={new Set(items.map((x) => x.k))}
        count={items.length}
        posterOf={posterOf}
        onPick={addLeaf}
      />
      <TrainingDrillSheet exercise={sheetCard} onClose={() => setSheetCard(null)} zClass="z-[118]" />
    </>
  );
};

/** 편집 창 — 수업마다 새로 그린다(다른 수업을 열면 고치던 글이 섞이지 않게) */
const MyClassEditor = (props: {
  flow: MyClassFlow;
  posterOf: PosterOf;
  sections: readonly ArrangedShelf[];
  onToPlan?: (c: { name: string; items: ClassItem[] }) => void;
}) => {
  const cls = props.flow.editor;
  if (!cls || typeof document === "undefined") return null;
  return createPortal(
    <EditorBody
      key={cls.id}
      cls={cls}
      flow={props.flow}
      posterOf={props.posterOf}
      sections={props.sections}
      startWithPicker={props.flow.editorStartsWithPicker}
      onToPlan={props.onToPlan}
      onClose={props.flow.closeEditor}
    />,
    document.body,
  );
};

export default MyClassEditor;
