import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

interface ExerciseWhyCardProps {
  purposeSummary: string;
  purposeTags: string[];
}

/** Collapsible "왜 하나요?" component for training/mission cards */
const ExerciseWhyCard = ({ purposeSummary, purposeTags }: ExerciseWhyCardProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-xl border border-primary/10 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-all active:bg-primary/10"
      >
        <div className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">왜 하나요?</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-primary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-primary/10 px-3 py-2.5">
          <p className="mb-2 text-xs text-muted-foreground leading-relaxed">{purposeSummary}</p>
          <div className="flex flex-wrap gap-1">
            {purposeTags.map(tag => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseWhyCard;
