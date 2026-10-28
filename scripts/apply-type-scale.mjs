// 회원 화면 글씨를 153 글씨 6단계로 옮긴다 (2026-10-28 리디자인) — node scripts/apply-type-scale.mjs [--dry]
//   · 11.5px 이하 → text-micro · 12~13.5px → text-label · 그 위는 가장 가까운 단계 (거리가 같으면 큰 쪽) — scripts/type-scale.mjs stepFor
//   · 옛 이름(text-xs · text-sm · text-caption …)도 같은 규칙으로. 옛 토큰이 정하던 굵기는 같은 칸에 굵기가 없을 때만 붙인다
//   · 몇 번을 돌려도 결과가 같다 — 다른 계정 수정과 합친 뒤 다시 돌려도 된다
//   · TV · 키오스크 화면(EXCLUDE)은 건드리지 않는다 · 게임의 큰 연출 글씨(28px 이상)는 그대로 (keepSize)
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ARBITRARY_RE, EXEMPT_MARK, LEGACY, LEGACY_RE, LEGACY_STEP, LEGACY_WEIGHT, isMemberFile, keepSize, stepFor } from "./type-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const dry = process.argv.includes("--dry");
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(root);

const WEIGHT_RE = /(?<![\w-])font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])(?![\w-])/;
// 따옴표 · 백틱 문자열 하나 안에서만 바꾼다 (굵기 확인도 그 문자열 안에서)
const STRING_RE = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

let changedFiles = 0;
let changedTokens = 0;
const perFile = [];
for (const abs of files) {
  const rel = relative(root, abs).replace(/\\/g, "/");
  if (!isMemberFile(rel)) continue;
  const src = readFileSync(abs, "utf8");
  let count = 0;
  const out = src
    .split("\n")
    .map((line) => {
      if (line.includes(EXEMPT_MARK)) return line;
      const inString = line.replace(STRING_RE, (str) => {
        let addWeight = null;
        let s = str.replace(ARBITRARY_RE, (m, bang, px) => {
          if (keepSize(rel, Number(px))) return m;
          count++;
          return `${bang}text-${stepFor(Number(px))}`;
        });
        s = s.replace(LEGACY_RE, (m, bang, name) => {
          if (keepSize(rel, LEGACY[name])) return m;
          count++;
          if (LEGACY_WEIGHT[name] && !addWeight) addWeight = LEGACY_WEIGHT[name];
          return `${bang}text-${LEGACY_STEP[name] ?? stepFor(LEGACY[name])}`;
        });
        if (addWeight && !WEIGHT_RE.test(s)) {
          // 문자열 끝 따옴표 바로 앞에 굵기를 붙인다
          s = s.slice(0, -1).replace(/\s*$/, "") + ` ${addWeight}` + s.slice(-1);
        }
        return s;
      });
      // 여러 줄에 걸친 백틱 문자열 안 — 같은 규칙으로 크기만 옮긴다 (굵기는 그대로)
      return inString
        .replace(ARBITRARY_RE, (m, bang, px) => {
          if (keepSize(rel, Number(px))) return m;
          count++;
          return `${bang}text-${stepFor(Number(px))}`;
        })
        .replace(LEGACY_RE, (m, bang, name) => {
          if (keepSize(rel, LEGACY[name])) return m;
          count++;
          return `${bang}text-${LEGACY_STEP[name] ?? stepFor(LEGACY[name])}`;
        });
    })
    .join("\n");
  if (count && out !== src) {
    changedFiles++;
    changedTokens += count;
    perFile.push([count, rel]);
    if (!dry) writeFileSync(abs, out);
  }
}
perFile.sort((a, b) => b[0] - a[0]);
for (const [n, rel] of perFile.slice(0, 25)) console.log(String(n).padStart(4), rel);
console.log(`${dry ? "(미리 보기) " : ""}글씨 6단계로 옮김: 파일 ${changedFiles}개 · ${changedTokens}곳`);
