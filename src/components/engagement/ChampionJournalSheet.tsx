/**
 * 153 QUEST — 챔피언 일기 작성 바텀시트 (MVP).
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 일절 미수정
 *   · 보상 amount 는 RPC 반환값(quest_xp_granted/gems_granted)만 사용
 *   · grant_gems 직접 호출 0건 — submit_champion_journal_entry 내부에서만 처리
 *   · ChatAssistant / 새 AI 챗박스 미사용
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, CheckCircle2, AlertTriangle, X, ImagePlus, Users, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { setJournalEntryOptions, uploadCommunityPhoto } from "@/services/communityFeedService";
import { toast } from "sonner";

import {
  useRecentChampionJournalEntries,
  useSubmitChampionJournalEntry,
} from "@/hooks/useChampionJournal";
import {
  useSubmitBoxingCondition,
  useTodayBoxingCondition,
} from "@/hooks/useBoxingCondition";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type {
  BoxingConditionType,
  JournalEntryResult,
} from "@/services/boxingEngagementService";
import {
  CONDITION_OPTIONS,
  PAIN_AREA_OPTIONS,
  getConditionOption,
} from "@/data/boxingConditionMessages";

import ChampionJournalCard from "./ChampionJournalCard";
import ChampionJournalPromptList, {
  CHAMPION_JOURNAL_PROMPTS,
} from "./ChampionJournalPromptList";

interface Props {
  open: boolean;
  onClose: () => void;
}

function conditionToMoodLabel(c: BoxingConditionType | null): string | null {
  const o = getConditionOption(c);
  if (!o) return null;
  return `${o.emoji} ${o.shortLabel}`;
}

const MIN_LEN = 5;
const MAX_LEN = 500;

function todayKstSeed(): number {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  return Number(`${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}`);
}

function pickPromptOfDay(): string {
  const seed = todayKstSeed();
  return CHAMPION_JOURNAL_PROMPTS[seed % CHAMPION_JOURNAL_PROMPTS.length];
}

function tidyContent(s: string): string {
  // 과도한 줄바꿈/공백 정리.
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

const ChampionJournalSheet = ({ open, onClose }: Props) => {
  const submit = useSubmitChampionJournalEntry();
  const submitCondition = useSubmitBoxingCondition();
  // open=false 일 때는 SELECT 가 발사되지 않도록 enabled gate.
  const { data: recent, isLoading: recentLoading } =
    useRecentChampionJournalEntries(3, open);
  const { data: todayCondition } = useTodayBoxingCondition();
  useModalDismiss(open, onClose);

  const [prompt, setPrompt] = useState<string>("");
  const [content, setContent] = useState("");
  const [condition, setCondition] = useState<BoxingConditionType | null>(null);
  const [painArea, setPainArea] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<JournalEntryResult | null>(null);
  // 153 커뮤니티 개편 (2026-10-15) — 공개 범위(기본: 같은 지점 모두) + 사진 한 장
  const { user } = useAuth();
  const qc = useQueryClient();
  const [visibility, setVisibility] = useState<"branch" | "partners">("branch");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  useEffect(() => {
    if (open) {
      setPrompt(pickPromptOfDay());
      setContent("");
      // 오늘 이미 컨디션 기록이 있으면 미리 채워둔다 — 중복 저장은 submit 시 skip.
      setCondition(todayCondition?.condition_type ?? null);
      setPainArea(todayCondition?.pain_area ?? []);
      setResult(null);
      setPending(false);
      setVisibility("branch");
      setPhoto(null);
    }
  }, [open, todayCondition?.condition_type, todayCondition?.pain_area]);

  const showPainArea = condition === "pain";
  const alreadyHasTodayCondition = !!todayCondition?.has_today;

  const togglePainArea = (value: string) => {
    setPainArea((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const trimmedLen = useMemo(() => tidyContent(content).length, [content]);
  const tooShort = trimmedLen < MIN_LEN;
  const tooLong = trimmedLen > MAX_LEN;
  // 컨디션 선택을 STEP 1 필수 조건으로 게이팅 — 통합 시트에서 컨디션 누락 방지.
  const canSubmit =
    !!prompt && !!condition && !tooShort && !tooLong && !pending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      // 일기와 컨디션을 함께 저장. 일기는 필수 결과(result) 라 await 필수.
      // 컨디션은 오늘 첫 기록일 때만 새로 저장 (중복 방지).
      // 사진은 글보다 먼저 올린다 — 실패하면 글도 안 올라가게 (사진 없는 글이 올라가 버리는 일 방지)
      const photoUrl = photo && user ? await uploadCommunityPhoto(user.id, photo) : null;
      const data = await submit.mutateAsync({
        prompt,
        content: tidyContent(content),
        mood: conditionToMoodLabel(condition),
      });
      if (photoUrl || visibility !== "branch") {
        try {
          await setJournalEntryOptions(data.entry_id, visibility, photoUrl);
        } catch {
          toast.error("사진·공개 범위를 저장하지 못했어요. 글은 올라갔어요.");
        }
      }
      qc.invalidateQueries({ queryKey: ["community-feed"] });
      if (condition && !alreadyHasTodayCondition) {
        try {
          await submitCondition.mutateAsync({
            conditionType: condition,
            painArea: showPainArea ? painArea : [],
            note: null,
          });
        } catch {
          // 컨디션 저장 실패는 일기 보상에 영향 없음 — 조용히 무시.
        }
      }
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "일기 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘 운동 한 줄
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            오늘 컨디션 · 한 줄 · 사진
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            남긴 한 줄은 커뮤니티에 올라가고, 동료들이 153으로 응원해요.
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    const isReward = result.first_of_day;
    return (
      <div className="space-y-3">
        <div
          className={`rounded-card border p-3.5 ${
            isReward
              ? "border-emerald-400/40 bg-emerald-400/10"
              : "border-amber-400/40 bg-amber-400/10"
          }`}
        >
          <div className="flex items-center gap-2">
            {isReward ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <p className="text-[13.5px] font-bold text-foreground">
              {isReward
                ? (visibility === "branch" ? "올렸어요! 지점 동료들이 153으로 응원할 거예요." : "올렸어요! 짝꿍만 볼 수 있어요.")
                : "올렸어요! 오늘 보상은 이미 받았어요."}
            </p>
          </div>
        </div>

        <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            오삼 코치
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground">
            오늘의 한 줄은 사라지지 않습니다. 나중에 당신의 성장 증거가 됩니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              경험치
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              +{result.quest_xp_granted}
            </p>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-reward">
              챔피언 머니
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-reward">
              +{result.gems_granted.toLocaleString()}
            </p>
          </div>
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ 커뮤니티 활동은 공식 레벨업과 무관해요.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    );
  };

  const renderForm = () => (
    <div className="space-y-3">
      {/* STEP 1 — 오늘의 컨디션 (먼저 선택) */}
      <div
        className={`rounded-card border p-3 transition-all ${
          condition
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-primary/30 bg-primary/5"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                condition
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {condition ? "✓" : "1"}
            </span>
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              먼저, 오늘의 컨디션
            </p>
          </div>
          {alreadyHasTodayCondition && (
            <span className="text-[10px] font-medium text-emerald-600">
              오늘 기록됨
            </span>
          )}
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          data-tour="journal-condition-options"
        >
          {CONDITION_OPTIONS.map((o) => {
            const active = o.type === condition;
            return (
              <button
                key={o.type}
                type="button"
                data-tutorial-condition="true"
                onClick={() => setCondition(active ? null : o.type)}
                className={`rounded-pill border px-2.5 py-1.5 text-[11px] transition-all active:scale-[0.98] ${
                  active
                    ? "border-primary bg-primary/10 text-foreground font-bold"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {o.emoji} {o.shortLabel}
              </button>
            );
          })}
        </div>

        {showPainArea && (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
              통증 부위{" "}
              <span className="font-normal text-muted-foreground">(선택)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_AREA_OPTIONS.map((p) => {
                const active = painArea.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePainArea(p.value)}
                    className={`rounded-pill border px-2.5 py-1.5 text-[11px] transition-all active:scale-[0.98] ${
                      active
                        ? "border-primary bg-primary/10 text-foreground font-bold"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
              ※ 통증이 있으면 무리하지 마세요. 코치와 상담을 권장합니다.
            </p>
          </div>
        )}

        {!condition && (
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            컨디션을 먼저 골라야 일기 작성이 시작됩니다.
          </p>
        )}
      </div>

      {/* STEP 2 — 챔피언 일기 (컨디션 선택 후 활성) */}
      <div
        className={`space-y-3 rounded-card border p-3 transition-all ${
          condition
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-muted/30 opacity-60"
        }`}
        aria-disabled={!condition}
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
              condition
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            2
          </span>
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            오늘 운동 한 줄
          </p>
        </div>

        <div>
          <p className="text-[13.5px] font-bold text-foreground">{prompt}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            완벽한 문장이 아니라 솔직한 기록이면 충분합니다.
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="badge-pill bg-reward/15 text-reward">
              오늘 첫 글 챔피언 머니 +50
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
            질문 바꾸기
          </p>
          <ChampionJournalPromptList selected={prompt} onSelect={setPrompt} />
        </div>

        <div>
          <p className="mb-1.5 flex items-center justify-between text-[11.5px] font-bold text-foreground">
            한 줄
            <span
              className={`text-[10.5px] font-medium ${
                tooLong
                  ? "text-destructive"
                  : tooShort
                    ? "text-muted-foreground"
                    : "text-emerald-600"
              }`}
            >
              {trimmedLen} / {MAX_LEN}자 · 최소 {MIN_LEN}자
            </span>
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN + 50))}
            placeholder={
              condition
                ? "오늘 운동을 한 줄로…"
                : "위에서 컨디션을 먼저 선택해주세요."
            }
            rows={4}
            disabled={!condition}
            data-tour="journal-reflection-input"
            className="w-full resize-none rounded-card border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* 사진 한 장 + 공개 범위 (153 커뮤니티 개편 2026-10-15) */}
      <div className="space-y-2 rounded-card border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[12px] font-bold text-foreground active:scale-[0.98]">
            <ImagePlus className="h-4 w-4 text-primary" />
            {photo ? "사진 바꾸기" : "사진 한 장 (선택)"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          {photo && (
            <button type="button" onClick={() => setPhoto(null)} className="text-[11px] font-bold text-muted-foreground underline">
              빼기
            </button>
          )}
        </div>
        {photoPreview && (
          <img src={photoPreview} alt="올릴 사진 미리보기" className="max-h-44 w-full rounded-xl object-cover" />
        )}
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="누가 볼 수 있나요">
          <button
            type="button"
            role="radio"
            aria-checked={visibility === "branch"}
            onClick={() => setVisibility("branch")}
            className={`flex items-center justify-center gap-1 rounded-pill border px-2 py-1.5 text-[11.5px] font-bold ${
              visibility === "branch" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> 지점 동료 모두
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={visibility === "partners"}
            onClick={() => setVisibility("partners")}
            className={`flex items-center justify-center gap-1 rounded-pill border px-2 py-1.5 text-[11.5px] font-bold ${
              visibility === "partners" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            <Lock className="h-3.5 w-3.5" /> 짝꿍만
          </button>
        </div>
        {/* 2026-10-16: 본사가 모든 글을 보게 되어 미리 알린다 (20261016080000_hq_sees_all_community.sql) */}
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          본사 운영진은 커뮤니티 운영을 위해 모든 글을 볼 수 있어요.
        </p>
      </div>

      <button
        type="button"
        data-tour="journal-submit"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full rounded-card py-3 text-[14px] font-bold transition-all ${
          canSubmit
            ? "bg-primary text-primary-foreground active:scale-[0.98]"
            : "cursor-not-allowed bg-primary/50 text-primary-foreground opacity-60"
        }`}
      >
        {pending
          ? "저장 중…"
          : !condition
            ? "먼저 오늘의 컨디션을 선택해주세요"
            : tooShort
              ? `최소 ${MIN_LEN}자 이상 입력해주세요`
              : tooLong
                ? `최대 ${MAX_LEN}자까지 입력 가능합니다`
                : !prompt
                  ? "질문을 선택해주세요"
                  : "기록 남기기"}
      </button>

      {/* 최근 일기 3개 */}
      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          최근 기록
        </p>
        {recentLoading ? (
          <p className="text-[11px] text-muted-foreground">불러오는 중…</p>
        ) : (recent ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            아직 기록이 없습니다. 첫 한 줄을 남겨보세요.
          </p>
        ) : (
          <div className="space-y-2">
            {(recent ?? []).map((e) => (
              <ChampionJournalCard key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="오늘 운동 한 줄"
            data-tour="champion-journal-sheet"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {result ? renderResult() : renderForm()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChampionJournalSheet;
