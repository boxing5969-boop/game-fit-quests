/**
 * 지점 주소 별칭 — 사이니지 TV 리모컨으로 주소를 치는 고통을 줄인다.
 *
 * 체육관 TV 는 리모컨 방향키로 한 글자씩 주소를 입력해야 한다.
 * "myboxer153.com/tv/sunreung" 는 26타, "myboxer153.com/tv/s" 는 19타다.
 * 한 대 세팅에 몇 분이 걸리는 작업이라 이 차이가 크다.
 *
 * 상태를 저장하지 않는 방식(별칭)으로 만든 이유: 사이니지 브라우저는 재부팅 때
 * localStorage 를 지우는 기종이 많아서, 기억해두는 방식은 결국 다시 입력하게 된다.
 */
const ALIAS: Record<string, string> = {
  // 영문 한 글자
  s: "sunreung",
  j: "jamsil",
  y: "yeoksam",
  c: "chilgeum",
  // 한글 (한글 입력이 되는 기종에서 더 빠르다)
  "선릉": "sunreung",
  "잠실": "jamsil",
  "역삼": "yeoksam",
  "칠금": "chilgeum",
};

/** 주소에서 받은 값을 실제 지점 코드로 바꾼다. 별칭이 아니면 그대로 통과. */
export const resolveBranchCode = (raw?: string): string | undefined =>
  raw ? (ALIAS[raw] ?? ALIAS[raw.toLowerCase()] ?? raw) : raw;

/** 지점 선택 화면에 띄울 목록 — 별칭 한 글자를 같이 보여준다. */
export const TV_BRANCHES = [
  { code: "sunreung", short: "s", label: "선릉역점" },
  { code: "jamsil", short: "j", label: "잠실점" },
  { code: "yeoksam", short: "y", label: "역삼점" },
  { code: "chilgeum", short: "c", label: "칠금점" },
] as const;

export default resolveBranchCode;
