import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { SAFETY_BLOCKS } from "@/data/safetyCheckData";
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface SafetyQuestion {
  id: string;
  question: string;
  riskFlag: boolean;
}

const SAFETY_QUESTIONS: SafetyQuestion[] = [
  { id: "recent_exercise", question: "최근 3개월 이내에 규칙적으로 운동한 적이 있나요?", riskFlag: false },
  { id: "chronic_condition", question: "심장 질환, 고혈압, 당뇨 등 기저질환이 있나요?", riskFlag: true },
  { id: "dizziness", question: "운동 중 어지럼증이나 흉통을 경험한 적이 있나요?", riskFlag: true },
  { id: "age_over_65", question: "65세 이상이신가요?", riskFlag: true },
  { id: "high_intensity_goal", question: "처음부터 높은 강도로 운동하고 싶으신가요?", riskFlag: true },
];

const STARTER_MODE_MESSAGE = "최근 활동량이 적거나 몸 상태가 걱정된다면 스타터 모드부터 시작하세요. 짧고 안전한 강도로 시작해도 충분히 의미 있습니다.";
const SAFETY_DISCLAIMER = "이 체크리스트는 의료 진단이 아닙니다. 건강 상태가 걱정되면 운동 시작 전에 전문가와 상담하세요.";

const SafetyCheckPage = () => {
  const navigate = useNavigate();
  const { completeSafety, safetyDone } = useOnboardingState();
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [showResult, setShowResult] = useState(false);

  const allAnswered = SAFETY_QUESTIONS.every(q => answers[q.id] !== undefined && answers[q.id] !== null);

  const riskCount = SAFETY_QUESTIONS.filter(q => {
    const answer = answers[q.id];
    if (answer === null || answer === undefined) return false;
    return q.riskFlag ? answer === true : answer === false;
  }).length;

  const recommendStarter = riskCount >= 2;

  const handleSubmit = () => setShowResult(true);

  const handleContinue = () => {
    completeSafety(recommendStarter);
    navigate("/home", { replace: true });
  };

  return (
    <div className="light-surface min-h-screen mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">안전 체크</h1>
        {safetyDone && (
          <button onClick={() => navigate("/home", { replace: true })} className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground active:scale-95">
            홈으로
          </button>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-foreground">안전한 시작을 위한 간단 체크</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{SAFETY_DISCLAIMER}</p>
      </div>

      {!showResult ? (
        <>
          <div className="space-y-3">
            {SAFETY_QUESTIONS.map(q => (
              <div key={q.id} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
                <p className="mb-3 text-sm font-medium text-foreground">{q.question}</p>
                <div className="flex gap-2">
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: val }))}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
                        answers[q.id] === val
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {val ? "예" : "아니오"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-40"
          >
            결과 확인
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {recommendStarter ? (
            <div className="rounded-2xl border-2 border-reward/50 bg-reward/5 p-5 shadow-elev-1">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-reward" />
                <span className="text-base font-bold text-foreground">스타터 모드를 추천합니다</span>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{STARTER_MODE_MESSAGE}</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ 저강도에서 시작</p>
                <p>✓ 짧은 세션으로 적응</p>
                <p>✓ 천천히 강도를 높이는 흐름</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-status-complete/30 bg-status-complete/5 p-5 shadow-elev-1">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-status-complete" />
                <span className="text-base font-bold text-foreground">준비가 되었습니다!</span>
              </div>
              <p className="text-sm text-muted-foreground">현재 상태에서 안전하게 훈련을 시작할 수 있습니다. 언제든 몸에 이상이 느껴지면 운동을 중단하세요.</p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/60">
            건강 상태가 걱정되면 운동 시작 전에 전문가와 상담하세요.
          </p>

          <button
            onClick={handleContinue}
            className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98]"
          >
            {recommendStarter ? "🥊 스타터 모드로 시작" : "🥊 훈련 시작"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SafetyCheckPage;
