// 얼굴 키오스크 (파일럿) — 선릉 기존 안드로이드 키오스크 브라우저에서 실행.
// 경로: /face-kiosk/:branchCode (라이브보드와 같은 공개 라우트 패턴)
//
// 원칙:
//  - 얼굴 사진을 서버로 보내지 않는다. 브라우저 안에서 128차원 특징값만 계산해 전송.
//  - 인식도 브라우저 온디바이스(face-api.js CDN) — 서버는 목록·출석 기록만.
//  - XP 미지급(QR 정책 유지). qr-checkin·브로제이 브리지 무수정 — 완전 병렬 경로.
//  - 등록은 동의 체크 필수. 파일럿 기간엔 코치·직원만 등록 권장.
//
// 속도 설계(2026-08-03):
//  - 고정 900ms 폴링 폐지 → 연속 루프(탐지가 끝나면 즉시 다음, 얼굴 없을 때만 짧게 쉼).
//  - 탐지 inputSize 320→224 (탐지 단계만 축소 — 특징값 품질·기존 등록 호환 무영향).
//  - 모델 로드 직후 워밍업 추론 1회 (첫 인식 셰이더 컴파일 지연 제거).
//  - 매칭 즉시 환영 화면+사운드 → 워커 verify·앱 체크인은 백그라운드로 보내고 도착 시 문구 갱신.
//    (출입 판단은 여전히 153OS 워커가 한다 — 화면 선표시는 UX일 뿐, 기록·판정 경로 불변)
//  - 랜드마크는 기존 68 풀 모델 유지 — 등록된 특징값과 정렬 방식을 맞추기 위함(임의 교체 금지).
//
// 출석 · 퇴장 버튼(2026-11-25 대표님 「얼굴인식후 출석누르면 출석이 되고 … 퇴장 버튼을 누르면 운동 시간 저장」 ·
//   「10초 자동출석으로 하자 · 퇴장 버튼을 누른사람만 모든 운동 시간 기록」) — 규칙은 lib/faceKioskFlow:
//  - 인식 → 153OS verify(판정 · access_logs) → 앱 state(오늘 출석했나) → 카드
//  - 출석 전: [출석] — 10초 안에 안 누르면 자동 출석. 다음 사람이 먼저 인식되면 앞사람 출석을 화면 없이 확정한다.
//    [출석] = 153OS /api/face/attend(출석부 '153 얼굴출석') + 앱 face-kiosk checkin(출석 · 라이브보드 · XP 트리거) — 한쪽만 남아도 완료.
//  - 출석한 회원: [출석][퇴장] — [퇴장] = 앱 face-kiosk checkout(누른 시각으로 운동 시간 · XP 차액). 안 누르면 닫히고 기본 운동 시간.
//  - 앱에서 운동 종료 · 시간 고침을 한 날은 기록만 보여 준다. '제가 아니에요'는 기록 없이 닫는다.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toSpokenKo } from "@/lib/spokenKo";
import { kstTime } from "@/lib/attendanceHistory";
import { KIOSK_DEFAULTS, KIOSK_SETTINGS_POLL_MS, kioskVoiceLine, normalizeKioskSettings, rematchMs, type KioskSettings, type KioskSettingsState } from "@/lib/kioskSettings";
import { KioskActionCard, KioskNoticeBar, KioskPausedScreen, type KioskCardView } from "@/components/kiosk/FaceKioskOverlays";
import {
  KIOSK_AUTO_ATTEND_MS, KIOSK_EXIT_IDLE_MS, KIOSK_FINISHED_MS, KIOSK_FLOW_TEXT, KIOSK_RESULT_MS,
  kioskAttendResult, kioskCardKind, kioskFinishedLine, kioskLeaveResult, kioskStayLine,
  parseKioskCheckout, parseKioskToday, remainingRatio, remainingSec, type KioskLeg, type KioskToday,
} from "@/lib/faceKioskFlow";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-kiosk`; // 앱측: 라이브보드 즉시 표시용
const OS_URL = "https://153-boxing-os-api.boxing5969.workers.dev/api/face";     // 153OS: 판단·등록·장부(FC-2)
const KEY_LS = "153_kiosk_key";
const SOUND_LS = "153_kiosk_sound";
/** 153OS 에 저장된 소리 값 중 마지막으로 기기에 맞춘 것(on · off) — 다시 켜도 기기 단추로 바꾼 소리를 덮지 않게(2026-11-03 검수) */
const SERVER_SOUND_LS = "153_kiosk_sound_server";
const CDN = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2";
// 앱(APK)·오프라인 대비: 같은 0.22.2 자산을 앱/사이트에 번들해 두고 그걸 먼저 쓴다.
// 번들이 없으면 기존 CDN 그대로 — 동작 변화 없음. 버전을 바꾸면 등록된 특징값이
// 깨지므로 반드시 0.22.2 동일 파일만 번들할 것(임의 교체 금지).
const LOCAL_ASSETS = "/vendor/face-api";
const IS_NATIVE_APP = typeof window !== "undefined"
  && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
// face-api 스크립트 주소 — 웹은 끝에 ?v= 를 붙인다(2026-11-25). 20:40 전에는 이 파일이 사이트에 없어 같은 주소로
// index.html 이 왔고(cache-control max-age=14400), 그걸 받은 폰은 4시간 동안 기억해 새로고침해도 「안 돼요」였다.
// 새 주소로 받으면 그 기억을 피한다. 설치형 앱은 번들 그대로(캐시 문제 없음).
const FACE_API_JS = "dist/face-api.min.js";
const faceApiScriptUrl = (base: string): string => `${base}/${FACE_API_JS}${IS_NATIVE_APP ? "" : "?v=0.22.2"}`;

// 번들 자산의 정확한 바이트 수(face-api 0.22.2 원본과 SHA256 동일 확인됨).
// 하나라도 다르면 받다가 잘린 것이고, 그게 "tensor should have N values but has M" 의 원인이다.
const ASSET_BYTES: Record<string, number> = {
  "dist/face-api.min.js": 663829,
  "weights/tiny_face_detector_model-weights_manifest.json": 2953,
  "weights/tiny_face_detector_model-shard1": 193321,
  "weights/face_landmark_68_model-weights_manifest.json": 7889,
  "weights/face_landmark_68_model-shard1": 356840,
  "weights/face_recognition_model-weights_manifest.json": 18303,
  "weights/face_recognition_model-shard1": 4194304,
  "weights/face_recognition_model-shard2": 2249728,
};

let assetBase: string | null = null;
const resolveAssetBase = async (): Promise<string> => {
  if (assetBase) return assetBase;
  // 설치형 앱은 자산이 APK 안에 있다 — 탐지 없이 바로 번들 사용(CDN 폴백 금지).
  if (IS_NATIVE_APP) { assetBase = LOCAL_ASSETS; return assetBase; }
  try {
    // HEAD 는 서버에 따라 본문 없이 애매하게 응답한다 → 실제 GET 으로 확인.
    const r = await fetch(`${LOCAL_ASSETS}/weights/tiny_face_detector_model-weights_manifest.json`);
    if (r.ok && (await r.text()).trimStart().startsWith("[")) { assetBase = LOCAL_ASSETS; return assetBase; }
  } catch { /* 번들 없음 → CDN */ }
  assetBase = CDN;
  return assetBase;
};

// 모델 로드가 실패했을 때 "어느 파일이 몇 바이트로 왔는지" 를 그대로 보여준다.
// 추측 대신 화면에 근거를 남기기 위한 것.
const diagnoseAssets = async (base: string): Promise<string> => {
  const bad: string[] = [];
  for (const [rel, want] of Object.entries(ASSET_BYTES)) {
    const name = rel.split("/").pop() || rel;
    try {
      const r = await fetch(rel === FACE_API_JS ? faceApiScriptUrl(base) : `${base}/${rel}`, { cache: "no-store" });
      if (!r.ok) { bad.push(`${name} HTTP${r.status}`); continue; }
      const got = (await r.arrayBuffer()).byteLength;
      if (got !== want) bad.push(`${name} ${got}/${want}B`);
    } catch { bad.push(`${name} 실패`); }
  }
  return bad.length ? bad.join(" · ") : "파일 크기는 모두 정상";
};
const MATCH_DIST = 0.5;          // face-api 권장 임계 (낮을수록 엄격)
// 같은 회원 재인식 무시 간격 = 153OS 출석 프로그램 설정 rematch_min (기본 5분) — rematchMs(kioskRef.current)
const DETECT_INPUT = 224;        // 탐지 해상도 (320→224: 키오스크는 얼굴이 크게 잡혀 충분)
const DETECT_SCORE = 0.45;
const IDLE_MS = 120;             // 얼굴 없을 때 다음 탐지까지 휴식 (CPU 보호)
const GREET_MS = 4500;           // 환영 오버레이 표시 시간

// 회원에게 보이는 문구는 "왜"가 아니라 "그래서 뭘 해야 하는지"만 말한다.
// 키오스크는 회원이 만지는 기기가 아니므로 "새로고침" 같은 안내는 무의미하다.
// 기술적 원인은 화면에 띄우지 않고, 모서리 3번 탭으로 직원만 본다.
const MSG_PREP = "잠시만요, 준비 중이에요";
const MSG_DOWN_TITLE = "지금은 얼굴 출석이 안 돼요";
const MSG_DOWN_SUB = "데스크에 말씀해주시면 도와드릴게요";

interface FaceProfile { user_id: string; name: string; embedding: number[] } // user_id = 153OS member_id

// 인식 뒤 카드 (2026-11-25 출석 · 퇴장 버튼):
//   checking(이용권 확인 중) → deny(거절) | enter([출석] · 10초 뒤 자동) | exit([출석][퇴장] · 안 누르면 닫힘) | finished(앱에서 끝낸 날)
//   → result(출석 완료 · 운동 시간 저장 · 실패)
type CardKind = "checking" | "deny" | "enter" | "exit" | "finished" | "result";

interface Greet {
  seq: number;
  memberId: string;       // 153OS member_id
  name: string;
  timeLine: string;
  kind: CardKind;
  deny: string | null;   // expired_membership | no_valid_grant | unknown_user | consent_revoked | network
  daysLeft: number | null;
  appUserId: string | null; // 마이복서153 계정 — 없으면 153OS 출석부만(퇴장 · 운동 시간 없음)
  today: KioskToday | null;
  deadline: number | null;  // enter = 자동 출석 시각 · exit = 닫히는 시각
  busy: boolean;
  result: { action: "attend" | "leave"; ok: boolean; already: boolean; title: string; sub: string | null } | null;
  retryNote: string | null; // 퇴장 저장 실패 — 카드를 남기고 다시 누르게
}

const newGreet = (seq: number, p: FaceProfile, timeLine: string): Greet => ({
  seq, memberId: p.user_id, name: p.name, timeLine, kind: "checking", deny: null, daysLeft: null,
  appUserId: null, today: null, deadline: null, busy: false, result: null, retryNote: null,
});

// 시간대별 인사말
const timeGreeting = (): string => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "좋은 아침이에요! 상쾌하게 시작해요";
  if (h >= 11 && h < 14) return "오늘도 와주셔서 반가워요";
  if (h >= 14 && h < 18) return "오후 운동, 최고의 선택이에요";
  if (h >= 18 && h < 23) return "오늘 하루 마무리 운동 멋져요";
  return "늦은 시간까지 정말 대단해요";
};

// 이름 아래 인사 — 153OS 출석 프로그램 설정에 인사 문구가 있으면 그 글, 없으면 시간대별 인사
const greetLineOf = (s: KioskSettings): string => s.welcome_text ?? timeGreeting();

// 이용권 잔여일 (end_date = YYYY-MM-DD, 오늘 포함 잔여)
const daysLeftOf = (endDate: string | null | undefined): number | null => {
  if (!endDate) return null;
  const end = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
};

const detOpts = (fa: any) =>
  new fa.TinyFaceDetectorOptions({ inputSize: DETECT_INPUT, scoreThreshold: DETECT_SCORE });

// localStorage 안전 접근 — 저장소가 차단된 안드로이드 WebView·시크릿 모드에서 렌더 중 예외로
// 백스크린이 되는 사고 방지(검수 반영). 실패는 조용히 무시하고 기본값으로 동작한다.
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } };
const lsDel = (k: string): void => { try { localStorage.removeItem(k); } catch { /* 무시 */ } };

// ── 인식 뒤 카드 글 (2026-11-25) ──
const DENY_TEXT: Record<string, string> = {
  expired_membership: "이용권이 만료되었어요 — 데스크에 문의해주세요",
  consent_revoked: "얼굴 등록이 해제되어 있어요 — 데스크에서 재등록해주세요",
  network: "확인에 실패했어요 — 잠시 후 다시 인식해주세요",
};
const DENY_DEFAULT = "출석 확인 — 데스크에서 회원 정보를 확인해주세요";

const renewNotice = (daysLeft: number | null): string | null =>
  daysLeft === null || daysLeft > 7 ? null
    : daysLeft <= 1 ? "이용권이 오늘까지예요 — 데스크에서 연장해주세요"
    : `이용권이 ${daysLeft}일 남았어요 — 미리 연장해두면 편해요`;

function cardViewOf(g: Greet, now: number): KioskCardView {
  const base: KioskCardView = {
    emoji: "🥊", name: g.name, timeLine: g.timeLine, status: null, statusTone: "muted", sub: null, notice: null,
    attend: false, leave: false, leavePrimary: false, notMe: false, busy: g.busy, countdown: null,
  };
  switch (g.kind) {
    case "checking":
      return { ...base, status: KIOSK_FLOW_TEXT.checking };
    case "deny":
      return {
        ...base,
        emoji: g.deny === "expired_membership" ? "⏰" : g.deny === "network" ? "⚠️" : "📋",
        status: DENY_TEXT[g.deny ?? ""] ?? DENY_DEFAULT,
        statusTone: "pending",
      };
    case "enter":
      return {
        ...base, attend: true, notMe: true, notice: renewNotice(g.daysLeft),
        status: g.busy ? "출석 기록 중…" : null,
        countdown: g.busy ? null : {
          ratio: remainingRatio(g.deadline, KIOSK_AUTO_ATTEND_MS, now),
          hint: KIOSK_FLOW_TEXT.enterHint(Math.max(1, remainingSec(g.deadline, now))),
        },
      };
    case "exit":
      return {
        ...base, emoji: "👋",
        timeLine: kioskStayLine(g.today?.startedAt ?? null, now) ?? g.timeLine,
        status: g.busy ? "저장 중…" : g.retryNote ?? KIOSK_FLOW_TEXT.exitHint,
        statusTone: g.retryNote ? "pending" : "primary",
        attend: true, leave: !!g.appUserId, leavePrimary: true,
        countdown: g.busy ? null : {
          ratio: remainingRatio(g.deadline, KIOSK_EXIT_IDLE_MS, now),
          hint: KIOSK_FLOW_TEXT.exitIdle(Math.max(1, remainingSec(g.deadline, now))),
        },
      };
    case "finished":
      return { ...base, emoji: "✅", status: KIOSK_FLOW_TEXT.finishedTitle, statusTone: "primary", sub: kioskFinishedLine(g.today) };
    case "result": {
      const r = g.result;
      if (!r) return base;
      // 퇴장 결과는 이름 아래에 '18:05 입장 · 19:17 퇴장'
      const inAt = r.action === "leave" && r.ok && g.today?.startedAt ? kstTime(g.today.startedAt) : "";
      return {
        ...base,
        emoji: !r.ok ? "⚠️" : r.action === "leave" ? "💪" : r.already ? "✅" : "🥊",
        timeLine: inAt ? `${inAt} 입장 · ${kstTime(new Date(now).toISOString())} 퇴장` : g.timeLine,
        status: r.title, statusTone: r.ok ? "primary" : "pending", sub: r.sub,
        notice: r.action === "attend" && r.ok ? renewNotice(g.daysLeft) : null,
      };
    }
  }
}

const FaceKioskPage = () => {
  const { branchCode } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [branchName, setBranchName] = useState<string>("");
  const [kioskKey, setKioskKey] = useState<string>(() => lsGet(KEY_LS) || "");
  const [status, setStatus] = useState<string>("준비 중…");
  const [ready, setReady] = useState(false);
  const [greet, setGreet] = useState<Greet | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => lsGet(SOUND_LS) !== "off");
  // 153OS 출석 프로그램 설정 — 켤 때와 1분마다 읽는다(못 읽으면 기본값 = 지금처럼)
  const [kiosk, setKiosk] = useState<KioskSettingsState>(() => ({ settings: { ...KIOSK_DEFAULTS }, saved: false }));
  const kioskRef = useRef<KioskSettings>(kiosk.settings);
  kioskRef.current = kiosk.settings;
  const lastServerSoundRef = useRef<boolean | null>((() => { const v = lsGet(SERVER_SOUND_LS); return v === "on" ? true : v === "off" ? false : null; })());
  // FC-6: 이 기기의 키가 어느 지점에 묶여 있는지(서버가 알려줌). 화면 URL 지점과 다르면 즉시 눈에 띈다.
  const [keyBranch, setKeyBranch] = useState<string | null>(null);
  // 고장 상태(회원용) / 기술 진단(직원용, 평소엔 숨김)
  const [down, setDown] = useState(false);
  const [diag, setDiag] = useState<string>("");
  const [showDiag, setShowDiag] = useState(false);
  const diagTapRef = useRef<{ n: number; t: number }>({ n: 0, t: 0 });
  // 직원용 — 우측 상단 모서리를 1.2초 안에 3번 탭하면 기술 정보가 열린다.
  // 회원 눈에는 아무것도 없는 영역이라 우연히 열릴 일이 없다.
  const onCornerTap = () => {
    const now = Date.now();
    const r = diagTapRef.current;
    r.n = now - r.t < 1200 ? r.n + 1 : 1;
    r.t = now;
    if (r.n >= 3) { r.n = 0; setShowDiag((v) => !v); }
  };
  // 지점명: 웹은 주소(branchCode)로, 앱은 키가 알려준 지점(keyBranch)으로.
  const branchLabelRef = useRef<string>("");
  branchLabelRef.current = branchName || keyBranch || "";
  const profilesRef = useRef<{ p: FaceProfile; f32: Float32Array }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const greetSeqRef = useRef(0);
  const greetTimerRef = useRef<number | undefined>(undefined);
  const soundOnRef = useRef(soundOn);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    soundOnRef.current = soundOn;
    lsSet(SOUND_LS, soundOn ? "on" : "off");
  }, [soundOn]);

  // ── 사운드: 차임(WebAudio) + 이름 호명(TTS). 무음 토글 시 전부 끔 ──
  const ensureAudio = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (AC) audioCtxRef.current = new AC();
      }
      audioCtxRef.current?.resume?.();
      return audioCtxRef.current;
    } catch { return null; }
  }, []);

  // 오토플레이 정책 대응: 터치에서 오디오 잠금 해제 — 실제 running 확인 전까지 리스너 유지(새로고침·재부팅 후에도 복구)
  useEffect(() => {
    const unlock = () => {
      const ctx = ensureAudio();
      if (ctx && ctx.state === "running") window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, [ensureAudio]);

  // ping = 인식됨(판정 전 중립음) · ok = 통과 · deny = 안내(거절).
  // 실차단에서는 판정 전에 성공음을 내면 거절 회원이 통과한 줄 알고 걸어 들어간다(검수 반영).
  const chime = useCallback((kind: "ok" | "deny" | "ping") => {
    if (!soundOnRef.current) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const notes = kind === "ok" ? [784, 1175] : kind === "deny" ? [392, 311] : [659];
      notes.forEach((freq, i) => {
        const t0 = ctx.currentTime + i * 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.25);
      });
    } catch { /* 사운드 실패는 무시 */ }
  }, [ensureAudio]);

  const speak = useCallback((text: string) => {
    if (!soundOnRef.current) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(toSpokenKo(text)); // 153 → '일오삼'
      u.lang = "ko-KR";
      u.rate = 1.05;
      synth.speak(u);
    } catch { /* TTS 미지원 기기 무시 */ }
  }, []);

  // 지점 코드 → 지점명 (라이브보드와 동일 방식)
  useEffect(() => {
    if (!branchCode) return;
    supabase.from("branches").select("name, code").then(({ data }) => {
      const b = (data || []).find((x) => x.code === branchCode);
      if (b) setBranchName(b.name);
      else setStatus("지점 코드를 찾을 수 없어요");
    });
  }, [branchCode]);

  const api = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-kiosk-key": kioskKey },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }, [kioskKey]);

  // 153OS 워커 호출 (판단·등록·목록) — 같은 키오스크 키 사용
  const osApi = useCallback(async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${OS_URL}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-kiosk-key": kioskKey },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }, [kioskKey]);

  // 153OS 출석 프로그램 설정 읽기 — 켤 때와 1분마다. 401(키 틀림)·404(옛 워커)·실패는 조용히 넘긴다
  // (키 문제는 명단·판정 쪽이 따로 알린다). 출입 판단과는 상관없다 — 얼굴 출석 쉬기는 인식만 멈춘다.
  useEffect(() => {
    if (!kioskKey) return;
    let alive = true;
    const load = async () => {
      try {
        const { status: st, json } = await osApi("settings", {});
        if (!alive || st !== 200 || !json?.success) return;
        // 153OS 가 자기 DB 를 못 읽어 기본값을 보낸 것(fallback) — 지난 값 그대로(쉬기로 한 키오스크가 잠깐 다시 켜지지 않게)
        if (json.data?.fallback === true) return;
        const next = normalizeKioskSettings(json.data);
        setKiosk((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
        // 소리: 153OS 에 저장된 값이 있고 바뀌었을 때만 맞춘다(기기 단추로 잠깐 바꾼 건 다음 변경 전까지 둔다)
        if (next.saved && lastServerSoundRef.current !== next.settings.sound_on) {
          lastServerSoundRef.current = next.settings.sound_on;
          lsSet(SERVER_SOUND_LS, next.settings.sound_on ? "on" : "off");
          setSoundOn(next.settings.sound_on);
        }
      } catch { /* 네트워크 — 지난 값 그대로 */ }
    };
    void load();
    const t = window.setInterval(load, KIOSK_SETTINGS_POLL_MS);
    return () => { alive = false; window.clearInterval(t); };
  }, [kioskKey, osApi]);

  // ── 인식 뒤 카드 — [출석](10초 뒤 자동) · [출석][퇴장](퇴장을 눌러야 실제 운동 시간) · 2026-11-25 ──
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const greetRef = useRef<Greet | null>(null);
  greetRef.current = greet;
  // 카운트다운 글 · 막대를 다시 그리는 시계 — 카드에 마감이 있을 때만 돈다
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!greet?.deadline || greet.busy) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [greet?.deadline, greet?.busy]);

  // 오버레이 표시 시간 관리 — 결과 확정 시 타이머를 다시 걸어 문구가 반드시 보이게 한다(검수 반영)
  const holdGreet = useCallback((seq: number, ms: number) => {
    if (greetTimerRef.current) window.clearTimeout(greetTimerRef.current);
    greetTimerRef.current = window.setTimeout(() => {
      if (greetSeqRef.current === seq) setGreet(null);
    }, ms);
  }, []);
  // 이 카드(seq)가 아직 화면에 있으면 고친다. 응답이 늦어 카드가 이미 닫혔으면(g === null) 다시 세운다 —
  // 거절 회원이 사유를 못 보고 거절음만 듣지 않게(검수 반영). 다른 회원 카드가 떠 있으면 건드리지 않는다.
  const upsertGreet = useCallback((seq: number, build: (g: Greet | null) => Greet) => {
    setGreet((g) => (g && g.seq !== seq ? g : build(g && g.seq === seq ? g : null)));
  }, []);

  /** 출석 — 153OS 출석부(/api/face/attend) · 마이복서153(face-kiosk checkin · 라이브보드) 두 길. silent = 다음 사람이 와서 화면 없이 확정 */
  const attendFor = useCallback(async (g: Greet, silent: boolean) => {
    const seq = g.seq;
    if (!silent) setGreet((cur) => (cur && cur.seq === seq ? { ...cur, busy: true } : cur));
    const osLeg: Promise<KioskLeg> = osApi("attend", { member_id: g.memberId })
      .then(({ status, json }) => {
        if (status === 404 && !json?.error) return "skip"; // 아직 /attend 가 없는 153OS 워커 — 앱 기록만
        if (!json?.success) return "fail";
        return json?.data?.already === true ? "already" : "ok";
      })
      .catch((): KioskLeg => "fail");
    const appLeg: Promise<KioskLeg> = g.appUserId
      ? api({ action: "checkin", user_id: g.appUserId, branch_name: branchLabelRef.current })
        .then(({ status, json }): KioskLeg => (status === 200 && json?.ok ? (json.already === true ? "already" : "ok") : "fail"))
        .catch((): KioskLeg => "fail")
      : Promise.resolve("skip");
    const [os, app] = await Promise.all([osLeg, appLeg]);
    if (os === "fail" || app === "fail") {
      setDiag(`출석 기록 일부 실패 — 153OS:${os} · 앱:${app} (${new Date().toLocaleTimeString("ko-KR")})`);
    }
    const r = kioskAttendResult(os, app);
    // 둘 다 실패면 30초 뒤 다시 인식되게 — 바로 풀면 차임이 계속 울린다(검수 반영)
    if (!r.ok) lastSeenRef.current.set(g.memberId, Date.now() - rematchMs(kioskRef.current) + 30_000);
    if (silent || !mountedRef.current || greetSeqRef.current !== seq) return;
    setGreet((cur) => (cur && cur.seq === seq
      ? { ...cur, kind: "result", busy: false, deadline: null, result: { action: "attend", ok: r.ok, already: r.already, title: r.title, sub: r.sub } }
      : cur));
    chime(r.ok ? "ok" : "deny");
    holdGreet(seq, r.ok ? KIOSK_RESULT_MS : 5000);
  }, [api, osApi, chime, holdGreet]);

  /** 퇴장 — 누른 시각까지 실제 운동 시간 저장(서버 kiosk_finish_workout · XP 차액) */
  const leaveFor = useCallback(async (g: Greet) => {
    const seq = g.seq;
    if (!g.appUserId) return;
    setGreet((cur) => (cur && cur.seq === seq ? { ...cur, busy: true, retryNote: null } : cur));
    let parsed = null;
    try {
      const { status, json } = await api({ action: "checkout", user_id: g.appUserId });
      if (status === 200) parsed = parseKioskCheckout(json);
    } catch { /* 네트워크 — 아래에서 다시 누르게 */ }
    const r = kioskLeaveResult(parsed, g.name);
    if (!mountedRef.current || greetSeqRef.current !== seq) return;
    if (!r.ok && r.retry) {
      // 저장 실패 — 카드를 남기고 다시 누를 시간을 준다
      setGreet((cur) => (cur && cur.seq === seq
        ? { ...cur, busy: false, retryNote: `${r.title} — ${r.sub ?? ""}`.trim(), deadline: Date.now() + KIOSK_EXIT_IDLE_MS }
        : cur));
      chime("deny");
      holdGreet(seq, KIOSK_EXIT_IDLE_MS + 15_000);
      return;
    }
    setGreet((cur) => (cur && cur.seq === seq
      ? { ...cur, kind: "result", busy: false, deadline: null, result: { action: "leave", ok: r.ok, already: false, title: r.title, sub: r.sub } }
      : cur));
    chime(r.ok ? "ok" : "deny");
    if (r.voice) speak(r.voice);
    holdGreet(seq, r.ok ? KIOSK_RESULT_MS + 1500 : 5000);
  }, [api, chime, speak, holdGreet]);

  /** 제가 아니에요 — 기록 없이 닫는다(잘못 맞춘 얼굴은 다시 인식 간격 동안 또 뜨지 않는다) */
  const notMe = useCallback((g: Greet) => {
    setGreet((cur) => (cur && cur.seq === g.seq ? null : cur));
  }, []);

  /** 인식 직후 — 153OS 판정(verify) → 앱 오늘 상태(state) → 카드 고르기 */
  const resolveCard = useCallback(async (p: FaceProfile, seq: number) => {
    try {
      const { status: vrStatus, json: vr } = await osApi("verify", { member_id: p.user_id });
      if (vrStatus === 401) {
        // 키오스크 키 회전 — 재설정 화면으로 (무한 재시도 루프 방지)
        lsDel(KEY_LS);
        setReady(false);
        setKioskKey("");
        return;
      }
      if (!vr?.success) throw new Error("verify 실패");
      // 판정은 서버 allowed 기준(실차단 계약) — 부정을 기본값으로 둔다(필드 누락 시 통과 금지)
      const allowed: boolean = vr?.data?.allowed === true;
      const reason: string | null = vr?.data?.reason ?? null;
      const name: string = vr?.data?.name || p.name;
      const appUserId: string | null = vr?.data?.app_user_id ?? null;
      const daysLeft = daysLeftOf(vr?.data?.end_date);
      if (!allowed) {
        // 거절: 60초 뒤 재시도 허용 — 데스크에서 결제 직후 다시 인식할 수 있게(검수 반영)
        lastSeenRef.current.set(p.user_id, Date.now() - rematchMs(kioskRef.current) + 60_000);
        if (!mountedRef.current) return;
        upsertGreet(seq, (g) => ({
          ...(g ?? newGreet(seq, p, greetLineOf(kioskRef.current))),
          name, kind: "deny", deny: reason || "no_valid_grant", daysLeft, deadline: null, busy: false,
        }));
        holdGreet(seq, 5000);
        chime("deny");
        return;
      }
      // 오늘 출석했나 — 못 읽으면 출석 전으로(이미 출석했으면 출석 때 서버가 '이미 출석'으로 답한다)
      let today: KioskToday | null = null;
      if (appUserId) {
        try {
          const { status, json } = await api({ action: "state", user_id: appUserId });
          if (status === 200) today = parseKioskToday(json);
        } catch { /* 출석 전으로 */ }
      }
      const kind = kioskCardKind(today);
      const base = { memberId: p.user_id, name, appUserId, today, daysLeft, deny: null, busy: false, result: null, retryNote: null };
      if (!mountedRef.current) return;
      if (greetSeqRef.current !== seq) {
        // 그사이 다음 사람이 인식됨 — 들어오던 회원의 출석은 화면 없이 확정한다(출석이 빠지지 않게)
        if (kind === "enter") void attendFor({ ...newGreet(seq, p, ""), ...base, kind: "enter", deadline: null }, true);
        return;
      }
      const now = Date.now();
      if (kind === "enter") {
        upsertGreet(seq, (g) => ({ ...(g ?? newGreet(seq, p, greetLineOf(kioskRef.current))), ...base, kind, deadline: now + KIOSK_AUTO_ATTEND_MS }));
        chime("ok");
        speak(kioskVoiceLine(kioskRef.current.voice_text, name)); // 호명은 통과 확정 후 — 거절자에게 환영 음성이 나가는 모순 방지
        holdGreet(seq, KIOSK_AUTO_ATTEND_MS + 15_000); // 안전 타이머 — 자동 출석은 카운트다운이 한다
      } else if (kind === "exit") {
        upsertGreet(seq, (g) => ({ ...(g ?? newGreet(seq, p, "")), ...base, kind, deadline: now + KIOSK_EXIT_IDLE_MS }));
        chime("ping"); // 운동 중 지나가다 찍힌 회원도 있으니 호명은 하지 않는다
        holdGreet(seq, KIOSK_EXIT_IDLE_MS + 15_000);
      } else {
        upsertGreet(seq, (g) => ({ ...(g ?? newGreet(seq, p, "")), ...base, kind, deadline: null }));
        chime("ping");
        holdGreet(seq, KIOSK_FINISHED_MS);
      }
    } catch {
      // 확인 실패(네트워크 등): 30초 뒤 재시도 — 즉시 해제하면 차임·호명 무한 반복(검수 반영)
      lastSeenRef.current.set(p.user_id, Date.now() - rematchMs(kioskRef.current) + 30_000);
      if (!mountedRef.current) return;
      upsertGreet(seq, (g) => ({ ...(g ?? newGreet(seq, p, greetLineOf(kioskRef.current))), kind: "deny", deny: "network", deadline: null, busy: false }));
      holdGreet(seq, 4000);
      chime("deny");
    }
  }, [api, osApi, chime, speak, holdGreet, upsertGreet, attendFor]);

  /** 얼굴이 맞으면 — 앞사람 [출석] 카드가 떠 있으면 그 출석을 먼저 확정하고 새 카드 */
  const showGreet = useCallback((p: FaceProfile) => {
    const prev = greetRef.current;
    if (prev && prev.kind === "enter" && !prev.busy) void attendFor(prev, true);
    const seq = ++greetSeqRef.current;
    setGreet(newGreet(seq, p, greetLineOf(kioskRef.current)));
    chime("ping"); // 인식됨 신호(중립음) — 통과/거절음과 호명은 판정 확정 후
    // 안전 타이머는 넉넉히(15초). 실제 소멸 시간은 결과 도착 시 holdGreet 이 다시 정한다.
    holdGreet(seq, 15_000);
    void resolveCard(p, seq);
  }, [attendFor, chime, holdGreet, resolveCard]);
  const showGreetRef = useRef(showGreet);
  showGreetRef.current = showGreet;

  // 카운트다운 끝 — [출석] 카드는 자동 출석, [퇴장] 카드는 기록 없이 닫기(기본 운동 시간)
  useEffect(() => {
    if (!greet || greet.busy || greet.deadline === null) return;
    if (greet.kind !== "enter" && greet.kind !== "exit") return;
    const seq = greet.seq;
    const t = window.setTimeout(() => {
      const g = greetRef.current;
      if (!g || g.seq !== seq || g.busy) return;
      if (g.kind === "enter") void attendFor(g, false);
      else if (g.kind === "exit") setGreet((cur) => (cur && cur.seq === seq ? null : cur));
    }, Math.max(0, greet.deadline - Date.now()));
    return () => window.clearTimeout(t);
  }, [greet, attendFor]);

  // face-api 스크립트 + 모델 + (병렬) 명단·카메라 + 워밍업
  useEffect(() => {
    if (!kioskKey || (branchCode && !branchName)) return;
    let stop = false;
    (async () => {
      try {
        setStatus(MSG_PREP);
        const BASE = await resolveAssetBase();
        if (!(window as any).faceapi) {
          const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => { s.remove(); reject(new Error("face-api 로드 실패")); };
            document.head.appendChild(s);
          });
          try {
            await loadScript(faceApiScriptUrl(BASE));
          } catch (e) {
            // 웹에서 사이트 사본을 못 받으면 같은 0.22.2 CDN 원본으로 한 번 더(모델 파일은 그대로 BASE). 설치형 앱은 CDN 금지.
            if (IS_NATIVE_APP || BASE === CDN) throw e;
            await loadScript(`${CDN}/${FACE_API_JS}`);
          }
        }
        const fa = (window as any).faceapi;
        // 모델 로드 + 등록 명단 + 카메라를 병렬로 (시작 시간 단축)
        const [, listRes, stream] = await Promise.all([
          Promise.all([
            fa.nets.tinyFaceDetector.loadFromUri(`${BASE}/weights`),
            fa.nets.faceLandmark68Net.loadFromUri(`${BASE}/weights`),
            fa.nets.faceRecognitionNet.loadFromUri(`${BASE}/weights`),
          ]),
          osApi("list", {}),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } }),
        ]);
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (listRes.status === 401) {
          stream.getTracks().forEach((t) => t.stop());
          setStatus("키오스크 키가 올바르지 않아요");
          lsDel(KEY_LS);
          setKioskKey("");
          return;
        }
        if (!listRes.json?.success) {
          // 명단 로드 실패를 무음으로 넘기면 "멀쩡해 보이는데 아무도 인식 안 되는" 상태가 된다(검수 반영)
          stream.getTracks().forEach((t) => t.stop());
          setDown(true);
          setDiag("등록 명단(list) 응답 실패 — 워커/네트워크 확인");
          setStatus("");
          return;
        }
        const list = (listRes.json?.data?.profiles || []) as { member_id: string; name: string; embedding: number[] }[];
        setKeyBranch((listRes.json?.data?.branch_name as string | null) ?? null);
        profilesRef.current = list.map((r) => ({ p: { user_id: r.member_id, name: r.name, embedding: r.embedding }, f32: Float32Array.from(r.embedding) }));
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        // 워밍업: 첫 추론에서 발생하는 수 초의 셰이더 컴파일 지연을 미리 소모
        setStatus(MSG_PREP);
        try {
          await fa.detectSingleFace(videoRef.current, detOpts(fa)).withFaceLandmarks().withFaceDescriptor();
        } catch { /* 워밍업 실패는 무시 */ }
        if (stop) return;
        setReady(true);
        setDown(false);
        setDiag("");
        setStatus("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "초기화 실패";
        setDown(true);
        setStatus("");
        setDiag("진단 중…");
        const where = assetBase === LOCAL_ASSETS ? "앱내장" : "CDN";
        const detail = await diagnoseAssets(assetBase || CDN).catch(() => "진단 실패");
        setDiag(`[${where}] ${detail} / ${msg}`);
      }
    })();
    return () => {
      stop = true;
      // 라우트 이탈 시 카메라 끄기 — 트랙을 안 멈추면 카메라가 계속 켜져 있다(검수 반영)
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [kioskKey, branchName, branchCode, osApi]);

  // ── 인식 루프: 연속 실행 — 탐지가 끝나면 즉시 다음. 얼굴 없을 때만 짧게 쉼 ──
  // 얼굴이 맞으면 카드 흐름(showGreet — 판정 · 오늘 상태 · [출석] / [퇴장])으로 넘긴다(2026-11-25).
  useEffect(() => {
    if (!ready) return;
    const fa = (window as any).faceapi;
    const OPTS = detOpts(fa);
    let alive = true;
    let timer: number | undefined;

    const tick = async () => {
      if (!alive) return;
      // 153OS 에서 얼굴 출석을 쉬게 하면 인식하지 않는다(쉬는 화면 · 카메라는 얼굴 등록 때문에 켜 둔다)
      if (enrollOpen || !kioskRef.current.face_enabled || !videoRef.current || videoRef.current.readyState < 2) {
        timer = window.setTimeout(tick, 250);
        return;
      }
      let idle = IDLE_MS;
      try {
        const t0 = performance.now();
        const det = await fa.detectSingleFace(videoRef.current, OPTS).withFaceLandmarks().withFaceDescriptor();
        if (performance.now() - t0 > 200) idle = 0; // 느린 기기는 쉬지 않고 연속 탐지
        // await 사이에 언마운트·등록시트 진입이 일어났을 수 있다 — 그 프레임의 결과로
        // 인사·출입기록·문열기를 실행하면 안 된다(검수 반영).
        if (alive && !enrollOpen && det?.descriptor && profilesRef.current.length > 0) {
          let best: { p: FaceProfile; d: number } | null = null;
          for (const { p, f32 } of profilesRef.current) {
            const d = fa.euclideanDistance(det.descriptor, f32);
            if (!best || d < best.d) best = { p, d };
          }
          if (best && best.d < MATCH_DIST) {
            const now = Date.now();
            const last = lastSeenRef.current.get(best.p.user_id) || 0;
            if (now - last > rematchMs(kioskRef.current)) {
              lastSeenRef.current.set(best.p.user_id, now);
              showGreetRef.current(best.p);
            }
          }
        }
      } catch { /* 프레임 스킵 */ }
      if (!alive) return;
      timer = window.setTimeout(tick, idle);
    };
    tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [ready, enrollOpen]);

  // ── 키 입력 화면 ──
  if (!kioskKey) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-background p-8">
        <p className="text-lg font-black text-foreground">🥊 153 얼굴 키오스크 설정</p>
        <p className="text-sm text-muted-foreground">관리자에게 받은 키오스크 키를 입력하세요 (최초 1회)</p>
        <input
          type="password" placeholder="키오스크 키"
          className="w-full max-w-sm rounded-xl border border-border bg-card p-3 text-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) { lsSet(KEY_LS, v); setKioskKey(v); }
            }
          }}
        />
        <p className="text-xs text-muted-foreground">입력 후 Enter</p>
      </div>
    );
  }

  const cardView = greet ? cardViewOf(greet, nowTick) : null;

  return (
    // fixed + z-[80]: 앱 하단 메뉴·AI 버튼 위를 덮는 전체화면 키오스크 (등록 버튼 가림 사고 방지)
    <div className="fixed inset-0 z-[80] bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />

      {/* 상단 안내 */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <p className="rounded-full bg-black/60 px-4 py-2 text-sm font-black text-white">
          🥊 {branchName || keyBranch || "153복싱짐"} · 얼굴 출석
          {keyBranch
            ? <span className="ml-2 font-medium text-white/70">🔑 {keyBranch}</span>
            : <span className="ml-2 font-medium text-white/70">(공용 키)</span>}
        </p>
        {status && <p className="max-w-[58vw] rounded-2xl bg-black/70 px-4 py-2 text-xs leading-snug text-white break-words">{status}</p>}
      </div>

      {/* 고장 안내(회원용) — 원인은 말하지 않는다. 회원이 할 수 있는 행동만 말한다. */}
      {down && (
        <div className="absolute inset-0 z-[85] flex flex-col items-center justify-center gap-3 bg-black/90 p-8 text-center">
          <p className="text-3xl font-black text-white">{MSG_DOWN_TITLE}</p>
          <p className="text-lg text-white/70">{MSG_DOWN_SUB}</p>
        </div>
      )}

      {/* 기술 정보(직원용) — 평소엔 숨김. 모서리 3번 탭으로 열고 닫는다. */}
      {showDiag && (
        <div className="absolute inset-x-4 bottom-24 z-[95] rounded-xl bg-black/90 p-3 text-left text-[11px] leading-relaxed text-white/80">
          <p className="mb-1 font-bold text-white/50">진단 정보 (직원용 · 모서리 3번 탭으로 닫기)</p>
          <p className="break-words">{diag || "이상 없음"}</p>
        </div>
      )}

      {/* 진단 토글용 투명 영역 — 회원에게는 보이지 않는다 */}
      <button aria-hidden tabIndex={-1} onClick={onCornerTap}
        className="absolute right-0 top-0 z-[99] h-16 w-16 opacity-0" />

      {/* 153OS 출석 프로그램 설정 — 쉬는 화면 · 기다리는 화면 안내 (아래 단추들보다 먼저 그려 단추는 그대로 눌린다) */}
      {ready && !down && !kiosk.settings.face_enabled && <KioskPausedScreen settings={kiosk.settings} />}
      {ready && !down && kiosk.settings.face_enabled && !greet && <KioskNoticeBar settings={kiosk.settings} />}

      {/* 인식 뒤 카드 — 매칭 즉시 표시 → 판정 · 오늘 상태에 따라 [출석] / [출석][퇴장] (2026-11-25) */}
      {greet && cardView && (
        <KioskActionCard
          view={cardView}
          onAttend={() => { const g = greetRef.current; if (g && !g.busy) void attendFor(g, false); }}
          onLeave={() => { const g = greetRef.current; if (g && !g.busy) void leaveFor(g); }}
          onNotMe={() => { const g = greetRef.current; if (g && !g.busy) notMe(g); }}
        />
      )}

      {/* 사운드 토글 (좌하단) */}
      <button
        onClick={() => {
          const next = !soundOn;
          setSoundOn(next);
          if (!next) { try { window.speechSynthesis?.cancel(); } catch { /* 무시 */ } }
          ensureAudio();
        }}
        className="absolute bottom-4 left-4 rounded-full bg-black/60 px-4 py-2 text-xs text-white/70"
      >{soundOn ? "🔊 소리 켜짐" : "🔇 무음"}</button>

      {/* 등록 버튼 (우하단 작게) */}
      <button
        onClick={() => setEnrollOpen(true)}
        className="absolute bottom-4 right-4 rounded-full bg-black/60 px-4 py-2 text-xs text-white/70"
      >얼굴 등록</button>

      {enrollOpen && (
        <EnrollSheet
          osApi={osApi}
          video={videoRef}
          onDone={async () => {
            setEnrollOpen(false);
            // 명단 갱신 실패 시 기존 명단을 유지한다 — 빈 배열로 덮으면 전 회원 인식이 무음으로 죽는다(검수 반영)
            try {
              const { json } = await osApi("list", {});
              if (json?.success) {
                setKeyBranch((json?.data?.branch_name as string | null) ?? null);
                const list = (json?.data?.profiles || []) as { member_id: string; name: string; embedding: number[] }[];
                profilesRef.current = list.map((r) => ({ p: { user_id: r.member_id, name: r.name, embedding: r.embedding }, f32: Float32Array.from(r.embedding) }));
              } else {
                setDown(true); setDiag("명단 갱신(list) 실패 — 워커/네트워크 확인");
              }
            } catch {
              setDown(true); setDiag("명단 갱신(list) 실패 — 워커/네트워크 확인");
            }
          }}
          onClose={() => setEnrollOpen(false)}
        />
      )}
    </div>
  );
};

// ── 등록 시트 ──
// FC-5: 실회원 등록 확대 — 실시간 얼굴 감지 피드백 + 3샷 각도 가이드 + 생체정보 동의 고지 강화
const SHOT_GUIDES = ["1/3 · 정면을 바라봐 주세요", "2/3 · 고개를 살짝 왼쪽으로", "3/3 · 고개를 살짝 오른쪽으로"];

const EnrollSheet = ({ osApi, video, onDone, onClose }: {
  osApi: (path: string, b: Record<string, unknown>) => Promise<{ status: number; json: any }>;
  video: React.RefObject<HTMLVideoElement>;
  onDone: () => void;
  onClose: () => void;
}) => {
  const [phone, setPhone] = useState("");
  const [member, setMember] = useState<{ user_id: string; label: string; enrolled: boolean } | null>(null);
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const [shots, setShots] = useState(0);
  const [faceOk, setFaceOk] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const embsRef = useRef<number[][]>([]);
  const [saving, setSaving] = useState(false);

  // 회원 선택 후: 가벼운 탐지(디텍터만, 160px)로 "얼굴 잡힘" 상태를 실시간 표시
  useEffect(() => {
    if (!member) return;
    const fa = (window as any).faceapi;
    let alive = true;
    const t = setInterval(async () => {
      if (!alive || !video.current || video.current.readyState < 2) return;
      try {
        const det = await fa.detectSingleFace(
          video.current,
          new fa.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
        );
        if (alive) setFaceOk(!!det);
      } catch { /* 프레임 스킵 */ }
    }, 500);
    return () => { alive = false; clearInterval(t); };
  }, [member, video]);

  const lookup = async () => {
    setMsg("조회 중…");
    try {
      const { json } = await osApi("lookup", { phone });
      if (json?.success) { setMember({ user_id: json.data.member_id, label: json.data.name || "회원", enrolled: json.data.enrolled }); setMsg(""); }
      else setMsg(json?.error?.message || "조회 실패");
    } catch {
      setMsg("네트워크 오류 — 다시 시도해주세요");
    }
  };

  const capture = async () => {
    const fa = (window as any).faceapi;
    if (!video.current || capturing) return;
    setCapturing(true);
    setMsg("촬영 중… 그대로 계세요");
    try {
      const det = await fa
        .detectSingleFace(video.current, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks().withFaceDescriptor();
      if (!det?.descriptor) { setMsg("얼굴을 찾지 못했어요 — 화면 중앙에 정면으로 서주세요"); return; }
      embsRef.current.push(Array.from(det.descriptor as Float32Array));
      const n = embsRef.current.length;
      setShots(n);
      setMsg(n >= 3 ? "충분해요! 저장을 눌러주세요" : SHOT_GUIDES[Math.min(n, 2)]);
    } catch {
      setMsg("촬영 오류 — 다시 시도해주세요");
    } finally {
      setCapturing(false);
    }
  };

  const save = async () => {
    if (!member || embsRef.current.length === 0) return;
    setSaving(true);
    try {
      const { json } = await osApi("enroll", { member_id: member.user_id, embeddings: embsRef.current, consent });
      if (json?.success) { setMsg("등록 완료! 이제 얼굴만 보이면 자동 출석돼요"); setTimeout(onDone, 1200); }
      else setMsg(json?.error?.message || "등록 실패");
    } catch {
      setMsg("네트워크 오류 — 다시 시도해주세요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-black text-foreground">얼굴 등록 (시범)</p>
        {!member ? (
          <div className="mt-3 space-y-2">
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호 (숫자만)" inputMode="numeric"
              className="w-full rounded-xl border border-border bg-background p-3 text-foreground"
            />
            <button onClick={lookup} className="w-full rounded-xl bg-primary py-3 font-black text-primary-foreground">회원 조회</button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-foreground">
              <b>{member.label}</b>님 {member.enrolled && <span className="text-muted-foreground">(기존 등록 있음 — 새로 덮어씁니다)</span>}
            </p>
            <label className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>
                <b className="text-foreground">얼굴 특징값 수집·이용 동의 (필수)</b>
                <span className="mt-1 block">· 수집: 얼굴 특징값(숫자 128개) — 사진·영상은 저장하지 않아요</span>
                <span className="block">· 목적: 출석 확인 전용 (다른 용도 사용 없음)</span>
                <span className="block">· 철회: 데스크에 요청하면 즉시 삭제돼요</span>
                <span className="block">· 동의하지 않아도 QR 로 출석할 수 있어요</span>
              </span>
            </label>
            {consent && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-xs font-bold text-foreground">
                  {shots >= 3 ? "촬영 완료 — 저장을 눌러주세요" : SHOT_GUIDES[shots]}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${faceOk ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {faceOk ? "● 얼굴 잡힘" : "○ 얼굴을 화면에"}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={capture} disabled={!consent || !faceOk || capturing || shots >= 5}
                className="flex-1 rounded-xl bg-secondary py-3 font-bold text-secondary-foreground disabled:opacity-40">
                {capturing ? "촬영 중…" : `촬영 (${Math.min(shots, 3)}/3)`}
              </button>
              <button onClick={save} disabled={!consent || shots === 0 || saving}
                className="flex-1 rounded-xl bg-primary py-3 font-black text-primary-foreground disabled:opacity-40">
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        )}
        {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
        <button onClick={onClose} className="mt-3 w-full rounded-xl border border-border py-2 text-sm text-muted-foreground">닫기</button>
      </div>
    </div>
  );
};

export default FaceKioskPage;
