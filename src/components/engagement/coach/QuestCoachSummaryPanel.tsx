/**
 * 153 QUEST v2 22단계 — 코치 대시보드 메인 컨테이너 + summary 패널.
 *
 * 보호 원칙:
 *   · 표시 전용 — wallet/공식 XP 수정 0
 *   · 일반 회원 차단 — useCoachQuestDashboard 훅이 권한 체크 + RPC 도 차단
 *   · 민감정보 미표시 (RPC 가 화이트리스트로 차단)
 */

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Heart,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useCoachQuestDashboard } from "@/hooks/useCoachQuestDashboard";

import QuestAtRiskMembersPanel from "./QuestAtRiskMembersPanel";
import QuestPraiseTargetsPanel from "./QuestPraiseTargetsPanel";
import QuestCommunityPanel from "./QuestCommunityPanel";

const QuestCoachSummaryPanel = () => {
  const { role } = useAuth();
  const [expanded, setExpanded] = useState(true);

  const allowed =
    role === "super_admin" ||
    role === "branch_manager" ||
    role === "coach" ||
    role === "admin";

  const { data, isLoading } = useCoachQuestDashboard(null, allowed);

  if (!allowed) return null;

  const summary = data?.summary as {
    total_members?: number;
    active_quest_members_7d?: number;
    quiz_attempts_7d?: number;
    challenge_clears_7d?: number;
    journals_7d?: number;
    cheers_7d?: number;
    return_round_candidates?: number;
    cornerman_active_pairs?: number;
  } | undefined;

  const tiles = [
    {
      icon: <Users className="h-3.5 w-3.5" />,
      label: "이번 주 QUEST 활성 회원",
      value: `${summary?.active_quest_members_7d ?? 0} / ${summary?.total_members ?? 0}`,
    },
    {
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      label: "퀴즈 시도",
      value: `${summary?.quiz_attempts_7d ?? 0}회`,
    },
    {
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      label: "챌린지 클리어",
      value: `${summary?.challenge_clears_7d ?? 0}회`,
    },
    {
      icon: <ClipboardList className="h-3.5 w-3.5" />,
      label: "챔피언 일기",
      value: `${summary?.journals_7d ?? 0}건`,
    },
    {
      icon: <Megaphone className="h-3.5 w-3.5" />,
      label: "응원 보냄",
      value: `${summary?.cheers_7d ?? 0}회`,
    },
    {
      icon: <Heart className="h-3.5 w-3.5" />,
      label: "코너맨 활성",
      value: `${summary?.cornerman_active_pairs ?? 0}쌍`,
    },
    {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "복귀 대상",
      value: `${summary?.return_round_candidates ?? 0}명`,
    },
  ];

  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-card shadow-elev-1"
      aria-label="153 QUEST 몰입 관리"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-t-2xl px-5 py-4 text-left transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-primary/15 text-primary">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              153 QUEST 몰입 관리
            </p>
            <h3 className="mt-0.5 text-[14px] font-bold text-foreground">
              {data?.branch ? `${data.branch} 회원 QUEST 활동` : "QUEST 몰입 데이터"}
            </h3>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border px-5 pt-4 pb-5">
          {isLoading ? (
            <p className="text-[12px] text-muted-foreground">
              QUEST 몰입 데이터를 불러오는 중…
            </p>
          ) : (
            <>
              {/* Summary tiles */}
              <div>
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  이번 주 요약 (최근 7일)
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tiles.map((t) => (
                    <div
                      key={t.label}
                      className="rounded-card border border-border bg-background/40 px-3 py-2"
                    >
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t.icon}
                        {t.label}
                      </p>
                      <p className="number-font mt-0.5 text-[14px] font-black text-foreground">
                        {t.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-risk members */}
              <QuestAtRiskMembersPanel
                members={data?.at_risk_members ?? []}
              />

              {/* Praise targets */}
              <QuestPraiseTargetsPanel targets={data?.praise_targets ?? []} />

              {/* Community */}
              <QuestCommunityPanel
                community={
                  data?.community as Parameters<
                    typeof QuestCommunityPanel
                  >[0]["community"]
                }
              />

              {/* 안내 문구 */}
              <div className="rounded-card border border-amber-400/30 bg-amber-400/5 p-3">
                <ul className="space-y-1 text-[10.5px] leading-relaxed text-muted-foreground">
                  <li>※ 이 데이터는 공식 승급 심사가 아니라 몰입/복귀 관리용입니다.</li>
                  <li>※ 공식 레벨업은 기존 훈련 미션과 코치 승인 기준으로 진행됩니다.</li>
                  <li>※ 칭찬 대상은 오늘 코치님의 한마디가 필요한 회원입니다.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default QuestCoachSummaryPanel;
