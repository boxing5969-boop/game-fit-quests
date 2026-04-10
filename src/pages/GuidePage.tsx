import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { GUIDE_SECTIONS } from "@/data/guideSectionsData";

const GuidePage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">가이드</h1>
      </div>

      {/* Hero */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-5 border border-primary/20">
        <h2 className="mb-2 text-lg font-bold text-foreground" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
          153랭크업 가이드
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          프로그램 철학, 과학적 설계, 1~40레벨 가치맵을 확인하세요.
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          WHO·CDC·ACSM 권고안을 참고해 설계됨
        </p>
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {GUIDE_SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => navigate(section.path)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-foreground">{section.label}</p>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Re-run onboarding */}
      <button
        onClick={() => navigate("/onboarding")}
        className="mt-6 w-full rounded-2xl border border-primary/30 bg-primary/5 py-4 text-center text-sm font-bold text-primary transition-all active:scale-[0.98]"
      >
        📖 온보딩 다시 보기
      </button>
    </div>
  );
};

export default GuidePage;
