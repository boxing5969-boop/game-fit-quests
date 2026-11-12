/**
 * 💬 코치 한마디 도장 — 「오늘 만날 회원」에서 그 회원 오늘 칸에 한 줄 (2026-11-13 대표님 「다음」 · 운동 달력 2-3단계)
 *   회원 운동 달력 오늘 칸에 말풍선 도장 + '○○ 코치님' + 한 줄, 알림은 처음 한 번(고쳐도 다시 안 감 · 밤 10시 ~ 아침 8시는 알림함에만).
 *   의무 아님 · 하루 상한 없음(대표님 결정). 80자 · 예시 4개(153 기준 ③ 칭찬은 구체적으로 · ⑤ 다음 목표).
 *   빼기는 오늘 내가 남긴 것만(두 번 눌러) — 이미 간 알림은 그대로. 저장 · 빼기는 services/promiseService.ts.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { NOTE_EXAMPLES, NOTE_MAX, noteError, noteWho } from "@/lib/calendarMarks";
import type { MeetNote } from "@/lib/promise153";
import { cn } from "@/lib/utils";
import { useRemoveDayNote, useSaveDayNote } from "@/services/promiseService";

export interface OpsDayNoteTarget {
  userId: string;
  name: string;
  notes: readonly MeetNote[];
}

export interface OpsDayNoteSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: OpsDayNoteTarget | null;
}

const OpsDayNoteSheet = ({ open, onOpenChange, target }: OpsDayNoteSheetProps) => {
  const mine = target?.notes.find((n) => n.mine) ?? null;
  const others = target?.notes.filter((n) => !n.mine) ?? [];
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const save = useSaveDayNote();
  const remove = useRemoveDayNote();

  useEffect(() => {
    if (!open) return;
    setBody(mine?.body ?? "");
    setError(null);
    setConfirm(false);
    // 열 때마다 그 회원의 내 한마디로 채운다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.userId]);

  if (!target) return null;
  const len = [...body.replace(/\s+/g, " ").trim()].length;
  const busy = save.isPending || remove.isPending;

  const submit = async () => {
    const e = noteError(body);
    if (e) {
      setError(e);
      return;
    }
    try {
      await save.mutateAsync({ member: target.userId, body });
      toast.success(mine ? "한마디를 고쳤어요" : `${target.name}님 오늘 칸에 남겼어요`);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onRemove = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    try {
      await remove.mutateAsync(target.userId);
      toast.success("한마디를 뺐어요");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{target.name}님에게 오늘 한마디</DrawerTitle>
          <DrawerDescription className="text-label">회원님 운동 달력 오늘 칸에 남고 알림이 한 번 가요 · 의무는 아니에요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {others.length > 0 && (
            <ul className="space-y-1.5" aria-label="다른 분이 남긴 한마디">
              {others.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/60 px-3 py-2.5">
                  <p className="text-micro font-bold text-primary">{noteWho(n)}</p>
                  <p className="mt-0.5 text-body leading-snug text-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            {NOTE_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setBody(ex);
                  setError(null);
                }}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
              >
                {ex}
              </button>
            ))}
          </div>
          <div>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setError(null);
              }}
              rows={3}
              maxLength={NOTE_MAX + 20}
              placeholder="오늘 잘한 것 하나 · 다음 목표 하나"
              aria-label="한마디"
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-body leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className={cn("mt-1 text-right text-micro tabular-nums", len > NOTE_MAX ? "font-bold text-destructive" : "text-muted-foreground")}>
              {len}/{NOTE_MAX}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {mine && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRemove()}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-muted text-body font-bold text-foreground active:scale-[0.98] disabled:opacity-50"
              >
                {confirm ? "한 번 더 누르면 빼요" : "빼기"}
              </button>
            )}
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => void submit()}
              className="flex h-14 flex-[2] items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
            >
              {save.isPending ? "남기는 중…" : mine ? "이렇게 고칠게요" : "오늘 칸에 남기기"}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OpsDayNoteSheet;
