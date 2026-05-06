# 153 스토리 RPG — Stage 47B 프롬프트 (전투 비주얼 오버홀 + 게임 밸런스 패치)

> Claude Code 에 그대로 복붙. **전투 화면을 진짜 게임처럼** 만들고, **현재 막혀있는 밸런스 함정 (집중 회복 부재, 적 HP 과도)** 을 동시에 푼다.

---

## 사용법

1. Claude Code 새 세션 열기
2. 아래 코드 블록 (` ``` ` 안) 전체 복사 → 실행
3. 작업 시간: ~5-6시간
4. **새 마이그레이션 1개** 생성 → PowerShell 클립보드 → Supabase SQL Editor 수동 실행
5. `bun run build` ✓ + 손스모크 → push

---

## 47B 가 채울 격차

| 현재 (47A 까지) | 47B 후 |
|---|---|
| 전투 화면: 정적 적 SVG + 액션 버튼 + 텍스트 로그 | 플레이어 복서 캐릭터 (5 포즈) + 11 적별 unique SVG + 공격 애니메이션 + 피격 흔들기 + 데미지 popup |
| 적 HP 150 vs 잽 15 (회원 초반) — 통과 불가능 | 가드 시 집중 +2 / 풋워크 시 집중 +1 회복 + 적 HP 적정 조정 |
| 액션은 즉시 결과만 표시 | jab 슬라이드 / guard arc / footwork dust / counter slow-mo / 오삼이 popup 모션 |
| 카드 사용 = 인벤토리 패널만 | 카드 날아오는 연출 + shimmer + 효과 텍스트 popup |
| 승리/패배 = 텍스트 | 승리 cinematic (배경 amber 광선 + 보상 표시) / 패배 페이드 |

---

## Stage 47B 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 의 전투 비주얼 오버홀 + 게임 밸런스 패치를 담당하는 시니어 React 게임 UI 개발자 + Postgres 개발자다.

이번 작업은 47B 단계다.
목표:
1. 전투 화면 (StoryBattleEngine) 을 정적 → 동적 게임 UI 로 교체:
   · 플레이어 복서 SVG 캐릭터 (5+ 포즈: idle / jab / guard / footwork / counter / hurt / victory)
   · 11 적 unique SVG (게으름 슬라임 / 가드 브레이커 / 긴장 늑대 / 과훈련 골렘 / 마스터의 문 / 루틴 파괴자 / 비교 괴물 / 그림자 라이벌 / 캠프 가드 / 군중 환각 / 자기 의심)
   · 5 공격 애니메이션 (jab 슬라이드 / guard arc / footwork dust / counter slow-mo / 오삼이 popup)
   · 피격 흔들기 (CameraShake) + 플래시 (FlashOverlay) + 데미지 popup
   · 카드 사용 연출 (카드 날아오기 + shimmer + 효과 텍스트)
   · 승리 / 패배 cinematic
2. 게임 밸런스 패치 (마이그레이션 1개):
   · submit_player_command RPC 수정 — 가드 시 집중 +2, 풋워크 시 집중 +1 회복 (호흡 정비)
   · boxing_story_enemies.hp 적정 조정 (회원 초반 능력치 대비 균형)
3. 새 npm 패키지 0건. 외부 이미지 fetch 0건 (모든 SVG inline).
4. ChatAssistant / chat-assistant Edge / 보호 영역 절대 미수정.

보호 원칙:
1. levels / missions / mission_videos / mission_submissions / member_progress 절대 미수정
2. approve_mission_submission / record_attendance 호출 금지
3. 공식 XP 미지급. wallet 직접 update 금지 (real_gems 보상은 RPC 안 grant_gems 가)
4. 새 RPC 작성 시 SECURITY DEFINER + search_path 'public' 패턴
5. ChatAssistant / chat-assistant Edge / boxing SYSTEM_PROMPT 미수정

절대 수정 금지:
- src/components/ChatAssistant.tsx
- supabase/functions/** (전체)
- src/integrations/supabase/types.ts (자동 생성)
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- MissionsPage / RankUpPage / LevelAdminPanel / LiveBoardPage
- src/data/allLevelsData.ts / whiteLevel1Data / sharedConstants
- external/naver-talktalk/** / supabase/functions/talktalk-*/**
- 기존 47A 비주얼 자산 (visuals/backgrounds/*, visuals/portraits/*, visuals/icons/*, visuals/effects/*) — 재사용만 하고 수정 X
- 기존 Stage 45 의 7 테이블 schema 변경 X (마스터 데이터 row 만 UPDATE)

═══════════════════════════════════════════════════════════════════
0. 먼저 할 일 (Read 도구)
═══════════════════════════════════════════════════════════════════

1. src/components/story-rpg/StoryBattleEngine.tsx — 현재 전투 흐름 / 5 액션 버튼 / submit_player_command 호출 패턴
2. src/components/story-rpg/visuals/effects/CameraShake.tsx + FlashOverlay.tsx (47A — 재사용)
3. src/components/story-rpg/visuals/portraits/CharacterPortrait.tsx (47A — 플레이어 portrait 재사용 가능)
4. src/components/story-rpg/visuals/backgrounds/SceneBackground.tsx (47A — 배경 테마 재사용)
5. supabase/migrations/20260707000000_boxing_story_rpg_independent_game.sql — submit_player_command RPC 시그니처 + boxing_story_enemies seed (11 종)
6. docs/153-story-rpg-game-scenario.md §6 적 마스터 데이터 표 (참고용)
7. src/types/storyRpg.ts — BattleCommand / BattleCommandResult / StoryEnemy 타입

═══════════════════════════════════════════════════════════════════
1. 신규 비주얼 자산 디렉터리
═══════════════════════════════════════════════════════════════════

src/components/story-rpg/visuals/battle/
  ├─ PlayerBoxer.tsx              // 플레이어 복서 SVG (5+ 포즈, route 별 색)
  ├─ EnemySvg.tsx                 // 11 적별 unique SVG (단일 컴포넌트, code 별 분기)
  ├─ enemyVariants.ts             // enemy code → SVG variant 매핑
  ├─ BattleArena.tsx              // 배경 + 플레이어/적 위치 합성
  ├─ AttackAnimation.tsx          // 5 공격 모션 (jab/guard/footwork/counter/osam_advice)
  ├─ DamagePopup.tsx              // 데미지 숫자 떠오르기
  ├─ HitEffect.tsx                // 충격파 + 플래시 + sparkles
  ├─ CardUseEffect.tsx            // 카드 발동 모션
  ├─ VictoryFanfare.tsx           // 승리 cinematic
  └─ DefeatScreen.tsx             // 패배 화면 + 재도전 버튼

═══════════════════════════════════════════════════════════════════
2. PlayerBoxer.tsx — 플레이어 복서 SVG 캐릭터
═══════════════════════════════════════════════════════════════════

props: {
  pose: 'idle' | 'jab' | 'guard' | 'footwork' | 'counter' | 'hurt' | 'victory';
  routeColor?: 'master' | 'pro' | 'champion';  // 옷 색
  facing?: 'right';
  size?: 'sm' | 'md' | 'lg';
}

SVG 구조 (200x240 viewBox):
- 머리: skin tone + 헤드밴드 (route 별 색 — master amber / pro orange / champion red)
- 몸통: T-shirt 스타일 + 153 로고
- 글러브 양손: 둥근 SVG (route 색)
- 다리 + 부츠: 검은 스파링 슈즈
- 그림자: 발 아래 ellipse

pose 별 차이:
- idle: 양 글러브 가슴 앞 + 위아래 1px bob (1.4s)
- jab: 오른 글러브 앞으로 80% 뻗음 + 몸 살짝 앞으로 + 0.3s 후 idle 복귀
- guard: 양 글러브 얼굴 앞 모음 + 몸 살짝 웅크림
- footwork: 다리 widely + 지면에 dust 4-5 점 + 약간 앞으로 슬라이드
- counter: 몸 살짝 뒤로 → 빠르게 앞으로 + 큰 글러브 휘두르기 + slow-mo (frame 0.6s 유지)
- hurt: 몸 우측으로 기울 + 별 ✶ 머리 위
- victory: 양 글러브 위로 들어올림 + 점프 (10px)

framer-motion 사용:
- 각 pose 는 motion.svg 의 variants 로 정의
- pose 변경 시 0.2-0.4s transition

═══════════════════════════════════════════════════════════════════
3. EnemySvg.tsx + enemyVariants.ts — 11 적 SVG
═══════════════════════════════════════════════════════════════════

enemyVariants.ts:
export type EnemyVariant =
  | 'lazy_slime'           // 게으름 슬라임 — 회색 슬라임 + 졸린 눈 + 침
  | 'guard_breaker'        // 가드 브레이커 — 거대한 망치 들고 있는 인영
  | 'tension_wolf'         // 긴장 늑대 — 회색 늑대 + 빨간 눈 + 칼날 입
  | 'overtraining_golem'   // 과훈련 골렘 — 청회색 로봇 + 빨간 눈 + 균열
  | 'master_door'          // 마스터의 문 — 거대한 자물쇠 + 빛나는 눈
  | 'routine_breaker'      // 루틴 파괴자 — 깨진 시계 + 톱니바퀴 인영
  | 'compare_monster'      // 비교 괴물 — 거울 표면 + 일그러진 자기 모습
  | 'shadow_rival'         // 그림자 라이벌 — 검은 실루엣 + 빨간 눈 (보스급)
  | 'camp_guard'           // 캠프 가드 — 모닥불 옆 거구 가드
  | 'crowd_illusion'       // 군중 환각 — 일그러진 얼굴들의 실루엣
  | 'self_doubt';          // 자기 의심 — 안개 속 흐릿한 자기 모습

export const ENEMY_CODE_TO_VARIANT: Record<string, EnemyVariant> = {
  lazy_slime: 'lazy_slime',
  guard_breaker: 'guard_breaker',
  tension_wolf: 'tension_wolf',
  overtraining_golem: 'overtraining_golem',
  master_door: 'master_door',
  routine_breaker: 'routine_breaker',
  compare_monster: 'compare_monster',
  shadow_rival: 'shadow_rival',
  camp_guard: 'camp_guard',
  crowd_illusion: 'crowd_illusion',
  self_doubt: 'self_doubt',
  // 추가 fallback — Stage 44 시나리오에 더 많은 적이 있을 수 있음
};

EnemySvg.tsx props:
- variant: EnemyVariant
- pose?: 'idle' | 'attack' | 'hurt' | 'defeated'
- isBoss?: boolean (보스면 1.5x 크기)
- size?: 'sm'|'md'|'lg'

각 적 SVG:
- 200x240 viewBox 기본 (보스는 240x300)
- idle: 위아래 부유 (1.5s) 또는 좌우 흔들 (3s)
- attack: 0.4s 동안 앞으로 슬라이드 + 위협 포즈
- hurt: x: [-4,4,-3,3,0] 흔들 (0.2s) + 빨간 tint overlay
- defeated: opacity 1 → 0 (0.6s) + 회색조 + 위에서 내려옴

각 변형 SVG 구체적 묘사:

A. lazy_slime: 둥근 회색 (#8a9da5) 덩어리 + 위 양 졸린 눈 (반쯤 감김) + 침 한 방울 떨어지기 애니메이션
B. guard_breaker: 검은 hood 인영 + 큰 회색 망치 + 빨간 inner glow
C. tension_wolf: 회색 늑대 머리 + 빨간 눈 + 송곳니 + idle 시 으르렁 (입 살짝 벌림)
D. overtraining_golem: 청회색 로봇 + 빨간 눈 슬릿 + 가슴에 균열 + 매 2초 균열 빛남
E. master_door: 거대 문 + 자물쇠 + 자물쇠 안에 노란 빛 + 보스 (1.5x)
F. routine_breaker: 깨진 시계 머리 + 톱니바퀴 어깨 + 시침 흔들리기
G. compare_monster: 거울 형태 + 안에 흐릿한 사람 모양 + idle 시 모양 바뀜
H. shadow_rival: 검은 실루엣 + 빨간 눈 + 글러브 (보스급 1.5x)
I. camp_guard: 모닥불 옆 거구 + 양 글러브 + idle 시 발 구르기
J. crowd_illusion: 5-7 작은 얼굴 실루엣들 + 모두 같은 표정으로 비웃기
K. self_doubt: 안개 (semi-transparent ellipse) 속 자기 모습 (PlayerBoxer 의 회색조 버전)

═══════════════════════════════════════════════════════════════════
4. BattleArena.tsx — 전체 합성
═══════════════════════════════════════════════════════════════════

props: {
  enemy: { code: string; name: string; hp: number; max_hp: number; is_boss?: boolean };
  player: { hp: number; hp_max: number; focus: number; focus_max: number };
  routeColor?: 'master' | 'pro' | 'champion';
  backgroundTheme?: SceneBackgroundTheme;  // 47A 의 SceneBackground 재사용
  playerPose: PlayerPose;
  enemyPose: 'idle' | 'attack' | 'hurt' | 'defeated';
  shakeKey: number;     // CameraShake 트리거
  flashKey: number;     // FlashOverlay 트리거
  flashColor?: 'white' | 'red' | 'amber';
  damagePopups: Array<{ id: string; x: number; y: number; value: number; isCrit: boolean; isWeakness: boolean }>;
}

레이아웃:
- 16:10 또는 4:3 박스, mx-auto max-w-md md:max-w-2xl
- 배경: SceneBackground (47A 재사용) — battle 씬의 background_theme 또는 'gym_ring' 기본
- 적: 상단 중앙 (top: 15%)
- 플레이어: 하단 좌측 (bottom: 15%, left: 25%)
- 적/플레이어 사이에 가상 link (공격 시 이동 경로)
- damagePopups: motion.span absolute 좌표, 위로 떠오르며 페이드 (0.6s)
- CameraShake 로 전체 박스 감싸기

═══════════════════════════════════════════════════════════════════
5. AttackAnimation.tsx — 5 공격 모션
═══════════════════════════════════════════════════════════════════

props: {
  command: 'jab' | 'guard' | 'footwork' | 'counter' | 'osam_advice' | null;
  onComplete: () => void;
}

각 command 별 0.5-0.8s 시퀀스:

A. jab:
  1. PlayerBoxer pose='jab' (글러브 뻗음)
  2. 글러브에서 적 머리까지 가는 white streak (0.2s)
  3. 적 적중 시 작은 white flash + DamagePopup
  4. PlayerBoxer 0.3s 후 idle

B. guard:
  1. PlayerBoxer pose='guard' (모음)
  2. 플레이어 앞에 amber arc (1/4 circle SVG, 0.3s 페이드)
  3. 0.4s 유지 후 idle

C. footwork:
  1. PlayerBoxer pose='footwork' + 살짝 우측으로 슬라이드 (50px)
  2. 발 아래 dust 점 4-5개 (위로 흩날림, 0.5s)
  3. 0.3s 후 idle 복귀

D. counter:
  1. 화면 전체 slow-mo 효과 (filter: contrast 1.3 brightness 0.8, 0.3s)
  2. PlayerBoxer pose='counter' + 큰 글러브 휘두르기
  3. 적 적중 시 빨간 flash + 큰 DamagePopup (isCrit=true)
  4. CameraShake hard
  5. 0.4s 후 idle

E. osam_advice:
  1. 우측 상단에서 작은 오삼이 mascot popup (CharacterPortrait osam, size sm)
  2. 말풍선: "이렇게 해보세요!" (또는 RPC 응답의 narration)
  3. 1.2s 유지 후 페이드 아웃
  4. PlayerBoxer 는 idle 유지

═══════════════════════════════════════════════════════════════════
6. DamagePopup.tsx + HitEffect.tsx + CardUseEffect.tsx + VictoryFanfare.tsx + DefeatScreen.tsx
═══════════════════════════════════════════════════════════════════

A. DamagePopup
   props: { x: number; y: number; value: number; isCrit?: boolean; isWeakness?: boolean }
   - motion.span fixed (absolute) 좌표
   - text: -N (예: -37)
   - color:
     · 일반: white
     · weakness 적중 (적 weakness 매칭): yellow + bold
     · crit (counter): red + 큰 글씨 (text-2xl)
   - animation: y -50, opacity 1 → 0 (0.7s)

B. HitEffect
   props: { x: number; y: number; kind: 'normal' | 'crit' | 'weakness' }
   - 충격파 (3 동심원, scale 0 → 1.5 + opacity 1 → 0, 0.3s)
   - kind 별 색상 (normal=white / crit=red / weakness=amber)

C. CardUseEffect
   props: { card: { code: string; name: string }; onComplete: () => void }
   - 화면 가운데 카드 SVG (200x300) — 카드 이름 + amber border
   - 우측에서 날아옴 (x: 100% → 50%, 0.4s)
   - 0.6s 유지 (shimmer effect)
   - 카드 위로 페이드 + 효과 텍스트 popup ("기술 +X / 다음 잽 x3 등")
   - 0.5s 후 onComplete 콜백

D. VictoryFanfare
   props: { rewards?: { story_xp?: number; ring_coins?: number; card_code?: string }; onComplete: () => void }
   - 화면 중앙 큰 amber 텍스트 "VICTORY"
   - 배경 amber 광선 5개 (0.6s 페이드 인)
   - 그 아래 보상 요약 ("+N XP / +N 코인 / 카드 'X' 획득")
   - PlayerBoxer pose='victory' 로 작게 표시
   - 2초 후 onComplete

E. DefeatScreen
   props: { onRetry: () => void; onWorldMap: () => void }
   - 검은 페이드 in (0.5s)
   - 화면 중앙 회색 텍스트 "DEFEAT"
   - PlayerBoxer pose='hurt' 작게
   - 두 버튼: "다시 도전" / "월드맵으로"
   - 음울한 톤 + 아래 격려 문구 ("패배는 끝이 아니다 — 다시 일어서자")

═══════════════════════════════════════════════════════════════════
7. StoryBattleEngine.tsx 리팩터
═══════════════════════════════════════════════════════════════════

기존 기능 유지하면서 비주얼만 강화:
- BattleArena 마운트 (적 + 플레이어 합성)
- 액션 버튼 5개 + 카드 토글 (기존)
- submit_player_command 호출 (기존)
- 응답 받으면:
  · result.action_log 의 각 항목을 순차적으로 처리:
    - command 가 'jab/guard/footwork/counter/osam_advice' 면 AttackAnimation 트리거
    - 적 데미지 (enemy_hp_delta < 0) 면 DamagePopup + HitEffect + EnemySvg pose='hurt'
    - 플레이어 데미지 (player_hp_delta < 0) 면 PlayerBoxer pose='hurt' + CameraShake
  · result.status === 'victory' → VictoryFanfare → onVictory 콜백
  · result.status === 'defeat' → DefeatScreen → onDefeat 콜백
- 카드 사용 시 CardUseEffect 후 use_card 명령 (기존 흐름)

상태:
- playerPose / enemyPose useState 로 관리, 0.5s 후 idle 복귀
- shakeKey / flashKey 카운터 (mutate 마다 +1)
- damagePopups 배열 (mutate 마다 push, 0.7s 후 제거)

═══════════════════════════════════════════════════════════════════
8. 게임 밸런스 패치 (마이그레이션)
═══════════════════════════════════════════════════════════════════

파일: supabase/migrations/20260710000000_boxing_battle_balance.sql

내용:
1. submit_player_command RPC 갱신 — 가드/풋워크 시 집중 회복:

CREATE OR REPLACE FUNCTION public.submit_player_command(
  p_command text,
  p_target_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stats public.boxing_user_player_stats%ROWTYPE;
  v_battle_state jsonb;
  v_enemy_code text;
  v_enemy public.boxing_story_enemies%ROWTYPE;
  v_enemy_hp integer;
  v_enemy_hp_max integer;
  v_player_dmg integer := 0;
  v_enemy_dmg integer := 0;
  v_focus_change integer := 0;  -- ✨ NEW: 가드/풋워크 회복용
  v_action_log jsonb := '[]'::jsonb;
  v_status text := 'ongoing';
  v_card_used boolean;
  v_osam_used boolean;
  v_turn integer;
  v_narration text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- 현재 stats + battle_state 읽기
  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;
  v_battle_state := v_stats.battle_state;

  IF v_battle_state IS NULL OR v_battle_state = '{}'::jsonb THEN
    RAISE EXCEPTION 'no_active_battle';
  END IF;

  v_enemy_code := v_battle_state ->> 'enemy_code';
  v_enemy_hp := (v_battle_state ->> 'enemy_hp')::integer;
  v_enemy_hp_max := (v_battle_state ->> 'enemy_max_hp')::integer;
  v_card_used := COALESCE((v_battle_state ->> 'card_used')::boolean, false);
  v_osam_used := COALESCE((v_battle_state ->> 'osam_advice_used')::boolean, false);
  v_turn := COALESCE((v_battle_state ->> 'turn')::integer, 1);

  SELECT * INTO v_enemy FROM public.boxing_story_enemies WHERE code = v_enemy_code;

  -- 명령별 처리
  IF p_command = 'jab' THEN
    v_player_dmg := v_stats.skill;
    v_focus_change := -1;
    v_narration := '잽이 들어갑니다.';
  ELSIF p_command = 'guard' THEN
    v_player_dmg := 0;
    v_focus_change := +2;  -- ✨ 가드 시 집중 회복 +2
    v_narration := '가드 자세를 잡았어요. 호흡을 정비합니다.';
  ELSIF p_command = 'footwork' THEN
    v_player_dmg := GREATEST(1, v_stats.skill / 3);  -- 약공격
    v_focus_change := +1;  -- ✨ 풋워크 시 집중 회복 +1
    v_narration := '풋워크로 회피하며 견제합니다.';
  ELSIF p_command = 'counter' THEN
    IF v_stats.focus < 2 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'insufficient_focus');
    END IF;
    v_player_dmg := v_stats.skill * 5 / 2;  -- 2.5x
    v_focus_change := -2;
    v_narration := '카운터! 정확한 타이밍입니다.';
  ELSIF p_command = 'osam_advice' THEN
    IF v_osam_used THEN
      RETURN jsonb_build_object('success', false, 'reason', 'osam_already_used');
    END IF;
    v_focus_change := +5;  -- 오삼이 조언 = 호흡 정비 + 집중 회복
    v_player_dmg := 0;
    v_osam_used := true;
    v_narration := '오삼이의 조언: ' || COALESCE(v_battle_state ->> 'osam_hint', '깊게 숨을 쉬어요.');
  ELSIF p_command = 'use_card' THEN
    IF v_card_used THEN
      RETURN jsonb_build_object('success', false, 'reason', 'card_already_used');
    END IF;
    -- 카드 효과는 v_target_data 로 처리 (기존 로직 유지)
    v_card_used := true;
    -- 간단화: 다음 잽 x3 가정
    v_player_dmg := v_stats.skill * 3;
    v_narration := '카드 발동!';
  ELSE
    RAISE EXCEPTION 'unknown_command';
  END IF;

  -- 약점 매칭 (간단화)
  IF v_enemy.weakness ? p_command THEN
    v_player_dmg := v_player_dmg * 3 / 2;
    v_narration := v_narration || ' (약점 적중!)';
  END IF;

  -- 적 데미지 적용
  IF v_player_dmg > 0 THEN
    v_enemy_hp := GREATEST(0, v_enemy_hp - v_player_dmg);
  END IF;

  -- 승리 판정
  IF v_enemy_hp <= 0 THEN
    v_status := 'victory';
  ELSE
    -- 적 패턴 발동 (단순 — 약 50% 데미지)
    v_enemy_dmg := v_enemy.attack;
    -- 가드 명령은 받는 데미지 50% 감소
    IF p_command = 'guard' THEN
      v_enemy_dmg := v_enemy_dmg / 2;
    END IF;
    -- 패배 판정
    IF (v_stats.hp - v_enemy_dmg) <= 0 THEN
      v_status := 'defeat';
      v_enemy_dmg := v_stats.hp;  -- 정확히 0 까지만
    END IF;
  END IF;

  -- 능력치 업데이트
  UPDATE public.boxing_user_player_stats
     SET hp = GREATEST(0, hp - v_enemy_dmg),
         focus = LEAST(focus_max, GREATEST(0, focus + v_focus_change)),
         battle_state = CASE
           WHEN v_status = 'victory' OR v_status = 'defeat' THEN '{}'::jsonb
           ELSE jsonb_build_object(
             'enemy_code', v_enemy_code,
             'enemy_hp', v_enemy_hp,
             'enemy_max_hp', v_enemy_hp_max,
             'turn', v_turn + 1,
             'last_command', p_command,
             'card_used', v_card_used,
             'osam_advice_used', v_osam_used
           )
         END,
         last_played_at = now()
   WHERE user_id = v_uid;

  -- 승리 시 보상
  IF v_status = 'victory' THEN
    UPDATE public.boxing_user_player_stats
       SET story_xp = story_xp + COALESCE(v_enemy.reward_story_xp, 0),
           ring_coins = ring_coins + COALESCE(v_enemy.reward_ring_coins, 0)
     WHERE user_id = v_uid;
    IF v_enemy.reward_card_code IS NOT NULL THEN
      INSERT INTO public.boxing_story_inventory (user_id, card_code, count)
      VALUES (v_uid, v_enemy.reward_card_code, 1)
      ON CONFLICT (user_id, card_code) DO UPDATE SET count = boxing_story_inventory.count + 1;
    END IF;
  END IF;

  -- 패배 시 hp 50% 회복 (다음 도전 가능)
  IF v_status = 'defeat' THEN
    UPDATE public.boxing_user_player_stats
       SET hp = hp_max / 2,
           focus = focus_max / 2
     WHERE user_id = v_uid;
  END IF;

  -- 응답 stats 다시 읽기
  SELECT * INTO v_stats FROM public.boxing_user_player_stats WHERE user_id = v_uid;

  v_action_log := jsonb_build_array(
    jsonb_build_object('actor', 'player', 'line', v_narration, 'damage', v_player_dmg),
    jsonb_build_object('actor', 'enemy', 'line', v_enemy.name || ' 의 공격', 'damage', v_enemy_dmg)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'player_hp', v_stats.hp,
    'player_focus', v_stats.focus,
    'enemy_hp', v_enemy_hp,
    'turn', v_turn + 1,
    'action_log', v_action_log,
    'narration', v_narration,
    'rewards', CASE WHEN v_status = 'victory' THEN
      jsonb_build_object(
        'story_xp', COALESCE(v_enemy.reward_story_xp, 0),
        'ring_coins', COALESCE(v_enemy.reward_ring_coins, 0),
        'card_code', v_enemy.reward_card_code
      )
    ELSE NULL END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.submit_player_command(text, jsonb) TO authenticated;

2. 적 HP 적정 조정 (회원 초반 능력치 대비):

UPDATE public.boxing_story_enemies SET hp = 60 WHERE code = 'lazy_slime' AND hp > 60;
UPDATE public.boxing_story_enemies SET hp = 90 WHERE code = 'guard_breaker' AND hp > 100;
UPDATE public.boxing_story_enemies SET hp = 90 WHERE code = 'tension_wolf' AND hp > 100;
UPDATE public.boxing_story_enemies SET hp = 110 WHERE code = 'overtraining_golem' AND hp > 130;
-- 보스는 그대로 유지 (도전감)

(또는 Stage 44 시나리오 §6 적 데이터 표 참고해서 적정 HP 결정)

═══════════════════════════════════════════════════════════════════
9. 빌드/검증 체크리스트
═══════════════════════════════════════════════════════════════════

작업 끝나고:
1. npx tsc --noEmit  → 0 error
2. bun run build       → "✓ built in …"
3. grep 자기검열:
   · grep -R "ChatAssistant\|chat-assistant" src/components/story-rpg/visuals/battle → 0 hit
   · grep -R "approve_mission_submission\|record_attendance\|member_progress" src/ (story-rpg 만) → 0 hit
   · grep -R "wallet" src/components/story-rpg/visuals/battle → 0 hit
   · grep -R "localStorage\|sessionStorage" src/components/story-rpg → 0 hit
4. 새 마이그레이션 1개:
   · ls supabase/migrations/20260710000000_*.sql → 1
5. 새 npm 패키지 0개:
   · git diff package.json → 변경 없음
6. 손스모크 가능한지 (스토리 챕터 1 끝까지 자연스럽게)

═══════════════════════════════════════════════════════════════════
10. 작업 순서 (의존도 정렬)
═══════════════════════════════════════════════════════════════════

1) supabase/migrations/20260710000000_boxing_battle_balance.sql 신설 (먼저 — 운영 SQL Editor 적용 안내)
2) src/components/story-rpg/visuals/battle/ 디렉터리 신설
3) PlayerBoxer.tsx (가장 leaf)
4) EnemySvg.tsx + enemyVariants.ts
5) DamagePopup.tsx + HitEffect.tsx
6) CardUseEffect.tsx
7) VictoryFanfare.tsx + DefeatScreen.tsx
8) AttackAnimation.tsx (PlayerBoxer + EnemySvg 활용)
9) BattleArena.tsx (전체 합성)
10) StoryBattleEngine.tsx 리팩터 (BattleArena + Animation + Popup 합성)
11) tsc / build / grep 자기검열
12) 손스모크 가이드 작성

═══════════════════════════════════════════════════════════════════
11. 커밋 메시지 (작업 완료 후)
═══════════════════════════════════════════════════════════════════

feat(story-rpg): 전투 비주얼 오버홀 + 게임 밸런스 패치 (47B 단계)

변경 파일 (예상):
신규:
- supabase/migrations/20260710000000_boxing_battle_balance.sql — submit_player_command RPC 패치 + 적 HP 조정
- src/components/story-rpg/visuals/battle/PlayerBoxer.tsx (5+ 포즈)
- src/components/story-rpg/visuals/battle/EnemySvg.tsx + enemyVariants.ts (11 적 unique SVG)
- src/components/story-rpg/visuals/battle/BattleArena.tsx
- src/components/story-rpg/visuals/battle/AttackAnimation.tsx (5 모션)
- src/components/story-rpg/visuals/battle/DamagePopup.tsx
- src/components/story-rpg/visuals/battle/HitEffect.tsx
- src/components/story-rpg/visuals/battle/CardUseEffect.tsx
- src/components/story-rpg/visuals/battle/VictoryFanfare.tsx
- src/components/story-rpg/visuals/battle/DefeatScreen.tsx

수정:
- src/components/story-rpg/StoryBattleEngine.tsx — BattleArena/Animation/Popup 합성

이유: 47A 까지는 월드맵/씬 비주얼만. 전투 화면은 정적 + 게임 밸런스 함정 (집중 회복 부재) 으로 막힘.
이번 단계로 전투를 동적 게임 UI 로 + 가드/풋워크 시 집중 회복 + 적 HP 적정 조정.

확인:
- npx tsc --noEmit ✓
- bun run build ✓
- 새 마이그레이션 1개 (운영 SQL Editor 적용 필요)
- 새 npm 패키지 0
- 손스모크: 챕터 1 battle → 잽/가드 교대로 → 가드 시 집중 회복 → 정상 클리어 → 챕터 2 진행

═══════════════════════════════════════════════════════════════════
주의 (절대 하지 말 것)
═══════════════════════════════════════════════════════════════════

1. 새 npm 패키지 추가 금지.
2. 외부 이미지 fetch 금지. SVG 모두 inline JSX.
3. localStorage / sessionStorage 사용 금지.
4. ChatAssistant / chat-assistant Edge / wallet 직접 / member_progress 직접 0건.
5. 47A 비주얼 자산 (visuals/portraits/*, visuals/backgrounds/*, visuals/icons/*) 수정 금지 — 재사용만.
6. 환세취호권 / 외부 IP 직접 참조 금지. 마이복서153 자체 IP + 보편적인 적 (슬라임/늑대/로봇/그림자 등 공중 도상) 만.
7. 전투 화면이 모바일 (375x667) 에서 깨지지 않게 max-w-md 제약.
8. 새 마이그레이션 timestamp 는 20260709000000 보다 단조 증가 → 20260710000000.
9. submit_player_command RPC 안에서 member_progress / 공식 XP / wallet 직접 update 금지.
10. CardUseEffect 에서 카드 효과는 client-only (cosmetic). 실제 데미지 계산은 RPC 안에서.

지금부터 위 순서대로 작업해. 작업 완료 후 변경 파일 목록 + tsc/build 결과 + 마이그레이션 적용 가이드 보고.
```

---

## 작업 완료 후 절차 (사용자)

1. **로컬 작업 끝나면**:
   ```powershell
   cd C:\Users\82104\game-fit-quests
   git status
   git add src supabase/migrations/20260710000000_boxing_battle_balance.sql docs/153-story-rpg-stage47b-prompt.md
   git commit -m "feat(story-rpg): 전투 비주얼 오버홀 + 밸런스 (47B)"
   git push origin main
   ```

2. **운영 DB 마이그레이션 적용**:
   ```powershell
   [System.IO.File]::ReadAllText(
     "C:\Users\82104\game-fit-quests\supabase\migrations\20260710000000_boxing_battle_balance.sql",
     [System.Text.Encoding]::UTF8
   ) | Set-Clipboard
   ```
   → Supabase Dashboard → SQL Editor → 새 쿼리 → 붙여넣기 → Run

3. **검증 SQL**:
   ```sql
   -- RPC 갱신 확인
   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'submit_player_command';
   -- 결과 안에 'v_focus_change' 키워드 있어야 갱신 완료

   -- 적 HP 조정 확인
   SELECT code, name, hp, is_boss FROM public.boxing_story_enemies ORDER BY hp;
   ```

4. **손스모크** (Cloudflare Pages 빌드 ~3분 후):
   - 챕터 1 진입 → 적 등장 (이번엔 unique SVG + idle 애니메이션)
   - 잽 누름 → 플레이어 글러브 슬라이드 + white streak + 적 충격 + 데미지 popup + 적 흔들기
   - 가드 누름 → amber arc + 집중 +2 회복 (HUD 업데이트)
   - 카운터 누름 → 화면 slow-mo + 큰 글러브 + 빨간 flash + 큰 데미지 popup + CameraShake hard
   - 적 HP 0 → VictoryFanfare cinematic + 보상 표시
   - 챕터 진행 → 챕터 2 잠금 해제

이번 47B 마치면 **진짜 게임 같은 느낌** 나옴. 환세취호권 1:1 은 못 가지만, web 으로 가능한 한계 안에서 모션이 살아있는 전투 UI 가 됨.
