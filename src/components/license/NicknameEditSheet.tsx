/**
 * 닉네임 바꾸기 시트 (2026-09-29 대표님: "카드를 클릭하면 닉네임을 변경하는 기능").
 *
 * MY복서의 내 라이센스 카드를 누르면 열린다(추천 복서 목록의 '내 닉네임 정하기' 띠도 여기로).
 * 저장은 설정 화면과 같은 길 — profiles 본인 행의 nickname 만 바꾼다(RLS 본인 행, 서버 가드가 12자 제한).
 * 0행 갱신도 에러 없이 끝나는 RLS 무음 실패를 막으려고 바뀐 행을 돌려받아 확인한다.
 * 실명과 같으면 추천 복서 목록·하트에서 빠진다(닉네임 좋아요 규칙) — 그 사실을 미리 알려 준다.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { KING_153_KEY, MEMBER_LICENSE_KEY, NICKNAME_LIKE_KEY } from "@/hooks/use153King";
import { Input } from "@/components/ui/input";

const MAX = 12;
/** 글자 수 — 이모지·한글 조합을 한 글자로 센다 (서버 char_length 와 같은 기준) */
const charLen = (s: string) => Array.from(s).length;
/** 닉네임이 보이는 화면들 — 바꾸면 다시 읽는다 */
const NAME_QUERY_ROOTS = new Set([
  "division-ranking",
  "weekly-activity-ranking",
  "monthly-risers",
  "streak-ranking",
  "boss-conquerors",
  "hall-of-fame",
  "rivals-above",
]);

interface Props {
  open: boolean;
  onClose: () => void;
}

const NicknameEditSheet = ({ open, onClose }: Props) => {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  useModalDismiss(open, onClose);

  const current = (profile?.nickname ?? "").trim();
  const realName = (profile?.name ?? "").trim();
  // 일괄 등록 계정은 닉네임 = 실명이다 — 그대로 채워 두지 않고 빈 칸에서 새로 정하게 한다
  const startValue = current && current !== realName ? current : "";

  useEffect(() => {
    if (open) setValue(startValue);
    // 열릴 때 한 번만 채운다 — 입력 중에 프로필이 다시 읽혀도 덮어쓰지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const next = value.trim();
  const len = charLen(next);
  const tooLong = len > MAX;
  const unchanged = next === current;
  const sameAsName = !!realName && next === realName;
  const canSave = !!user && len > 0 && !tooLong && !unchanged && !saving;

  const save = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ nickname: next })
        .eq("user_id", user.id)
        .select("user_id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("저장되지 않았어요. 잠시 후 다시 해 주세요");
      await refreshProfile();
      await Promise.all([
        qc.invalidateQueries({ queryKey: NICKNAME_LIKE_KEY }),
        qc.invalidateQueries({ queryKey: KING_153_KEY }),
        qc.invalidateQueries({ queryKey: MEMBER_LICENSE_KEY }),
        qc.invalidateQueries({ predicate: (q) => NAME_QUERY_ROOTS.has(String(q.queryKey[0])) }),
      ]);
      toast.success(`닉네임을 ‘${next}’(으)로 바꿨어요`);
      onClose();
    } catch (e) {
      // 서버 가드 메시지(예: 12자 제한)는 한글이라 그대로 보여 준다
      const msg = (e as { message?: string } | null)?.message;
      toast.error(msg && /[가-힣]/.test(msg) ? msg : "닉네임을 바꾸지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="닉네임 바꾸기"
            className="w-full max-w-md rounded-t-3xl bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-elev-3 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PenLine className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-bold text-foreground">닉네임 바꾸기</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">라이센스·랭킹·추천 복서에 보이는 이름이에요</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="relative">
                <Input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={current && current !== realName ? current : "예) 잽마스터"}
                  maxLength={24}
                  enterKeyHint="done"
                  aria-invalid={tooLong}
                  className="h-12 rounded-xl pr-14 text-[16px] font-semibold"
                />
                <span
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold tabular-nums ${
                    tooLong ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {len}/{MAX}
                </span>
              </div>
              <p className={`mt-2 min-h-[18px] text-[12px] leading-snug ${tooLong || sameAsName ? "text-destructive" : "text-muted-foreground"}`}>
                {tooLong
                  ? `${MAX}자까지 정할 수 있어요`
                  : sameAsName
                    ? "실명과 같으면 추천 복서 목록에 안 나오고 하트도 받을 수 없어요"
                    : "다른 회원이 보는 이름이라 실명 대신 닉네임을 추천해요"}
              </p>
              <button
                type="submit"
                disabled={!canSave}
                className="mt-4 h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NicknameEditSheet;
