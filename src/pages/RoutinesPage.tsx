// 회원 수업 루틴 — 코치가 만든 4단계 루틴을 열람하고, '수업 완료'를 기록하면
// 출석·훈련시간(3·3·3)이 쌓인다. 서로 다른 3일 채우면 레벨업을 신청할 수 있다(심사 탭).
// 연결: 훈련 라이브러리 → (코치)루틴 빌더 → (회원)수업 실행·기록 → 3·3·3 → 레벨업.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, X, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { PHASE_META, type RoutinePhases, emptyPhases } from "@/lib/routineComposer";

interface Routine { id: string; name: string; description: string; target_level: number | null; phases: RoutinePhases; total_min: number; }
interface Cycle { sessions: number; days: number; minutes: number; reqSessions: number; reqDays: number; reqMinutes: number; meets: boolean; }

const CycleBar = ({ label, cur, req, unit }: { label: string; cur: number; req: number; unit: string }) => {
  const done = cur >= req;
  return (
    <div className="flex-1">
      <div className="mb-0.5 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={done ? "font-bold text-status-complete" : "text-foreground"}>{cur}/{req}{unit}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${done ? "bg-status-complete" : "bg-primary"}`} style={{ width: `${Math.min(100, (cur / Math.max(1, req)) * 100)}%` }} />
      </div>
    </div>
  );
};

const RoutinesPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sel, setSel] = useState<Routine | null>(null);

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["member-routines"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("class_routines").select("*").eq("is_active", true).order("target_level", { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ ...r, phases: r.phases || emptyPhases() })) as Routine[];
    },
  });

  const { data: cycle } = useQuery({
    queryKey: ["level-cycle", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  const record = useMutation({
    mutationFn: async (r: Routine) => {
      const { error } = await (supabase.rpc as any)("record_training_session", { _routine_id: r.id, _minutes: r.total_min || 50 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("수업 완료로 기록했어요! 출석·훈련시간이 쌓였습니다 💪");
      qc.invalidateQueries({ queryKey: ["level-cycle"] });
      setSel(null);
    },
    onError: (e: any) => toast.error(e?.message || "기록 실패"),
  });

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-4 pb-24 pt-4 text-foreground">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-black">수업 루틴</h1>
      </div>

      {/* 레벨업 연결 배너 */}
      {cycle && (
        <div className="mb-3 rounded-2xl border border-border bg-card p-3 shadow-elev-1">
          <div className="mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">레벨업까지</span>
            <span className="text-[10px] text-muted-foreground">수업을 하고 기록하면 채워져요</span>
          </div>
          <div className="flex gap-2">
            <CycleBar label="출석" cur={cycle.sessions} req={cycle.reqSessions} unit="회" />
            <CycleBar label="출석일" cur={cycle.days} req={cycle.reqDays} unit="일" />
            <CycleBar label="훈련" cur={cycle.minutes} req={cycle.reqMinutes} unit="분" />
          </div>
          {cycle.meets && (
            <button onClick={() => navigate("/missions")} className="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground active:scale-95">
              조건 충족! 레벨업 신청하러 가기 →
            </button>
          )}
        </div>
      )}

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">코치가 준비한 수업 루틴이에요. 오늘 수업을 마치면 아래에서 '수업 완료'를 눌러 기록하세요.</p>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : routines.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">아직 등록된 수업 루틴이 없습니다. 코치님이 곧 준비해요.</p>
      ) : (
        <div className="space-y-2.5">
          {routines.map((r) => (
            <button key={r.id} onClick={() => setSel(r)} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-elev-1 transition-all active:scale-[0.99]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-foreground">{r.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{r.total_min}분</span>
              </div>
              {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PHASE_META.map((m) => (
                  <span key={m.key} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">{m.emoji} {r.phases[m.key]?.length || 0}</span>
                ))}
                {r.target_level && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Lv.{r.target_level}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 상세 + 수업 완료 */}
      {sel && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setSel(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">{sel.name}</h2>
              <button onClick={() => setSel(null)} className="rounded-lg p-1 active:scale-95"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />총 {sel.total_min}분{sel.target_level ? ` · Lv.${sel.target_level} 권장` : ""}</p>

            {PHASE_META.map((m) => {
              const items = sel.phases[m.key] || [];
              if (items.length === 0) return null;
              return (
                <div key={m.key} className="mb-3">
                  <p className="mb-1.5 text-sm font-bold text-foreground">{m.emoji} {m.label}</p>
                  <div className="space-y-1.5">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{it.name}</p>
                          {it.note && <p className="text-[11px] text-muted-foreground">{it.note}</p>}
                        </div>
                        <span className="shrink-0 text-xs font-bold text-muted-foreground">{it.minutes}분</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => record.mutate(sel)}
              disabled={record.isPending}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> 이 수업 완료로 기록
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">기록하면 출석·훈련시간이 쌓여요. 서로 다른 3일 동안 하면 레벨업을 신청할 수 있어요.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutinesPage;
