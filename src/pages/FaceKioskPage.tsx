// 얼굴 키오스크 (파일럿) — 선릉 기존 안드로이드 키오스크 브라우저에서 실행.
// 경로: /face-kiosk/:branchCode (라이브보드와 같은 공개 라우트 패턴)
//
// 원칙:
//  - 얼굴 사진을 서버로 보내지 않는다. 브라우저 안에서 128차원 특징값만 계산해 전송.
//  - 인식도 브라우저 온디바이스(face-api.js CDN) — 서버는 목록·출석 기록만.
//  - XP 미지급(QR 정책 유지). qr-checkin·브로제이 브리지 무수정 — 완전 병렬 경로.
//  - 등록은 동의 체크 필수. 파일럿 기간엔 코치·직원만 등록 권장.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-kiosk`; // 앱측: 라이브보드 즉시 표시용
const OS_URL = "https://153-boxing-os-api.boxing5969.workers.dev/api/face";     // 153OS: 판단·등록·장부(FC-2)
const KEY_LS = "153_kiosk_key";
const CDN = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2";
const MATCH_DIST = 0.5;          // face-api 권장 임계 (낮을수록 엄격)
const REMATCH_MS = 5 * 60_000;   // 같은 회원 재인식 무시 간격

interface FaceProfile { user_id: string; name: string; embedding: number[] } // user_id = 153OS member_id

const FaceKioskPage = () => {
  const { branchCode } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [branchName, setBranchName] = useState<string>("");
  const [kioskKey, setKioskKey] = useState<string>(() => localStorage.getItem(KEY_LS) || "");
  const [status, setStatus] = useState<string>("준비 중…");
  const [ready, setReady] = useState(false);
  const [greet, setGreet] = useState<{ name: string; already: boolean; deny?: string | null } | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const profilesRef = useRef<{ p: FaceProfile; f32: Float32Array }[]>([]);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const busyRef = useRef(false);

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

  // face-api 스크립트 + 모델 + 카메라 + 등록 목록
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
        await Promise.all([
          fa.nets.tinyFaceDetector.loadFromUri(`${CDN}/weights`),
          fa.nets.faceLandmark68Net.loadFromUri(`${CDN}/weights`),
          fa.nets.faceRecognitionNet.loadFromUri(`${CDN}/weights`),
        ]);
        if (stop) return;
        setStatus("등록 회원 불러오는 중…");
        const { status: st, json } = await osApi("list", {});
        if (st === 401) { setStatus("키오스크 키가 올바르지 않아요"); localStorage.removeItem(KEY_LS); setKioskKey(""); return; }
        const list = (json?.data?.profiles || []) as { member_id: string; name: string; embedding: number[] }[];
        profilesRef.current = list.map((r) => ({ p: { user_id: r.member_id, name: r.name, embedding: r.embedding }, f32: Float32Array.from(r.embedding) }));
        setStatus("카메라 켜는 중…");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        setReady(true);
        setStatus("");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "초기화 실패 — 새로고침 해주세요");
      }
    })();
    return () => { stop = true; };
  }, [kioskKey, branchName, api]);

  // 인식 루프
  useEffect(() => {
    if (!ready) return;
    const fa = (window as any).faceapi;
    const timer = setInterval(async () => {
      if (busyRef.current || enrollOpen || !videoRef.current) return;
      busyRef.current = true;
      try {
        const det = await fa
          .detectSingleFace(videoRef.current, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks().withFaceDescriptor();
        if (det?.descriptor && profilesRef.current.length > 0) {
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
              // ① 153OS 판단 + 출입장부(access_logs) 기록
              const { json: vr } = await osApi("verify", { member_id: best.p.user_id });
              const reason: string | null = vr?.data?.reason ?? null;
              const appUserId: string | null = vr?.data?.app_user_id ?? null;
              // ② 앱 계정이 연결된 회원이면 라이브보드 즉시 표시
              let already = false;
              if (appUserId) {
                const { json: ck } = await api({ action: "checkin", user_id: appUserId, branch_name: branchName });
                already = ck?.already === true;
              }
              setGreet({ name: vr?.data?.name || best.p.name, already, deny: reason });
              setTimeout(() => setGreet(null), 4500);
            }
          }
        }
      } catch { /* 프레임 스킵 */ }
      busyRef.current = false;
    }, 900);
    return () => clearInterval(timer);
  }, [ready, enrollOpen, api, branchName]);

  // ── 키 입력 화면 ──
  if (!kioskKey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
        <p className="text-lg font-black text-foreground">🥊 153 얼굴 키오스크 설정</p>
        <p className="text-sm text-muted-foreground">관리자에게 받은 키오스크 키를 입력하세요 (최초 1회)</p>
        <input
          type="password" placeholder="키오스크 키"
          className="w-full max-w-sm rounded-xl border border-border bg-card p-3 text-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) { localStorage.setItem(KEY_LS, v); setKioskKey(v); }
            }
          }}
        />
        <p className="text-xs text-muted-foreground">입력 후 Enter</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      <video ref={videoRef} muted playsInline className="h-screen w-full object-cover" style={{ transform: "scaleX(-1)" }} />

      {/* 상단 안내 */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <p className="rounded-full bg-black/60 px-4 py-2 text-sm font-black text-white">🥊 {branchName} · 얼굴 출석 (시범 운영)</p>
        {status && <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-white">{status}</p>}
      </div>

      {/* 인사 오버레이 */}
      {greet && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="animate-bounce-in rounded-3xl bg-card p-10 text-center shadow-elev-3">
            <p className="text-5xl">{greet.deny === "expired_membership" ? "⏰" : greet.deny ? "📋" : greet.already ? "✅" : "🥊"}</p>
            <p className="mt-4 text-3xl font-black text-foreground">{greet.name}님</p>
            <p className={`mt-2 text-lg font-bold ${greet.deny ? "text-status-pending" : "text-primary"}`}>
              {greet.deny === "expired_membership" ? "이용권이 만료되었어요 — 데스크에 문의해주세요"
                : greet.deny ? "출석 확인 — 데스크에서 회원 정보를 확인해주세요"
                : greet.already ? "오늘은 이미 출석했어요!"
                : "어서오세요! 출석 완료"}
            </p>
          </div>
        </div>
      )}

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
            const { json } = await osApi("list", {});
            const list = (json?.data?.profiles || []) as { member_id: string; name: string; embedding: number[] }[];
            profilesRef.current = list.map((r) => ({ p: { user_id: r.member_id, name: r.name, embedding: r.embedding }, f32: Float32Array.from(r.embedding) }));
          }}
          onClose={() => setEnrollOpen(false)}
        />
      )}
    </div>
  );
};

// ── 등록 시트 ──
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
  const embsRef = useRef<number[][]>([]);
  const [saving, setSaving] = useState(false);

  const lookup = async () => {
    setMsg("조회 중…");
    const { json } = await osApi("lookup", { phone });
    if (json?.success) { setMember({ user_id: json.data.member_id, label: json.data.name || "회원", enrolled: json.data.enrolled }); setMsg(""); }
    else setMsg(json?.error?.message || "조회 실패");
  };

  const capture = async () => {
    const fa = (window as any).faceapi;
    if (!video.current) return;
    setMsg("촬영 중… 카메라를 봐주세요");
    const det = await fa
      .detectSingleFace(video.current, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks().withFaceDescriptor();
    if (!det?.descriptor) { setMsg("얼굴을 찾지 못했어요 — 정면을 봐주세요"); return; }
    embsRef.current.push(Array.from(det.descriptor as Float32Array));
    setShots(embsRef.current.length);
    setMsg(embsRef.current.length >= 3 ? "충분해요! 저장을 눌러주세요" : "좋아요, 각도를 살짝 바꿔 한 번 더");
  };

  const save = async () => {
    if (!member || embsRef.current.length === 0) return;
    setSaving(true);
    const { json } = await osApi("enroll", { member_id: member.user_id, embeddings: embsRef.current, consent });
    setSaving(false);
    if (json?.success) { setMsg("등록 완료!"); setTimeout(onDone, 800); }
    else setMsg(json?.error?.message || "등록 실패");
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
                얼굴 특징값(사진 아님)을 출석 확인 목적으로 수집·이용하는 데 동의합니다.
                언제든 삭제 요청할 수 있으며, 동의하지 않아도 QR 로 출석할 수 있습니다.
              </span>
            </label>
            <div className="flex gap-2">
              <button onClick={capture} disabled={!consent}
                className="flex-1 rounded-xl bg-secondary py-3 font-bold text-secondary-foreground disabled:opacity-40">
                촬영 ({shots}/3)
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
