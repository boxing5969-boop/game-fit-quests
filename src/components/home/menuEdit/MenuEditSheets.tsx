// 🗂 전체 메뉴 편집 창 — 메뉴 고치기 · 폴더 고치기 · 바로가기 추가 (2026-11-08 대표님 바로가기 편집)
//
//   · 메뉴 고치기: 이름 바꾸기(비우면 원래 이름) · 넣을 곳(첫 화면 · 폴더 · 새 폴더) · 앞으로/뒤로 · 메뉴에서 빼기
//   · 폴더 고치기: 폴더 이름 · 폴더 풀기(안의 메뉴를 그 자리에) · 폴더째 빼기
//   · 바로가기 추가: 앱 안 모든 화면을 검색해서 넣는다 — 뺀 기본 메뉴는 '다시 넣기'에 먼저, 운영진 화면은 '운영진' 칸.
//     권한이 없는 화면은 목록에도 안 나온다(라이브보드는 관리자 화면에 들어가는 분만).
// 창은 아래 '전체' 시트(z-60) 위에 뜬다 — document.body 로 띄워 시트의 애니메이션(transform) 안에 갇히지 않게.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import GlyphTile, { GlyphFolderTile } from "@/components/icons/GlyphTile";
import type { MenuGlyphName } from "@/components/icons/menuGlyphs";
import { scoreEntry, type SearchEntry } from "@/lib/appSearch";
import {
  MAX_LABEL,
  ROOT,
  canSee,
  containerOf,
  menuCatalog,
  type LayoutEntry,
  type MenuCatalogItem,
  type MenuViewer,
} from "@/lib/menuLayout";
import { cn } from "@/lib/utils";

export interface FolderOption {
  id: string;
  label: string;
}

/** 새 폴더를 만들어 거기에 넣기 */
export const NEW_FOLDER = "__new__";

// ── 공통 창 ────────────────────────────────────────────────

const Sheet = ({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  useModalDismiss(open, onClose);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 dark:bg-background/80 dark:backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl safe-area-bottom sm:rounded-3xl"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div className="flex min-w-0 items-center gap-2.5">
                {icon}
                <h2 className="truncate text-heading text-foreground">{title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="border-t border-border px-5 pb-5 pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 mt-4 text-label font-bold text-muted-foreground first:mt-0">{children}</p>
);

const NameInput = ({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) => (
  <input
    id={id}
    type="text"
    value={value}
    maxLength={MAX_LABEL}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    enterKeyHint="done"
    autoComplete="off"
    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
  />
);

/** 넣을 곳 고르기 — 첫 화면 · 폴더들 (· 새 폴더) */
const DestChips = ({
  value,
  onChange,
  folders,
  allowNew,
}: {
  value: string;
  onChange: (v: string) => void;
  folders: readonly FolderOption[];
  allowNew?: boolean;
}) => {
  const opts: FolderOption[] = [{ id: ROOT, label: "첫 화면" }, ...folders];
  if (allowNew) opts.push({ id: NEW_FOLDER, label: "+ 새 폴더" });
  const rowRef = useRef<HTMLDivElement>(null);
  // 고른 곳이 줄 밖(오른쪽)에 있으면 보이게 — 내 정보 폴더에서 열면 '내 정보'가 보여야 한다
  useEffect(() => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !el) return;
    const left = el.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + el.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = Math.max(0, left - (row.clientWidth - el.offsetWidth) / 2);
    }
  }, [value]);
  return (
    <div ref={rowRef} role="radiogroup" aria-label="넣을 곳" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-10 shrink-0 rounded-pill px-4 text-label font-bold transition-colors active:scale-[0.97]",
            value === o.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

const PrimaryBtn = ({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="h-12 flex-1 rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
  >
    {children}
  </button>
);

const DangerBtn = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-12 flex-1 rounded-xl border border-destructive/40 text-body font-bold text-destructive transition-transform active:scale-[0.98]"
  >
    {children}
  </button>
);

const SecondaryBtn = ({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-muted text-body font-bold text-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
  >
    {children}
  </button>
);

// ── 메뉴 고치기 ────────────────────────────────────────────

export interface ItemEditTarget {
  id: string;
  label: string;
  defaultLabel: string;
  glyph: MenuGlyphName;
  container: string;
  canPrev: boolean;
  canNext: boolean;
}

export const ItemEditSheet = ({
  target,
  folders,
  onClose,
  onSave,
  onRemove,
  onMove,
}: {
  target: ItemEditTarget | null;
  folders: readonly FolderOption[];
  onClose: () => void;
  onSave: (label: string, dest: string) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) => {
  const [label, setLabel] = useState("");
  const [dest, setDest] = useState<string>(ROOT);
  const id = target?.id;
  useEffect(() => {
    if (!target) return;
    setLabel(target.label === target.defaultLabel ? "" : target.label);
    setDest(target.container);
    // 창을 열 때(다른 칸을 고를 때)만 다시 채운다 — 앞/뒤로 옮겨도 입력은 그대로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title="메뉴 고치기"
      icon={target ? <GlyphTile name={target.glyph} size={40} /> : null}
      footer={
        <div className="flex gap-2">
          <DangerBtn onClick={onRemove}>메뉴에서 빼기</DangerBtn>
          <PrimaryBtn onClick={() => onSave(label, dest)}>저장</PrimaryBtn>
        </div>
      }
    >
      {target && (
        <>
          <FieldLabel>
            <label htmlFor="menu-item-name">이름</label>
          </FieldLabel>
          <NameInput id="menu-item-name" value={label} onChange={setLabel} placeholder={target.defaultLabel} />
          {label.trim() && label.trim() !== target.defaultLabel && (
            <button type="button" onClick={() => setLabel("")} className="mt-2 text-label font-bold text-primary">
              원래 이름({target.defaultLabel})으로
            </button>
          )}
          <FieldLabel>넣을 곳</FieldLabel>
          <DestChips value={dest} onChange={setDest} folders={folders} allowNew />
          <FieldLabel>순서</FieldLabel>
          <div className="flex gap-2">
            <SecondaryBtn onClick={() => onMove(-1)} disabled={!target.canPrev}>
              <ChevronLeft className="h-5 w-5" />
              앞으로
            </SecondaryBtn>
            <SecondaryBtn onClick={() => onMove(1)} disabled={!target.canNext}>
              뒤로
              <ChevronRight className="h-5 w-5" />
            </SecondaryBtn>
          </div>
        </>
      )}
    </Sheet>
  );
};

// ── 폴더 고치기 ────────────────────────────────────────────

export interface FolderEditTarget {
  id: string;
  label: string;
  glyphs: MenuGlyphName[];
  count: number;
}

export const FolderEditSheet = ({
  target,
  onClose,
  onSave,
  onDissolve,
  onRemove,
}: {
  target: FolderEditTarget | null;
  onClose: () => void;
  onSave: (label: string) => void;
  onDissolve: () => void;
  onRemove: () => void;
}) => {
  const [label, setLabel] = useState("");
  const id = target?.id;
  useEffect(() => {
    if (target) setLabel(target.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title="폴더 고치기"
      icon={target ? <GlyphFolderTile names={target.glyphs} size={40} /> : null}
      footer={
        <PrimaryBtn onClick={() => onSave(label)} disabled={!label.trim()}>
          저장
        </PrimaryBtn>
      }
    >
      {target && (
        <>
          <FieldLabel>
            <label htmlFor="menu-folder-name">폴더 이름</label>
          </FieldLabel>
          <NameInput id="menu-folder-name" value={label} onChange={setLabel} placeholder="폴더 이름" />
          {target.count > 0 && (
            <>
              <FieldLabel>폴더 정리</FieldLabel>
              <div className="flex gap-2">
                <SecondaryBtn onClick={onDissolve}>폴더 풀기</SecondaryBtn>
                <DangerBtn onClick={onRemove}>폴더째 빼기</DangerBtn>
              </div>
              <p className="mt-2 text-label text-muted-foreground">
                폴더를 풀면 안의 메뉴 {target.count}개가 그 자리에 펼쳐져요
              </p>
            </>
          )}
          {target.count === 0 && (
            <div className="mt-4 flex gap-2">
              <DangerBtn onClick={onRemove}>빈 폴더 지우기</DangerBtn>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
};

// ── 바로가기 추가 ──────────────────────────────────────────

const STAFF_REQ = new Set(["staff", "manager", "admin", "office"]);

const asSearch = (c: MenuCatalogItem): SearchEntry => ({
  id: c.id,
  group: "feature",
  title: c.label,
  subtitle: c.subtitle,
  keywords: c.keywords,
  action: { kind: "route", to: c.id },
});

export const AddShortcutSheet = ({
  open,
  initialDest,
  entries,
  viewer,
  folders,
  onClose,
  onAdd,
}: {
  open: boolean;
  initialDest: string;
  entries: readonly LayoutEntry[];
  viewer: MenuViewer;
  folders: readonly FolderOption[];
  onClose: () => void;
  /** 넣었으면 true (꽉 찼으면 false) */
  onAdd: (id: string, dest: string) => boolean;
}) => {
  const [q, setQ] = useState("");
  const [dest, setDest] = useState(initialDest);
  useEffect(() => {
    if (open) {
      setDest(initialDest);
      setQ("");
    }
  }, [open, initialDest]);

  const folderLabel = useMemo(() => new Map(folders.map((f) => [f.id, f.label])), [folders]);
  const whereLabel = (c: string | null) => (c === ROOT ? "첫 화면" : c ? (folderLabel.get(c) ?? "폴더") : null);

  const visible = useMemo(() => menuCatalog().list.filter((c) => canSee(c.requires, viewer)), [viewer]);

  const sections = useMemo(() => {
    const query = q.trim();
    if (query) {
      const hits = visible
        .map((c, i) => ({ c, s: scoreEntry(asSearch(c), query), i }))
        .filter((h) => h.s > 0)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((h) => h.c);
      return [{ title: hits.length ? "찾은 화면" : "", items: hits }];
    }
    const placedNow = (id: string) => containerOf(entries, id) !== null;
    const hidden = visible.filter((c) => c.source === "menu" && !placedNow(c.id));
    const staff = visible.filter((c) => c.source === "more" && c.requires && STAFF_REQ.has(c.requires));
    const rest = visible.filter(
      (c) =>
        !(c.source === "menu" && !placedNow(c.id)) && !(c.source === "more" && c.requires && STAFF_REQ.has(c.requires)),
    );
    return [
      { title: "다시 넣기 · 뺀 메뉴", items: hidden },
      { title: "운영진", items: staff },
      { title: "모든 화면", items: rest },
    ].filter((s) => s.items.length > 0);
  }, [q, visible, entries]);

  const destName = whereLabel(dest) ?? "첫 화면";

  return (
    <Sheet open={open} onClose={onClose} title="바로가기 추가">
      <div className="sticky top-0 z-10 -mx-5 bg-card px-5 pb-3">
        <label className="flex h-12 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="화면 찾기 · 예) 라이브보드"
            aria-label="넣을 화면 찾기"
            enterKeyHint="search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p className="mb-2 mt-3 text-label font-bold text-muted-foreground">넣을 곳</p>
        <DestChips value={dest} onChange={setDest} folders={folders} />
      </div>

      {sections.length === 0 || (sections.length === 1 && sections[0].items.length === 0) ? (
        <p className="py-10 text-center text-body text-muted-foreground">맞는 화면이 없어요</p>
      ) : (
        sections.map((sec) => (
          <section key={sec.title || "hits"} className="mt-2">
            {sec.title && <h3 className="mb-1 mt-3 text-label font-bold text-muted-foreground">{sec.title}</h3>}
            <ul>
              {sec.items.map((c) => {
                const at = containerOf(entries, c.id);
                const here = at === dest;
                const where = whereLabel(at);
                return (
                  <li key={c.id} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0">
                    <GlyphTile name={c.glyph} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-bold text-foreground">{c.label}</p>
                      <p className="line-clamp-1 text-label text-muted-foreground">
                        {where && !here ? `지금 ${where}에 있어요` : (c.subtitle ?? "")}
                      </p>
                    </div>
                    {here ? (
                      <span className="flex h-9 shrink-0 items-center gap-1 rounded-pill px-3 text-label font-bold text-muted-foreground">
                        <Check className="h-4 w-4" aria-hidden />
                        있어요
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAdd(c.id, dest)}
                        aria-label={`${c.label} — ${destName}에 ${at ? "옮기기" : "넣기"}`}
                        className={cn(
                          "h-9 shrink-0 rounded-pill px-4 text-label font-bold transition-transform active:scale-95",
                          // 민트는 포인트로만 — 줄마다 있는 단추는 차콜
                          at ? "bg-muted text-foreground" : "bg-foreground text-background",
                        )}
                      >
                        {at ? "옮기기" : "넣기"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Sheet>
  );
};
