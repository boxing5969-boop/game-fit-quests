// 🔊 영상으로 배우기 소리 (2026-11-16 대표님 「모든 영상 기존에 자연스러운 더빙 기본값으로 틀어주고 · 설명 듣기 들어가면 자동으로」)
//   · 카드 영상은 소리를 켠 채로 튼다(기본). 회원님이 끄면 이 창(탭)을 닫을 때까지 꺼 둔다 — 체육관에서 한 번 끄면 계속 조용히.
//   · 휴대폰이 소리 자동 재생을 막으면(아이폰 사파리) 소리 없이 틀고 「소리 켜기」를 크게 — 누르면 바로 소리.
//   · 영상에 목소리가 있는지는 영상이 알려 준다(아이폰 audioTracks · 크롬 디코딩 바이트 · 파이어폭스 mozHasAudio).
//   · 설명 듣기 목소리(미리 만든 파일)는 시트 하나를 같이 쓰는 <audio> 하나로 튼다 — 카드를 누른 순간 한 번 깨워 두면
//     아이폰도 그다음 자동 재생을 막지 않는다. 기기 오디오 설정('재생' 모드)은 바꾸지 않는다(회원님 음악 규칙).
const SOUND_KEY = "153learn:sound";

/** 카드 영상 · 설명 소리를 켤까 (기본 켬 · 이 창에서 끈 적이 있으면 끔) */
export function learnSoundOn(): boolean {
  try {
    return window.sessionStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setLearnSoundOn(on: boolean): void {
  try {
    window.sessionStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* 저장이 막힌 창 — 이번 화면에서만 */
  }
}

type MediaWithTracks = HTMLVideoElement & {
  audioTracks?: { length: number };
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
};

/**
 * 영상에 소리(목소리) 트랙이 있나 — true / false / null(아직 모름).
 * played = 영상이 0.6초 넘게 돈 뒤인가 (크롬은 디코딩한 바이트로만 알 수 있어서 조금 돌아야 한다).
 */
export function videoAudioState(v: HTMLVideoElement, played = false): boolean | null {
  const m = v as MediaWithTracks;
  if (m.readyState < 1) return null;
  if (m.audioTracks && typeof m.audioTracks.length === "number") return m.audioTracks.length > 0;
  if (typeof m.mozHasAudio === "boolean") return m.mozHasAudio;
  if (typeof m.webkitAudioDecodedByteCount === "number") {
    if (m.webkitAudioDecodedByteCount > 0) return true;
    return played ? false : null;
  }
  return null;
}

/** 세로가 아주 긴 영상이 화면을 다 덮지 않게 · 가로는 16:9 까지 */
export function clampVideoRatio(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 1;
  return Math.min(16 / 9, Math.max(0.8, r));
}

// ── 설명 목소리 파일 재생 ──
let narrator: HTMLAudioElement | null = null;
const SILENCE = "/voice/silence.mp3";

function narratorEl(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!narrator) {
    narrator = new Audio();
    narrator.preload = "auto";
  }
  return narrator;
}

/**
 * 누르는 순간(카드 타일을 눌렀을 때) 한 번 — 아이폰 사파리가 다음 소리를 막지 않게 깨워 둔다.
 * 소리를 꺼 둔 회원님이면 아무것도 안 한다(듣던 음악을 멈추지 않게).
 */
export function primeLearnAudio(): void {
  if (!learnSoundOn()) return;
  const a = narratorEl();
  if (a && a.paused && !a.src.includes("/voice/cards/")) {
    try {
      a.src = SILENCE;
      a.volume = 0;
      void a.play().catch(() => undefined);
    } catch {
      /* 무시 */
    }
  }
  // 휴대폰 목소리(파일이 없는 카드)도 — 빈 문장을 소리 없이 한 번 (iOS 는 첫 문장을 누른 순간에 말해야 한다)
  try {
    if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window && !window.speechSynthesis.speaking) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* 무시 */
  }
}

export type ClipEnd = "ended" | "failed" | "blocked" | "cancelled";
export interface ClipHandle {
  done: Promise<ClipEnd>;
  cancel: () => void;
}

/** 설명 목소리 파일 하나 — 끝 · 실패(파일 없음) · 막힘(자동 재생 막힘) · 멈춤 */
export function playVoiceClip(url: string): ClipHandle {
  const a = narratorEl();
  if (!a) return { done: Promise.resolve("failed"), cancel: () => undefined };
  let settle: (v: ClipEnd) => void = () => undefined;
  let settled = false;
  const done = new Promise<ClipEnd>((resolve) => {
    settle = (v) => {
      if (settled) return;
      settled = true;
      a.onended = null;
      a.onerror = null;
      window.clearTimeout(safety);
      resolve(v);
    };
  });
  // 파일이 멈춰 버려도 시트가 '설명 듣는 중'에 서 있지 않게 — 길이 + 3초, 모르면 90초
  let safety = window.setTimeout(() => settle("failed"), 90_000);
  a.onloadedmetadata = () => {
    if (Number.isFinite(a.duration) && a.duration > 0) {
      window.clearTimeout(safety);
      safety = window.setTimeout(() => settle("ended"), (a.duration + 3) * 1000);
    }
  };
  a.onended = () => settle("ended");
  a.onerror = () => settle("failed");
  try {
    a.pause();
    a.volume = 1;
    a.src = url;
    a.currentTime = 0;
    void a.play().catch((e: unknown) => {
      const name = (e as { name?: string } | null)?.name;
      settle(name === "NotAllowedError" ? "blocked" : name === "AbortError" ? "cancelled" : "failed");
    });
  } catch {
    settle("failed");
  }
  return {
    done,
    cancel: () => {
      try {
        a.pause();
      } catch {
        /* 무시 */
      }
      settle("cancelled");
    },
  };
}

/** 지금 나오는 설명 목소리 파일을 멈춘다 (시트를 닫을 때) */
export function stopVoiceClip(): void {
  try {
    narrator?.pause();
  } catch {
    /* 무시 */
  }
}
