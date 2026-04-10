import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/data/guideSectionsData";

const GuideFaqPage = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">자주 묻는 질문</h1>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between p-4 text-left transition-all active:bg-secondary/50"
            >
              <span className="text-sm font-bold text-foreground pr-3">{item.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openIndex === i ? "rotate-180" : ""}`} />
            </button>
            {openIndex === i && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuideFaqPage;
