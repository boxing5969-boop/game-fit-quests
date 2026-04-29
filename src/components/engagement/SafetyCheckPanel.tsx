/**
 * 153 QUEST — 챌린지 아레나: 안전(통증) 체크 패널.
 *
 * pain_check_required 에 포함된 부위만 표시한다.
 * 모든 항목 OK 여부를 부모에 onChange 로 알림.
 */

import { ShieldAlert } from "lucide-react";

const PART_LABEL: Record<string, string> = {
  wrist: "손목",
  shoulder: "어깨",
  knee: "무릎",
  back: "허리",
};

const SUPPORTED_PARTS = ["wrist", "shoulder", "knee", "back"] as const;

export interface SafetyCheckPanelProps {
  required: string[];
  values: Record<string, boolean>; // true = 통증 없음/OK
  onChange: (next: Record<string, boolean>) => void;
}

const SafetyCheckPanel = ({ required, values, onChange }: SafetyCheckPanelProps) => {
  const parts = SUPPORTED_PARTS.filter((p) => required.includes(p));

  if (parts.length === 0) return null;

  const toggle = (part: string) => {
    onChange({ ...values, [part]: !values[part] });
  };

  return (
    <div className="rounded-card border border-amber-400/40 bg-amber-400/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500" />
        <p className="text-[12px] font-bold text-foreground">통증 체크</p>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        통증이 있으면 즉시 중단하세요. 이 챌린지는 공식 승급 조건이 아닌 보조
        챌린지입니다. 무리하지 않고 정확한 자세를 우선합니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {parts.map((part) => {
          const ok = !!values[part];
          return (
            <button
              key={part}
              type="button"
              onClick={() => toggle(part)}
              className={`rounded-card border px-3 py-2 text-left text-[12px] transition-all active:scale-[0.99] ${
                ok
                  ? "border-emerald-400 bg-emerald-400/10 text-foreground font-bold"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {ok ? "통증 없음" : "체크 필요"}
              </span>
              <span className="block">{PART_LABEL[part] ?? part}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SafetyCheckPanel;
