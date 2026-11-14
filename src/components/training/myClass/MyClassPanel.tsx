/**
 * 🎬 「내 수업」 칸 — 영상으로 배우기 칩 맨 앞을 고르면 카드 칸 대신 보인다 (2026-11-14 2단계)
 *
 *   · 내 수업 카드: 네 칸 그림 · 이름 · 카드 n장 · n분 · 「n번 했어요」(한 적이 있을 때만) · 코치님 한마디 · ▶ 시작
 *   · + 새 수업 만들기 (20개까지)
 *   · 코치진: 아래 「회원님이 보여준 수업 n」 — 누르면 보기 · 한마디 창. 아직 한마디가 없으면 「한마디 기다려요」
 *   감정 설계: 안 한 수업 · 빠진 날은 말하지 않는다 · 숫자는 본인에게만
 */
import { Plus, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_CLASSES, classSummary, playedText, type MyClass, type SharedClass } from "@/lib/myClass";
import { ClassGrid } from "./MyClassParts";
import type { MyClassFlow, PosterOf } from "./useMyClassFlow";

const statusLine = (c: MyClass, staff: boolean): { text: string; strong: boolean } | null => {
  if (c.newNotes > 0) return { text: `💬 코치님 한마디 ${c.newNotes}`, strong: true };
  if (c.notes.length > 0) return { text: `코치님 한마디 ${c.notes.length}`, strong: false };
  if (!staff && c.shared) return { text: "코치님께 보여드리는 중", strong: false };
  return null;
};

const MyClassPanel = ({ flow, posterOf, onStart }: { flow: MyClassFlow; posterOf: PosterOf; onStart: (id: string) => void }) => {
  const { classes, shared, resolve, staffView } = flow;
  const playable = (c: Pick<MyClass, "items">) => c.items.some((x) => !!resolve(x.k));

  const classCard = (c: MyClass) => {
    const resolved = c.items.map((x) => resolve(x.k));
    const avail = (k: string) => !!resolve(k);
    const played = playedText(c.plays);
    const st = statusLine(c, flow.staff);
    return (
      <li key={c.id} className="relative">
        <button
          type="button"
          onClick={() => flow.openEditor(c.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 pr-[4.5rem] text-left shadow-elev-1 transition-all active:scale-[0.99]"
        >
          <ClassGrid items={resolved.filter(Boolean)} posterOf={posterOf} className="h-[4.5rem] w-[4.5rem]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-bold text-foreground">{c.name}</span>
            <span className="mt-0.5 block truncate text-label text-muted-foreground">
              {c.items.length === 0 ? "카드를 담아 주세요" : classSummary(c.items, avail)}
              {played ? ` · ${played}` : ""}
            </span>
            {st && <span className={cn("mt-0.5 block truncate text-label", st.strong ? "font-bold text-primary" : "text-muted-foreground")}>{st.text}</span>}
          </span>
        </button>
        {playable(c) && (
          <button
            type="button"
            onClick={() => onStart(c.id)}
            aria-label={`${c.name} 시작`}
            className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-elev-1 transition-all active:scale-90"
          >
            <Play className="h-5 w-5 fill-current" aria-hidden />
          </button>
        )}
      </li>
    );
  };

  const sharedCard = (c: SharedClass) => {
    const resolved = c.items.map((x) => resolve(x.k));
    const avail = (k: string) => !!resolve(k);
    const waiting = c.notes.length === 0;
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => flow.openShared(c.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-elev-1 transition-all active:scale-[0.99]"
        >
          <ClassGrid items={resolved.filter(Boolean)} posterOf={posterOf} className="h-16 w-16" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label font-bold text-muted-foreground">{c.owner.name}님</span>
            <span className="block truncate text-body font-bold text-foreground">{c.name}</span>
            <span className="block truncate text-label text-muted-foreground">{classSummary(c.items, avail)}</span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-micro font-bold",
              waiting ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {waiting ? "한마디 기다려요" : `한마디 ${c.notes.length}`}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {classes.length > 0 && <ul className="space-y-2.5">{classes.map(classCard)}</ul>}
      {classes.length < MAX_CLASSES && (
        <button
          type="button"
          onClick={() => void flow.createEmpty()}
          disabled={flow.busy}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-body font-bold text-foreground transition-all active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> 새 수업 만들기
        </button>
      )}
      {classes.length === 0 && <p className="px-1 text-label text-muted-foreground">카드의 + 를 누르면 내 수업에 담겨요</p>}

      {staffView && flow.sharedAvailable && (
        <div className="space-y-2.5 pt-2">
          <h3 className="px-1 text-body font-black text-foreground">
            회원님이 보여준 수업 <span className="text-muted-foreground">{shared.length}</span>
          </h3>
          {shared.length > 0 ? (
            <ul className="space-y-2.5">{shared.map(sharedCard)}</ul>
          ) : (
            <p className="rounded-2xl bg-secondary px-4 py-4 text-label text-muted-foreground">
              회원님이 내 수업에서 「코치님께 보여드리기」를 켜면 여기에 와요
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MyClassPanel;
