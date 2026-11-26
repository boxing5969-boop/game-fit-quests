/**
 * 👔 관장님 숫자 — 지도자 홈 머리 바로 아래 칸 (2026-11-26 대표님 「추천대로」 · 선릉역점만 · docs/features/69)
 *   네 칸(재등록률 · 출석률 · 유효 회원 · 이번 달 매출) — 칸을 누르면 계산 방법 · 오늘 할 일 세 줄 · 브로제이 기준 시각.
 *   관장 · 지점장 · 본사만(LeaderHome 이 그때만 붙인다 · 매출 칸은 서버가 권한대로 뺀다). 글 · 칸 = lib/ownerKpi.ts
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Info } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useBackClose } from "@/hooks/useBackClose";
import { ownerStamp, ownerTileHelp, ownerTiles, ownerTodos, type OwnerHomeData, type OwnerTileKey } from "@/lib/ownerKpi";
import { cn } from "@/lib/utils";

const TONE = {
  up: "text-emerald-700 dark:text-emerald-300",
  down: "text-rose-700 dark:text-rose-300",
  flat: "text-muted-foreground",
} as const;

const ARROW = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const;

export interface OwnerKpiCardProps {
  data: OwnerHomeData;
  /** 지도자 홈 ① 기간 임박(아래 명단과 같은 숫자) */
  expiring: { count: number; days: number };
  onJumpExpiring?: () => void;
  /** 153OS CRM 을 볼 수 있다 — 7일 안 옴 · 문의 줄을 누르면 153운영본부 CRM 명단으로 (2026-11-27) */
  crmOn?: boolean;
  className?: string;
}

const OwnerKpiCard = ({ data, expiring, onJumpExpiring, crmOn, className }: OwnerKpiCardProps) => {
  const navigate = useNavigate();
  const [help, setHelp] = useState<OwnerTileKey | null>(null);
  useBackClose(!!help, () => setHelp(null));
  const tiles = ownerTiles(data);
  const todos = ownerTodos(data, expiring, { crm: crmOn });
  const stamp = ownerStamp(data);
  const h = help ? ownerTileHelp(help, data) : null;

  return (
    <div className={cn("rounded-xl border border-border bg-background p-3.5", className)} aria-label="관장님 숫자">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="shrink-0 text-body font-black text-foreground">관장님 숫자</h3>
        {stamp.text && <span className="truncate text-micro text-muted-foreground">{stamp.text}</span>}
      </div>
      {stamp.warn && (
        <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-label font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          {stamp.warn}
        </p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const Arrow = t.delta ? ARROW[t.delta.tone] : null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setHelp(t.key)}
              aria-label={`${t.label} ${t.value} · 계산 방법 보기`}
              className="flex min-w-0 flex-col items-start rounded-xl bg-secondary/70 p-3 text-left active:scale-[0.98]"
            >
              <span className="flex items-center gap-1 text-label text-muted-foreground">
                {t.label}
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </span>
              <span className="mt-0.5 text-title tabular-nums text-foreground">{t.value}</span>
              <span className="mt-0.5 text-micro leading-snug text-muted-foreground">{t.sub}</span>
              {t.delta && Arrow && (
                <span className={cn("mt-1 flex items-center gap-0.5 text-micro font-bold", TONE[t.delta.tone])}>
                  <Arrow className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.delta.text}
                </span>
              )}
              {t.note && <span className="mt-0.5 text-micro leading-snug text-muted-foreground">{t.note}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <p className="text-label font-bold text-foreground">오늘 할 일</p>
        <ul className="divide-y divide-border">
          {todos.map((t) => {
            const body = (
              <span className="min-w-0">
                <span className={cn("block text-body font-bold", t.count > 0 ? "text-foreground" : "text-muted-foreground")}>{t.text}</span>
                <span className="block text-micro text-muted-foreground">{t.sub}</span>
              </span>
            );
            const go = t.jump && onJumpExpiring ? onJumpExpiring : t.to ? () => navigate(t.to as string) : null;
            return (
              <li key={t.key}>
                {go ? (
                  <button
                    type="button"
                    onClick={go}
                    className="flex w-full items-center justify-between gap-2 py-2 text-left active:opacity-70"
                  >
                    {body}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                ) : (
                  <div className="py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Drawer open={!!help} onOpenChange={(v) => !v && setHelp(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-heading font-black">{h?.title ?? "계산 방법"}</DrawerTitle>
            <DrawerDescription className="text-label">{stamp.text ?? "브로제이 숫자 기준"}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <ul className="space-y-2">
              {(h?.lines ?? []).map((line) => (
                <li key={line} className="text-body leading-relaxed text-foreground">
                  {line}
                </li>
              ))}
            </ul>
            {h?.foot && <p className="mt-3 rounded-lg bg-secondary/70 px-3 py-2 text-label leading-relaxed text-muted-foreground">{h.foot}</p>}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default OwnerKpiCard;
