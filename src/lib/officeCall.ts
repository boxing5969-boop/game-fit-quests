/**
 * 🏢 지점 회의실 2단계 — 음성 · 카메라 회의 (Cloudflare RealtimeKit, 2026-10-27 대표님 "다음 단계 작업하자")
 *
 *   회의 화면(OfficeRoomPage)에서만 쓴다. SDK(@cloudflare/realtimekit, 큼)는 '음성 회의 들어가기'를 누를 때만 내려받는다.
 *   · 입장권: Edge Function office-call (서버가 매번 권한 확인 · 영상 서비스 열쇠는 서버에만).
 *   · 들어가면 마이크 · 카메라는 꺼진 채 — 체육관 음악 · 소음이 섞이지 않게. 본인이 '말하기' · 카메라를 눌러야 켜진다.
 *   · 다른 사람 소리는 <audio> 하나에 모아 튼다. 아이폰은 누른 순간에 소리를 켜 둬야 들려서 joinOfficeCall 은 누를 때 바로 부른다.
 *   · 말하는 사람: 소리 크기를 재서(Web Audio) speaking 에 담는다 — 나도 포함. 사무실 그림이 그 캐릭터를 빛낸다.
 *   · 내가 음성 회의 중인지 · 마이크 · 카메라는 Presence 표시에 같이 싣는다(officePresence setOfficeSelfMeta)
 *     → 음성방에 안 들어온 사람도 누가 음성 회의 중인지 본다.
 *   · 비용 지킴이(2026-10-27 대표님 "음성 회의 마무리") — 들어가 있는 1분마다 요금이 들어서, 화면이 꺼진 채 10분 ·
 *     음성방에 혼자 10분이면 저절로 나온다(안내는 화면에 돌아왔을 때 보인다). 다시 '음성 참여'를 누르면 바로 들어간다.
 *   녹음 · 녹화 없음.
 */
import { useSyncExternalStore } from "react";
import type RealtimeKitClient from "@cloudflare/realtimekit";
import { supabase } from "@/integrations/supabase/client";
import { setOfficeSelfMeta } from "@/lib/officePresence";

type Meeting = RealtimeKitClient;
// SDK 의 참가자 · 참가자 묶음 이벤트는 형식이 복잡해 여기서는 필요한 만큼만 본다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEmitter = { on: (event: string, fn: (...args: any[]) => void) => unknown };
interface RemotePeer {
  id: string;
  name: string;
  customParticipantId?: string;
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioTrack: MediaStreamTrack | null;
  flags?: Record<string, unknown>;
  registerVideoElement: (el: HTMLVideoElement) => void;
  deregisterVideoElement: (el?: HTMLVideoElement) => void;
}

export type OfficeCallStatus = "idle" | "connecting" | "joined";

export interface OfficeCallPeer {
  uid: string;
  name: string;
  mic: boolean;
  cam: boolean;
}

export interface OfficeCallState {
  status: OfficeCallStatus;
  meetingId: string | null;
  /** 내 user_id (음성방 안에서) */
  me: string | null;
  host: boolean;
  mic: boolean;
  cam: boolean;
  /** 음성방에 같이 있는 다른 사람 */
  peers: ReadonlyArray<OfficeCallPeer>;
  /** 지금 말하고 있는 사람 (나 포함) */
  speaking: ReadonlySet<string>;
  /** 카메라를 켠 사람 (내가 켰으면 맨 앞) */
  videos: ReadonlyArray<string>;
  /** 화면에 잠깐 보여 줄 안내 */
  notice: string | null;
  /** 아이폰 등에서 소리가 막혔을 때 — '소리 켜기'를 한 번 눌러야 한다 */
  soundBlocked: boolean;
  /** 서버에 영상 서비스 열쇠가 아직 없음 */
  notReady: boolean;
}

const INITIAL: OfficeCallState = Object.freeze({
  status: "idle",
  meetingId: null,
  me: null,
  host: false,
  mic: false,
  cam: false,
  peers: [],
  speaking: new Set<string>(),
  videos: [],
  notice: null,
  soundBlocked: false,
  notReady: false,
}) as OfficeCallState;

let state: OfficeCallState = INITIAL;
const listeners = new Set<() => void>();
const set = (patch: Partial<OfficeCallState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getOfficeCallState = () => state;

/** 이름 몇 개를 한 줄로 — '이재우 · 김민수 외 2명' */
export const officeCallNames = (names: string[]) =>
  names.length <= 2 ? names.join(" · ") : `${names.slice(0, 2).join(" · ")} 외 ${names.length - 2}명`;
export const useOfficeCall = (): OfficeCallState => useSyncExternalStore(subscribe, getOfficeCallState, () => INITIAL);

/* ───────────── 안쪽 ───────────── */

let meeting: Meeting | null = null;
let topic: string | null = null;
let audioEl: HTMLAudioElement | null = null;
let mix: MediaStream | null = null;
/** peerId → 지금 틀고 있는 소리 */
const playing = new Map<string, MediaStreamTrack>();
let ctx: AudioContext | null = null;
interface Meter {
  track: MediaStreamTrack;
  src: MediaStreamAudioSourceNode;
  an: AnalyserNode;
  buf: Uint8Array;
}
/** user_id → 소리 크기 재는 것 */
const meters = new Map<string, Meter>();
const lastLoud = new Map<string, number>();
let meterTimer: ReturnType<typeof setInterval> | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
/** 이 번호가 바뀌면 진행 중이던 연결은 버린다 (그새 나간 경우) */
let attempt = 0;

const notice = (text: string, ms = 4500) => {
  if (noticeTimer) clearTimeout(noticeTimer);
  set({ notice: text });
  noticeTimer = setTimeout(() => set({ notice: null }), ms);
};

/** 화면이 꺼져 있으면 안내를 남겨 두었다가, 다시 보일 때부터 잠깐 보여 준다 */
const noticeWhenSeen = (text: string, ms = 10_000) => {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") return notice(text, ms);
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = null;
  set({ notice: text });
  const onShow = () => {
    if (document.visibilityState === "hidden") return;
    document.removeEventListener("visibilitychange", onShow);
    if (state.notice === text) notice(text, ms);
  };
  document.addEventListener("visibilitychange", onShow);
};

/* ───────────── 비용 지킴이 — 화면이 꺼진 채 10분 · 음성방에 혼자 10분이면 나온다 ───────────── */

/** 음성 회의는 들어가 있는 1분마다 요금이 든다(RealtimeKit 참가자 분) — 이만큼 지나면 저절로 나온다 */
export const OFFICE_CALL_IDLE_MS = 10 * 60_000;

/** 나올 때인가 — 화면이 꺼진 지(hiddenSince) · 혼자 된 지(aloneSince) 10분이 넘었나. 0 은 '아님' */
export function officeCallIdleReason(
  t: { now: number; hiddenSince: number; aloneSince: number },
  limit = OFFICE_CALL_IDLE_MS,
): "hidden" | "alone" | null {
  if (t.hiddenSince && t.now - t.hiddenSince >= limit) return "hidden";
  if (t.aloneSince && t.now - t.aloneSince >= limit) return "alone";
  return null;
}

export const OFFICE_CALL_IDLE_NOTICE = {
  hidden: "화면이 10분 넘게 꺼져 있어 음성 회의에서 나왔어요 — 다시 들으려면 '음성 참여'",
  alone: "음성방에 10분 동안 혼자 있어서 나왔어요 — 다른 분이 오면 다시 '음성 참여'",
} as const;

let hiddenSince = 0;
let aloneSince = 0;
let guardTimer: ReturnType<typeof setInterval> | null = null;

const onGuardVisibility = () => {
  if (document.visibilityState === "hidden") hiddenSince ||= Date.now();
  else hiddenSince = 0; // 돌아오면 다시 센다 (돌아온 사람을 내보내지 않는다)
};

const checkGuard = () => {
  if (state.status !== "joined") return;
  const why = officeCallIdleReason({ now: Date.now(), hiddenSince, aloneSince });
  if (!why) return;
  void leaveOfficeCall().then(() => noticeWhenSeen(OFFICE_CALL_IDLE_NOTICE[why]));
};

const startGuard = () => {
  if (guardTimer || typeof document === "undefined") return;
  hiddenSince = document.visibilityState === "hidden" ? Date.now() : 0;
  document.addEventListener("visibilitychange", onGuardVisibility);
  // 숨은 탭은 타이머가 1분에 한 번쯤으로 느려진다 — 그래도 10~11분 안에 나온다
  guardTimer = setInterval(checkGuard, 20_000);
};

const stopGuard = () => {
  if (guardTimer) clearInterval(guardTimer);
  guardTimer = null;
  hiddenSince = 0;
  aloneSince = 0;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onGuardVisibility);
};

const uidOf = (p: Pick<RemotePeer, "customParticipantId" | "userId">) => p.customParticipantId || p.userId;

const remotePeers = (m: Meeting): RemotePeer[] =>
  (m.participants.joined.toArray() as unknown as RemotePeer[]).filter(
    (p) => !p.flags?.recorder && !p.flags?.hiddenParticipant && !p.flags?.hidden_participant,
  );

const publish = () => {
  setOfficeSelfMeta(topic, state.status === "joined" ? { call: true, mic: state.mic, cam: state.cam } : {});
};

const replay = () => {
  if (!audioEl || !mix) return;
  audioEl.srcObject = mix;
  void audioEl.play().then(
    () => state.soundBlocked && set({ soundBlocked: false }),
    () => set({ soundBlocked: true }),
  );
};

/** 다른 사람 소리 틀기 · 멈추기 + 소리 크기 재기 */
const syncAudio = (p: RemotePeer) => {
  const track = p.audioEnabled ? p.audioTrack : null;
  const old = playing.get(p.id);
  if (old && old !== track) {
    mix?.removeTrack(old);
    playing.delete(p.id);
  }
  if (track && !playing.has(p.id)) {
    mix?.addTrack(track);
    playing.set(p.id, track);
    replay();
  }
  meter(uidOf(p), track);
};

const dropAudio = (p: RemotePeer) => {
  const old = playing.get(p.id);
  if (old) mix?.removeTrack(old);
  playing.delete(p.id);
  meter(uidOf(p), null);
};

const meter = (uid: string, track: MediaStreamTrack | null) => {
  const old = meters.get(uid);
  if (old && old.track === track) return;
  if (old) {
    try {
      old.src.disconnect();
    } catch {
      /* 이미 끊김 */
    }
    meters.delete(uid);
  }
  if (!track || !ctx) return;
  try {
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    meters.set(uid, { track, src, an, buf: new Uint8Array(an.fftSize) });
  } catch {
    /* 이 기기는 소리 크기를 못 잼 — 말하는 표시만 없다 */
  }
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));

const startMeters = () => {
  if (meterTimer) return;
  meterTimer = setInterval(() => {
    const now = performance.now();
    const speaking = new Set<string>();
    meters.forEach((m, uid) => {
      m.an.getByteTimeDomainData(m.buf);
      let sum = 0;
      for (let i = 0; i < m.buf.length; i++) {
        const d = (m.buf[i] - 128) / 128;
        sum += d * d;
      }
      if (Math.sqrt(sum / m.buf.length) > 0.035) lastLoud.set(uid, now);
      if (now - (lastLoud.get(uid) ?? -1e9) < 500) speaking.add(uid);
    });
    if (!sameSet(speaking, state.speaking)) set({ speaking });
  }, 160);
};

const syncPeers = () => {
  const m = meeting;
  if (!m) return;
  const list = remotePeers(m);
  const peers = list.map((p) => ({ uid: uidOf(p), name: p.name, mic: !!p.audioEnabled, cam: !!p.videoEnabled }));
  const me = state.me;
  // 같은 사람이 기기 둘로 들어와도 화면은 하나
  const videos = [...new Set([...(m.self.videoEnabled && me ? [me] : []), ...peers.filter((p) => p.cam).map((p) => p.uid)])];
  // 비용 지킴이 — 다른 사람이 없으면 그때부터 센다
  aloneSince = peers.length === 0 ? aloneSince || Date.now() : 0;
  set({ peers, videos });
};

const cleanup = () => {
  attempt++;
  stopGuard();
  if (meterTimer) clearInterval(meterTimer);
  meterTimer = null;
  meters.forEach((m) => {
    try {
      m.src.disconnect();
    } catch {
      /* 무시 */
    }
  });
  meters.clear();
  lastLoud.clear();
  playing.clear();
  if (audioEl) {
    audioEl.pause();
    audioEl.srcObject = null;
  }
  audioEl = null;
  mix = null;
  if (ctx) void ctx.close().catch(() => undefined);
  ctx = null;
  meeting = null;
};

/** 함수가 돌려준 오류 이름 (not_configured · forbidden · …) */
const fnError = async (error: unknown): Promise<string> => {
  const res = (error as { context?: Response } | null)?.context;
  if (res && typeof res.json === "function") {
    try {
      const b = await res.clone().json();
      if (b?.error) return String(b.error);
    } catch {
      /* 몸통 없음 */
    }
  }
  return "failed";
};

const wire = (m: Meeting) => {
  const joined = m.participants.joined as unknown as AnyEmitter;
  joined.on("participantJoined", (p: RemotePeer) => {
    syncAudio(p);
    syncPeers();
  });
  joined.on("participantLeft", (p: RemotePeer) => {
    dropAudio(p);
    syncPeers();
  });
  joined.on("audioUpdate", (p: RemotePeer) => {
    syncAudio(p);
    syncPeers();
  });
  joined.on("videoUpdate", () => syncPeers());
  // 다시 이어질 때 목록을 비웠다가 다시 채운다 — 틀던 소리는 거두고 들어오는 대로 다시
  joined.on("participantsCleared", () => {
    playing.forEach((t) => mix?.removeTrack(t));
    playing.clear();
    [...meters.keys()].filter((u) => u !== state.me).forEach((u) => meter(u, null));
    syncPeers();
  });

  const self = m.self as unknown as AnyEmitter;
  self.on("roomJoined", () => {
    if (meeting !== m) return;
    remotePeers(m).forEach(syncAudio);
    syncPeers();
  });
  self.on("audioUpdate", ({ audioEnabled, audioTrack }: { audioEnabled: boolean; audioTrack: MediaStreamTrack }) => {
    set({ mic: !!audioEnabled });
    if (state.me) meter(state.me, audioEnabled ? audioTrack : null);
    publish();
  });
  self.on("videoUpdate", ({ videoEnabled }: { videoEnabled: boolean }) => {
    set({ cam: !!videoEnabled });
    syncPeers();
    publish();
  });
  self.on("mediaPermissionError", ({ kind }: { kind: string }) => {
    notice(kind === "video" ? "카메라를 쓸 수 있게 허용해 주세요" : "마이크를 쓸 수 있게 허용해 주세요", 6000);
  });
  self.on("roomLeft", ({ state: why }: { state?: string }) => {
    if (meeting !== m) return; // 내가 나간 것
    cleanup();
    set({ ...INITIAL });
    publish();
    if (why === "disconnected" || why === "failed") {
      void m.leave().catch(() => undefined);
      notice("음성 회의 연결이 끊겼어요 — '음성 참여'를 다시 눌러 주세요", 6000);
    } else notice("음성 회의가 끝났어요");
  });
};

const connect = async (meetingId: string, my: number) => {
  try {
    const { data, error } = await supabase.functions.invoke("office-call", { body: { meeting_id: meetingId } });
    if (my !== attempt) return;
    if (error || !data?.token) {
      const code = error ? await fnError(error) : "failed";
      cleanup();
      set({ ...INITIAL, notReady: code === "not_configured" });
      notice(
        code === "not_configured"
          ? "음성 회의를 준비하고 있어요 — 조금만 기다려 주세요"
          : code === "forbidden"
            ? "이 회의 음성방에는 들어갈 수 없어요"
            : "음성 회의에 연결하지 못했어요 — 잠시 후 다시 눌러 주세요",
        6000,
      );
      return;
    }
    const { default: Client } = await import("@cloudflare/realtimekit");
    if (my !== attempt) return;
    const m = await Client.init({ authToken: data.token as string, defaults: { audio: false, video: false } });
    if (my !== attempt) {
      void m.leave().catch(() => undefined);
      return;
    }
    meeting = m;
    const me = state.me || (m.self as unknown as { customParticipantId?: string }).customParticipantId || null;
    set({ me, host: !!data.host });
    wire(m);
    await m.join();
    if (my !== attempt) return;
    remotePeers(m).forEach(syncAudio);
    set({ status: "joined", mic: !!m.self.audioEnabled, cam: !!m.self.videoEnabled });
    syncPeers();
    startMeters();
    startGuard();
    publish();
  } catch (e) {
    if (my !== attempt) return;
    console.warn("[office-call] join failed", e);
    const m = meeting;
    cleanup();
    if (m) void m.leave().catch(() => undefined);
    set({ ...INITIAL });
    notice("음성 회의에 연결하지 못했어요 — 잠시 후 다시 눌러 주세요", 6000);
  }
};

/* ───────────── 밖에서 쓰는 것 ───────────── */

/**
 * 음성 회의 들어가기 — 버튼을 누른 그 자리에서 불러야 한다(아이폰이 소리를 켜 준다).
 * 마이크 · 카메라는 꺼진 채로 들어간다.
 */
export function joinOfficeCall(meetingId: string, officeTopic: string | null, myUid: string | null) {
  if (state.status !== "idle") return;
  const my = ++attempt;
  topic = officeTopic;
  // 누른 순간에 소리 켜 두기 (빈 소리 묶음에 다른 사람 소리를 나중에 더한다)
  mix = new MediaStream();
  audioEl = new Audio();
  audioEl.autoplay = true;
  audioEl.setAttribute("playsinline", "");
  audioEl.srcObject = mix;
  void audioEl.play().catch(() => undefined);
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AC ? new AC() : null;
    void ctx?.resume().catch(() => undefined);
  } catch {
    ctx = null;
  }
  set({ ...INITIAL, status: "connecting", meetingId, me: myUid });
  void connect(meetingId, my);
}

/** 음성 회의 나가기 (회의 화면을 떠날 때 · 회의가 끝났을 때도) */
export async function leaveOfficeCall() {
  const m = meeting;
  const wasIn = state.status !== "idle";
  cleanup();
  if (wasIn) {
    set({ ...INITIAL });
    publish();
  }
  if (m) await m.leave().catch(() => undefined);
}

/** 말하기 (마이크) 켜기 · 끄기 */
export async function toggleOfficeMic() {
  const m = meeting;
  if (!m || state.status !== "joined") return;
  try {
    if (m.self.audioEnabled) await m.self.disableAudio();
    else await m.self.enableAudio();
  } catch {
    notice("마이크를 켜지 못했어요 — 마이크를 쓸 수 있게 허용해 주세요", 6000);
  }
  if (meeting !== m) return;
  set({ mic: !!m.self.audioEnabled });
  if (state.me) meter(state.me, m.self.audioEnabled ? m.self.audioTrack : null);
  publish();
}

/** 카메라 켜기 · 끄기 */
export async function toggleOfficeCam() {
  const m = meeting;
  if (!m || state.status !== "joined") return;
  try {
    if (m.self.videoEnabled) await m.self.disableVideo();
    else await m.self.enableVideo();
  } catch {
    notice("카메라를 켜지 못했어요 — 카메라를 쓸 수 있게 허용해 주세요", 6000);
  }
  if (meeting !== m) return;
  set({ cam: !!m.self.videoEnabled });
  syncPeers();
  publish();
}

/** (대표님 · 지점장) 모두 마이크 끄기 — 본인이 다시 켤 수는 있다 */
export async function muteAllOfficeCall() {
  const m = meeting;
  if (!m || !state.host) return;
  try {
    await m.participants.disableAllAudio(true);
    notice("모두의 마이크를 껐어요");
  } catch {
    notice("마이크를 끄지 못했어요");
  }
}

/** 소리가 막혔을 때 (아이폰 등) — 사용자가 한 번 누르면 다시 튼다 */
export function resumeOfficeSound() {
  void ctx?.resume().catch(() => undefined);
  replay();
}

/** 회의를 끝낸 대표님 · 지점장 — 음성방도 닫는다(모두 내보내고 다시 못 들어오게) */
export function endOfficeCallForAll(meetingId: string) {
  void supabase.functions.invoke("office-call", { body: { meeting_id: meetingId, action: "end" } }).catch(() => undefined);
}

/**
 * 화면의 <video> 에 그 사람 카메라를 잇는다 — 돌려준 함수로 끊는다.
 * 나는 미리보기(다른 사람에게 보내는 것과 같은 화면, 거울).
 */
export function attachOfficeVideo(uid: string, el: HTMLVideoElement): () => void {
  const m = meeting;
  if (!m) return () => undefined;
  if (uid === state.me) {
    m.self.registerVideoElement(el, true);
    return () => {
      try {
        m.self.deregisterVideoElement(el, true);
      } catch {
        /* 이미 끊김 */
      }
    };
  }
  const p = remotePeers(m).find((x) => uidOf(x) === uid);
  if (!p) return () => undefined;
  p.registerVideoElement(el);
  return () => {
    try {
      p.deregisterVideoElement(el);
    } catch {
      /* 이미 끊김 */
    }
  };
}

/** 시험용 (개발 서버에서만) — 화면을 그려 보려고 상태를 직접 넣는다 */
export const __setOfficeCallStateForTest = import.meta.env.DEV
  ? (patch: Partial<OfficeCallState>) => set(patch)
  : undefined;
