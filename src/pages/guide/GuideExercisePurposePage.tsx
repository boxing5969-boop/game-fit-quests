import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EXERCISE_REASONS } from "@/data/exerciseReasonsData";

const GuideExercisePurposePage = () => {
  const navigate = useNavigate();

  return (
    <div className="light-surface min-h-screen mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">왜 이 운동을 하나요?</h1>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">
        각 훈련에는 과학적 이유가 있습니다. 왜 하는지 알면 훈련의 질이 달라집니다.
      </p>

      <div className="space-y-4">
        {EXERCISE_REASONS.map(ex => (
          <div key={ex.id} className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl">{ex.emoji}</span>
              <h3 className="text-base font-bold text-foreground">{ex.name}</h3>
            </div>
            <p className="mb-3 text-sm text-muted-foreground leading-relaxed">{ex.whyDoIt}</p>
            <div className="flex flex-wrap gap-1.5">
              {ex.whatImproves.map(tag => (
                <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuideExercisePurposePage;
