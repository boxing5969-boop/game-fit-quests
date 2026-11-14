/**
 * ✏️ 영상으로 배우기 정리 편집 — 편집 막대 · 고치기 창들 (2026-11-14 대표님 「추천대로진행하자」 · 대표님 · 운영진만)
 *
 *   · 편집 막대: 저장 상태 · 되돌리기 · 정리 기록 · 칸 순서와 이름 · 숨긴 카드 n · 겹침 n · 위 리그 접기 · 지난 7일 회원 숫자
 *   · 카드 창: 카드 보기 · 칸 옮기기 · 맨 앞 고정 · 회원에게 숨기기 · 합침 풀기 · 묶음에서 빼기 / 묶음 창: 이름 · 풀기 · 칸 옮기기
 *   · 합치기 · 묶기 창: 카드를 다른 카드 위에 잠깐 놓았을 때 (합치기 = 한 장만 보이고 「같은 동작」으로 이어짐 · 묶기 = 폴더처럼 한 칸)
 *   · 겹쳐 보이는 카드: 같은 콤비 번호 · 같은 영상 · 비슷한 이름 · 두 칸에 나뉜 계열 → 합치기 · 묶기 · 모으기 · 겹침 아님
 *   · 정리 기록: 지난 정리로 한 번에 되돌리기(새 판으로 남음) · 처음 정리로
 *   창은 document.body 로 띄운다 — 훈련 탭 화면의 움직임(transform) 안에 갇히지 않게.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, EyeOff, History, Layers, ListOrdered, Undo2 } from "lucide-react";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";
import { MEMBER_SHELVES, SHELF_INFO, cardLevel, type Shelf } from "@/lib/trainingCards";
import {
  EMPTY_LAYOUT,
  FOLDER_NAME_MAX,
  SHELF_LABEL_MAX,
  dismissOverlap,
  dissolveFolder,
  layoutSummary,
  leafName,
  makeFolder,
  mergeInto,
  mergedFrom,
  moveToShelf,
  newFolderId,
  preferredMain,
  removeFromFolder,
  renameFolder,
  setHidden,
  setPinned,
  setShelves,
  shelfLabel,
  shelfOrder,
  suggestFolderName,
  unmerge,
  type ArrangedShelf,
  type Overlap,
  type ShelfFolderTile,
  type ShelfLayout,
  type ShelfLeaf,
  type ShelfTile,
  type TileKey,
} from "@/lib/shelfLayout";
import { useShelfLayoutHistory, type CardBrief } from "@/services/shelfLayoutService";
import type { SaveStatus } from "./useShelfEditor";

export type EditSheet =
  | { kind: "item"; key: TileKey }
  | { kind: "merge"; dragged: TileKey; target: TileKey }
  | { kind: "shelves" }
  | { kind: "hidden" }
  | { kind: "overlaps" }
  | { kind: "history" }
  | null;

const Portal = ({ children }: { children: ReactNode }) => (typeof document === "undefined" ? null : createPortal(children, document.body));

const ToolChip = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon?: typeof Undo2;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "warn" | "on";
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-label font-bold transition-transform active:scale-95 disabled:opacity-40",
      tone === "warn" ? "border-transparent bg-[#FF8A3D] text-white" : tone === "on" ? "border-transparent bg-foreground text-background" : "border-border bg-card text-foreground",
    )}
  >
    {Icon && <Icon className="h-4 w-4" strokeWidth={2.4} aria-hidden />}
    {label}
  </button>
);

const BigBtn = ({ children, onClick, tone = "plain", disabled }: { children: ReactNode; onClick: () => void; tone?: "plain" | "primary" | "danger"; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-12 w-full items-center justify-center rounded-2xl px-4 text-body font-bold transition-transform active:scale-[0.99] disabled:opacity-40",
      tone === "primary" ? "bg-foreground text-background" : tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground",
    )}
  >
    {children}
  </button>
);

const Toggle = ({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-left active:scale-[0.99]"
  >
    <span className="min-w-0">
      <span className="block text-body font-bold text-foreground">{label}</span>
      {sub && <span className="mt-0.5 block text-label text-muted-foreground">{sub}</span>}
    </span>
    <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}>
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-elev-1 transition-all", on ? "left-[22px]" : "left-0.5")} />
    </span>
  </button>
);

// ───────────────────────── 편집 막대 ─────────────────────────

export function ShelfEditBar({
  status,
  demo,
  canUndo,
  onUndo,
  onRetry,
  onOpen,
  hiddenCount,
  overlapCount,
  foldUpper,
  onToggleFold,
  brief,
}: {
  status: SaveStatus;
  demo: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onRetry: () => void;
  onOpen: (s: Exclude<EditSheet, null | { kind: "item" } | { kind: "merge" }>["kind"]) => void;
  hiddenCount: number;
  overlapCount: number;
  foldUpper: boolean;
  onToggleFold: () => void;
  brief: CardBrief | null;
}) {
  const statusText = demo
    ? "예시 화면 — 이 창에만 저장돼요"
    : status === "saving"
      ? "저장 중…"
      : status === "saved"
        ? "저장됨 · 전 지점 회원님 화면에 반영돼요"
        : status === "error"
          ? "저장하지 못했어요"
          : "고치면 바로 전 지점 회원님 화면에 반영돼요";
  return (
    <div className="space-y-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className={cn("min-w-0 text-label font-bold", status === "error" ? "text-destructive" : "text-foreground")}>{statusText}</p>
        {status === "error" && (
          <button type="button" onClick={onRetry} className="shrink-0 text-label font-bold text-primary">
            다시 저장
          </button>
        )}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ToolChip icon={Undo2} label="되돌리기" disabled={!canUndo} onClick={onUndo} />
        <ToolChip icon={Layers} label={`겹침 ${overlapCount}`} tone={overlapCount > 0 ? "warn" : undefined} onClick={() => onOpen("overlaps")} />
        <ToolChip icon={EyeOff} label={`숨긴 카드 ${hiddenCount}`} onClick={() => onOpen("hidden")} />
        <ToolChip label={foldUpper ? "위 리그 접기 켬" : "위 리그 접기 끔"} tone={foldUpper ? "on" : undefined} onClick={onToggleFold} />
        <ToolChip icon={ListOrdered} label="칸 순서 · 이름" onClick={() => onOpen("shelves")} />
        <ToolChip icon={History} label="정리 기록" onClick={() => onOpen("history")} />
      </div>
      {brief && (
        <p className="px-1 text-label text-muted-foreground">
          지난 {brief.days}일 · 영상으로 배우기를 본 회원 <b className="text-foreground">{brief.shelfMembers}명</b> · 카드를 연 회원{" "}
          <b className="text-foreground">{brief.members}명</b>
          {brief.demo ? " (예시 숫자)" : ""}
        </p>
      )}
      <p className="px-1 text-label text-muted-foreground">길게 눌러 끌면 순서 · 다른 카드 위에 잠깐 두면 합치기 · 묶기 · −는 회원님께 숨기기</p>
    </div>
  );
}

// ───────────────────────── 고치기 창들 ─────────────────────────

interface Found {
  tile: ShelfTile;
  shelf: Shelf;
  folder: ShelfFolderTile | null;
}

export function ShelfEditSheets({
  sheet,
  onClose,
  layout,
  arranged,
  overlaps,
  brief,
  apply,
  restore,
  version,
  onOpenCard,
}: {
  sheet: EditSheet;
  onClose: () => void;
  layout: ShelfLayout;
  /** 편집 모양(숨김 · 합침도 제자리) — 회원 칸 전부 */
  arranged: ArrangedShelf[];
  overlaps: Overlap[];
  brief: CardBrief | null;
  apply: (next: ShelfLayout, note: string) => void;
  restore: (version: number) => Promise<void>;
  version: number;
  onOpenCard: (key: TileKey) => void;
}) {
  const find = useMemo(() => {
    const map = new Map<TileKey, Found>();
    for (const s of arranged) {
      for (const t of s.tiles) {
        map.set(t.key, { tile: t, shelf: s.id, folder: null });
        if (t.kind === "folder") for (const x of t.tiles) map.set(x.key, { tile: x, shelf: s.id, folder: t });
      }
    }
    return map;
  }, [arranged]);
  const keysOf = (shelf: Shelf) => arranged.find((s) => s.id === shelf)?.tiles.map((t) => t.key) ?? [];
  const nameOf = (key: TileKey) => {
    const f = find.get(key);
    if (!f) return "카드";
    return f.tile.kind === "folder" ? f.tile.name : leafName(f.tile as ShelfLeaf);
  };
  const order = shelfOrder(layout, MEMBER_SHELVES);

  return (
    <Portal>
      <ItemSheet
        open={sheet?.kind === "item"}
        found={sheet?.kind === "item" ? find.get(sheet.key) ?? null : null}
        onClose={onClose}
        layout={layout}
        order={order}
        brief={brief}
        apply={apply}
        keysOf={keysOf}
        nameOf={nameOf}
        onOpenCard={onOpenCard}
      />
      <MergeSheet
        open={sheet?.kind === "merge"}
        dragged={sheet?.kind === "merge" ? find.get(sheet.dragged) ?? null : null}
        target={sheet?.kind === "merge" ? find.get(sheet.target) ?? null : null}
        onClose={onClose}
        layout={layout}
        apply={apply}
        keysOf={keysOf}
      />
      <ShelvesSheet open={sheet?.kind === "shelves"} onClose={onClose} layout={layout} apply={apply} />
      <HiddenSheet open={sheet?.kind === "hidden"} onClose={onClose} layout={layout} arranged={arranged} apply={apply} nameOf={nameOf} />
      <OverlapSheet open={sheet?.kind === "overlaps"} onClose={onClose} layout={layout} overlaps={overlaps} find={find} apply={apply} keysOf={keysOf} />
      <HistorySheet open={sheet?.kind === "history"} onClose={onClose} version={version} restore={restore} apply={apply} layout={layout} />
    </Portal>
  );
}

function ItemSheet({
  open,
  found,
  onClose,
  layout,
  order,
  brief,
  apply,
  keysOf,
  nameOf,
  onOpenCard,
}: {
  open: boolean;
  found: Found | null;
  onClose: () => void;
  layout: ShelfLayout;
  order: { id: Shelf; label: string; color: string }[];
  brief: CardBrief | null;
  apply: (next: ShelfLayout, note: string) => void;
  keysOf: (s: Shelf) => TileKey[];
  nameOf: (k: TileKey) => string;
  onOpenCard: (key: TileKey) => void;
}) {
  const [name, setName] = useState("");
  const tile = found?.tile ?? null;
  useEffect(() => {
    if (tile?.kind === "folder") setName(tile.name);
  }, [tile?.key, tile?.kind === "folder" ? tile.name : ""]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!found || !tile) return <DmSheet open={false} onClose={onClose} title="">{null}</DmSheet>;
  const key = tile.key;
  const isFolder = tile.kind === "folder";
  const title = nameOf(key);
  const level = tile.kind === "card" ? cardLevel(tile.card) : 0;
  const stat = brief?.items.get(key);
  const from = mergedFrom(layout, key);
  const sub = [
    `${shelfLabel(layout, found.shelf)} 칸`,
    found.folder ? `${found.folder.name} 묶음` : null,
    isFolder ? `카드 ${(tile as ShelfFolderTile).tiles.length}장` : null,
    level ? `레벨 ${level}` : null,
    tile.kind === "mission" ? "레벨 미션 영상" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DmSheet open={open} onClose={onClose} title={title} subtitle={sub}>
      <div className="space-y-3 pb-2">
        {stat && (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-label text-foreground">
            지난 {brief!.days}일 · 연 회원 <b>{stat.users}명</b> · 끝까지 본 회원 <b>{stat.completes}명</b>
            {stat.replays ? ` · 다시 본 회원 ${stat.replays}명` : ""}
            {brief!.demo ? " (예시)" : ""}
          </p>
        )}
        {tile.kind !== "folder" && (
          <BigBtn
            onClick={() => {
              onClose();
              onOpenCard(key);
            }}
          >
            {tile.kind === "card" ? "카드 보기" : "영상 보기"}
          </BigBtn>
        )}

        {isFolder && (
          <div className="space-y-2 rounded-2xl bg-secondary p-3">
            <p className="px-1 text-label font-bold text-muted-foreground">묶음 이름</p>
            <div className="flex gap-2">
              <input
                value={name}
                maxLength={FOLDER_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                aria-label="묶음 이름"
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-body text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => apply(renameFolder(layout, (tile as ShelfFolderTile).id, name), `묶음 이름 · ${name}`)}
                className="h-12 shrink-0 rounded-xl bg-foreground px-4 text-body font-bold text-background active:scale-95"
              >
                바꾸기
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="px-1 text-label font-bold text-muted-foreground">칸 옮기기</p>
          <div className="flex flex-wrap gap-1.5">
            {order.map((s) => {
              const on = s.id === found.shelf && !found.folder;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={on}
                  onClick={() => {
                    apply(moveToShelf(layout, key, s.id, keysOf(s.id)), `칸 옮기기 · ${title} → ${s.label}`);
                    onClose();
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-label font-bold active:scale-95",
                    on ? "border-transparent text-white" : "border-border bg-card text-foreground",
                  )}
                  style={on ? { backgroundColor: s.color } : undefined}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {!found.folder && (
          <Toggle
            label="맨 앞 고정"
            sub="칸 맨 앞에 「추천」으로 보여요"
            on={tile.pinned}
            onChange={(v) => apply(setPinned(layout, key, v), `${v ? "고정" : "고정 풀기"} · ${title}`)}
          />
        )}
        <Toggle
          label="회원님께 숨기기"
          sub="코치님 화면엔 흐리게 남아요 · 카드는 지우지 않아요"
          on={tile.hidden}
          onChange={(v) => apply(setHidden(layout, key, v), `${v ? "숨김" : "다시 보임"} · ${title}`)}
        />

        {tile.mergedInto && (
          <div className="rounded-2xl bg-secondary px-4 py-3">
            <p className="text-body text-foreground">
              ‘{nameOf(tile.mergedInto)}’에 합쳐 있어요 — 회원님께는 그 카드만 보여요.
            </p>
            <button
              type="button"
              onClick={() => apply(unmerge(layout, key), `합침 풀기 · ${title}`)}
              className="mt-2 text-label font-bold text-primary"
            >
              합침 풀기
            </button>
          </div>
        )}
        {from.length > 0 && (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-label text-foreground">
            같은 동작으로 이어진 카드: {from.map((k) => `‘${nameOf(k)}’`).join(", ")}
          </p>
        )}

        {found.folder && (
          <BigBtn
            onClick={() => {
              apply(removeFromFolder(layout, found.shelf, keysOf(found.shelf), key), `묶음에서 빼기 · ${title}`);
              onClose();
            }}
          >
            ‘{found.folder.name}’ 묶음에서 빼기
          </BigBtn>
        )}
        {isFolder && (
          <BigBtn
            onClick={() => {
              apply(dissolveFolder(layout, found.shelf, keysOf(found.shelf), (tile as ShelfFolderTile).id), `묶음 풀기 · ${title}`);
              onClose();
            }}
          >
            묶음 풀기 (카드를 그 자리에)
          </BigBtn>
        )}
      </div>
    </DmSheet>
  );
}

function MergeSheet({
  open,
  dragged,
  target,
  onClose,
  layout,
  apply,
  keysOf,
}: {
  open: boolean;
  dragged: Found | null;
  target: Found | null;
  onClose: () => void;
  layout: ShelfLayout;
  apply: (next: ShelfLayout, note: string) => void;
  keysOf: (s: Shelf) => TileKey[];
}) {
  const a = dragged?.tile.kind !== "folder" ? (dragged?.tile as ShelfLeaf | undefined) : undefined;
  const b = target?.tile.kind !== "folder" ? (target?.tile as ShelfLeaf | undefined) : undefined;
  const [mainKey, setMainKey] = useState<TileKey | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    if (!a || !b) return;
    setMainKey(preferredMain(a, b)[0].key);
    setName(suggestFolderName(leafName(b), leafName(a)));
  }, [a?.key, b?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a || !b || !target) return <DmSheet open={false} onClose={onClose} title="">{null}</DmSheet>;
  const main = mainKey === a.key ? a : b;
  const dup = main === a ? b : a;
  return (
    <DmSheet open={open} onClose={onClose} title="두 카드를 어떻게 할까요?" subtitle={`‘${leafName(a)}’ → ‘${leafName(b)}’`}>
      <div className="space-y-3 pb-2">
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="px-1 text-body font-bold text-foreground">합치기 — 한 장만 보여요</p>
          <p className="px-1 text-label text-muted-foreground">다른 카드는 회원님께 숨기고, 남는 카드 시트에 「같은 동작」으로 이어져요.</p>
          {[b, a].map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setMainKey(x.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-body active:scale-[0.99]",
                mainKey === x.key ? "border-primary bg-primary/5 font-bold text-foreground" : "border-border text-foreground",
              )}
            >
              <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", mainKey === x.key ? "border-primary bg-primary" : "border-border")} />
              <span className="min-w-0 truncate">‘{leafName(x)}’ 남기기</span>
            </button>
          ))}
          <BigBtn
            tone="primary"
            onClick={() => {
              apply(mergeInto(layout, dup.key, main.key), `합치기 · ${leafName(dup)} → ${leafName(main)}`);
              onClose();
            }}
          >
            합치기
          </BigBtn>
        </div>
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="px-1 text-body font-bold text-foreground">묶기 — 폴더처럼 한 칸</p>
          <p className="px-1 text-label text-muted-foreground">입문 → 실전처럼 이어지는 동작을 한 칸에 담아요. 열면 두 카드가 차례로 보여요.</p>
          <input
            value={name}
            maxLength={FOLDER_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            aria-label="묶음 이름"
            placeholder="묶음 이름"
            className="h-12 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground outline-none focus:border-primary"
          />
          <BigBtn
            onClick={() => {
              apply(makeFolder(layout, target.shelf, keysOf(target.shelf), b.key, a.key, newFolderId(), name), `묶기 · ${name || "묶음"}`);
              onClose();
            }}
          >
            묶기
          </BigBtn>
        </div>
      </div>
    </DmSheet>
  );
}

function ShelvesSheet({ open, onClose, layout, apply }: { open: boolean; onClose: () => void; layout: ShelfLayout; apply: (next: ShelfLayout, note: string) => void }) {
  const order = shelfOrder(layout, MEMBER_SHELVES);
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) setLabels(Object.fromEntries(order.map((s) => [s.id, s.label])));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (list: { id: Shelf; label?: string }[], note: string) => apply(setShelves(layout, list), note);
  const current = () => order.map((s) => ({ id: s.id, label: labels[s.id] ?? s.label }));
  const move = (i: number, d: number) => {
    const list = current();
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit(list, `칸 순서 · ${list[j].label}`);
  };
  return (
    <DmSheet open={open} onClose={onClose} title="칸 순서 · 이름" subtitle="회원님 칩 순서와 이름이 바뀌어요 (비우면 원래 이름)">
      <ul className="space-y-2 pb-2">
        {order.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-2xl bg-secondary p-2">
            <span className="ml-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <input
              value={labels[s.id] ?? s.label}
              maxLength={SHELF_LABEL_MAX}
              placeholder={SHELF_INFO[s.id].label}
              onChange={(e) => setLabels((m) => ({ ...m, [s.id]: e.target.value }))}
              onBlur={() => {
                const v = (labels[s.id] ?? "").trim();
                if (v !== s.label) commit(current(), `칸 이름 · ${v || SHELF_INFO[s.id].label}`);
              }}
              aria-label={`${SHELF_INFO[s.id].label} 칸 이름`}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-body text-foreground outline-none focus:border-primary"
            />
            <button type="button" aria-label="앞으로" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-foreground disabled:opacity-30 active:scale-95">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" aria-label="뒤로" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-foreground disabled:opacity-30 active:scale-95">
              <ArrowDown className="h-4 w-4" />
            </button>
          </li>
        ))}
        <li className="pt-1">
          <BigBtn
            onClick={() => {
              commit([], "칸 순서 · 이름 처음대로");
              setLabels(Object.fromEntries(MEMBER_SHELVES.map((s) => [s, SHELF_INFO[s].label])));
            }}
          >
            처음 순서 · 이름으로
          </BigBtn>
        </li>
      </ul>
    </DmSheet>
  );
}

function HiddenSheet({
  open,
  onClose,
  layout,
  arranged,
  apply,
  nameOf,
}: {
  open: boolean;
  onClose: () => void;
  layout: ShelfLayout;
  arranged: ArrangedShelf[];
  apply: (next: ShelfLayout, note: string) => void;
  nameOf: (k: TileKey) => string;
}) {
  const rows = arranged.flatMap((s) =>
    [...s.tiles, ...s.tiles.flatMap((t) => (t.kind === "folder" ? t.tiles : []))]
      .filter((t) => t.hidden || t.mergedInto)
      .map((t) => ({ t, shelf: s })),
  );
  return (
    <DmSheet open={open} onClose={onClose} title="숨긴 카드" subtitle="회원님께 안 보이는 카드 — 코치님 화면엔 흐리게 남아요">
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-secondary px-4 py-8 text-center text-body text-muted-foreground">숨긴 카드가 없어요</p>
      ) : (
        <ul className="space-y-2 pb-2">
          {rows.map(({ t, shelf }) => (
            <li key={t.key} className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-foreground">{nameOf(t.key)}</p>
                <p className="mt-0.5 truncate text-label text-muted-foreground">
                  {shelf.label} 칸 · {t.mergedInto ? `‘${nameOf(t.mergedInto)}’에 합침` : "숨김"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  apply(t.mergedInto ? unmerge(layout, t.key) : setHidden(layout, t.key, false), `${t.mergedInto ? "합침 풀기" : "다시 보임"} · ${nameOf(t.key)}`)
                }
                className="h-10 shrink-0 rounded-full bg-foreground px-3.5 text-label font-bold text-background active:scale-95"
              >
                {t.mergedInto ? "합침 풀기" : "다시 보이기"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </DmSheet>
  );
}

const REASON: Record<string, string> = { combo: "같은 콤비 번호", video: "같은 영상", name: "비슷한 이름" };

function OverlapSheet({
  open,
  onClose,
  layout,
  overlaps,
  find,
  apply,
  keysOf,
}: {
  open: boolean;
  onClose: () => void;
  layout: ShelfLayout;
  overlaps: Overlap[];
  find: Map<TileKey, Found>;
  apply: (next: ShelfLayout, note: string) => void;
  keysOf: (s: Shelf) => TileKey[];
}) {
  const label = (s: Shelf) => shelfLabel(layout, s);
  return (
    <DmSheet open={open} onClose={onClose} tall title={`겹쳐 보이는 카드 ${overlaps.length}`} subtitle="같은 동작이 여러 곳에 있으면 회원님이 헷갈려요 — 합치거나 묶어 주세요">
      {overlaps.length === 0 ? (
        <p className="rounded-2xl bg-secondary px-4 py-8 text-center text-body text-muted-foreground">겹쳐 보이는 카드가 없어요</p>
      ) : (
        <ul className="space-y-2.5 pb-2">
          {overlaps.map((o) => {
            if (o.kind === "spread") {
              return (
                <li key={o.id} className="space-y-2 rounded-2xl border border-border p-3">
                  <p className="text-body font-bold text-foreground">{o.family} — 두 칸에 나뉘어 있어요</p>
                  <p className="text-label text-muted-foreground">{o.shelves.map((s) => `${label(s.id)} ${s.count}장`).join(" · ")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.shelves.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          let next = layout;
                          for (const k of o.keys) {
                            const f = find.get(k);
                            if (!f || (f.shelf === s.id && !f.folder)) continue;
                            const target = next === layout ? keysOf(s.id) : next.items?.[s.id] ?? keysOf(s.id);
                            next = moveToShelf(next, k, s.id, target);
                          }
                          apply(next, `모으기 · ${o.family} → ${label(s.id)}`);
                        }}
                        className="h-10 rounded-full bg-foreground px-3.5 text-label font-bold text-background active:scale-95"
                      >
                        {label(s.id)} 칸으로 모으기
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => apply(dismissOverlap(layout, o.id), `그대로 두기 · ${o.family}`)}
                      className="h-10 rounded-full border border-border px-3.5 text-label font-bold text-foreground active:scale-95"
                    >
                      그대로 두기
                    </button>
                  </div>
                </li>
              );
            }
            const fa = find.get(o.a);
            const fb = find.get(o.b);
            if (!fa || !fb || fa.tile.kind === "folder" || fb.tile.kind === "folder") return null;
            const [main, dup] = preferredMain(fa.tile as ShelfLeaf, fb.tile as ShelfLeaf);
            const mainF = main.key === o.a ? fa : fb;
            const dupF = main.key === o.a ? fb : fa;
            return (
              <li key={o.id} className="space-y-2 rounded-2xl border border-border p-3">
                <span className="inline-block rounded-full bg-[#FF8A3D]/15 px-2 py-0.5 text-micro font-bold text-[#C2570C]">{REASON[o.reason]}</span>
                <div className="space-y-1">
                  <p className="text-body font-bold text-foreground">
                    {leafName(main)} <span className="font-normal text-muted-foreground">· {label(mainF.shelf)}</span>
                    <span className="ml-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 align-middle text-micro font-bold text-primary">합치면 남음</span>
                  </p>
                  <p className="text-body font-bold text-foreground">
                    {leafName(dup)} <span className="font-normal text-muted-foreground">· {label(dupF.shelf)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => apply(mergeInto(layout, dup.key, main.key), `합치기 · ${leafName(dup)} → ${leafName(main)}`)}
                    className="h-10 rounded-full bg-foreground px-3.5 text-label font-bold text-background active:scale-95"
                  >
                    합치기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = suggestFolderName(leafName(main), leafName(dup));
                      apply(makeFolder(layout, mainF.shelf, keysOf(mainF.shelf), main.key, dup.key, newFolderId(), name), `묶기 · ${name}`);
                    }}
                    className="h-10 rounded-full border border-border px-3.5 text-label font-bold text-foreground active:scale-95"
                  >
                    묶기
                  </button>
                  <button
                    type="button"
                    onClick={() => apply(dismissOverlap(layout, o.id), `겹침 아님 · ${leafName(main)}`)}
                    className="h-10 rounded-full border border-border px-3.5 text-label font-bold text-muted-foreground active:scale-95"
                  >
                    겹침 아님
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DmSheet>
  );
}

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

function HistorySheet({
  open,
  onClose,
  version,
  restore,
  apply,
  layout,
}: {
  open: boolean;
  onClose: () => void;
  version: number;
  restore: (v: number) => Promise<void>;
  apply: (next: ShelfLayout, note: string) => void;
  layout: ShelfLayout;
}) {
  const q = useShelfLayoutHistory(open);
  const [busy, setBusy] = useState<number | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  useEffect(() => {
    if (!open) setResetArmed(false);
  }, [open]);
  const list = q.data ?? [];
  return (
    <DmSheet open={open} onClose={onClose} tall title="정리 기록" subtitle="저장할 때마다 한 줄 — 지난 정리로 한 번에 되돌릴 수 있어요">
      {q.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl bg-secondary px-4 py-8 text-center text-body text-muted-foreground">아직 저장한 정리가 없어요</p>
      ) : (
        <ul className="space-y-2 pb-2">
          {list.map((h) => {
            const now = h.version === version;
            return (
              <li key={h.version} className={cn("rounded-2xl px-4 py-3", now ? "border border-primary/40 bg-primary/5" : "bg-secondary")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-body font-bold text-foreground">
                      {h.version}번 정리{now ? " · 지금" : ""}
                    </p>
                    <p className="mt-0.5 text-label text-muted-foreground">
                      {fmtWhen(h.savedAt)}
                      {h.savedByName ? ` · ${h.savedByName}` : ""}
                    </p>
                  </div>
                  {!now && (
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={async () => {
                        setBusy(h.version);
                        await restore(h.version);
                        setBusy(null);
                      }}
                      className="h-10 shrink-0 rounded-full bg-foreground px-3.5 text-label font-bold text-background disabled:opacity-40 active:scale-95"
                    >
                      {busy === h.version ? "되돌리는 중…" : "이 정리로"}
                    </button>
                  )}
                </div>
                {h.note && <p className="mt-1.5 line-clamp-2 text-label text-foreground">{h.note}</p>}
                <p className="mt-0.5 text-label text-muted-foreground">{layoutSummary(h.layout)}</p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pb-2 pt-1">
        <BigBtn
          tone="danger"
          disabled={JSON.stringify(layout) === JSON.stringify(EMPTY_LAYOUT)}
          onClick={() => {
            if (!resetArmed) {
              setResetArmed(true);
              return;
            }
            apply(EMPTY_LAYOUT, "처음 정리로");
            setResetArmed(false);
            onClose();
          }}
        >
          {resetArmed ? "한 번 더 누르면 처음 정리로 돌아가요" : "처음 정리로 (정리 모두 풀기)"}
        </BigBtn>
      </div>
    </DmSheet>
  );
}
