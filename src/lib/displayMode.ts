/**
 * 사이니지·키오스크 모드 판별 — "사람이 손으로 만지지 않는 화면" 한 곳에서 정의한다.
 *
 * 이 경로들은 체육관 벽의 TV, 출입구의 얼굴인식 태블릿처럼 회원이 조작하지 않는 기기에 뜬다.
 * 따라서 하단 탭바·AI 버튼·튜토리얼·환영 모달·스플래시 같은 "앱 UI"가 하나라도 새어나오면 안 된다.
 *
 * ⚠️ 새 전시용 화면을 추가하면 여기에만 등록하면 된다.
 *    컴포넌트마다 경로 목록을 각자 들고 있으면 이번처럼 한 곳을 빠뜨린다.
 *    (실제로 /live-board 만 막아둔 상태에서 /tv 를 추가했다가 탭바가 TV에 그대로 나왔다.)
 */
const SIGNAGE_PREFIXES = [
  "/tv",          // 50인치 사이니지 라이브보드
  "/live-board",  // 라이브보드 원래 주소
  "/face-kiosk",  // 얼굴인식 출석 키오스크 (설치형 앱 포함)
] as const;

export const isSignageRoute = (pathname: string): boolean =>
  SIGNAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export default isSignageRoute;
