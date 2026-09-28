/**
 * 마일리지 적립 규칙 카드 (설정 화면 · 관리자 전용, 2026-09-28)
 *
 * 대표님 지시: 출석 +500 · 레벨업 +500 · 레벨 10 타이틀매치 승급 +5,000 — 금액은 여기서 바꾼다.
 * 저장은 set_app_setting RPC(super_admin·admin 만) — 서버가 0~100,000 정수만 받고 적립 시작 시각을 정한다.
 * 바꾼 금액은 그 다음 적립부터 적용된다(이미 쌓인 마일리지는 그대로). 껐다가 다시 켜면 켠 시각부터 적립(소급 없음).
 */
import { useEffect, useRef, useState } from "react";
import { Coins, Save } from "lucide-react";
import { toast } from "sonner";

import { useMileageRules, useSetMileageRules } from "@/hooks/useMileage";
import { type MileageRules } from "@/services/mileageService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type AmountField = "attendance" | "level_up" | "title_match";

const FIELDS: { key: AmountField; label: string; hint: string }[] = [
  { key: "attendance", label: "출석", hint: "하루 1번 · 문이 열린 얼굴 출입 또는 QR 출석" },
  { key: "level_up", label: "레벨업", hint: "레벨 승인 순간 · 같은 레벨은 한 번만" },
  { key: "title_match", label: "타이틀매치 승급", hint: "레벨 10 타이틀매치 통과 · 리그마다 한 번" },
];

const MAX_AMOUNT = 100000;

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026.09.28 21:37 (KST) */
const fmtKstDateTime = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}.${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
};

const toForm = (r: MileageRules): Record<AmountField, string> => ({
  attendance: String(r.attendance),
  level_up: String(r.level_up),
  title_match: String(r.title_match),
});

const MileageSettingsCard = () => {
  const { data: rules, isLoading } = useMileageRules();
  const save = useSetMileageRules();
  const [enabled, setEnabled] = useState(true);
  const [vals, setVals] = useState<Record<AmountField, string>>({ attendance: "", level_up: "", title_match: "" });

  // 서버 값은 처음 한 번만 폼에 채운다 — 입력 중에 다시 읽혀도 고치던 숫자가 되돌아가지 않게.
  const initialized = useRef(false);
  useEffect(() => {
    if (!rules || initialized.current) return;
    initialized.current = true;
    setEnabled(rules.enabled);
    setVals(toForm(rules));
  }, [rules]);

  const nums = {
    attendance: Number(vals.attendance),
    level_up: Number(vals.level_up),
    title_match: Number(vals.title_match),
  };
  const invalid = FIELDS.some(({ key }) => {
    const n = nums[key];
    return vals[key].trim() === "" || !Number.isInteger(n) || n < 0 || n > MAX_AMOUNT;
  });
  const dirty =
    !!rules &&
    (enabled !== rules.enabled || FIELDS.some(({ key }) => vals[key].trim() !== String(rules[key])));

  const onSave = async () => {
    if (invalid) {
      toast.error("마일리지는 0 ~ 100,000 사이의 정수로 입력해 주세요");
      return;
    }
    try {
      await save.mutateAsync({ enabled, ...nums });
      toast.success(
        enabled
          ? "마일리지 규칙을 저장했어요. 다음 적립부터 바로 적용돼요."
          : "마일리지 적립을 멈췄어요. 이미 쌓인 마일리지는 그대로예요.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const statusLine = isLoading || !rules
    ? "규칙 확인 중…"
    : rules.enabled
      ? `적립 중 · ${fmtKstDateTime(rules.since) || "시작 시각 미정"}부터`
      : "적립 멈춤 · 이미 쌓인 마일리지는 그대로";

  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1" style={{ animationDelay: "0.145s" }}>
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
        <Coins className="h-4 w-4 text-reward" /> 마일리지 적립 규칙
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        회원 앱 홈의 마일리지 카드에 쌓여요. 지도진·관리자 계정은 적립되지 않아요.
        금액을 바꾸면 그 다음 적립부터 적용되고, 껐다가 다시 켜면 켠 시각부터 적립돼요(소급 없음).
      </p>

      <div className="mb-3 rounded-xl border border-reward/30 bg-reward/10 px-3 py-2 text-[12px] font-bold text-foreground">
        {statusLine}
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
        <Label htmlFor="mileage-enabled" className="text-sm font-bold text-foreground">마일리지 적립 사용</Label>
        <Switch id="mileage-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!rules} />
      </div>

      <div className="space-y-3">
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`mileage-${key}`} className="text-sm text-muted-foreground">
              {label} <span className="text-[11px]">· {hint}</span>
            </Label>
            <Input
              id={`mileage-${key}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_AMOUNT}
              step={100}
              value={vals[key]}
              disabled={!rules || !enabled}
              onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
              className="rounded-xl tabular-nums"
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        브로제이(데스크) 마일리지로 자동 이전은 아직 안 돼요 — 브로제이 공개 API에 마일리지 적립 기능이 없어서예요.
        적립 내역은 모두 보관하고 있어서, 기능이 생기면 그대로 옮길 수 있어요.
      </p>

      <button
        type="button"
        onClick={onSave}
        disabled={save.isPending || !dirty}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {save.isPending ? "저장 중..." : dirty ? "마일리지 규칙 저장" : "저장됨"}
      </button>
    </div>
  );
};

export default MileageSettingsCard;
