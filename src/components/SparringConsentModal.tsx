import { useState } from "react";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SparringConsentRow {
  id: string;
  status: string;
  form_version?: string | null;
  video_ok?: boolean | null;
}

interface SparringConsentModalProps {
  participantDefaultName?: string;
  onClose: () => void;
  onSigned: (row: SparringConsentRow) => void;
}

/** 영상 동의 문구 판 — 문구를 바꾸면 올린다(DB video_terms) */
export const SPARRING_VIDEO_TERMS = "sv1";

// 스파링 영상 (v2 · 2026-11-25 스파링 영상 1차 — docs/features/64-스파링-영상.md). 선택 동의: 안 해도 스파링은 한다.
const VIDEO_POINTS = [
  "링 옆 카메라로 스파링을 찍어 「내 스파링 영상」에서 다시 보고 코치 피드백을 받습니다. 소리는 녹음하지 않습니다.",
  "영상은 지점 유튜브 채널에 '일부공개'로 둡니다. 목록과 검색에는 나오지 않지만 링크를 가진 사람은 누구나 볼 수 있습니다.",
  "같이 스파링한 상대 회원도 같은 영상을 받습니다.",
  "동의를 거두거나 회원을 그만두면 영상을 내립니다. 원본 녹화는 7일 뒤 지웁니다.",
  "동의하지 않아도 스파링은 그대로 합니다. 내가 나온 경기는 영상으로 만들지 않고 원본 녹화도 지웁니다.",
];

// 스파링 참가 안전 동의서 (정본: 153_BOXING_MASTER_CURRICULUM/00_GOVERNANCE/SPARRING_CONSENT_FORM.md, v1 · 영상 칸 v2)
const CONDITIONS = [
  "보호장비 필수 착용 — 헤드기어 · 마우스피스 · 글러브(체중별 14~16oz) · 손붕대",
  "코치 감독 하에서만 진행 (무감독 스파링 금지)",
  "컨트롤(터치) 강도 유지 · 강타 금지 — 상대 머리가 젖혀지는 타격은 즉시 중단",
  "중단 신호('스톱' 구령 · 글러브 오픈 · 코치 호각) 즉시 준수",
  "지정된 체중 · 경력 · 연령 매칭 규칙 준수",
];

const SparringConsentModal = ({ participantDefaultName = "", onClose, onSigned }: SparringConsentModalProps) => {
  const { user } = useAuth();
  const [healthChoice, setHealthChoice] = useState<"none" | "note" | null>(null);
  const [healthNote, setHealthNote] = useState("");
  const [agreedRules, setAgreedRules] = useState(false);
  const [participantName, setParticipantName] = useState(participantDefaultName);
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianSignature, setGuardianSignature] = useState("");
  const [under14, setUnder14] = useState(false);
  const [videoChoice, setVideoChoice] = useState<"yes" | "no" | null>(null);
  const [videoShare, setVideoShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 만 14세 미만은 1차(유튜브)에서 찍지 않는다
  const videoBlocked = isMinor && under14;
  const videoOk = videoChoice === "yes" && !videoBlocked;

  const healthValid = healthChoice === "none" || (healthChoice === "note" && healthNote.trim().length > 0);
  const guardianValid =
    !isMinor ||
    (guardianName.trim().length > 0 &&
      guardianRelation.trim().length > 0 &&
      guardianPhone.trim().length > 0 &&
      guardianSignature.trim().length > 0);
  const videoValid = videoBlocked || videoChoice !== null;
  const canSubmit =
    agreedRules && healthValid && participantName.trim().length > 0 && guardianValid && videoValid && !submitting;

  const handleSubmit = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (!canSubmit) {
      toast.error("필수 항목을 모두 확인해 주세요");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("sparring_consents")
      .insert({
        user_id: user.id,
        form_version: "v2",
        agreed_rules: true,
        health_ok: healthChoice === "none",
        health_note: healthChoice === "note" ? healthNote.trim() : null,
        participant_name: participantName.trim(),
        is_minor: isMinor,
        guardian_name: isMinor ? guardianName.trim() : null,
        guardian_relation: isMinor ? guardianRelation.trim() : null,
        guardian_phone: isMinor ? guardianPhone.trim() : null,
        guardian_signature: isMinor ? guardianSignature.trim() : null,
        status: "signed",
        minor_under14: videoBlocked,
        video_ok: videoOk,
        video_share_ok: videoOk && videoShare,
        video_terms: SPARRING_VIDEO_TERMS,
        video_agreed_at: videoOk ? new Date().toISOString() : null,
      })
      .select("id,status")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("동의서 제출에 실패했습니다. 다시 시도해 주세요");
      return;
    }
    toast.success(videoOk ? "스파링 동의 완료 · 영상 촬영도 동의하셨어요" : "스파링 동의가 완료되었습니다");
    onSigned({ id: data.id, status: data.status, form_version: "v2", video_ok: videoOk });
  };

  const fieldClass =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-heading font-bold text-foreground">
            🥊 스파링 참가 동의서
          </h3>
          <button onClick={onClose} className="rounded-full bg-secondary p-2 active:scale-95">
            <X className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>

        {/* 위험 고지 */}
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-label font-bold text-destructive">
            <ShieldAlert className="h-4 w-4" /> 위험 고지 — 반드시 읽어주세요
          </div>
          <p className="text-label leading-relaxed text-muted-foreground">
            통제된 라이트 스파링은 실제로 타격을 주고받는 접촉 훈련입니다. 코치 감독과 규칙에도 불구하고
            타박상 · 코피 · 입술/치아 손상 · 염좌, 드물게 뇌진탕 등 부상 위험이 존재함을 이해합니다.
          </p>
        </div>

        {/* 참가 조건 */}
        <div className="mb-4">
          <p className="mb-2 text-label font-bold text-foreground">참가 조건 (모두 준수하는 조건으로 참가)</p>
          <ul className="space-y-1.5">
            {CONDITIONS.map((c, i) => (
              <li key={i} className="flex gap-2 text-label leading-relaxed text-muted-foreground">
                <span className="mt-0.5 text-primary">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 건강 상태 확인 */}
        <div className="mb-4">
          <p className="mb-2 text-label font-bold text-foreground">건강 상태 확인</p>
          <p className="mb-2 text-label leading-relaxed text-muted-foreground">
            심혈관 · 뇌 질환, 최근 뇌진탕, 고혈압, 임신, 수술 회복 중 등 격렬한 운동이 부적절한 상태는
            사전에 코치에게 고지해야 하며, 필요 시 참가가 제한됩니다. 음주 · 수면부족 등 컨디션 난조 시 당일 불참합니다.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setHealthChoice("none")}
              className={`flex w-full items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                healthChoice === "none" ? "border-status-complete/40 bg-status-complete/5" : "border-border"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                  healthChoice === "none" ? "bg-status-complete text-white" : "bg-muted"
                }`}
              >
                {healthChoice === "none" && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <span className="text-label font-medium text-foreground">위 해당사항 없음</span>
            </button>
            <button
              type="button"
              onClick={() => setHealthChoice("note")}
              className={`flex w-full items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                healthChoice === "note" ? "border-status-pending/40 bg-status-pending/5" : "border-border"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                  healthChoice === "note" ? "bg-status-pending text-white" : "bg-muted"
                }`}
              >
                {healthChoice === "note" && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <span className="text-label font-medium text-foreground">해당사항 있어 코치에게 고지함</span>
            </button>
            {healthChoice === "note" && (
              <textarea
                value={healthNote}
                onChange={(e) => setHealthNote(e.target.value)}
                placeholder="고지 내용을 입력해 주세요 (예: 최근 발목 염좌 회복 중)"
                rows={2}
                className={fieldClass}
              />
            )}
          </div>
        </div>

        {/* 규칙 동의 */}
        <button
          type="button"
          onClick={() => setAgreedRules((v) => !v)}
          className={`mb-4 flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
            agreedRules ? "border-primary/40 bg-primary/5" : "border-border"
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
              agreedRules ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {agreedRules && <CheckCircle2 className="h-3.5 w-3.5" />}
          </span>
          <span className="text-label leading-relaxed text-foreground">
            본인은 자발적으로 참가하며, 위 조건과 코치의 지시를 따릅니다. 규칙 위반(강타 · 중단신호 불이행 등)으로
            발생한 결과에 대한 책임을 인지하고, 통증 · 어지럼 등 이상 증상이 있으면 즉시 알리고 중단하겠습니다.
          </span>
        </button>

        {/* 스파링 영상 (선택 · v2) */}
        <div className="mb-4 rounded-xl border border-border bg-secondary/30 p-3">
          <p className="mb-1 text-label font-bold text-foreground">🎥 스파링 영상 촬영 (선택)</p>
          <ul className="mb-2 space-y-1">
            {VIDEO_POINTS.map((t, i) => (
              <li key={i} className="flex gap-2 text-label leading-relaxed text-muted-foreground">
                <span className="mt-0.5 text-primary">·</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {videoBlocked ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-label font-medium text-foreground">
              만 14세 미만은 지금은 촬영하지 않습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["yes", "촬영에 동의합니다"],
                  ["no", "촬영하지 않습니다"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVideoChoice(v)}
                  className={`rounded-xl border px-2 py-2.5 text-label font-bold transition-all active:scale-[0.98] ${
                    videoChoice === v
                      ? v === "yes"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-foreground/30 bg-card text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {videoOk && (
            <button
              type="button"
              onClick={() => setVideoShare((v) => !v)}
              className="mt-2 flex w-full items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-left"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                  videoShare ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {videoShare && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <span className="text-label leading-relaxed text-foreground">
                우리 지점 회원들이 앱에서 봐도 됩니다 <span className="text-muted-foreground">(선택 · 같이 나온 사람도 동의한 영상만 「우리 지점 영상」에 올라가고, 영상마다 다시 고를 수 있습니다)</span>
              </span>
            </button>
          )}
          <p className="mt-2 text-micro leading-relaxed text-muted-foreground">
            국외 보관: Google LLC(미국) · 스파링 영상 · 유튜브에 올릴 때 · 보관과 재생 · 동의를 거두거나 탈퇴할 때까지 · 거부하면 촬영하지 않음
          </p>
        </div>

        {/* 참가자 서명 */}
        <div className="mb-4">
          <label className="mb-1 block text-label font-bold text-foreground">참가자 성명 (서명)</label>
          <input
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="이름을 입력해 서명을 대신합니다"
            className={fieldClass}
          />
        </div>

        {/* 미성년자 토글 */}
        <button
          type="button"
          onClick={() => setIsMinor((v) => !v)}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-border bg-secondary/40 p-3 text-left active:scale-[0.99]"
        >
          <span className="text-label font-bold text-foreground">참가자가 만 18세 미만(미성년자)입니다</span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              isMinor ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isMinor ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>

        {/* 법정대리인 (미성년자 시 필수) */}
        {isMinor && (
          <div className="mb-4 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-micro font-bold text-foreground">법정대리인 동의 (필수)</p>
            <button
              type="button"
              onClick={() => setUnder14((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left"
            >
              <span className="text-label font-medium text-foreground">참가자가 만 14세 미만입니다</span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${under14 ? "bg-primary" : "bg-muted"}`}>
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    under14 ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
            {videoOk && (
              <p className="text-micro leading-relaxed text-muted-foreground">
                법정대리인은 위 스파링 영상 촬영 선택에도 함께 동의합니다.
              </p>
            )}
            <input
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="법정대리인 성명"
              className={fieldClass}
            />
            <input
              value={guardianRelation}
              onChange={(e) => setGuardianRelation(e.target.value)}
              placeholder="관계 (예: 부 / 모)"
              className={fieldClass}
            />
            <input
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              inputMode="tel"
              placeholder="법정대리인 연락처"
              className={fieldClass}
            />
            <input
              value={guardianSignature}
              onChange={(e) => setGuardianSignature(e.target.value)}
              placeholder="법정대리인 성명(서명)"
              className={fieldClass}
            />
          </div>
        )}

        {/* 법적 안내 */}
        <p className="mb-4 text-label leading-relaxed text-muted-foreground">
          ※ 본 동의서는 안전 위험 고지와 자발적 참가 확인을 위한 것입니다. 대한민국 법상 사업자의 고의 또는
          중대한 과실로 인한 손해에 대한 책임까지 면제되지는 않습니다.
        </p>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? "제출 중..." : "동의하고 신청"}
        </button>
      </div>
    </div>
  );
};

export default SparringConsentModal;
