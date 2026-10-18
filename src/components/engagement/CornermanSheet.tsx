/**
 * 153 QUEST v2 19단계 — 코너맨 매칭 메인 시트.
 *
 * 상태 분기:
 *   · pending received: 수락/거절 버튼
 *   · pending sent: 대기 중 표시
 *   · active: 상태 패널 + 보너스 + 종료
 *   · 없음: 후보 리스트 + 요청 보내기
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 보상은 RPC 반환값만 사용
 *   · grant_gems / wallet 직접 update 0
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Gift, Search, Users, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useAuth } from "@/contexts/AuthContext";
import {
  useClaimCornermanDailyBonus,
  useCornermanPeople,
  useCornermanSearch,
  useEndCornermanPair,
  useMyCornermanStatus,
  useMyInviteStats,
  useRequestCornermanPair,
  useRespondCornermanPair,
  useSendMemberInvite,
} from "@/hooks/useCornerman";
import { openMemberCard } from "@/lib/appEvents";
import { shareAppInvite } from "@/lib/appInvite";
import {
  CORNERMAN_COPY,
  CORNERMAN_DISCLAIMER,
  RANK_KOREAN_LABEL,
} from "@/data/cornermanMessages";

import CornermanCandidateList, { type CornermanListItem } from "./CornermanCandidateList";
import CornermanStatusPanel from "./CornermanStatusPanel";
import { toGlobalLevel } from "@/lib/rankLabels";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CornermanSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);
  // 전체관리자 계정: 전 지점 회원이 보인다 (2026-09-30 대표님 "본사는 모든 회원이 보이게").
  // 2026-10-18: 회원과 똑같이 요청 버튼도 보인다 — 요청은 서버가 같은 지점끼리만 받는다
  const { role, profile } = useAuth();
  const isHq = role === "super_admin" || role === "admin";

  const { data: status, isLoading: statusLoading } = useMyCornermanStatus();
  // 짝꿍 후보(앱 쓰는 회원) + 앱에 아직 없는 우리 지점 회원 (2026-10-18 대표님: "가입안한회원도 뜨게 · 초대하면 챔피언머니 1000원")
  const { data: people, isLoading: candLoading } = useCornermanPeople(30, open);
  const candidates = (people ?? []).filter((p) => p.joined);
  const notJoined = (people ?? []).filter((p) => !p.joined);
  const { data: inviteStats } = useMyInviteStats(open);
  const inviteMut = useSendMemberInvite();
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const myName = profile?.nickname?.trim() || profile?.name?.trim() || "동료";
  // 공유 창은 누른 순간에만 열리므로 서버 기록을 기다리지 않고 바로 띄운다
  const handleInvite = (c: CornermanListItem) => {
    setInvitingId(c.user_id);
    inviteMut.mutate(c.user_id, {
      onError: (e) => toast.error(e instanceof Error ? e.message : "초대를 기록하지 못했어요"),
      onSettled: () => setInvitingId(null),
    });
    void shareAppInvite(c.display_name, myName).then((r) => {
      if (r === "shared") toast.success(`${c.display_name}님께 초대를 보냈어요 — 앱에 들어오면 챔피언 머니 1,000!`);
      else if (r === "copied") toast.success("초대 문구를 복사했어요 — 카톡이나 문자에 붙여 넣어 보내 주세요");
      else if (r === "failed") toast.error("공유 창을 열지 못했어요");
    });
  };

  // 같은 지점 회원 이름으로 찾기 (2026-10-18 대표님: "운동짝꿍에 같은 지점 회원 검색하는 기능") — 0.25초 멈추면 찾는다
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setQ("");
    }
  }, [open]);
  const search = useCornermanSearch(q, open);
  const searching = q.length > 0;

  const requestMut = useRequestCornermanPair();
  const respondMut = useRespondCornermanPair();
  const endMut = useEndCornermanPair();
  const claimMut = useClaimCornermanDailyBonus();

  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingRespondId, setPendingRespondId] = useState<string | null>(null);

  const handleRequest = async (userId: string) => {
    setPendingRequestId(userId);
    try {
      const result = await requestMut.mutateAsync(userId);
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "짝꿍 요청 실패");
    } finally {
      setPendingRequestId(null);
    }
  };

  const handleRespond = async (
    pairId: string,
    action: "accept" | "decline",
  ) => {
    setPendingRespondId(pairId);
    try {
      const result = await respondMut.mutateAsync({ pairId, action });
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "응답 처리 실패");
    } finally {
      setPendingRespondId(null);
    }
  };

  const handleEnd = async () => {
    if (!status?.pair_id) return;
    if (!confirm("정말 운동 짝꿍을 그만할까요?")) return;
    try {
      await endMut.mutateAsync(status.pair_id);
      toast.success("운동 짝꿍을 그만했어요.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "종료 처리 실패");
    }
  };

  const handleClaim = async () => {
    try {
      const result = await claimMut.mutateAsync();
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "보너스 처리 실패");
    }
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            운동 짝꿍
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            {CORNERMAN_COPY.cardHeadline}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {CORNERMAN_COPY.cardSub}
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

  const renderPendingReceived = () => {
    if (!status || status.pending_received.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          {CORNERMAN_COPY.pendingReceivedHint}
        </p>
        <div className="space-y-2">
          {status.pending_received.map((p) => {
            const pending = pendingRespondId === p.pair_id;
            return (
              <div
                key={p.pair_id}
                className="rounded-card border border-primary/20 bg-primary/5 p-3.5"
              >
                <button
                  type="button"
                  onClick={() => openMemberCard(p.requester_user_id)}
                  className="text-left text-[13px] font-bold text-foreground underline decoration-border underline-offset-2 active:opacity-70"
                >
                  🥊 {p.requester_name}
                </button>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {RANK_KOREAN_LABEL[p.requester_rank] ?? p.requester_rank} 리그
                  · Lv.{toGlobalLevel(p.requester_rank, p.requester_level)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRespond(p.pair_id, "accept")}
                    disabled={pending}
                    className="flex items-center justify-center gap-1 rounded-card bg-primary py-2 text-[12px] font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    수락
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(p.pair_id, "decline")}
                    disabled={pending}
                    className="flex items-center justify-center gap-1 rounded-card border border-border bg-card py-2 text-[12px] font-bold text-muted-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                    거절
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPendingSent = () => {
    if (!status || status.pending_sent.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
          {CORNERMAN_COPY.pendingSentHint}
        </p>
        <div className="space-y-2">
          {status.pending_sent.map((p) => (
            <div
              key={p.pair_id}
              className="rounded-card border border-border bg-background/40 p-3"
            >
              <p className="text-[12.5px] font-medium text-foreground">
                <button
                  type="button"
                  onClick={() => openMemberCard(p.receiver_user_id)}
                  className="text-left underline decoration-border underline-offset-2 active:opacity-70"
                >
                  {p.receiver_name}
                </button>
                <span className="ml-2 badge-pill bg-amber-400/15 text-amber-700">
                  대기 중
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /** 앱에 아직 없는 우리 지점 회원 — 초대하기 */
  const renderInvite = () => (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">
        <Gift className="h-3.5 w-3.5 text-amber-600" /> 아직 앱에 없는 우리 지점 회원
      </p>
      <p className="mb-2 text-[10.5px] leading-relaxed text-muted-foreground">
        초대 링크를 보내 보세요. 초대한 회원이 앱에 처음 들어오면 챔피언 머니 1,000을 드려요 (한 사람당 처음 초대한 1명).
        {inviteStats && inviteStats.invited > 0
          ? ` 내 초대 ${inviteStats.invited}명 · 들어온 ${inviteStats.joined}명${inviteStats.reward > 0 ? ` · 받은 보상 ${inviteStats.reward.toLocaleString()}` : ""}`
          : ""}
      </p>
      <CornermanCandidateList
        candidates={notJoined}
        isLoading={candLoading}
        pendingUserId={null}
        onRequest={() => undefined}
        onInvite={handleInvite}
        invitingUserId={invitingId}
        showBranch={isHq}
        emptyText="아직 앱에 없는 회원이 없어요"
        emptyHint="우리 지점 회원이 모두 앱을 쓰고 있어요."
      />
    </div>
  );

  /** 이름으로 찾기 칸 */
  const renderSearchBox = () => (
    <label className="mb-2.5 flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        type="text"
        inputMode="search"
        value={query}
        onChange={(e) => setQuery(e.target.value.slice(0, 30))}
        placeholder={isHq ? "회원 이름으로 찾기" : "같은 지점 회원 이름으로 찾기"}
        aria-label="회원 이름으로 찾기"
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="지우기"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );

  const renderSearchResults = () => (
    <CornermanCandidateList
      candidates={search.data ?? []}
      isLoading={search.isLoading}
      pendingUserId={pendingRequestId}
      onRequest={handleRequest}
      onInvite={handleInvite}
      invitingUserId={invitingId}
      showBranch={isHq}
      emptyText={search.isError ? "찾지 못했어요. 잠시 후 다시 해 주세요." : `'${q}' 이름의 회원이 없어요.`}
      emptyHint="앱에 보이는 이름(닉네임)으로 찾아요. 이름을 누르면 회원 카드가 열려요."
    />
  );

  const renderBody = () => {
    if (statusLoading) {
      return (
        <p className="text-[12px] text-muted-foreground">
          짝꿍 정보를 불러오는 중…
        </p>
      );
    }

    if (status?.has_active) {
      // active pair 상태 패널
      return (
        <div className="space-y-3">
          <CornermanStatusPanel
            status={status}
            onClaimBonus={handleClaim}
            onEnd={handleEnd}
            claimPending={claimMut.isPending}
            endPending={endMut.isPending}
          />
          {/* 짝꿍이 있어도 앱에 없는 동료는 초대할 수 있다 (2026-10-18) */}
          <div className="pt-1">
            {renderSearchBox()}
            {searching ? renderSearchResults() : renderInvite()}
          </div>
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            ※ {CORNERMAN_DISCLAIMER}
          </p>
        </div>
      );
    }

    // active 가 없으면 pending 처리 + 후보 리스트
    return (
      <div className="space-y-4">
        {renderPendingReceived()}
        {renderPendingSent()}

        <div>
          <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
            {isHq ? "전 지점 회원" : "같은 지점 회원 후보"}
          </p>
          <p className="mb-2 text-[10.5px] leading-relaxed text-muted-foreground">
            {isHq
              ? "최근 출석한 회원부터 보여요. 짝꿍은 같은 지점 회원끼리 맺어요."
              : CORNERMAN_COPY.emptyHint}
          </p>
          {/* 이름으로 찾기 — 앱에 없는 회원도 나온다 */}
          {renderSearchBox()}
          {searching ? (
            renderSearchResults()
          ) : (
            <CornermanCandidateList
              candidates={candidates}
              isLoading={candLoading}
              pendingUserId={pendingRequestId}
              onRequest={handleRequest}
              showBranch={isHq}
            />
          )}
        </div>

        {!searching && renderInvite()}

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ {CORNERMAN_DISCLAIMER}
        </p>
      </div>
    );
  };

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
            aria-label="운동 짝꿍"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {renderBody()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CornermanSheet;
