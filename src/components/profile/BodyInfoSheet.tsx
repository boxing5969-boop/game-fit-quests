/**
 * ⚖️ 내 신체 정보 넣기 · 고치기 — 키 · 몸무게 (2026-10-21 대표님: "본인이 신체정보 넣을 수 있게 하자")
 *   · 오늘(KST) 날짜로 저장 — 같은 날 다시 넣으면 고친다
 *   · 바꾼 칸만 보낸다 — 그대로 둔 몸무게가 '오늘 잰 값'으로 다시 찍히지 않게 (2026-10-21 검수)
 *   · 열 때 한 번만 채운다 — 입력하는 도중에 서버 값이 와도 덮어쓰지 않게
 *   · '한 번 복싱 시간' 칸은 2026-10-22 없앴다 — 운동 시간은 두 번째 체크(얼굴 인식 · QR)로 실제로 잰다 (대표님)
 *   보는 사람 안내 문구는 넣지 않는다 (2026-10-22 대표님: "안내 문구를 아예 넣지 말자") · '지우기'는 두 번 눌러야 지운다.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useClearBodyInfo, useSaveBodyInfo } from "@/hooks/useMyBodyInfo";
import { bodyErrorText, bodyInputError, parseBodyNumber, type BodyInfo } from "@/lib/achievement153";

const show = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 10) / 10));
const clean = (t: string) => t.replace(/[^\d.,]/g, "").slice(0, 5);

const BodyInfoSheet = ({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: BodyInfo | null;
}) => {
  const save = useSaveBodyInfo();
  const clear = useClearBodyInfo();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // 열 때 채운 값 — 바뀌었는지 비교용
  const initial = useRef({ height: "", weight: "" });
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next = { height: show(current?.heightCm), weight: show(current?.weightKg) };
      initial.current = next;
      setHeight(next.height);
      setWeight(next.weight);
      setError(null);
      setConfirmClear(false);
    }
    wasOpen.current = open;
  }, [open, current?.heightCm, current?.weightKg]);

  const busy = save.isPending || clear.isPending;
  const hasAny = !!current && (current.count > 0 || current.sessionMinutes != null);

  const onSave = () => {
    const changed = { height: height.trim() !== initial.current.height, weight: weight.trim() !== initial.current.weight };
    const h = changed.height ? parseBodyNumber(height) : null;
    const w = changed.weight ? parseBodyNumber(weight) : null;
    if (h == null && w == null) {
      // 바꾼 게 없거나 칸을 비우기만 했다 — 서버 값은 그대로
      if (changed.height || changed.weight) {
        setError("비운 칸은 지워지지 않아요. 모두 지우려면 아래 '신체 정보 지우기'를 눌러 주세요");
        return;
      }
      onOpenChange(false);
      return;
    }
    const err = bodyInputError(h, w);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    save.mutate(
      { heightCm: h, weightKg: w, sessionMinutes: null },
      {
        onSuccess: () => {
          toast.success("저장했어요");
          onOpenChange(false);
        },
        onError: (e) => setError(bodyErrorText(e)),
      },
    );
  };

  const onClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clear.mutate(undefined, {
      onSuccess: () => {
        toast.success("신체 정보를 지웠어요");
        onOpenChange(false);
      },
      onError: () => setError("지우지 못했어요. 잠시 뒤 다시 해 주세요"),
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-[15px] font-black">내 신체 정보</DrawerTitle>
          <DrawerDescription className="text-[12px]">몸무게를 넣으면 칼로리를 내 몸 기준으로 계산해요.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-[12px] font-bold text-muted-foreground">키 (cm)</span>
              <Input
                value={height}
                onChange={(e) => {
                  setHeight(clean(e.target.value));
                  setError(null);
                }}
                inputMode="decimal"
                placeholder="예: 172.5"
                aria-label="키 (cm)"
                className="mt-1 h-12 text-[16px] tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-muted-foreground">몸무게 (kg)</span>
              <Input
                value={weight}
                onChange={(e) => {
                  setWeight(clean(e.target.value));
                  setError(null);
                }}
                inputMode="decimal"
                placeholder="예: 68.4"
                aria-label="몸무게 (kg)"
                className="mt-1 h-12 text-[16px] tabular-nums"
              />
            </label>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            오늘 날짜로 저장돼요. 날마다 넣으면 처음보다 가벼워졌을 때 &lsquo;지금까지 이룬 것&rsquo;에 보여 드려요.
          </p>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] font-bold text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-[14px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            저장하기
          </button>
          {hasAny && (
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="h-10 w-full rounded-xl text-[12.5px] font-bold text-muted-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {confirmClear ? "한 번 더 누르면 내 신체 정보를 모두 지워요" : "신체 정보 지우기"}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default BodyInfoSheet;
