/**
 * ⚖️ 내 신체 정보 넣기 · 고치기 — 키 · 몸무게 (2026-10-21 대표님: "본인이 신체정보 넣을 수 있게 하자")
 *   + 성별 · 출생 연도 · 체지방률 (2026-10-22 대표님: "고객 데이터를 상세하게 기록할수록 정확도는 올라간다고 해")
 *   · 키 · 몸무게 · 체지방률은 오늘(KST) 날짜로 저장 — 같은 날 다시 넣으면 고친다
 *   · 바꾼 칸만 보낸다 — 그대로 둔 몸무게가 '오늘 잰 값'으로 다시 찍히지 않게 (2026-10-21 검수)
 *   · 열 때 한 번만 채운다 — 입력하는 도중에 서버 값이 와도 덮어쓰지 않게 (성별 · 출생 연도 · 체지방률은 늦게 오면 그때 한 번)
 *   · 성별 · 출생 연도는 지점 등록 정보가 있으면 미리 골라 둔다 — 그대로 두면 저장하지 않는다
 *   · '한 번 복싱 시간' 칸은 2026-10-22 없앴다 — 운동 시간은 두 번째 체크(얼굴 인식 · QR)로 실제로 잰다 (대표님)
 *   보는 사람 안내 문구는 넣지 않는다 (2026-10-22 대표님: "안내 문구를 아예 넣지 말자") · '지우기'는 두 번 눌러야 지운다.
 *   칸 옆 '+15%' = 홈 '153과 함께하며' 정확도가 오르는 만큼 (lib/fitnessProfile153 ACCURACY_POINTS)
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useClearBodyInfo, useMyFitnessExtra, useSaveBodyInfo, useSaveFitnessExtra } from "@/hooks/useMyBodyInfo";
import { bodyErrorText, bodyInputError, parseBodyNumber, type BodyInfo } from "@/lib/achievement153";
import {
  ACCURACY_POINTS,
  fitnessExtraErrorText,
  fitnessExtraInputError,
  parseBirthYear,
  parseBodyFat,
  type Gender,
} from "@/lib/fitnessProfile153";
import { cn } from "@/lib/utils";

const show = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 10) / 10));
const clean = (t: string) => t.replace(/[^\d.,]/g, "").slice(0, 5);
const digits = (t: string) => t.replace(/\D/g, "").slice(0, 4);
const thisYearKst = () => Number(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 4));

const Plus = ({ points }: { points: number }) => (
  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-px text-[10.5px] font-black text-primary">정확도 +{points}%</span>
);

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
  const saveExtra = useSaveFitnessExtra();
  const clear = useClearBodyInfo();
  const { data: extra } = useMyFitnessExtra(open);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [birth, setBirth] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // 열 때 채운 값 — 바뀌었는지 비교용
  const initial = useRef({ height: "", weight: "", gender: null as Gender | null, birth: "", fat: "" });
  const wasOpen = useRef(false);
  const extraFilled = useRef(false);
  const touchedExtra = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next = { height: show(current?.heightCm), weight: show(current?.weightKg) };
      initial.current = { ...initial.current, ...next };
      setHeight(next.height);
      setWeight(next.weight);
      setError(null);
      setConfirmClear(false);
      extraFilled.current = false;
      touchedExtra.current = false;
    }
    wasOpen.current = open;
  }, [open, current?.heightCm, current?.weightKg]);

  // 성별 · 출생 연도 · 체지방률 — 서버 값이 오면 한 번만 채운다 (그사이 회원이 고친 칸은 덮지 않는다)
  useEffect(() => {
    if (!open || !extra || extraFilled.current) return;
    extraFilled.current = true;
    const next = {
      gender: extra.gender,
      birth: extra.birthYear != null ? String(extra.birthYear) : "",
      fat: show(extra.bodyFatPct),
    };
    initial.current = { ...initial.current, ...next };
    if (!touchedExtra.current) {
      setGender(next.gender);
      setBirth(next.birth);
      setFat(next.fat);
    }
  }, [open, extra]);

  const busy = save.isPending || saveExtra.isPending || clear.isPending;
  const hasAny =
    (!!current && (current.count > 0 || current.sessionMinutes != null)) ||
    (!!extra && (extra.bodyFatCount > 0 || extra.genderSource === "me" || extra.birthSource === "me"));

  const onSave = async () => {
    const changed = {
      height: height.trim() !== initial.current.height,
      weight: weight.trim() !== initial.current.weight,
      gender: gender !== initial.current.gender,
      birth: birth.trim() !== initial.current.birth,
      fat: fat.trim() !== initial.current.fat,
    };
    const h = changed.height ? parseBodyNumber(height) : null;
    const w = changed.weight ? parseBodyNumber(weight) : null;
    const g = changed.gender ? gender : null;
    const by = changed.birth ? parseBirthYear(birth) : null;
    const bf = changed.fat ? parseBodyFat(fat) : null;
    const bodyChanged = h != null || w != null;
    const extraChanged = g != null || by != null || bf != null;
    if (!bodyChanged && !extraChanged) {
      // 바꾼 게 없거나 칸을 비우기만 했다 — 서버 값은 그대로
      if (changed.height || changed.weight || changed.birth || changed.fat) {
        setError("비운 칸은 지워지지 않아요. 모두 지우려면 아래 '신체 정보 지우기'를 눌러 주세요");
        return;
      }
      onOpenChange(false);
      return;
    }
    if (bodyChanged) {
      const err = bodyInputError(h, w);
      if (err) {
        setError(err);
        return;
      }
    }
    if (extraChanged) {
      const err = fitnessExtraInputError(by, bf, thisYearKst());
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    try {
      if (bodyChanged) await save.mutateAsync({ heightCm: h, weightKg: w, sessionMinutes: null });
    } catch (e) {
      setError(bodyErrorText(e));
      return;
    }
    try {
      if (extraChanged) await saveExtra.mutateAsync({ gender: g, birthYear: by, bodyFatPct: bf });
    } catch (e) {
      setError(fitnessExtraErrorText(e));
      return;
    }
    toast.success("저장했어요");
    onOpenChange(false);
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

  const field = (
    label: string,
    points: number,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    inputMode: "decimal" | "numeric",
  ) => (
    <label className="block">
      <span className="flex items-center text-[12px] font-bold text-muted-foreground">
        {label}
        <Plus points={points} />
      </span>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setError(null);
        }}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-label={label}
        className="mt-1 h-12 text-[16px] tabular-nums"
      />
    </label>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-[15px] font-black">내 신체 정보</DrawerTitle>
          <DrawerDescription className="text-[12px]">
            넣을수록 홈 &lsquo;153과 함께하며&rsquo;가 내 몸에 맞게 정확해져요. 몸무게를 넣으면 칼로리를 내 몸 기준으로 계산해요.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <div>
            <span className="flex items-center text-[12px] font-bold text-muted-foreground">
              성별
              <Plus points={ACCURACY_POINTS.gender} />
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="성별">
              {(["남", "여"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={gender === g}
                  onClick={() => {
                    touchedExtra.current = true;
                    setGender(g);
                    setError(null);
                  }}
                  className={cn(
                    "h-12 rounded-xl border text-[15px] font-bold transition-transform active:scale-[0.98]",
                    gender === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                  )}
                >
                  {g === "남" ? "남성" : "여성"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {field("몸무게 (kg)", ACCURACY_POINTS.weight, weight, (v) => setWeight(clean(v)), "예: 68.4", "decimal")}
            {field("키 (cm)", ACCURACY_POINTS.height, height, (v) => setHeight(clean(v)), "예: 172.5", "decimal")}
            {field(
              "출생 연도",
              ACCURACY_POINTS.age,
              birth,
              (v) => {
                touchedExtra.current = true;
                setBirth(digits(v));
              },
              "예: 1990",
              "numeric",
            )}
            {field(
              "체지방률 (%)",
              ACCURACY_POINTS.bodyFat,
              fat,
              (v) => {
                touchedExtra.current = true;
                setFat(clean(v));
              },
              "인바디 값 · 예: 24.5",
              "decimal",
            )}
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            몸무게 · 키 · 체지방률은 오늘 날짜로 저장돼요. 다시 잴 때마다 넣으면 처음보다 좋아졌을 때 바로 보여 드려요.
          </p>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] font-bold text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-[14px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {(save.isPending || saveExtra.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
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
