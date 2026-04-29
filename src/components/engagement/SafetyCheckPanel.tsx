/**
 * 153 QUEST — 챌린지 아레나: 안전(통증) 체크 패널.
 *
 * pain_check_required 에 포함된 부위마다 두 개 버튼:
 *   · "통증 없음" → status="none" (보상 가능)
 *   · "통증 있음" → status="pain" (제출 차단 + 중단 안내)
 *
 * 미선택(undefined) 상태도 제출 차단 — 부모가 allPainChecked 로 판단.
 */

import { ShieldAlert } from "lucide-react";

const PART_LABEL: Record<string, string> = {
  wrist: "손목",
  shoulder: "어깨",
  knee: "무릎",
  back: "허리",
  ankle: "발목",
  elbow: "팔꿈치",
  hip: "고관절",
};

export type PainStatus = "none" | "pain";
export type PainChecks = Record<string, PainStatus | undefined>;

export interface SafetyCheckPanelProps {
  required: string[];
  values: PainChecks;
  onChange: (next: PainChecks) => void;
}

const SafetyCheckPanel = ({ required, values, onChange }: SafetyCheckPanelProps) => {
  if (!required || required.length === 0) return null;

  const setStatus = (part: string, status: PainStatus) => {
    onChange({ ...values, [part]: status });
  };

  const hasPain = required.some((p) => values[p] === "pain");

  return (
    <div className="rounded-card border border-amber-400/40 bg-amber-400/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500" />
        <p className="text-[12px] font-bold text-foreground">통증 체크</p>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        통증이 있으면 즉시 중단하세요. 이 챌린지는 공식 승급 조건이 아닌 보조
        챌린지입니다. 무리하지 않고 정확한 자세를 우선합니다.
      </p>

      <div className="space-y-2.5">
        {required.map((part) => {
          const current = values[part];
          const label = PART_LABEL[part] ?? part;
          return (
            <div key={part}>
              <p className="mb-1 text-[12px] font-bold text-foreground">
                {label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatus(part, "none")}
                  className={`rounded-card border px-2.5 py-2 text-[11.5px] transition-all active:scale-[0.99] ${
                    current === "none"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 font-bold"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                  aria-pressed={current === "none"}
                >
                  통증 없음
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(part, "pain")}
                  className={`rounded-card border px-2.5 py-2 text-[11.5px] transition-all active:scale-[0.99] ${
                    current === "pain"
                      ? "border-destructive bg-destructive/10 text-destructive font-bold"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                  aria-pressed={current === "pain"}
                >
                  통증 있음
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hasPain && (
        <p className="mt-3 rounded-card border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] leading-relaxed text-destructive">
          통증이 있다면 이 챌린지는 중단하세요. 무리하지 않고 코치에게 상태를
          알려주세요.
        </p>
      )}
    </div>
  );
};

export default SafetyCheckPanel;
