/**
 * ⚖️ 내 신체 정보 넣기 · 고치기 — 키 · 몸무게 (2026-10-21 대표님: "본인이 신체정보 넣을 수 있게 하자")
 *   + 성별 · 출생 연도 · 체지방률 (2026-10-22 대표님: "고객 데이터를 상세하게 기록할수록 정확도는 올라간다고 해")
 *   · 키 · 몸무게 · 체지방률은 오늘(KST) 날짜로 저장 — 같은 날 다시 넣으면 고친다
 *   · 바꾼 칸만 보낸다 — 그대로 둔 몸무게가 '오늘 잰 값'으로 다시 찍히지 않게 (2026-10-21 검수)
 *   · 열 때 한 번만 채운다 — 입력하는 도중에 서버 값이 와도 덮어쓰지 않게 (성별 · 출생 연도 · 체지방률은 늦게 오면 그때 한 번)
 *   · 성별 · 출생 연도는 지점 등록 정보가 있으면 미리 골라 둔다 — 그대로 두면 저장하지 않는다
 *   · '한 번 복싱 시간' 칸은 2026-10-22 없앴다 — 운동 시간은 두 번째 체크(얼굴 인식 · QR)로 실제로 잰다 (대표님)
 *   보는 사람 안내 문구는 넣지 않는다 (2026-10-22 대표님: "안내 문구를 아예 넣지 말자") · '지우기'는 두 번 눌러야 지운다.
 *   → 2026-10-28 대표님 "공개 비공개 버튼 만들고 비공개 버튼 누르면 본인 외에는 아무도 못보는걸로" — 맨 위 '누가 볼 수 있나요?'
 *     공개(운영진 · 코치님) · 비공개(나만, 코치님이 잰 153 PB 기록은 그대로). 누르면 바로 저장(set_my_body_info_private).
 *   칸 옆 '+15%' = 홈 '153과 함께하며' 정확도가 오르는 만큼 (lib/fitnessProfile153 ACCURACY_POINTS)
 *   + 맨 위 '153 체력 프로필' 카드(읽기 전용) · 아래 선택 칸 허리둘레 · 안정시 심박 (2026-10-25 대표님 — 체력 프로필 1단계)
 *     카드는 코치님이 잰 153 PB 공식 기록(실측)만 — 영역 5개 · PB · 처음보다 좋아진 정도 · 악력 · 다음 측정일.
 *     숫자 · 문구는 lib/test153Profile 한 곳. 기록이 없으면 '153 PB로 내 체력 재기' → 랭킹 153 PB 탭.
 *   + 선택 칸 맨 위 악력(kg) — 체육관 악력계(코멧)로 좌우 각 2번 중 가장 높은 값 · 칸 옆에 몸무게 대비 %(상대악력) 바로 (2026-10-25 대표님)
 *     회원이 넣으면 source 'me'(카드에 '내가 넣음'), 같은 날 코치님이 넣은 값이 있으면 카드는 코치 값.
 *   + 하루 평균 운동 시간 (2026-10-27 대표님: "하루에 평균 몇 시간 정도 운동하는지 본인이 넣을 수 있게") — 30분~4시간 중 고르기.
 *     예전 '한 번 복싱 시간' 칸(member_workout_settings.session_minutes)을 그대로 쓴다. 계산에는 쓰지 않는다.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Gauge, Loader2, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  useClearBodyInfo,
  useMyFitnessExtra,
  useMyFitnessProfile,
  useSaveBodyInfo,
  useSaveFitnessExtra,
  useSaveMyMeasures,
  useSetBodyPrivacy,
} from "@/hooks/useMyBodyInfo";
import {
  DAILY_WORKOUT_CHOICES,
  bodyErrorText,
  bodyInputError,
  dailyWorkoutText,
  parseBodyNumber,
  type BodyInfo,
} from "@/lib/achievement153";
import { kstToday } from "@/lib/attendanceCheer";
import {
  ACCURACY_POINTS,
  fitnessExtraErrorText,
  fitnessExtraInputError,
  parseBirthYear,
  parseBodyFat,
  type Gender,
} from "@/lib/fitnessProfile153";
import { formatPct } from "@/lib/healthGains153";
import { DIVISION_LABEL } from "@/lib/test153";
import {
  areaRows,
  gripText,
  kstMonthDay,
  measureErrorText,
  measureInputError,
  nextTestText,
  parseMeasure,
  pbLine,
  recordTimeText,
  relGripPct,
  shownDivision,
  type FitnessProfile,
} from "@/lib/test153Profile";
import { cn } from "@/lib/utils";

const show = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 10) / 10));
const clean = (t: string) => t.replace(/[^\d.,]/g, "").slice(0, 5);
const digits = (t: string) => t.replace(/\D/g, "").slice(0, 4);
const thisYearKst = () => Number(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 4));

const Plus = ({ points }: { points: number }) => (
  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-px text-micro font-black text-primary">정확도 +{points}%</span>
);

/** 153 체력 프로필 — 코치님이 잰 153 PB 공식 기록(실측)으로 본 내 체력 (2026-10-25 · 1단계) */
const ProfileCard = ({ profile, loading, onGoTest }: { profile: FitnessProfile | undefined; loading: boolean; onGoTest: () => void }) => {
  const div = shownDivision(profile);
  if (loading && !profile) return <div className="h-24 animate-pulse rounded-2xl bg-muted/60" aria-hidden />;
  if (!div) {
    return (
      <button
        type="button"
        onClick={onGoTest}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/[0.04] px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
      >
        <Gauge className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">153 PB로 내 체력 재기</span>
          <span className="block text-label text-muted-foreground">코치님이 재면 내 체력이 실측으로 보여요</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    );
  }
  const rows = areaRows(div);
  const grip = gripText(profile?.grip ?? null);
  const next = nextTestText(profile?.nextTestOn, kstToday());
  return (
    <section aria-label="153 체력 프로필" className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-bold text-foreground">153 체력 프로필</p>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-black text-primary">실측</span>
      </div>
      <p className="mt-0.5 text-label text-muted-foreground">
        {kstMonthDay(div.latest.measuredAt)} 측정 · {DIVISION_LABEL[div.division]}
        {div.latest.coachName ? ` · 코치 ${div.latest.coachName}` : ""}
      </p>
      <p className="mt-2.5 text-label font-bold text-muted-foreground">개인 최고 기록 (PB)</p>
      <p className="text-title font-black leading-tight tabular-nums text-foreground">{recordTimeText(div.pb)}</p>
      <p className="mt-0.5 text-label font-bold leading-snug text-primary">{pbLine(div)}</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label font-bold text-foreground">{r.label}</span>
              {r.gainPct != null && (
                <span className="shrink-0 text-label font-bold tabular-nums text-primary">처음보다 +{formatPct(r.gainPct)}%</span>
              )}
            </div>
            <p className="text-label leading-snug text-muted-foreground">
              {r.value ?? "다음 측정에서 채워져요"}
              <span className="text-muted-foreground/70"> · {r.from}</span>
            </p>
            {r.ratio > 0 && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.round(r.ratio * 100))}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {(grip || next) && (
        <div className="mt-3 space-y-1 border-t border-border/60 pt-2.5 text-label text-foreground">
          {grip && (
            <p>
              <b>{grip}</b>
              {profile?.grip?.on && (
                <span className="text-muted-foreground"> · {kstMonthDay(profile.grip.on)} {profile.grip.source === "coach" ? "코치 측정" : "내가 넣음"}</span>
              )}
            </p>
          )}
          {next && (
            <p>
              다음 측정 <b>{next}</b>
            </p>
          )}
        </div>
      )}
    </section>
  );
};

const BodyInfoSheet = ({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: BodyInfo | null;
}) => {
  const navigate = useNavigate();
  const save = useSaveBodyInfo();
  const saveExtra = useSaveFitnessExtra();
  const saveMeasures = useSaveMyMeasures();
  const clear = useClearBodyInfo();
  const privacy = useSetBodyPrivacy();
  const isPrivate = current?.isPrivate ?? false;
  const onPrivacy = async (next: boolean) => {
    if (next === isPrivate || privacy.isPending) return;
    try {
      await privacy.mutateAsync(next);
      toast.success(next ? "비공개로 바꿨어요. 이제 나만 볼 수 있어요" : "공개로 바꿨어요");
    } catch {
      toast.error("바꾸지 못했어요. 잠시 뒤 다시 해 주세요");
    }
  };
  const { data: extra } = useMyFitnessExtra(open);
  const { data: profile, isLoading: profileLoading } = useMyFitnessProfile(open);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [birth, setBirth] = useState("");
  const [fat, setFat] = useState("");
  const [grip, setGrip] = useState("");
  const [waist, setWaist] = useState("");
  const [restHr, setRestHr] = useState("");
  const [daily, setDaily] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // 열 때 채운 값 — 바뀌었는지 비교용
  const initial = useRef({
    height: "",
    weight: "",
    gender: null as Gender | null,
    birth: "",
    fat: "",
    grip: "",
    waist: "",
    restHr: "",
    daily: null as number | null,
  });
  const wasOpen = useRef(false);
  const extraFilled = useRef(false);
  const touchedExtra = useRef(false);
  const profileFilled = useRef(false);
  const touchedMeasure = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next = { height: show(current?.heightCm), weight: show(current?.weightKg), daily: current?.sessionMinutes ?? null };
      initial.current = { ...initial.current, ...next };
      setHeight(next.height);
      setWeight(next.weight);
      setDaily(next.daily);
      setError(null);
      setConfirmClear(false);
      extraFilled.current = false;
      touchedExtra.current = false;
      profileFilled.current = false;
      touchedMeasure.current = false;
    }
    wasOpen.current = open;
  }, [open, current?.heightCm, current?.weightKg, current?.sessionMinutes]);

  // 악력 · 허리둘레 · 안정시 심박 — 서버 값이 오면 한 번만 채운다 (그사이 회원이 고친 칸은 덮지 않는다)
  useEffect(() => {
    if (!open || !profile || profileFilled.current) return;
    profileFilled.current = true;
    const next = { grip: show(profile.grip?.kg), waist: show(profile.waist?.cm), restHr: show(profile.restHr?.bpm) };
    initial.current = { ...initial.current, ...next };
    if (!touchedMeasure.current) {
      setGrip(next.grip);
      setWaist(next.waist);
      setRestHr(next.restHr);
    }
  }, [open, profile]);

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

  const busy = save.isPending || saveExtra.isPending || saveMeasures.isPending || clear.isPending;
  // 악력 칸 옆 '몸무게의 N%' — 지금 칸에 든 몸무게(없으면 저장된 몸무게)로 바로 계산
  const gripRel = relGripPct(parseMeasure("grip_kg", grip), parseBodyNumber(weight) ?? current?.weightKg ?? null);
  const hasAny =
    (!!current && (current.count > 0 || current.sessionMinutes != null)) ||
    (!!extra && (extra.bodyFatCount > 0 || extra.genderSource === "me" || extra.birthSource === "me")) ||
    (!!profile && profile.measureCount > 0);

  const onSave = async () => {
    const changed = {
      height: height.trim() !== initial.current.height,
      weight: weight.trim() !== initial.current.weight,
      gender: gender !== initial.current.gender,
      birth: birth.trim() !== initial.current.birth,
      fat: fat.trim() !== initial.current.fat,
      grip: grip.trim() !== initial.current.grip,
      waist: waist.trim() !== initial.current.waist,
      restHr: restHr.trim() !== initial.current.restHr,
      daily: daily !== initial.current.daily,
    };
    const h = changed.height ? parseBodyNumber(height) : null;
    const w = changed.weight ? parseBodyNumber(weight) : null;
    const g = changed.gender ? gender : null;
    const by = changed.birth ? parseBirthYear(birth) : null;
    const bf = changed.fat ? parseBodyFat(fat) : null;
    const gk = changed.grip ? parseMeasure("grip_kg", grip) : null;
    const wc = changed.waist ? parseMeasure("waist_cm", waist) : null;
    const hr = changed.restHr ? parseMeasure("rest_hr", restHr) : null;
    const sm = changed.daily ? daily : null;
    const bodyChanged = h != null || w != null || sm != null;
    const extraChanged = g != null || by != null || bf != null;
    const measureChanged = gk != null || wc != null || hr != null;
    if (!bodyChanged && !extraChanged && !measureChanged) {
      // 바꾼 게 없거나 칸을 비우기만 했다 — 서버 값은 그대로
      if (changed.height || changed.weight || changed.birth || changed.fat || changed.grip || changed.waist || changed.restHr) {
        setError("비운 칸은 지워지지 않아요. 모두 지우려면 아래 '신체 정보 지우기'를 눌러 주세요");
        return;
      }
      onOpenChange(false);
      return;
    }
    if (measureChanged) {
      const err = measureInputError("grip_kg", gk) ?? measureInputError("waist_cm", wc) ?? measureInputError("rest_hr", hr);
      if (err) {
        setError(err);
        return;
      }
    }
    if (bodyChanged) {
      const err = bodyInputError(h, w, sm);
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
      if (bodyChanged) await save.mutateAsync({ heightCm: h, weightKg: w, sessionMinutes: sm });
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
    try {
      if (measureChanged) {
        await saveMeasures.mutateAsync({
          ...(gk != null ? { grip_kg: gk } : {}),
          ...(wc != null ? { waist_cm: wc } : {}),
          ...(hr != null ? { rest_hr: hr } : {}),
        });
      }
    } catch (e) {
      setError(measureErrorText(e));
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
      <span className="flex items-center text-label font-bold text-muted-foreground">
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
        className="mt-1 h-12 text-body tabular-nums"
      />
    </label>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">내 신체 정보</DrawerTitle>
          {/* 한 줄 (2026-10-28 리디자인) */}
          <DrawerDescription className="text-label">넣을수록 칼로리 · 건강 수명이 내 몸 기준으로 정확해져요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {/* 누가 볼 수 있나요? — 공개 · 비공개 (2026-10-28 대표님), 누르면 바로 저장 */}
          <div>
            <span className="text-label font-bold text-muted-foreground">누가 볼 수 있나요?</span>
            <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="신체 정보 공개 범위">
              {([false, true] as const).map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  role="radio"
                  aria-checked={isPrivate === p}
                  disabled={privacy.isPending}
                  onClick={() => void onPrivacy(p)}
                  className={cn(
                    "flex h-12 items-center justify-center gap-1.5 rounded-xl border text-body font-bold transition-transform active:scale-[0.98] disabled:opacity-60",
                    isPrivate === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                  )}
                >
                  {p ? <Lock className="h-4 w-4" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
                  {p ? "비공개" : "공개"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-label leading-relaxed text-muted-foreground">
              {isPrivate
                ? "나만 볼 수 있어요. 코치님이 잰 153 PB 기록만 코치님도 봐요."
                : "운영진과 코치님이 볼 수 있어요. 비공개로 하면 나만 봐요."}
            </p>
          </div>
          <ProfileCard
            profile={profile}
            loading={profileLoading}
            onGoTest={() => {
              onOpenChange(false);
              navigate("/halloffame?tab=test153");
            }}
          />
          <div>
            <span className="flex items-center text-label font-bold text-muted-foreground">
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
                    "h-12 rounded-xl border text-body font-bold transition-transform active:scale-[0.98]",
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
          <div>
            <span className="flex flex-wrap items-baseline gap-x-1.5 text-label font-bold text-muted-foreground">
              하루 평균 운동 시간
              <span className="text-label font-normal">체육관 · 집 합쳐서</span>
            </span>
            <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="하루 평균 운동 시간">
              {DAILY_WORKOUT_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={daily === m}
                  onClick={() => {
                    setDaily(m);
                    setError(null);
                  }}
                  className={cn(
                    "h-11 rounded-xl border px-1 text-label font-bold tabular-nums leading-tight transition-transform active:scale-[0.98]",
                    daily === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                  )}
                >
                  {dailyWorkoutText(m)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-label font-bold text-muted-foreground">더 넣어 두면 좋아요 (선택)</span>
            <label className="mt-1 block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 text-label font-bold text-muted-foreground">
                  악력 (kg) <span className="font-normal">좌우 2번씩 중 최고</span>
                </span>
                {gripRel != null && (
                  <span className="shrink-0 text-label font-bold tabular-nums text-primary">몸무게의 {gripRel}%</span>
                )}
              </span>
              <Input
                value={grip}
                onChange={(e) => {
                  touchedMeasure.current = true;
                  setGrip(clean(e.target.value));
                  setError(null);
                }}
                inputMode="decimal"
                placeholder="체육관 악력계 · 예: 42.5"
                aria-label="악력 (kg)"
                className="mt-1 h-12 text-body tabular-nums"
              />
            </label>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="text-label font-bold text-muted-foreground">허리둘레 (cm)</span>
                <Input
                  value={waist}
                  onChange={(e) => {
                    touchedMeasure.current = true;
                    setWaist(clean(e.target.value));
                    setError(null);
                  }}
                  inputMode="decimal"
                  placeholder="예: 82.5"
                  aria-label="허리둘레 (cm)"
                  className="mt-1 h-12 text-body tabular-nums"
                />
              </label>
              <label className="block">
                <span className="text-label font-bold text-muted-foreground">안정시 심박 (회/분)</span>
                <Input
                  value={restHr}
                  onChange={(e) => {
                    touchedMeasure.current = true;
                    setRestHr(e.target.value.replace(/\D/g, "").slice(0, 3));
                    setError(null);
                  }}
                  inputMode="numeric"
                  placeholder="워치 값 · 예: 62"
                  aria-label="안정시 심박 (회/분)"
                  className="mt-1 h-12 text-body tabular-nums"
                />
              </label>
            </div>
          </div>
          <p className="text-label text-muted-foreground">오늘 날짜로 저장돼요 · 다시 잴 때마다 넣으면 좋아진 만큼 보여 드려요</p>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-label font-bold text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-body font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy && !clear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            저장하기
          </button>
          {hasAny && (
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="h-10 w-full rounded-xl text-label font-bold text-muted-foreground active:scale-[0.98] disabled:opacity-60"
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
