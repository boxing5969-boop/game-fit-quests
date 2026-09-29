/**
 * 다른 회원 라이센스 보기 (2026-09-29 대표님: "킹즈오브아너처럼 추천 아이디가 보이고, 아이디를 누르면 상대방 정보").
 *
 * 추천 복서 목록·랭킹에서 회원을 누르면 열린다. 카드는 MY복서와 같은 BoxerLicenseCard, 아래에 큰 하트 버튼.
 * 하트 = 닉네임 좋아요와 같은 하트(한 사람에게 하나 · toggle_nickname_like). 자격은 서버가 다시 검사한다.
 * 보이는 정보는 서버(get_member_license)가 고른 공개 정보뿐 — 실명·전화번호는 오지 않는다.
 * 회원은 같은 지점만, 전체관리자·관리자(대표님 153본사 계정)는 전 지점을 본다.
 */
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useMemberLicense, useToggleNicknameLike } from "@/hooks/use153King";
import type { LicenseLikeReason } from "@/services/king153Service";
import { openCredentialChange } from "@/lib/appEvents";
import BoxerLicenseCard from "@/components/license/BoxerLicenseCard";
import CharacterSprite from "@/components/CharacterSprite";

/** 하트를 못 누를 때 한 줄 안내 */
const REASON_TEXT: Record<Exclude<LicenseLikeReason, null>, string> = {
  self: "내 라이센스예요 — 다른 회원님께 하트를 보내 보세요",
  target_no_nickname: "아직 닉네임을 정하지 않은 회원이라 하트를 보낼 수 없어요",
  target_not_member: "이용 기록이 확인되지 않은 계정이라 하트를 받을 수 없어요",
  admin_test: "관리자 체험 — 눌러볼 수는 있지만 점수에는 들어가지 않아요",
  not_member: "지점 회원만 하트를 보낼 수 있어요",
  change_credentials: "처음 받은 아이디·비밀번호(전화번호)를 바꾸면 하트를 보낼 수 있어요",
};

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

const RANK_BG: Record<string, string> = {
  blue: "linear-gradient(135deg, hsl(215, 100%, 35%), hsl(215, 100%, 18%))",
  red: "linear-gradient(135deg, hsl(0, 84%, 35%), hsl(0, 84%, 18%))",
  black: "linear-gradient(135deg, hsl(42, 60%, 22%), hsl(0, 0%, 8%))",
  white: "linear-gradient(135deg, hsl(220, 14%, 35%), hsl(220, 14%, 22%))",
};

interface Props {
  /** 열 회원 — null 이면 닫힘 */
  userId: string | null;
  onClose: () => void;
  /** 카드 아래 보조 버튼 (예: 랭킹의 '추격 목표로 정하기') */
  extraAction?: ReactNode;
}

const MemberLicenseSheet = ({ userId, onClose, extraAction }: Props) => {
  const open = !!userId;
  useModalDismiss(open, onClose);
  const { data, isLoading, isError, error } = useMemberLicense(userId, open);
  const toggle = useToggleNicknameLike();
  const [busy, setBusy] = useState(false);

  const canPress = !!data && !busy && (data.can_like || data.liked_by_me);

  const onHeart = async () => {
    if (!data || !canPress) return;
    setBusy(true);
    try {
      const res = await toggle.mutateAsync(data.user_id);
      toast.success(res.liked ? `${data.display}님께 하트를 보냈어요 ❤️` : `${data.display}님 하트를 취소했어요`);
    } catch (e) {
      // 실패해도 카드는 서버 재조회로 맞춰진다
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };

  const rank = (data?.rank ?? "white").toLowerCase();
  const photo = data?.avatar_url ? (
    <img src={data.avatar_url} alt={data.display} className="h-full w-full object-cover" />
  ) : data?.parts_json ? (
    <CharacterSprite
      style={data.parts_json.style}
      userId={data.user_id}
      partsJson={data.parts_json as never}
      size="md"
      animate
      league={rank as "white" | "blue" | "red" | "black"}
      level={data.level}
      auraMode="compact"
    />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center text-5xl font-black text-white"
      style={{ background: RANK_BG[rank] ?? RANK_BG.white }}
    >
      {(data?.display ?? "🥊").charAt(0)}
    </div>
  );

  const onMaster = !!data?.master_track_unlocked && (data?.master_level ?? 0) >= 1;
  const isMaster40 = rank === "black" && (data?.level ?? 0) === 10 && (data?.bosses_cleared ?? 0) >= 4;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={data ? `${data.display}님의 라이센스` : "라이센스"}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-elev-3 sm:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-bold text-foreground">
                  {data ? `${data.display}님의 라이센스` : "라이센스"}
                </h2>
                {data?.branch && <p className="text-[12.5px] text-muted-foreground">{shortBranch(data.branch)}</p>}
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

            {isLoading ? (
              <div className="h-[252px] animate-pulse rounded-2xl bg-muted" />
            ) : isError || !data ? (
              <div className="rounded-2xl bg-muted/50 px-4 py-10 text-center">
                <p className="text-[14px] font-bold text-foreground">라이센스를 열 수 없어요</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {error instanceof Error ? error.message : "잠시 후 다시 눌러 주세요"}
                </p>
              </div>
            ) : (
              <>
                <BoxerLicenseCard
                  size="hero"
                  photo={photo}
                  name={data.display}
                  branch={shortBranch(data.branch)}
                  league={rank}
                  level={onMaster ? (data.overall_level ?? data.level) : data.level}
                  userId={data.user_id}
                  issueDate={data.issued_at}
                  streakDays={data.streak_days}
                  isMaster={isMaster40}
                  pt={data.pt}
                  likes={data.likes}
                  liked={data.liked_by_me}
                  likeBusy={busy}
                  onLikeClick={canPress ? onHeart : undefined}
                />

                {/* 큰 하트 버튼 — 엄지 닿는 곳 */}
                {!data.is_me && (
                  <button
                    type="button"
                    onClick={onHeart}
                    disabled={!canPress}
                    aria-pressed={data.liked_by_me}
                    className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-transform active:scale-[0.98] disabled:opacity-45 ${
                      data.liked_by_me
                        ? "bg-secondary text-foreground"
                        : "bg-[#F5C542] text-[#1A1206]"
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${data.liked_by_me ? "fill-[#F5C542] text-[#F5C542]" : "fill-current"} ${busy ? "animate-pulse" : ""}`} />
                    {data.liked_by_me ? "하트 취소" : "하트 보내기"}
                  </button>
                )}

                {data.like_reason && (
                  data.like_reason === "change_credentials" ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        openCredentialChange();
                      }}
                      className="mt-3 w-full rounded-xl bg-primary/10 px-3 py-2.5 text-left text-[12.5px] leading-snug text-foreground active:scale-[0.99]"
                    >
                      {REASON_TEXT.change_credentials}
                      <span className="font-bold text-primary"> 지금 바꾸기 →</span>
                    </button>
                  ) : (
                    <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2.5 text-[12.5px] leading-snug text-muted-foreground">
                      {REASON_TEXT[data.like_reason]}
                    </p>
                  )
                )}

                {extraAction && <div className="mt-3">{extraAction}</div>}

                <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  하트는 한 사람에게 하나 · 다시 누르면 취소 · 받은 하트는 닉네임 좋아요왕 점수와 같아요
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MemberLicenseSheet;
