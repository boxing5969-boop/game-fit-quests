// 훈련 라이브러리 — 복싱 훈련을 카테고리별로 글·영상·이미지로 설명(회원 열람).
// 데이터: training_exercises (RLS: 공개 읽기 / 코치·관장 쓰기). 관리 UI는 이 화면에 통합(스태프만).
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { toast } from "sonner";
import { ArrowLeft, X, Target, AlertTriangle, CheckCircle2, PlayCircle, Plus, Pencil, Trash2 } from "lucide-react";

interface Ex {
  id: string; category: string; name: string; summary: string; description: string;
  benefits: string; target: string; difficulty: string;
  video_url: string | null; image_url: string | null;
  cues: string[]; mistakes: string[]; level_min: number | null; sort_order: number; is_active: boolean;
}

const DIFF_COLOR: Record<string, string> = {
  "초급": "bg-status-complete/10 text-status-complete",
  "중급": "bg-primary/10 text-primary",
  "고급": "bg-destructive/10 text-destructive",
};

const blankForm = {
  category: "기본기", name: "", summary: "", description: "", benefits: "", target: "",
  difficulty: "초급", video_url: "", image_url: "", cues: "", mistakes: "", sort_order: "0",
};

const TrainingLibraryPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isStaff = isManagerRole(role);
  const qc = useQueryClient();
  const [cat, setCat] = useState<string>("전체");
  const [sel, setSel] = useState<Ex | null>(null);
  const [editing, setEditing] = useState<Ex | "new" | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["training-library", isStaff],
    queryFn: async () => {
      let q = (supabase as any).from("training_exercises").select("*");
      if (!isStaff) q = q.eq("is_active", true);
      const { data, error } = await q.order("category", { ascending: true }).order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        cues: Array.isArray(r.cues) ? r.cues : [],
        mistakes: Array.isArray(r.mistakes) ? r.mistakes : [],
      })) as Ex[];
    },
  });

  const cats = useMemo(() => ["전체", ...Array.from(new Set(rows.map((r) => r.category)))], [rows]);
  const list = cat === "전체" ? rows : rows.filter((r) => r.category === cat);

  const openEdit = (ex: Ex | "new") => {
    if (ex === "new") setForm(blankForm);
    else setForm({
      category: ex.category, name: ex.name, summary: ex.summary, description: ex.description,
      benefits: ex.benefits, target: ex.target, difficulty: ex.difficulty,
      video_url: ex.video_url || "", image_url: ex.image_url || "",
      cues: (ex.cues || []).join("\n"), mistakes: (ex.mistakes || []).join("\n"), sort_order: String(ex.sort_order ?? 0),
    });
    setEditing(ex);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("훈련명을 입력하세요"); return; }
    setSaving(true);
    const payload = {
      category: form.category.trim() || "기본기",
      name: form.name.trim(), summary: form.summary.trim(), description: form.description.trim(),
      benefits: form.benefits.trim(), target: form.target.trim(), difficulty: form.difficulty,
      video_url: form.video_url.trim() || null, image_url: form.image_url.trim() || null,
      cues: form.cues.split("\n").map((s) => s.trim()).filter(Boolean),
      mistakes: form.mistakes.split("\n").map((s) => s.trim()).filter(Boolean),
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      if (editing === "new") {
        const { error } = await (supabase as any).from("training_exercises").insert(payload);
        if (error) throw error;
        toast.success("훈련을 추가했습니다");
      } else if (editing) {
        const { error } = await (supabase as any).from("training_exercises").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("수정했습니다");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["training-library"] });
    } catch (e: any) {
      toast.error("저장 실패: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ex: Ex) => {
    if (!confirm(`'${ex.name}' 훈련을 삭제할까요?`)) return;
    const { error } = await (supabase as any).from("training_exercises").delete().eq("id", ex.id);
    if (error) { toast.error("삭제 실패: " + error.message); return; }
    toast.success("삭제했습니다");
    qc.invalidateQueries({ queryKey: ["training-library"] });
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-4 pb-24 pt-4 text-foreground">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-black">훈련 라이브러리</h1>
        {isStaff && (
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => navigate("/routine-builder")} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground active:scale-95">
              🥊 루틴 빌더
            </button>
            <button onClick={() => openEdit("new")} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground active:scale-95">
              <Plus className="h-3.5 w-3.5" /> 추가
            </button>
          </div>
        )}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">복싱 훈련을 카테고리별로 모았어요. 각 훈련의 방법과 무엇이 좋아지는지 확인하고 수업에 활용하세요.</p>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{c}</button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">등록된 훈련이 없습니다.</p>
      ) : (
        <div className="space-y-2.5">
          {list.map((ex) => (
            <div key={ex.id} className={`rounded-2xl border border-border bg-card p-4 shadow-elev-1 ${!ex.is_active ? "opacity-50" : ""}`}>
              <button onClick={() => setSel(ex)} className="w-full text-left transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-foreground">{ex.name}{!ex.is_active && <span className="ml-1 text-[10px] text-muted-foreground">(비활성)</span>}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF_COLOR[ex.difficulty] || "bg-muted text-muted-foreground"}`}>{ex.difficulty}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{ex.summary}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{ex.category}</span>
                  {ex.target && <span className="flex items-center gap-0.5"><Target className="h-3 w-3" />{ex.target}</span>}
                  {ex.video_url && <span className="flex items-center gap-0.5 text-primary"><PlayCircle className="h-3 w-3" />영상</span>}
                </div>
              </button>
              {isStaff && (
                <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
                  <button onClick={() => openEdit(ex)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-foreground active:scale-95"><Pencil className="h-3 w-3" />수정</button>
                  <button onClick={() => remove(ex)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-destructive active:scale-95"><Trash2 className="h-3 w-3" />삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 상세 보기 */}
      {sel && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setSel(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">{sel.name}</h2>
              <button onClick={() => setSel(null)} className="rounded-lg p-1 active:scale-95"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-3 flex items-center gap-2 text-[11px]">
              <span className="rounded bg-muted px-2 py-0.5 font-semibold text-foreground">{sel.category}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${DIFF_COLOR[sel.difficulty] || "bg-muted text-muted-foreground"}`}>{sel.difficulty}</span>
              {sel.target && <span className="text-muted-foreground">{sel.target}</span>}
            </div>
            {sel.image_url && <img src={sel.image_url} alt={sel.name} className="mb-3 max-h-64 w-full rounded-xl object-cover" />}
            {sel.video_url && <video src={sel.video_url} controls playsInline className="mb-3 w-full rounded-xl bg-black" />}
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{sel.description}</p>
            {sel.benefits && (
              <div className="mt-3 rounded-xl bg-status-complete/10 p-3">
                <p className="text-xs font-bold text-status-complete">이런 게 좋아져요</p>
                <p className="mt-1 text-sm text-foreground">{sel.benefits}</p>
              </div>
            )}
            {sel.cues.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 flex items-center gap-1 text-xs font-bold text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />코치 포인트</p>
                <ul className="space-y-1">{sel.cues.map((c, i) => <li key={i} className="flex gap-1.5 text-sm text-foreground"><span className="text-primary">·</span>{c}</li>)}</ul>
              </div>
            )}
            {sel.mistakes.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 flex items-center gap-1 text-xs font-bold text-foreground"><AlertTriangle className="h-3.5 w-3.5 text-status-pending" />흔한 실수</p>
                <ul className="space-y-1">{sel.mistakes.map((c, i) => <li key={i} className="flex gap-1.5 text-sm text-muted-foreground"><span className="text-status-pending">·</span>{c}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 관리자 편집 */}
      {editing && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-foreground">{editing === "new" ? "훈련 추가" : "훈련 수정"}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 active:scale-95"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2.5">
              {([
                ["category", "카테고리 (예: 풋워크, 기본기, 방어)"],
                ["name", "훈련명"],
                ["summary", "한 줄 요약"],
                ["target", "좋아지는 부위/능력 (예: 하체·순발력)"],
                ["video_url", "영상 URL (선택)"],
                ["image_url", "이미지 URL (선택)"],
              ] as const).map(([k, ph]) => (
                <input key={k} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={ph}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              ))}
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                <option value="초급">초급</option><option value="중급">중급</option><option value="고급">고급</option>
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="방법 설명 (자세히)" rows={4}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="무엇이 좋아지는지" rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <textarea value={form.cues} onChange={(e) => setForm({ ...form, cues: e.target.value })} placeholder="코치 포인트 (한 줄에 하나씩)" rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <textarea value={form.mistakes} onChange={(e) => setForm({ ...form, mistakes: e.target.value })} placeholder="흔한 실수 (한 줄에 하나씩)" rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="정렬 순서 (숫자)" type="number"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <button onClick={save} disabled={saving} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingLibraryPage;
