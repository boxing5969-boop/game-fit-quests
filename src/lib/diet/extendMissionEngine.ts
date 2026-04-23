/**
 * 153 다이어트 · 건강리셋 연장 — 주간 미션 엔진.
 *
 * 입력: pattern_tags (상위 우선순위 2개까지) + week_index (1 또는 2)
 * 출력: 이번 주 미션 6개 이내
 *
 * 규칙:
 *   1. COMMON_MISSIONS 을 1개 우선 포함 (주차별로 다름)
 *   2. pattern_tags 중 primaryPattern + 두 번째 태그의 해당 주차 미션을 병합
 *   3. code 중복 제거
 *   4. 최대 6개 (UI 스크롤 최소화)
 */

import type { PostMission } from "@/data/postProgramMissions";
import { COMMON_MISSIONS, EXTEND_PLAYBOOK } from "@/data/extendPlaybooks";
import {
  primaryPattern,
  type ExtendPatternTag,
} from "./extendPatternEngine";

export function pickWeeklyMissions(
  patternTags: ExtendPatternTag[],
  weekIndex: 1 | 2,
): PostMission[] {
  const collected: PostMission[] = [];

  // 1) 공통 1개
  const common = COMMON_MISSIONS[weekIndex];
  if (common.length > 0) collected.push(common[0]);

  // 2) 1순위 패턴 플레이북 전체
  const prim = primaryPattern(patternTags);
  if (prim) {
    collected.push(...EXTEND_PLAYBOOK[prim][weekIndex]);
  }

  // 3) 2순위 패턴에서 2개까지 (있으면)
  const secondary = patternTags.find((t) => t !== prim);
  if (secondary) {
    collected.push(...EXTEND_PLAYBOOK[secondary][weekIndex].slice(0, 2));
  }

  // 4) 중복 제거 + 상한 6
  const seen = new Set<string>();
  const unique: PostMission[] = [];
  for (const m of collected) {
    if (seen.has(m.code)) continue;
    seen.add(m.code);
    unique.push(m);
    if (unique.length >= 6) break;
  }

  // 5) 최소 안전장치 — 아무 패턴도 없으면 공통만으로 채움
  if (unique.length === 0) {
    return COMMON_MISSIONS[weekIndex];
  }

  return unique;
}
