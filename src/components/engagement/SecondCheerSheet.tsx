/**
 * 153 QUEST — 동료에게 응원 보내기 바텀시트.
 *
 * 2026-10-16 업그레이드 (대표님 승인 — 기획안 '동료에게 응원 보내기 업그레이드', TV 표시 없음):
 *   · 받을 사람: 지금 운동 중(TV 기준) → 오늘 다녀간 동료 → 최근 출석 순, 오늘 보낸 동료는 '보냄'
 *   · 153 입체 스티커 + 상황 추천(생일·승급·오랜만의 복귀) · 한마디 추천 문구
 *   · 보낸 뒤 바로 다음 동료에게 · 하루 첫 응원 챔피언 머니 +30 · 받은 사람에게 알림
 *   · 라이센스에서 열면 받을 사람이 채워진 채로 (initialTarget) — 라이센스 시트 위로 뜨게 stacked
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 일절 미수정
 *   · 보상은 send_boxing_cheer RPC 안에서만 (grant_gems 직접 호출 0건)
 *   · ChatAssistant 미참조 / 새 AI 챗박스 0건
 *   · 후보는 SECURITY DEFINER RPC get_cheer_candidates — 생일은 날짜가 아니라 '오늘 생일' 여부만
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";

import NameBadge from "@/components/badges/NameBadge";
import { useCheerCandidates, useSendBoxingCheer } from "@/hooks/useSecondCheer";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { CHEER_NOTE_SUGGESTIONS, cheerStickerImage } from "@/lib/cheerStickers";
import { shortBranchName } from "@/services/communityHubService";
import type { CheerCandidate } from "@/services/cheerService";
import type { SendCheerResult } from "@/services/boxingEngagementService";

import CheerStickerPicker from "./CheerStickerPicker";
import ReceivedCheersSheet from "./ReceivedCheersSheet";

export interface CheerInitialTarget {
  user_id: string;
  nickname: string;
  avatar_url?: string | null;
  league?: string | null;
  branch?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** 라이센스 등에서 받을 사람을 정해서 열 때 */
  initialTarget?: CheerInitialTarget | null;
  /** 다른 시트(라이센스 z-[110]) 위로 띄운다 */
  stacked?: boolean;
}

type Target = CheerInitialTarget & Partial<Pick<CheerCandidate, "group" | "since" | "cheered_today" | "birthday" | "promoted" | "returning">>;

const MAX_MESSAGE = 80;

const kstTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
const kstDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const minsSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

const situationLine = (t: Target): string | null => {
  if (t.birthday) return "오늘 생일이에요! 축하를 보내 주세요";
  if (t.promoted) return "얼마 전 승급했어요";
  if (t.returning) return "오랜만에 체육관에 돌아왔어요";
  if (t.group === "now" && t.since) return `지금 ${minsSince(t.since)}분째 운동 중`;
  if (t.group === "today" && t.since) return `오늘 ${kstTime(t.since)}에 다녀갔어요`;
  return null;
};

const Avatar = ({ url, name, size = "md" }: { url?: string | null; name: string; size?: "md" | "lg" }) => (
  <span
    className={cn(
      "flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-secondary font-black text-secondary-foreground",
      size === "lg" ? "h-12 w-12 text-heading" : "h-10 w-10 text-body",
    )}
  >
    {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : name.slice(0, 1)}
  </span>
);

const SituationTags = ({ m }: { m: Pick<CheerCandidate, "birthday" | "promoted" | "returning"> }) => (
  <>
    {m.birthday && (
      <span className="shrink-0 rounded-pill bg-pink-500/15 px-1.5 py-[1px] text-micro font-black text-pink-600 dark:text-pink-300">생일</span>
    )}
    {m.promoted && (
      <span className="shrink-0 rounded-pill bg-reward/20 px-1.5 py-[1px] text-micro font-black text-reward-foreground">승급</span>
    )}
    {m.returning && (
      <span className="shrink-0 rounded-pill bg-emerald-500/15 px-1.5 py-[1px] text-micro font-black text-emerald-700 dark:text-emerald-300">복귀</span>
    )}
  </>
);

const SecondCheerSheet = ({ open, onClose, initialTarget = null, stacked = false }: Props) => {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  // 타이핑마다 RPC 를 부르지 않게 300ms 뒤에 반영 — 검색은 서버가 지점 전체(본사는 켜 둔 지점)에서 찾는다
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, dataUpdatedAt } = useCheerCandidates(open, debounced);
  const send = useSendBoxingCheer();
  useModalDismiss(open, onClose);

  const [target, setTarget] = useState<Target | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SendCheerResult | null>(null);
  // 보낸 응원 보기 (2026-10-28 회원 제안) — 이 창 위로 응원함 '보낸 응원' 칸
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    if (!open) setHistoryOpen(false);
  }, [open]);
  // 방금 보낸 동료 — 목록을 다시 받기 전에도 '보냄'으로
  const [sentIds, setSentIds] = useState<Set<string>>(() => new Set());
  // 보낸 시각 — 서버 목록(sent_today)이 아직 반영하지 못한 것만 더한다
  const [sendTimes, setSendTimes] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      setTarget(initialTarget ? { ...initialTarget } : null);
      setSticker(null);
      setMessage("");
      setSearch("");
      setDebounced("");
      setResult(null);
      setPending(false);
      setSentIds(new Set());
      setSendTimes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTarget?.user_id]);

  const members = useMemo(() => {
    const list = data?.members ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter((c) => c.nickname.toLowerCase().includes(q)) : list;
    return filtered.map((c) => (sentIds.has(c.user_id) ? { ...c, cheered_today: true } : c));
  }, [data, search, sentIds]);

  // 라이센스에서 연 경우 — 목록에 있는 같은 회원의 상황(지금 운동 중·생일 등)을 덧붙인다
  const targetInfo: Target | null = useMemo(() => {
    if (!target) return null;
    const m = (data?.members ?? []).find((c) => c.user_id === target.user_id);
    const merged: Target = m ? { ...target, ...m, avatar_url: m.avatar_url ?? target.avatar_url } : target;
    return sentIds.has(target.user_id) ? { ...merged, cheered_today: true } : merged;
  }, [target, data, sentIds]);

  const sentToday = (data?.sent_today ?? 0) + sendTimes.filter((t) => t > dataUpdatedAt).length;
  const dailyLimit = data?.daily_limit ?? 10;
  const trimmedMessage = message.trim().slice(0, MAX_MESSAGE);
  const alreadySent = !!targetInfo?.cheered_today;
  const canSend = !!targetInfo && !!sticker && !pending && !alreadySent && sentToday < dailyLimit;

  const handleSend = async () => {
    if (!canSend || !targetInfo || !sticker) return;
    setPending(true);
    try {
      const res = await send.mutateAsync({
        receiverUserId: targetInfo.user_id,
        cheerType: trimmedMessage ? "comment" : "sticker",
        message: trimmedMessage ? `${sticker} — ${trimmedMessage}` : sticker,
        sourceType: initialTarget ? "license_cheer" : "home_second_cheer",
        sourceId: null,
      });
      setSentIds((prev) => new Set(prev).add(targetInfo.user_id));
      setSendTimes((prev) => [...prev, Date.now()]);
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "응원 전송 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  };

  const nextTarget = () => {
    setResult(null);
    setTarget(null);
    setSticker(null);
    setMessage("");
  };

  // 제목 한 줄 + 닫기 (2026-10-28 리디자인 — 꾸밈 머리말 · 설명 줄 뺌)
  const renderHeader = () => (
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <h2 className="text-heading text-foreground">응원 보내기</h2>
      <button
        onClick={onClose}
        className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        aria-label="닫기"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  const renderResult = () => {
    if (!result || !targetInfo) return null;
    const img = cheerStickerImage(sticker);
    const remaining = typeof result.remaining_today === "number" ? result.remaining_today : Math.max(0, dailyLimit - sentToday);
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center rounded-card border border-emerald-400/40 bg-emerald-400/10 px-4 pb-4 pt-5 text-center">
          {img && <img src={img} alt="" className="h-20 w-20 object-contain" />}
          <p className="mt-2 text-heading text-foreground">응원 완료!</p>
          <p className="mt-1 text-body text-muted-foreground">
            <b className="text-foreground">{targetInfo.nickname}</b>님에게 “{sticker}”
            {trimmedMessage && <> — {trimmedMessage}</>}
          </p>
        </div>

        {!!result.sender_gems_granted && result.sender_gems_granted > 0 && (
          <div className="rounded-card border border-reward/40 bg-reward/10 px-3.5 py-3 text-center">
            <p className="text-label font-black text-foreground">
              오늘 첫 응원 · 챔피언 머니 +{result.sender_gems_granted.toLocaleString()}
            </p>
          </div>
        )}

        <p className="text-center text-label font-semibold text-muted-foreground">
          {remaining > 0 ? `오늘 ${remaining}번 더 보낼 수 있어요` : "오늘 응원을 모두 보냈어요 · 내일 또 만나요"}
        </p>

        <div className={cn("grid gap-2 pt-1", remaining > 0 && !initialTarget ? "grid-cols-2" : "grid-cols-1")}>
          {remaining > 0 && !initialTarget && (
            <button
              type="button"
              onClick={nextTarget}
              className="h-12 rounded-card bg-primary text-body font-bold text-primary-foreground active:scale-[0.98]"
            >
              다음 동료에게
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "h-12 rounded-card text-body font-bold active:scale-[0.98]",
              remaining > 0 && !initialTarget ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            닫기
          </button>
        </div>
      </div>
    );
  };

  const renderRow = (m: CheerCandidate) => {
    const sub =
      m.group === "now" && m.since
        ? `${minsSince(m.since)}분째 운동 중`
        : m.group === "today" && m.since
          ? `오늘 ${kstTime(m.since)} 출석`
          : m.last_at
            ? `${kstDay(m.last_at)} 출석`
            : "출석 기록 없음";
    return (
      <button
        key={m.user_id}
        type="button"
        disabled={m.cheered_today}
        onClick={() => setTarget(m)}
        className={cn(
          "flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-all",
          m.cheered_today ? "border-border bg-muted/40 opacity-70" : "border-border bg-card active:scale-[0.99]",
        )}
      >
        <span className="relative">
          <Avatar url={m.avatar_url} name={m.nickname} />
          {m.group === "now" && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <NameBadge league={m.league} className="h-4 w-4 shrink-0" glow={false} />
            <span className="truncate text-body font-bold text-foreground">{m.nickname}</span>
            <SituationTags m={m} />
          </span>
          <span className="block truncate text-label text-muted-foreground">
            Lv.{m.level} · {sub}
            {data?.all_branches && m.branch ? ` · ${shortBranchName(m.branch)}` : ""}
          </span>
        </span>
        {m.cheered_today ? (
          <span className="shrink-0 rounded-pill bg-secondary px-2 py-0.5 text-micro font-bold text-muted-foreground">보냄</span>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
    );
  };

  const renderList = () => {
    const now = members.filter((m) => m.group === "now");
    const today = members.filter((m) => m.group === "today");
    const recent = members.filter((m) => m.group === "recent");
    const section = (title: string, list: CheerCandidate[], live = false) =>
      list.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 px-0.5 text-label font-bold text-foreground">
            {live && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
            {title}
            <span className="font-bold text-muted-foreground">{list.length}명</span>
          </p>
          {list.map(renderRow)}
        </div>
      );
    return (
      <div className="space-y-4">
        {/* 오늘 보낸 수 + 보낸 응원 — 규칙 줄은 보내는 화면 아래 한 번만 (2026-10-28 리디자인) */}
        <div className="rounded-card border border-primary/15 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body font-bold text-foreground">
              오늘 {Math.min(sentToday, dailyLimit)}/{dailyLimit}번 보냈어요
            </p>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="-my-1 flex min-h-[40px] shrink-0 items-center gap-0.5 rounded-pill px-2 text-label font-bold text-primary active:scale-95"
            >
              보낸 응원
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {sentToday === 0 && (
            <p className="mt-0.5 text-label text-muted-foreground">오늘 첫 응원은 챔피언 머니 +30</p>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {/* 16px — 아이폰에서 글자를 누를 때 화면이 확대되지 않게 */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름으로 찾기"
            className="h-11 w-full rounded-card border border-border bg-card px-3 pl-9 text-body text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {isLoading && !data ? (
          <p className="px-1 py-3 text-label text-muted-foreground">동료 목록을 불러오고 있어요…</p>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center px-1 py-6 text-center">
            <p className="text-body font-bold text-foreground">
              {search.trim() ? "이 이름의 동료를 찾지 못했어요" : "응원할 동료가 아직 없어요"}
            </p>
            <p className="mt-1 text-label text-muted-foreground">
              {search.trim() ? "보이는 이름(닉네임) 그대로 찾아보세요" : "같은 지점 동료가 가입하면 여기에 보여요"}
            </p>
          </div>
        ) : (
          <>
            {section("지금 운동 중", now, true)}
            {section("오늘 다녀간 동료", today)}
            {section(search.trim() ? "찾은 동료" : "최근 출석한 동료", recent)}
          </>
        )}
        <p className="text-label text-muted-foreground">같은 지점 동료만 보여요 (코치님 제외)</p>
      </div>
    );
  };

  const renderCompose = () => {
    if (!targetInfo) return null;
    const line = situationLine(targetInfo);
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="-ml-1 flex h-9 items-center gap-1 px-1 text-label font-semibold text-muted-foreground active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> 다시 고르기
        </button>

        {/* 받을 동료 — 이름이 주인공 (꾸밈 머리말 뺌) */}
        <div className="flex items-center gap-3 rounded-card border border-primary/15 bg-primary/5 p-3">
          <Avatar url={targetInfo.avatar_url} name={targetInfo.nickname} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-body font-bold text-foreground">
              {targetInfo.league && <NameBadge league={targetInfo.league} className="h-4 w-4 shrink-0" glow={false} />}
              <span className="truncate">{targetInfo.nickname}</span>
              <SituationTags m={{ birthday: !!targetInfo.birthday, promoted: !!targetInfo.promoted, returning: !!targetInfo.returning }} />
            </p>
            <p className="mt-0.5 truncate text-label text-muted-foreground">
              {line ?? (targetInfo.branch ? shortBranchName(targetInfo.branch) : "")}
            </p>
          </div>
        </div>

        {alreadySent && (
          <p className="rounded-card bg-muted/60 px-3 py-2.5 text-label font-semibold text-muted-foreground">
            오늘은 이미 보냈어요 · 내일 또 보내 주세요
          </p>
        )}

        <div>
          <p className="mb-1.5 text-label font-bold text-foreground">스티커</p>
          <CheerStickerPicker
            selected={sticker}
            onSelect={setSticker}
            receiverId={targetInfo.user_id}
            situations={{ birthday: !!targetInfo.birthday, promoted: !!targetInfo.promoted, returning: !!targetInfo.returning }}
          />
        </div>

        <div>
          <p className="mb-1.5 flex items-center justify-between text-label font-bold text-foreground">
            <span>
              한마디 <span className="font-normal text-muted-foreground">(선택)</span>
            </span>
            <span className="text-micro text-muted-foreground">
              {trimmedMessage.length} / {MAX_MESSAGE}
            </span>
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {CHEER_NOTE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setMessage(s)}
                className="h-9 rounded-pill border border-border bg-card px-3 text-label font-semibold text-muted-foreground active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
          {/* 16px — 아이폰에서 글자를 누를 때 화면이 확대되지 않게 */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE + 30))}
            placeholder="짧은 한마디를 더할 수 있어요"
            rows={2}
            className="w-full resize-none rounded-card border border-border bg-card px-3 py-2 text-body text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "h-12 w-full rounded-card text-body font-bold transition-all",
            canSend ? "bg-primary text-primary-foreground active:scale-[0.98]" : "cursor-not-allowed bg-primary/50 text-primary-foreground opacity-60",
          )}
        >
          {pending
            ? "보내는 중…"
            : alreadySent
              ? "오늘은 이미 보냈어요"
              : sentToday >= dailyLimit
                ? "오늘 응원 10번을 모두 보냈어요"
                : !sticker
                  ? "스티커를 골라 주세요"
                  : "응원 보내기"}
        </button>
        <p className="text-center text-label text-muted-foreground">
          받은 동료에게 알림이 가요 · 같은 동료에게는 하루 한 번
        </p>
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={cn(
            "fixed inset-0 flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4",
            stacked ? "z-[120]" : "z-[100]",
          )}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="응원 보내기"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {result ? renderResult() : targetInfo ? renderCompose() : renderList()}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      <ReceivedCheersSheet open={open && historyOpen} onClose={() => setHistoryOpen(false)} initialTab="sent" stacked />
    </>
  );
};

export default SecondCheerSheet;
