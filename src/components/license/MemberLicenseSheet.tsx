/**
 * 다른 회원 라이센스 보기 (2026-09-29 대표님: "킹즈오브아너처럼 추천 아이디가 보이고, 아이디를 누르면 상대방 정보").
 *
 * 추천 복서 목록·랭킹에서 회원을 누르면 열린다. 카드는 MY복서와 같은 BoxerLicenseCard, 아래에 큰 하트 버튼.
 * 하트 = 닉네임 좋아요와 같은 하트(회원마다 1개씩 · toggle_nickname_like). 자격은 서버가 다시 검사한다.
 * 2026-09-30: 닉네임을 안 정한 회원도 하트를 받는다 · 본사 하트도 점수에 들어간다(누르면 +1).
 * 보이는 정보는 서버(get_member_license)가 고른 공개 정보뿐 — 이름은 랭킹과 같은 규칙(닉네임 → 이름, 2026-09-30),
 * 전화번호·생년월일은 오지 않는다.
 * 회원은 같은 지점만, 전체관리자·관리자(대표님 153본사 계정)는 전 지점을 본다.
 * 2026-09-30: 하트 옆 '메시지' 버튼 — 메시지를 보낼 수 있는 사람일 때만 보인다(서버 dm_peer 가 판단).
 * 2026-10-18: 어디서든 이름·카드를 누르면 열린다(GlobalMemberCard · openMemberCard) + '짝꿍 신청'(같은 지점 회원,
 *   서로 짝꿍이 없을 때 · 받은 요청이면 바로 수락). 요청 규칙은 서버(request_cornerman_pair)가 다시 확인한다.
 * 2026-10-18: 코치·지점장·운영진 카드도 열린다(대표님: "강건형은 라이센스를 볼 수 없는 계정인가?") — 이름 옆 표시,
 *   하트·짝꿍은 없고(like_reason 'target_staff') 메시지·응원은 그대로.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Handshake, Heart, Send, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberLicense, useToggleNicknameLike } from "@/hooks/use153King";
import { useDmPeer } from "@/hooks/useDm";
import { useMyCornermanStatus, useRequestCornermanPair, useRespondCornermanPair } from "@/hooks/useCornerman";
import { LICENSE_STAFF_LABEL, type LicenseLikeReason } from "@/services/king153Service";
import { honorTitle } from "@/lib/staffDisplay";
import { openCredentialChange } from "@/lib/appEvents";
import BoxerLicenseCard from "@/components/license/BoxerLicenseCard";
import CharacterSprite from "@/components/CharacterSprite";
import SecondCheerSheet from "@/components/engagement/SecondCheerSheet";
import { useMemberCheerSummary } from "@/hooks/useSecondCheer";
import { CHEER_BUMP_ICON, cheerStickerImage } from "@/lib/cheerStickers";

/** 하트를 못 누를 때 한 줄 안내 */
const REASON_TEXT: Record<Exclude<LicenseLikeReason, null>, string> = {
  self: "내 라이센스예요 — 다른 회원님께 하트를 보내 보세요",
  // 2026-09-30부터 서버가 보내지 않는다 (닉네임 조건 삭제) — 옛 응답 호환용
  target_no_nickname: "지금은 이 회원에게 하트를 보낼 수 없어요",
  target_not_member: "이용 기록이 확인되지 않은 계정이라 하트를 받을 수 없어요",
  // 2026-10-18: 코치·지점장·운영진 카드 — 하트 순위 밖
  target_staff: "코치님·운영진은 하트를 받지 않아요. 응원이나 메시지로 마음을 전해 주세요",
  // 2026-09-30부터 서버가 보내지 않는다 (운영진 하트도 점수에 들어간다) — 옛 응답 호환용
  admin_test: "운영진 계정 하트예요",
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
  /** 대화방 안에서 연 카드 — '메시지' 버튼을 숨긴다 */
  hideMessageButton?: boolean;
}

const MemberLicenseSheet = ({ userId, onClose, extraAction, hideMessageButton }: Props) => {
  const open = !!userId;
  useModalDismiss(open, onClose);
  const navigate = useNavigate();
  // 지점장·관리자·전체관리자 — 회원 상세(출석·기록·회원 메모)로 바로 (2026-10-15 대표님)
  const { role, user, profile } = useAuth();
  const canSeeDetail = role === "branch_manager" || role === "admin" || role === "super_admin";
  const { data, isLoading, isError, error } = useMemberLicense(userId, open);
  const toggle = useToggleNicknameLike();
  const [busy, setBusy] = useState(false);
  // 메시지 — 같은 지점(본사는 전 지점)·차단 아님 등 서버가 열 수 있다고 할 때만 버튼을 보인다
  const { data: dm } = useDmPeer(userId, open && !hideMessageButton && !!data && !data.is_me);
  const showDm = !hideMessageButton && !!data && !data.is_me && !!dm?.can_open;
  const openDm = () => {
    if (!data || !dm) return;
    onClose();
    navigate(dm.thread_id ? `/messages/${dm.thread_id}` : `/messages/to/${data.user_id}`);
  };

  const canPress = !!data && !busy && (data.can_like || data.liked_by_me);
  /** 코치·지점장·운영진 카드 — 하트·짝꿍 없이 메시지·응원만 */
  const staffCard = !!data && !data.is_me && data.like_reason === "target_staff";

  // 응원 보내기 · 받은 응원 (2026-10-16 응원 업그레이드) — 같은 지점 동료(본사는 켜 둔 지점)에게. 서버가 다시 확인한다
  const { data: cheerSummary } = useMemberCheerSummary(userId, open);
  const [cheerOpen, setCheerOpen] = useState(false);
  useEffect(() => {
    if (!open) setCheerOpen(false);
  }, [open]);
  const canCheer =
    !!data && !data.is_me && (role === "admin" || role === "super_admin" || (!!profile?.branch_name && profile.branch_name === data.branch));
  const cheerTarget = useMemo(
    () => (data ? { user_id: data.user_id, nickname: data.display, avatar_url: data.avatar_url ?? null, league: data.rank ?? null, branch: data.branch ?? null } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.user_id, data?.display, data?.avatar_url],
  );

  // 짝꿍 신청 (2026-10-18) — 같은 지점 회원끼리. 내 짝꿍 · 보낸 요청 · 받은 요청이면 그 상태로 보인다
  const { data: cm } = useMyCornermanStatus();
  const requestPair = useRequestCornermanPair();
  const respondPair = useRespondCornermanPair();
  const sameBranch = !!data && !!profile?.branch_name && data.branch === profile.branch_name;
  const isMyPartner = !!data && !!cm?.has_active && cm.partner_user_id === data.user_id;
  const sentPending = !!data && !!cm?.pending_sent?.some((p) => p.receiver_user_id === data.user_id);
  const receivedPending = data ? cm?.pending_received?.find((p) => p.requester_user_id === data.user_id) : undefined;
  const showPair =
    !!data && !data.is_me && data.like_reason !== "target_not_member" && data.like_reason !== "target_staff" && (isMyPartner || ((sameBranch || !!receivedPending) && !cm?.has_active));
  const onPair = async () => {
    if (!data) return;
    try {
      const res = receivedPending
        ? await respondPair.mutateAsync({ pairId: receivedPending.pair_id, action: "accept" })
        : await requestPair.mutateAsync(data.user_id);
      toast.success(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "짝꿍 요청을 보내지 못했어요");
    }
  };
  const pairBusy = requestPair.isPending || respondPair.isPending;

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

  // 코치·지점장·운영진은 블랙 리그 모양 + 'BLACK · Lv.77 · 코치님' (2026-10-19 대표님: "코치님은 블랙으로")
  // 직함은 profiles.staff_title(헤드코치·지점장 등)이 있으면 그것, 없으면(옛 응답·빈 칸) 역할로 정한다 (2026-10-19)
  const staffTitleRaw = typeof data?.staff_title === "string" ? data.staff_title.trim() : "";
  const staffTitle = data?.staff_role
    ? staffTitleRaw
      ? honorTitle(staffTitleRaw)
      : data.staff_role === "admin"
        ? LICENSE_STAFF_LABEL.admin
        : honorTitle(LICENSE_STAFF_LABEL[data.staff_role])
    : null;
  const rank = staffTitle ? "black" : (data?.rank ?? "white").toLowerCase();
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
  const isMaster40 = !staffTitle && rank === "black" && (data?.level ?? 0) === 10 && (data?.bosses_cleared ?? 0) >= 4;

  return (
    <>
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
                <h2 className="flex min-w-0 items-center gap-1.5 text-[17px] font-bold text-foreground">
                  <span className="truncate">{data ? `${data.display}님의 라이센스` : "라이센스"}</span>
                  {data?.staff_role && (
                    <span className="shrink-0 rounded-pill bg-primary/15 px-2 py-0.5 text-[11.5px] font-black text-primary">
                      {staffTitleRaw || LICENSE_STAFF_LABEL[data.staff_role]}
                    </span>
                  )}
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
                  staff={staffTitle ? { title: staffTitle } : null}
                  pt={!staffTitle && data.pt}
                  likes={staffTitle ? undefined : data.likes}
                  liked={data.liked_by_me}
                  likeBusy={busy}
                  onLikeClick={canPress ? onHeart : undefined}
                />

                {/* 큰 하트 버튼 — 엄지 닿는 곳. 메시지를 보낼 수 있는 사람이면 옆에 '메시지'.
                    코치·지점장·운영진 카드는 하트 없이 메시지만 (2026-10-18) */}
                {!data.is_me && (!staffCard || showDm) && (
                  <div className={`mt-4 grid gap-2 ${showDm && !staffCard ? "grid-cols-2" : "grid-cols-1"}`}>
                    {!staffCard && (
                      <button
                        type="button"
                        onClick={onHeart}
                        disabled={!canPress}
                        aria-pressed={data.liked_by_me}
                        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-transform active:scale-[0.98] disabled:opacity-45 ${
                          data.liked_by_me
                            ? "bg-secondary text-foreground"
                            : "bg-[#F5C542] text-[#1A1206]"
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${data.liked_by_me ? "fill-[#F5C542] text-[#F5C542]" : "fill-current"} ${busy ? "animate-pulse" : ""}`} />
                        {data.liked_by_me ? "하트 취소" : "하트 보내기"}
                      </button>
                    )}
                    {showDm && (
                      <button
                        type="button"
                        onClick={openDm}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[15px] font-bold text-background transition-transform active:scale-[0.98]"
                      >
                        <Send className="h-[18px] w-[18px]" />
                        메시지
                      </button>
                    )}
                  </div>
                )}

                {canCheer && (
                  <button
                    type="button"
                    onClick={() => setCheerOpen(true)}
                    className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[15px] font-bold text-emerald-700 transition-transform active:scale-[0.98] dark:text-emerald-300"
                  >
                    <img src={CHEER_BUMP_ICON} alt="" className="h-7 w-7 object-contain" />
                    응원 보내기
                  </button>
                )}

                {showPair &&
                  (isMyPartner ? (
                    <p className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 text-[15px] font-bold text-primary">
                      <Handshake className="h-5 w-5" /> 내 운동 짝꿍이에요
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={onPair}
                      disabled={sentPending || pairBusy}
                      className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-card text-[15px] font-bold text-primary transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      <Handshake className={`h-5 w-5 ${pairBusy ? "animate-pulse" : ""}`} />
                      {sentPending ? "짝꿍 요청 보냄 · 대기 중" : receivedPending ? "짝꿍 요청 왔어요 — 수락하기" : "운동 짝꿍 신청"}
                    </button>
                  ))}

                {!!cheerSummary && cheerSummary.total > 0 && (
                  <div className="mt-3 rounded-xl bg-muted/40 px-3 py-2.5">
                    <p className="text-[12px] font-bold text-foreground">
                      받은 응원 <span className="number-font text-primary">{cheerSummary.total}</span>개
                    </p>
                    {cheerSummary.top.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {cheerSummary.top.map((t) => {
                          const img = cheerStickerImage(t.sticker);
                          return (
                            <span
                              key={t.sticker}
                              className="flex items-center gap-1 rounded-pill bg-card px-2 py-1 text-[11px] font-semibold text-foreground"
                            >
                              {img && <img src={img} alt="" className="h-5 w-5 object-contain" />}
                              {t.sticker}
                              <span className="number-font font-black text-primary">×{t.count}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
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

                {canSeeDetail && userId && userId !== user?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = userId;
                      onClose();
                      navigate(`/manager/member/${id}`);
                    }}
                    className="mt-3 h-11 w-full rounded-xl border border-primary/40 bg-primary/10 text-[14px] font-bold text-primary transition-transform active:scale-[0.98]"
                  >
                    🗂 회원 상세 · 출석 · 메모 (관리자)
                  </button>
                )}

                {/* 보조 버튼(랭킹의 '추격 목표로 정하기')은 회원 카드에만 — 코치·지점장·운영진은 순위 밖 (2026-10-19) */}
                {extraAction && !data.staff_role && data.like_reason !== "target_staff" && (
                  <div className="mt-3">{extraAction}</div>
                )}

                {!staffTitle && (
                  <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    회원마다 하트 1개씩 · 다시 누르면 취소 · 받은 하트 수가 닉네임 좋아요왕 점수예요
                  </p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {/* 라이센스에서 바로 응원 — 라이센스 위로 (z-[120]) */}
    <SecondCheerSheet open={cheerOpen} onClose={() => setCheerOpen(false)} initialTarget={cheerTarget} stacked />
    </>
  );
};

export default MemberLicenseSheet;
