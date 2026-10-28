// 화면 글씨 검사 (2026-10-28 리디자인 · UX 보고서 「화면 규칙 7가지」 5번 — 글씨는 이름 붙은 단계만)
//   `bun run build` 앞에서 돈다.
//   · 회원 · 관리자 · 게임 화면(.tsx): 크기 숫자(text-[11.5px]) · 옛 이름(text-xs · text-sm · text-caption …) · TV 단계 이름이 있으면 알린다.
//     → 6단계 이름 text-micro(13) · text-label(14) · text-body(16) · text-heading(19) · text-title(24) · text-display(40)
//   · TV · 키오스크 화면: 크기 숫자 · 옛 이름 · 회원 6단계 이름이 있으면 알린다 (멀리서 보는 화면 — 가장 작은 글씨 20).
//     → text-tv-micro(20) · text-tv-label(24) · text-tv-body(28) · text-tv-heading(36) · text-tv-title(48) · text-tv-display(72)
//   · 한꺼번에 옮기기: node scripts/apply-type-scale.mjs
//   · 클로드 세션(CLAUDECODE=1)에서는 빌드를 멈춘다 · GitHub 「앱 자동 검사」는 FONTS_STRICT=1 로 빨간불
//   · Cloudflare Pages 배포는 막지 않는다 (알리기만)
//   · 정말 필요한 줄은 같은 줄 주석에 '글씨예외' (예: 큰 숫자 연출) — 쓰기 전에 대표님 보고서 기준을 먼저 생각한다
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ARBITRARY_RE, EXEMPT_MARK, LEGACY, LEGACY_RE, MEMBER_TOKEN_RE, TV_TOKEN_RE, isMemberFile, isTvFile, keepSize } from "./type-scale.mjs";

/** CSS 글 안 px 글씨 크기 (font-size:13px) */
const CSS_PX_RE = /font-size:\s*\d+(?:\.\d+)?px/g;

const env = process.env;
const strict = env.FONTS_STRICT === "1" || (!!env.CLAUDECODE && !env.CF_PAGES && !env.CI);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

try {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(root);
  const bad = [];
  const badTv = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, "/");
    const tv = isTvFile(rel);
    if (!tv && !isMemberFile(rel)) continue;
    const lines = readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes(EXEMPT_MARK)) return;
      const hits = tv
        ? [...line.matchAll(ARBITRARY_RE), ...line.matchAll(LEGACY_RE), ...line.matchAll(MEMBER_TOKEN_RE)]
        : [
            ...[...line.matchAll(ARBITRARY_RE)].filter((m) => !keepSize(rel, Number(m[2]))),
            ...[...line.matchAll(LEGACY_RE)].filter((m) => !keepSize(rel, LEGACY[m[2]])),
            ...line.matchAll(TV_TOKEN_RE),
            // 화면 안에 적은 CSS 글 (153플레이처럼) — px 대신 6단계 rem
            ...line.matchAll(CSS_PX_RE),
          ];
      if (hits.length) (tv ? badTv : bad).push(`    src/${rel}:${i + 1}  ${[...new Set(hits.map((m) => m[0]))].join(" ")}`);
    });
  }
  const msg = [];
  if (bad.length) {
    msg.push(
      "",
      `✖ 휴대폰 화면에 글씨 6단계가 아닌 크기가 ${bad.length}줄 있어요 — 13px 아래 글씨 · 크기 숫자 · 옛 이름 · TV 단계는 쓰지 않아요.`,
      ...bad.slice(0, 40),
      bad.length > 40 ? `    … 그 밖에 ${bad.length - 40}줄` : "",
      "  → text-micro(13) · text-label(14) · text-body(16) · text-heading(19) · text-title(24) · text-display(40) 중에서 고르세요.",
    );
  }
  if (badTv.length) {
    msg.push(
      "",
      `✖ TV · 키오스크 화면에 TV 단계가 아닌 크기가 ${badTv.length}줄 있어요 — 멀리서 보는 화면이라 가장 작은 글씨가 20이에요.`,
      ...badTv.slice(0, 40),
      badTv.length > 40 ? `    … 그 밖에 ${badTv.length - 40}줄` : "",
      "  → text-tv-micro(20) · text-tv-label(24) · text-tv-body(28) · text-tv-heading(36) · text-tv-title(48) · text-tv-display(72) 중에서 고르세요.",
    );
  }
  if (msg.length) {
    msg.push("    한꺼번에 옮기기: node scripts/apply-type-scale.mjs", "");
    console.error(msg.filter(Boolean).join("\n"));
    if (strict) process.exit(1);
  }
} catch (e) {
  // 검사 자체가 실패해도 배포는 막지 않는다
  console.warn("글씨 검사를 건너뜀:", e?.message ?? e);
}
