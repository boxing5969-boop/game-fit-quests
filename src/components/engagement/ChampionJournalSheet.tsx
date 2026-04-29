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
import { BookOpen, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import {
  useRecentChampionJournalEntries,
  useSubmitChampionJournalEntry,
} from "@/hooks/useChampionJournal";
import type { JournalEntryResult } from "@/services/boxingEngagementService";

import ChampionJournalCard from "./ChampionJournalCard";
import ChampionJournalPromptList, {
  CHAMPION_JOURNAL_PROMPTS,
} from "./ChampionJournalPromptList";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MOOD_OPTIONS = ["💪 단단함", "🔥 의욕", "😮‍💨 지침", "🌧 흐림", "✨ 맑음"];

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
  // open=false 일 때는 SELECT 가 발사되지 않도록 enabled gate.
  const { data: recent, isLoading: recentLoading } =
    useRecentChampionJournalEntries(3, open);

  const [prompt, setPrompt] = useState<string>("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<JournalEntryResult | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt(pickPromptOfDay());
      setContent("");
      setMood(null);
      setResult(null);
      setPending(false);
    }
  }, [open]);

  const trimmedLen = useMemo(() => tidyContent(content).length, [content]);
  const tooShort = trimmedLen < MIN_LEN;
  const tooLong = trimmedLen > MAX_LEN;
  const canSubmit = !!prompt && !tooShort && !tooLong && !pending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      const data = await submit.mutateAsync({
        prompt,
        content: tidyContent(content),
        mood: mood ?? null,
      });
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
            오늘의 한 줄
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            챔피언 일기
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            오늘의 한 줄이 90일 뒤 성장 기록이 됩니다.
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
                ? "기록 완료! 오늘의 복서 일기가 저장되었습니다."
                : "오늘 보상은 이미 받았습니다. 하지만 기록은 계속 쌓입니다."}
            </p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {result.message}
          </p>
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
              QUEST XP
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              +{result.quest_xp_granted}
            </p>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-reward">
              파이트 머니
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-reward">
              +{result.gems_granted.toLocaleString()}
            </p>
          </div>
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ QUEST XP 는 보조 경험치로, 공식 1~40 레벨업과 무관합니다. 공식
          레벨업은 코치 승인 기준으로만 진행됩니다.
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
      <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
          오늘의 질문
        </p>
        <p className="mt-1 text-[13.5px] font-bold text-foreground">{prompt}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          완벽한 문장이 아니라 솔직한 기록이면 충분합니다. 챔피언은 훈련만
          기록하지 않습니다 — 느낀 것도 기록합니다.
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="badge-pill bg-reward/15 text-reward">
            첫 작성 +20 XP · +50
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
          한 줄 회고
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
          placeholder="오늘의 라운드를 한 줄로…"
          rows={4}
          className="w-full resize-none rounded-card border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          오늘의 컨디션{" "}
          <span className="text-muted-foreground font-normal">(선택)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_OPTIONS.map((m) => {
            const active = m === mood;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMood(active ? null : m)}
                className={`rounded-pill border px-2.5 py-1.5 text-[11px] transition-all active:scale-[0.98] ${
                  active
                    ? "border-primary bg-primary/10 text-foreground font-bold"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-card bg-primary py-3 text-[14px] font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "저장 중…" : "기록 남기기"}
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
