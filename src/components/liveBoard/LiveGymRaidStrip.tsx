/**
 * 153 — 라이브보드 짐 레이드 진척 strip (체육관 분위기).
 *
 * v2 21단계 짐 레이드 데이터를 라이브보드 하단에 표시.
 *
 * 동작:
 *   · branchName 으로 boxing_gym_raids 직접 SELECT
 *   · 회원 SELECT RLS 가 active raid 표시 가능 (정책 §11-① super_admin OR same branch)
 *   · LiveBoardPage 가 anon 인 경우 RLS 통과 못 할 수 있어서 빈 데이터로 silent
 *   · 데이터 없으면 strip 자체 미표시 (return null)
 *
 * 시각효과:
 *   · 진척바 + 퍼센트
 *   · 100% 이상 달성 시 황금 글로우
 *   · 매 30초 재fetch
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

interface RaidRow {
  id: string;
  title: string;
  raid_type: string;
  current_value: number;
  target_value: number;
  status: string;
  end_date: string;
}

const RAID_TYPE_EMOJI: Record<string, string> = {
  quiz_correct: "🧠",
  challenge_clear: "🥊",
  cheer_sent: "👏",
  journal_write: "📖",
  quest_xp: "⭐",
  respect_points: "🎖",
};

const RAID_TYPE_LABEL: Record<string, string> = {
  quiz_correct: "복싱 IQ 정답",
  challenge_clear: "챌린지 클리어",
  cheer_sent: "응원 보내기",
  journal_write: "일기 작성",
  quest_xp: "QUEST XP",
  respect_points: "RP",
};

export interface LiveGymRaidStripProps {
  branchName: string;
}

const LiveGymRaidStrip = ({ branchName }: LiveGymRaidStripProps) => {
  const [raids, setRaids] = useState<RaidRow[]>([]);

  useEffect(() => {
    if (!branchName) return;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("boxing_gym_raids")
          .select("id, title, raid_type, current_value, target_value, status, end_date")
          .eq("branch_name", branchName)
          .in("status", ["active", "completed"])
          .order("end_date", { ascending: true });

        if (data && data.length > 0) {
          setRaids(data as unknown as RaidRow[]);
        } else {
          setRaids([]);
        }
      } catch {
        // anon RLS 거부 등 — silent
        setRaids([]);
      }
    };

    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [branchName]);

  if (raids.length === 0) return null;

  return (
    <div className="mx-6 mb-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-gray-900/80 to-primary/10 px-6 py-5">
      <div className="mb-4 flex items-center gap-3">
        <Flag className="h-7 w-7 text-primary" />
        <h2 className="text-2xl font-black tracking-wide text-primary">
          짐 레이드 — 우리 지점이 함께 깨는 목표
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {raids.slice(0, 3).map((r) => {
          const percentage = Math.min(
            100,
            r.target_value > 0
              ? Math.round((r.current_value / r.target_value) * 100)
              : 0,
          );
          const completed = percentage >= 100 || r.status === "completed";

          return (
            <div
              key={r.id}
              className={`rounded-xl border px-4 py-3 ${
                completed
                  ? "border-yellow-500/50 bg-yellow-500/5"
                  : "border-white/10 bg-black/30"
              }`}
              style={{
                boxShadow: completed
                  ? "0 0 30px hsla(42, 90%, 64%, 0.4)"
                  : undefined,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 truncate text-base font-black text-white">
                  <span>
                    {RAID_TYPE_EMOJI[r.raid_type] ?? "🎯"}
                  </span>
                  {r.title}
                </p>
                <p
                  className={`shrink-0 text-lg font-black tabular-nums ${
                    completed ? "text-yellow-400" : "text-primary"
                  }`}
                >
                  {percentage}%
                </p>
              </div>

              {/* 진척바 */}
              <div className="h-3 overflow-hidden rounded-full bg-gray-800/80">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className={`h-full ${
                    completed
                      ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                      : "bg-gradient-to-r from-primary via-reward to-primary"
                  }`}
                />
              </div>

              <p className="mt-1.5 text-xs text-gray-400 tabular-nums">
                {Math.round(r.current_value).toLocaleString()} /{" "}
                {Math.round(r.target_value).toLocaleString()}{" "}
                <span className="text-gray-600">
                  · {RAID_TYPE_LABEL[r.raid_type] ?? r.raid_type}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveGymRaidStrip;
