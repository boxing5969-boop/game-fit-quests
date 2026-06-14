// ═══════════════════════════════════════════════════════
// DailyReportCard — 관장·코치 홈(/manager) 진입 일일 운영 리포트 카드
// 오늘 출석/신규/제출/처리대기 등 실데이터 요약 (read-only)
// 153 브랜드: 블랙·차콜 베이스 + 민트(primary) 포인트 + 골드(reward) 강조
// ═══════════════════════════════════════════════════════
import type { ReactNode } from "react";
import { Users, UserPlus, FileText, Clock, Activity, ChevronRight, CalendarDays } from "lucide-react";
import { useDailyOpsReport } from "@/hooks/useDailyOpsReport";

interface DailyReportCardProps {
  branchName: string;
  isSuperAdmin: boolean;
  enabled: boolean;
  /** BranchManagerHome 가 이미 들고 있는 stats 재사용 (추가 쿼리 회피) */
  pendingCount?: number;
  todaySubmissions?: number;
  /** 모바일에서만 전달 (데스크톱 좌측 패널엔 운영 탭이 없어 미전달) */
  onOpenOperations?: () => void;
  onOpenCheckin?: () => void;
}

const todayLabel = () =>
  new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

const DailyReportCard = ({
  branchName,
  isSuperAdmin,
  enabled,
  pendingCount,
  todaySubmissions,
  onOpenOperations,
  onOpenCheckin,
}: DailyReportCardProps) => {
  const { data, isLoading } = useDailyOpsReport({ branchName, isSuperAdmin, enabled });

  const checkins = data?.checkins ?? 0;
  const unique = data?.uniqueVisitors ?? 0;
  const newSignups = data?.newSignups ?? 0;
  const activeNow = data?.activeNow ?? 0;
  const weekCheckins = data?.weekCheckins ?? 0;
  const pending = pendingCount ?? 0;
  const submissions = todaySubmissions ?? 0;

  const summary = isLoading
    ? "오늘 현황을 불러오는 중…"
    : checkins === 0 && newSignups === 0 && submissions === 0
      ? "오늘은 아직 출석·가입·제출 기록이 없습니다."
      : `오늘 ${unique}명 방문 (출석 ${checkins}회)` +
        (newSignups > 0 ? ` · 신규 ${newSignups}명` : "") +
        (pending > 0 ? ` · 처리 대기 ${pending}건` : "");

  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-card shadow-elev-1">
      {/* 민트 포인트 액센트 (얇은 라인 — 넓은 면적 사용 금지) */}
      <div className="h-1 w-full bg-primary" />
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">오늘의 운영 리포트</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isSuperAdmin ? "전체 지점" : branchName || "우리 지점"} · {todayLabel()}
            </p>
          </div>
        </div>

        {/* Metric tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile
            icon={<Users className="h-4 w-4 text-primary" />}
            label="출석"
            value={isLoading ? "–" : checkins}
            sub={isLoading ? undefined : `순방문 ${unique}명`}
          />
          <MetricTile
            icon={<UserPlus className="h-4 w-4 text-reward" />}
            label="오늘 신규"
            value={isLoading ? "–" : newSignups}
            gold={!isLoading && newSignups > 0}
          />
          <MetricTile
            icon={<FileText className="h-4 w-4 text-primary" />}
            label="오늘 제출"
            value={isLoading ? "–" : submissions}
          />
          <MetricTile
            icon={<Clock className="h-4 w-4 text-status-pending" />}
            label="처리 대기"
            value={isLoading ? "–" : pending}
            highlight={!isLoading && pending > 0}
          />
        </div>

        {/* Context line */}
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span>
            최근 7일 출석 {weekCheckins}회
            {activeNow > 0 ? ` · 현재 진행중 ${activeNow}명` : ""}
          </span>
        </div>

        {/* Summary */}
        <p className="mt-2 text-xs leading-relaxed text-foreground/80">{summary}</p>

        {/* Footer actions */}
        {(onOpenOperations || onOpenCheckin) && (
          <div className="mt-3 flex gap-2">
            {onOpenOperations && (
              <button
                onClick={onOpenOperations}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary/10 py-2.5 text-xs font-bold text-primary transition-all active:scale-95"
              >
                운영 보드 열기 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            {onOpenCheckin && (
              <button
                onClick={onOpenCheckin}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-foreground transition-all active:scale-95"
              >
                체크인 보드 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MetricTile = ({
  icon,
  label,
  value,
  sub,
  highlight,
  gold,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
  gold?: boolean;
}) => (
  <div
    className={`rounded-2xl border p-3 ${
      highlight
        ? "border-status-pending/30 bg-status-pending/5"
        : gold
          ? "border-reward/30 bg-reward/5"
          : "border-border bg-card"
    }`}
  >
    <div className="mb-1 flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
    <p className={`text-xl font-bold ${highlight ? "text-status-pending" : "text-foreground"}`}>{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

export default DailyReportCard;
