import { useState } from "react";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SparringConsentModalProps {
  participantDefaultName?: string;
  onClose: () => void;
  onSigned: (row: { id: string; status: string }) => void;
}

// 스파링 참가 안전 동의서 (정본: 153_BOXING_MASTER_CURRICULUM/00_GOVERNANCE/SPARRING_CONSENT_FORM.md, v1)
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
  const [submitting, setSubmitting] = useState(false);

  const healthValid = healthChoice === "none" || (healthChoice === "note" && healthNote.trim().length > 0);
  const guardianValid =
    !isMinor ||
    (guardianName.trim().length > 0 &&
      guardianRelation.trim().length > 0 &&
      guardianPhone.trim().length > 0 &&
      guardianSignature.trim().length > 0);
  const canSubmit =
    agreedRules && healthValid && participantName.trim().length > 0 && guardianValid && !submitting;

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
        form_version: "v1",
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
      })
      .select("id,status")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("동의서 제출에 실패했습니다. 다시 시도해 주세요");
      return;
    }
    toast.success("스파링 동의가 완료되었습니다");
    onSigned({ id: data.id, status: data.status });
  };

  const fieldClass =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

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
          <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
            🥊 스파링 참가 동의서
          </h3>
          <button onClick={onClose} className="rounded-full bg-secondary p-2 active:scale-95">
            <X className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>

        {/* 위험 고지 */}
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-destructive">
            <ShieldAlert className="h-4 w-4" /> 위험 고지 — 반드시 읽어주세요
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            통제된 라이트 스파링은 실제로 타격을 주고받는 접촉 훈련입니다. 코치 감독과 규칙에도 불구하고
            타박상 · 코피 · 입술/치아 손상 · 염좌, 드물게 뇌진탕 등 부상 위험이 존재함을 이해합니다.
          </p>
        </div>

        {/* 참가 조건 */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold text-foreground">참가 조건 (모두 준수하는 조건으로 참가)</p>
          <ul className="space-y-1.5">
            {CONDITIONS.map((c, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="mt-0.5 text-primary">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 건강 상태 확인 */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold text-foreground">건강 상태 확인</p>
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
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
              <span className="text-xs font-medium text-foreground">위 해당사항 없음</span>
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
              <span className="text-xs font-medium text-foreground">해당사항 있어 코치에게 고지함</span>
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
          <span className="text-[11px] leading-relaxed text-foreground">
            본인은 자발적으로 참가하며, 위 조건과 코치의 지시를 따릅니다. 규칙 위반(강타 · 중단신호 불이행 등)으로
            발생한 결과에 대한 책임을 인지하고, 통증 · 어지럼 등 이상 증상이 있으면 즉시 알리고 중단하겠습니다.
          </span>
        </button>

        {/* 참가자 서명 */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold text-foreground">참가자 성명 (서명)</label>
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
          <span className="text-xs font-bold text-foreground">참가자가 만 18세 미만(미성년자)입니다</span>
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
            <p className="text-[11px] font-bold text-foreground">법정대리인 동의 (필수)</p>
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
        <p className="mb-4 text-[10px] leading-relaxed text-muted-foreground">
          ※ 본 동의서는 안전 위험 고지와 자발적 참가 확인을 위한 것입니다. 대한민국 법상 사업자의 고의 또는
          중대한 과실로 인한 손해에 대한 책임까지 면제되지는 않습니다.
        </p>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? "제출 중..." : "동의하고 신청"}
        </button>
      </div>
    </div>
  );
};

export default SparringConsentModal;
