import { usePendingSubmissions, useAssignedMembers, useReviewSubmission } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Check, X, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const CoachDashboard = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: pendingSubmissions, isLoading: pendingLoading } = usePendingSubmissions();
  const { data: members, isLoading: membersLoading } = useAssignedMembers();
  const reviewMutation = useReviewSubmission();
  const [activeTab, setActiveTab] = useState<"pending" | "members">("pending");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/home")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">
          {role === "admin" ? "관리자 대시보드" : "코치 대시보드"}
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
            activeTab === "pending" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground"
          }`}
        >
          📋 승인 대기 {pendingSubmissions?.length ? `(${pendingSubmissions.length})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
            activeTab === "members" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground"
          }`}
        >
          👥 회원 목록
        </button>
      </div>

      {activeTab === "pending" && (
        <div className="space-y-3">
          {pendingLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)
          ) : !pendingSubmissions?.length ? (
            <EmptyState icon="✅" message="승인 대기 중인 퀘스트가 없습니다" />
          ) : (
            pendingSubmissions.map((sub: any) => (
              <PendingCard
                key={sub.id}
                submission={sub}
                onApprove={() => reviewMutation.mutate({ id: sub.id, status: "approved" })}
                onReject={() => reviewMutation.mutate({ id: sub.id, status: "rejected", coachNote: "다시 도전해보세요" })}
                isLoading={reviewMutation.isPending}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-3">
          {membersLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
          ) : !members?.length ? (
            <EmptyState icon="👥" message="담당 회원이 없습니다" />
          ) : (
            members.map((member: any) => {
              const prog = Array.isArray(member.member_progress) ? member.member_progress[0] : member.member_progress;
              return (
                <div key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{member.nickname || member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.branch_name || "미설정"}</p>
                    </div>
                    {prog && (
                      <div className="text-right">
                        <span className="inline-block rounded-full bg-rank-blue/15 px-2 py-0.5 text-xs font-bold text-rank-blue">
                          {RANK_LABELS[prog.current_rank] || prog.current_rank} Lv.{prog.current_level}
                        </span>
                        <p className="mt-0.5 text-xs text-muted-foreground">{prog.total_xp} XP</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const PendingCard = ({
  submission,
  onApprove,
  onReject,
  isLoading,
}: {
  submission: any;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) => (
  <div className="rounded-2xl border border-status-pending/30 bg-card p-4 shadow-sm">
    <div className="mb-3">
      <p className="text-sm font-bold text-foreground">{submission.quests?.title || "퀘스트"}</p>
      <p className="text-xs text-muted-foreground">{submission.quests?.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        요청: {new Date(submission.requested_at).toLocaleDateString("ko-KR")}
      </p>
    </div>
    <div className="flex gap-2">
      <button
        onClick={onApprove}
        disabled={isLoading}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-status-complete py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
      >
        <Check className="h-4 w-4" /> 승인
      </button>
      <button
        onClick={onReject}
        disabled={isLoading}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition-all active:scale-95 disabled:opacity-50"
      >
        <X className="h-4 w-4" /> 반려
      </button>
    </div>
  </div>
);

const EmptyState = ({ icon, message }: { icon: string; message: string }) => (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
    <span className="text-4xl">{icon}</span>
    <p className="mt-3 text-sm text-muted-foreground">{message}</p>
  </div>
);

export default CoachDashboard;
