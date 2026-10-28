// 회원 화면 글씨 검사 (2026-10-28 리디자인 · UX 보고서 「화면 규칙 7가지」 5번 — 글씨는 6단계만, 13px 아래 없음)
//   `bun run build` 앞에서 돈다. 회원 화면(.tsx)에 크기 숫자(text-[11.5px])나 옛 이름(text-xs · text-sm · text-caption …)이 있으면 알린다.
//   · 고치는 법: 6단계 이름 text-micro(13) · text-label(14) · text-body(16) · text-heading(19) · text-title(24) · text-display(40)
//     한꺼번에 옮기려면 node scripts/apply-type-scale.mjs
//   · 클로드 세션(CLAUDECODE=1)에서는 빌드를 멈춘다 · GitHub 「앱 자동 검사」는 FONTS_STRICT=1 로 빨간불
//   · Cloudflare Pages 배포는 막지 않는다 (알리기만)
//   · 정말 필요한 줄은 같은 줄 주석에 '글씨예외' (예: 큰 숫자 연출) — 쓰기 전에 대표님 보고서 기준을 먼저 생각한다
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ARBITRARY_RE, EXEMPT_MARK, LEGACY, LEGACY_RE, isMemberFile, keepSize } from "./type-scale.mjs";

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
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, "/");
    if (!isMemberFile(rel)) continue;
    const lines = readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes(EXEMPT_MARK)) return;
      const hits = [
        ...[...line.matchAll(ARBITRARY_RE)].filter((m) => !keepSize(rel, Number(m[2]))),
        ...[...line.matchAll(LEGACY_RE)].filter((m) => !keepSize(rel, LEGACY[m[2]])),
      ].map((m) => m[0]);
      if (hits.length) bad.push(`    src/${rel}:${i + 1}  ${[...new Set(hits)].join(" ")}`);
    });
  }
  if (bad.length) {
    const msg = [
      "",
      `✖ 회원 화면에 글씨 6단계가 아닌 크기가 ${bad.length}줄 있어요 — 13px 아래 글씨 · 크기 숫자 · 옛 이름은 쓰지 않아요.`,
      ...bad.slice(0, 40),
      bad.length > 40 ? `    … 그 밖에 ${bad.length - 40}줄` : "",
      "  → text-micro(13) · text-label(14) · text-body(16) · text-heading(19) · text-title(24) · text-display(40) 중에서 고르세요.",
      "    한꺼번에 옮기기: node scripts/apply-type-scale.mjs",
      "",
    ].filter(Boolean);
    console.error(msg.join("\n"));
    if (strict) process.exit(1);
  }
} catch (e) {
  // 검사 자체가 실패해도 배포는 막지 않는다
  console.warn("글씨 검사를 건너뜀:", e?.message ?? e);
}
