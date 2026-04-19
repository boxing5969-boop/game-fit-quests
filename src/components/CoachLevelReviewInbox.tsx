// Coach Level Review Inbox — 레벨업 심사 인박스
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Clock, ChevronRight } from "lucide-react";

// Quick feedback templates
const QUICK_FEEDBACK = [
  "가드가 얼굴에서 멀어집니다",
  "잽 후 손이 늦게 돌아옵니다",
  "전진/후진 스텝에서 발이 교차됩니다",
  "스텝 후 자세 복구가 느립니다",
  "줄넘기 리듬은 좋지만 가드 유지가 더 필요합니다",
  "다음 수업에서 부족한 항목만 보완하면 됩니다",
];

interface ReviewMember {
  id: string;
  nickname: string;
  levelLabel: string;
  status: string;
  xp: number;
  sessions: number;
  days: number;
  minutes: number;
  checklistReady: boolean;
  remediationDueAt?: string;
}

// Mock data for local-first demo
const MOCK_REVIEW_QUEUE: ReviewMember[] = [
  {
    id: "1", nickname: "복싱왕", levelLabel: "White Lv.1",
    status: "레벨업 심사 가능", xp: 520, sessions: 5, days: 5, minutes: 260, checklistReady: true,
  },
  {
    id: "2", nickname: "초보파이터", levelLabel: "White Lv.1",
    status: "보완 필요", xp: 500, sessions: 6, days: 5, minutes: 250, checklistReady: false,
    remediationDueAt: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  },
];

type FilterKey = "all" | "review_ready" | "remediation" | "deadline";

const CoachLevelReviewInbox = () => {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "review_ready", label: "심사 가능" },
    { key: "remediation", label: "보완중" },
    { key: "deadline", label: "마감 임박" },
  ];

  const filtered = MOCK_REVIEW_QUEUE.filter(m => {
    if (filter === "review_ready") return m.status === "레벨업 심사 가능";
    if (filter === "remediation") return m.status === "보완 필요";
    if (filter === "deadline") return !!m.remediationDueAt;
    return true;
  });

  const STATUS_ICON: Record<string, typeof CheckCircle2> = {
    "레벨업 심사 가능": CheckCircle2,
    "보완 필요": AlertTriangle,
    "코치 확인 필요": Clock,
  };

  const STATUS_COLOR: Record<string, string> = {
    "레벨업 심사 가능": "text-status-complete bg-status-complete/10",
    "보완 필요": "text-status-pending bg-status-pending/10",
    "코치 확인 필요": "text-destructive bg-destructive/10",
  };

  const toggleFeedback = (fb: string) => {
    setSelectedFeedback(prev =>
      prev.includes(fb) ? prev.filter(f => f !== fb) : [...prev, fb]
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground">📋 레벨업 심사 인박스</h3>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Queue */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">✅</span>
          <p className="mt-2 text-sm text-muted-foreground">심사 대기 회원이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(member => {
            const Icon = STATUS_ICON[member.status] || Clock;
            const color = STATUS_COLOR[member.status] || "text-muted-foreground bg-muted";
            return (
              <div key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{member.nickname}</span>
                    <span className="text-[10px] text-muted-foreground">{member.levelLabel}</span>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>
                    <Icon className="h-3 w-3" /> {member.status}
                  </span>
                </div>

                {/* Metrics */}
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  <MiniMetric label="XP" value={member.xp} />
                  <MiniMetric label="세션" value={`${member.sessions}회`} />
                  <MiniMetric label="출석" value={`${member.days}일`} />
                  <MiniMetric label="훈련" value={`${member.minutes}분`} />
                </div>

                {member.remediationDueAt && (
                  <p className="mb-2 text-[10px] text-status-pending">⏰ 보완 마감: {member.remediationDueAt}</p>
                )}

                {/* Quick actions */}
                <div className="flex gap-2">
                  <button className="flex-1 rounded-xl bg-status-complete py-2.5 text-xs font-bold text-white transition-all active:scale-95">
                    ✅ 레벨업 승인
                  </button>
                  <button className="flex-1 rounded-xl bg-status-pending/20 py-2.5 text-xs font-bold text-status-pending transition-all active:scale-95">
                    🔄 보완 요청
                  </button>
                  <button className="rounded-xl bg-muted px-3 py-2.5 text-xs font-bold text-muted-foreground transition-all active:scale-95">
                    ⏸️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick feedback templates */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <p className="mb-2 text-xs font-bold text-foreground">💬 빠른 피드백 템플릿</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FEEDBACK.map(fb => (
            <button
              key={fb}
              onClick={() => toggleFeedback(fb)}
              className={`rounded-full border px-2.5 py-1 text-[10px] transition-all active:scale-95 ${
                selectedFeedback.includes(fb)
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {fb}
            </button>
          ))}
        </div>
        {selectedFeedback.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            선택된 피드백: {selectedFeedback.join(" / ")}
          </p>
        )}
      </div>
    </div>
  );
};

const MiniMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg bg-muted/30 p-1.5 text-center">
    <p className="text-xs font-bold text-foreground">{value}</p>
    <p className="text-[8px] text-muted-foreground">{label}</p>
  </div>
);

export default CoachLevelReviewInbox;
