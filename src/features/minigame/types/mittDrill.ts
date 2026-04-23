import { PunchType } from './game';

// ===== MITT DRILL (STAGE-CLEAR) TYPES =====

export interface StepResult {
  punch: PunchType;
  inputPunch: PunchType | null;
  correct: boolean;
  reactionMs: number;
  timestamp: number;
}

// 라운드별 집계 결과 (UI 표시용)
export interface DrillResult {
  comboId: string;        // "ROUND 1" 같은 라벨
  stepResults: StepResult[];
  completed: boolean;     // 라운드 클리어 여부
  avgReaction: number;
  accuracy: number;
}

export interface MittSessionResult {
  playerName: string;
  score: number;
  totalCombos: number;     // best combo
  completedCombos: number; // perfect 횟수
  avgReaction: number;
  bestReaction: number;
  accuracy: number;
  totalSteps: number;
  correctSteps: number;
  drillResults: DrillResult[];
  date: string;
  round: number;           // 도달 라운드
}

// ===== EDUCATION 화면용 참고 콤보 데이터 =====
export interface DrillStep {
  punch: PunchType;
  label: string;
}
export interface DrillCombo {
  id: string;
  name: string;
  nameKo: string;
  steps: DrillStep[];
  difficulty: 1 | 2 | 3;
}

export const DRILL_COMBOS: DrillCombo[] = [
  { id: 'basic-12',         name: 'Basic 1-2',           nameKo: '기본 원투',     difficulty: 1, steps: [{ punch: 'jab', label: '원!' }, { punch: 'straight', label: '투!' }] },
  { id: 'jab-jab-straight', name: 'Double Jab Straight', nameKo: '더블잽 스트레이트', difficulty: 1, steps: [{ punch: 'jab', label: '원!' }, { punch: 'jab', label: '원!' }, { punch: 'straight', label: '투!' }] },
  { id: '12-hook',          name: '1-2 Hook',            nameKo: '원투 훅',       difficulty: 2, steps: [{ punch: 'jab', label: '원!' }, { punch: 'straight', label: '투!' }, { punch: 'hook', label: '훅!' }] },
  { id: '12-hook-upper',    name: '1-2 Hook Upper',      nameKo: '원투 훅 어퍼',   difficulty: 2, steps: [{ punch: 'jab', label: '원!' }, { punch: 'straight', label: '투!' }, { punch: 'hook', label: '훅!' }, { punch: 'upper', label: '어퍼!' }] },
  { id: 'speed-combo',      name: 'Speed Combo',         nameKo: '스피드 콤보',     difficulty: 3, steps: [{ punch: 'jab', label: '원!' }, { punch: 'jab', label: '원!' }, { punch: 'straight', label: '투!' }, { punch: 'hook', label: '훅!' }, { punch: 'upper', label: '어퍼!' }] },
  { id: 'pro-combo',        name: 'Pro Combination',     nameKo: '프로 콤비네이션', difficulty: 3, steps: [{ punch: 'jab', label: '원!' }, { punch: 'straight', label: '투!' }, { punch: 'jab', label: '원!' }, { punch: 'hook', label: '훅!' }, { punch: 'straight', label: '투!' }, { punch: 'upper', label: '어퍼!' }] },
];
