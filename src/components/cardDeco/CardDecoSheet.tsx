/**
 * 🎨 내 카드 꾸미기 시트 (2026-11-21 대표님 「회원님들 프로필 카드 꾸밀 수 있는 선물 · 프로필 카드를 이쁘게 꾸밀 수 있는 기능 ·
 * 꾸민 프로필 카드는 사이니지에 뜨게」).
 *
 * 위 = 내 카드 미리보기(바로 바뀜) · 가운데 = 칸 4개(테두리 · 바탕 · 스티커 · 칭호) · 아래 = 저장.
 * 잠긴 꾸미기는 자물쇠 + 받는 법(리뷰 미션 선물) — 누르면 리뷰 미션 시트로.
 * 저장하면 홈 카드 · 회원 카드 · 체육관 TV 카드가 같이 바뀐다(TV 는 5분 안에).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Lock, Palette, Tv, X } from "lucide-react";
import { toast } from "sonner";

import BoxerLicenseCard from "@/components/license/BoxerLicenseCard";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  DECO_SLOTS,
  SOURCE_LABEL,
  isUnlocked,
  itemsOf,
  stickerSrc,
  type CardDecoStyle,
  type DecoItem,
  type DecoSlot,
} from "@/lib/cardDeco";
import { useMyCardDeco, useSaveMyCardDeco } from "@/services/cardDecoService";

export interface CardDecoPreview {
  name: string;
  league: string;
  level: number;
  userId?: string;
  photoUrl?: string | null;
  pt?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  preview: CardDecoPreview;
  /** 잠긴 꾸미기를 누르거나 '선물 받기'를 누르면 — 리뷰 미션 시트 열기 (없으면 안내만) */
  onOpenReview?: () => void;
}

const SHORT_SOURCE: Record<string, string> = {
  review_naver: "네이버 리뷰",
  review_google: "구글 리뷰",
  review_daangn: "당근 리뷰",
  review_all: "리뷰 3곳 완료",
};

/** 꾸미기 한 칸의 작은 그림 */
const Swatch = ({ item }: { item: DecoItem }) => {
  if (item.slot === "frame") {
    return (
      <span className="block h-full w-full rounded-xl p-[3px]" style={{ background: item.edge }}>
        <span className="block h-full w-full rounded-[9px] bg-gray-900" />
      </span>
    );
  }
  if (item.slot === "skin") {
    return <span className="block h-full w-full rounded-xl ring-1 ring-inset ring-white/10" style={{ background: item.face }} />;
  }
  if (item.slot === "sticker") {
    const src = stickerSrc(item);
    return (
      <span className="flex h-full w-full items-center justify-center rounded-xl bg-gray-900">
        {src && <img src={src} alt="" className="h-9 w-9 object-contain" loading="lazy" draggable={false} />}
      </span>
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center rounded-xl bg-gray-900 px-1.5">
      <span className={`line-clamp-2 text-center text-micro font-black leading-tight tracking-wide ${item.textClass ?? "text-gray-200"}`}>
        {item.text}
      </span>
    </span>
  );
};

const Tile = ({
  selected,
  locked,
  onClick,
  label,
  sub,
  children,
  fresh,
}: {
  selected: boolean;
  locked: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  children: ReactNode;
  fresh?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-center transition-transform active:scale-[0.97] ${
      selected ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border bg-card"
    }`}
  >
    <span className="relative block h-14 w-full">
      {children}
      {locked && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55">
          <Lock className="h-5 w-5 text-white/90" />
        </span>
      )}
    </span>
    <span className="w-full truncate text-label font-bold text-foreground">{label}</span>
    {sub && <span className="-mt-1 w-full truncate text-micro font-bold text-reward">{sub}</span>}
    {selected && (
      <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
        <Check className="h-3.5 w-3.5" />
      </span>
    )}
    {fresh && !selected && (
      <span className="absolute -left-1 -top-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-micro font-black leading-none text-destructive-foreground">NEW</span>
    )}
  </button>
);

const CardDecoSheet = ({ open, onClose, preview, onOpenReview }: Props) => {
  useModalDismiss(open, onClose, { back: true });
  const { data } = useMyCardDeco(open);
  const save = useSaveMyCardDeco();
  const [slot, setSlot] = useState<DecoSlot>("skin");
  const [draft, setDraft] = useState<CardDecoStyle>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(data?.equipped ?? {});
  }, [open, data?.equipped]);

  const owned = useMemo(() => data?.owned ?? new Set<string>(), [data?.owned]);
  const recent = useMemo(() => {
    const out = new Set<string>();
    const weekAgo = Date.now() - 7 * 86_400_000;
    for (const [id, at] of Object.entries(data?.grantedAt ?? {})) if (Date.parse(at) > weekAgo) out.add(id);
    return out;
  }, [data?.grantedAt]);

  const equipped = data?.equipped ?? {};
  const changed = (["frame", "skin", "sticker", "title"] as const).some((k) => (draft[k] ?? null) !== (equipped[k] ?? null));
  const giftCount = [...owned].length;

  const choose = (item: DecoItem | null) => {
    if (item && !isUnlocked(item.id, owned)) {
      toast(`${SOURCE_LABEL[item.source]}이에요`, {
        description: "리뷰 미션을 마치면 받을 수 있어요",
        action: onOpenReview ? { label: "리뷰 미션", onClick: onOpenReview } : undefined,
      });
      return;
    }
    setDraft((d) => ({ ...d, [slot]: item ? item.id : null }));
  };

  const doSave = async () => {
    if (!changed || saving) return;
    setSaving(true);
    try {
      await save(draft);
      toast.success("카드를 꾸몄어요 · 체육관 TV에도 그대로 떠요");
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  const items = itemsOf(slot);
  const current = draft[slot] ?? null;

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
            aria-label="내 카드 꾸미기"
            className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-elev-3 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between px-5 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-body font-bold text-foreground">내 카드 꾸미기</h2>
                  <p className="mt-0.5 flex items-center gap-1 text-label text-muted-foreground">
                    <Tv className="h-3.5 w-3.5" /> 꾸민 카드는 체육관 TV에도 그대로 떠요
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

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
              {/* 미리보기 — TV 카드와 같은 크기 */}
              <div className="rounded-2xl bg-gray-950 p-3">
                <BoxerLicenseCard
                  size="spotlight"
                  photo={
                    preview.photoUrl ? (
                      <img src={preview.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-700 text-heading font-black text-white">
                        {preview.name.charAt(0)}
                      </div>
                    )
                  }
                  name={preview.name}
                  league={preview.league}
                  level={preview.level}
                  userId={preview.userId}
                  pt={preview.pt}
                  deco={draft}
                />
              </div>

              {/* 칸 */}
              <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-secondary p-1" role="tablist">
                {DECO_SLOTS.map((s) => (
                  <button
                    key={s.slot}
                    type="button"
                    role="tab"
                    aria-selected={slot === s.slot}
                    onClick={() => setSlot(s.slot)}
                    className={`h-9 rounded-lg text-label font-bold transition-colors ${
                      slot === s.slot ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <Tile selected={!current} locked={false} onClick={() => choose(null)} label="기본">
                  <span className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border text-label font-bold text-muted-foreground">
                    없음
                  </span>
                </Tile>
                {items.map((it) => {
                  const locked = !isUnlocked(it.id, owned);
                  return (
                    <Tile
                      key={it.id}
                      selected={current === it.id}
                      locked={locked}
                      onClick={() => choose(it)}
                      label={it.name}
                      sub={it.source !== "free" ? SHORT_SOURCE[it.source] : undefined}
                      fresh={recent.has(it.id)}
                    >
                      <Swatch item={it} />
                    </Tile>
                  );
                })}
              </div>

              {/* 선물 받기 — 리뷰 미션 */}
              {onOpenReview && (
                <button
                  type="button"
                  onClick={onOpenReview}
                  className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-reward/40 bg-reward/10 px-4 py-3 text-left active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-black text-foreground">
                      {giftCount > 0 ? `받은 선물 ${giftCount}개 · 더 받으러 가기` : "리뷰 남기고 꾸미기 선물 받기"}
                    </span>
                    <span className="block text-micro text-muted-foreground">네이버 · 구글 · 당근 리뷰 미션 · 153 마일리지도 함께</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
              <button
                type="button"
                onClick={() => void doSave()}
                disabled={!changed || saving}
                className="h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {saving ? "저장 중…" : changed ? "이대로 꾸미기" : "지금 카드 그대로예요"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardDecoSheet;
