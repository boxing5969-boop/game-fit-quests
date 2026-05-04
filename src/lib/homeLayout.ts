/**
 * 홈화면 커스터마이즈 — 사용자가 주요 위젯을 show/hide 할 수 있다.
 *
 * 고정 영역(항상 표시, 여기서 제어 안 함)
 *   - PageHeader + 💵 잔액 뱃지
 *   - QR 체크인 / 출석 완료 패널
 *   - 153 다이어트 프로모 (feature flag on 시)
 *   - Master-40 축하 배너 (조건 충족 시)
 *
 * 토글 가능 위젯(customizable)
 *   - hero           : 캐릭터 · 리그 · XP 바
 *   - masterTrack    : 마스터 트랙 진행도 (자체 조건도 필요)
 *   - todayMission   : 오늘의 미션 / 진행 중 세션
 *   - weeklyProgress : 이번 주 진행도 (세션·분)
 *   - rankingPreview : 이번 주 내 순위 카드
 *
 * 저장 위치는 localStorage. 기기마다 분리되지만 간단·빠름 — cross-device
 * 동기화는 이후 필요하면 DB 로 옮긴다.
 */

import { useCallback, useEffect, useState } from "react";

export type HomeWidgetId =
  | "hero"
  | "masterTrack"
  | "todayMission"
  | "weeklyProgress"
  | "rankingPreview";

export interface HomeWidgetMeta {
  id: HomeWidgetId;
  label: string;
  description: string;
  /** 조건부 위젯이면 프리퍼런스가 on 이어도 조건 미충족 시 렌더 안 함 (UI 안내용). */
  conditional?: boolean;
}

export const HOME_WIDGETS: readonly HomeWidgetMeta[] = Object.freeze([
  {
    id: "hero",
    label: "캐릭터 & 레벨",
    description: "내 캐릭터·리그 뱃지·다음 승급까지 XP",
  },
  {
    id: "masterTrack",
    label: "마스터 로드 진행도",
    description: "블랙 Lv10 + 보스 4회 클리어 이후에 해금",
    conditional: true,
  },
  {
    id: "todayMission",
    label: "오늘의 미션",
    description: "QR 체크인 후 활성화되는 오늘의 도전",
  },
  {
    id: "weeklyProgress",
    label: "이번 주 진행도",
    description: "세션 수 · 훈련 시간(분) 목표 바",
  },
  {
    id: "rankingPreview",
    label: "이번 주 내 순위",
    description: "지점 랭킹 내 내 위치 미리보기",
  },
]);

const STORAGE_KEY = "home_layout_v1";

type VisibilityMap = Record<HomeWidgetId, boolean>;

const DEFAULT_VISIBILITY: VisibilityMap = {
  hero: true,
  masterTrack: true,
  todayMission: true,
  weeklyProgress: true,
  rankingPreview: true,
};

/**
 * localStorage 에서 읽어 기본값과 머지. 누락/오염 키는 조용히 기본값으로 복구.
 */
function loadVisibility(): VisibilityMap {
  if (typeof window === "undefined") return { ...DEFAULT_VISIBILITY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<VisibilityMap>;
    return { ...DEFAULT_VISIBILITY, ...parsed };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

function saveVisibility(v: VisibilityMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    // quota 초과 등은 세션 내 메모리 상태만 유지.
  }
}

/**
 * 위젯 표시 여부 훅 — homepage 에서 사용.
 * 다른 탭에서 편집한 경우 storage 이벤트로도 반영.
 */
export function useHomeLayout() {
  const [visibility, setVisibility] = useState<VisibilityMap>(() => loadVisibility());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setVisibility(loadVisibility());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: HomeWidgetId) => {
    setVisibility((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveVisibility(next);
      return next;
    });
  }, []);

  const setAll = useCallback((next: Partial<VisibilityMap>) => {
    setVisibility((prev) => {
      const merged = { ...prev, ...next };
      saveVisibility(merged);
      return merged;
    });
  }, []);

  const reset = useCallback(() => {
    setVisibility({ ...DEFAULT_VISIBILITY });
    saveVisibility({ ...DEFAULT_VISIBILITY });
  }, []);

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return { visibility, toggle, setAll, reset, visibleCount };
}
