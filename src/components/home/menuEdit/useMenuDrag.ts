// ✋ 전체 메뉴 끌어 옮기기 — 아이폰 홈 화면처럼 (2026-11-08 대표님 「아이폰이나 안드로이드 처럼」)
//
//   · 보통 화면: 칸을 0.45초 길게 누르면 편집 모드가 되고, 손을 떼지 않고 움직이면 그대로 끈다.
//   · 편집 모드: 칸을 잠깐(0.16초) 누르고 움직이면 끈다(마우스는 바로). 그 전에 움직이면 그냥 스크롤.
//   · 다른 칸 가장자리에 잠깐 머물면 자리를 바꾸고, 다른 칸 한가운데에 0.4초 머물면 그 칸과 합친다
//     (폴더 위 = 폴더에 넣기 · 메뉴 위 = 새 폴더). 폴더 안 칸을 폴더 밖에 놓으면 첫 화면으로.
//   · 끄는 동안 화면 위 · 아래 끝에 가면 저절로 스크롤 · 당겨서 새로고침은 쉰다(body[data-menu-dragging]).
//   · Esc · 시스템 손짓(pointercancel)은 끌기 취소.
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

export const DRAG_ROOT = "root";

export type MenuDrop =
  | { kind: "reorder"; container: string; order: string[] }
  | { kind: "merge"; id: string; target: string }
  | { kind: "toRoot"; id: string; beforeId: string | null };

export interface MenuDragView {
  dragId: string | null;
  container: string | null;
  /** 끄는 그릇의 미리보기 순서 (null = 아직 그대로) */
  order: string[] | null;
  /** 합칠 칸 — 한가운데에 머물러 표시된 칸 */
  mergeTarget: string | null;
  size: { w: number; h: number } | null;
}

interface Options {
  editing: boolean;
  /** 보통 화면에서 길게 눌렀을 때 — 편집 모드로 */
  onLongPress: () => void;
  /** 끌기를 시작할 때 */
  onStart?: (id: string, container: string) => void;
  /** 이 그릇에 지금 보이는 칸 순서 */
  orderOf: (container: string) => string[];
  /** 끄는 칸을 이 칸 위에 놓아 합칠 수 있나 */
  canMerge: (dragId: string, targetId: string) => boolean;
  onDrop: (d: MenuDrop) => void;
}

const IDLE: MenuDragView = { dragId: null, container: null, order: null, mergeTarget: null, size: null };

const LONG_PRESS_MS = 450;
const EDIT_HOLD_MS = 160;
const MOVE_CANCEL_PX = 8;
const MOUSE_START_PX = 4;
const REORDER_DWELL_MS = 110;
const MERGE_DWELL_MS = 380;
/** 머문다 = 이만큼 안에서 멈춰 있다 — 지나가는 칸에서는 자리를 바꾸지 않는다(아이폰처럼 멈춰야 움직인다) */
const REST_PX = 6;
/** 자리를 바꾼 뒤 칸들이 움직이는 동안은 다시 재지 않는다 (흔들림 방지) */
const SETTLE_MS = 220;
const EDGE_PX = 70;
const BOTTOM_TAB_PX = 72;

interface Slot {
  id: string;
  container: string;
  el: HTMLElement;
}

interface DragState {
  phase: "pending" | "drag";
  pointerId: number;
  /** 바로 끌기 — 마우스이거나, 편집 중 그림(스크롤이 안 되는 손잡이)을 눌렀을 때 */
  quick: boolean;
  id: string;
  container: string;
  el: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offX: number;
  offY: number;
  timer: number | null;
  order: string[] | null;
  orig: string[] | null;
  hoverKey: string;
  hoverHit: { id: string; merge: boolean } | null;
  hoverAt: { x: number; y: number } | null;
  hoverTimer: number | null;
  pendingReorder: string | null;
  merge: string | null;
  lockUntil: number;
  raf: number | null;
  scroller: HTMLElement | null;
}

/** 손가락 아래 칸을 넘기는 스크롤 상자 — 없으면 페이지(null) */
function findScroller(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

export function useMenuDrag(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [view, setView] = useState<MenuDragView>(IDLE);
  const slots = useRef(new Map<string, Slot>());
  const slotRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const panelEl = useRef<HTMLElement | null>(null);
  const ghostEl = useRef<HTMLElement | null>(null);
  const suppressUntil = useRef(0);
  const st = useRef<DragState | null>(null);
  // 창 이벤트에 붙일 함수 — 한 번 만든 것을 계속 쓴다(붙이고 뗄 때 같은 함수여야 한다)
  const fns = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
    touch: (e: TouchEvent) => void;
    key: (e: KeyboardEvent) => void;
  } | null>(null);

  const registerSlot = useCallback((id: string, container: string) => {
    const k = `${container}\u0000${id}`;
    let fn = slotRefs.current.get(k);
    if (!fn) {
      fn = (el: HTMLElement | null) => {
        if (el) slots.current.set(k, { id, container, el });
        else slots.current.delete(k);
      };
      slotRefs.current.set(k, fn);
    }
    return fn;
  }, []);

  const setPanel = useCallback((el: HTMLElement | null) => {
    panelEl.current = el;
  }, []);

  const placeGhost = () => {
    const s = st.current;
    const g = ghostEl.current;
    if (!s || !g) return;
    g.style.transform = `translate3d(${s.x - s.offX}px, ${s.y - s.offY}px, 0) scale(1.08)`;
  };

  const ghostRef = useCallback((el: HTMLElement | null) => {
    ghostEl.current = el;
    if (el) placeGhost();
  }, []);

  const hitSlot = (x: number, y: number, only?: string): (Slot & { center: boolean }) | null => {
    for (const slot of slots.current.values()) {
      if (only && slot.container !== only) continue;
      if (!slot.el.isConnected) continue;
      const r = slot.el.getBoundingClientRect();
      if (!inside(r, x, y)) continue;
      const icon = slot.el.querySelector<HTMLElement>("[data-slot-icon]") ?? slot.el;
      const ir = icon.getBoundingClientRect();
      const center =
        Math.abs(x - (ir.left + ir.width / 2)) < ir.width * 0.3 &&
        Math.abs(y - (ir.top + ir.height / 2)) < ir.height * 0.3;
      return { ...slot, center };
    }
    return null;
  };

  const ensureOrder = (s: DragState) => {
    if (!s.order) {
      s.order = optsRef.current.orderOf(s.container);
      s.orig = [...s.order];
    }
    return s.order;
  };

  const reorderTo = (target: string) => {
    const s = st.current;
    if (!s || s.phase !== "drag") return;
    s.pendingReorder = null;
    const base = ensureOrder(s);
    const from = base.indexOf(s.id);
    const to = base.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...base];
    next.splice(from, 1);
    next.splice(to, 0, s.id);
    s.order = next;
    s.lockUntil = performance.now() + SETTLE_MS;
    s.hoverKey = "";
    s.hoverHit = null;
    setView((v) => ({ ...v, order: next }));
  };

  const clearHoverTimer = (s: DragState) => {
    if (s.hoverTimer) window.clearTimeout(s.hoverTimer);
    s.hoverTimer = null;
    s.pendingReorder = null;
  };

  /** 손가락이 멈춘 자리에서만 센다 — 시간이 다 되면 자리 바꾸기 또는 합칠 칸 표시 */
  const arm = (s: DragState) => {
    if (s.hoverTimer) window.clearTimeout(s.hoverTimer);
    s.hoverTimer = null;
    s.pendingReorder = null;
    const hit = s.hoverHit;
    if (!hit) return;
    s.hoverAt = { x: s.x, y: s.y };
    const target = hit.id;
    if (hit.merge) {
      s.hoverTimer = window.setTimeout(() => {
        const cur = st.current;
        if (!cur) return;
        cur.hoverTimer = null;
        cur.merge = target;
        setView((v) => ({ ...v, mergeTarget: target }));
        navigator.vibrate?.(8);
      }, MERGE_DWELL_MS);
    } else {
      s.pendingReorder = target;
      s.hoverTimer = window.setTimeout(() => reorderTo(target), REORDER_DWELL_MS);
    }
  };

  const hover = () => {
    const s = st.current;
    if (!s || s.phase !== "drag" || performance.now() < s.lockUntil) return;
    const hit = hitSlot(s.x, s.y);
    const key = hit ? `${hit.container}|${hit.id}|${hit.center ? "c" : "e"}` : "-";
    if (key === s.hoverKey) {
      // 같은 칸 위에서 계속 움직이는 중이면 다시 센다
      if (s.hoverTimer && s.hoverAt && Math.hypot(s.x - s.hoverAt.x, s.y - s.hoverAt.y) > REST_PX) arm(s);
      return;
    }
    s.hoverKey = key;
    clearHoverTimer(s);
    s.hoverHit = null;
    if (s.merge) {
      s.merge = null;
      setView((v) => ({ ...v, mergeTarget: null }));
    }
    if (!hit || hit.id === s.id || hit.container !== s.container) return;
    s.hoverHit = {
      id: hit.id,
      merge: hit.center && s.container === DRAG_ROOT && optsRef.current.canMerge(s.id, hit.id),
    };
    arm(s);
  };

  const tick = () => {
    const s = st.current;
    if (!s || s.phase !== "drag") return;
    let top = 0;
    let bottom = window.innerHeight - BOTTOM_TAB_PX;
    if (s.scroller) {
      const r = s.scroller.getBoundingClientRect();
      top = Math.max(r.top, 0);
      bottom = Math.min(r.bottom, window.innerHeight);
    }
    let dy = 0;
    if (s.y < top + EDGE_PX) dy = -Math.min(14, Math.ceil((top + EDGE_PX - s.y) / 5));
    else if (s.y > bottom - EDGE_PX) dy = Math.min(14, Math.ceil((s.y - (bottom - EDGE_PX)) / 5));
    if (dy) {
      if (s.scroller) s.scroller.scrollTop += dy;
      else window.scrollBy(0, dy);
    }
    hover();
    s.raf = requestAnimationFrame(tick);
  };

  const cleanup = () => {
    const s = st.current;
    if (!s) return;
    if (s.timer) window.clearTimeout(s.timer);
    clearHoverTimer(s);
    if (s.raf) cancelAnimationFrame(s.raf);
    const f = fns.current;
    if (f) {
      window.removeEventListener("pointermove", f.move);
      window.removeEventListener("pointerup", f.up);
      window.removeEventListener("pointercancel", f.cancel);
      document.removeEventListener("touchmove", f.touch);
      window.removeEventListener("keydown", f.key);
    }
    try {
      if (s.el.hasPointerCapture?.(s.pointerId)) s.el.releasePointerCapture(s.pointerId);
    } catch {
      /* 이미 풀림 */
    }
    const wasDrag = s.phase === "drag";
    st.current = null;
    if (wasDrag) {
      document.body.removeAttribute("data-menu-dragging");
      // 손을 뗀 자리에서 click 이 한 번 더 온다 — 칸을 여는 대신 무시
      suppressUntil.current = Date.now() + 400;
      setView(IDLE);
    }
  };

  const finish = (commit: boolean) => {
    const s = st.current;
    if (!s) return;
    let drop: MenuDrop | null = null;
    if (commit && s.phase === "drag") {
      // 놓기 직전에 머물던 자리 바꾸기는 마저 한다
      if (s.pendingReorder) reorderTo(s.pendingReorder);
      const panel = panelEl.current?.getBoundingClientRect();
      if (s.merge) drop = { kind: "merge", id: s.id, target: s.merge };
      else if (s.container !== DRAG_ROOT && panel && !inside(panel, s.x, s.y)) {
        const at = hitSlot(s.x, s.y, DRAG_ROOT);
        drop = { kind: "toRoot", id: s.id, beforeId: at?.id ?? null };
      } else if (s.order && s.orig && s.order.join("\n") !== s.orig.join("\n")) {
        drop = { kind: "reorder", container: s.container, order: s.order };
      }
    }
    cleanup();
    if (drop) optsRef.current.onDrop(drop);
  };

  const activate = () => {
    const s = st.current;
    if (!s || s.phase !== "pending") return;
    if (s.timer) window.clearTimeout(s.timer);
    s.timer = null;
    const o = optsRef.current;
    if (!o.editing) o.onLongPress();
    navigator.vibrate?.(12);
    const r = s.el.getBoundingClientRect();
    s.offX = s.startX - r.left;
    s.offY = s.startY - r.top;
    s.phase = "drag";
    s.scroller = findScroller(s.el);
    // 길게 눌러 편집 모드가 막 켜졌으면 칸 모양이 한 번 바뀐다 — 순서는 처음 움직일 때 읽는다
    if (o.editing) ensureOrder(s);
    try {
      s.el.setPointerCapture(s.pointerId);
    } catch {
      /* 지원 안 함 */
    }
    document.body.setAttribute("data-menu-dragging", "1");
    o.onStart?.(s.id, s.container);
    setView({
      dragId: s.id,
      container: s.container,
      order: s.order,
      mergeTarget: null,
      size: { w: r.width, h: r.height },
    });
    s.raf = requestAnimationFrame(tick);
  };

  if (!fns.current) {
    fns.current = {
      move: (e) => {
        const s = st.current;
        if (!s || e.pointerId !== s.pointerId) return;
        s.x = e.clientX;
        s.y = e.clientY;
        if (s.phase === "pending") {
          const d = Math.hypot(s.x - s.startX, s.y - s.startY);
          if (s.quick && optsRef.current.editing && d > MOUSE_START_PX) activate();
          else if (d > MOVE_CANCEL_PX) cleanup(); // 스크롤하려는 손짓
          return;
        }
        placeGhost();
        hover();
      },
      up: (e) => {
        const s = st.current;
        if (!s || e.pointerId !== s.pointerId) return;
        if (s.phase === "pending")
          cleanup(); // 짧게 누름 — 칸 열기는 click 이
        else finish(true);
      },
      cancel: (e) => {
        const s = st.current;
        if (!s || e.pointerId !== s.pointerId) return;
        finish(false);
      },
      touch: (e) => {
        // 끄는 동안에는 페이지가 같이 스크롤되지 않게
        if (st.current?.phase === "drag" && e.cancelable) e.preventDefault();
      },
      key: (e) => {
        if (e.key === "Escape") finish(false);
      },
    };
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>, id: string, container: string) => {
    if (st.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("[data-no-drag]")) return;
    const touch = e.pointerType !== "mouse";
    const editing = optsRef.current.editing;
    // 편집 중 그림 칸은 touch-action: none — 거기서는 스크롤이 안 되니 움직이면 바로 끈다
    const onHandle = e.target instanceof Element && !!e.target.closest("[data-slot-icon]");
    const s: DragState = {
      phase: "pending",
      pointerId: e.pointerId,
      quick: !touch || (editing && onHandle),
      id,
      container,
      el: e.currentTarget,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offX: 0,
      offY: 0,
      timer: null,
      order: null,
      orig: null,
      hoverKey: "",
      hoverHit: null,
      hoverAt: null,
      hoverTimer: null,
      pendingReorder: null,
      merge: null,
      lockUntil: 0,
      raf: null,
      scroller: null,
    };
    st.current = s;
    const delay = editing ? (touch ? EDIT_HOLD_MS : -1) : LONG_PRESS_MS;
    if (delay >= 0) s.timer = window.setTimeout(activate, delay);
    const f = fns.current!;
    window.addEventListener("pointermove", f.move);
    window.addEventListener("pointerup", f.up);
    window.addEventListener("pointercancel", f.cancel);
    document.addEventListener("touchmove", f.touch, { passive: false });
    window.addEventListener("keydown", f.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 끌기 · 길게 누름 바로 뒤의 click 이면 true (칸을 열지 않는다) */
  const consumeClick = useCallback(() => Date.now() < suppressUntil.current, []);

  useEffect(
    () => () => {
      cleanup();
      document.body.removeAttribute("data-menu-dragging");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { view, registerSlot, setPanel, ghostRef, onPointerDown, consumeClick };
}
