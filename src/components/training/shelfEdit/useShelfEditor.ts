/**
 * ✏️ 영상으로 배우기 정리 편집 상태 — 아이폰처럼 고치는 즉시 화면에, 잠깐 멈추면 서버에 저장 (2026-11-14)
 *
 *   · start: 지금 정리표로 편집 시작 · apply(새 정리표, 무엇을 했나): 화면에 바로 + 0.8초 모아 저장(한 번 저장 = 정리 기록 한 줄)
 *   · undo: 이번 편집에서 한 단계 되돌리기(최대 30) · finish: 남은 저장을 마치고 편집 끝
 *   · 두 분이 같이 고쳐 서버 판 번호가 다르면(conflict) — 「먼저 고친 정리가 있어요 — 새로 불러올게요」 → 서버 정리로 다시 시작
 *   · 화면을 떠나거나 앱을 내리면 남은 저장을 바로 보낸다
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EMPTY_LAYOUT, type ShelfLayout } from "@/lib/shelfLayout";
import {
  SHELF_LAYOUT_KEY,
  restoreShelfLayout,
  saveShelfLayout,
  shelfLayoutQueryKey,
  type ShelfLayoutState,
} from "@/services/shelfLayoutService";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 800;
const UNDO_MAX = 30;

export function useShelfEditor(state: ShelfLayoutState | undefined) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraftState] = useState<ShelfLayout | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [undoCount, setUndoCount] = useState(0);
  const draftRef = useRef<ShelfLayout | null>(null);
  const undoRef = useRef<ShelfLayout[]>([]);
  const baseRef = useRef(0);
  const notesRef = useRef<string[]>([]);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const setDraft = (l: ShelfLayout | null) => {
    draftRef.current = l;
    setDraftState(l);
  };

  /** 서버 정리로 다시 시작 (판 번호 다름 · 되돌림 뒤) */
  const reload = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: SHELF_LAYOUT_KEY });
    const st = qc.getQueryData<ShelfLayoutState>(shelfLayoutQueryKey());
    baseRef.current = st?.version ?? 0;
    undoRef.current = [];
    setUndoCount(0);
    notesRef.current = [];
    dirtyRef.current = false;
    if (draftRef.current) setDraft(st?.layout ?? EMPTY_LAYOUT);
  }, [qc]);

  const doSave = useCallback(async () => {
    const layout = draftRef.current;
    if (!dirtyRef.current || !layout) return;
    const notes = notesRef.current;
    notesRef.current = [];
    dirtyRef.current = false;
    const last = notes[notes.length - 1] ?? "정리";
    const note = notes.length > 1 ? `${last} 외 ${notes.length - 1}곳` : last;
    setStatus("saving");
    try {
      const r = await saveShelfLayout(layout, baseRef.current, note);
      if (r.ok) {
        baseRef.current = r.version;
        qc.setQueryData<ShelfLayoutState>(shelfLayoutQueryKey(), (old) =>
          old ? { ...old, layout, version: r.version, updatedAt: new Date().toISOString() } : old,
        );
        void qc.invalidateQueries({ queryKey: [...SHELF_LAYOUT_KEY, "history"] });
        setStatus(dirtyRef.current ? "saving" : "saved");
      } else {
        toast.error("먼저 고친 정리가 있어요 — 새로 불러올게요");
        await reload();
        setStatus("idle");
      }
    } catch {
      // 못 보냈으면 다음 저장에 같이 — 「다시 저장」 단추도
      notesRef.current = [...notes, ...notesRef.current];
      dirtyRef.current = true;
      setStatus("error");
    }
  }, [qc, reload]);

  const saveNow = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    chainRef.current = chainRef.current.then(doSave, doSave);
    return chainRef.current;
  }, [doSave]);

  const schedule = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void saveNow(), SAVE_DELAY_MS);
  }, [saveNow]);

  const start = useCallback(() => {
    if (!state || draftRef.current) return;
    baseRef.current = state.version;
    undoRef.current = [];
    setUndoCount(0);
    notesRef.current = [];
    dirtyRef.current = false;
    setDraft(state.layout);
    setStatus("idle");
    setEditing(true);
  }, [state]);

  const apply = useCallback(
    (next: ShelfLayout, note: string) => {
      const cur = draftRef.current;
      if (!cur || next === cur) return;
      if (JSON.stringify(next) === JSON.stringify(cur)) return;
      undoRef.current = [...undoRef.current.slice(-(UNDO_MAX - 1)), cur];
      setUndoCount(undoRef.current.length);
      setDraft(next);
      notesRef.current.push(note);
      dirtyRef.current = true;
      setStatus("saving");
      schedule();
    },
    [schedule],
  );

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    setUndoCount(undoRef.current.length);
    if (!prev) return;
    setDraft(prev);
    notesRef.current.push("되돌리기");
    dirtyRef.current = true;
    setStatus("saving");
    schedule();
  }, [schedule]);

  const finish = useCallback(async () => {
    await saveNow();
    setEditing(false);
    setDraft(null);
    undoRef.current = [];
    setUndoCount(0);
    setStatus("idle");
  }, [saveNow]);

  /** 정리 기록에서 되돌리기 — 남은 저장을 마친 뒤 서버에서 새 판으로 */
  const restore = useCallback(
    async (version: number) => {
      await saveNow();
      setStatus("saving");
      try {
        const r = await restoreShelfLayout(version, baseRef.current);
        if (!r.ok) toast.error("먼저 고친 정리가 있어요 — 새로 불러올게요");
        else toast.success(`${version}번 정리로 되돌렸어요`);
        await reload();
        setStatus(r.ok ? "saved" : "idle");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "되돌리지 못했어요");
        setStatus("error");
      }
    },
    [saveNow, reload],
  );

  // 앱을 내리거나 화면을 떠나면 남은 저장을 바로
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void saveNow();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (dirtyRef.current) void saveNow();
    };
  }, [saveNow]);

  return {
    editing,
    draft,
    status,
    canUndo: undoCount > 0,
    start,
    apply,
    undo,
    finish,
    restore,
    retry: saveNow,
  };
}

export type ShelfEditor = ReturnType<typeof useShelfEditor>;
