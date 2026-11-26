/**
 * 153운영본부 알림 링크 — 「누르면 바로 그 화면」 (2026-11-26 대표님 「마이복서 153 내용 누르면 바로 그 부분으로 이동하게 해줘
 * 현재 근무 메뉴로는 가는데 PT 확인 메뉴까지는 못 가네」 · 작업판 `myboxer:notifications`)
 *
 *   /office?tab=work&b=<지점>              알림을 보낸 지점부터 연다(관리하는 지점이 여럿일 때). 서버는 '153복싱짐 '을 뗀 이름을 %로 바꿔 넣는다
 *   …&pt=check                            「PT 기록 · 이틀 넘은 확인 필요」 → 확인할 PT 기록이 있는 코치 카드의 'PT' 탭 「확인 필요」(여럿이면 '확인할 것')
 *   …&staff=<근무자 카드>&day=<날짜>        「📍 출근 기록 없음」 → 그 코치의 그날 시트
 *   …&staffname=<이름>&day=<날짜>           옛 알림(근무자 카드 id 가 없던 때) — 이름으로 찾는다
 *   …&entry=<요청>&day=<날짜>              「⏱ 연장 근무 신청」 · 「🔁 수업 대타 요청」 → 「확인할 것」의 그 요청(승인 · 반려)이 빛난다 (2026-11-26 「클릭하면 바로」)
 *   …&dutyreport=<신고>&day=<날짜>         「📍 출근 신고」 → 「확인할 것」의 그 신고(승인 · 반려)
 *   …&todo=overtime|cover|duty&staffname=<이름>&day=<날짜>   위 둘의 옛 알림(요청 id 가 없던 때)
 *
 *   판단은 여기 한 곳 · 화면은 OpsWorkTab · 옛 알림 올려 읽기는 lib/notifications · 시험 opsLink.test.ts
 */

/** 지점 이름 견주기 — '153복싱짐'과 빈칸을 빼고 */
const normBranch = (s: string): string => s.replace(/^153복싱짐/, "").replace(/\s+/g, "");

/** 링크의 지점(b) → 내가 볼 수 있는 지점 가운데 같은 것. 없으면 null */
export const matchOpsBranch = (branches: readonly string[], want: string | null | undefined): string | null => {
  if (!want) return null;
  const w = normBranch(want);
  if (!w) return null;
  return branches.find((b) => normBranch(b) === w) ?? null;
};

export const isOpsDay = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 근무 탭 링크 — 값은 encodeURIComponent, 빈 값은 뺀다 */
export const opsWorkLink = (q: Record<string, string | null | undefined>): string => {
  const parts = ["tab=work"];
  for (const [k, v] of Object.entries(q)) if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
  return `/office?${parts.join("&")}`;
};

/** 링크가 가리키는 곳을 다 쓰면 지우는 주소 칸 */
export const OPS_LINK_KEYS = ["b", "pt", "staff", "staffname", "day", "ptcoach", "entry", "dutyreport", "todo"] as const;

/** 옛 승인 요청 알림의 todo 칸 */
export type OpsTodoKind = "overtime" | "cover" | "duty";
export const isOpsTodoKind = (v: string | null | undefined): v is OpsTodoKind => v === "overtime" || v === "cover" || v === "duty";

export type PtCheckTarget = { kind: "coach"; staffId: string } | { kind: "list" } | { kind: "none" };

/**
 * 「PT 기록 · 이틀 넘은 확인 필요」를 누르고 왔을 때 열 곳.
 *   확인할 PT 기록이 있는 코치가 한 명 → 그 코치 'PT' 탭 · 여럿 → '확인할 것'
 *   (그사이 다 처리돼) 아무도 없으면: 이 지점 PT 코치가 한 명이면 그 코치 'PT' 탭, 여럿이면 '확인할 것', 없으면 그대로
 */
export const ptCheckTarget = (todoCoachIds: readonly string[], activePtCoachIds: readonly string[]): PtCheckTarget => {
  const todo = [...new Set(todoCoachIds)];
  if (todo.length === 1) return { kind: "coach", staffId: todo[0] };
  if (todo.length > 1) return { kind: "list" };
  const coaches = [...new Set(activePtCoachIds)];
  if (coaches.length === 1) return { kind: "coach", staffId: coaches[0] };
  return coaches.length > 1 ? { kind: "list" } : { kind: "none" };
};
