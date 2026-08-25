// VS Code 터미널에서 쓸 수 있는 명령 목록.
const L = [
  ["bun run help",    "이 목록 보기"],
  ["bun run check",   "코드 문법 검사 (배포 전 확인용, 아무것도 바꾸지 않음)"],
  ["", ""],
  ["bun run ai",      "식단 사진 칼로리 AI 배포 (chat-assistant 엣지 함수)"],
  ["bun run push",    "클로드가 고친 내용을 GitHub 에 올리기 (포함: 사이니지)"],
  ["bun run deploy",  "앱 배포 — 커밋하고 올린다. 2~4분 뒤 회원에게 반영"],
  ["bun run passkey", "지문·얼굴 로그인 적용 (supabase-js 올리고 배포)"],
  ["bun run tv",      "사이니지(TV) 라이브보드 배포 — 끝나면 주소를 알려준다"],
  ["", ""],
  ["bun run apk",     "키오스크 앱(APK) 만들기 — Android Studio 필요"],
  ["bun run tablet",  "만든 APK 를 태블릿으로 보내기 (같은 와이파이)"],
  ["", ""],
  ["bun run dev",     "내 PC 에서 앱 띄워보기 (배포 아님, Ctrl+C 로 종료)"],
];
console.log("\n  마이복서153 — 터미널 명령\n");
for (const [cmd, desc] of L) {
  if (!cmd) { console.log(""); continue; }
  console.log(`  ${cmd.padEnd(18)} ${desc}`);
}
console.log("\n  * 실행 전 개발서버(bun run dev)가 떠 있으면 Ctrl+C 로 먼저 끄세요.\n");
console.log("  사이니지 주소  왼쪽 TV  myboxer153.com/tv/sunreung/1");
console.log("                 오른쪽TV  myboxer153.com/tv/sunreung/2");
console.log("                 지점코드  sunreung 선릉 / jamsil 잠실 / yeoksam 역삼 / chilgeum 칠금\n");
