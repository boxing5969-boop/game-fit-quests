/**
 * 🏢 지점 회의실 — 위에서 내려다본 사무실 한 장 (2026-10-27 · 보고서 '화면과 동작 설계')
 *
 *   · 앱에 들어와 있는 사람(Presence)의 캐릭터가 자기 책상 의자에 앉는다. 책상에는 늘 이름표(들어와 있으면 초록 점).
 *   · 새로 들어온 사람은 문에서 걸어 들어오고, 나가면 문으로 걸어 나간다(처음 그릴 때는 이미 앉아 있는 그대로).
 *   · 회의에 들어간 사람은 회의실 탁자로 옮겨 앉는다 — 들어온 순서대로 앞줄 가운데부터.
 *   · 자리 위 말풍선: 수업 중 · 자리 비움 (본인이 고른 상태).
 *   · 대화 말풍선(talk): 회의 채팅에 쓴 말이 그 사람 머리 위에 몇 초 떴다 사라진다 — 진짜 회의처럼 (2026-10-27 대표님).
 *     옆사람 말풍선과 겹치면 먼저 한 말이 비키거나 위로 올라가 한 줄이 된다(lib/officeTalkLayout.ts). 말할 때 캐릭터가 살짝 들썩인다.
 *   · 입력 중(typing): 회의 채팅에 쓰고 있는 사람 머리 옆에 '…'.
 *   · 음성 회의(voice, 2단계): 음성 회의 중인 사람 어깨에 헤드폰(듣는 중) · 마이크(마이크 켬) 표시,
 *     말하고 있으면 표시가 반짝이고 캐릭터가 말하듯 들썩인다(말하는 중은 음성방에 들어간 사람만 안다).
 *   · view: 그림에서 보이는 영역 — 회의 화면은 회의실만 크게(OFFICE_VIEW_MEETING).
 *   · 캐릭터나 이름표를 누르면 그 사람 카드(openMemberCard).
 *   좌표: lib/officeLayout.ts · 그림: public/assets/office/office-153.webp
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Headphones, Mic, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCharacterByHash, getCharacterImage } from "@/data/characterPresets";
import { openMemberCard } from "@/lib/appEvents";
import {
  OFFICE_ART,
  OFFICE_DESKS,
  OFFICE_DOOR,
  OFFICE_MEETING_LABEL,
  OFFICE_VIEW_ALL,
  deskSpot,
  meetingSpot,
  officeViewAspect,
  type OfficeSpot,
  type OfficeView,
} from "@/lib/officeLayout";
import { OFFICE_STATUS_LABEL, type OfficePerson, type OfficeState } from "@/services/officeService";
import { layoutTalk, sameTalkLayout, type TalkBox, type TalkPlace } from "@/lib/officeTalkLayout";
import type { OfficeCallMark } from "@/lib/officePresence";

const charImage = (p: Pick<OfficePerson, "style" | "user_id">) =>
  p.style ? getCharacterImage(p.style) : getCharacterByHash(p.user_id).image;

/** 말풍선 글자 — 말풍선 · 한 줄 높이 재는 그림자(probe)가 같이 쓴다 */
// 말풍선 글 — 예전 index.css 땜질(11px → 12px)로 그려지던 크기 그대로 12px (2026-10-28 땜질을 빼며 숫자로 옮김)
const TALK_TEXT_CLS = "whitespace-pre-wrap break-words text-left text-[12px] font-semibold leading-[1.35]";

const STATUS_CLS: Record<string, string> = {
  class: "bg-sky-500 text-white",
  away: "bg-zinc-500 text-white",
};

/** 머리 위 대화 말풍선 하나 */
export interface SceneTalk {
  id: string;
  text: string;
  kind: "chat" | "decision";
  /** 띄운 시각 (Date.now) — 최근 말이 머리 바로 위 자리를 먼저 차지한다 */
  at: number;
}

interface Placed {
  person: OfficePerson;
  spot: OfficeSpot;
  status: "class" | "away" | null;
  inMeeting: boolean;
}

interface Props {
  state: OfficeState;
  online: ReadonlySet<string>;
  /** 보이는 영역 (기본: 사무실 전체) */
  view?: OfficeView;
  /** user_id → 지금 머리 위에 띄울 말 */
  talk?: Readonly<Record<string, SceneTalk>>;
  /** 지금 회의 채팅에 쓰고 있는 사람 (머리 옆 '…') */
  typing?: ReadonlySet<string>;
  /** 회의실 유리벽 위 '회의 중 · 안건' 띠 (기본 켬) */
  meetingLabel?: boolean;
  /** 음성 회의 — 들어와 있는 사람(마이크 · 카메라) · 지금 말하는 사람 */
  voice?: { calls: ReadonlyMap<string, OfficeCallMark>; speaking?: ReadonlySet<string> };
  className?: string;
}

const OfficeScene = ({
  state,
  online,
  view = OFFICE_VIEW_ALL,
  talk,
  typing,
  meetingLabel = true,
  voice,
  className,
}: Props) => {
  const me = state.me;

  // 대표 책상은 한 자리 — 대표님 계정이 여럿이면 들어와 있는 쪽(내가 대표님이면 나)
  const boss = useMemo(() => {
    const hq = state.people.filter((p) => p.hq);
    return hq.find((p) => p.user_id === me && online.has(p.user_id)) ?? hq.find((p) => online.has(p.user_id)) ?? hq[0] ?? null;
  }, [state.people, online, me]);

  const placed = useMemo<Placed[]>(() => {
    const inRoom = new Map(
      (state.meeting?.attendees ?? []).filter((a) => a.in_room).map((a) => [a.user_id, a.first_joined_at] as const),
    );
    const visible = state.people.filter((p) => online.has(p.user_id) && (!p.hq || p.user_id === boss?.user_id));
    // 회의실 자리는 들어온 순서대로
    const meetingOrder = visible
      .filter((p) => inRoom.has(p.user_id))
      .sort((a, b) => (inRoom.get(a.user_id)! < inRoom.get(b.user_id)! ? -1 : 1))
      .map((p) => p.user_id);
    return visible.map((person) => {
      const mi = meetingOrder.indexOf(person.user_id);
      const inMeeting = mi >= 0;
      const spot = inMeeting ? meetingSpot(mi) : person.hq ? OFFICE_DESKS.boss : deskSpot(person.seat);
      const status = !inMeeting && (person.status === "class" || person.status === "away") ? person.status : null;
      return { person, spot, status, inMeeting };
    });
  }, [state.people, state.meeting, online, boss]);

  // 책상 이름표 — 자리 있는 사람 모두 (대표 책상은 대표님 한 분)
  const tags = useMemo(
    () =>
      state.people
        .filter((p) => (p.hq ? p.user_id === boss?.user_id : !!p.seat && !!OFFICE_DESKS[p.seat]))
        .map((p) => ({ person: p, desk: OFFICE_DESKS[p.hq ? "boss" : (p.seat as string)] })),
    [state.people, boss],
  );

  const meetingOpen = !!state.meeting;

  // ── 대화 말풍선 자리 — 보이는 창 너비 · 말풍선 크기를 재서 겹치지 않게 (lib/officeTalkLayout) ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setVw(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const boxEls = useRef(new Map<string, HTMLElement>());
  const probeRef = useRef<HTMLSpanElement>(null);
  const sizes = useRef(new Map<string, { w: number; h: number }>());
  /** 말풍선 id → 자리 (없음 = 아직 안 잼 → 숨겨 두고 잰다 · null = 자리가 없어 숨김) */
  const [places, setPlaces] = useState<Record<string, TalkPlace | null>>({});
  /** 바로 전 배치 — 처음 놓이는 말풍선은 미끄러지지 않고 제자리에 뜨게 */
  const prevPlaces = useRef<Record<string, TalkPlace | null>>({});
  /** 마지막으로 놓였던 자리 — 자리가 없어 숨길 때 그 자리에서 사라지게 */
  const lastPlace = useRef(new Map<string, TalkPlace>());

  // 말 · 자리 · 보이는 영역이 바뀌면 다시 잰다 (같은 배치면 상태를 건드리지 않아 멈춘다)
  useLayoutEffect(() => {
    const live = new Set<string>();
    const boxes: TalkBox[] = [];
    if (vw > 0 && talk) {
      const ww = (vw * 100) / view.w;
      const wh = ww / OFFICE_ART.ratio;
      for (const { person, spot } of placed) {
        const said = talk[person.user_id];
        if (!said) continue;
        live.add(said.id);
        const el = boxEls.current.get(said.id);
        // 제자리 모양일 때만 잰다 (위로 올라가 한 줄로 줄어 있으면 전에 잰 크기)
        const shown = places[said.id] ?? lastPlace.current.get(said.id);
        if (el && !shown?.lifted && el.offsetWidth > 0) {
          sizes.current.set(said.id, { w: el.offsetWidth, h: el.offsetHeight });
        }
        const size = sizes.current.get(said.id);
        if (!size) continue;
        boxes.push({
          id: said.id,
          ax: ((spot.x - view.x) / 100) * ww,
          ay: ((spot.y - view.y) / 100) * wh - (spot.w / 100) * ww * spot.clip,
          w: size.w,
          h: size.h,
          at: said.at,
        });
      }
    }
    for (const id of [...sizes.current.keys()]) if (!live.has(id)) sizes.current.delete(id);
    for (const id of [...lastPlace.current.keys()]) if (!live.has(id)) lastPlace.current.delete(id);
    const oneLine = probeRef.current?.offsetHeight || undefined;
    const next = layoutTalk(boxes, vw, oneLine);
    if (!sameTalkLayout(places, next)) {
      prevPlaces.current = places;
      setPlaces(next);
    }
  }, [vw, talk, places, placed, view.x, view.y, view.w]);

  return (
    // 보이는 창 — 그림(world)을 view 만큼 키워 옮겨 담는다
    <div
      ref={viewportRef}
      className={cn("relative w-full select-none overflow-hidden bg-[#eceae6]", className)}
      style={{ aspectRatio: `${officeViewAspect(view)}` }}
    >
      <div
        className="absolute left-0 top-0 transition-[transform,width] duration-500 ease-out"
        style={{
          width: `${10000 / view.w}%`,
          aspectRatio: `${OFFICE_ART.ratio}`,
          transform: `translate(-${view.x}%, -${view.y}%)`,
        }}
      >
        <img
          src={OFFICE_ART.src}
          srcSet={`${OFFICE_ART.srcSmall} 540w, ${OFFICE_ART.src} 1080w`}
          sizes="(max-width: 512px) 125vw, 640px"
          alt="153 지점 사무실 — 대표 책상, 코치 책상 9개, 회의실"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* 회의실 위 — 회의 중이면 안건 한 줄 */}
        {meetingOpen && meetingLabel && (
          <div
            className="absolute z-[3] max-w-[78%] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${OFFICE_MEETING_LABEL.x}%`, top: `${OFFICE_MEETING_LABEL.y}%` }}
          >
            <span className="flex items-center gap-1 truncate rounded-full bg-primary px-2 py-[3px] text-[9.5px] font-black text-primary-foreground shadow-md">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span className="truncate">회의 중 · {state.meeting!.title}</span>
            </span>
          </div>
        )}

        {/* 한 줄 말풍선 높이 재는 그림자 (보이지 않음) */}
        <span ref={probeRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 block rounded-[12px] px-2 py-[5px]">
          <span className={cn(TALK_TEXT_CLS, "line-clamp-1")}>말</span>
        </span>

        {/* 책상 이름표 */}
        {tags.map(({ person, desk }) => {
          const on = online.has(person.user_id);
          return (
            <button
              key={`tag-${person.user_id}`}
              type="button"
              onClick={() => openMemberCard(person.user_id)}
              className={cn(
                "absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 items-center gap-[2px] rounded-[4px] px-[3px] py-[1px] shadow-sm ring-1 ring-black/5 transition-opacity",
                person.hq ? "max-w-[26%]" : "max-w-[17%]",
                on ? "bg-white opacity-100" : "bg-white/85 opacity-60",
              )}
              style={{ left: `${desk.tag.x}%`, top: `${desk.tag.y}%` }}
              aria-label={`${person.name} ${person.title} — ${on ? "접속 중" : "자리에 없음"}`}
            >
              <span className={cn("h-[4px] w-[4px] shrink-0 rounded-full", on ? "bg-emerald-500" : "bg-zinc-300")} />
              <span className="truncate text-[7.5px] font-extrabold leading-[10px] tracking-[-0.02em] text-zinc-800">
                {person.hq ? `${person.name} 대표` : person.name}
              </span>
            </button>
          );
        })}

        {/* 캐릭터 — 들어오면 문에서 걸어와 앉고, 나가면 문으로 */}
        <AnimatePresence initial={false}>
          {placed.map(({ person, spot, status, inMeeting }) => {
            const mine = person.user_id === me;
            const said = talk?.[person.user_id];
            const place = said ? places[said.id] : undefined;
            if (said && place) lastPlace.current.set(said.id, place);
            const at = (said && (place ?? lastPlace.current.get(said.id))) || null;
            const typingNow = !mine && !status && !!typing?.has(person.user_id);
            const bob = said ? 2.4 + (said.at % 9) * 0.03 : 0;
            const vc = voice?.calls.get(person.user_id);
            const talking = !!vc && !!voice?.speaking?.has(person.user_id);
            return (
              <motion.button
                key={person.user_id}
                type="button"
                onClick={() => openMemberCard(person.user_id)}
                aria-label={`${person.name} ${person.title}${status ? ` · ${OFFICE_STATUS_LABEL[status]}` : ""}${
                  vc ? ` · 음성 회의 중${talking ? " · 말하는 중" : ""}` : ""
                }`}
                className={cn("absolute block", said ? "z-[6]" : typingNow || talking ? "z-[5]" : "z-[4]")}
                style={{ translateX: "-50%", translateY: "-100%" }}
                initial={{ left: `${OFFICE_DOOR.x}%`, top: `${OFFICE_DOOR.y}%`, width: `${spot.w}%`, opacity: 0 }}
                animate={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, opacity: 1 }}
                exit={{ left: `${OFFICE_DOOR.x}%`, top: `${OFFICE_DOOR.y}%`, opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeInOut" }}
              >
                {/* 대화 말풍선 — 머리 위 (겹치면 비키거나 위로 올라가 한 줄 + 이름표) */}
                <AnimatePresence>
                  {said && (
                    <span
                      key={said.id}
                      data-talk={place === null ? "hidden" : place?.lifted ? "lifted" : place ? "head" : "measuring"}
                      className="pointer-events-none absolute bottom-full left-1/2 z-[3] mb-[5px] block w-max max-w-[136px]"
                      style={{
                        transform: `translate(calc(-50% + ${at?.dx ?? 0}px), ${at?.dy ?? 0}px)`,
                        transition: prevPlaces.current[said.id] ? "transform 340ms cubic-bezier(.2,.8,.2,1)" : "none",
                      }}
                    >
                      <motion.span
                        className="block"
                        style={{ originY: 1 }}
                        initial={{ opacity: 0, y: 6, scale: 0.6 }}
                        animate={place ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.6 }}
                        exit={{ opacity: 0, y: -6, scale: 0.9 }}
                        transition={{ type: "spring", damping: 18, stiffness: 320 }}
                      >
                        <span
                          ref={(el) => {
                            if (el) boxEls.current.set(said.id, el);
                            else boxEls.current.delete(said.id);
                          }}
                          className={cn(
                            "relative block rounded-[12px] px-2 py-[5px] shadow-md ring-1",
                            said.kind === "decision"
                              ? "bg-amber-100 text-amber-950 ring-amber-400/70"
                              : mine
                                ? "bg-zinc-900 text-white ring-black/20"
                                : "bg-white text-zinc-900 ring-black/10",
                          )}
                        >
                          {/* 줄 자르기는 안쪽에서 (바깥 여백에 다음 줄이 비치지 않게) */}
                          <span className={cn(TALK_TEXT_CLS, at?.lifted ? "line-clamp-1" : "line-clamp-3")}>
                            {said.kind === "decision" && <Pin className="mr-0.5 inline h-[9px] w-[9px] -translate-y-px" />}
                            {said.text}
                          </span>
                        </span>
                        {at?.lifted ? (
                          // 위로 올라간 말 — 누가 한 말인지 이름표
                          <span
                            className={cn(
                              "absolute -top-[8px] left-[7px] max-w-[85%] truncate rounded-full px-[5px] text-[8px] font-black leading-[11px] shadow-sm ring-1 ring-white/80",
                              mine ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-white",
                            )}
                          >
                            {mine ? "나" : person.name}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "absolute top-full -ml-[5px] -mt-px h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent",
                              said.kind === "decision" ? "border-t-amber-100" : mine ? "border-t-zinc-900" : "border-t-white",
                            )}
                            style={{ left: `calc(50% + ${at?.tail ?? 0}px)` }}
                          />
                        )}
                      </motion.span>
                    </span>
                  )}
                </AnimatePresence>
                {/* 입력 중 — 머리 오른쪽 위 '…' */}
                <AnimatePresence>
                  {typingNow && (
                    <motion.span
                      key="typing"
                      className="pointer-events-none absolute left-[62%] top-[-4%] z-[3] flex items-center gap-[2px] rounded-full rounded-bl-[3px] bg-white px-[4px] py-[3px] shadow ring-1 ring-black/10"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.18 }}
                      aria-hidden
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="block h-[3px] w-[3px] rounded-full bg-zinc-500"
                          animate={{ opacity: [0.25, 1, 0.25], y: [0, -1.5, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                        />
                      ))}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* 상태 말풍선 — 머리 오른쪽 위 (줄 사이가 좁아 위로 띄우면 앞줄 이름표와 겹친다) */}
                {status && (
                  <span
                    className={cn(
                      "absolute left-[72%] top-[2%] z-[2] whitespace-nowrap rounded-full rounded-bl-[2px] px-[4px] py-[1px] text-[7.5px] font-black leading-[10px] shadow",
                      STATUS_CLS[status],
                    )}
                  >
                    {OFFICE_STATUS_LABEL[status]}
                  </span>
                )}
                {/* 캐릭터 — 아래쪽을 잘라 책상 · 탁자 뒤에 앉은 것처럼 */}
                <span
                  className={cn(
                    "relative block w-full overflow-hidden transition-[filter] duration-200",
                    talking
                      ? "drop-shadow-[0_0_7px_rgba(41,195,156,1)]"
                      : mine && "drop-shadow-[0_0_6px_rgba(23,185,144,0.85)]",
                  )}
                  style={{ aspectRatio: `${1 / spot.clip}` }}
                >
                  {/* 채팅으로 말할 때 살짝 들썩 (말마다 높이를 조금 달리해 다시 움직이게) · 음성으로 말하는 동안은 계속 */}
                  <motion.img
                    src={charImage(person)}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="absolute left-0 top-0 block aspect-square w-full object-contain"
                    animate={{ y: said ? [0, -bob, 0, -bob * 0.55, 0] : talking ? [0, -1.8, 0, -1, 0] : 0 }}
                    transition={
                      talking && !said
                        ? { duration: 0.62, ease: "easeInOut", repeat: Infinity }
                        : { duration: 0.75, ease: "easeOut" }
                    }
                  />
                </span>
                {/* 음성 회의 (책상 자리) — 어깨에 헤드폰(듣는 중) · 마이크(마이크 켬), 말하고 있으면 반짝.
                    회의실 탁자에서는 옆사람과 붙어 있어 발밑 이름표 안에 넣는다 (아래) */}
                {vc && !inMeeting && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -right-[4px] bottom-[4%] z-[3] flex h-[14px] w-[14px] items-center justify-center rounded-full shadow ring-1",
                      talking
                        ? "bg-primary text-primary-foreground ring-white"
                        : vc.mic
                          ? "bg-white text-primary ring-black/10"
                          : "bg-white text-zinc-500 ring-black/10",
                    )}
                  >
                    {talking && <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />}
                    {vc.mic ? (
                      <Mic className="relative h-[8px] w-[8px]" strokeWidth={3} />
                    ) : (
                      <Headphones className="relative h-[8px] w-[8px]" strokeWidth={3} />
                    )}
                  </span>
                )}
                {/* 회의실에서는 발밑에 이름 */}
                {inMeeting && (
                  <span
                    className={cn(
                      "absolute left-1/2 top-full z-[2] mt-[1px] flex max-w-[160%] -translate-x-1/2 items-center gap-[1.5px] whitespace-nowrap rounded-[4px] px-[3px] text-[7.5px] font-extrabold leading-[10px] shadow-sm transition-colors duration-200",
                      talking ? "bg-primary text-primary-foreground" : "bg-white/95 text-zinc-800",
                    )}
                  >
                    {/* 음성 회의 — 헤드폰(듣는 중) · 마이크(마이크 켬), 말하는 동안 이름표가 민트색 */}
                    {vc &&
                      (vc.mic ? (
                        <Mic className={cn("h-[7px] w-[7px] shrink-0", !talking && "text-primary")} strokeWidth={3} />
                      ) : (
                        <Headphones className="h-[7px] w-[7px] shrink-0 text-zinc-500" strokeWidth={3} />
                      ))}
                    <span className="truncate">{mine ? `${person.name} (나)` : person.name}</span>
                  </span>
                )}
                {mine && !inMeeting && (
                  <span className="absolute -left-[2px] top-0 z-[2] rounded-full bg-primary px-1 text-[7.5px] font-black leading-[12px] text-primary-foreground">
                    나
                  </span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OfficeScene;
