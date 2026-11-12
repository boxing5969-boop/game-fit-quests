// 🗂 전체 메뉴 그리드 — 홈 첫 화면(2026-09-29 대표님: 처음 접속하면 전체 메뉴가 먼저 보이게)과
// 하단 '전체' 탭 시트가 같이 쓴다. 기본 목록은 lib/appMenu.ts 한 곳.
//
// 버튼 = 153 글리프 타일(연속 곡률 칸 + 직접 그린 아이콘) + 두 줄까지 라벨.
// 누르면 타일만 살짝 눌리고(0.92) 라벨은 제자리 — 손가락 아래에서만 반응하는 애플식 감각.
// 2026-10-18 대표님: "연관성 있는 메뉴는 하나에 붙여줘" → 묶음 칸(GlyphFolderTile). 누르면 그 줄 바로 아래에
//   안의 메뉴가 펼쳐진다(한 번에 하나). 지금 보고 있는 화면이 묶음 안에 있으면 묶음 칸 이름이 초록색.
// 2026-11-08 대표님 「바로가기 기능 만들어줘 … 현재 있는 바로가기 메뉴들도 옮기고 빼고 수정할수있게해줘
//   회원님들도 나도 가능하게 아이폰이나 안드로이드 처럼」 → 내 메뉴(lib/menuLayout · hooks/useMenuLayout).
//   · '편집'을 누르거나 칸을 길게 누르면 편집 모드(칸이 흔들림): 끌어서 옮기기 · 칸 위에 잠깐 두면 폴더에 넣기/새 폴더 ·
//     '−' 빼기(되돌리기) · 칸을 누르면 이름 · 넣을 곳 · 순서 · '+ 바로가기'로 앱 안 모든 화면(운영진은 라이브보드 등) 넣기 · 처음대로.
//   · '내 정보' 묶음에는 늘 '+ 추가' 칸 — 자주 가는 화면을 거기에 모은다.
//   · 고친 적이 없는 사람은 예전과 똑같이 보인다(시험 menuLayout.test.ts).
import { Fragment, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDmSummary } from "@/hooks/useDm";
import { useMenuLayout } from "@/hooks/useMenuLayout";
import { useStrategyBadge } from "@/services/strategyService";
import { useOfficeMe } from "@/services/officeService";
import { isManagerRole } from "@/lib/rankLabels";
import {
  MAX_FOLDER_ITEMS,
  ROOT,
  addEntry,
  addFolder,
  applyOrder,
  buildMenuView,
  containerOf,
  dissolveFolder,
  isLayoutFolder,
  menuCatalog,
  mergeEntries,
  moveEntry,
  newFolderId,
  removeEntry,
  renameEntry,
  resolveEntries,
  toLayout,
  type LayoutEntry,
  type MenuViewEntry,
  type MenuViewFolder,
  type MenuViewItem,
  type MenuViewer,
} from "@/lib/menuLayout";
import GlyphTile, { GlyphFolderTile } from "@/components/icons/GlyphTile";
import { useMenuDrag, type MenuDrop } from "@/components/home/menuEdit/useMenuDrag";
import {
  AddShortcutSheet,
  FolderEditSheet,
  ItemEditSheet,
  NEW_FOLDER,
  type FolderOption,
} from "@/components/home/menuEdit/MenuEditSheets";
import { cn } from "@/lib/utils";

// "153마인드셋"처럼 띄어쓰기 없는 긴 이름은 좁은 칸에서 "153마인드 / 셋"으로 끊긴다 —
// 앞의 "153" 뒤에 줄바꿈 자리(<wbr>)를 둬서 필요할 때만 "153 / 마인드셋"으로 끊기게.
const labelWithBreak = (label: string) =>
  /^153\S/.test(label) ? (
    <>
      153
      <wbr />
      {label.slice(3)}
    </>
  ) : (
    label
  );

const COLS = 4;
const ROOT_TILE = 56;
const PANEL_TILE = 50;
/** 내 정보 묶음 — 편집 모드가 아니어도 '+ 추가' 칸이 있다 (대표님: 내 정보에 바로가기를 모으기) */
const ME_FOLDER = "me";
const ADD_TILE = "__add__";
const LAYOUT_SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 40,
  mass: 0.7,
} as const;

const Badge = ({ n }: { n: number }) =>
  n > 0 ? (
    <span
      className="absolute -right-1.5 -top-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-micro font-bold leading-none text-white ring-2 ring-card"
      aria-label={`새 메시지 ${n}개`}
    >
      {n > 99 ? "99+" : n}
    </span>
  ) : null;

const AddTile = ({ size, label, onClick }: { size: number; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full min-w-0 flex-col items-center gap-2 rounded-2xl px-0.5 pb-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
  >
    <span
      className="flex items-center justify-center rounded-[16px] border-2 border-dashed border-border text-muted-foreground transition-transform duration-200 ease-out group-active:scale-[0.92]"
      style={{ width: size, height: size }}
    >
      <Plus className="h-6 w-6" strokeWidth={2.4} aria-hidden />
    </span>
    <span className="line-clamp-2 w-full text-center text-label font-semibold leading-[1.25] tracking-[-0.02em] text-muted-foreground">
      {label}
    </span>
  </button>
);

const ToolBtn = ({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-10 items-center gap-1.5 rounded-pill bg-muted px-3.5 text-label font-bold text-foreground transition-transform active:scale-95"
  >
    <Icon className="h-4 w-4" strokeWidth={2.4} aria-hidden />
    {label}
  </button>
);

/** 끌기 미리보기 순서대로 다시 늘어놓기 (미리보기에 없는 칸은 뒤에) */
function arrange<T extends { id: string }>(list: readonly T[], order: readonly string[] | null): T[] {
  if (!order) return [...list];
  const byId = new Map(list.map((e) => [e.id, e]));
  const out: T[] = [];
  for (const id of order) {
    const e = byId.get(id);
    if (e) {
      out.push(e);
      byId.delete(id);
    }
  }
  return [...out, ...byId.values()];
}

type SheetState = { kind: "item"; id: string } | { kind: "folder"; id: string } | { kind: "add"; dest: string } | null;

interface Props {
  /** card: 홈 첫 화면 카드(제목 포함) · sheet: 하단 '전체' 시트 안(그리드만) */
  variant?: "card" | "sheet";
  /** 메뉴를 누른 뒤 할 일 (시트 닫기 등) */
  onNavigate?: () => void;
}

const HomeMenuGrid = ({ variant = "card", onNavigate }: Props) => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { profile, role } = useAuth();
  const diet = !!profile?.diet_program_enabled;
  // 메시지 칸 오른쪽 위 — 안 읽은 대화 + 새 요청 (+ 본사: 처리 안 한 신고) (2026-09-30).
  // 메시지를 쓸 수 없는 계정(지점 회원 확인 전)에는 메시지를 빼 둔다 — 머리글 종이비행기와 같은 기준
  const { data: dm } = useDmSummary();
  const dmBadge = dm?.badge ?? 0;
  const dmOff = dm?.enabled === false;
  // 지점 회의실 칸 — 코치님(앱 권한이 '회원'이어도 서버가 코치로 본 사람) · 지점장 · 운영진만 (2026-10-19 · 10-29 전략 회의실 합침)
  const staff =
    dm?.kind === "coach" ||
    dm?.kind === "hq" ||
    role === "branch_manager" ||
    role === "super_admin" ||
    role === "admin";
  const { data: strategyBadge = 0 } = useStrategyBadge(staff);
  // 사무실이 켜진 지점(서버 office_me) — 회의가 열려 있으면 칸에 빨간 점 (2026-10-27)
  const { data: officeMe } = useOfficeMe(staff);
  const office = (officeMe?.offices.length ?? 0) > 0;
  const officeLive = !!officeMe?.offices.some((o) => o.meeting);

  const viewer: MenuViewer = useMemo(
    () => ({
      diet,
      staff,
      office,
      dm: !dmOff,
      manager: isManagerRole(role),
      admin: role === "admin" || role === "super_admin",
    }),
    [diet, staff, office, dmOff, role],
  );

  const { layout, save } = useMenuLayout();
  const entries = useMemo(() => resolveEntries(layout), [layout]);
  const customized = !!layout?.entries;
  const [editing, setEditing] = useState(false);
  const view = useMemo(() => buildMenuView(entries, viewer, { editing }), [entries, viewer, editing]);
  // 넣을 곳 목록 — 편집 모드 모양(빈 폴더 · 한 칸짜리 폴더도)으로
  const folders: FolderOption[] = useMemo(
    () =>
      buildMenuView(entries, viewer, { editing: true })
        .filter((e): e is MenuViewFolder => e.kind === "folder")
        .map((f) => ({ id: f.id, label: f.label })),
    [entries, viewer],
  );
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);

  const commit = (next: LayoutEntry[]) => save(toLayout(next));

  const orderOf = (container: string): string[] => {
    if (container === ROOT) return view.map((e) => e.id);
    const f = view.find((e): e is MenuViewFolder => e.kind === "folder" && e.id === container);
    return f ? f.items.map((i) => i.id) : [];
  };

  const labelOf = (id: string) => {
    for (const e of view) {
      if (e.id === id) return e.label;
      if (e.kind === "folder") {
        const it = e.items.find((i) => i.id === id);
        if (it) return it.label;
      }
    }
    return menuCatalog().map.get(id)?.label ?? "메뉴";
  };

  const onDrop = (d: MenuDrop) => {
    if (d.kind === "reorder") {
      commit(applyOrder(entries, d.container, d.order));
      return;
    }
    if (d.kind === "toRoot") {
      commit(moveEntry(entries, d.id, ROOT, d.beforeId));
      return;
    }
    // 칸 위에 놓기 — 폴더 위면 넣기, 메뉴 위면 새 폴더
    const targetIsFolder = entries.some((e) => isLayoutFolder(e) && e.folder === d.target);
    const r = mergeEntries(entries, d.id, d.target);
    if (!r.folder) return;
    if (targetIsFolder) {
      if (containerOf(r.entries, d.id) !== d.target) {
        toast.error(`폴더에는 ${MAX_FOLDER_ITEMS}개까지 넣을 수 있어요`);
        return;
      }
      commit(r.entries);
      toast.success(`‘${labelOf(d.id)}’ 칸을 ${labelOf(d.target)}에 넣었어요`);
      return;
    }
    commit(r.entries);
    setOpen(r.folder);
    const fid = r.folder;
    toast.success("새 폴더를 만들었어요", {
      action: {
        label: "이름 바꾸기",
        onClick: () => setSheet({ kind: "folder", id: fid }),
      },
    });
  };

  const drag = useMenuDrag({
    editing,
    onLongPress: () => setEditing(true),
    // 첫 화면 칸을 끌 때는 펼친 폴더를 닫는다 — 폴더에 넣을 때는 폴더 칸 위에 놓는다
    onStart: (_id, container) => {
      if (container === ROOT) setOpen(null);
    },
    orderOf,
    canMerge: (dragId, targetId) =>
      view.some((e) => e.id === dragId && e.kind === "item") && view.some((e) => e.id === targetId),
    onDrop,
  });

  const isActive = (path: string) => (path.includes("?") ? `${pathname}${search}` === path : pathname === path);

  const go = (path: string) => {
    navigate(path);
    setOpen(null);
    onNavigate?.();
  };
  // 칸 오른쪽 위 숫자 — 메시지: 안 읽은 대화 · 지점 회의실: 아직 확인 안 한 지시·전략(전략 회의), 없으면 회의 중 빨간 점 1
  const badgeOf = (path: string) =>
    path === "/messages"
      ? dmBadge
      : path === "/office"
        ? strategyBadge > 0
          ? strategyBadge
          : officeLive
            ? 1
            : 0
        : path === "/office?tab=strategy"
          ? strategyBadge
          : 0;

  const remove = (id: string) => {
    const prev = entries;
    const label = labelOf(id);
    commit(removeEntry(entries, id));
    if (open === id) setOpen(null);
    toast(`‘${label}’ 칸을 뺐어요`, {
      description: "‘+ 바로가기’에서 다시 넣을 수 있어요",
      action: { label: "되돌리기", onClick: () => commit(prev) },
    });
  };

  const reset = () => {
    const prev = entries;
    save({ v: 1, updatedAt: Date.now() });
    setOpen(null);
    toast("처음 메뉴로 돌렸어요", {
      action: { label: "되돌리기", onClick: () => commit(prev) },
    });
  };

  const makeFolder = () => {
    const id = newFolderId();
    const next = addFolder(entries, "새 폴더", id);
    if (next.length === entries.length) {
      toast.error("첫 화면이 꽉 찼어요");
      return;
    }
    commit(next);
    setOpen(id);
    setSheet({ kind: "folder", id });
  };

  const addShortcut = (id: string, dest: string): boolean => {
    const next = addEntry(entries, id, dest);
    if (containerOf(next, id) !== dest) {
      toast.error(dest === ROOT ? "첫 화면이 꽉 찼어요" : `폴더에는 ${MAX_FOLDER_ITEMS}개까지 넣을 수 있어요`);
      return false;
    }
    commit(next);
    const where = dest === ROOT ? "첫 화면" : (folders.find((f) => f.id === dest)?.label ?? "폴더");
    toast.success(`‘${menuCatalog().map.get(id)?.label ?? "메뉴"}’ 칸을 ${where}에 넣었어요`);
    return true;
  };

  const onItemClick = (it: MenuViewItem) => {
    if (drag.consumeClick()) return;
    if (editing) setSheet({ kind: "item", id: it.id });
    else go(it.path);
  };

  const onFolderClick = (f: MenuViewFolder) => {
    if (drag.consumeClick()) return;
    setOpen(open === f.id ? null : f.id);
  };

  // ── 칸 하나 ──
  const renderTile = (e: MenuViewEntry, container: string, idx: number, size: number) => {
    const isFolder = e.kind === "folder";
    const dragging = drag.view.dragId === e.id;
    const merge = drag.view.mergeTarget === e.id;
    const active = !isFolder && isActive(e.path);
    const inside = isFolder && e.items.some((m) => isActive(m.path));
    const isOpen = isFolder && open === e.id;
    const badge = isFolder ? e.items.reduce((n, m) => n + badgeOf(m.path), 0) : badgeOf(e.path);
    const strong = active || inside || isOpen;
    return (
      <motion.div
        key={`${container}:${e.id}`}
        ref={drag.registerSlot(e.id, container)}
        layout={editing ? "position" : false}
        transition={LAYOUT_SPRING}
        className={cn("relative flex min-w-0 justify-center", dragging && "opacity-0")}
      >
        <button
          type="button"
          onPointerDown={(ev) => drag.onPointerDown(ev, e.id, container)}
          onClick={() => (isFolder ? onFolderClick(e) : onItemClick(e))}
          onContextMenu={(ev) => ev.preventDefault()}
          aria-current={active ? "page" : undefined}
          aria-expanded={isFolder ? isOpen : undefined}
          aria-controls={isFolder ? `menu-folder-${e.id}` : undefined}
          aria-label={
            editing
              ? `${e.label} — 끌어서 옮기기, 누르면 ${isFolder ? "열기" : "고치기"}`
              : isFolder
                ? `${e.label} — ${e.items.map((m) => m.label).join(", ")}`
                : undefined
          }
          className={cn(
            "group flex w-full min-w-0 select-none flex-col items-center rounded-2xl px-0.5 pb-0.5 outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-primary/60",
            size === ROOT_TILE ? "gap-2" : "gap-1.5",
          )}
        >
          <span
            data-slot-icon
            className={cn(
              "relative rounded-[16px] transition-transform duration-200 ease-out",
              editing ? "touch-none" : "group-active:scale-[0.92]",
              merge && "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-card",
              isOpen && !merge && "ring-2 ring-primary/70 ring-offset-2 ring-offset-card",
            )}
          >
            <span
              className={cn("block", editing && !dragging && "animate-menu-jiggle motion-reduce:animate-none")}
              style={editing && idx % 2 === 1 ? { animationDelay: "-0.14s" } : undefined}
            >
              {isFolder ? (
                <GlyphFolderTile names={e.items.map((m) => m.glyph)} size={size} />
              ) : (
                <GlyphTile name={e.glyph} size={size} />
              )}
            </span>
            <Badge n={badge} />
          </span>
          <span
            className={cn(
              "line-clamp-2 w-full text-center text-label leading-[1.25] tracking-[-0.02em]",
              strong ? "font-bold text-primary" : "font-semibold text-foreground",
            )}
          >
            {labelWithBreak(e.label)}
          </span>
        </button>
        {editing && !dragging && (
          <button
            type="button"
            onClick={() => remove(e.id)}
            aria-label={`${e.label} 빼기`}
            className="absolute -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-foreground/85 text-background shadow-elev-1 transition-transform active:scale-90"
            style={{ left: `calc(50% - ${size / 2 + 8}px)` }}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          </button>
        )}
      </motion.div>
    );
  };

  // ── 첫 화면 칸 · 펼친 폴더 ──
  const rootList = arrange(view, drag.view.container === ROOT ? drag.view.order : null);
  const cells: Array<MenuViewEntry | typeof ADD_TILE> = editing ? [...rootList, ADD_TILE] : rootList;
  const rows: Array<typeof cells> = [];
  for (let i = 0; i < cells.length; i += COLS) rows.push(cells.slice(i, i + COLS));

  const panel = (folder: MenuViewFolder) => {
    const items = arrange(folder.items, drag.view.container === folder.id ? drag.view.order : null);
    const showAdd = editing || folder.id === ME_FOLDER;
    return (
      <motion.div
        key={`panel-${folder.id}`}
        id={`menu-folder-${folder.id}`}
        role="group"
        aria-label={folder.label}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="col-span-4 rounded-2xl bg-secondary/70 ring-1 ring-border/60"
      >
        {/* 폴더 칸을 이 상자 밖에 놓으면 첫 화면으로 — 상자 크기는 여기서 잰다 (AnimatePresence 바로 아래 칸에는 ref 를 두지 않는다) */}
        <div ref={drag.setPanel} className="px-2 pb-3 pt-2.5">
          <div className="mb-2.5 flex items-center justify-between gap-2 px-1.5">
            <p className="min-w-0 truncate text-label font-bold text-muted-foreground">{folder.label}</p>
            {editing && (
              <button
                type="button"
                onClick={() => setSheet({ kind: "folder", id: folder.id })}
                className="shrink-0 text-label font-bold text-primary"
              >
                이름 · 정리
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-1 gap-y-3">
            {items.map((m, i) => renderTile(m, folder.id, i, PANEL_TILE))}
            {showAdd && (
              <div className="flex min-w-0 justify-center">
                <AddTile size={PANEL_TILE} label="추가" onClick={() => setSheet({ kind: "add", dest: folder.id })} />
              </div>
            )}
          </div>
          {editing && items.length === 0 && (
            <p className="mt-3 px-1.5 text-label text-muted-foreground">
              ‘추가’로 넣거나, 메뉴를 끌어 이 폴더 칸 위에 놓아요
            </p>
          )}
        </div>
      </motion.div>
    );
  };

  const grid = (
    <div className="grid grid-cols-4 gap-x-1 gap-y-4" data-no-pull-refresh={editing ? "" : undefined}>
      {rows.map((row, ri) => {
        const folder = row.find((e): e is MenuViewFolder => e !== ADD_TILE && e.kind === "folder" && e.id === open);
        return (
          <Fragment key={`row-${ri}`}>
            {row.map((e, ci) =>
              e === ADD_TILE ? (
                <div key="add-root" className="flex min-w-0 justify-center">
                  <AddTile size={ROOT_TILE} label="바로가기" onClick={() => setSheet({ kind: "add", dest: ROOT })} />
                </div>
              ) : (
                renderTile(e, ROOT, ri * COLS + ci, ROOT_TILE)
              ),
            )}
            <AnimatePresence initial={false}>{folder && panel(folder)}</AnimatePresence>
          </Fragment>
        );
      })}
    </div>
  );

  // ── 편집 단추 · 편집 도구 ──
  const editBtn = (
    <button
      type="button"
      onClick={() => {
        setEditing((v) => !v);
        setSheet(null);
      }}
      aria-pressed={editing}
      className={cn(
        "h-9 shrink-0 rounded-pill px-4 text-label font-bold transition-transform active:scale-95",
        editing ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      )}
    >
      {editing ? "완료" : "편집"}
    </button>
  );

  // 편집 도구는 칸들 아래에 — 길게 눌러 편집 모드가 켜질 때 칸이 손가락 아래에서 밀려나지 않게
  const toolbar = editing ? (
    <div className="mt-5 px-1">
      <div className="flex flex-wrap gap-2">
        <ToolBtn icon={FolderPlus} label="새 폴더" onClick={makeFolder} />
        {customized && <ToolBtn icon={RotateCcw} label="처음대로" onClick={reset} />}
      </div>
      <p className="mt-2 text-label text-muted-foreground">끌어서 옮기고, 칸 위에 두면 폴더로</p>
    </div>
  ) : null;

  // ── 창 ──
  const itemTarget = (() => {
    if (sheet?.kind !== "item") return null;
    const container = containerOf(entries, sheet.id);
    if (!container) return null;
    const order = orderOf(container);
    const idx = order.indexOf(sheet.id);
    const it =
      container === ROOT
        ? view.find((e): e is MenuViewItem => e.kind === "item" && e.id === sheet.id)
        : view
            .find((e): e is MenuViewFolder => e.kind === "folder" && e.id === container)
            ?.items.find((i) => i.id === sheet.id);
    if (!it) return null;
    return {
      id: it.id,
      label: it.label,
      defaultLabel: it.defaultLabel,
      glyph: it.glyph,
      container,
      canPrev: idx > 0,
      canNext: idx >= 0 && idx < order.length - 1,
    };
  })();

  const folderTarget = (() => {
    if (sheet?.kind !== "folder") return null;
    const f = buildMenuView(entries, viewer, { editing: true }).find(
      (e): e is MenuViewFolder => e.kind === "folder" && e.id === sheet.id,
    );
    return f
      ? {
          id: f.id,
          label: f.label,
          glyphs: f.items.map((i) => i.glyph),
          count: f.items.length,
        }
      : null;
  })();

  const ghost = (() => {
    const id = drag.view.dragId;
    if (!id) return null;
    const c = drag.view.container;
    if (c === ROOT) return { e: view.find((e) => e.id === id) ?? null, size: ROOT_TILE };
    const f = view.find((e): e is MenuViewFolder => e.kind === "folder" && e.id === c);
    return { e: f?.items.find((i) => i.id === id) ?? null, size: PANEL_TILE };
  })();

  const overlays = (
    <>
      <ItemEditSheet
        target={itemTarget}
        folders={folders}
        onClose={() => setSheet(null)}
        onSave={(label, dest) => {
          if (!itemTarget) return;
          const id = itemTarget.id;
          let next = renameEntry(entries, id, label);
          if (dest === NEW_FOLDER) {
            const fid = newFolderId();
            next = moveEntry(addFolder(next, "새 폴더", fid), id, fid, null);
            if (containerOf(next, id) === fid) setOpen(fid);
          } else if (dest !== itemTarget.container) {
            next = moveEntry(next, id, dest, null);
            if (containerOf(next, id) !== dest) toast.error(`폴더에는 ${MAX_FOLDER_ITEMS}개까지 넣을 수 있어요`);
          }
          commit(next);
          setSheet(null);
        }}
        onRemove={() => {
          if (itemTarget) remove(itemTarget.id);
          setSheet(null);
        }}
        onMove={(delta) => {
          if (!itemTarget) return;
          const order = orderOf(itemTarget.container);
          const i = order.indexOf(itemTarget.id);
          const j = i + delta;
          if (i < 0 || j < 0 || j >= order.length) return;
          const next = [...order];
          [next[i], next[j]] = [next[j], next[i]];
          commit(applyOrder(entries, itemTarget.container, next));
        }}
      />
      <FolderEditSheet
        target={folderTarget}
        onClose={() => setSheet(null)}
        onSave={(label) => {
          if (folderTarget) commit(renameEntry(entries, folderTarget.id, label));
          setSheet(null);
        }}
        onDissolve={() => {
          if (folderTarget) commit(dissolveFolder(entries, folderTarget.id));
          setOpen(null);
          setSheet(null);
        }}
        onRemove={() => {
          if (folderTarget) remove(folderTarget.id);
          setSheet(null);
        }}
      />
      <AddShortcutSheet
        open={sheet?.kind === "add"}
        initialDest={sheet?.kind === "add" ? sheet.dest : ROOT}
        entries={entries}
        viewer={viewer}
        folders={folders}
        onClose={() => setSheet(null)}
        onAdd={addShortcut}
      />
      {ghost?.e &&
        drag.view.size &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={drag.ghostRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-[200] will-change-transform"
            style={{ width: drag.view.size.w }}
          >
            {/* 끄는 동안은 그림만 — 이름이 놓을 칸 이름과 겹치지 않게 (아이폰처럼) */}
            <div className="flex flex-col items-center">
              <span className="drop-shadow-xl">
                {ghost.e.kind === "folder" ? (
                  <GlyphFolderTile names={ghost.e.items.map((m) => m.glyph)} size={ghost.size} />
                ) : (
                  <GlyphTile name={ghost.e.glyph} size={ghost.size} />
                )}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );

  if (variant === "sheet") {
    return (
      <>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="min-w-0 text-label text-muted-foreground">
            {editing ? "메뉴 편집 중" : "길게 누르면 메뉴를 옮길 수 있어요"}
          </span>
          {editBtn}
        </div>
        {grid}
        {toolbar}
        {overlays}
      </>
    );
  }

  return (
    <section
      aria-label="전체 메뉴"
      data-tour="home-full-menu"
      className="rounded-3xl bg-card px-3 pb-[18px] pt-[18px] shadow-elev-1"
    >
      <div className="mb-4 flex items-center justify-between gap-3 px-2">
        <h2 className="text-body font-extrabold text-foreground">전체 메뉴</h2>
        {editBtn}
      </div>
      {grid}
      {toolbar}
      {overlays}
    </section>
  );
};

export default HomeMenuGrid;
