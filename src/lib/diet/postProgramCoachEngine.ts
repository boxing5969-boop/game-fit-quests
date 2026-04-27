/**
 * 153 다이어트 — 사후 프로그램(유지/연장) 데드라인·목표·오삼 코치 피드백 엔진.
 *
 * 책임:
 *   1. plan 으로부터 cycle 데드라인 계산 (extend) / 다음 체크 시점 (maintenance)
 *   2. 회원 입력 목표 + 진행 상황을 보고 오삼 코치 동적 피드백 텍스트 생성
 *
 * 보호 함수와 분리:
 *   - scoreEngine / ruleEngine / mealAnalyzer / missionTemplates — 미참조.
 *   - questMessageEngine 의 톤 규칙(친절·죄책감 금지·구체 제안)을 따름.
 */

import type { DietPostProgramPlan } from "@/lib/diet/postProgramTypes";

// ──────────────────────────────────────────────────────────────────
// 데드라인 계산
// ──────────────────────────────────────────────────────────────────

export interface DeadlineInfo {
  /** 종료(또는 다음 체크) 일자. null 이면 plan 시작 시각 미기록 등 사유. */
  endsAt: Date | null;
  /** 오늘 기준 남은 일수 (음수 = 이미 지남). */
  daysRemaining: number | null;
  /** UI 표시용 "YYYY-MM-DD". */
  endsAtIso: string | null;
  /** "끝남"/"오늘"/"D-N" 형태 라벨. */
  label: string;
}

/**
 * 연장 모드 데드라인 — extend_started_at + extension_cycle_length 일.
 *   기록 없으면 next_cycle_start_date 또는 selected_at + 14일을 기본값으로.
 */
export function computeExtendDeadline(plan: DietPostProgramPlan): DeadlineInfo {
  const startIso = plan.extend_started_at ?? plan.selected_at;
  if (!startIso) {
    return {
      endsAt: null,
      daysRemaining: null,
      endsAtIso: null,
      label: "데드라인 미설정",
    };
  }
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return {
      endsAt: null,
      daysRemaining: null,
      endsAtIso: null,
      label: "데드라인 미설정",
    };
  }
  const cycle = plan.extension_cycle_length === 21 ? 21 : 14;
  const end = new Date(start);
  end.setDate(end.getDate() + cycle);
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffMs = endMid.getTime() - todayMid.getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  const iso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const label =
    days < 0 ? "사이클 종료 — 코치와 다음 단계 상의" : days === 0 ? "오늘 마감" : `D-${days}`;
  return { endsAt: end, daysRemaining: days, endsAtIso: iso, label };
}

/**
 * 유지 모드 — 정해진 종료일은 없음. 대신 "이번 주 체크" 까지 남은 일수.
 *   주간 체크는 매주 일요일 23:59 KST 가정.
 */
export function computeMaintenanceWeeklyCheckDeadline(): DeadlineInfo {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 0=일, 1=월, ..., 6=토 → 다음 일요일까지의 거리
  const dow = today.getDay();
  const daysUntilSunday = dow === 0 ? 7 : 7 - dow;
  const end = new Date(today);
  end.setDate(end.getDate() + daysUntilSunday);
  const iso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return {
    endsAt: end,
    daysRemaining: daysUntilSunday,
    endsAtIso: iso,
    label: daysUntilSunday === 0 ? "오늘 마감" : `D-${daysUntilSunday}`,
  };
}

// ──────────────────────────────────────────────────────────────────
// 오삼 코치 동적 피드백
//   plan + 입력 목표 + 진행 상황을 보고 1~2 문장 생성.
//   톤 규칙: 친절·긍정·구체 제안. 죄책감/벌점/극단 제한 금지.
// ──────────────────────────────────────────────────────────────────

export interface PostProgramFeedbackInput {
  plan: DietPostProgramPlan;
  /** 현재 체중(kg) — 옵션. 입력 시 maintenance 범위 비교에 사용. */
  currentWeightKg?: number | null;
  /** 현재 허리(cm) — 옵션. */
  currentWaistCm?: number | null;
  /** 최근 7일 수행률(0~100). 옵션. */
  recentAdherence7d?: number | null;
}

export function buildPostProgramFeedback(
  input: PostProgramFeedbackInput,
): string {
  const { plan } = input;

  // 1) 유지 모드
  if (plan.selected_path === "maintenance") {
    const target = plan.maintenance_target_weight_kg;
    const range = plan.maintenance_range_kg ?? 1.5;
    const cur = input.currentWeightKg ?? null;
    if (target != null && cur != null) {
      const diff = cur - target;
      const absDiff = Math.abs(diff);
      if (absDiff <= range) {
        return `목표 ${target.toFixed(1)}kg ±${range.toFixed(1)} 범위 안이에요. 이 페이스만 유지하면 충분합니다. 회원님, 화이팅이에요.`;
      }
      if (diff > range) {
        return `목표보다 ${diff.toFixed(1)}kg 위에요. 무리하게 줄이지 말고 야식 끊기 + 물 1.5L 부터 한 가지만 다시 잡아봐요.`;
      }
      // 아래로 벗어남 — 유지 회원에게 더 마르라고 권하지 않음
      return `목표보다 ${absDiff.toFixed(1)}kg 아래예요. 유지 회원은 더 빼는 것보다 단백질·수면을 챙기는 쪽이 좋아요.`;
    }
    if (target == null) {
      return `유지 기준 체중을 아직 설정 전이에요. 위에서 한 번 입력해 두면 코치가 매일 가볍게 비교해 드릴게요.`;
    }
    return `목표 ${target.toFixed(1)}kg ±${range.toFixed(1)} 유지 중. 주 1회 체중·허리만 가볍게 체크해도 충분합니다.`;
  }

  // 2) 연장 모드
  if (plan.selected_path === "extend") {
    const dl = computeExtendDeadline(plan);
    const adherence = input.recentAdherence7d ?? null;
    const dlPart =
      dl.daysRemaining != null
        ? dl.daysRemaining < 0
          ? "사이클이 끝났어요. 결과를 한 번 정리하고 다음 단계로 넘어가요."
          : dl.daysRemaining === 0
            ? "오늘이 사이클 마감일이에요. 마지막 체크인까지 가볍게 마무리해요."
            : `사이클 마감까지 ${dl.daysRemaining}일 남았어요.`
        : `사이클 데드라인을 설정하면 페이스가 더 명확해져요.`;
    if (adherence != null) {
      if (adherence >= 80) {
        return `${dlPart} 최근 수행률 ${adherence}% — 흐름이 좋아요. 이 페이스 그대로 가요.`;
      }
      if (adherence >= 60) {
        return `${dlPart} 최근 수행률 ${adherence}% — 핵심 미션 한 가지만 더 잡으면 흐름이 살아나요.`;
      }
      return `${dlPart} 최근 수행률 ${adherence}% — 무너졌다고 보지 말고, 오늘 한 가지만 다시 체크해요.`;
    }
    return `${dlPart} 매일 핵심 미션 1개부터 가볍게 짚고 가요.`;
  }

  // 3) pending
  return `위에서 두 갈래 중 한 가지를 골라봐요. 어느 쪽이든 21일 동안 만든 리듬을 이어가는 길입니다.`;
}

// ──────────────────────────────────────────────────────────────────
// NextStepChooser 단계용 — 입력값 기반 즉시 피드백 (저장 전)
// ──────────────────────────────────────────────────────────────────

export interface ChooserPreviewInput {
  path: "maintenance" | "extend" | "pending";
  /** 유지: 입력한 목표 체중. */
  maintenanceTargetWeightKg?: number | null;
  /** 연장: 14 또는 21일 사이클. */
  extensionCycleLength?: 14 | 21;
  /** 연장: 사이클 안에 도달하고 싶은 체중. */
  extensionTargetWeightKg?: number | null;
  /** 현재 체중 (둘 다에서 활용). */
  currentWeightKg?: number | null;
}

/** 회원 입력값을 보고 저장 전에 미리 보여줄 오삼 코치 한 줄 피드백. */
export function buildChooserPreviewFeedback(
  input: ChooserPreviewInput,
): string {
  if (input.path === "pending") {
    return "두 갈래 중 어느 쪽이 더 끌리는지 골라봐요. 어느 쪽이든 코치가 옆에서 페이스 맞춰드릴게요.";
  }
  if (input.path === "maintenance") {
    const t = input.maintenanceTargetWeightKg;
    if (t == null) {
      return "유지 기준 체중·허리를 한 번 입력해 두면, 매주 가볍게 비교해 드려요.";
    }
    if (input.currentWeightKg != null) {
      const diff = input.currentWeightKg - t;
      if (Math.abs(diff) <= 1.5) {
        return `현재 ${input.currentWeightKg.toFixed(1)}kg → 목표 ${t.toFixed(1)}kg 범위 안이에요. 좋아요, 그대로 출발할게요.`;
      }
      if (diff > 0) {
        return `현재 ${input.currentWeightKg.toFixed(1)}kg → 목표보다 ${diff.toFixed(1)}kg 위. 유지 모드로 천천히 회복해도 충분해요.`;
      }
    }
    return `목표 ${t.toFixed(1)}kg 으로 설정. 주 1회 체크만 해도 흐름이 잡힙니다.`;
  }
  // extend
  const cycle = input.extensionCycleLength ?? 14;
  const t = input.extensionTargetWeightKg ?? null;
  const cur = input.currentWeightKg ?? null;
  if (t != null && cur != null) {
    const drop = cur - t;
    if (drop <= 0) {
      return `${cycle}일 사이클 — 이미 목표 근처거나 아래라면 유지 모드가 더 맞을 수 있어요. 코치와 한 번 상의해 봐요.`;
    }
    const safePerWeek = 0.7; // kg/주 권장 상한
    const weeks = cycle / 7;
    const safeMaxDrop = safePerWeek * weeks;
    if (drop > safeMaxDrop * 1.4) {
      return `${cycle}일 안에 ${drop.toFixed(1)}kg 감량은 다소 빠른 편이에요. 더 안전한 페이스로 ${safeMaxDrop.toFixed(1)}kg 정도가 권장됩니다.`;
    }
    if (drop > safeMaxDrop) {
      return `${cycle}일 동안 ${drop.toFixed(1)}kg — 빠듯하지만 가능. 야식·당음료부터 잡고 출석을 ${Math.ceil(weeks * 3)}회 이상 챙겨봐요.`;
    }
    return `${cycle}일 동안 ${drop.toFixed(1)}kg — 안전한 페이스예요. 핵심 미션 그대로 이어가면 충분합니다.`;
  }
  if (t != null) {
    return `${cycle}일 사이클 + 목표 ${t.toFixed(1)}kg 설정. 현재 체중까지 입력하면 페이스를 정확히 안내해 드릴게요.`;
  }
  return `${cycle}일 사이클로 진행. 목표 체중까지 입력해 두면 데드라인 안에 페이스를 맞춰드려요.`;
}
