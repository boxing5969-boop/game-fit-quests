/**
 * 153운영본부 · 「일정」 — 시간축 보기 (일 · 3일 · 주) · 캘린더 3-2단계 (2026-11-13 대표님 「3-2 시작」)
 *
 *   06:00 ~ 24:00 · 15분 칸 · 겹치면 나란히 · 「근무」 시간표 = 바탕색 · 지금 = 빨간 선 · 맨 위 = 하루 종일 · 공휴일 · 회원 생일
 *   · 빈 칸을 누르면 그 15분부터 1시간짜리 새 일정
 *   · 끌어 옮기기(15분 단위) — 휴대폰은 0.45초 길게 누른 뒤(그 전에 움직이면 그냥 스크롤) · 마우스는 바로
 *     아래 끝(손잡이)을 길게 눌러 끌면 늘리기 · 반복 일정은 놓을 때 '이 일정만 / 이후 모두'를 묻는다(부모 OpsPlanTab)
 *   · 내 일정만 끈다(남의 일정 · 근무 시간은 못 끈다 — 서버도 '내 일정만 고칠 수 있어요')
 *   · 3-3 — 초대받은 일정(답 기다림 = 점선 · 누르면 답하기) · 겹쳐 그린 153 일정 · 정기 회의(누르면 보기) ·
 *     하루 보기 오른쪽 '팀' 줄(팀원 바쁜 시간 — 제목 없이 · 캘린더에서 '팀 바쁜 시간'을 켜면)
 *   계산(놓기 · 붙이기)은 src/lib/opsTimeGrid.ts, 하루 정리는 src/lib/opsPlans.ts dayItems.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type React from "react";

import { cn } from "@/lib/utils";
import { openMemberCard } from "@/lib/appEvents";
import { holidayOn } from "@/lib/krHolidays";
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";
import { toast } from "sonner";

import {
  BUSY_META,
  dayItems,
  isInvitedPlan,
  isRepeat,
  planColorHex,
  planMeta,
  planOpenable,
  planTitle,
  type DayItem,
  type OpsPlan,
  type PlanMember,
  type PlansWeek,
} from "@/lib/opsPlans";
import {
  GRID_END_MIN,
  GRID_HEIGHT_PX,
  GRID_START_MIN,
  HOUR_PX,
  MIN_PX,
  hmMin,
  hourLabel,
  layoutDay,
  minHm,
  minToY,
  movedTimes,
  resizedEnd,
  slotAt,
} from "@/lib/opsTimeGrid";

/** 하루 보기 오른쪽 '팀' 줄 — 팀원 바쁜 시간 (제목 없이) */
export interface TeamLaneItem {
  key: string;
  name: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
}

/** 팀 줄이 차지하는 폭 (하루 보기) */
const LANE_W = 0.3;

export interface PlanMove {
  plan: OpsPlan;
  /** 끌기 시작한 날(반복이면 그 회차) · 놓은 날 */
  from: string;
  to: string;
  start: string;
  end: string;
  kind: "move" | "resize";
}

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;
const MOUSE_START_PX = 4;
const EDGE_PX = 44;
const HANDLE_PX = 12;
const GUTTER = "w-10";

const kstNowMin = (): number => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
};

interface Ghost {
  plan: OpsPlan;
  from: string;
  date: string;
  start: number;
  end: number;
  kind: "move" | "resize";
}

type Press = {
  phase: "press" | "drag";
  plan: OpsPlan;
  from: string;
  kind: "move" | "resize";
  pointerId: number;
  mouse: boolean;
  x: number;
  y: number;
  scrollTop: number;
  startMin: number;
  endMin: number;
  timer: number | null;
};

const OpsPlanTimeGrid = ({
  data,
  dates,
  me,
  today,
  onPickDay,
  onAdd,
  onOpenPlan,
  onMove,
  lane,
}: {
  data: PlansWeek;
  dates: string[];
  me: Pick<PlanMember, "key" | "user_id">;
  today: string;
  onPickDay: (date: string) => void;
  onAdd: (date: string, time?: { start: string; end: string }) => void;
  onOpenPlan: (plan: OpsPlan, date: string | null) => void;
  onMove: (m: PlanMove) => void;
  /** 3-3 — 하루 보기의 팀원 바쁜 시간 (주지 않으면 줄이 없다) */
  lane?: TeamLaneItem[];
}) => {
  const scroller = useRef<HTMLDivElement | null>(null);
  const cols = useRef<Array<HTMLDivElement | null>>([]);
  const press = useRef<Press | null>(null);
  const justDragged = useRef(0);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [ghost, setGhostState] = useState<Ghost | null>(null);
  const ghostRef = useRef<Ghost | null>(null);
  const raf = useRef(0);
  const setGhost = useCallback((g: Ghost | null) => {
    ghostRef.current = g;
    setGhostState(g);
  }, []);
  const [nowMin, setNowMin] = useState(kstNowMin);
  const wide = dates.length === 1;
  const narrow = dates.length >= 7;
  const laneOn = wide && !!lane;
  const laneTimed = useMemo(() => (laneOn ? (lane ?? []).filter((l) => !l.allDay && l.start && l.end) : []), [laneOn, lane]);
  const laneAllDay = laneOn ? (lane ?? []).filter((l) => l.allDay) : [];
  const evW = laneOn ? 1 - LANE_W : 1;

  useEffect(() => {
    const t = window.setInterval(() => setNowMin(kstNowMin()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const perDay = useMemo(() => dates.map((d) => dayItems(data, me, d)), [data, me, dates]);

  // 처음 · 날짜를 바꾸면 — 오늘이 보이면 지금 1시간 전, 아니면 가장 이른 일정(없으면 9시)으로 스크롤
  const datesKey = dates.join(",");
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let target = 9 * 60;
    if (dates.includes(today)) target = Math.max(GRID_START_MIN, nowMin - 60);
    else {
      const starts = perDay.flat().filter((i) => !i.allDay && i.type === "plan").map((i) => hmMin(i.start) ?? 9 * 60);
      if (starts.length) target = Math.max(GRID_START_MIN, Math.min(...starts) - 30);
    }
    el.scrollTop = Math.max(0, minToY(target) - 8); // 맨 위 시각 글자가 반쯤 잘리지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey]);

  const canDrag = (p: OpsPlan) => p.mine && !p.masked;

  // ───────── 끌기 ─────────
  const targetAt = useCallback(
    (x: number, y: number): Ghost | null => {
      const s = press.current;
      const el = scroller.current;
      if (!s || !el) return null;
      let col = dates.indexOf(s.from);
      cols.current.forEach((c, i) => {
        const r = c?.getBoundingClientRect();
        if (r && x >= r.left && x < r.right) col = i;
      });
      const deltaMin = (y - s.y + (el.scrollTop - s.scrollTop)) / MIN_PX;
      if (s.kind === "resize") return { plan: s.plan, from: s.from, date: s.from, start: s.startMin, end: resizedEnd(s.startMin, s.endMin, deltaMin), kind: "resize" };
      const t = movedTimes(s.startMin, s.endMin, deltaMin);
      return { plan: s.plan, from: s.from, date: dates[Math.max(0, col)] ?? s.from, start: t.start, end: t.end, kind: "move" };
    },
    [dates],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const s = press.current;
      if (s?.timer) window.clearTimeout(s.timer);
      press.current = null;
      const g = ghostRef.current;
      setGhost(null);
      if (s?.phase === "drag") justDragged.current = Date.now();
      if (commit && g && s?.phase === "drag" && (g.date !== g.from || g.start !== s.startMin || g.end !== s.endMin)) {
        onMove({ plan: g.plan, from: g.from, to: g.date, start: minHm(g.start), end: minHm(g.end), kind: g.kind });
      }
    },
    [onMove, setGhost],
  );

  /** 끄는 동안만 — 위 · 아래 끝에 가면 저절로 스크롤 */
  const loop = useCallback(() => {
    const s = press.current;
    const el = scroller.current;
    const p = lastPointer.current;
    if (!s || s.phase !== "drag" || !el || !p) {
      raf.current = 0;
      return;
    }
    const r = el.getBoundingClientRect();
    const dy = p.y < r.top + EDGE_PX ? -8 : p.y > r.bottom - EDGE_PX ? 8 : 0;
    if (dy) {
      el.scrollTop += dy;
      setGhost(targetAt(p.x, p.y));
    }
    raf.current = window.requestAnimationFrame(loop);
  }, [setGhost, targetAt]);
  const startLoop = useCallback(() => {
    if (!raf.current) raf.current = window.requestAnimationFrame(loop);
  }, [loop]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = press.current;
      if (!s || e.pointerId !== s.pointerId) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      const dist = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      if (s.phase === "press") {
        if (s.mouse && dist > MOUSE_START_PX) {
          s.phase = "drag";
          setGhost(targetAt(e.clientX, e.clientY));
          startLoop();
        } else if (!s.mouse && dist > MOVE_CANCEL_PX) {
          endDrag(false); // 길게 누르기 전에 움직임 = 스크롤
        }
        return;
      }
      setGhost(targetAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      if (press.current && e.pointerId === press.current.pointerId) endDrag(true);
    };
    const cancel = (e: PointerEvent) => {
      if (press.current && e.pointerId === press.current.pointerId) endDrag(false);
    };
    const touch = (e: TouchEvent) => {
      if (press.current?.phase === "drag" && e.cancelable) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && press.current) endDrag(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    document.addEventListener("touchmove", touch, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      document.removeEventListener("touchmove", touch);
      window.removeEventListener("keydown", key);
      if (raf.current) window.cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [endDrag, setGhost, startLoop, targetAt]);

  const startPress = (e: React.PointerEvent, plan: OpsPlan, from: string, kind: "move" | "resize") => {
    if (!canDrag(plan) || plan.all_day || (e.pointerType === "mouse" && e.button !== 0)) return;
    const startMin = hmMin(plan.start_time) ?? GRID_START_MIN;
    const endMin = hmMin(plan.end_time) ?? startMin + 60;
    const s: Press = {
      phase: "press",
      plan,
      from,
      kind,
      pointerId: e.pointerId,
      mouse: e.pointerType === "mouse",
      x: e.clientX,
      y: e.clientY,
      scrollTop: scroller.current?.scrollTop ?? 0,
      startMin,
      endMin,
      timer: null,
    };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (!s.mouse) {
      s.timer = window.setTimeout(() => {
        const cur = press.current;
        if (!cur || cur.phase !== "press") return;
        cur.phase = "drag";
        cur.timer = null;
        navigator.vibrate?.(10);
        setGhost(targetAt(lastPointer.current?.x ?? cur.x, lastPointer.current?.y ?? cur.y));
        startLoop();
      }, LONG_PRESS_MS);
    }
    press.current = s;
    if (kind === "resize") e.stopPropagation();
  };

  const openItem = (plan: OpsPlan, date: string) => {
    if (Date.now() - justDragged.current < 350) return; // 방금 끈 손을 뗀 것
    if (!planOpenable(plan)) return;
    onOpenPlan(plan, isRepeat(plan) ? date : null);
  };

  const addAt = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (Date.now() - justDragged.current < 350) return;
    const r = e.currentTarget.getBoundingClientRect();
    onAdd(date, slotAt(e.clientY - r.top));
  };

  const hours = Array.from({ length: (GRID_END_MIN - GRID_START_MIN) / 60 }, (_, i) => 6 + i);
  const colTemplate: CSSProperties = { gridTemplateColumns: `2.5rem repeat(${dates.length}, minmax(0, 1fr))` };

  return (
    <div className="-mx-2 mt-3 select-none" style={{ WebkitTouchCallout: "none" }}>
      {/* 날짜 머리 */}
      <div className="grid" style={colTemplate}>
        <span aria-hidden />
        {dates.map((d) => {
          const wd = weekdayOf(d);
          const hol = holidayOn(d);
          const bdays = (data.birthdays ?? []).filter((b) => b.date === d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={`${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 ${OPS_WEEKDAY[wd]}요일${hol ? ` · ${hol}` : ""}${d === today ? " · 오늘" : ""}`}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-0.5 pb-1 active:bg-secondary/60"
            >
              <span className={cn("text-micro font-bold", hol || wd === 0 ? "text-rose-600" : "text-muted-foreground")}>{OPS_WEEKDAY[wd]}</span>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-label font-black tabular-nums",
                  d === today ? "bg-primary text-primary-foreground" : hol ? "text-rose-600" : "text-foreground",
                )}
              >
                {Number(d.slice(8, 10))}
              </span>
              {!narrow && hol && <span className="max-w-full truncate text-micro font-bold text-rose-600">{hol}</span>}
              {narrow && bdays.length > 0 && <span className="text-micro leading-none" aria-label={`생일 ${bdays.length}명`}>🎂</span>}
            </button>
          );
        })}
      </div>

      {/* 하루 종일 · 생일 */}
      <AllDayRow data={data} dates={dates} perDay={perDay} narrow={narrow} wide={wide} laneAllDay={laneAllDay} onOpen={openItem} onPickDay={onPickDay} />

      {/* 시간축 */}
      <div
        ref={scroller}
        className="relative overflow-y-auto border-t border-border"
        style={{ maxHeight: "min(560px, 68vh)" }}
        aria-label="시간축 — 빈 칸을 누르면 새 일정, 일정을 길게 눌러 끌면 옮겨요"
      >
        <div className="grid" style={{ ...colTemplate, height: GRID_HEIGHT_PX }}>
          {/* 시각 */}
          <div className="relative">
            {hours.map((h, i) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-micro tabular-nums text-muted-foreground" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : hourLabel(h)}
              </span>
            ))}
          </div>
          {dates.map((d, ci) => {
            const items = perDay[ci];
            const shifts = items.filter((i): i is Extract<DayItem, { type: "shift" }> => i.type === "shift");
            const timed = items.filter((i): i is Extract<DayItem, { type: "plan" }> => i.type === "plan" && !i.allDay);
            const placed = layoutDay(timed, (i) => ({ id: i.id, start: i.start ?? "06:00", end: i.end ?? "07:00" }));
            const lanePlaced = laneOn ? layoutDay(laneTimed, (l) => ({ id: `${l.key}:${l.start}`, start: l.start ?? "06:00", end: l.end ?? "07:00" })) : [];
            const isToday = d === today;
            return (
              <div
                key={d}
                ref={(el) => {
                  cols.current[ci] = el;
                }}
                className={cn("relative border-l border-border", isToday && "bg-primary/[0.03]")}
                onClick={(e) => addAt(e, d)}
              >
                {/* 시각 줄 */}
                {hours.map((h, i) => (
                  <span key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: i * HOUR_PX }} aria-hidden />
                ))}
                {/* 근무 시간 = 바탕색 */}
                {shifts.map((s) => {
                  const a = Math.max(hmMin(s.start) ?? 0, GRID_START_MIN);
                  const b = Math.min(hmMin(s.end) ?? 0, GRID_END_MIN);
                  if (b <= a) return null;
                  return (
                    <span
                      key={s.id}
                      className="pointer-events-none absolute inset-x-0 border-l-2 border-primary/40 bg-primary/[0.08]"
                      style={{ top: minToY(a), height: (b - a) * MIN_PX }}
                      aria-hidden
                    >
                      {wide && <span className="ml-1 text-micro font-bold text-primary/80">근무</span>}
                    </span>
                  );
                })}
                {/* 일정 */}
                {placed.map((p) => {
                  const plan = p.item.plan;
                  const hex = planColorHex(plan.color);
                  const dragging = ghost?.plan.id === plan.id && ghost.from === d;
                  const title = planTitle(plan);
                  const tall = p.height >= 34;
                  const invited = isInvitedPlan(plan);
                  // 답 기다림 초대 = 점선 · 바탕 없이 (참석 · 아마는 보통 칸)
                  const pending = invited && !plan.my_response;
                  const style: CSSProperties = {
                    top: p.top,
                    height: p.height,
                    left: `calc(${(p.col / p.cols) * evW * 100}% + 1px)`,
                    width: `calc(${(evW * 100) / p.cols}% - 2px)`,
                    ...(hex ? { backgroundColor: pending ? "transparent" : `${hex}26`, borderLeftColor: hex } : {}),
                  };
                  return (
                    <div
                      key={`${plan.id}:${d}`}
                      role="button"
                      tabIndex={planOpenable(plan) ? 0 : -1}
                      aria-label={`${invited ? "초대 · " : ""}${plan.focus ? "집중 시간 · " : ""}${title} ${p.item.start}~${p.item.end}${plan.location ? ` · ${plan.location}` : ""}`}
                      onPointerDown={(e) => startPress(e, plan, d, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        openItem(plan, d);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && planOpenable(plan)) onOpenPlan(plan, isRepeat(plan) ? d : null);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-[3px] py-0.5 text-left",
                        narrow ? "px-0.5" : "px-1",
                        !hex && planMeta(plan).chip,
                        !hex && "border-l-current",
                        pending && "border border-dashed border-current !bg-card",
                        dragging && "opacity-40",
                        canDrag(plan) && "cursor-grab",
                      )}
                      style={style}
                    >
                      {/* 주 보기 칸은 글자 3개 남짓 — '저…' 대신 줄을 바꿔 보이는 만큼 */}
                      <p className={cn(narrow ? "break-all" : "truncate", "text-micro font-black leading-tight", hex && "text-foreground")}>{title}</p>
                      {tall && !narrow && (
                        <p className={cn("truncate text-micro leading-tight opacity-80", hex && "text-foreground")}>
                          {p.item.start}~{p.item.end}
                          {plan.focus ? " · 집중" : ""}
                          {invited && wide ? ` · ${plan.owner_name ?? "팀원"}님 초대` : plan.location && wide ? ` · ${plan.location}` : ""}
                        </p>
                      )}
                      {p.early && <p className="truncate text-micro leading-tight opacity-80">이른 일정</p>}
                      {canDrag(plan) && p.height >= 34 && (
                        <span
                          className="absolute inset-x-0 bottom-0 flex cursor-ns-resize justify-center"
                          style={{ height: HANDLE_PX }}
                          onPointerDown={(e) => startPress(e, plan, d, "resize")}
                          aria-hidden
                        >
                          <span className="mt-1.5 h-[3px] w-4 rounded-full bg-current opacity-30" />
                        </span>
                      )}
                    </div>
                  );
                })}
                {/* 팀 줄 — 팀원 바쁜 시간 (하루 보기 오른쪽 · 제목 없이) */}
                {laneOn && (
                  <span
                    className="pointer-events-none absolute inset-y-0 border-l border-dashed border-border"
                    style={{ left: `${evW * 100}%` }}
                    aria-hidden
                  />
                )}
                {lanePlaced.map((lp) => (
                  <button
                    key={lp.item.key + lp.item.start}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast(`${lp.item.name} · 바쁨 ${lp.item.start}~${lp.item.end}`);
                    }}
                    aria-label={`${lp.item.name} 바쁨 ${lp.item.start}~${lp.item.end}`}
                    className={cn("absolute overflow-hidden rounded-md px-0.5 py-0.5 text-left", BUSY_META.chip)}
                    style={{
                      top: lp.top,
                      height: lp.height,
                      left: `calc(${(evW + (lp.col / lp.cols) * LANE_W) * 100}% + 1px)`,
                      width: `calc(${(LANE_W * 100) / lp.cols}% - 2px)`,
                    }}
                  >
                    {/* 나란히면 이름 두 글자(성 빼고) — 좁은 칸에서 한 글자씩 꺾이지 않게 */}
                    <span className="block break-all text-micro font-bold leading-tight">{lp.cols > 1 && lp.item.name.length > 2 ? lp.item.name.slice(-2) : lp.item.name}</span>
                  </button>
                ))}
                {/* 끄는 곳 미리 보기 */}
                {ghost && ghost.date === d && <GhostBox ghost={ghost} narrow={narrow} edge={ci === 0 ? "left" : ci === dates.length - 1 ? "right" : null} />}
                {/* 지금 */}
                {isToday && nowMin >= GRID_START_MIN && nowMin < GRID_END_MIN && (
                  <span className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-rose-500" style={{ top: minToY(nowMin) }} aria-hidden>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!perDay.some((items) => items.some((i) => i.type === "plan")) && (
        <p className="mt-2 px-2 text-label text-muted-foreground">빈 칸을 누르면 그 시간에 일정을 넣어요</p>
      )}
    </div>
  );
};

/** 끄는 곳 미리 보기 — 넓은 칸은 안에 시각, 주 보기(좁은 칸)는 위 말풍선(끝 칸은 안쪽으로 붙임) */
const GhostBox = ({ ghost, narrow, edge }: { ghost: Ghost; narrow: boolean; edge: "left" | "right" | null }) => {
  const a = Math.max(ghost.start, GRID_START_MIN);
  const b = Math.min(ghost.end, GRID_END_MIN);
  const text = ghost.kind === "resize" ? `~${minHm(ghost.end)}` : `${minHm(ghost.start)}~${minHm(ghost.end)}`;
  return (
    <div
      className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed border-foreground bg-card/90 shadow-elev-1"
      style={{ top: minToY(a), height: Math.max((b - a) * MIN_PX, 20) }}
      aria-live="polite"
    >
      {narrow ? (
        <span
          className={cn(
            "absolute -top-7 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-micro font-black tabular-nums text-background shadow-elev-1",
            edge === "left" ? "left-0" : edge === "right" ? "right-0" : "left-1/2 -translate-x-1/2",
          )}
        >
          {text}
        </span>
      ) : (
        <p className="truncate px-1 py-0.5 text-micro font-black tabular-nums text-foreground">{text}</p>
      )}
    </div>
  );
};

/** 맨 위 — 하루 종일 일정 · 쉰 날 · 생일 (칸마다 2줄까지 + '+n') */
const AllDayRow = ({
  data,
  dates,
  perDay,
  narrow,
  wide,
  laneAllDay,
  onOpen,
  onPickDay,
}: {
  data: PlansWeek;
  dates: string[];
  perDay: DayItem[][];
  narrow: boolean;
  /** 하루 보기 — 생일을 한 줄에 칩으로 */
  wide: boolean;
  /** 3-3 — 하루 종일 바쁜 팀원(하루 보기 · 팀 줄을 켰을 때) */
  laneAllDay: TeamLaneItem[];
  onOpen: (plan: OpsPlan, date: string) => void;
  onPickDay: (date: string) => void;
}) => {
  const rows = dates.map((d, i) => ({
    d,
    items: perDay[i].filter((it) => it.allDay),
    bdays: (data.birthdays ?? []).filter((b) => b.date === d),
  }));
  if (laneAllDay.length === 0 && rows.every((r) => r.items.length === 0 && (narrow || r.bdays.length === 0))) return null;
  return (
    <div className="grid border-t border-border py-1" style={{ gridTemplateColumns: `2.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
      <span className="self-center pr-1 text-right text-micro text-muted-foreground">종일</span>
      {rows.map(({ d, items, bdays }) => {
        const shown = items.slice(0, 2);
        const more = items.length - shown.length;
        return (
          <div key={d} className="min-w-0 space-y-0.5 border-l border-border px-0.5">
            {shown.map((it) => {
              const plan = it.type === "plan" ? it.plan : null;
              const label = plan ? planTitle(plan) : "쉰 날";
              const hex = plan ? planColorHex(plan.color) : null;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => (plan ? onOpen(plan, d) : onPickDay(d))}
                  className={cn(
                    "block w-full truncate rounded px-1 text-left text-micro font-bold leading-5",
                    !hex && (plan ? planMeta(plan).chip : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"),
                  )}
                  style={hex ? { backgroundColor: `${hex}26` } : undefined}
                >
                  {label}
                </button>
              );
            })}
            {more > 0 && (
              <button type="button" onClick={() => onPickDay(d)} className="block w-full text-left text-micro font-bold text-muted-foreground">
                +{more}
              </button>
            )}
            {wide && laneAllDay.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {laneAllDay.map((l) => (
                  <span key={l.key} className={cn("max-w-full truncate rounded-full px-2 text-micro font-bold leading-5", BUSY_META.chip)}>
                    바쁨 · {l.name}
                  </span>
                ))}
              </div>
            )}
            {!narrow && bdays.length > 0 && (
              <div className={wide ? "flex flex-wrap gap-1" : "space-y-0.5"}>
                {(wide ? bdays : bdays.slice(0, 3)).map((b) => (
                  <button
                    key={b.user_id}
                    type="button"
                    onClick={() => openMemberCard(b.user_id)}
                    className={cn(
                      wide ? "max-w-full rounded-full px-2" : "block w-full rounded px-1",
                      "truncate bg-amber-100 text-left text-micro font-bold leading-5 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
                    )}
                  >
                    🎂 {b.name}
                  </button>
                ))}
                {!wide && bdays.length > 3 && (
                  <button type="button" onClick={() => onPickDay(d)} className="block text-left text-micro font-bold text-muted-foreground">
                    생일 +{bdays.length - 3}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OpsPlanTimeGrid;
