/**
 * 받은 153 — 누가 153 을 보냈는지 + '153 돌려주기' (2026-10-27 대표님 "니가 추천해주는대로 진행", 커뮤니티 보고서 1단계).
 *   커뮤니티 머리의 '받은 153' · 153 알림(/myboxer/community?received=1)에서 열린다.
 *   돌려주기 = 그 동료의 가장 최근 카드(한 줄 14일 · 출석 3일 · 승급 7일)에 153 — 서버가 골라 준다(get_my_received_153).
 *   돌려줄 카드가 없는 동료(코치님 등)는 '응원 보내기'로 대신한다.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import NameBadge from "@/components/badges/NameBadge";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { openMemberCard } from "@/lib/appEvents";
import { cn } from "@/lib/utils";
import type { CheerInitialTarget } from "./SecondCheerSheet";
import { getMyReceived153, toggle153, type Received153Sender } from "@/services/communityFeedService";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 돌려줄 카드가 없는 동료에게 응원 보내기 */
  onCheer: (target: CheerInitialTarget) => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const kst = (x: Date) => x.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  if (kst(d) === kst(new Date())) return `오늘 ${time}`;
  if (kst(d) === kst(new Date(Date.now() - 86_400_000))) return `어제 ${time}`;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
};

// eslint-disable-next-line react-refresh/only-export-components
export const RECEIVED_153_KEY = ["community-received-153"] as const;

const Received153Sheet = ({ open, onClose, onCheer }: Props) => {
  useModalDismiss(open, onClose);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: RECEIVED_153_KEY,
    queryFn: () => getMyReceived153(7),
    enabled: open,
    staleTime: 30_000,
  });
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const giveBack = useMutation({
    mutationFn: async (s: Received153Sender) => {
      if (!s.returnTarget) throw new Error("돌려줄 카드가 없어요");
      return toggle153(s.returnTarget.type, s.returnTarget.id);
    },
    onSuccess: (res, s) => {
      if (res?.reacted === false) {
        // 이미 눌러 둔 카드였다면 취소된 것 — 다시 눌러 되돌린다
        void toggle153(s.returnTarget!.type, s.returnTarget!.id).catch(() => undefined);
      }
      setDoneIds((prev) => new Set(prev).add(s.userId));
      try {
        navigator.vibrate?.(12);
      } catch {
        /* 진동 없는 기기 */
      }
      toast.success(`${s.nickname}님께 153을 돌려줬어요`);
      qc.invalidateQueries({ queryKey: RECEIVED_153_KEY });
      qc.invalidateQueries({ queryKey: ["community-feed"] });
      qc.invalidateQueries({ queryKey: ["community-feed-mv"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const senders = data?.senders ?? [];
  const people = senders.length;

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
            aria-label="받은 153"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pb-3 pt-5">
              {/* 제목 + 한 줄 (2026-10-28 리디자인 — 꾸밈 머리말 뺌) */}
              <div className="min-w-0">
                <h2 className="text-heading text-foreground">받은 153</h2>
                <p className="mt-1 text-body text-foreground">
                  {people > 0 ? (
                    <>
                      최근 7일 동안 동료 <span className="number-font font-bold text-primary">{people}</span>명이 보냈어요
                    </>
                  ) : (
                    "최근 7일 동안 받은 153이 없어요"
                  )}
                </p>
                {people > 0 && (
                  <p className="mt-0.5 text-label text-muted-foreground">돌려주면 그 동료의 최근 카드에 153이 가요</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {isLoading && <p className="py-8 text-center text-label text-muted-foreground">불러오는 중…</p>}
              {isError && (
                <div className="py-8 text-center">
                  <p className="text-label font-bold text-foreground">불러오지 못했어요</p>
                  <button type="button" onClick={() => refetch()} className="mt-2 text-label font-bold text-primary underline">
                    다시 불러오기
                  </button>
                </div>
              )}
              {!isLoading && !isError && people === 0 && (
                <p className="py-8 text-center text-label text-muted-foreground">
                  오늘 운동 한 줄을 남기면 동료들이 153을 보내요
                </p>
              )}
              <ul className="space-y-2">
                {senders.map((s) => {
                  const done = s.returned || doneIds.has(s.userId);
                  const busy = giveBack.isPending && giveBack.variables?.userId === s.userId;
                  return (
                    <li key={s.userId} className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => openMemberCard(s.userId)}
                        aria-label={`${s.nickname}님 회원 카드 보기`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-body font-black text-muted-foreground active:scale-95"
                      >
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          s.nickname.slice(0, 1)
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-body font-bold text-foreground">{s.nickname}</span>
                          {s.isStaff ? (
                            <span className="shrink-0 rounded-pill bg-yellow-500/15 px-1.5 py-0.5 text-micro font-black text-yellow-600">
                              {s.staffTitle || "코치"}
                            </span>
                          ) : (
                            <>
                              <NameBadge league={s.league} className="h-4 w-4" glow={false} />
                              <span className="number-font shrink-0 text-label font-bold text-muted-foreground">Lv.{s.level}</span>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-label text-muted-foreground">
                          153 <span className="number-font font-bold text-foreground">×{s.count}</span> · {when(s.lastAt)}
                        </p>
                      </div>
                      {s.returnTarget ? (
                        <button
                          type="button"
                          disabled={done || busy}
                          onClick={() => giveBack.mutate(s)}
                          className={cn(
                            "inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-pill px-3.5 text-label font-black transition-transform active:scale-95 disabled:active:scale-100",
                            done
                              ? "border border-primary/40 bg-primary/10 text-primary"
                              : "bg-primary text-primary-foreground disabled:opacity-60",
                          )}
                        >
                          {done ? (
                            <>
                              <Check className="h-4 w-4" /> 돌려줬어요
                            </>
                          ) : busy ? (
                            "보내는 중…"
                          ) : (
                            "153 돌려주기"
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onCheer({
                              user_id: s.userId,
                              nickname: s.nickname,
                              avatar_url: s.avatarUrl,
                              league: s.league,
                              branch: s.branch,
                            })
                          }
                          className="inline-flex min-h-[44px] shrink-0 items-center rounded-pill border border-primary/50 px-3.5 text-label font-black text-primary active:scale-95"
                        >
                          응원 보내기
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Received153Sheet;
