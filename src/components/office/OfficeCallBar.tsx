/**
 * 🏢 지점 회의실 2단계 — 음성 · 카메라 회의 막대 · 카메라 화면 (2026-10-27 대표님 "다음 단계 작업하자")
 *
 *   OfficeCallBar — 회의 화면(/office/room)에서 회의실 그림 바로 아래 한 줄. 상태는 lib/officeCall.
 *     · 안 들어갔을 때: 누가 음성 회의 중인지(Presence — 안 들어가도 보인다) + '음성 참여'.
 *       들어가면 듣기만 — 마이크는 꺼진 채(체육관 음악 · 소음이 섞이지 않게). 말할 때 '말하기'.
 *     · 들어갔을 때: 말하기(마이크) · 카메라 · (대표님 · 지점장) 모두 마이크 끄기 · 나가기.
 *       누가 말하는지 이름으로. 소리가 막히면(아이폰 등) '소리 켜기'.
 *   OfficeCallVideos — 카메라를 켠 사람 작은 화면(회의실 그림 왼쪽 아래), 누르면 크게. 내 화면은 거울.
 *   녹음 · 녹화 없음.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Headphones, Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type { OfficeCallMark } from "@/lib/officePresence";
import {
  attachOfficeVideo,
  joinOfficeCall,
  leaveOfficeCall,
  muteAllOfficeCall,
  officeCallNames,
  resumeOfficeSound,
  toggleOfficeCam,
  toggleOfficeMic,
  useOfficeCall,
} from "@/lib/officeCall";

interface BarProps {
  meetingId: string;
  topic: string | null;
  me: string | null;
  /** 음성 회의 중인 사람 (Presence) → 마이크 · 카메라 */
  calls: ReadonlyMap<string, OfficeCallMark>;
  /** user_id → 이름 */
  names: ReadonlyMap<string, string>;
  className?: string;
}

const ROUND = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95";

export const OfficeCallBar = ({ meetingId, topic, me, calls, names, className }: BarProps) => {
  const call = useOfficeCall();
  const nameOf = (uid: string) => names.get(uid) ?? call.peers.find((p) => p.uid === uid)?.name ?? "지도진";
  const inVoice = useMemo(() => [...calls.keys()].filter((u) => u !== me), [calls, me]);
  const wrap = cn("mx-auto flex w-full max-w-lg items-center gap-2 px-3 py-2", className);

  // ── 들어가 있을 때 ──
  if (call.status === "joined") {
    const speakers = [...call.speaking].filter((u) => u !== me).map(nameOf);
    const meTalking = call.mic && !!me && call.speaking.has(me);
    return (
      <div className={wrap} data-call="joined">
        <button
          type="button"
          onClick={() => void toggleOfficeMic()}
          aria-pressed={call.mic}
          aria-label={call.mic ? "마이크 끄기" : "말하기 — 마이크 켜기"}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-black transition-[transform,box-shadow] active:scale-95",
            call.mic ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
            meTalking && "ring-4 ring-primary/30",
          )}
        >
          {call.mic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {call.mic ? "마이크 켬" : "말하기"}
        </button>
        <button
          type="button"
          onClick={() => void toggleOfficeCam()}
          aria-pressed={call.cam}
          aria-label={call.cam ? "카메라 끄기" : "카메라 켜기"}
          className={cn(ROUND, call.cam ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}
        >
          {call.cam ? <Video className="h-[18px] w-[18px]" /> : <VideoOff className="h-[18px] w-[18px]" />}
        </button>
        {call.host && (
          <button
            type="button"
            onClick={() => void muteAllOfficeCall()}
            aria-label="모두 마이크 끄기"
            className={cn(ROUND, "flex-col gap-[2px] bg-secondary text-[9px] font-black leading-none text-foreground")}
          >
            <MicOff className="h-3.5 w-3.5" />
            모두
          </button>
        )}
        <div className="min-w-0 flex-1 pl-0.5">
          {call.soundBlocked ? (
            <button
              type="button"
              onClick={resumeOfficeSound}
              className="flex h-9 items-center gap-1 rounded-full bg-amber-100 px-3 text-[12.5px] font-black text-amber-900 active:scale-95 dark:bg-amber-500/20 dark:text-amber-200"
            >
              <Volume2 className="h-4 w-4" /> 소리 켜기
            </button>
          ) : (
            <>
              <p className="truncate text-[12.5px] font-black leading-tight text-foreground">
                {speakers.length ? `${officeCallNames(speakers)} 말하는 중` : `음성 ${call.peers.length + 1}명`}
              </p>
              <p
                className={cn(
                  "truncate text-[10.5px] font-semibold leading-tight",
                  call.notice ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                )}
              >
                {call.notice ??
                  (speakers.length
                    ? `음성 ${call.peers.length + 1}명`
                    : call.mic
                      ? "말 끝나면 마이크를 꺼요"
                      : "듣는 중 · 말할 땐 '말하기'")}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => void leaveOfficeCall()}
          aria-label="음성 회의 나가기"
          className={cn(ROUND, "bg-rose-500 text-white")}
        >
          <PhoneOff className="h-[18px] w-[18px]" />
        </button>
      </div>
    );
  }

  // ── 들어가는 중 ──
  if (call.status === "connecting") {
    return (
      <div className={wrap} data-call="connecting">
        <span className={cn(ROUND, "bg-secondary text-muted-foreground")}>
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-black leading-tight text-foreground">음성 회의에 들어가는 중…</p>
          <p className="truncate text-[10.5px] font-semibold leading-tight text-muted-foreground">마이크는 꺼진 채로 들어가요</p>
        </div>
        <button
          type="button"
          onClick={() => void leaveOfficeCall()}
          className="h-9 shrink-0 rounded-full bg-secondary px-3.5 text-[12.5px] font-black text-foreground active:scale-95"
        >
          취소
        </button>
      </div>
    );
  }

  // ── 안 들어갔을 때 ──
  return (
    <div className={wrap} data-call="idle">
      <span
        className={cn(
          ROUND,
          "relative",
          inVoice.length ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        <Headphones className="h-[18px] w-[18px]" />
        {inVoice.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[9.5px] font-black text-background">
            {inVoice.length}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black leading-tight text-foreground">
          {inVoice.length ? `${officeCallNames(inVoice.map(nameOf))} 음성 회의 중` : "음성 회의"}
        </p>
        <p
          className={cn(
            "truncate text-[10.5px] font-semibold leading-tight",
            call.notice ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
          )}
        >
          {call.notice ?? (call.notReady ? "음성 회의를 준비하고 있어요" : "들어가면 듣기만 — 말할 때만 마이크를 켜요")}
        </p>
      </div>
      <button
        type="button"
        // 누른 그 자리에서 불러야 아이폰이 소리를 켜 준다 (lib/officeCall)
        onClick={() => joinOfficeCall(meetingId, topic, me)}
        className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 text-[12.5px] font-black text-primary-foreground active:scale-95"
      >
        <Headphones className="h-4 w-4" /> 음성 참여
      </button>
    </div>
  );
};

/* ───────────── 카메라 화면 ───────────── */

const useAttachVideo = (uid: string) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? attachOfficeVideo(uid, el) : undefined;
  }, [uid]);
  return ref;
};

const VideoTile = ({
  uid,
  mine,
  name,
  speaking,
  onOpen,
}: {
  uid: string;
  mine: boolean;
  name: string;
  speaking: boolean;
  onOpen: () => void;
}) => {
  const ref = useAttachVideo(uid);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${mine ? "내" : name} 카메라 크게 보기`}
      className={cn(
        "relative aspect-[3/4] w-[58px] shrink-0 overflow-hidden rounded-xl bg-zinc-800 shadow-lg ring-2 transition-shadow active:scale-95",
        speaking ? "ring-primary" : "ring-white/90",
      )}
    >
      <video ref={ref} autoPlay playsInline muted className={cn("absolute inset-0 h-full w-full object-cover", mine && "-scale-x-100")} />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1 pb-[3px] pt-3 text-center text-[8.5px] font-black leading-none text-white">
        {mine ? "나" : name}
      </span>
    </button>
  );
};

const BigVideo = ({ uid, mine, name, onClose }: { uid: string; mine: boolean; name: string; onClose: () => void }) => {
  useModalDismiss(true, onClose);
  const ref = useAttachVideo(uid);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${mine ? "내" : name} 카메라`}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black"
      onClick={onClose}
    >
      <video ref={ref} autoPlay playsInline muted className={cn("h-full w-full object-contain", mine && "-scale-x-100")} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[calc(env(safe-area-inset-top)+12px)]">
        <span className="truncate text-[15px] font-black text-white">{mine ? "나" : name}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
};

/** 카메라를 켠 사람 — 회의실 그림 왼쪽 아래 (오른쪽 아래는 '사무실 전체' 버튼) */
export const OfficeCallVideos = ({ me, names }: { me: string | null; names: ReadonlyMap<string, string> }) => {
  const call = useOfficeCall();
  const [big, setBig] = useState<string | null>(null);
  if (call.status !== "joined" || call.videos.length === 0) return null;
  const nameOf = (uid: string) => names.get(uid) ?? call.peers.find((p) => p.uid === uid)?.name ?? "지도진";
  return (
    <>
      <div className="absolute bottom-2 left-2 z-[8] flex max-w-[calc(100%-124px)] gap-1.5 overflow-x-auto p-0.5 [scrollbar-width:none]">
        {call.videos.map((uid) => (
          <VideoTile
            key={uid}
            uid={uid}
            mine={uid === me}
            name={nameOf(uid)}
            speaking={call.speaking.has(uid)}
            onOpen={() => setBig(uid)}
          />
        ))}
      </div>
      {big && call.videos.includes(big) && (
        <BigVideo uid={big} mine={big === me} name={nameOf(big)} onClose={() => setBig(null)} />
      )}
    </>
  );
};
