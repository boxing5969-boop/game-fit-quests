/**
 * 153 다이어트 · AI 코치 한마디 풀.
 *
 * 실제 코치 노트가 없는 날 CoachCornerCard fallback 으로 사용.
 * 두 유형을 번갈아:
 *   · encourage : 힘이 되는 말 (동기 · 위로 · 지속 메시지)
 *   · trivia    : 다이어트 상식 (과학적 사실 · 팁)
 *
 * 일자 시드 기반으로 하루 1개 픽업 — 같은 날 여러 번 열어도 같은 메시지.
 */

export type CoachMessageType = "encourage" | "trivia";

export interface CoachMessage {
  type: CoachMessageType;
  text: string;
}

export const COACH_MESSAGES: CoachMessage[] = [
  // ─── 힘이 되는 말 ──────────────────────────────────────────
  { type: "encourage", text: "한 끼 놓쳤다면 다음 끼니부터 다시 시작해요. 완벽보다 꾸준함이 이깁니다." },
  { type: "encourage", text: "체중은 매일 변하지만 습관은 한 방향으로 쌓입니다." },
  { type: "encourage", text: "몸이 무거운 날은 몸이 회복 중이라는 신호예요. 수면·물 먼저 챙겨요." },
  { type: "encourage", text: "21일은 레이스가 아니라 리듬의 재설계입니다. 오늘만 잡으면 됩니다." },
  { type: "encourage", text: "어제보다 1% 가벼운 저녁 선택, 그게 감량의 본질이에요." },
  { type: "encourage", text: "'다이어트 중'이 아니라 '내 몸에 맞는 루틴 중'이라고 생각해 보세요." },
  { type: "encourage", text: "야식 한 번은 실패가 아니라 데이터예요. 패턴이 보이면 다음 대응이 쉽습니다." },
  { type: "encourage", text: "체크인을 안 한 하루가 있어도, 내일의 체크인이 모두 복구합니다." },
  { type: "encourage", text: "정체기는 몸이 바뀌고 있다는 신호. 단식보다 수면·수분 먼저 점검해요." },
  { type: "encourage", text: "완벽한 7일보다 불완전한 21일이 체지방을 더 줄입니다." },
  { type: "encourage", text: "복싱하고 돌아온 오늘, 이미 잘한 것입니다. 잘자요." },
  { type: "encourage", text: "주말에 흔들려도 월요일 리듬만 잡으면 다시 제자리입니다." },
  { type: "encourage", text: "식단 사진 한 장은 자기 자신과의 가장 정직한 대화예요." },
  { type: "encourage", text: "감량기엔 '덜 먹기' 보다 '제때 먹기' 가 더 중요합니다." },
  { type: "encourage", text: "피곤할 땐 운동보다 20분 낮잠이 체중에 더 이롭습니다." },

  // ─── 다이어트 상식 ────────────────────────────────────────
  { type: "trivia", text: "단백질 소화엔 섭취 칼로리의 20~30% 가 쓰여요. 탄수(5~10%)·지방(0~3%) 보다 훨씬 커요 — TEF 효과." },
  { type: "trivia", text: "수면 6시간 미만이면 식욕 호르몬 그렐린 ↑ 렙틴 ↓ — 야식 충동이 약 40% 증가합니다." },
  { type: "trivia", text: "물 500ml 를 식전 30분에 마시면 포만감이 올라가 식사량이 자연스럽게 줄어요 (Dennis 2010)." },
  { type: "trivia", text: "브로콜리·양배추·케일은 칼로리 대비 섬유질·비타민K 가 가장 높은 채소 3종입니다." },
  { type: "trivia", text: "아침 단백질 30g 섭취 시 그날의 폭식 확률이 유의미하게 감소 (Leidy 2015)." },
  { type: "trivia", text: "걷기·복싱 같은 저강도 유산소는 식욕 억제 호르몬 PYY·GLP-1 을 올립니다." },
  { type: "trivia", text: "커피 카페인은 섭취 후 5~6시간 혈중에 남아요. 15시 이후 커피는 수면 질의 최대 변수." },
  { type: "trivia", text: "김치·요거트·된장의 유산균은 장내 염증을 낮춰 체지방 감량에 간접 기여해요." },
  { type: "trivia", text: "감량 중 단백질 1.6~2.0 g/kg 섭취 시 근손실이 최소화됩니다 (Helms 2014)." },
  { type: "trivia", text: "하루 걸음 8,000보는 사망률·심혈관 리스크를 크게 낮춥니다 (JAMA 2020)." },
  { type: "trivia", text: "외식 전 삶은 계란 1개는 총 섭취 칼로리를 평균 18% 줄입니다 (Vander Wal 2005)." },
  { type: "trivia", text: "지방 25% 이하는 호르몬·지용성 비타민(A·D·E·K) 흡수 저하의 경계선이에요." },
  { type: "trivia", text: "식사 첫 입을 단백질로 시작하면 동일 칼로리여도 혈당 스파이크가 크게 완화됩니다." },
  { type: "trivia", text: "만성 탈수는 배고픔으로 오인되기 쉬워요. 허기 전에 물 300ml 먼저 시도." },
  { type: "trivia", text: "근력 운동은 식후 1~2시간에 하면 혈당 조절에 가장 효과적입니다 (Colberg 2016)." },
];

/**
 * 오늘 날짜 기반 결정적 픽업.
 * 같은 날 여러 번 호출해도 같은 메시지 반환.
 */
export function pickDailyCoachMessage(date: Date = new Date()): CoachMessage {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const daySeed = y * 10000 + m * 100 + d;
  const idx = daySeed % COACH_MESSAGES.length;
  return COACH_MESSAGES[idx];
}
