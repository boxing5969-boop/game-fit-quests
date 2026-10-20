// 마이그레이션 파일 번호 겹침 검사 (2026-10-20 — 두 계정 동시 작업, CLAUDE.md 「두 계정 동시 작업」)
//   10/19 에 두 계정이 같은 번호(20261019200000)로 마이그레이션을 만든 일이 있었다.
//   `bun run build` 앞에서 돌아, 같은 번호의 파일이 둘 이상이면 알린다.
//   · 클로드 세션(CLAUDECODE=1)에서 돌면 빌드를 멈춘다 — 푸시 전에 번호를 고치게.
//   · Cloudflare Pages · CI · 그 밖의 곳은 알리기만 하고 빌드를 계속한다(배포는 절대 막지 않는다).
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 예전부터 겹쳐 있던 번호 — 이미 DB 에 들어가 이름을 바꾸지 않는다.
const KNOWN_DUPLICATES = new Set(["20260712000000", "20261015235500"]);

const env = process.env;
const strict = !!env.CLAUDECODE && !env.CF_PAGES && !env.CI;

try {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
  const byVersion = new Map();
  const badNames = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue;
    const m = /^(\d{14})_[^/]+\.sql$/.exec(file);
    if (!m) {
      badNames.push(file);
      continue;
    }
    const list = byVersion.get(m[1]) ?? [];
    list.push(file);
    byVersion.set(m[1], list);
  }
  const dups = [...byVersion].filter(([v, files]) => files.length > 1 && !KNOWN_DUPLICATES.has(v));

  if (dups.length || badNames.length) {
    const lines = [""];
    if (dups.length) {
      lines.push("✖ 마이그레이션 번호가 겹쳐요 — 다른 계정이 같은 번호를 먼저 썼을 수 있어요.");
      for (const [v, files] of dups) lines.push(`    ${v}: ${files.join(" · ")}`);
      lines.push("  → 내가 만든 파일의 번호를 지금 시각(KST, 초까지)으로 바꾸세요. 다른 계정 파일은 그대로 둡니다.");
    }
    if (badNames.length) {
      lines.push("✖ 이름이 '숫자14자리_이름.sql' 꼴이 아닌 마이그레이션:");
      for (const f of badNames) lines.push(`    ${f}`);
    }
    lines.push("  (CLAUDE.md 「두 계정 동시 작업」)", "");
    console.error(lines.join("\n"));
    if (strict) process.exit(1);
  }
} catch (e) {
  // 검사 자체가 실패해도 빌드는 막지 않는다.
  console.warn("마이그레이션 번호 검사를 건너뜀:", e instanceof Error ? e.message : e);
}
