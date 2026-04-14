import { useHallOfFame } from "@/hooks/useRankingData";
import { useAllCharacterAssignments } from "@/hooks/useCharacterData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Crown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CharacterRail from "@/components/CharacterRail";

const HallOfFameShowcase = () => {
  const { data: hallMembers } = useHallOfFame();
  const { data: assignments } = useAllCharacterAssignments();
  const navigate = useNavigate();

  const isEmpty = !hallMembers || hallMembers.length === 0;

  // Build assignment map: userId → style
  const assignmentMap = new Map<string, string>();
  (assignments || []).forEach(a => {
    const pj = (a.character_presets as any)?.parts_json;
    if (pj?.style) assignmentMap.set(a.user_id, pj.style);
  });

  // Build rail members from hall of fame data
  const railMembers = (hallMembers || []).map(m => ({
    userId: m.r_user_id,
    nickname: m.r_nickname,
    characterStyle: assignmentMap.get(m.r_user_id),
    rank: m.r_current_rank,
    level: m.r_current_level,
  }));

  return (
    <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Crown className="h-4 w-4 text-amber-500" />
          명예의 전당
        </h2>
        <button onClick={() => navigate("/halloffame")} className="text-xs font-medium text-primary">
          전체보기 →
        </button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-300/30 bg-gradient-to-b from-amber-50/50 to-card p-6 text-center">
          <span className="text-3xl">👑</span>
          <p className="text-sm font-bold text-foreground">아직 명예의 전당 회원이 없습니다</p>
          <p className="text-xs text-muted-foreground">블랙 레벨 10 + 마스터 미션 달성 시 등극!</p>
        </div>
      ) : (
        <>
          {/* Character Rail - dense sprite view */}
          {railMembers.length > 0 && (
            <div className="mb-3 rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-50/30 to-card p-2">
              <CharacterRail
                members={railMembers}
                onMemberTap={(userId) => navigate(`/manager/member/${userId}/preview`)}
                maxVisible={30}
              />
            </div>
          )}

          {/* Card view */}
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {hallMembers.map((m) => (
              <div
                key={m.r_user_id}
                className="flex min-w-[100px] flex-col items-center gap-1.5 rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-50 to-card p-3 shadow-sm"
              >
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-amber-400/50 shadow-md">
                    {m.r_avatar_url ? <AvatarImage src={m.r_avatar_url} alt={m.r_nickname} /> : null}
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
        </>
      )}
    </div>
  );
};

export default HallOfFameShowcase;
