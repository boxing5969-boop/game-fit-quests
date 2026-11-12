// 훈련 라이브러리 — 153 콘텐츠 카드(training_exercises) 보기 · 고치기 · 영상 넣기.
// 2026-11-13 대표님 「추천대로 진행」: 회원은 훈련 탭 「영상으로 배우기」로 옮겼다(이 주소는 App 에서 그리로 넘긴다) — 이 화면은 코치진.
//   · 카드 보기 = 카드 시트(TrainingDrillSheet) 그대로 · 고치기 · 추가 · 삭제 · 영상 넣기 = 대표님 · 운영진(admin · super_admin, 결정 6번)
//   · 영상 칸(회원용 · 코치용 · 첫 장면 · 분 · 준비물)은 마이그레이션 20261113…_training_cards 를 적용한 DB 에서만 보인다(줄에 칸이 있으면)
// 데이터: training_exercises (RLS: 켜진 카드 공개 읽기 / 쓰기는 마이그레이션 뒤 대표님 · 운영진). 영상 = 비공개 저장소 training-videos.
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { toast } from "sonner";
import { ArrowLeft, X, Target, PlayCircle, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { HANDWRAP_EXERCISE_NAME } from "@/data/handWrapGuide";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";
import { normalizeCard, type TrainingCard } from "@/lib/trainingCards";
import { clearCardVideo, uploadCardVideo, type CardVideoKind } from "@/services/trainingCardService";

interface Ex {
  id: string; category: string; name: string; summary: string; description: string;
  benefits: string; target: string; difficulty: string;
  video_url: string | null; image_url: string | null;
  cues: string[]; mistakes: string[]; level_min: number | null; sort_order: number; is_active: boolean;
  /** 마이그레이션 뒤 생기는 칸 (없을 수 있음) */
  video_path?: string | null; coach_video_path?: string | null; poster_path?: string | null;
  minutes?: number | null; equipment?: string | null;
}

const VIDEO_SLOTS: Array<{ kind: CardVideoKind; col: "video_path" | "coach_video_path" | "poster_path"; label: string; accept: string }> = [
  { kind: "member", col: "video_path", label: "회원용 영상", accept: "video/mp4" },
  { kind: "coach", col: "coach_video_path", label: "코치용 영상", accept: "video/mp4" },
  { kind: "poster", col: "poster_path", label: "첫 장면 그림", accept: "image/webp,image/jpeg,image/png" },
];

const DIFF_COLOR: Record<string, string> = {
  "초급": "bg-status-complete/10 text-status-complete",
  "중급": "bg-primary/10 text-primary",
  "고급": "bg-destructive/10 text-destructive",
};

const blankForm = {
  category: "기본기", name: "", summary: "", description: "", benefits: "", target: "",
  difficulty: "초급", video_url: "", image_url: "", cues: "", mistakes: "", sort_order: "0",
  minutes: "", equipment: "",
};

const TrainingLibraryPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isStaff = isManagerRole(role);
  // 카드 글 · 영상 고치기는 모든 지점이 같이 보는 것이라 대표님 · 운영진만 (결정 6번 — 서버 쓰기 권한도 같게 좁힌다)
  const canEdit = role === "admin" || role === "super_admin";
  const qc = useQueryClient();
  const [videoBusy, setVideoBusy] = useState<CardVideoKind | null>(null);
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
  // 영상 칸이 있는 DB 인가 (마이그레이션 적용 뒤) — 없으면 영상 넣기 · 분 · 준비물 칸을 숨긴다
  const hasVideoCols = rows.length > 0 && "video_path" in rows[0];

  const openEdit = (ex: Ex | "new") => {
    if (ex === "new") setForm(blankForm);
    else setForm({
      category: ex.category, name: ex.name, summary: ex.summary, description: ex.description,
      benefits: ex.benefits, target: ex.target, difficulty: ex.difficulty,
      video_url: ex.video_url || "", image_url: ex.image_url || "",
      cues: (ex.cues || []).join("\n"), mistakes: (ex.mistakes || []).join("\n"), sort_order: String(ex.sort_order ?? 0),
      minutes: ex.minutes ? String(ex.minutes) : "", equipment: ex.equipment || "",
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
      ...(hasVideoCols
        ? {
            minutes: form.minutes.trim() ? Math.max(1, Math.min(120, Math.round(Number(form.minutes) || 0))) || null : null,
            equipment: form.equipment.trim().slice(0, 60) || null,
          }
        : {}),
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

  // 영상 넣기 · 빼기 — 고치는 카드에 바로 붙인다 (새 카드는 저장한 뒤에)
  const putVideo = async (ex: Ex, kind: CardVideoKind, file: File | undefined) => {
    if (!file) return;
    setVideoBusy(kind);
    try {
      const path = await uploadCardVideo(ex, kind, file);
      const col = VIDEO_SLOTS.find((v) => v.kind === kind)!.col;
      setEditing((cur) => (cur && cur !== "new" && cur.id === ex.id ? { ...cur, [col]: path } : cur));
      toast.success(`${VIDEO_SLOTS.find((v) => v.kind === kind)!.label}을 붙였어요`);
      qc.invalidateQueries({ queryKey: ["training-library"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVideoBusy(null);
    }
  };
  const dropVideo = async (ex: Ex, kind: CardVideoKind) => {
    const slot = VIDEO_SLOTS.find((v) => v.kind === kind)!;
    if (!confirm(`'${ex.name}' 카드에서 ${slot.label}을 뺄까요? (파일은 저장소에 남아요)`)) return;
    setVideoBusy(kind);
    try {
      await clearCardVideo(ex, kind);
      setEditing((cur) => (cur && cur !== "new" && cur.id === ex.id ? { ...cur, [slot.col]: null } : cur));
      qc.invalidateQueries({ queryKey: ["training-library"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVideoBusy(null);
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
        <h1 className="text-heading font-black">훈련 라이브러리</h1>
        {canEdit && (
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => navigate("/routine-builder")} className="rounded-lg bg-muted px-2.5 py-1.5 text-label font-bold text-foreground active:scale-95">
              🥊 루틴 빌더
            </button>
            <button onClick={() => openEdit("new")} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-label font-bold text-primary-foreground active:scale-95">
              <Plus className="h-3.5 w-3.5" /> 추가
            </button>
          </div>
        )}
      </div>
      <p className="mb-3 text-label leading-relaxed text-muted-foreground">
        153 콘텐츠 카드예요. 회원님은 훈련 탭 「영상으로 배우기」에서, 코치님은 전략 회의 영상 칸에서 같은 카드를 봐요.
        {canEdit ? " 카드 글 · 영상은 여기서 고쳐요." : " 카드 글 · 영상 고치기는 대표님 · 운영진이 해요."}
      </p>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-label font-bold transition-all active:scale-95 ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{c}</button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-body text-muted-foreground">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-body text-muted-foreground">등록된 훈련이 없습니다.</p>
      ) : (
        <div className="space-y-2.5">
          {list.map((ex) => (
            <div key={ex.id} className={`rounded-2xl border border-border bg-card p-4 shadow-elev-1 ${!ex.is_active ? "opacity-50" : ""}`}>
              <button onClick={() => setSel(ex)} className="w-full text-left transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-bold text-foreground">{ex.name}{!ex.is_active && <span className="ml-1 text-label text-muted-foreground">(비활성)</span>}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-bold ${DIFF_COLOR[ex.difficulty] || "bg-muted text-muted-foreground"}`}>{ex.difficulty}</span>
                </div>
                <p className="mt-1 text-label text-muted-foreground">{ex.summary}</p>
                <div className="mt-2 flex items-center gap-2 text-label text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{ex.category}</span>
                  {ex.target && <span className="flex items-center gap-0.5"><Target className="h-3 w-3" />{ex.target}</span>}
                  {(ex.video_url || ex.video_path) && <span className="flex items-center gap-0.5 text-primary"><PlayCircle className="h-3 w-3" />영상</span>}
                  {ex.coach_video_path && <span className="text-primary">코치용</span>}
                </div>
              </button>
              {canEdit && (
                <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
                  <button onClick={() => openEdit(ex)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-micro font-bold text-foreground active:scale-95"><Pencil className="h-3 w-3" />수정</button>
                  <button onClick={() => remove(ex)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-micro font-bold text-destructive active:scale-95"><Trash2 className="h-3 w-3" />삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 상세 보기 — 회원 · 코치 화면과 같은 카드 시트 (붕대 감기는 맨 아래 전용 화면 단추) */}
      <TrainingDrillSheet
        exercise={sel ? normalizeCard(sel as unknown as Record<string, unknown>) : null}
        list={list.map((r) => normalizeCard(r as unknown as Record<string, unknown>))}
        onChange={(c: TrainingCard) => setSel(rows.find((r) => r.id === c.id) ?? null)}
        onClose={() => setSel(null)}
        footer={(c) =>
          c.name === HANDWRAP_EXERCISE_NAME ? (
            <button
              onClick={() => navigate("/handwrap")}
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-primary/10 px-3.5 py-3 text-left text-body font-bold text-primary transition-all active:scale-[0.99]"
            >
              붕대 감기 영상 · 사진 · 집 연습 미션
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          ) : null
        }
      />

      {/* 관리자 편집 */}
      {editing && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-body font-black text-foreground">{editing === "new" ? "훈련 추가" : "훈련 수정"}</h2>
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
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
              ))}
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground">
                <option value="초급">초급</option><option value="중급">중급</option><option value="고급">고급</option>
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="방법 설명 (자세히)" rows={4}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
              <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="무엇이 좋아지는지" rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
              <textarea value={form.cues} onChange={(e) => setForm({ ...form, cues: e.target.value })} placeholder="코치 포인트 (한 줄에 하나씩)" rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
              <textarea value={form.mistakes} onChange={(e) => setForm({ ...form, mistakes: e.target.value })} placeholder="흔한 실수 (한 줄에 하나씩)" rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
              <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="정렬 순서 (숫자)" type="number"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
              {hasVideoCols && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="기본 몇 분 (예: 5)" type="number" inputMode="numeric"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
                  <input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="준비물 (예: 아령 0.5~1kg)" maxLength={60}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground" />
                </div>
              )}
              {/* 영상 넣기 — 비공개 저장소 training-videos (회원용 = 로그인한 사람 누구나 · 코치용 = 코치진만). 크롬으로 넣을 땐 10MB 안 */}
              {hasVideoCols && editing !== "new" && editing && (
                <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                  <p className="text-label font-bold text-foreground">영상 · 첫 장면 <span className="font-medium text-muted-foreground">mp4 · 10MB 안 · 회원용은 코치님 동의 뒤</span></p>
                  {VIDEO_SLOTS.map((slot) => {
                    const path = editing[slot.col] ?? null;
                    return (
                      <div key={slot.kind} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-label font-bold text-foreground">{slot.label}</span>
                        <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">{path ?? "없음"}</span>
                        <label className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-label font-bold ${videoBusy ? "pointer-events-none opacity-50" : "bg-primary text-primary-foreground"}`}>
                          {videoBusy === slot.kind ? "올리는 중…" : path ? "바꾸기" : "넣기"}
                          <input
                            type="file"
                            accept={slot.accept}
                            className="sr-only"
                            aria-label={`${slot.label} 넣기`}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              void putVideo(editing, slot.kind, f);
                            }}
                          />
                        </label>
                        {path && (
                          <button type="button" onClick={() => void dropVideo(editing, slot.kind)} className="shrink-0 rounded-lg bg-muted px-2 py-1.5 text-label font-bold text-destructive">
                            빼기
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={save} disabled={saving} className="mt-4 w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingLibraryPage;
