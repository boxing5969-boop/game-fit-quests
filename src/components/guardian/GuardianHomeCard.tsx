/**
 * 홈 「우리 아이」 한 줄 — 회원이면서 자녀의 보호자인 분께 (2026-11-23 대표님 「추천대로」).
 * 연결된 아이가 없으면 안 그린다(서버 my_guardian_state.kids). 누르면 /guardian.
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight, HeartHandshake } from "lucide-react";
import { RELATION_LABEL, kidTodayLine } from "@/lib/guardian";
import { useGuardianHome, useMyGuardianState } from "@/services/guardianService";

const GuardianHomeCard = () => {
  const navigate = useNavigate();
  const { data: st } = useMyGuardianState();
  const hasKids = !!st?.available && st.state.on && st.state.kids > 0;
  const { data: home } = useGuardianHome(hasKids);
  if (!hasKids || !home || home.kids.length === 0) return null;
  const now = Date.now();

  return (
    <button
      type="button"
      onClick={() => navigate("/guardian")}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
      aria-label="우리 아이 운동 기록 보기"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HeartHandshake className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label font-bold text-primary">우리 아이</p>
        {home.kids.slice(0, 2).map((k) => {
          const line = kidTodayLine(k.today, now);
          return (
            <p key={k.linkId} className="truncate text-body font-bold text-foreground">
              {k.name} · {line.live ? line.sub : line.headline}
            </p>
          );
        })}
        {home.kids.length > 2 && <p className="text-label text-muted-foreground">외 {home.kids.length - 2}명</p>}
        {home.kids.length === 1 && (
          <p className="truncate text-label text-muted-foreground">{RELATION_LABEL[home.kids[0].relation]}로 연결됨 · 이번 달 {home.kids[0].month.days}일</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
};

export default GuardianHomeCard;
