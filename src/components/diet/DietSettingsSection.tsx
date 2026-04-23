import { Bell, Eye, MessageCircle, Sparkles, Sunrise, Trophy } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { useAuth } from "@/contexts/AuthContext";
import { useDietPreferences } from "@/hooks/useDietPreferences";
import { useDietProgress } from "@/hooks/useDietEnrollment";
import type { DietPreferences } from "@/lib/diet/preferences";
import {
  DIET_MAINTENANCE_VARIANTS,
  type DietMaintenanceVariantId,
} from "@/data/diet/maintenanceVariants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 153 다이어트 설정 섹션 — SettingsPage 에서 import 해 사용.
 * feature flag (`profiles.diet_program_enabled`) off 이면 전체 섹션 숨김.
 */
export const DietSettingsSection = () => {
  const { profile } = useAuth();
  const enabled = !!profile?.diet_program_enabled;
  const { data, update, isUpdating } = useDietPreferences();
  const progressQuery = useDietProgress();

  if (!enabled) return null;

  // 유지 플랜 picker 노출 기준: 현재/완료 enrollment 에서 Day 18 이상
  const progress = progressQuery.data;
  const enrollmentPayload =
    progress && "success" in progress && progress.success && progress.has_active
      ? progress.enrollment
      : undefined;
  const showMaintenance =
    !!enrollmentPayload &&
    (enrollmentPayload.current_day >= 18 ||
      enrollmentPayload.status === "completed");

  const selectVariant = (id: DietMaintenanceVariantId) => {
    const next: DietPreferences = {
      ...data,
      maintenance_variant: data.maintenance_variant === id ? null : id,
    };
    try {
      update(next);
    } catch {
      toast.error("설정 저장 실패");
    }
  };

  const toggle = async (
    section: "reminders" | "notifications" | "privacy",
    key: string,
    value: boolean,
  ) => {
    const next: DietPreferences = {
      ...data,
      [section]: { ...data[section], [key]: value },
    };
    try {
      update(next);
    } catch {
      toast.error("설정 저장 실패");
    }
  };

  return (
    <section
      className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1"
      style={{ animationDelay: "0.02s" }}
    >
      <h2 className="mb-1 text-base font-bold text-foreground">
        153 다이어트
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        체크인 리마인더, 코치 알림, 리더보드 노출을 설정할 수 있어요.
      </p>

      <Group title="리마인더" icon={<Bell className="h-3.5 w-3.5" />}>
        <Row
          label="아침 미션 안내"
          hint="07~10시 오늘 미션 배너"
          value={data.reminders.morning}
          disabled={isUpdating}
          onChange={(v) => toggle("reminders", "morning", v)}
        />
        <Row
          label="점심 체크 유도"
          hint="11~14시 단백질·물 체크"
          value={data.reminders.midday}
          disabled={isUpdating}
          onChange={(v) => toggle("reminders", "midday", v)}
        />
        <Row
          label="저녁 야식 방지"
          hint="17~21시 체크인 리마인드"
          value={data.reminders.evening}
          disabled={isUpdating}
          onChange={(v) => toggle("reminders", "evening", v)}
        />
      </Group>

      <Group
        title="알림"
        icon={<MessageCircle className="h-3.5 w-3.5" />}
        className="mt-3"
      >
        <Row
          label="오삼 코치님의 피드백 알림"
          hint="새 한마디 도착 시 인앱 알림"
          value={data.notifications.coach_feedback}
          disabled={isUpdating}
          onChange={(v) => toggle("notifications", "coach_feedback", v)}
        />
        <Row
          label="배지·보상 알림"
          hint="7/14/21일 달성 등 축하 알림"
          value={data.notifications.badge_reward}
          disabled={isUpdating}
          onChange={(v) => toggle("notifications", "badge_reward", v)}
        />
      </Group>

      <Group
        title="프라이버시"
        icon={<Eye className="h-3.5 w-3.5" />}
        className="mt-3"
      >
        <Row
          label="지점 랭킹 노출"
          hint="끄면 내 기록이 리더보드에 보이지 않아요"
          value={data.privacy.ranking_visible}
          disabled={isUpdating}
          onChange={(v) => toggle("privacy", "ranking_visible", v)}
          rightIcon={<Trophy className="h-3.5 w-3.5 text-reward" />}
        />
      </Group>

      {showMaintenance && (
        <Group
          title="21일 이후 유지 플랜"
          icon={<Sunrise className="h-3.5 w-3.5" />}
          className="mt-3"
        >
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            내 라이프스타일에 가까운 한 가지를 고르면 홈 팁이 그에 맞춰 갱신돼요.
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {DIET_MAINTENANCE_VARIANTS.map((v) => {
              const active = data.maintenance_variant === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => selectVariant(v.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/60 hover:border-primary/40",
                    isUpdating && "opacity-60",
                  )}
                  aria-pressed={active}
                >
                  <p
                    className={cn(
                      "text-[13px] font-bold",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {v.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {v.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </Group>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
        체중·감량 수치는 절대 공개되지 않습니다. 랭킹은 습관 수행률·승인 일수·연속일만 사용해요.
      </p>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
// 부속
// ──────────────────────────────────────────────────────────────────
const Group = ({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={className}>
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {icon}
      {title}
    </p>
    <div className="space-y-1">{children}</div>
  </div>
);

const Row = ({
  label,
  hint,
  value,
  disabled,
  onChange,
  rightIcon,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  rightIcon?: React.ReactNode;
}) => (
  <div
    className={cn(
      "flex items-center justify-between rounded-xl border border-border bg-background/60 p-3",
    )}
  >
    <div className="min-w-0 flex-1 pr-3">
      <p className="flex items-center gap-1 text-[13px] font-bold text-foreground">
        {label}
        {rightIcon}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
    <Switch
      checked={value}
      onCheckedChange={onChange}
      disabled={disabled}
    />
  </div>
);

export default DietSettingsSection;
