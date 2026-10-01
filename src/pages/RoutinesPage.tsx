// 회원 수업 루틴 — 코치가 만든 4단계 루틴을 열람하고, '수업 완료'를 기록하면
// 얼굴 인식 출석이 리그별 요건(화이트3·블루5·레드8·블랙20회)만큼 쌓이면 승급된다.
// 화이트·블루는 자동, 레드·블랙은 승급 심사, 10레벨은 코치 승인. 2026-09-07 개편.
// 연결: 훈련 라이브러리 → (코치)루틴 빌더 → (회원)수업 실행·기록 → 3·3·3 → 레벨업.
//
// 📋 2026-09-30 대표님: 레벨마다 3일 수업 — 일차별 수업 매뉴얼(level_lesson_days)을 이 화면 맨 위에.
//   오늘(다음) 수업 카드 → 레벨별 1·2·3일차 목록 → 누르면 그날 수업 시트(?day=N, 뒤로가기로 닫힘).
//   코치님이 만든 루틴(class_routines)은 있을 때만 아래에 따로 보인다.
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, X, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { PHASE_META, type RoutinePhases, emptyPhases } from "@/lib/routineComposer";
import { useLessonDays, useLessonToday } from "@/hooks/useLessonDays";
import { groupByLevel } from "@/lib/lessonDays";
import LessonTodayCard from "@/components/lesson/LessonTodayCard";
import LessonDayList from "@/components/lesson/LessonDayList";
import LessonDaySheet from "@/components/lesson/LessonDaySheet";

interface Routine { id: string; name: string; description: string; target_level: number | null; phases: RoutinePhases; total_min: number; }
interface Cycle {
  sessions: number; days: number; minutes: number;
  /** 승급 진행량 내림값 (출석 1회 = 1, 운동시간 보너스 포함) — 판정(meets)과 같은 숫자 */
  progressFloor?: number;
  reqSessions: number; reqDays: number; reqMinutes: number; meets: boolean;
  reqMinDays?: number; elapsedDays?: number; rank?: string;
}

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

  // 📋 일차별 수업 매뉴얼
  const lessonDays = useLessonDays();
  const { data: lessonToday } = useLessonToday();
  const lessonGroups = groupByLevel(lessonDays.data ?? []);
  const [params, setParams] = useSearchParams();
  const openDayNo = Number(params.get("day")) || null;
  const openDay = openDayNo ? lessonDays.byDayNo.get(openDayNo) ?? null : null;
  // 목록에서 열었으면(주소를 한 칸 쌓았으면) 닫을 때 한 칸 뒤로 — 훈련 탭에서 ?day 로 바로 왔으면 주소만 지운다
  const pushedDay = useRef(false);
  useEffect(() => {
    if (!openDayNo) pushedDay.current = false;
  }, [openDayNo]);
  const openLesson = (dayNo: number) => {
    pushedDay.current = true;
    setParams({ day: String(dayNo) });
  };
  const switchLesson = (dayNo: number) => setParams({ day: String(dayNo) }, { replace: true });
  const closeLesson = () => {
    if (pushedDay.current) {
      pushedDay.current = false;
      navigate(-1);
    } else {
      setParams({}, { replace: true });
    }
  };

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
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  // 레드·블랙은 출석만으로 승급되지 않는다 — 반드시 승급 심사를 거친다.
  const needsReview = cycle?.rank === "red" || cycle?.rank === "black";

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
            <span className="text-[10px] text-muted-foreground">
              출석 {cycle.reqSessions}회마다 {cycle.rank === "red" || cycle.rank === "black" ? "승급 심사" : "자동 승급"}
            </span>
          </div>
          <div className="flex gap-2">
            <CycleBar label="출석" cur={cycle.progressFloor ?? cycle.sessions} req={cycle.reqSessions} unit="회" />
            {/* 블랙 리그는 출석 수와 별개로 최소 연한이 있다 */}
            {(cycle.reqMinDays ?? 0) > 0 && (
              <CycleBar label="연한" cur={cycle.elapsedDays ?? 0} req={cycle.reqMinDays ?? 0} unit="일" />
            )}
          </div>
          {cycle.meets && (
            <p className="mt-2 w-full rounded-lg bg-primary/10 py-2 text-center text-xs font-bold text-primary">
              {needsReview
                ? "요건을 다 채웠어요 — 심사가 열리면 담당자 확인 후 승급돼요"
                : "출석을 다 채웠어요 — 다음 출석 때 자동으로 승급돼요"}
            </p>
          )}
        </div>
      )}

      {/* ── 📋 일차별 수업 매뉴얼 ── */}
      <LessonTodayCard onOpen={openLesson} showEmpty className="mb-4" />

      <div className="mb-2.5 px-1">
        <h2 className="text-[17px] font-black text-foreground">153 수업 매뉴얼</h2>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
          레벨마다 3일 — 코치님과 이 순서대로 배워요. 누르면 그날 라운드·주의할 점이 나와요.
        </p>
      </div>
      {lessonDays.isLoading ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : lessonDays.isError ? (
        <div className="rounded-2xl bg-card px-4 py-8 text-center shadow-elev-1">
          <p className="text-[14px] font-bold text-foreground">수업 매뉴얼을 불러오지 못했어요</p>
          <button
            type="button"
            onClick={() => lessonDays.refetch()}
            className="mt-3 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : lessonGroups.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-8 text-center text-[13px] text-muted-foreground">
          수업 매뉴얼을 준비하고 있어요
        </p>
      ) : (
        <LessonDayList groups={lessonGroups} today={lessonToday} onOpen={openLesson} />
      )}

      {/* ── 코치님이 만든 루틴 — 있을 때만 ── */}
      {!isLoading && routines.length > 0 && (
        <div className="mb-2.5 mt-6 px-1">
          <h2 className="text-[17px] font-black text-foreground">코치님 루틴</h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            코치가 준비한 수업 루틴이에요. 오늘 수업을 마치면 '수업 완료'를 눌러 기록하세요.
          </p>
        </div>
      )}
      {isLoading || routines.length === 0 ? null : (
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
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              출석은 입구 얼굴 인식으로 자동으로 쌓여요.
              {cycle ? ` 레벨당 ${cycle.reqSessions}회${needsReview ? " + 코치님 승급 심사" : "면 자동 승급"}!` : ""}
            </p>
          </div>
        </div>
      )}

      <LessonDaySheet
        day={openDay}
        byDayNo={lessonDays.byDayNo}
        today={lessonToday}
        onClose={closeLesson}
        onOpenDay={switchLesson}
      />
    </div>
  );
};

export default RoutinesPage;
