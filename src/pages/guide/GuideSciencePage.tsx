import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity } from "lucide-react";

const GuideSciencePage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">과학적 설계</h1>
      </div>

      <p className="mb-5 text-xs text-muted-foreground/60">WHO·CDC·ACSM 권고안을 참고해 설계됨</p>

      {/* Weekly activity */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
          <Activity className="h-5 w-5 text-primary" /> 주간 활동분 구조
        </h2>
        <div className="space-y-2">
          {[
            { range: "0~149분", label: "시작 구간", desc: "작은 활동도 의미 있습니다. 조금씩 늘려보세요.", color: "bg-muted" },
            { range: "150~299분", label: "건강 권장 구간", desc: "WHO가 권고하는 주간 중강도 활동량입니다.", color: "bg-status-complete/10" },
            { range: "300분 이상", label: "추가 이점 구간", desc: "더 많은 건강 이점을 얻을 수 있는 구간입니다.", color: "bg-primary/10" },
          ].map(zone => (
            <div key={zone.range} className={`rounded-xl p-3 ${zone.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{zone.range}</span>
                <span className="text-xs font-medium text-primary">{zone.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{zone.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strength */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">💪 근력운동</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          주요 근육군을 포함한 근력운동을 <strong className="text-foreground">주 2회 이상</strong> 실시하는 것이 권장됩니다. 근육량 유지, 골밀도 보호, 대사 건강에 도움이 됩니다.
        </p>
      </div>

      {/* Intensity */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">🔥 강도 구분</h2>
        <div className="space-y-3">
          <div className="rounded-xl bg-accent/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">중강도</span>
              <span className="text-xs font-medium text-primary">RPE 3~4</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">대화가 가능하지만 노래는 어려운 정도</p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">고강도</span>
              <span className="text-xs font-medium text-primary">RPE 5~7</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">몇 마디 말한 뒤 숨을 고르는 정도</p>
          </div>
        </div>
      </div>

      {/* Recovery */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">🧘 회복과 앉아 있는 시간</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          오래 앉아 있는 시간을 줄이고, 짧은 움직임이라도 자주 하는 것이 건강에 도움이 됩니다. 3분만 움직여도 누적 효과가 있습니다.
        </p>
      </div>

      {/* Balance for 65+ */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">⚖️ 균형 훈련</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          65세 이상이거나 균형 능력이 약한 경우, 주 3회 이상의 균형 훈련이 낙상 예방에 도움이 됩니다. 복싱의 스텝 훈련은 자연스럽게 균형 능력을 향상시킵니다.
        </p>
      </div>
    </div>
  );
};

export default GuideSciencePage;
