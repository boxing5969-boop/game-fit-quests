// ═══════════════════════════════════════════════════════
// DailyReportCard — 관장·코치 홈(/manager) 진입 일일 운영 리포트 카드
// 오늘 출석/신규/제출/처리대기 등 실데이터 요약 (read-only)
// 2026-09-28 — "브로제이 대조" 칸: 브로제이 화면과 같은 기준(회원 입장 건수·회원 인원·코치 인원)과
//   앱 반영 인원, 그 차이(코치 회원권 입장·앱 미연결·문 거절)를 한눈에. 숫자는 출입 동기화가 1분마다 남긴다.
// 153 브랜드: 블랙·차콜 베이스 + 민트(primary) 포인트 + 골드(reward) 강조
// ═══════════════════════════════════════════════════════
import type { ReactNode } from "react";
import { Users, UserPlus, FileText, Clock, Activity, ChevronRight, CalendarDays, DoorOpen } from "lucide-react";
import { useDailyOpsReport, type BrojCounts } from "@/hooks/useDailyOpsReport";

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

/** "22:40" (KST) */
const kstTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

const shortBranch = (name: string): string => name.replace(/^153복싱짐\s*/, "") || name;

/** 브로제이 회원 인원과 앱 반영 인원의 차이를 말로 — 차이가 없으면 "전원 반영" */
const brojGapLine = (c: BrojCounts): string => {
  const parts: string[] = [];
  if (c.staffMemberPeople > 0) parts.push(`코치 ${c.staffMemberPeople}명은 회원권으로 입장(앱은 코치로 셈)`);
  if (c.unlinkedPeople > 0) parts.push(`앱 계정 없음 ${c.unlinkedPeople}명`);
  if (c.rejectedEntries > 0) parts.push(`문 거절 ${c.rejectedEntries}건(출석 제외)`);
  const head = `앱 반영 ${c.appMemberPeople}명`;
  if (parts.length === 0) return `${head} · 전원 반영`;
  return `${head} · ${parts.join(" · ")}`;
};

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
  const broj = data?.broj ?? null;

  // 방문 인원은 브로제이(문 출입) 기준이 있으면 그 숫자로 — 대표님이 브로제이 화면과 바로 맞춰 볼 수 있게.
  const visitLine = broj
    ? `오늘 회원 ${broj.total.memberPeople}명 방문 (입장 ${broj.total.memberEntries}건 · 브로제이 기준)`
    : `오늘 ${unique}명 방문 (앱 출석 기준)`;
  const summary = isLoading
    ? "오늘 현황을 불러오는 중…"
    : !broj && checkins === 0 && newSignups === 0 && submissions === 0
      ? "오늘은 아직 출석·가입·제출 기록이 없습니다."
      : visitLine +
        (newSignups > 0 ? ` · 신규 ${newSignups}명` : "") +
        (pending > 0 ? ` · 처리 대기 ${pending}건` : "");
  const brojOk = !!broj && broj.total.unlinkedPeople === 0;

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
            label="앱 출석"
            value={isLoading ? "–" : unique}
            sub={isLoading ? undefined : "회원만 · 코치 제외"}
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

        {/* 브로제이 대조 — 브로제이 화면과 같은 기준 + 앱 반영 인원과 차이 */}
        {!isLoading && broj && (
          <div className="mt-3 rounded-2xl border border-border bg-secondary/30 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                <DoorOpen className="h-3.5 w-3.5 text-primary" /> 브로제이 대조
              </span>
              {broj.total.updatedAt && (
                <span className="text-[10px] text-muted-foreground">{kstTime(broj.total.updatedAt)} 기준</span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground">
              입장 {broj.total.memberEntries}건 · 회원 {broj.total.memberPeople}명
              <span className="font-medium text-muted-foreground"> · 코치 {broj.total.staffPeople}명</span>
            </p>
            <p className={`mt-0.5 text-[11px] leading-relaxed ${brojOk ? "text-primary" : "text-status-pending"}`}>
              {brojGapLine(broj.total)}
            </p>
            {broj.branches.length > 1 && (
              <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
                {broj.branches.map((b) => (
                  <li key={b.branchName} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-muted-foreground">{shortBranch(b.branchName)}</span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      입장 {b.memberEntries} · 회원 {b.memberPeople} · 앱 {b.appMemberPeople}
                      {b.staffMemberPeople > 0 ? ` · 코치 ${b.staffMemberPeople}` : ""}
                      {b.unlinkedPeople > 0 ? ` · 미연결 ${b.unlinkedPeople}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
