import { cn } from "@/lib/utils";

interface DietMoodPickerProps {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  className?: string;
}

const OPTIONS = [
  { id: "good", label: "좋음" },
  { id: "soso", label: "보통" },
  { id: "tired", label: "지침" },
  { id: "slipped", label: "무너짐" },
] as const;

/**
 * 오늘 기분 4-픽.
 * "무너짐" 을 선택해도 부끄럽지 않도록 친절한 톤으로 라벨링.
 */
export const DietMoodPicker = ({
  value,
  onChange,
  className,
}: DietMoodPickerProps) => (
  <div className={cn("grid grid-cols-4 gap-1.5", className)}>
    {OPTIONS.map((o) => {
      const active = value === o.id;
      return (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(active ? null : o.id)}
          className={cn(
            "rounded-xl border px-2 py-2 text-[12px] font-bold transition-colors",
            active
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:border-primary/40",
          )}
          aria-pressed={active}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export default DietMoodPicker;
