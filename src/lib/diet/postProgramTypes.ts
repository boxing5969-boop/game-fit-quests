/**
 * 153 다이어트 · 21일 종료 후 분기 타입.
 *
 * types.ts 자동 생성 타입이 아직 이 테이블을 반영하기 전이어도 UI 가 동작하도록
 * 커스텀 타입을 여기에 정의. 마이그레이션 반영 후 Supabase 타입이 업데이트되면
 * 이 모듈은 그대로 둬도 호환 가능 (단, 이름 충돌 없게 Post* 네임스페이스 사용).
 */

export type DietPostProgramPath = "pending" | "maintenance" | "extend";

export type DietPostProgramRecommendation =
  | "maintenance"
  | "extend"
  | "either";

export type DietPostProgramFollowUp =
  | "pending"
  | "active"
  | "paused"
  | "abandoned"
  | "succeeded";

/** 21일 종료 시점에 서버가 캡쳐해 둔 요약. completion_summary jsonb 와 1:1. */
export interface DietPostProgramSummary {
  start_date: string;
  end_date: string;
  approved_days: number;
  pending_days: number;
  checkin_rate: number;      // %
  attendance_rate: number;   // %
  habit_score: number;       // 0~100
  best_streak: number;
  best_habit: string | null;
  weakest_habit: string | null;
}

export interface DietPostProgramPlan {
  id: string;
  enrollment_id: string;
  user_id: string;
  completion_summary: DietPostProgramSummary;
  target_achieved: boolean | null;
  recommended_path: DietPostProgramRecommendation;
  selected_path: DietPostProgramPath;
  selected_at: string | null;
  maintenance_target_weight_kg: number | null;
  maintenance_range_kg: number;
  maintenance_waist_target_cm: number | null;
  maintenance_waist_range_cm: number;
  regain_alert_threshold_kg: number;
  extension_cycle_length: 14 | 21;
  extension_cycle_index: number;
  next_cycle_start_date: string | null;
  coach_recommendation_note: string | null;
  coach_recommended_path: DietPostProgramRecommendation | null;
  coach_recommended_by: string | null;
  coach_recommended_at: string | null;
  follow_up_status: DietPostProgramFollowUp;
  // 11단계 · 연장 심화 필드
  reassessment: DietExtendReassessment | null;
  pattern_tags: string[];
  extend_goals: DietExtendGoals | null;
  extend_started_at: string | null;
  extend_ended_at: string | null;
  extend_result: DietExtendResult | null;
  created_at: string;
  updated_at: string;
}

export type DietExtendResult =
  | "maintenance_transition"
  | "extend_again"
  | "coach_consult";

export interface DietExtendReassessment {
  recent_21d_adherence: number;
  weakest_habit: string;
  weekly_workouts: number;
  sleep_hours: number;
  eating_out_weekly: number;
  late_binge_weekly: number;
  biggest_obstacle:
    | "late_binge"
    | "eating_out"
    | "weekend_crash"
    | "sleep_short"
    | "stress"
    | "other";
  submitted_at?: string;
}

export interface DietExtendGoals {
  weight_kg_target: number | null;
  waist_cm_target: number | null;
  weekly_workouts_target: number;
  weekly_checkin_rate_target: number;   // 0~100
  sleep_hours_target: number;
  weekend_defense_target: number;        // 주말 지켜낸 일수 목표 0~2
}

export interface DietPostProgramCheckin {
  id: string;
  plan_id: string;
  user_id: string;
  week_index: number;
  checkin_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  adherence_score: number | null;
  flexible_meals_count: number;
  late_binge_count: number;
  attended_workouts: number;
  protein_first_days: number;
  needs_recovery: boolean;
  recovery_reason: string | null;
  reflection: string | null;
  created_at: string;
}

/** 5 습관 한글 라벨 — best/weakest 표시용. */
export const DIET_HABIT_LABEL_KO: Record<string, string> = {
  protein_first: "단백질 먼저 먹기",
  veggies_natural: "자연 그대로 채소",
  sugary_drink_avoided: "당 음료 피하기",
  late_night_snack_avoided: "늦은 야식 피하기",
  gym_attended: "복싱 출석",
};
