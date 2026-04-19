import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const GuideProgramPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">프로그램 소개</h1>
      </div>

      {/* Philosophy */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <h2 className="mb-3 text-base font-bold text-foreground">🥊 153랭크업 철학</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          153랭크업은 복싱을 통해 1레벨에서 40레벨까지 체계적으로 성장하는 프로그램입니다. 
          단순한 출석이 아니라, 습관 → 기본기 → 적용 → 전문가로 이어지는 실질적 성장을 추구합니다.
        </p>
      </div>

      {/* 4 Leagues */}
      <h2 className="mb-3 text-base font-bold text-foreground">4개 리그의 의미</h2>
      <div className="space-y-3 mb-5">
        {[
          { emoji: "⬜", label: "화이트 리그 (Lv 1~10)", subtitle: "시간 · 반복 · 기초자세 중심", desc: "운동 습관을 만들고 기초 체력과 자세를 다지는 단계입니다. 꾸준히 나오는 것 자체가 성장입니다." },
          { emoji: "🔵", label: "블루 리그 (Lv 11~20)", subtitle: "기술 정확도와 반복 품질", desc: "잽, 스트레이트, 훅, 어퍼의 기본기를 습득하고 정확한 반복을 통해 기술의 품질을 높입니다." },
          { emoji: "🔴", label: "레드 리그 (Lv 21~30)", subtitle: "적용과 반응", desc: "배운 기술을 실전 상황에 적용하고, 거리·타이밍·반응 속도를 키워 복싱 수행자로 성장합니다." },
          { emoji: "⚫", label: "블랙 리그 (Lv 31~40)", subtitle: "설명 · 분석 · 코칭", desc: "기술을 설명하고 분석할 수 있는 전문가 역량을 갖추고, 초급 코칭까지 가능한 단계입니다." },
        ].map(league => (
          <div key={league.label} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{league.emoji}</span>
              <div>
                <p className="text-sm font-bold text-foreground">{league.label}</p>
                <p className="text-xs text-primary">{league.subtitle}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{league.desc}</p>
          </div>
        ))}
      </div>

      {/* Level-up method */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <h2 className="mb-3 text-base font-bold text-foreground">⬆️ 레벨업 방식</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. 각 레벨의 미션을 확인하고 영상을 시청합니다.</p>
          <p>2. 훈련을 완료한 뒤 완료 요청을 보냅니다.</p>
          <p>3. 코치가 확인하고 승인하면 XP가 적립됩니다.</p>
          <p>4. 충분한 XP를 모으면 다음 레벨로 올라갑니다.</p>
          <p>5. 레벨 10마다 리그가 변경됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default GuideProgramPage;
