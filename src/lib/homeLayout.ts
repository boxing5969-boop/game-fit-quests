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
  | "todayAction"
  | "osamiNote"
  | "rankingPreview"
  | "quickAccess"
  | "masterTrack"
  | "storyRpg"
  | "dietPromo"
  | "todayMission"
  | "weeklyProgress";

export interface HomeWidgetMeta {
  id: HomeWidgetId;
  label: string;
  description: string;
  /** 조건부 위젯이면 프리퍼런스가 on 이어도 조건 미충족 시 렌더 안 함 (UI 안내용). */
  conditional?: boolean;
  /** admin / super_admin 만 토글 항목에 노출 (회원 sheet 에서는 숨김). */
  adminOnly?: boolean;
}

export const HOME_WIDGETS: readonly HomeWidgetMeta[] = Object.freeze([
  {
    id: "hero",
    label: "마이복서 153 프로카드",
    description: "내 캐릭터·리그 뱃지·다음 승급까지 XP",
  },
  {
    id: "todayAction",
    label: "QR 체크인",
    description: "QR 체크인 / 도전 시작 / 활성 세션 안내 카드",
  },
  {
    id: "osamiNote",
    label: "오삼 코치 한마디",
    description: "오늘의 코치 메시지",
  },
  {
    id: "rankingPreview",
    label: "명예의 전당 (내 순위)",
    description: "지점 랭킹 내 내 위치 미리보기",
  },
  {
    id: "quickAccess",
    label: "퀵 액세스",
    description: "오늘 미션 / 챌린지 / 이번 주 진행 미니 칩",
  },
  {
    id: "masterTrack",
    label: "마스터 로드 진행도",
    description: "블랙 Lv10 + 보스 4회 클리어 이후에 해금",
    conditional: true,
  },
  {
    id: "storyRpg",
    label: "153 스토리 RPG (베타)",
    description: "복서의 길 — 미공개 베타. 관리자만 표시.",
    conditional: true,
    adminOnly: true,
  },
  {
    id: "dietPromo",
    label: "153 다이어트 프로모",
    description: "체지방 제거 21일 챌린지 — 다이어트 활성 시.",
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
]);

// v2: visibility + order 함께 저장. v1 (visibility 만) 데이터는 자동 마이그레이션.
const STORAGE_KEY = "home_layout_v2";
const STORAGE_KEY_LEGACY = "home_layout_v1";

type VisibilityMap = Record<HomeWidgetId, boolean>;

/**
 * 기본 노출 4개 + 나머지는 "더보기" 안 (visibility=false).
 * 회원이 커스터마이즈에서 추가로 켜거나 끄거나, 순서 바꿀 수 있음.
 */
const DEFAULT_VISIBILITY: VisibilityMap = {
  hero: true,            // ① 마이복서 153 프로카드 (최상단)
  todayAction: true,     // ② QR 체크인
  osamiNote: true,       // ③ 오삼 코치 한마디
  rankingPreview: true,  // ④ 명예의 전당
  quickAccess: false,
  masterTrack: false,
  storyRpg: false,
  dietPromo: false,
  todayMission: false,
  weeklyProgress: false,
};

/**
 * 기본 순서 — 위 4개가 정확히 이 순서로 상단에 노출.
 * 나머지는 "더보기" 안에서 이 순서로 노출 (회원이 켜면).
 */
const DEFAULT_ORDER: HomeWidgetId[] = [
  "hero",
  "todayAction",
  "osamiNote",
  "rankingPreview",
  "quickAccess",
  "weeklyProgress",
  "dietPromo",
  "masterTrack",
  "storyRpg",
  "todayMission",
];

interface LayoutStateV2 {
  visibility: VisibilityMap;
  order: HomeWidgetId[];
}

const ALL_IDS: readonly HomeWidgetId[] = HOME_WIDGETS.map((w) => w.id);

/** order 배열이 모든 ID 를 정확히 한 번씩 포함하도록 정규화 (누락은 끝에 추가, 알 수 없는 ID 는 제거). */
function normalizeOrder(input: HomeWidgetId[] | undefined): HomeWidgetId[] {
  const known = new Set<HomeWidgetId>(ALL_IDS);
  const seen = new Set<HomeWidgetId>();
  const cleaned: HomeWidgetId[] = [];
  for (const id of input ?? []) {
    if (known.has(id) && !seen.has(id)) {
      cleaned.push(id);
      seen.add(id);
    }
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) cleaned.push(id);
  }
  return cleaned;
}

/**
 * v2 (visibility + order) 우선 — 없으면 v1 (visibility only) 마이그레이션 후 default order.
 * 누락/오염 키는 조용히 기본값으로 복구.
 */
function loadLayout(): LayoutStateV2 {
  if (typeof window === "undefined") {
    return {
      visibility: { ...DEFAULT_VISIBILITY },
      order: [...DEFAULT_ORDER],
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayoutStateV2>;
      return {
        visibility: { ...DEFAULT_VISIBILITY, ...(parsed.visibility ?? {}) },
        order: normalizeOrder(parsed.order),
      };
    }
    // v1 마이그레이션 — visibility 만 가져오고 default order 사용.
    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<VisibilityMap>;
      return {
        visibility: { ...DEFAULT_VISIBILITY, ...parsed },
        order: [...DEFAULT_ORDER],
      };
    }
  } catch {
    /* fallthrough */
  }
  return {
    visibility: { ...DEFAULT_VISIBILITY },
    order: [...DEFAULT_ORDER],
  };
}

function saveLayout(state: LayoutStateV2) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota 초과 등은 세션 내 메모리 상태만 유지.
  }
}

/**
 * 위젯 표시 여부 + 순서 훅 — homepage 에서 사용.
 * 다른 탭에서 편집한 경우 storage 이벤트로도 반영.
 */
export function useHomeLayout() {
  const [state, setState] = useState<LayoutStateV2>(() => loadLayout());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setState(loadLayout());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: HomeWidgetId) => {
    setState((prev) => {
      const next: LayoutStateV2 = {
        visibility: { ...prev.visibility, [id]: !prev.visibility[id] },
        order: prev.order,
      };
      saveLayout(next);
      return next;
    });
  }, []);

  const setAll = useCallback((next: Partial<VisibilityMap>) => {
    setState((prev) => {
      const merged: LayoutStateV2 = {
        visibility: { ...prev.visibility, ...next },
        order: prev.order,
      };
      saveLayout(merged);
      return merged;
    });
  }, []);

  const moveUp = useCallback((id: HomeWidgetId) => {
    setState((prev) => {
      const idx = prev.order.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev.order];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      const merged: LayoutStateV2 = { visibility: prev.visibility, order: next };
      saveLayout(merged);
      return merged;
    });
  }, []);

  const moveDown = useCallback((id: HomeWidgetId) => {
    setState((prev) => {
      const idx = prev.order.indexOf(id);
      if (idx < 0 || idx >= prev.order.length - 1) return prev;
      const next = [...prev.order];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      const merged: LayoutStateV2 = { visibility: prev.visibility, order: next };
      saveLayout(merged);
      return merged;
    });
  }, []);

  const reset = useCallback(() => {
    const next: LayoutStateV2 = {
      visibility: { ...DEFAULT_VISIBILITY },
      order: [...DEFAULT_ORDER],
    };
    setState(next);
    saveLayout(next);
  }, []);

  const visibleCount = Object.values(state.visibility).filter(Boolean).length;

  return {
    visibility: state.visibility,
    order: state.order,
    toggle,
    setAll,
    moveUp,
    moveDown,
    reset,
    visibleCount,
  };
}
