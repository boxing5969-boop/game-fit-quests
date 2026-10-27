/**
 * 153 QUEST — 응원 스티커 고르기.
 *
 * 2026-10-16 업그레이드: 글자 칩 → 153 입체 스티커(그림 + 글자). 글자 10개는 그대로,
 * 생일·승급 동료에게만 보이는 상황 스티커 2개. 상황에 맞는 스티커 하나를 맨 앞에 '추천'으로,
 * 나머지는 받는 사람·날짜마다 섞어서 첫 칸 쏠림을 줄인다.
 * 자체 제작 응원 메시지. 실존 인물/저작물 미사용.
 */
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { CHEER_STICKER_LIST, cheerStickerImage, stickersFor, type CheerSituation } from "@/lib/cheerStickers";

// eslint-disable-next-line react-refresh/only-export-components
export const CHEER_STICKERS: string[] = CHEER_STICKER_LIST.filter((s) => !s.onlyWhen).map((s) => s.text);

export interface CheerStickerPickerProps {
  selected: string | null;
  onSelect: (sticker: string) => void;
  /** 받는 동료 — 순서 섞기 기준 */
  receiverId?: string;
  situations?: Partial<Record<CheerSituation, boolean>>;
}

const CheerStickerPicker = ({ selected, onSelect, receiverId = "", situations = {} }: CheerStickerPickerProps) => {
  const { list, recommended } = useMemo(
    () => stickersFor(receiverId, situations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receiverId, situations.birthday, situations.promoted, situations.returning],
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {list.map((s) => {
        const active = s.text === selected;
        const img = cheerStickerImage(s.text);
        return (
          <button
            key={s.text}
            type="button"
            onClick={() => onSelect(s.text)}
            aria-pressed={active}
            className={cn(
              "relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border px-1.5 pb-2 pt-2.5 transition-all active:scale-[0.97]",
              active ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card",
            )}
          >
            {s.text === recommended && (
              <span className="absolute left-1.5 top-1.5 rounded-pill bg-reward px-1.5 py-[1px] text-micro font-black text-reward-foreground">
                추천
              </span>
            )}
            {img && <img src={img} alt="" className="h-12 w-12 object-contain" loading="lazy" draggable={false} />}
            <span
              className={cn(
                "line-clamp-2 min-h-[2.4em] text-center text-micro leading-tight",
                active ? "font-black text-foreground" : "font-semibold text-muted-foreground",
              )}
            >
              {s.text}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CheerStickerPicker;
