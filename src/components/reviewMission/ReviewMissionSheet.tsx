/**
 * ⭐ 리뷰 미션 시트 — 네이버 · 구글 · 당근 (2026-11-21 대표님 「구글 리뷰 네이버 리뷰 당근 리뷰를 마이복서153에 미션으로 넣자 ·
 * 버튼을 클릭하면 리뷰를 달 수 있는 주소로 이동하고 리뷰를 달면 마일리지와 선물을 드리자」).
 *
 * 한 곳마다 두 걸음: ① 「○○에 리뷰 쓰기」 → 그 플랫폼 리뷰 화면 ② 「인증 사진 올리기」(내 리뷰가 보이는 화면 캡처)
 * → 지점장님 확인 → 153 마일리지 + 카드 꾸미기 선물(알림으로 알려 드림). 세 곳을 모두 마치면 153 골드 서포터 세트.
 * 별점 · 내용과 상관없이 드린다 — 좋은 후기를 조건으로 걸지 않는다(공정위 추천 · 보증 지침 · 플랫폼 정책).
 * 구글은 보상 없이 부탁만(2026-11-21 02:07 대표님 「구글은 보상없이 부탁만하자 리뷰가 큰힘이 된다고」) — 리뷰 쓰기 버튼 하나 · 인증 없음.
 * 대가를 받은 후기임을 알리는 한 줄을 넣어 달라고 안내한다(복사 단추).
 */
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, ChevronRight, Copy, ExternalLink, Gift, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { giftLine } from "@/lib/cardDeco";
import {
  PLATFORM_HOWTO,
  PLATFORM_LABEL,
  PLATFORM_TONE,
  openReviewMission,
  statusText,
  submitReviewMission,
  useInvalidateReview,
  useMyReviewMissions,
  type ReviewMission,
  type ReviewPlatform,
} from "@/services/reviewMissionService";

/** 대가를 받은 후기라는 표시 — 공정위 「추천 · 보증 등에 관한 표시 · 광고 심사지침」 */
export const REVIEW_DISCLOSURE = "153 마일리지를 받고 쓴 솔직 후기예요";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 다 마쳤거나 선물을 받았을 때 — 카드 꾸미기 시트 열기 */
  onOpenDeco?: () => void;
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

const MissionRow = ({ m, onUploaded }: { m: ReviewMission; onUploaded: () => void }) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(m.status !== "none");
  const tone = PLATFORM_TONE[m.platform];
  const label = PLATFORM_LABEL[m.platform];
  const done = m.status === "approved";
  const waiting = m.status === "submitted";
  const canUpload = !done && !waiting;

  const go = () => {
    // (구글 부탁 칸도 같은 길 — 열어 봤다는 기록만 남는다)
    // 팝업 막힘을 피하려고 누르는 순간 바로 연다 — 기록은 뒤에서
    window.open(m.url, "_blank", "noopener,noreferrer");
    setOpened(true);
    void openReviewMission(m.platform, m.url).then(onUploaded);
  };

  const onFile = async (f: File | undefined) => {
    if (!f || !user) return;
    setBusy(true);
    try {
      await submitReviewMission(user.id, m.platform, f);
      toast.success(`${label} 리뷰 인증을 보냈어요`, { description: "지점장님이 확인하면 마일리지와 선물이 바로 들어와요" });
      onUploaded();
    } catch (e) {
      toast.error((e as Error).message || "보내지 못했어요");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // 🙏 구글 — 보상 없이 부탁만
  if (m.askOnly) {
    return (
      <li className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-body font-black ring-1 ${tone.bg} ${tone.fg} ${tone.ring}`}>
            {label.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-black text-foreground">{label} 리뷰 · 부탁드려요</p>
            <p className="text-label leading-snug text-muted-foreground">솔직한 리뷰 한 줄이 153복싱짐에 정말 큰 힘이 돼요</p>
          </div>
        </div>
        <button
          type="button"
          onClick={go}
          className={`mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-label font-black ring-1 transition-transform active:scale-[0.98] ${tone.bg} ${tone.fg} ${tone.ring}`}
        >
          {opened ? "한 번 더 열기" : `${label}에 리뷰 남기기`} <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <p className="mt-2 text-micro text-muted-foreground">{PLATFORM_HOWTO[m.platform]} · 보상 없이 부탁만 드려요</p>
      </li>
    );
  }

  return (
    <li className={`rounded-2xl border p-4 ${done ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-body font-black ring-1 ${tone.bg} ${tone.fg} ${tone.ring}`}>
          {label.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-black text-foreground">{label} 리뷰</p>
          <p className="truncate text-label font-bold text-reward">
            +{fmt(m.mileage)}점{m.gifts.length ? ` · ${giftLine(m.gifts)}` : ""}
          </p>
        </div>
        {done && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>

      {m.status !== "none" && (
        <p className={`mt-2 text-label ${m.status === "rejected" ? "font-bold text-destructive" : "text-muted-foreground"}`}>{statusText(m)}</p>
      )}

      {!done && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={go}
            disabled={waiting}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-label font-black ring-1 transition-transform active:scale-[0.98] disabled:opacity-40 ${tone.bg} ${tone.fg} ${tone.ring}`}
          >
            ① 리뷰 쓰기 <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!canUpload || busy}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-label font-black transition-transform active:scale-[0.98] disabled:opacity-40 ${
              opened && canUpload ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {waiting ? "확인 중" : m.status === "rejected" ? "② 다시 올리기" : "② 인증 사진"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
      )}
      {!done && <p className="mt-2 text-micro text-muted-foreground">{PLATFORM_HOWTO[m.platform]}</p>}
    </li>
  );
};

const ReviewMissionSheet = ({ open, onClose, onOpenDeco }: Props) => {
  useModalDismiss(open, onClose, { back: true });
  const { data, refetch } = useMyReviewMissions(open);
  const invalidate = useInvalidateReview();
  const refresh = () => {
    void refetch();
    invalidate();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REVIEW_DISCLOSURE);
      toast.success("복사했어요 · 리뷰 끝에 붙여 넣어 주세요");
    } catch {
      toast(REVIEW_DISCLOSURE);
    }
  };

  const missions = data?.missions ?? [];
  const rewarded = missions.filter((m) => !m.askOnly);
  const perMileage = rewarded.length ? Math.max(...rewarded.map((m) => m.mileage)) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[121] flex items-end justify-center bg-black/40 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="리뷰 미션"
            className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-elev-3 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between px-5 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-reward/15 text-reward">
                  <Star className="h-5 w-5 fill-current" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-body font-bold text-foreground">리뷰 미션</h2>
                  <p className="mt-0.5 text-label text-muted-foreground">
                    {data?.on && data.total > 0 ? `${data.done}/${data.total} 완료 · 한 곳마다 마일리지 + 카드 선물` : "솔직한 후기 한 줄이면 충분해요"}
                  </p>
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

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
              {!data ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !data.on ? (
                <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-label text-muted-foreground">
                  우리 지점은 아직 리뷰 미션을 준비 중이에요
                </p>
              ) : (
                <>
                  {/* 보상 미션(네이버 · 당근)을 다 하면 — 2곳 이상 열렸을 때만 */}
                  {data.allGifts.length > 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-reward/40 bg-reward/10 px-4 py-3">
                    <Gift className="h-5 w-5 shrink-0 text-reward" />
                    <p className="min-w-0 text-label leading-snug text-foreground">
                      {data.allDone ? (
                        <b>모두 마쳤어요! 153 골드 서포터 세트가 열렸어요</b>
                      ) : (
                        <>
                          <b>{data.total}곳 모두</b> 마치면 <b>{giftLine(data.allGifts)}</b>까지
                        </>
                      )}
                    </p>
                  </div>
                  )}

                  <ul className="mt-3 space-y-2.5">
                    {missions.map((m) => (
                      <MissionRow key={m.platform as ReviewPlatform} m={m} onUploaded={refresh} />
                    ))}
                  </ul>

                  {/* 지켜 주세요 — 보상이 있는 리뷰만 */}
                  {rewarded.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-secondary px-4 py-3">
                    <p className="text-label font-black text-foreground">꼭 읽어 주세요</p>
                    <ul className="mt-1.5 space-y-1 text-label leading-snug text-muted-foreground">
                      <li>· 별점 · 내용은 솔직하게 — 좋은 말만 쓰지 않아도 {perMileage > 0 ? `${fmt(perMileage)}점은` : "선물은"} 똑같이 드려요</li>
                      <li>· 마일리지를 받는 리뷰({rewarded.map((m) => PLATFORM_LABEL[m.platform]).join(" · ")})는 끝에 아래 한 줄을 넣어 주세요 (대가를 받은 후기 표시 규정)</li>
                      <li>· 인증 사진: 내가 쓴 리뷰가 보이게 화면을 캡처해 올려 주세요</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => void copy()}
                      className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left active:scale-[0.99]"
                    >
                      <span className="min-w-0 truncate text-label font-bold text-foreground">“{REVIEW_DISCLOSURE}”</span>
                      <span className="flex shrink-0 items-center gap-1 text-micro font-bold text-primary">
                        <Copy className="h-3.5 w-3.5" /> 복사
                      </span>
                    </button>
                  </div>
                  )}

                  {onOpenDeco && (
                    <button
                      type="button"
                      onClick={onOpenDeco}
                      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-label font-black text-foreground">받은 선물로 내 카드 꾸미기</span>
                        <span className="block text-micro text-muted-foreground">꾸민 카드는 체육관 TV에도 떠요</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReviewMissionSheet;
