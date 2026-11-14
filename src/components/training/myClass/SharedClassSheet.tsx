/**
 * 🎬 회원님이 보여 준 수업 — 코치진 보기 · 한마디 (2026-11-14 2단계)
 *   카드 순서 · 분 · 메모(읽기만) · ▶ 같이 해 보기 · 한마디 남기기(300자 → 회원님께 알림) · 내가 남긴 한마디 지우기
 *   재생 횟수는 회원님 본인에게만 — 여기엔 없다
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { DmSheet } from "@/components/dm/DmParts";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";
import type { TrainingCard } from "@/lib/trainingCards";
import { COACH_NOTE_MAX, classSummary, itemAmountText, type SharedClass } from "@/lib/myClass";
import { useClassNoteActions } from "@/services/myClassService";
import { BigButton, ItemThumb, NoteList } from "./MyClassParts";
import { primeAudio, type MyClassFlow, type PosterOf } from "./useMyClassFlow";

const Body = ({ cls, flow, posterOf }: { cls: SharedClass; flow: MyClassFlow; posterOf: PosterOf }) => {
  const notes = useClassNoteActions();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sheetCard, setSheetCard] = useState<TrainingCard | null>(null);
  const avail = (k: string) => !!flow.resolve(k);
  const canPlay = cls.items.some((x) => avail(x.k));

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await notes.add(cls.id, body);
      setText("");
      toast.success(`${cls.owner.name}님께 한마디가 갔어요`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await notes.remove(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <DmSheet
        open
        onClose={flow.closeShared}
        tall
        title={`${cls.owner.name}님의 수업`}
        subtitle={`${cls.name} · ${classSummary(cls.items, avail)}`}
        footer={
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, COACH_NOTE_MAX))}
              rows={2}
              maxLength={COACH_NOTE_MAX}
              placeholder="한마디 남기기 (예: 잽은 끝까지 뻗고 바로 가드!)"
              aria-label="코치 한마디"
              className="w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2.5 text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
            />
            <BigButton onClick={() => void send()} disabled={!text.trim() || sending}>
              {sending ? "보내는 중…" : "한마디 남기기"}
            </BigButton>
          </div>
        }
      >
        <ol className="space-y-2">
          {cls.items.map((x, i) => {
            const r = flow.resolve(x.k);
            return (
              <li key={`${x.k}-${i}`} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2.5">
                <button type="button" disabled={r?.kind !== "card"} onClick={() => r?.kind === "card" && setSheetCard(r.card)} aria-label={r ? `${r.name} 카드 보기` : "찾지 못한 카드"}>
                  <ItemThumb item={r} posterOf={posterOf} className="h-12 w-12" />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-foreground">
                    {i + 1}. {r?.name ?? "찾지 못한 카드"}
                  </span>
                  <span className="block truncate text-label text-muted-foreground">
                    {itemAmountText(x)}
                    {x.note ? ` · ${x.note}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        {canPlay && (
          <BigButton
            tone="light"
            className="mt-3"
            onClick={() => {
              primeAudio();
              flow.openPlayer({ id: cls.id, name: cls.name, items: cls.items, mine: false });
            }}
          >
            <Play className="h-4 w-4 fill-current" aria-hidden /> 같이 해 보기
          </BigButton>
        )}
        <div className="mt-5">
          <p className="mb-2 text-body font-black text-foreground">💬 한마디 {cls.notes.length > 0 ? cls.notes.length : ""}</p>
          {cls.notes.length > 0 ? (
            <NoteList notes={cls.notes} onRemove={(id) => void remove(id)} removing={removing} />
          ) : (
            <p className="rounded-2xl bg-secondary px-4 py-4 text-label text-muted-foreground">첫 한마디를 남겨 주세요 — 회원님께 바로 알림이 가요</p>
          )}
        </div>
      </DmSheet>
      <TrainingDrillSheet exercise={sheetCard} onClose={() => setSheetCard(null)} zClass="z-[118]" />
    </>
  );
};

const SharedClassSheet = ({ flow, posterOf }: { flow: MyClassFlow; posterOf: PosterOf }) => {
  const cls = flow.sharedOpen;
  if (!cls || typeof document === "undefined") return null;
  return createPortal(<Body key={cls.id} cls={cls} flow={flow} posterOf={posterOf} />, document.body);
};

export default SharedClassSheet;
