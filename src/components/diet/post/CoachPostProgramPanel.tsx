import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Filter,
  HeartHandshake,
  ShieldCheck,
  Tags,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoachPostProgramList } from "@/hooks/useDietPostProgram";
import type { CoachPostProgramRow } from "@/services/dietPostProgramService";
import {
  PATTERN_LABEL_KO,
  type ExtendPatternTag,
} from "@/lib/diet/extendPatternEngine";

type Filter = "all" | "pending" | "maintenance" | "extend";

/**
 * 코치 — 21일 완주 회원 후속 경로 패널.
 *
 * 11단계 업데이트:
 *   · 연장 경로 회원에 한해 pattern_tags 칩 표시
 *   · extend_result 가 있으면 결과 라벨 노출 (유지 전환/재연장/상담)
 *   · 클릭 시 member 상세로 이동 — 상세에서 코치 태그 추가/제거·권장 문구 작성 가능
 */
export const CoachPostProgramPanel = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("pending");
  const listQuery = useCoachPostProgramList(filter);

  const rows: CoachPostProgramRow[] =
    listQuery.data && listQuery.data.success ? listQuery.data.rows : [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            POST-21 · 완주 후속
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold text-foreground">
            21일 완주 회원 경로
          </p>
        </div>
        <Filter className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip active={filter === "pending"} onClick={() => setFilter("pending")} label="미선택" />
        <Chip active={filter === "maintenance"} onClick={() => setFilter("maintenance")} label="유지" />
        <Chip active={filter === "extend"} onClick={() => setFilter("extend")} label="연장" />
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label="전체" />
      </div>

      {listQuery.isLoading ? (
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          불러오는 중...
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          해당 조건의 완주 회원이 없어요
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.plan_id}>
              <button
                type="button"
                onClick={() => navigate(`/coach/diet/member/${r.user_id}`)}
                className="flex w-full items-start gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left active:scale-[0.99]"
              >
                <PathIcon path={r.selected_path} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-foreground">
                    {r.member_name}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {r.branch_name}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {pathLabel(r.selected_path)}
                    {r.coach_recommended_path
                      ? ` · 코치 권장: ${shortReco(r.coach_recommended_path)}`
                      : ""}
                    {r.extend_result
                      ? ` · 결과: ${extendResultLabel(r.extend_result)}`
                      : ""}
                  </p>

                  {/* 연장 회원 — 패턴 태그 + 진행 중/종료 표시 */}
                  {r.selected_path === "extend" && r.pattern_tags && r.pattern_tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Tags className="h-3 w-3 text-primary" />
                      {r.pattern_tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                        >
                          {PATTERN_LABEL_KO[t as ExtendPatternTag] ?? t}
                        </span>
                      ))}
                      {r.pattern_tags.length > 3 && (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          +{r.pattern_tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {r.selected_path === "extend" && !r.extend_started_at && (
                    <p className="mt-1 text-[10.5px] font-bold text-[#F6C453]">
                      재평가 미완료 — 이탈 리스크
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Chip = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    )}
  >
    {label}
  </button>
);

const PathIcon = ({ path }: { path: string }) => {
  if (path === "maintenance") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-500">
        <ShieldCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (path === "extend") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <HeartHandshake className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Trophy className="h-3.5 w-3.5" />
    </span>
  );
};

function pathLabel(p: string) {
  if (p === "maintenance") return "유지 컨설팅 모드";
  if (p === "extend") return "건강리셋 연장";
  return "경로 미선택 — 추천 필요";
}

function shortReco(p: string) {
  if (p === "maintenance") return "유지";
  if (p === "extend") return "연장";
  return "상담";
}

function extendResultLabel(r: string) {
  if (r === "maintenance_transition") return "유지 전환";
  if (r === "extend_again") return "재연장";
  if (r === "coach_consult") return "상담 대기";
  return r;
}

export default CoachPostProgramPanel;
