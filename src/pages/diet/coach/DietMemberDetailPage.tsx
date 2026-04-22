import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useCreateDietCoachNote, useDietMemberDetail } from "@/hooks/useDietCoach";
import { DIET_MAINTENANCE_VARIANTS } from "@/data/diet/maintenanceVariants";
import { DIET_STAGES, DIET_TRACK_LABEL } from "@/data/dietProgramData";
import type { Database } from "@/integrations/supabase/types";
import DietTimelineStrip from "@/components/diet/DietTimelineStrip";
import DietTrackBadge from "@/components/diet/DietTrackBadge";
import DietCoachTemplatePicker, {
  type CoachTemplateItem,
} from "@/components/diet/coach/DietCoachTemplatePicker";
import { cn } from "@/lib/utils";

type LogStatus = Database["public"]["Enums"]["diet_log_status"];

/**
 * /coach/diet/member/:memberId — 코치용 개별 회원 상세.
 *
 * 섹션
 *   1. 헤더 — 닉네임/지점/트랙/Day·Stage + 위험 플래그 칩
 *   2. 21일 타임라인 + 체크인 통계
 *   3. 코치 피드백 내역 (최근 20건)
 *   4. 새 코치 노트 작성 (템플릿 포함)
 *   5. 유지 플랜 추천 (Day 18+ 회원용)
 *
 * 운영 원칙
 *   • 위험 플래그는 "주의 필요" 수준만. 질병 진단 표현 금지.
 *   • 식단 사진/체크는 타임라인 색상으로 요약. 세부 보기는 inbox 에서.
 */
const DietMemberDetailPage = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const detail = useDietMemberDetail(memberId);
  const createNote = useCreateDietCoachNote();

  const [noteText, setNoteText] = useState("");
  const [tplId, setTplId] = useState<string | null>(null);
  const [tplType, setTplType] =
    useState<CoachTemplateItem["type"]>("general");

  const statusByDay = useMemo(() => {
    const map: Partial<Record<number, LogStatus>> = {};
    (detail.data?.recentLogs ?? []).forEach((r) => {
      map[r.day_number] = r.status;
    });
    return map;
  }, [detail.data]);

  const weeklyApproval = useMemo(() => {
    const logs = detail.data?.recentLogs ?? [];
    return [1, 2, 3].map((w) => {
      const rows = logs.filter(
        (r) => r.day_number >= (w - 1) * 7 + 1 && r.day_number <= w * 7,
      );
      const approved = rows.filter((r) => r.status === "approved").length;
      return { week: w, approved, total: 7 };
    });
  }, [detail.data]);

  const handleTemplate = (t: CoachTemplateItem) => {
    setTplId(t.id);
    setNoteText(t.body);
    setTplType(t.type);
  };

  const handleSend = async (visibility: "member_visible" | "private") => {
    if (!detail.data?.enrollment?.id) return;
    if (!noteText.trim()) {
      toast.error("메시지를 입력해 주세요.");
      return;
    }
    try {
      const r = await createNote.mutateAsync({
        enrollmentId: detail.data.enrollment.id,
        noteText: noteText.trim(),
        templateType: tplType,
        visibility,
      });
      if (!r.success) {
        toast.error(`작성 실패: ${r.error}`);
        return;
      }
      toast.success(
        visibility === "member_visible"
          ? "회원에게 전달됐어요."
          : "내부 메모로 저장됐어요.",
      );
      setNoteText("");
      setTplId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "작성 실패");
    }
  };

  if (detail.isLoading) {
    return (
      <Shell onBack={() => navigate("/coach/diet")}>
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
          불러오는 중...
        </div>
      </Shell>
    );
  }

  const data = detail.data;
  if (!data || !data.enrollment) {
    return (
      <Shell onBack={() => navigate("/coach/diet")}>
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
          해당 회원의 진행 중 프로그램을 찾지 못했어요.
        </div>
      </Shell>
    );
  }

  const e = data.enrollment;
  const stageLabel = DIET_STAGES.find((s) => s.id === e.current_stage)?.label ?? "";
  const warningFlags = (e.warning_flags ?? {}) as Record<string, unknown>;
  const flagLabels = warningFlagChips(warningFlags);

  return (
    <Shell onBack={() => navigate("/coach/diet")}>
      <div className="space-y-4 pt-2">
        {/* 헤더 요약 */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[14px] font-bold text-muted-foreground">
              {data.avatar_url ? (
                <img
                  src={data.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (data.nickname ?? "?").slice(0, 1)
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[14px] font-bold text-foreground">
                {data.nickname ?? "회원"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {data.branch_name ?? "-"} · {DIET_TRACK_LABEL[e.track]}
              </p>
            </div>
            <DietTrackBadge track={e.track} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Day {e.current_day} / 21 · {stageLabel} · 시작 {e.start_date}
          </div>

          {flagLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              {flagLabels.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive"
                >
                  {f}
                </span>
              ))}
              <span className="text-[10.5px] text-muted-foreground ml-1">
                단식·식사 거르기 기능 비활성
              </span>
            </div>
          )}
        </div>

        {/* 타임라인 */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <DietTimelineStrip
            currentDay={e.current_day}
            statusByDay={statusByDay}
          />
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
            {weeklyApproval.map((w) => (
              <span
                key={w.week}
                className="rounded-lg border border-border bg-muted/40 px-2 py-1.5"
              >
                <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                  W{w.week}
                </span>
                <span className="block number-font text-[13px] font-extrabold text-foreground">
                  {w.approved}/{w.total}
                </span>
              </span>
            ))}
          </div>
        </section>

        {/* 코치 피드백 내역 */}
        <section className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground">피드백 내역</h3>
          {data.coachNotes.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-3 text-[12px] text-muted-foreground">
              아직 코치 노트가 없어요. 아래에서 첫 메시지를 보내볼까요?
            </div>
          ) : (
            <ul className="space-y-1.5">
              {data.coachNotes.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-xl border p-2.5",
                    n.visibility === "private"
                      ? "border-muted-foreground/30 bg-muted/30"
                      : "border-primary/25 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                    <span className="font-bold">{templateTypeLabel(n.template_type)}</span>
                    <span>{new Date(n.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-foreground whitespace-pre-line">
                    {n.note_text}
                  </p>
                  {n.visibility === "private" && (
                    <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                      내부 메모 (회원 비공개)
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 새 노트 작성 */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            한마디 보내기
          </div>
          <DietCoachTemplatePicker selectedId={tplId} onPick={handleTemplate} />
          <Textarea
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value.slice(0, 400));
              setTplId(null);
            }}
            placeholder="회원에게 보낼 메시지를 입력해 주세요"
            className="min-h-[80px] rounded-xl text-[13px]"
          />
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              disabled={createNote.isPending || !noteText.trim()}
              onClick={() => handleSend("private")}
              className="flex-1 h-10 rounded-xl"
            >
              내부 메모
            </Button>
            <Button
              disabled={createNote.isPending || !noteText.trim()}
              onClick={() => handleSend("member_visible")}
              className={cn(
                "flex-1 h-10 rounded-xl font-bold",
                "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
              )}
            >
              회원에게 전송
            </Button>
          </div>
        </section>

        {/* 유지 플랜 추천 (Day 18+) */}
        {e.current_day >= 18 && (
          <section className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground">유지 플랜 추천</h3>
            <ul className="space-y-1.5">
              {DIET_MAINTENANCE_VARIANTS.map((v) => (
                <li
                  key={v.id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <p className="text-[12.5px] font-bold text-foreground">
                    {v.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {v.summary}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              회원에게 가장 잘 맞는 한 가지를 골라 권유해 주세요.
            </p>
          </section>
        )}
      </div>
    </Shell>
  );
};

// ──────────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────────
const Shell = ({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) => (
  <AppPage
    header={
      <PageHeader
        title="회원 상세"
        subtitle="153 다이어트 진행 현황"
        leftAction={
          <button
            type="button"
            onClick={onBack}
            className="rounded-full bg-secondary p-2 active:scale-95"
            aria-label="돌아가기"
          >
            <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
          </button>
        }
        sticky
      />
    }
  >
    {children}
  </AppPage>
);

function templateTypeLabel(t: string): string {
  const map: Record<string, string> = {
    general: "일반 피드백",
    warning: "주의 안내",
    celebration: "격려·축하",
    correction: "수정 요청",
    weekly: "주간 리뷰",
  };
  return map[t] ?? t;
}

function warningFlagChips(flags: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (flags.pregnancy_breastfeeding) out.push("임신·수유");
  if (flags.diabetes_medication) out.push("혈당 관리 중");
  if (flags.eating_disorder_risk) out.push("섭식 관련 치료 경험");
  if (flags.is_youth) out.push("청소년 트랙");
  return out;
}

export default DietMemberDetailPage;
