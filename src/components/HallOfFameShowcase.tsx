import { useHallOfFame } from "@/hooks/useRankingData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Crown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HallOfFameShowcase = () => {
  const { data: hallMembers } = useHallOfFame();
  const navigate = useNavigate();

  const isEmpty = !hallMembers || hallMembers.length === 0;

  return (
    <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Crown className="h-4 w-4 text-amber-500" />
          명예의 전당
        </h2>
        <button
          onClick={() => navigate("/halloffame")}
          className="text-xs font-medium text-primary"
        >
          전체보기 →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {hallMembers.map((m) => (
          <div
            key={m.r_user_id}
            className="flex min-w-[100px] flex-col items-center gap-1.5 rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-50 to-card p-3 shadow-sm"
          >
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-amber-400/50 shadow-md">
                {m.r_avatar_url ? (
                  <AvatarImage src={m.r_avatar_url} alt={m.r_nickname} />
                ) : null}
                <AvatarFallback className="bg-amber-100 text-lg">👑</AvatarFallback>
              </Avatar>
              <Crown className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-amber-500" />
            </div>
            <span className="text-xs font-bold text-foreground">{m.r_nickname}</span>
            <div className="flex items-center gap-0.5 text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              <span className="text-[9px]">{m.r_branch_name}</span>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
              153명예코치
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HallOfFameShowcase;
