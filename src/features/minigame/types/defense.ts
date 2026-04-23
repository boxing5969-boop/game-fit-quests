export type DefenseSide = 'L' | 'R';

export type AttackKind = 'jab' | 'hook' | 'feint' | 'rush';

export interface IncomingAttack {
  id: number;
  side: DefenseSide;        // 진짜 도착 방향 (페인트는 반대)
  kind: AttackKind;
  spawnedAt: number;        // performance.now()
  arriveAt: number;         // 도착 시각
  feintCancelAt?: number;   // 페인트가 사라지는 시각
  feintShownSide?: DefenseSide; // 처음 보이는 가짜 방향
  resolved?: boolean;
}

export type DefensePhase = 'home' | 'playing' | 'counter' | 'boss' | 'gameover';

export type Judgement = 'perfect' | 'good' | 'miss';

export type ItemKind = 'shield' | 'focus' | 'adrenaline';

export interface DefenseRunStats {
  score: number;
  bestCombo: number;
  perfectCount: number;
  goodCount: number;
  totalAttacks: number;
  counterTimes: number;
  counterHits: number;
  bossClears: number;
  startedAt: number;
  endedAt?: number;
  survivedMs: number;       // 최종 생존 시간 (gameover 시 확정)
  // ===== 라운드 / 보호 아이템 =====
  roundReached: number;      // 이번 판 도달 라운드 (1부터 시작)
  defenseInRound: number;    // 현재 라운드에서 누적된 방어 성공 수
  shieldsCollected: number;  // 이번 판 획득한 실드 수 (총)
  shieldsSaved: number;      // 이번 판 실드로 살아난 횟수
  // ===== 피버 / 아이템 =====
  feverCount: number;        // 이번 판 피버 진입 횟수
  focusUses: number;         // Focus 발동 횟수
  adrenalineUses: number;    // Adrenaline 발동 횟수
}

export interface DailyMission {
  id: string;
  label: string;
  goal: number;
  current: number;
  done: boolean;
}
