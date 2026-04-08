import { useState } from "react";
import { levelMap, currentUser, RANK_ORDER, RANK_LABELS, RANK_ICONS } from "@/lib/mockData";
import type { LevelNode, RankName } from "@/lib/mockData";
import RankBadge from "@/components/RankBadge";
import { Lock, Star, Trophy, X } from "lucide-react";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LevelMapPage = () => {
  const [selectedNode, setSelectedNode] = useState<LevelNode | null>(null);
  const navigate = useNavigate();

  const nodesByRank = RANK_ORDER.map((rank) => ({
    rank,
    nodes: levelMap.filter((n) => n.rank === rank),
  }));

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🗺️ 레벨맵</h1>
        <button
          onClick={() => navigate("/mypage")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95"
        >
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Current position */}
      <div className="mb-5 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">현재 위치</span>
          <RankBadge rank={currentUser.rank} level={currentUser.level} size="lg" />
        </div>
      </div>

      {/* Rank Sections */}
      <div className="space-y-6">
        {nodesByRank.map(({ rank, nodes }, sectionIdx) => (
          <RankSection
            key={rank}
            rank={rank}
            nodes={nodes}
            sectionIdx={sectionIdx}
            onNodeClick={setSelectedNode}
          />
        ))}
      </div>

      {/* Node Detail Modal */}
      {selectedNode && (
        <NodeDetailModal node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
};

const RankSection = ({
  rank,
  nodes,
  sectionIdx,
  onNodeClick,
}: {
  rank: RankName;
  nodes: LevelNode[];
  sectionIdx: number;
  onNodeClick: (node: LevelNode) => void;
}) => {
  const hasUnlocked = nodes.some((n) => n.unlocked);

  return (
    <div className="animate-slide-up" style={{ animationDelay: `${sectionIdx * 0.1}s` }}>
      {/* Rank Header */}
      <div className={`mb-3 flex items-center gap-2 ${!hasUnlocked ? "opacity-40" : ""}`}>
        <span className="text-lg">{RANK_ICONS[rank]}</span>
        <h2 className="text-lg text-foreground">{RANK_LABELS[rank]} 벨트</h2>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-5 gap-2">
        {nodes.map((node) => (
          <button
            key={`${node.rank}-${node.level}`}
            onClick={() => onNodeClick(node)}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 p-2.5 transition-all active:scale-95 ${
              node.current
                ? "border-primary bg-primary/10 shadow-md"
                : node.unlocked
                ? "border-border bg-card hover:border-primary/30"
                : "border-border/30 bg-muted/30 opacity-40"
            } ${node.isBoss ? "col-span-2 row-span-1" : ""}`}
            style={node.current ? { animation: "pulse-glow 2s ease-in-out infinite" } : {}}
          >
            {node.isBoss ? (
              <Trophy className={`h-6 w-6 ${node.unlocked ? "text-accent" : "text-muted-foreground"}`} />
            ) : node.unlocked ? (
              <Star className={`h-4 w-4 ${node.current ? "text-primary" : "text-muted-foreground"}`} />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={`mt-0.5 text-[10px] font-bold ${node.current ? "text-primary" : "text-muted-foreground"}`}>
              {node.isBoss ? "BOSS" : `Lv.${node.level}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

const NodeDetailModal = ({ node, onClose }: { node: LevelNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
    <div
      className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{RANK_ICONS[node.rank]}</span>
          <h3 className="text-lg text-foreground">
            {RANK_LABELS[node.rank]} Lv.{node.level}
          </h3>
        </div>
        <button onClick={onClose} className="rounded-full bg-secondary p-2 active:scale-95">
          <X className="h-4 w-4 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-secondary p-4">
          <p className="text-sm font-bold text-foreground">{node.title}</p>
          {node.isBoss && (
            <span className="mt-1 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent-foreground">
              🏆 타이틀매치
            </span>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-muted-foreground">보상</p>
          <div className="flex flex-wrap gap-2">
            {node.rewards.map((r, i) => (
              <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {r}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-secondary p-3 text-center">
          <p className="text-xs text-muted-foreground">필요 XP</p>
          <p className="text-lg font-bold text-foreground">{node.requiredXp} XP</p>
        </div>

        {!node.unlocked && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-muted p-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">아직 잠겨있습니다</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default LevelMapPage;
