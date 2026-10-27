/**
 * 🏢 지점 회의실 — 위에서 내려다본 사무실 한 장 (2026-10-27 · 보고서 '화면과 동작 설계')
 *
 *   · 앱에 들어와 있는 사람(Presence)의 캐릭터가 자기 책상 의자에 앉는다. 책상에는 늘 이름표(들어와 있으면 초록 점).
 *   · 새로 들어온 사람은 문에서 걸어 들어오고, 나가면 문으로 걸어 나간다(처음 그릴 때는 이미 앉아 있는 그대로).
 *   · 회의에 들어간 사람은 회의실 탁자로 옮겨 앉는다 — 들어온 순서대로 앞줄 가운데부터.
 *   · 자리 위 말풍선: 수업 중 · 자리 비움 · 회의 중 (본인이 고른 상태, 회의는 자동).
 *   · 캐릭터나 이름표를 누르면 그 사람 카드(openMemberCard).
 *   좌표: lib/officeLayout.ts · 그림: public/assets/office/office-153.webp
 */
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getCharacterByHash, getCharacterImage } from "@/data/characterPresets";
import { openMemberCard } from "@/lib/appEvents";
import {
  OFFICE_ART,
  OFFICE_DESKS,
  OFFICE_DOOR,
  OFFICE_MEETING_LABEL,
  deskSpot,
  meetingSpot,
  type OfficeSpot,
} from "@/lib/officeLayout";
import { OFFICE_STATUS_LABEL, type OfficePerson, type OfficeState } from "@/services/officeService";

const charImage = (p: Pick<OfficePerson, "style" | "user_id">) =>
  p.style ? getCharacterImage(p.style) : getCharacterByHash(p.user_id).image;

const BUBBLE_CLS: Record<string, string> = {
  class: "bg-sky-500 text-white",
  away: "bg-zinc-500 text-white",
  meeting: "bg-primary text-primary-foreground",
};

interface Placed {
  person: OfficePerson;
  spot: OfficeSpot;
  bubble: "class" | "away" | "meeting" | null;
  inMeeting: boolean;
}

interface Props {
  state: OfficeState;
  online: ReadonlySet<string>;
  className?: string;
}

const OfficeScene = ({ state, online, className }: Props) => {
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
      const bubble = inMeeting ? "meeting" : person.status === "class" || person.status === "away" ? person.status : null;
      return { person, spot, bubble, inMeeting };
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

  return (
    <div
      className={cn("relative w-full select-none overflow-hidden rounded-3xl bg-[#eceae6] shadow-elev-1", className)}
      style={{ aspectRatio: `${OFFICE_ART.ratio}` }}
    >
      <img
        src={OFFICE_ART.src}
        srcSet={`${OFFICE_ART.srcSmall} 540w, ${OFFICE_ART.src} 1080w`}
        sizes="(max-width: 512px) 100vw, 512px"
        alt="153 지점 사무실 — 대표 책상, 코치 책상 9개, 회의실"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 회의실 위 — 회의 중이면 안건 한 줄 */}
      {meetingOpen && (
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
        {placed.map(({ person, spot, bubble, inMeeting }) => {
          const mine = person.user_id === me;
          return (
            <motion.button
              key={person.user_id}
              type="button"
              onClick={() => openMemberCard(person.user_id)}
              aria-label={`${person.name} ${person.title}${bubble ? ` · ${OFFICE_STATUS_LABEL[bubble]}` : ""}`}
              className="absolute z-[4] block"
              style={{ translateX: "-50%", translateY: "-100%" }}
              initial={{ left: `${OFFICE_DOOR.x}%`, top: `${OFFICE_DOOR.y}%`, width: `${spot.w}%`, opacity: 0 }}
              animate={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, opacity: 1 }}
              exit={{ left: `${OFFICE_DOOR.x}%`, top: `${OFFICE_DOOR.y}%`, opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            >
              {/* 말풍선 — 머리 오른쪽 위 (줄 사이가 좁아 위로 띄우면 앞줄 이름표와 겹친다) */}
              {bubble && bubble !== "meeting" && (
                <span
                  className={cn(
                    "absolute left-[72%] top-[2%] z-[2] whitespace-nowrap rounded-full rounded-bl-[2px] px-[4px] py-[1px] text-[7.5px] font-black leading-[10px] shadow",
                    BUBBLE_CLS[bubble],
                  )}
                >
                  {OFFICE_STATUS_LABEL[bubble]}
                </span>
              )}
              {/* 캐릭터 — 아래쪽을 잘라 책상 · 탁자 뒤에 앉은 것처럼 */}
              <span
                className={cn("relative block w-full overflow-hidden", mine && "drop-shadow-[0_0_6px_rgba(23,185,144,0.85)]")}
                style={{ aspectRatio: `${1 / spot.clip}` }}
              >
                <img
                  src={charImage(person)}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="absolute left-0 top-0 block aspect-square w-full object-contain"
                />
              </span>
              {/* 회의실에서는 발밑에 이름 */}
              {inMeeting && (
                <span className="absolute left-1/2 top-full z-[2] mt-[1px] max-w-[160%] -translate-x-1/2 truncate whitespace-nowrap rounded-[4px] bg-white/95 px-[3px] text-[7.5px] font-extrabold leading-[10px] text-zinc-800 shadow-sm">
                  {person.name}
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
  );
};

export default OfficeScene;
