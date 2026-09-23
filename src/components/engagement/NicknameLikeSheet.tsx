/**
 * 닉네임 좋아요 시트 (2026-09-23) — 153 마이복서 런칭 이벤트 ③ 닉네임 좋아요왕.
 *
 * 대표님 지시: "각 지점 회원님들끼리 닉네임에 한 사람에 하나의 좋아요".
 *   · 같은 지점 회원의 닉네임 목록(좋아요 많은 순, 검색 가능). 본인·지도진은 목록에 없다.
 *   · 하트를 누르면 좋아요, 다시 누르면 취소 — 한 명에게 하나만 (서버 toggle_nickname_like 가 검사).
 *   · 닉네임을 따로 정하지 않은 회원(이름 그대로)은 "닉네임 미설정" 으로 표시해 닉네임 설정을 유도한다.
 *
 * 보호 원칙: 쓰기는 RPC 한 개(toggle_nickname_like). 프로필·XP·wallet 직접 변경 0건.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useBranchNicknames, useToggleNicknameLike } from "@/hooks/use153King";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
}

const NicknameLikeSheet = ({ open, onClose }: Props) => {
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

  const onToggle = async (userId: string, display: string) => {
    if (pending) return;
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

            {/* 검색 */}
            <div className="px-5 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="닉네임 검색"
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
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {debounced ? "일치하는 닉네임이 없어요" : "아직 같은 지점 회원이 없어요"}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map((r) => {
                    const busy = pending === r.user_id;
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
                            {r.has_nickname ? "" : "닉네임 미설정 · "}
                            이번 달 좋아요 <span className="font-bold text-reward tabular-nums">{r.likes_month}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          aria-pressed={r.liked_by_me}
                          aria-label={r.liked_by_me ? `${r.display} 좋아요 취소` : `${r.display} 좋아요`}
                          onClick={() => onToggle(r.user_id, r.display)}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50 ${
                            r.liked_by_me ? "bg-reward text-reward-foreground" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Heart className={`h-5 w-5 ${r.liked_by_me ? "fill-current" : ""}`} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                좋아요 많은 순으로 60명까지 보여요. 안 보이면 검색하세요. 받은 좋아요는 이번 달 기준이고, 매월 1일 새로 시작합니다.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NicknameLikeSheet;
