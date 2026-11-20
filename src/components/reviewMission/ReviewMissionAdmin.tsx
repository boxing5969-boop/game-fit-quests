/**
 * ⭐ 리뷰 미션 — 운영진 화면 (2026-11-21).
 *   입구 카드(지점장 · 코치 홈 — 「153 마켓 주문함」 옆) → 시트: ① 확인할 인증(사진 · 승인 · 다시 요청) ② 리뷰 주소 · 마일리지 설정 ③ 지난 기록
 *   승인하면 서버가 153 마일리지(두 번 눌려도 한 번) + 카드 꾸미기 선물 + 회원 알림을 한 번에 한다.
 *   설정은 지점장님 · 관리자만(코치는 보기 · 승인). 알림 주소 /manager?review=1 로 오면 시트가 바로 열린다.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, ExternalLink, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { giftLine } from "@/lib/cardDeco";
import {
  PLATFORM_LABEL,
  PLATFORM_TONE,
  decideReviewClaim,
  proofUrl,
  saveReviewLink,
  useInvalidateReview,
  useReviewAdminBoard,
  type ReviewClaimAdmin,
  type ReviewLinkAdmin,
} from "@/services/reviewMissionService";

const BRANCHES = ["153복싱짐 선릉역점", "153복싱짐 칠금점"];
const REJECT_REASONS = ["사진에서 리뷰가 안 보여요", "다른 매장 리뷰예요", "리뷰가 아직 안 올라왔어요"];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }) : "";

const ProofImage = ({ path }: { path: string | null }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!path) return;
    void proofUrl(path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path || failed) return <div className="flex h-40 items-center justify-center rounded-xl bg-secondary text-label text-muted-foreground">사진 없음</div>;
  if (!url) return <div className="flex h-40 items-center justify-center rounded-xl bg-secondary"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-black">
      <img src={url} alt="리뷰 인증 사진" className="max-h-72 w-full object-contain" loading="lazy" />
    </a>
  );
};

const PendingCard = ({ c, onDone }: { c: ReviewClaimAdmin; onDone: () => void }) => {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const tone = PLATFORM_TONE[c.platform];
  const decide = async (approve: boolean, reason?: string) => {
    setBusy(true);
    try {
      const r = await decideReviewClaim(c.id, approve, reason);
      if (approve) toast.success(`${c.member_name}님 승인 · ${(r?.mileage ?? 0).toLocaleString("ko-KR")}점과 선물을 드렸어요${r?.bonus ? " · 서포터 세트까지" : ""}`);
      else toast.success(`${c.member_name}님께 다시 올려 달라고 알렸어요`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message || "처리하지 못했어요");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-micro font-black ring-1 ${tone.bg} ${tone.fg} ${tone.ring}`}>{PLATFORM_LABEL[c.platform]}</span>
        <span className="min-w-0 flex-1 truncate text-body font-black text-foreground">
          {c.member_name}
          {c.member_nickname && c.member_nickname !== c.member_name ? <span className="ml-1 text-label font-bold text-muted-foreground">({c.member_nickname})</span> : null}
        </span>
        <span className="shrink-0 text-micro text-muted-foreground">{when(c.submitted_at)}</span>
      </div>
      <ProofImage path={c.proof_path} />
      {c.note && <p className="mt-2 text-label text-muted-foreground">메모: {c.note}</p>}
      {rejecting ? (
        <div className="mt-3 space-y-1.5">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => void decide(false, r)}
              className="flex h-10 w-full items-center rounded-xl bg-secondary px-3 text-left text-label font-bold text-foreground active:scale-[0.99] disabled:opacity-40"
            >
              {r}
            </button>
          ))}
          <button type="button" onClick={() => setRejecting(false)} className="h-9 w-full text-label font-bold text-muted-foreground">
            취소
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="h-11 rounded-xl bg-secondary text-label font-black text-secondary-foreground active:scale-[0.98] disabled:opacity-40"
          >
            다시 요청
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(true)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-label font-black text-primary-foreground active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 리뷰 확인 · 승인
          </button>
        </div>
      )}
    </li>
  );
};

const LinkEditor = ({ l, branch, canEdit, onSaved }: { l: ReviewLinkAdmin; branch: string; canEdit: boolean; onSaved: () => void }) => {
  const [url, setUrl] = useState(l.url ?? "");
  const [mileage, setMileage] = useState(String(l.mileage));
  const [enabled, setEnabled] = useState(l.enabled);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setUrl(l.url ?? "");
    setMileage(String(l.mileage));
    setEnabled(l.enabled);
  }, [l.url, l.mileage, l.enabled]);
  const dirty = url.trim() !== (l.url ?? "") || Number(mileage) !== l.mileage || enabled !== l.enabled;
  const save = async () => {
    setBusy(true);
    try {
      await saveReviewLink(branch, { platform: l.platform, url: url.trim() || null, enabled, mileage: Math.round(Number(mileage) || 0) });
      toast.success(`${PLATFORM_LABEL[l.platform]} 리뷰 미션을 저장했어요`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message || "저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  };
  const tone = PLATFORM_TONE[l.platform];
  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-micro font-black ring-1 ${tone.bg} ${tone.fg} ${tone.ring}`}>{PLATFORM_LABEL[l.platform]}</span>
        <span className="min-w-0 flex-1 truncate text-micro text-muted-foreground">
          {l.platform === "google" ? "보상 없이 부탁만 (구글 정책)" : `선물: ${giftLine(l.gifts)}`}
        </span>
        <label className="flex shrink-0 items-center gap-1.5 text-label font-bold text-foreground">
          <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
          켜기
        </label>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={!canEdit}
        placeholder="리뷰 쓰는 화면 주소 (https://…) — 비우면 회원에게 안 보여요"
        inputMode="url"
        className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-label text-foreground disabled:opacity-60"
      />
      <div className="mt-2 flex items-center gap-2">
        {l.platform === "google" ? (
          <span className="text-label text-muted-foreground">마일리지 · 선물 없음</span>
        ) : (
          <>
        <input
          value={mileage}
          onChange={(e) => setMileage(e.target.value.replace(/[^0-9]/g, ""))}
          disabled={!canEdit}
          inputMode="numeric"
          className="h-10 w-28 rounded-xl border border-border bg-background px-3 text-right text-label font-bold tabular-nums text-foreground disabled:opacity-60"
        />
        <span className="text-label text-muted-foreground">점</span>
          </>
        )}
        {l.url && (
          <a href={l.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-micro font-bold text-primary">
            열어 보기 <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {canEdit && (
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => void save()}
            className={`h-10 rounded-xl px-4 text-label font-black active:scale-[0.98] disabled:opacity-40 ${l.url ? "" : "ml-auto"} bg-primary text-primary-foreground`}
          >
            저장
          </button>
        )}
      </div>
    </li>
  );
};

export const ReviewMissionAdminSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  useModalDismiss(open, onClose, { back: true });
  const [branch, setBranch] = useState<string | null>(null);
  const { data, refetch, isLoading } = useReviewAdminBoard(branch, open);
  const invalidate = useInvalidateReview();
  const [tab, setTab] = useState<"pending" | "settings" | "history">("pending");
  const reload = () => {
    void refetch();
    invalidate();
  };
  const pending = (data?.claims ?? []).filter((c) => c.status === "submitted");
  const history = (data?.claims ?? []).filter((c) => c.status !== "submitted");

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
            aria-label="리뷰 미션 관리"
            className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-elev-3 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between px-5 pt-5">
              <div className="min-w-0">
                <h2 className="text-body font-bold text-foreground">리뷰 미션</h2>
                <p className="mt-0.5 text-label text-muted-foreground">
                  {data?.available ? `${data.branch} · 확인할 것 ${data.pending} · 완료 ${data.approved}` : "불러오는 중"}
                </p>
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

            {data?.scope === "all" && (
              <div className="mt-3 flex gap-1.5 px-5">
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBranch(b)}
                    className={`h-8 rounded-full px-3 text-micro font-bold ${data.branch === b ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
                  >
                    {b.replace("153복싱짐 ", "")}
                  </button>
                ))}
              </div>
            )}

            <div className="mx-5 mt-3 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
              {(
                [
                  ["pending", `확인할 것${pending.length ? ` ${pending.length}` : ""}`],
                  ["settings", "주소 · 마일리지"],
                  ["history", "지난 기록"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`h-9 rounded-lg text-label font-bold ${tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
              {isLoading || !data ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !data.available ? (
                <p className="py-10 text-center text-label text-muted-foreground">운영진만 볼 수 있어요</p>
              ) : tab === "pending" ? (
                pending.length === 0 ? (
                  <p className="py-10 text-center text-label text-muted-foreground">확인할 인증이 없어요 · 새로 오면 알림이 가요</p>
                ) : (
                  <ul className="space-y-3">
                    {pending.map((c) => (
                      <PendingCard key={c.id} c={c} onDone={reload} />
                    ))}
                  </ul>
                )
              ) : tab === "settings" ? (
                <>
                  <ul className="space-y-2.5">
                    {data.links.map((l) => (
                      <LinkEditor key={`${data.branch}-${l.platform}`} l={l} branch={data.branch} canEdit={data.canEdit} onSaved={reload} />
                    ))}
                  </ul>
                  <p className="mt-3 text-micro leading-relaxed text-muted-foreground">
                    주소를 넣은 플랫폼만 회원에게 보여요. 구글은 보상 없이 리뷰를 부탁만 하고(구글 정책), 네이버 · 당근을 모두 마친 회원은 {giftLine(data.allGifts)}도 받아요.
                    별점 · 내용과 상관없이 드리고, 회원에게는 「153 마일리지를 받고 쓴 솔직 후기예요」 한 줄을 넣어 달라고 안내해요.
                    {!data.canEdit && " 설정은 지점장님 · 관리자만 바꿀 수 있어요."}
                  </p>
                </>
              ) : history.length === 0 ? (
                <p className="py-10 text-center text-label text-muted-foreground">아직 기록이 없어요</p>
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-2.5">
                      <span className="w-12 shrink-0 text-micro font-black text-muted-foreground">{PLATFORM_LABEL[c.platform]}</span>
                      <span className="min-w-0 flex-1 truncate text-label font-bold text-foreground">{c.member_name}</span>
                      <span className={`shrink-0 text-micro font-bold ${c.status === "approved" ? "text-primary" : "text-destructive"}`}>
                        {c.status === "approved" ? `승인 · ${(c.reward_mileage ?? 0).toLocaleString("ko-KR")}점` : "다시 요청"}
                      </span>
                      <span className="w-20 shrink-0 text-right text-micro text-muted-foreground">{when(c.decided_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** 지점장 · 코치 홈 입구 카드 */
const ReviewMissionAdminCard = () => {
  const { data } = useReviewAdminBoard(null);
  const [open, setOpen] = useState(false);
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const q = new URLSearchParams(search);
    if (q.get("review") !== "1") return;
    setOpen(true);
    q.delete("review");
    const rest = q.toString();
    navigate(`${pathname}${rest ? `?${rest}` : ""}`, { replace: true });
  }, [search, pathname, navigate]);
  if (!data?.available) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-reward">
          <Star className="h-6 w-6 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-black text-foreground">리뷰 미션</span>
          <span className="block text-label text-muted-foreground">
            {data.pending > 0 ? `확인할 인증 ${data.pending}건 · 사진 보고 승인` : `네이버 · 구글 · 당근 · 완료 ${data.approved}건`}
          </span>
        </span>
        {data.pending > 0 && (
          <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-micro font-black tabular-nums text-destructive-foreground">
            {data.pending}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <ReviewMissionAdminSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default ReviewMissionAdminCard;
