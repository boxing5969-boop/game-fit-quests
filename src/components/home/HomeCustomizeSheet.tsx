import { useMemo } from "react";
import { RotateCcw, Settings, X } from "lucide-react";
import { HOME_WIDGETS, useHomeLayout, type HomeWidgetId } from "@/lib/homeLayout";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface HomeCustomizeSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 홈 화면 커스터마이즈 바텀시트 — 토글로 위젯 표시/숨김.
 * 고정 영역(QR 체크인 · 골드 뱃지)은 여기서 제어 안 한다.
 * adminOnly 위젯은 admin/super_admin 만 토글 항목 노출.
 */
const HomeCustomizeSheet = ({ open, onClose }: HomeCustomizeSheetProps) => {
  const { visibility, toggle, reset, visibleCount } = useHomeLayout();
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";

  // adminOnly 위젯은 회원 sheet 에서 숨김
  const visibleWidgets = useMemo(
    () => HOME_WIDGETS.filter((w) => !w.adminOnly || isAdmin),
    [isAdmin],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl animate-slide-up sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Settings className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold text-foreground leading-tight">
                홈 커스터마이즈
              </h2>
              <p className="text-[11px] text-muted-foreground leading-tight">
                표시되는 위젯: <span className="number-font font-bold text-foreground">{visibleCount}</span>/{visibleWidgets.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full bg-muted p-1.5 active:scale-95"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 위젯 토글 리스트 */}
        <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
          {visibleWidgets.map((w) => (
            <WidgetToggleRow
              key={w.id}
              id={w.id}
              label={w.label}
              description={w.description}
              conditional={w.conditional}
              on={visibility[w.id]}
              onToggle={() => toggle(w.id)}
            />
          ))}
        </ul>

        {/* 고정 영역 안내 */}
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            항상 표시 (고정)
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-foreground/85">
            <li>· 상단 💵 파이트 머니 뱃지</li>
            <li>· QR 체크인 / 출석 완료 패널</li>
            <li>· 명예의 전당 축하 배너 (자격 달성 시)</li>
          </ul>
        </div>

        {/* 액션 */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-4 py-2.5 text-[12px] font-bold text-secondary-foreground active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            전부 보이기
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "ml-auto flex-1 rounded-xl py-2.5 text-[13px] font-bold",
              "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
              "shadow-[0_4px_14px_-4px_rgba(217,54,32,0.6)] active:scale-95",
            )}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
};

const WidgetToggleRow = ({
  id,
  label,
  description,
  conditional,
  on,
  onToggle,
}: {
  id: HomeWidgetId;
  label: string;
  description: string;
  conditional?: boolean;
  on: boolean;
  onToggle: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.99]",
        on
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/25",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-foreground">
          {label}
          {conditional && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              조건부
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      {/* Switch */}
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
            on ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      {/* unused param 경고 방지 */}
      <span className="sr-only">{id}</span>
    </button>
  </li>
);

export default HomeCustomizeSheet;
