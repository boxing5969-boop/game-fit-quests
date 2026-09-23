/**
 * 닉네임 좋아요 시트 (2026-09-23) — 153 마이복서 런칭 이벤트 ③ 닉네임 좋아요왕.
 *
 * 대표님 지시: "각 지점 회원님들끼리 닉네임에 한 사람에 하나의 좋아요".
 *   · 같은 지점에서 닉네임을 정한 회원 목록(좋아요 많은 순, 닉네임 검색). 본인·지도진·관리자는 없다.
 *   · 하트를 누르면 좋아요, 다시 누르면 취소 — 한 명에게 하나만 (서버 toggle_nickname_like 가 검사).
 *   · 좋아요는 취소하기 전까지 계속 유지된다(누적) — 닉네임왕 점수와 같은 숫자.
 *
 * 검수 반영(2026-09-23)
 *   · 일괄 등록 때 닉네임 = 실명으로 채워진 계정은 목록에 안 나온다 → 지점 회원 실명 명단이 보이던 문제 차단.
 *     닉네임을 정하면(설정) 목록에 올라간다.
 *   · 처음 받은 아이디·비밀번호(전화번호) 그대로인 계정은 누를 수 없다 — 전화번호만 알면 남의 계정으로
 *     좋아요를 몰아줄 수 있어서. 안내 띠에서 바로 바꿀 수 있다.
 *   · 누르는 동안 하트를 잠그고, 목록이 다시 읽힌 뒤에 푼다(연타로 좋아요→취소 되는 것 방지).
 *
 * 보호 원칙: 쓰기는 RPC 한 개(toggle_nickname_like). 프로필·XP·wallet 직접 변경 0건.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, KeyRound, PenLine, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useBranchNicknames, useToggleNicknameLike } from "@/hooks/use153King";
import { Input } from "@/components/ui/input";
import { openCredentialChange } from "@/lib/appEvents";

interface Props {
  open: boolean;
  onClose: () => void;
}

const NicknameLikeSheet = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useModalDismiss(open, onClose);

  // 타이핑마다 RPC 를 부르지 않게 300ms 뒤에 반영
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (open) { setSearch(""); setDebounced(""); }
  }, [open]);

  const { data, isLoading, isError } = useBranchNicknames(debounced, open);
  const toggle = useToggleNicknameLike();
  const [pending, setPending] = useState<string | null>(null);

  // 내 닉네임을 정했나 — 닉네임이 비었거나 실명과 같으면 아직 목록에 안 올라간다
  const myNick = (profile?.nickname ?? "").trim();
  const hasMyNickname = !!myNick && myNick !== (profile?.name ?? "").trim();
  const canLike = data?.can_like ?? false;

  const onToggle = async (userId: string, display: string, likedByMe: boolean) => {
    if (pending) return;
    if (!canLike && !likedByMe) return;
    setPending(userId);
    try {
      const res = await toggle.mutateAsync(userId);
      toast.success(res.liked ? `${display} 닉네임에 좋아요를 보냈어요 ❤️` : `${display} 좋아요를 취소했어요`);
    } catch (e) {
      // 실패해도 화면 상태는 서버 재조회로 맞춰진다
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setPending(null);
    }
  };

  const goSettings = () => {
    onClose();
    navigate("/settings");
  };
  const changeCredentials = () => {
    onClose();
    openCredentialChange();
  };

  const rows = data?.rows ?? [];

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
            aria-label="닉네임 좋아요"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-reward/15 text-reward">
                  <Heart className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">런칭 이벤트 ③</p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">닉네임 좋아요</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {data?.branch ? `${data.branch.replace(/^153복싱짐\s*/, "")} 회원끼리 · ` : ""}한 명에게 하나 · 다시 누르면 취소
                    {data ? ` · 내가 보낸 좋아요 ${data.my_given}개` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 안내 띠 — 좋아요를 못 누르는 이유 / 내 닉네임 */}
            <div className="space-y-2 px-5 pt-3 empty:hidden">
              {data?.reason === "change_credentials" && (
                <button
                  type="button"
                  onClick={changeCredentials}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left active:scale-[0.99]"
                >
                  <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-foreground">
                    처음 받은 아이디·비밀번호(전화번호)를 바꾸면 좋아요를 보낼 수 있어요.
                    <span className="font-bold text-primary"> 지금 바꾸기 →</span>
                  </span>
                </button>
              )}
              {data?.reason === "not_member" && (
                <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-[11.5px] leading-snug text-muted-foreground">
                  지점 회원만 좋아요를 보낼 수 있어요. (코치님·관리자 계정, 이용 기록이 없는 계정은 참여하지 않아요)
                </p>
              )}
              {data?.reason === "admin_test" && (
                <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-[11.5px] leading-snug text-muted-foreground">
                  관리자 체험 중 — 눌러볼 수는 있지만 점수에는 들어가지 않아요.
                </p>
              )}
              {!hasMyNickname && data?.reason !== "admin_test" && data?.reason !== "not_member" && (
                <button
                  type="button"
                  onClick={goSettings}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-reward/30 bg-reward/10 px-3 py-2.5 text-left active:scale-[0.99]"
                >
                  <PenLine className="h-4 w-4 shrink-0 text-reward" />
                  <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-foreground">
                    내 닉네임을 정해야 다른 회원이 나에게 좋아요를 보낼 수 있어요.
                    <span className="font-bold text-reward"> 설정에서 닉네임 정하기 →</span>
                  </span>
                </button>
              )}
            </div>

            {/* 검색 */}
            <div className="px-5 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="닉네임 검색"
                  maxLength={30}
                  className="h-10 rounded-xl pl-9"
                />
              </div>
            </div>

            {/* 목록 */}
            <div className="flex-1 overflow-y-auto px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
              {isLoading ? (
                <div className="space-y-2">
                  {Array(6).fill(0).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
                </div>
              ) : isError ? (
                <p className="py-8 text-center text-sm text-muted-foreground">목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
              ) : !data?.branch ? (
                <p className="py-8 text-center text-sm text-muted-foreground">소속 지점이 있어야 좋아요를 보낼 수 있어요.</p>
              ) : rows.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {debounced ? "일치하는 닉네임이 없어요" : "아직 닉네임을 정한 회원이 없어요"}
                  </p>
                  {!debounced && (
                    <p className="mt-1 text-[11px] text-muted-foreground">설정에서 닉네임을 정한 회원이 이 목록에 올라와요.</p>
                  )}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map((r) => {
                    const busy = pending === r.user_id;
                    const locked = !canLike && !r.liked_by_me;
                    return (
                      <li
                        key={r.user_id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                          r.liked_by_me ? "border-reward/40 bg-reward/10" : "border-border bg-card"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-bold text-foreground">{r.display}</p>
                          <p className="text-[10.5px] text-muted-foreground">
                            받은 좋아요 <span className="font-bold text-reward tabular-nums">{r.likes.toLocaleString("ko-KR")}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy || !!pending || locked}
                          aria-pressed={r.liked_by_me}
                          aria-label={r.liked_by_me ? `${r.display} 좋아요 취소` : `${r.display} 좋아요`}
                          onClick={() => onToggle(r.user_id, r.display, r.liked_by_me)}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50 ${
                            r.liked_by_me ? "bg-reward text-reward-foreground" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Heart className={`h-5 w-5 ${r.liked_by_me ? "fill-current" : ""} ${busy ? "animate-pulse" : ""}`} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                좋아요 많은 순으로 60명까지 보여요. 안 보이면 닉네임으로 검색하세요.
                받은 좋아요는 취소하기 전까지 계속 쌓여 있고, 이 숫자가 닉네임왕 점수예요.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NicknameLikeSheet;
