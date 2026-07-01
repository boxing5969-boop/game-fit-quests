// 50분 수업 구성 편집기 — 마스터(admin/super_admin) 전용.
// 블록 추가·삭제·순서변경 + 시간·강도·설명·드릴까지 전체 편집 → session_templates upsert.
// 저장하면 해당 레벨을 보는 모든 회원에게 즉시 반영된다(다음 로드/갱신 시).
import { useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { SessionBlock, IntensityLevel, SessionDrill } from "@/data/whiteLevel1Data";

const INTENSITIES: IntensityLevel[] = ["가볍게", "보통", "조금 힘듦"];

const newBlock = (): SessionBlock => ({
  id: "blk-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  timeRange: "",
  title: "새 블록",
  durationMin: 5,
  intensity: "보통",
  rpe: "",
  emoji: "🥊",
  description: "",
  drills: [],
});

interface Props {
  levelKey: string;
  levelLabel: string;
  initialBlocks: SessionBlock[];
  onClose: () => void;
  onSaved: () => void;
}

const inputCls = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground";

const SessionTemplateEditor = ({ levelKey, levelLabel, initialBlocks, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<SessionBlock[]>(() => JSON.parse(JSON.stringify(initialBlocks || [])));
  const [saving, setSaving] = useState(false);

  const totalMin = blocks.reduce((s, b) => s + (Number(b.durationMin) || 0), 0);

  const patch = (i: number, p: Partial<SessionBlock>) =>
    setBlocks((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const copy = [...bs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const removeBlock = (i: number) => setBlocks((bs) => bs.filter((_, idx) => idx !== i));
  const addBlock = () => setBlocks((bs) => [...bs, newBlock()]);

  const patchDrill = (bi: number, di: number, p: Partial<SessionDrill>) =>
    setBlocks((bs) =>
      bs.map((b, idx) => (idx === bi ? { ...b, drills: b.drills.map((d, j) => (j === di ? { ...d, ...p } : d)) } : b)),
    );
  const addDrill = (bi: number) =>
    setBlocks((bs) => bs.map((b, idx) => (idx === bi ? { ...b, drills: [...b.drills, { name: "" }] } : b)));
  const removeDrill = (bi: number, di: number) =>
    setBlocks((bs) => bs.map((b, idx) => (idx === bi ? { ...b, drills: b.drills.filter((_, j) => j !== di) } : b)));

  const save = async () => {
    const clean = blocks
      .map((b) => ({ ...b, drills: b.drills.filter((d) => d.name.trim()) }))
      .filter((b) => b.title.trim());
    if (clean.length === 0) {
      toast.error("최소 1개 블록이 필요합니다");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("session_templates")
        .upsert({ level_key: levelKey, blocks: clean, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("수업 구성을 저장했습니다. 모든 회원에게 반영됩니다.");
      onSaved();
    } catch (e) {
      toast.error("저장 실패: " + ((e as Error)?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background safe-area-top">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-[11px] text-muted-foreground">{levelLabel} · 수업 구성 편집</p>
          <p className="text-sm font-bold text-foreground">
            총 {totalMin}분 · {blocks.length}블록
          </p>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 블록 리스트 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {blocks.map((b, i) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={b.emoji} onChange={(e) => patch(i, { emoji: e.target.value })} className="w-12 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-base" />
              <input value={b.title} onChange={(e) => patch(i, { title: e.target.value })} className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-bold text-foreground" placeholder="블록 제목" />
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg bg-muted p-1.5 text-muted-foreground active:scale-95 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="rounded-lg bg-muted p-1.5 text-muted-foreground active:scale-95 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              <button onClick={() => removeBlock(i)} className="rounded-lg bg-muted p-1.5 text-destructive active:scale-95"><Trash2 className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] text-muted-foreground">시간대</label>
                <input value={b.timeRange} onChange={(e) => patch(i, { timeRange: e.target.value })} className={inputCls} placeholder="0:00–5:00" />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-muted-foreground">분</label>
                <input type="number" inputMode="numeric" value={b.durationMin} onChange={(e) => patch(i, { durationMin: Number(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-muted-foreground">강도</label>
                <select value={b.intensity} onChange={(e) => patch(i, { intensity: e.target.value as IntensityLevel })} className={inputCls}>
                  {INTENSITIES.map((it) => <option key={it} value={it}>{it}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-muted-foreground">RPE</label>
                <input value={b.rpe} onChange={(e) => patch(i, { rpe: e.target.value })} className={inputCls} placeholder="RPE 4–5" />
              </div>
            </div>

            <div className="mt-2">
              <label className="mb-0.5 block text-[10px] text-muted-foreground">설명</label>
              <input value={b.description} onChange={(e) => patch(i, { description: e.target.value })} className={inputCls} placeholder="이 블록의 목적" />
            </div>

            {/* 드릴 */}
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground">드릴</label>
                <button onClick={() => addDrill(i)} className="flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground active:scale-95"><Plus className="h-3 w-3" /> 드릴</button>
              </div>
              <div className="space-y-1.5">
                {b.drills.map((d, di) => (
                  <div key={di} className="flex items-center gap-1.5">
                    <input value={d.name} onChange={(e) => patchDrill(i, di, { name: e.target.value })} className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground" placeholder="드릴명" />
                    <input value={d.detail ?? ""} onChange={(e) => patchDrill(i, di, { detail: e.target.value })} className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted-foreground" placeholder="30초/10회" />
                    <button onClick={() => removeDrill(i, di)} className="rounded-md bg-muted p-1 text-destructive active:scale-95"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <label className="mb-0.5 block text-[10px] text-muted-foreground">초보자 대체 (선택)</label>
              <input value={b.beginnerAlt ?? ""} onChange={(e) => patch(i, { beginnerAlt: e.target.value })} className={inputCls} placeholder="예: 에어 줄넘기로 대체" />
            </div>
          </div>
        ))}

        <button onClick={addBlock} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary active:scale-[0.98]">
          <Plus className="h-4 w-4" /> 블록 추가
        </button>
      </div>

      {/* 저장 바 */}
      <div className="border-t border-border p-4">
        <button onClick={save} disabled={saving} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
          {saving ? "저장 중..." : "저장하고 전체 회원에게 반영"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">합계가 50분(±)이 되도록 시간을 배분하세요. 저장 즉시 모든 회원의 수업 구성이 바뀝니다.</p>
      </div>
    </div>
  );
};

export default SessionTemplateEditor;
