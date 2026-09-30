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
 *
 * 2026-09-29 대표님 — '추천 복서'로 확장: "킹즈오브아너처럼 추천 아이디가 보이고, 아이디를 누르면 상대방 정보".
 *   · 닉네임을 누르면 그 회원의 라이센스(MemberLicenseSheet)가 열리고 거기서도 하트를 누른다(같은 하트).
 *   · 행에 리그·레벨을 같이 보여 준다. 전체관리자·관리자(대표님 153본사 계정)는 전 지점 회원 + 지점 표시.
 *   · 내 닉네임이 없을 때 띠를 누르면 설정 화면 대신 닉네임 바꾸기 시트가 바로 열린다.
 *
 * 2026-09-30 대표님 — "모든 회원님들이 모든 회원님들에게 하트 1개씩" · "하트를 눌러도 1이 안 올라가":
 *   · 닉네임을 안 정한 회원도 목록에 나오고 하트를 받는다 (랭킹과 같은 이름). 하트 많은 순 → 최근 출석 순.
 *   · 본사(전체관리자·관리자) 하트도 점수에 들어간다 — 누르면 바로 +1. '관리자 체험' 띠는 없앴다.
 *   · "한 명에게 하트 하나"를 '하트 1개만'으로 읽는 일이 없게 "회원마다 1개씩"으로 쓴다.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, KeyRound, PenLine, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useBranchNicknames, useToggleNicknameLike } from "@/hooks/use153King";
import { Input } from "@/components/ui/input";
import { openCredentialChange } from "@/lib/appEvents";
import { formatRankShort } from "@/lib/rankLabels";
import MemberLicenseSheet from "@/components/license/MemberLicenseSheet";
import NicknameEditSheet from "@/components/license/NicknameEditSheet";

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

interface Props {
  open: boolean;
  onClose: () => void;
}

const NicknameLikeSheet = ({ open, onClose }: Props) => {
  const { profile } = useAuth();
  // 닉네임을 누르면 그 회원 라이센스 · 내 닉네임 정하기 시트
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
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
      toast.success(res.liked ? `${display}님께 하트를 보냈어요 ❤️` : `${display}님 하트를 취소했어요`);
    } catch (e) {
      // 실패해도 화면 상태는 서버 재조회로 맞춰진다
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setPending(null);
    }
  };

  // 설정 화면으로 보내지 않고 이 자리에서 바로 닉네임을 정한다
  const goSettings = () => setEditOpen(true);
  const changeCredentials = () => {
    onClose();
    openCredentialChange();
  };

  const rows = data?.rows ?? [];
  const allBranches = data?.all_branches === true;

  return (
    <>
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
            aria-label="추천 복서"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-reward/15 text-reward">
                  <Heart className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-reward">153 BOXER LICENSE</p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">추천 복서</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {allBranches
                      ? "전 지점 회원 · 본사 보기 · "
                      : data?.branch ? `${shortBranch(data.branch)} 회원끼리 · ` : ""}
                    회원마다 하트 1개씩 · 다시 누르면 취소
                    {data ? ` · 내가 보낸 하트 ${data.my_given}개` : ""}
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
                    처음 받은 아이디·비밀번호(전화번호)를 바꾸면 하트를 보낼 수 있어요.
                    <span className="font-bold text-primary"> 지금 바꾸기 →</span>
                  </span>
                </button>
              )}
              {data?.reason === "not_member" && (
                <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-[11.5px] leading-snug text-muted-foreground">
                  지점 회원만 하트를 보낼 수 있어요. (코치님 계정, 이용 기록이 없는 계정은 참여하지 않아요)
                </p>
              )}
              {!hasMyNickname && !allBranches && data && data.reason !== "not_member" && (
                <button
                  type="button"
                  onClick={goSettings}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-reward/30 bg-reward/10 px-3 py-2.5 text-left active:scale-[0.99]"
                >
                  <PenLine className="h-4 w-4 shrink-0 text-reward" />
                  <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-foreground">
                    지금은 실명으로 보여요. 닉네임을 정하면 목록·랭킹에 닉네임으로 보여요.
                    <span className="font-bold text-reward"> 닉네임 정하기 →</span>
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
                  placeholder="이름(닉네임) 검색"
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
              ) : !data?.branch && !allBranches ? (
                <p className="py-8 text-center text-sm text-muted-foreground">소속 지점이 있어야 하트를 보낼 수 있어요.</p>
              ) : rows.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {debounced ? "일치하는 회원이 없어요" : "아직 하트를 보낼 수 있는 회원이 없어요"}
                  </p>
                  {!debounced && (
                    <p className="mt-1 text-[11px] text-muted-foreground">지점에서 운동을 시작한 회원이 이 목록에 올라와요.</p>
                  )}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map((r) => {
                    const busy = pending === r.user_id;
                    const locked = !canLike && !r.liked_by_me;
                    const meta = [
                      r.rank && r.level ? formatRankShort(r.rank, r.level) : null,
                      allBranches && r.branch ? shortBranch(r.branch) : null,
                    ].filter(Boolean).join(" · ");
                    return (
                      <li
                        key={r.user_id}
                        className={`flex items-center gap-2 rounded-xl border py-2 pl-2 pr-2.5 ${
                          r.liked_by_me ? "border-reward/40 bg-reward/10" : "border-border bg-card"
                        }`}
                      >
                        {/* 닉네임을 누르면 그 회원 라이센스 (킹즈오브아너식 프로필 보기) */}
                        <button
                          type="button"
                          onClick={() => setViewUserId(r.user_id)}
                          aria-label={`${r.display} 라이센스 보기`}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-opacity active:opacity-60"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[15px] font-black text-foreground">
                            {r.display.charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold text-foreground">{r.display}</span>
                            <span className="block truncate text-[11.5px] text-muted-foreground">
                              {meta ? `${meta} · ` : ""}하트 <span className="font-bold text-reward tabular-nums">{r.likes.toLocaleString("ko-KR")}</span>
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!pending || locked}
                          aria-pressed={r.liked_by_me}
                          aria-label={r.liked_by_me ? `${r.display} 하트 취소` : `${r.display}님께 하트`}
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
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                이름을 누르면 그 회원의 라이센스를 볼 수 있어요. 회원마다 하트를 1개씩 보낼 수 있고, 다시 누르면 취소돼요.
                하트 많은 순으로 60명까지 보이고, 안 보이면 검색하세요. 받은 하트 수가 닉네임 좋아요왕 점수예요.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <MemberLicenseSheet userId={viewUserId} onClose={() => setViewUserId(null)} />
    <NicknameEditSheet open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
};

export default NicknameLikeSheet;
