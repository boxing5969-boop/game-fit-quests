import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";

const GuideSafetyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">안전 가이드</h1>
      </div>

      {/* Beginner warnings */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" /> 초보자 주의사항
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• 처음에는 강도보다 정확한 자세에 집중하세요.</p>
          <p>• 충분히 워밍업한 뒤 본 훈련을 시작하세요.</p>
          <p>• 핸드랩과 글러브를 올바르게 착용하세요.</p>
          <p>• 쿨다운과 스트레칭으로 마무리하세요.</p>
        </div>
      </div>

      {/* Emergency stop */}
      <div className="mb-5 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5 shadow-elev-1">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" /> 즉시 중단해야 할 때
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• 운동 중 <strong className="text-destructive">흉통이나 가슴 압박</strong>이 느껴질 때</p>
          <p>• <strong className="text-destructive">어지럼증이나 시야 흐림</strong>이 발생할 때</p>
          <p>• 심한 <strong className="text-destructive">관절 통증이나 부상</strong>이 의심될 때</p>
          <p>• <strong className="text-destructive">호흡 곤란</strong>이 심해질 때</p>
        </div>
      </div>

      {/* Pre-existing conditions */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <h2 className="mb-3 text-base font-bold text-foreground">⚠️ 기저질환 및 장기간 비활동</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          심장 질환, 고혈압, 당뇨 등 기저질환이 있거나, 3개월 이상 운동을 하지 않았다면 
          시작 전에 의료 전문가와 상담하는 것이 좋습니다.
        </p>
      </div>

      {/* High intensity */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <h2 className="mb-3 text-base font-bold text-foreground">🔥 고강도 시작 전</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          고강도 운동을 처음 시작하려면 먼저 중강도에서 충분히 적응한 뒤 
          점진적으로 강도를 높이세요. 갑작스러운 고강도 운동은 부상 위험을 높일 수 있습니다.
        </p>
      </div>

      {/* Starter Mode */}
      <div className="rounded-2xl border border-reward/30 bg-reward/5 p-5 shadow-elev-1">
        <h2 className="mb-3 text-base font-bold text-foreground">🌱 스타터 모드</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          최근 활동량이 적거나 몸 상태가 걱정된다면 스타터 모드를 이용하세요.
        </p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>✓ 저강도에서 시작</p>
          <p>✓ 짧은 세션으로 적응</p>
          <p>✓ 천천히 강도를 높이는 흐름</p>
        </div>
        <button
          onClick={() => navigate("/safety-check")}
          className="mt-4 w-full rounded-xl bg-reward py-3 text-sm font-bold text-reward-foreground transition-all active:scale-95"
        >
          안전 체크 해보기
        </button>
      </div>
    </div>
  );
};

export default GuideSafetyPage;
