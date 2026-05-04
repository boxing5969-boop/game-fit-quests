/**
 * 153 스토리 RPG — 3가지 복서의 길 선택 영역 (단계 37).
 *
 * 동작:
 *   · active_route 가 없으면 모든 카드가 "available" → 클릭 시 choose_story_route
 *   · active_route 가 있으면:
 *       - 본인 카드: "current"
 *       - 나머지: "switchable" → 클릭 시 변경 확인 다이얼로그 → change_story_route
 */

import { useState } from "react";
import { toast } from "sonner";
import StoryRouteCard from "./StoryRouteCard";
import StoryRouteChangeDialog from "./StoryRouteChangeDialog";
import {
  useChangeStoryRoute,
  useChooseStoryRoute,
} from "@/hooks/useStoryRpg";
import type { StoryRoute } from "@/types/storyRpg";

export interface StoryRouteSelectProps {
  routes: StoryRoute[];
  activeRouteId: string | null;
}

const StoryRouteSelect = ({ routes, activeRouteId }: StoryRouteSelectProps) => {
  const choose = useChooseStoryRoute();
  const change = useChangeStoryRoute();

  const [pendingRoute, setPendingRoute] = useState<StoryRoute | null>(null);

  const handleSelect = (route: StoryRoute) => {
    if (route.id === activeRouteId) return;

    if (!activeRouteId) {
      // 최초 선택
      choose.mutate(route.code, {
        onSuccess: () => {
          toast.success(`"${route.title}"을(를) 시작합니다.`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "루트 선택에 실패했습니다.");
        },
      });
      return;
    }

    // 이미 active 가 있으면 변경 확인
    setPendingRoute(route);
  };

  const handleConfirmChange = () => {
    if (!pendingRoute) return;
    change.mutate(pendingRoute.code, {
      onSuccess: () => {
        toast.success(`"${pendingRoute.title}"(으)로 변경되었습니다.`);
        setPendingRoute(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "루트 변경에 실패했습니다.");
        setPendingRoute(null);
      },
    });
  };

  const sorted = [...routes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            복서의 길 선택
          </p>
          <h2 className="mt-0.5 text-base font-black text-foreground">
            나는 어떤 복서가 되고 싶은가
          </h2>
        </div>
      </div>

      <div className="grid gap-3">
        {sorted.map((route) => {
          const isCurrent = route.id === activeRouteId;
          const state = isCurrent
            ? ("current" as const)
            : activeRouteId
              ? ("switchable" as const)
              : ("available" as const);
          return (
            <StoryRouteCard
              key={route.id}
              route={route}
              state={state}
              loading={
                (choose.isPending && choose.variables === route.code) ||
                (change.isPending && pendingRoute?.id === route.id)
              }
              onSelect={handleSelect}
            />
          );
        })}
      </div>

      <StoryRouteChangeDialog
        open={!!pendingRoute}
        targetRoute={pendingRoute}
        loading={change.isPending}
        onConfirm={handleConfirmChange}
        onCancel={() => setPendingRoute(null)}
      />
    </section>
  );
};

export default StoryRouteSelect;
