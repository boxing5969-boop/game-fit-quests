import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { HOME_WIDGETS, useHomeLayout, type HomeWidgetId } from "@/lib/homeLayout";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface HomeCustomizeSheetProps {
  open: boolean;
  onClose: () => void;
}

// 상단 primary 슬롯에 들어가는 4개 — 회원 정의 순서로 위에 노출.
// 나머지 위젯은 "더보기" 안에 노출 (회원이 켜면).
const PRIMARY_IDS: ReadonlySet<HomeWidgetId> = new Set([
  "hero",
  "todayAction",
  "osamiNote",
  "rankingPreview",
]);

/**
 * 홈 화면 커스터마이즈 바텀시트 — on/off 토글 + ↑↓ 순서 변경.
 * 상단 4개 (primary) + 나머지 (더보기 안) 시각 구분.
 * 고정 영역(상단 잔액 뱃지)은 여기서 제어 안 한다.
 * adminOnly 위젯은 admin/super_admin 만 토글 항목 노출.
 */
const HomeCustomizeSheet = ({ open, onClose }: HomeCustomizeSheetProps) => {
  const { visibility, order, toggle, moveUp, moveDown, reset, visibleCount } =
    useHomeLayout();
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";

  // adminOnly 위젯은 회원 sheet 에서 숨김.
  const allowedIds = useMemo(
    () =>
      new Set(
        HOME_WIDGETS.filter((w) => !w.adminOnly || isAdmin).map((w) => w.id),
      ),
    [isAdmin],
  );

  // order 배열에서 admin-only 거른 뒤 primary / more 그룹 분리.
  const orderedAllowed = useMemo(
    () => order.filter((id) => allowedIds.has(id)),
    [order, allowedIds],
  );
  const primaryOrdered = useMemo(
    () => orderedAllowed.filter((id) => PRIMARY_IDS.has(id)),
    [orderedAllowed],
  );
  const moreOrdered = useMemo(
    () => orderedAllowed.filter((id) => !PRIMARY_IDS.has(id)),
    [orderedAllowed],
  );

  const metaById = useMemo(() => {
    const m = new Map<HomeWidgetId, (typeof HOME_WIDGETS)[number]>();
    for (const w of HOME_WIDGETS) m.set(w.id, w);
    return m;
  }, []);

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
                표시 중:{" "}
                <span className="number-font font-bold text-foreground">
                  {visibleCount}
                </span>
                /{orderedAllowed.length} · ↑↓ 로 순서 변경
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

        {/* 위젯 리스트 — primary / more 그룹 분리 */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {/* Primary 슬롯 — 상단 노출 */}
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              상단에 노출
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                위 {primaryOrdered.length}
              </span>
            </h3>
            <ul className="space-y-1.5">
              {primaryOrdered.map((id, idx) => {
                const meta = metaById.get(id);
                if (!meta) return null;
                return (
                  <WidgetRow
                    key={id}
                    id={id}
                    label={meta.label}
                    description={meta.description}
                    conditional={meta.conditional}
                    on={visibility[id]}
                    onToggle={() => toggle(id)}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < primaryOrdered.length - 1}
                    onMoveUp={() => moveUp(id)}
                    onMoveDown={() => moveDown(id)}
                  />
                );
              })}
            </ul>
          </section>

          {/* 더보기 안 — 토글로 노출, 같은 그룹 내에서만 순서 변경 */}
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              더보기 안에 노출
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                {moreOrdered.length}
              </span>
            </h3>
            <ul className="space-y-1.5">
              {moreOrdered.map((id, idx) => {
                const meta = metaById.get(id);
                if (!meta) return null;
                return (
                  <WidgetRow
                    key={id}
                    id={id}
                    label={meta.label}
                    description={meta.description}
                    conditional={meta.conditional}
                    on={visibility[id]}
                    onToggle={() => toggle(id)}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < moreOrdered.length - 1}
                    onMoveUp={() => moveUp(id)}
                    onMoveDown={() => moveDown(id)}
                  />
                );
              })}
            </ul>
          </section>
        </div>

        {/* 고정 영역 안내 */}
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            항상 표시 (고정)
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-foreground/85">
            <li>· 상단 💵 파이트 머니 뱃지</li>
            <li>· 오늘 한 줄 포커스 카드</li>
            <li>· 마스터 리그 달성 축하 배너 (자격 달성 시)</li>
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
            기본값으로
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

interface WidgetRowProps {
  id: HomeWidgetId;
  label: string;
  description: string;
  conditional?: boolean;
  on: boolean;
  onToggle: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const WidgetRow = ({
  id,
  label,
  description,
  conditional,
  on,
  onToggle,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: WidgetRowProps) => (
  <li
    className={cn(
      "flex items-center gap-2 rounded-xl border p-2.5 transition-colors",
      on
        ? "border-primary/40 bg-primary/5"
        : "border-border bg-card hover:border-primary/25",
    )}
  >
    {/* 순서 변경 버튼 */}
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={`${label} 위로`}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border transition-all",
          canMoveUp
            ? "border-border bg-card text-foreground hover:border-primary/40 active:scale-95"
            : "cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground/40",
        )}
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={`${label} 아래로`}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border transition-all",
          canMoveDown
            ? "border-border bg-card text-foreground hover:border-primary/40 active:scale-95"
            : "cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground/40",
        )}
      >
        <ArrowDown className="h-3 w-3" />
      </button>
    </div>

    {/* 본문 (토글 버튼이기도 함) */}
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex flex-1 items-center gap-2 text-left active:scale-[0.99]"
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
      <span className="sr-only">{id}</span>
    </button>
  </li>
);

export default HomeCustomizeSheet;
