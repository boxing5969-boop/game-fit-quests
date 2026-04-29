/**
 * 153 QUEST — 세컨드 응원 바텀시트 (MVP).
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 일절 미수정
 *   · 보상 amount 는 RPC 반환값(respect_granted/receiver_gems_granted)만 사용
 *   · grant_gems 직접 호출 0건 — send_boxing_cheer RPC 내부에서만 처리
 *   · ChatAssistant 미참조 / 새 AI 챗박스 0건
 *   · 후보 조회는 SECURITY DEFINER RPC get_second_cheer_candidates 경유 →
 *     민감정보(phone_number/email/birth_date) 자체가 반환 컬럼에 없음.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  useSecondCheerCandidates,
  useSendBoxingCheer,
} from "@/hooks/useSecondCheer";
import type {
  SecondCheerCandidate,
  SendCheerResult,
} from "@/services/boxingEngagementService";

import CheerStickerPicker, { CHEER_STICKERS } from "./CheerStickerPicker";
import SecondCheerCard from "./SecondCheerCard";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MAX_MESSAGE = 80;

const SecondCheerSheet = ({ open, onClose }: Props) => {
  // open=false 일 때는 RPC 가 발사되지 않도록 enabled gate.
  const { data: candidates, isLoading } = useSecondCheerCandidates(30, open);
  const send = useSendBoxingCheer();

  const [target, setTarget] = useState<SecondCheerCandidate | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SendCheerResult | null>(null);

  useEffect(() => {
    if (open) {
      setTarget(null);
      setSticker(null);
      setMessage("");
      setSearch("");
      setResult(null);
      setPending(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const list = candidates ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.display_name.toLowerCase().includes(q));
  }, [candidates, search]);

  const trimmedMessage = message.trim().slice(0, MAX_MESSAGE);
  const canSend = !!target && !!sticker && !pending;

  const handleSend = async () => {
    if (!canSend || !target || !sticker) return;
    setPending(true);
    try {
      const data = await send.mutateAsync({
        receiverUserId: target.user_id,
        cheerType: trimmedMessage ? "comment" : "sticker",
        message: trimmedMessage
          ? `${sticker} — ${trimmedMessage}`
          : sticker,
        sourceType: "home_second_cheer",
        sourceId: null,
      });
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "응원 전송 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘의 박수
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            세컨드 응원
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            동료의 라운드에 박수를 보내세요. 응원도 실력입니다.
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

  // 결과 화면 렌더 (단일 AnimatePresence 안에서 분기 — 깜빡임 방지)
  const renderResult = () => {
    if (!result) return null;
    const sentReceiver = target?.display_name ?? "동료";
    const noReceiverReward = result.receiver_gems_granted === 0;
    const senderLimitReached = result.respect_granted === 0;

    const banner = senderLimitReached
      ? {
          icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
          tone: "border-amber-400/40 bg-amber-400/10",
          title:
            "오늘 응원 보상 한도를 모두 사용했어요. 응원은 계속 보낼 수 있습니다.",
        }
      : {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
          tone: "border-emerald-400/40 bg-emerald-400/10",
          title: "응원 완료! 링 위에서 혼자가 아닙니다.",
        };

    return (
      <div className="space-y-3">
        <div className={`rounded-card border p-3.5 ${banner.tone}`}>
          <div className="flex items-center gap-2">
            {banner.icon}
            <p className="text-[13.5px] font-bold text-foreground">
              {banner.title}
            </p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {result.message}
          </p>
        </div>

        <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            {sentReceiver} 에게
          </p>
          <p className="mt-1 text-[13px] font-bold text-foreground">
            {sticker}
            {trimmedMessage && (
              <span className="text-muted-foreground font-normal">
                {" "}
                — {trimmedMessage}
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              내 RP
            </p>
            <p className="number-font mt-0.5 text-[18px] font-black text-foreground">
              +{result.respect_granted}
            </p>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-reward">
              받은 사람
            </p>
            <p className="mt-0.5 text-[12.5px] font-bold text-foreground">
              {noReceiverReward
                ? "응원 알림이 전달되었습니다"
                : `+${result.receiver_gems_granted.toLocaleString()} 파이트 머니`}
            </p>
          </div>
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          ※ 응원은 공식 레벨업에 영향을 주지 않는 커뮤니티 활동입니다. RP 와
          파이트 머니만 적용됩니다.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setTarget(null);
              setSticker(null);
              setMessage("");
            }}
            className="rounded-card bg-secondary py-3 text-[13px] font-bold text-secondary-foreground active:scale-[0.98]"
          >
            다른 동료에게도
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-card bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      </div>
    );
  };

  // 후보 선택 / 응원 작성 분기
  const renderBody = () => {
    if (!target) {
      // 후보 선택 화면
      return (
        <div className="space-y-3">
          <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
            <p className="text-[11.5px] leading-relaxed text-foreground">
              혼자 강해지는 복서보다 함께 오래 가는 복서가 더 강합니다.
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
              ※ 같은 지점 동료만 표시됩니다. 본인 / 다른 지점 / 코치·관리자 계정은
              제외됩니다. 민감정보는 노출되지 않습니다.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름으로 찾기"
              className="w-full rounded-card border border-border bg-card px-3 py-2 pl-8 text-[12.5px] text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {isLoading ? (
            <p className="px-1 py-3 text-[12px] text-muted-foreground">
              동료 목록을 불러오고 있어요…
            </p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-1 py-6 text-center">
              <p className="text-2xl">🥊</p>
              <p className="mt-2 text-[12.5px] font-bold text-foreground">
                응원할 동료가 아직 없어요
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                같은 지점 동료가 가입하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <SecondCheerCard
                  key={c.user_id}
                  candidate={c}
                  onSelect={setTarget}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // 응원 작성 화면
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="flex items-center gap-1 text-[12px] text-muted-foreground active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 동료 다시 고르기
        </button>

        <div className="rounded-card border border-primary/15 bg-primary/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            응원 받을 동료
          </p>
          <p className="mt-1 text-[13.5px] font-bold text-foreground">
            {target.display_name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {target.branch_name}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            응원은 공식 레벨업에 영향을 주지 않는 커뮤니티 활동입니다. 보낸
            사람에게는 RP +5, 받은 사람에게는 응원 알림이 전달됩니다.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11.5px] font-bold text-foreground">
            응원 스티커
          </p>
          <CheerStickerPicker selected={sticker} onSelect={setSticker} />
        </div>

        <div>
          <p className="mb-1.5 flex items-center justify-between text-[11.5px] font-bold text-foreground">
            한마디 <span className="text-muted-foreground font-normal">(선택)</span>
            <span className="text-[10px] text-muted-foreground">
              {trimmedMessage.length} / {MAX_MESSAGE}
            </span>
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE + 30))}
            placeholder="짧은 한마디를 더할 수 있어요"
            rows={2}
            className="w-full resize-none rounded-card border border-border bg-card px-3 py-2 text-[12.5px] text-foreground focus:border-primary focus:outline-none"
          />
          {!sticker && (
            <p className="mt-1.5 text-[11px] text-amber-600">
              스티커를 먼저 선택해주세요. (총 {CHEER_STICKERS.length}종)
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="w-full rounded-card bg-primary py-3 text-[14px] font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "전송 중…" : "응원 보내기"}
        </button>
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
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {result ? renderResult() : renderBody()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SecondCheerSheet;
