// 회원 화면 '작은 회색 글씨' 정리 (2026-10-28 리디자인 2단계) — node scripts/apply-readability.mjs [--dry]
//   글씨 6단계에서 text-micro(13px)는 배지 · 그래프 눈금에만 쓴다 (UX 보고서 · CLAUDE.md 「회원 화면 리디자인」).
//   1단계 글씨 옮기기(apply-type-scale)는 11.5px 이하를 모두 micro 로 보냈다 → 그중 '읽는 글'만 label(14px)로 올린다.
//   · 회색 설명(text-muted-foreground) · 문단(leading-relaxed) 의 text-micro → text-label
//   · 머리말 꾸밈(uppercase + tracking-*) — 한글에 자간을 벌려 읽기 어렵게 하던 것: 자간 · 대문자 빼고, micro 면 label + 굵게
//   · 배지 · 칩(rounded · bg- · border · absolute 가 같은 칸에 있는 것)은 그대로 13px
//   · 사람이 하나씩 고친 화면(HAND_TUNED)과 같은 줄에 '글씨예외'가 있는 줄은 건드리지 않는다
//   · 몇 번을 돌려도 결과가 같다
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { EXEMPT_MARK, isGameFile, isMemberFile } from "./type-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const dry = process.argv.includes("--dry");

/** 2026-10-28 리디자인에서 사람이 한 칸씩 보고 고친 화면 — 남은 text-micro 는 일부러 둔 배지 · 눈금이다 */
const HAND_TUNED = [
  "components/attendance/", "components/home/HealthGainsCard", "components/home/HomeWorkoutCard", "components/home/GrowthLessonCard",
  "components/home/CommunityTodayStrip", "components/profile/AchievementCard", "components/profile/BodyInfoInvite",
  "components/profile/AttendanceRecordCard", "components/profile/DisplayModeToggle", "components/profile/TextScaleToggle",
  "components/profile/BodyInfoSheet", "pages/HomePage", "pages/MyPage", "pages/MyAttendancePage", "pages/MyBoxerCommunityPage",
  "components/engagement/CommunityFeed", "pages/MembershipPage", "components/CoachTodayCard", "pages/MissionsPage",
  "pages/HallOfFamePage", "components/ui/rankingup/RankingItem", "components/engagement/Records153Strip",
  "components/engagement/Record153Board", "components/test153/Test153Board", "pages/NotificationsPage",
  "components/notifications/PushOptInCard", "components/MembershipProducts", "components/membership/",
  "components/engagement/SecondCheerSheet", "components/engagement/CheerStickerPicker", "components/engagement/ChampionJournal",
  "components/engagement/Received153Sheet", "components/engagement/ReceivedCheersSheet", "components/license/",
  "components/RankBadge", "components/badges/",
];

const STRING_RE = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const BADGE_RE = /(?<![\w-])(rounded(?:-[\w[\].%/]+)?|bg-[\w[\]/.#%-]+|border(?:-[\w[\]/.#%-]+)?|absolute)(?![\w-])/;
const has = (s, cls) => new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(s);

let files = 0;
let changes = 0;
const perFile = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else check(p);
  }
};
function fixClass(str) {
  // 한 문자열 안에서만 — className 이 아닌 글(문장)은 클래스 이름을 담고 있지 않으니 그대로 지나간다
  if (!/(?<![\w-])text-micro(?![\w-])|(?<![\w-])uppercase(?![\w-])/.test(str)) return str;
  const badge = BADGE_RE.test(str);
  let s = str;
  const eyebrow = has(s, "uppercase") && /(?<![\w-])tracking-[\w[\].-]+/.test(s);
  if (eyebrow && !badge) {
    s = s.replace(/\s*(?<![\w-])tracking-[\w[\].-]+(?![\w-])/g, "").replace(/\s*(?<![\w-])uppercase(?![\w-])/g, "");
    if (has(s, "text-micro")) {
      s = s.replace(/(?<![\w-])text-micro(?![\w-])/, "text-label").replace(/(?<![\w-])font-black(?![\w-])/, "font-bold");
    }
    // 따옴표 바로 뒤 빈칸 정리
    s = s.replace(/^(["'`])\s+/, "$1").replace(/\s+(["'`])$/, "$1");
    return s;
  }
  if (!badge && has(s, "text-micro") && (has(s, "text-muted-foreground") || /(?<![\w-])text-muted-foreground\/\d+(?![\w-])/.test(s) || has(s, "leading-relaxed"))) {
    s = s.replace(/(?<![\w-])text-micro(?![\w-])/, "text-label");
  }
  return s;
}
function check(abs) {
  const rel = relative(root, abs).replace(/\\/g, "/");
  // 게임은 오락실 모양(영문 대문자 머리말 · 작은 표시)이 그 화면의 멋이라 건드리지 않는다 — 13px 아래만 없으면 된다 (2026-10-28 3단계)
  if (!isMemberFile(rel) || isGameFile(rel) || HAND_TUNED.some((p) => rel.startsWith(p))) return;
  const src = readFileSync(abs, "utf8");
  let n = 0;
  const out = src
    .split("\n")
    .map((line) => {
      if (line.includes(EXEMPT_MARK)) return line;
      return line.replace(STRING_RE, (str) => {
        const next = fixClass(str);
        if (next !== str) n++;
        return next;
      });
    })
    .join("\n");
  if (n && out !== src) {
    files++;
    changes += n;
    perFile.push([n, rel]);
    if (!dry) writeFileSync(abs, out);
  }
}
walk(root);
perFile.sort((a, b) => b[0] - a[0]);
for (const [n, rel] of perFile.slice(0, 30)) console.log(String(n).padStart(4), rel);
console.log(`${dry ? "(미리 보기) " : ""}작은 회색 글씨 · 머리말 꾸밈 정리: 파일 ${files}개 · ${changes}곳`);
