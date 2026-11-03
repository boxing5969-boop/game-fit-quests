/**
 * 손가락 · 마우스 서명 칸 (2026-11-03 계약서) — 그린 부분만 잘라 투명 PNG(data URL)로 넘긴다.
 *   너무 짧은 선(점 몇 개)은 서명으로 치지 않는다. 그리는 동안 페이지가 움직이지 않게 touch-action: none.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { cn } from "@/lib/utils";

const INK = "#111827";
const LINE = 2.6;
/** 저장할 때 가장 긴 변 (px) */
const MAX_OUT = 640;

interface Props {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  label?: string;
  className?: string;
}

const OpsSignaturePad = ({ onChange, height = 168, label = "여기에 서명해 주세요", className }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const length = useRef(0);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const width = w.clientWidth;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    box.current = null;
    length.current = 0;
    setEmpty(true);
  }, [height]);

  useEffect(() => {
    setup();
    // 화면 폭이 바뀌면(돌리기) 새로 — 그리던 서명은 지운다
    let lastW = wrapRef.current?.clientWidth ?? 0;
    const ro = new ResizeObserver(() => {
      const w = wrapRef.current?.clientWidth ?? 0;
      if (Math.abs(w - lastW) > 2) {
        lastW = w;
        setup();
        onChange(null);
      }
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const grow = (p: { x: number; y: number }) => {
    const b = box.current;
    box.current = b
      ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) }
      : { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    grow(p);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, LINE / 2, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      const prev = last.current!;
      const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      length.current += Math.hypot(p.x - prev.x, p.y - prev.y);
      last.current = p;
      grow(p);
    }
    if (empty) setEmpty(false);
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const c = canvasRef.current;
    const b = box.current;
    if (!c || !b || length.current < 40) {
      onChange(null);
      return;
    }
    setEmpty(false);
    const dpr = c.width / c.clientWidth;
    const pad = 8;
    const sx = Math.max(0, Math.floor((b.x0 - pad) * dpr));
    const sy = Math.max(0, Math.floor((b.y0 - pad) * dpr));
    const sw = Math.min(c.width - sx, Math.ceil((b.x1 - b.x0 + pad * 2) * dpr));
    const sh = Math.min(c.height - sy, Math.ceil((b.y1 - b.y0 + pad * 2) * dpr));
    const k = Math.min(1, MAX_OUT / Math.max(sw, sh));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * k));
    out.height = Math.max(1, Math.round(sh * k));
    out.getContext("2d")?.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onChange(out.toDataURL("image/png"));
  };

  const clear = () => {
    setup();
    onChange(null);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-white">
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-body font-bold text-slate-400">
            {label}
          </span>
        )}
        <span className="pointer-events-none absolute bottom-8 left-5 right-5 border-b border-slate-300" />
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={finish}
          className="relative block touch-none select-none"
          aria-label={label}
          role="img"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="flex h-9 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
        >
          <Eraser className="h-4 w-4" /> 지우고 다시
        </button>
      </div>
    </div>
  );
};

export default OpsSignaturePad;
