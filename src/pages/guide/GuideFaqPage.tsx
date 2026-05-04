import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/data/guideSectionsData";
import { cn } from "@/lib/utils";

const GuideFaqPage = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="light-surface min-h-screen">
      {/* Header — clean, sticky, no decoration */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-5 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate("/guide")}
          aria-label="뒤로가기"
          className="flex h-9 w-9 items-center justify-center rounded-pill text-muted-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
          자주 묻는 질문
        </h1>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-24 pt-5">
        <p className="mb-4 text-[14px] leading-6 text-muted-foreground">
          마이복서153에 대해 가장 자주 묻는 질문을 모았습니다.
        </p>

        <ul className="space-y-2.5">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            return (
              <li
                key={i}
                className={cn(
                  "overflow-hidden rounded-[16px] border bg-card shadow-elev-1 transition-colors",
                  open ? "border-primary/30" : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-[15px] font-semibold leading-6 text-foreground">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      open ? "rotate-180 text-primary" : "text-muted-foreground",
                    )}
                  />
                </button>
                {open && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <p className="text-[14px] leading-6 text-muted-foreground">
                      {item.a}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
};

export default GuideFaqPage;
