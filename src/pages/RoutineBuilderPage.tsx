// 코치 루틴 빌더 — 훈련 라이브러리에서 골라 워밍업/본운동/마무리/쿨다운 4단계로 수업 구성.
// 데이터: class_routines(phases jsonb) + training_exercises(피커). 자동 구성은 lib/routineComposer.
// 접근: ManagerRoute (코치/관장/마스터).
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, X, Plus, Pencil, Trash2, Sparkles, Clock } from "lucide-react";
import {
  composeRoutine, emptyPhases, phasesTotal, PHASE_META,
  type RoutinePhases, type RoutineItem, type LibEx,
} from "@/lib/routineComposer";

interface Routine {
  id: string; name: string; description: string; target_level: number | null;
  phases: RoutinePhases; total_min: number; branch_name: string | null; is_active: boolean;
}
interface EditState { id?: string; name: string; description: string; target_level: string; phases: RoutinePhases; }

const RoutineBuilderPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [picker, setPicker] = useState<keyof RoutinePhases | null>(null);
  const [pickerCat, setPickerCat] = useState("전체");
  const [saving, setSaving] = useState(false);

  const { data: routines = [] } = useQuery({
    queryKey: ["class-routines"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("class_routines").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ ...r, phases: r.phases || emptyPhases() })) as Routine[];
    },
  });

  const { data: lib = [] } = useQuery({
    queryKey: ["routine-lib"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("training_exercises").select("id, category, name, difficulty, target").eq("is_active", true).order("category");
      if (error) throw error;
      return (data || []) as LibEx[];
    },
  });
  const libCats = useMemo(() => ["전체", ...Array.from(new Set(lib.map((e) => e.category)))], [lib]);

  const newRoutine = () => setEdit({ name: "", description: "", target_level: "", phases: emptyPhases() });
  const editRoutine = (r: Routine) => setEdit({ id: r.id, name: r.name, description: r.description, target_level: r.target_level ? String(r.target_level) : "", phases: r.phases || emptyPhases() });

  const auto = () => {
    if (!edit) return;
    if (lib.length === 0) { toast.error("먼저 훈련 라이브러리에 운동을 추가하세요"); return; }
    setEdit({ ...edit, phases: composeRoutine(lib, Number(edit.target_level) || undefined) });
    toast.success("자동 구성 완료 — 필요하면 수정하세요");
  };

  const addItem = (phase: keyof RoutinePhases, e: LibEx) => {
    if (!edit) return;
    const it: RoutineItem = { exercise_id: e.id, name: e.name, category: e.category, minutes: 5, note: "" };
    setEdit({ ...edit, phases: { ...edit.phases, [phase]: [...edit.phases[phase], it] } });
  };
  const updItem = (phase: keyof RoutinePhases, idx: number, field: keyof RoutineItem, val: string | number) => {
    if (!edit) return;
    const arr = edit.phases[phase].map((it, i) => (i === idx ? { ...it, [field]: field === "minutes" ? Number(val) || 0 : val } : it));
    setEdit({ ...edit, phases: { ...edit.phases, [phase]: arr } });
  };
  const rmItem = (phase: keyof RoutinePhases, idx: number) => {
    if (!edit) return;
    setEdit({ ...edit, phases: { ...edit.phases, [phase]: edit.phases[phase].filter((_, i) => i !== idx) } });
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error("루틴 이름을 입력하세요"); return; }
    setSaving(true);
    const payload = {
      name: edit.name.trim(), description: edit.description.trim(),
      target_level: edit.target_level ? Number(edit.target_level) : null,
      phases: edit.phases, total_min: phasesTotal(edit.phases),
      branch_name: profile?.branch_name ?? null,
    };
    try {
      if (edit.id) {
        const { error } = await (supabase as any).from("class_routines").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("class_routines").insert(payload);
        if (error) throw error;
      }
      toast.success("저장했습니다");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["class-routines"] });
    } catch (e: any) {
      toast.error("저장 실패: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Routine) => {
    if (!confirm(`'${r.name}' 루틴을 삭제할까요?`)) return;
    const { error } = await (supabase as any).from("class_routines").delete().eq("id", r.id);
    if (error) { toast.error("삭제 실패"); return; }
    toast.success("삭제했습니다");
    qc.invalidateQueries({ queryKey: ["class-routines"] });
  };

  const pickerList = pickerCat === "전체" ? lib : lib.filter((e) => e.category === pickerCat);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-4 pb-24 pt-4 text-foreground">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-black">수업 루틴 빌더</h1>
        <button onClick={newRoutine} className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground active:scale-95">
          <Plus className="h-3.5 w-3.5" /> 새 루틴
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">라이브러리 운동을 워밍업·본운동·마무리·쿨다운 4단계로 구성하세요. '자동 구성'으로 초안을 만든 뒤 다듬을 수 있어요.</p>

      {routines.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">아직 만든 루틴이 없습니다. '새 루틴'으로 시작하세요.</p>
      ) : (
        <div className="space-y-2.5">
          {routines.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-foreground">{r.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{r.total_min}분</span>
              </div>
              {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PHASE_META.map((m) => (
                  <span key={m.key} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">{m.emoji} {r.phases[m.key]?.length || 0}</span>
                ))}
                {r.target_level && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Lv.{r.target_level} 권장</span>}
              </div>
              <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
                <button onClick={() => editRoutine(r)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-foreground active:scale-95"><Pencil className="h-3 w-3" />수정</button>
                <button onClick={() => remove(r)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-destructive active:scale-95"><Trash2 className="h-3 w-3" />삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 편집 오버레이 */}
      {edit && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <button onClick={() => setEdit(null)} className="rounded-lg p-1 active:scale-95"><X className="h-5 w-5" /></button>
            <span className="text-base font-black">{edit.id ? "루틴 수정" : "새 루틴"}</span>
            <span className="ml-auto flex items-center gap-1 text-xs font-bold text-muted-foreground"><Clock className="h-3.5 w-3.5" />{phasesTotal(edit.phases)}분</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="루틴 이름 (예: 초급 기본기 50분)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            <div className="flex gap-2">
              <input value={edit.target_level} onChange={(e) => setEdit({ ...edit, target_level: e.target.value })} placeholder="권장 레벨(선택)" type="number"
                className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <button onClick={auto} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary active:scale-95">
                <Sparkles className="h-4 w-4" /> 자동 구성
              </button>
            </div>
            <input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="설명(선택)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />

            {PHASE_META.map((m) => (
              <div key={m.key} className="rounded-2xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{m.emoji} {m.label}</span>
                  <button onClick={() => { setPicker(m.key); setPickerCat("전체"); }} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-foreground active:scale-95">
                    <Plus className="h-3 w-3" /> 운동 추가
                  </button>
                </div>
                {edit.phases[m.key].length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">비어 있음</p>
                ) : (
                  <div className="space-y-1.5">
                    {edit.phases[m.key].map((it, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{it.name}</p>
                          <input value={it.note} onChange={(e) => updItem(m.key, idx, "note", e.target.value)} placeholder="메모(선택)"
                            className="mt-0.5 w-full bg-transparent text-[11px] text-muted-foreground placeholder:text-muted-foreground focus:outline-none" />
                        </div>
                        <input value={it.minutes} onChange={(e) => updItem(m.key, idx, "minutes", e.target.value)} type="number"
                          className="w-12 rounded-lg border border-border bg-background px-1.5 py-1 text-center text-xs text-foreground" />
                        <span className="text-[10px] text-muted-foreground">분</span>
                        <button onClick={() => rmItem(m.key, idx)} className="rounded-lg p-1 text-destructive active:scale-95"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border px-4 py-3">
            <button onClick={save} disabled={saving} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50">
              {saving ? "저장 중..." : "루틴 저장"}
            </button>
          </div>
        </div>
      )}

      {/* 라이브러리 피커 */}
      {picker && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setPicker(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-black text-foreground">운동 선택 → {PHASE_META.find((m) => m.key === picker)?.label}</span>
              <button onClick={() => setPicker(null)} className="rounded-lg p-1 active:scale-95"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {libCats.map((c) => (
                <button key={c} onClick={() => setPickerCat(c)} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold active:scale-95 ${pickerCat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{c}</button>
              ))}
            </div>
            <div className="space-y-1.5">
              {pickerList.map((e) => (
                <button key={e.id} onClick={() => { addItem(picker, e); toast.success(`${e.name} 추가`); }}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left active:scale-[0.99]">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{e.name}</p>
                    <p className="text-[10px] text-muted-foreground">{e.category} · {e.difficulty}{e.target ? ` · ${e.target}` : ""}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              ))}
              {pickerList.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">해당 카테고리에 운동이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutineBuilderPage;
