/**
 * ⚖️ 내 신체 · 운동 정보 넣기 · 고치기 — 키 · 몸무게 · 한 번 복싱 시간 (2026-10-21 대표님)
 *   "본인이 신체정보 넣을 수 있게 하자" · "운동 시간 평균도 입력할 수 있게 해 줘, 더 많이 하는 회원도 있으니까 기준은 60분"
 *   · 키 · 몸무게는 오늘(KST) 날짜로 저장 — 같은 날 다시 넣으면 고친다
 *   · 복싱 시간은 하나만 둔다 (20~240분, 안 넣으면 60분으로 계산) — 자주 쓰는 시간은 칩으로
 *     줄넘기 2분 × 3라운드는 따로 더한다 ("줄넘기 2분 3라운드 + 1시간 복싱 기준")
 *   · 바꾼 칸만 보낸다 — 그대로 둔 몸무게가 '오늘 잰 값'으로 다시 찍히지 않게 (2026-10-21 검수)
 *   · 열 때 한 번만 채운다 — 입력하는 도중에 서버 값이 와도 덮어쓰지 않게
 *   본인만 본다(코치 · 관리자 화면 없음). '지우기'는 두 번 눌러야 지운다.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useClearBodyInfo, useSaveBodyInfo } from "@/hooks/useMyBodyInfo";
import {
  BASIS_MINUTES,
  ROPE_ROUNDS,
  ROPE_ROUND_MINUTES,
  bodyErrorText,
  bodyInputError,
  parseBodyNumber,
  parseMinutes,
  type BodyInfo,
} from "@/lib/achievement153";
import { cn } from "@/lib/utils";

const show = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 10) / 10));
const clean = (t: string) => t.replace(/[^\d.,]/g, "").slice(0, 5);
const MINUTE_CHIPS = [45, 60, 90, 120] as const;

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
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // 열 때 채운 값 — 바뀌었는지 비교용
  const initial = useRef({ height: "", weight: "", minutes: "" });
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next = {
        height: show(current?.heightCm),
        weight: show(current?.weightKg),
        minutes: current?.sessionMinutes != null ? String(current.sessionMinutes) : "",
      };
      initial.current = next;
      setHeight(next.height);
      setWeight(next.weight);
      setMinutes(next.minutes);
      setError(null);
      setConfirmClear(false);
    }
    wasOpen.current = open;
  }, [open, current?.heightCm, current?.weightKg, current?.sessionMinutes]);

  const busy = save.isPending || clear.isPending;
  const hasAny = !!current && (current.count > 0 || current.sessionMinutes != null);

  const onSave = () => {
    const changed = {
      height: height.trim() !== initial.current.height,
      weight: weight.trim() !== initial.current.weight,
      minutes: minutes.trim() !== initial.current.minutes,
    };
    const h = changed.height ? parseBodyNumber(height) : null;
    const w = changed.weight ? parseBodyNumber(weight) : null;
    const m = changed.minutes ? parseMinutes(minutes) : null;
    if (h == null && w == null && m == null) {
      // 바꾼 게 없거나 칸을 비우기만 했다 — 서버 값은 그대로
      if (changed.height || changed.weight || changed.minutes) {
        setError("비운 칸은 지워지지 않아요. 모두 지우려면 아래 '신체 · 운동 정보 지우기'를 눌러 주세요");
        return;
      }
      onOpenChange(false);
      return;
    }
    const err = bodyInputError(h, w, m);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    save.mutate(
      { heightCm: h, weightKg: w, sessionMinutes: m },
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
        toast.success("신체 · 운동 정보를 지웠어요");
        onOpenChange(false);
      },
      onError: () => setError("지우지 못했어요. 잠시 뒤 다시 해 주세요"),
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-[15px] font-black">내 신체 · 운동 정보</DrawerTitle>
          <DrawerDescription className="text-[12px]">
            넣은 값으로 펀치 수 · 칼로리를 내 기준으로 계산해요. 나만 볼 수 있어요.
          </DrawerDescription>
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

          <div>
            <label className="block">
              <span className="text-[12px] font-bold text-muted-foreground">한 번 복싱 시간 (평균 · 분)</span>
              <Input
                value={minutes}
                onChange={(e) => {
                  setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3));
                  setError(null);
                }}
                inputMode="numeric"
                placeholder={`안 넣으면 ${BASIS_MINUTES}분`}
                aria-label="한 번 복싱 시간 (분)"
                className="mt-1 h-12 text-[16px] tabular-nums"
              />
            </label>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="자주 쓰는 복싱 시간">
              {MINUTE_CHIPS.map((m) => {
                const on = minutes === String(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMinutes(String(m));
                      setError(null);
                    }}
                    aria-pressed={on}
                    className={cn(
                      "h-9 flex-1 rounded-full text-[12.5px] font-bold ring-1 transition-transform active:scale-[0.95]",
                      on ? "bg-foreground text-background ring-foreground" : "bg-background text-foreground ring-border",
                    )}
                  >
                    {m}분
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            체육관에서 한 번에 보통 몇 분 복싱하는지 넣어 주세요 — 더 오래 하면 펀치 · 스텝이 그만큼 더 쌓여요. 줄넘기 {ROPE_ROUND_MINUTES}분 × {ROPE_ROUNDS}라운드는 따로 더해서 계산해요. 키 · 몸무게는 오늘 날짜로 저장되고, 처음보다 가벼워지면 &lsquo;지금까지 이룬 것&rsquo;에 보여 드려요.
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
              {confirmClear ? "한 번 더 누르면 내 신체 · 운동 정보를 모두 지워요" : "신체 · 운동 정보 지우기"}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default BodyInfoSheet;
