/**
 * 🛍 153 마켓 — 「찾는 용품 요청」 창
 *   마켓에 없는 용품을 한 줄로 적어 보낸다 → 운영진 주문함 「요청」 칸에 쌓인다(하루 5번까지 · 서버 market_wish_add).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { WISH_EXAMPLES, WISH_MAX, cleanText, wishError } from "@/lib/market153";
import { useMarketActions } from "@/services/marketService";

export interface MarketWishSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 대표님 · 관리자가 다른 지점 화면을 미리 보는 중 — 보내지 않는다 */
  preview?: boolean;
}

const MarketWishSheet = ({ open, onOpenChange, preview = false }: MarketWishSheetProps) => {
  const { wish, demo } = useMarketActions();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
  }, [open]);

  const count = [...cleanText(text)].length;

  const submit = async () => {
    const e = wishError(text);
    if (e) {
      setError(e);
      return;
    }
    try {
      await wish.mutateAsync(cleanText(text));
      toast.success(demo ? "예시 화면이라 실제로 보내지는 않았어요" : "요청을 보냈어요 · 넣을 수 있는지 알아볼게요");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">찾는 용품 요청</DrawerTitle>
          <DrawerDescription className="text-label">마켓에 넣을 수 있는지 알아볼게요</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <div>
            <label htmlFor="market-wish" className="sr-only">
              찾는 용품
            </label>
            <textarea
              id="market-wish"
              value={text}
              rows={3}
              maxLength={WISH_MAX + 40}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder="브랜드 · 이름 · 사이즈를 아는 만큼 적어 주세요"
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-body leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="mt-1 text-right text-micro tabular-nums text-muted-foreground" aria-live="polite">
              {count} / {WISH_MAX}
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="예시">
            {WISH_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  setError(null);
                }}
                className="h-9 rounded-full bg-secondary px-3.5 text-label font-bold text-secondary-foreground active:scale-95"
              >
                {ex}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={preview || wish.isPending}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {preview ? "미리 보기 중이에요" : wish.isPending ? "보내는 중" : "요청 보내기"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MarketWishSheet;
