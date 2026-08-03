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
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-kiosk`; // 앱측: 라이브보드 즉시 표시용
const OS_URL = "https://153-boxing-os-api.boxing5969.workers.dev/api/face";     // 153OS: 판단·등록·장부(FC-2)
const KEY_LS = "153_kiosk_key";
const SOUND_LS = "153_kiosk_sound";
const CDN = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2";
const MATCH_DIST = 0.5;          // face-api 권장 임계 (낮을수록 엄격)
const REMATCH_MS = 5 * 60_000;   // 같은 회원 재인식 무시 간격
const DETECT_INPUT = 224;        // 탐지 해상도 (320→224: 키오스크는 얼굴이 크게 잡혀 충분)
const DETECT_SCORE = 0.45;
const IDLE_MS = 120;             // 얼굴 없을 때 다음 탐지까지 휴식 (CPU 보호)
const GREET_MS = 4500;           // 환영 오버레이 표시 시간

interface FaceProfile { user_id: string; name: string; embedding: number[] } // user_id = 153OS member_id

interface Greet {
  seq: number;
  name: string;
  timeLine: string;
  phase: "checking" | "done";
  already: boolean;
  deny: string | null;   // expired_membership | no_valid_grant | unknown_user | network
  daysLeft: number | null;
}

// 시간대별 인사말
const timeGreeting = (): string => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "좋은 아침이에요! 상쾌하게 시작해요";
  if (h >= 11 && h < 14) return "오늘도 와주셔서 반가워요";
  if (h >= 14 && h < 18) return "오후 운동, 최고의 선택이에요";
  if (h >= 18 && h < 23) return "오늘 하루 마무리 운동 멋져요";
  return "늦은 시간까지 정말 대단해요";
};

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
      const u = new SpeechSynthesisUtterance(text);
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

  // face-api 스크립트 + 모델 + (병렬) 명단·카메라 + 워밍업
  useEffect(() => {
    if (!kioskKey || !branchName) return;
    let stop = false;
    (async () => {
      try {
        setStatus("AI 모델 준비 중…");
        if (!(window as any).faceapi) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = `${CDN}/dist/face-api.min.js`;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("face-api 로드 실패"));
            document.head.appendChild(s);
          });
        }
        const fa = (window as any).faceapi;
        // 모델 로드 + 등록 명단 + 카메라를 병렬로 (시작 시간 단축)
        const [, listRes, stream] = await Promise.all([
          Promise.all([
            fa.nets.tinyFaceDetector.loadFromUri(`${CDN}/weights`),
            fa.nets.faceLandmark68Net.loadFromUri(`${CDN}/weights`),
            fa.nets.faceRecognitionNet.loadFromUri(`${CDN}/weights`),
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
          setStatus("등록 명단을 불러오지 못했어요 — 새로고침 해주세요");
          return;
        }
        const list = (listRes.json?.data?.profiles || []) as { member_id: string; name: string; embedding: number[] }[];
        profilesRef.current = list.map((r) => ({ p: { user_id: r.member_id, name: r.name, embedding: r.embedding }, f32: Float32Array.from(r.embedding) }));
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        // 워밍업: 첫 추론에서 발생하는 수 초의 셰이더 컴파일 지연을 미리 소모
        setStatus("인식 엔진 예열 중…");
        try {
          await fa.detectSingleFace(videoRef.current, detOpts(fa)).withFaceLandmarks().withFaceDescriptor();
        } catch { /* 워밍업 실패는 무시 */ }
        if (stop) return;
        setReady(true);
        setStatus("");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "초기화 실패 — 새로고침 해주세요");
      }
    })();
    return () => {
      stop = true;
      // 라우트 이탈 시 카메라 끄기 — 트랙을 안 멈추면 카메라가 계속 켜져 있다(검수 반영)
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [kioskKey, branchName, osApi]);

  // ── 인식 루프: 연속 실행 — 탐지가 끝나면 즉시 다음. 얼굴 없을 때만 짧게 쉼 ──
  useEffect(() => {
    if (!ready) return;
    const fa = (window as any).faceapi;
    const OPTS = detOpts(fa);
    let alive = true;
    let timer: number | undefined;

    // 오버레이 표시 시간 관리 — 결과 확정 시 타이머를 다시 걸어 문구가 반드시 보이게 한다(검수 반영)
    const holdGreet = (seq: number, ms: number) => {
      if (greetTimerRef.current) window.clearTimeout(greetTimerRef.current);
      greetTimerRef.current = window.setTimeout(() => {
        if (greetSeqRef.current === seq) setGreet(null);
      }, ms);
    };

    // 매칭 즉시 인사 → verify(153OS 장부)·checkin(라이브보드)은 백그라운드에서 확정
    const confirmAttendance = async (p: FaceProfile, seq: number) => {
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
        const reason: string | null = vr?.data?.reason ?? null;
        // 판정은 서버 allowed 기준(실차단 계약) — 부정을 기본값으로 둔다(필드 누락 시 통과 금지)
        const allowed: boolean = vr?.data?.allowed === true;
        const deny: string | null = allowed ? null : (reason || "no_valid_grant");
        const appUserId: string | null = vr?.data?.app_user_id ?? null;
        const daysLeft = daysLeftOf(vr?.data?.end_date);
        let already = false;
        if (appUserId && allowed) {
          // 라이브보드 체크인은 부가 경로 — 실패해도 출석(원장) 성공 표시를 바꾸지 않는다
          try {
            const { json: ck } = await api({ action: "checkin", user_id: appUserId, branch_name: branchName });
            already = ck?.already === true;
          } catch { /* 부가 경로 실패 무시 */ }
        }
        if (deny) {
          // 거절: 60초 뒤 재시도 허용 — 데스크에서 결제 직후 다시 인식할 수 있게(검수 반영)
          lastSeenRef.current.set(p.user_id, Date.now() - REMATCH_MS + 60_000);
        }
        if (!alive || greetSeqRef.current !== seq) return;
        // 응답이 느려 오버레이가 이미 사라졌어도(g === null) 결과를 다시 세운다 —
        // 그러지 않으면 거절 회원이 사유는 못 보고 거절음만 듣는다(검수 반영).
        setGreet((g) => (g && g.seq !== seq ? g : {
          seq,
          name: vr?.data?.name || g?.name || p.name,
          timeLine: g?.timeLine ?? timeGreeting(),
          phase: "done",
          already,
          deny,
          daysLeft,
        }));
        holdGreet(seq, deny ? 5000 : 3500);
        if (deny) chime("deny");
        else {
          chime("ok");
          speak(`${vr?.data?.name || p.name}님 환영합니다!`); // 호명은 통과 확정 후 — 거절자에게 환영 음성이 나가는 모순 방지
        }
      } catch {
        // 기록 실패(네트워크 등): 30초 뒤 재시도 — 즉시 해제하면 차임·호명 무한 반복(검수 반영)
        lastSeenRef.current.set(p.user_id, Date.now() - REMATCH_MS + 30_000);
        if (!alive || greetSeqRef.current !== seq) return;
        setGreet((g) => (g && g.seq !== seq ? g : {
          seq,
          name: g?.name ?? p.name,
          timeLine: g?.timeLine ?? timeGreeting(),
          phase: "done",
          already: false,
          deny: "network",
          daysLeft: null,
        }));
        holdGreet(seq, 4000);
        chime("deny");
      }
    };

    const showGreet = (p: FaceProfile) => {
      const seq = ++greetSeqRef.current;
      setGreet({ seq, name: p.name, timeLine: timeGreeting(), phase: "checking", already: false, deny: null, daysLeft: null });
      chime("ping"); // 인식됨 신호(중립음) — 통과/거절음과 호명은 판정 확정 후
      // 안전 타이머는 넉넉히(15초). 실제 소멸 시간은 결과 도착 시 holdGreet 이 다시 정한다.
      holdGreet(seq, 15_000);
      void confirmAttendance(p, seq);
    };

    const tick = async () => {
      if (!alive) return;
      if (enrollOpen || !videoRef.current || videoRef.current.readyState < 2) {
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
            if (now - last > REMATCH_MS) {
              lastSeenRef.current.set(best.p.user_id, now);
              showGreet(best.p);
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
  }, [ready, enrollOpen, api, osApi, branchName, chime, speak]);

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

  const greetEmoji = greet
    ? greet.phase === "checking" ? "🥊"
      : greet.deny === "expired_membership" ? "⏰"
      : greet.deny === "network" ? "⚠️"
      : greet.deny ? "📋"
      : greet.already ? "✅"
      : "🥊"
    : "🥊";

  const greetStatus = greet
    ? greet.phase === "checking" ? "출석 기록 중…"
      : greet.deny === "expired_membership" ? "이용권이 만료되었어요 — 데스크에 문의해주세요"
      : greet.deny === "consent_revoked" ? "얼굴 등록이 해제되어 있어요 — 데스크에서 재등록해주세요"
      : greet.deny === "network" ? "기록에 실패했어요 — 잠시 후 다시 인식해주세요"
      : greet.deny ? "출석 확인 — 데스크에서 회원 정보를 확인해주세요"
      : greet.already ? "오늘은 이미 출석했어요!"
      : "출석 완료! 좋은 운동 되세요"
    : "";

  return (
    // fixed + z-[80]: 앱 하단 메뉴·AI 버튼 위를 덮는 전체화면 키오스크 (등록 버튼 가림 사고 방지)
    <div className="fixed inset-0 z-[80] bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />

      {/* 상단 안내 */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <p className="rounded-full bg-black/60 px-4 py-2 text-sm font-black text-white">🥊 {branchName} · 얼굴 출석 (시범 운영)</p>
        {status && <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-white">{status}</p>}
      </div>

      {/* 인사 오버레이 — 매칭 즉시 표시, 기록 확정 시 문구 갱신 */}
      {greet && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
          <div className="animate-bounce-in w-full max-w-lg rounded-3xl bg-card p-10 text-center shadow-elev-3">
            <p className="text-6xl">{greetEmoji}</p>
            <p className="mt-4 text-4xl font-black text-foreground">{greet.name}님</p>
            <p className="mt-1.5 text-lg font-bold text-muted-foreground">{greet.timeLine}</p>
            <p className={`mt-3 text-xl font-black ${
              greet.phase === "checking" ? "text-muted-foreground"
                : greet.deny ? "text-status-pending"
                : "text-primary"
            }`}>
              {greetStatus}
            </p>
            {greet.phase === "done" && !greet.deny && greet.daysLeft !== null && greet.daysLeft <= 7 && (
              <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm font-bold text-status-pending">
                {greet.daysLeft <= 1
                  ? "이용권이 오늘까지예요 — 데스크에서 연장해주세요"
                  : `이용권이 ${greet.daysLeft}일 남았어요 — 미리 연장해두면 편해요`}
              </p>
            )}
          </div>
        </div>
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
                const list = (json?.data?.profiles || []) as { member_id: string; name: string; embedding: number[] }[];
                profilesRef.current = list.map((r) => ({ p: { user_id: r.member_id, name: r.name, embedding: r.embedding }, f32: Float32Array.from(r.embedding) }));
              } else {
                setStatus("명단 갱신 실패 — 새로고침 해주세요");
              }
            } catch {
              setStatus("명단 갱신 실패 — 새로고침 해주세요");
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
