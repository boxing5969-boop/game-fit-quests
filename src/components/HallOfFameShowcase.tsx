import { useHallOfFame } from "@/hooks/useRankingData";
import { useAllCharacterAssignments } from "@/hooks/useCharacterData";
import { Crown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CharacterRail from "@/components/CharacterRail";
import CharacterSprite from "@/components/CharacterSprite";

const HallOfFameShowcase = () => {
  const { data: hallMembers } = useHallOfFame();
  const { data: assignments } = useAllCharacterAssignments();
  const navigate = useNavigate();

  const isEmpty = !hallMembers || hallMembers.length === 0;

  // Build assignment map: userId → { style, partsJson }
  const assignmentMap = new Map<string, { style?: string; partsJson?: Record<string, any> }>();
  (assignments || []).forEach(a => {
    const pj = (a.character_presets as any)?.parts_json;
    assignmentMap.set(a.user_id, { style: pj?.style, partsJson: pj });
  });

  // Build rail members from hall of fame data
  const railMembers = (hallMembers || []).map(m => {
    const charData = assignmentMap.get(m.r_user_id);
    return {
      userId: m.r_user_id,
      nickname: m.r_nickname,
      characterStyle: charData?.style,
      partsJson: charData?.partsJson,
      rank: m.r_current_rank,
      level: m.r_current_level,
    };
  });

  return (
    <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Crown className="h-4 w-4 text-accent" />
          명예의 전당
        </h2>
        <button onClick={() => navigate("/halloffame")} className="text-xs font-medium text-primary">
          전체보기 →
        </button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/5 to-card p-6 text-center">
          <span className="text-3xl">👑</span>
          <p className="text-sm font-bold text-foreground">아직 명예의 전당 회원이 없습니다</p>
          <p className="text-xs text-muted-foreground">블랙 레벨 10 + 마스터 미션 달성 시 등극!</p>
        </div>
      ) : (
        <>
          {/* Character Rail - dense sprite view */}
          {railMembers.length > 0 && (
            <div className="mb-3 rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/5 to-card p-2">
              <CharacterRail
                members={railMembers}
                onMemberTap={(userId) => navigate(`/manager/member/${userId}/preview`)}
                maxVisible={30}
              />
            </div>
          )}

          {/* Card view with character sprites */}
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {hallMembers.map((m) => {
              const charData = assignmentMap.get(m.r_user_id);
              return (
                <div
                  key={m.r_user_id}
                  className="flex min-w-[100px] flex-col items-center gap-1.5 rounded-2xl border border-accent/40 bg-gradient-to-b from-accent/10 to-card p-3 shadow-sm"
                >
                  <div className="relative">
                    <Crown className="absolute -top-2 left-1/2 z-20 h-4 w-4 -translate-x-1/2 text-accent" />
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent/50 bg-accent/10 shadow-md overflow-hidden">
                      <CharacterSprite
                        style={charData?.style}
                        userId={m.r_user_id}
                        partsJson={charData?.partsJson as any}
                        size="sm"
                        league={m.r_current_rank as any}
                        level={m.r_current_level}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-foreground">{m.r_nickname}</span>
                  <div className="flex items-center gap-0.5 text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    <span className="text-[9px]">{m.r_branch_name}</span>
                  </div>
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
                    153명예코치
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default HallOfFameShowcase;