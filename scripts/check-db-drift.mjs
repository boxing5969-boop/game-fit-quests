// 🔎 DB 어긋남 점검 (2026-10-20 — 두 계정 동시 작업, CLAUDE.md 「두 계정 동시 작업」)
//
// 두 계정이 운영 DB 함수를 직접 고친다(Supabase MCP apply_migration · DO 블록 패치).
// 저장소 마이그레이션에 남기지 않은 수정은, 다음에 누가 저장소 파일로 같은 함수를 다시 만들 때 조용히 사라진다.
// 이 스크립트는 운영 DB 의 함수 본문 지문(md5)을 저장소 supabase/migrations 의 정의와 비교한다.
//
//   node scripts/check-db-drift.mjs                  비교 → 기준선에 없는 새 어긋남이 있으면 exit 1
//   node scripts/check-db-drift.mjs --write-baseline 지금 상태를 기준선(scripts/db-drift-baseline.json)으로 저장
//   node scripts/check-db-drift.mjs --db <파일.json>  DB 지문을 파일에서 읽기(시험용)
//
// DB 지문: public.repo_drift_fingerprints() — 이름·인자·본문 md5 만(로그인 없이 읽힘, 회원 데이터 없음).
// 주소·키: SUPABASE_URL · SUPABASE_ANON_KEY 환경 변수, 없으면 운영 사이트(myboxer153.com)에 공개된 앱 키를 찾아 쓴다.
// 본문 정규화(DB 와 같은 규칙): \r 제거 → -- · /* */ 주석 제거 → 공백 묶음을 한 칸으로 → 앞뒤 공백 제거 → md5.
//
// 분류
//   db_edited  : DB 본문이 저장소의 어떤 정의와도 다름 → DB 에서만 고침(저장소에 마이그레이션 파일로 남겨야 함)
//   behind     : DB 본문이 저장소의 옛 정의와 같음 → 저장소의 새 정의가 DB 에 안 들어감
//   db_only    : 저장소에 정의가 없는 DB 함수
//   repo_only  : 저장소 마지막 정의는 있는데 DB 에 없음(적용 안 된 마이그레이션?)
// Edge Function 은 이 점검에 없다 → 배포 전에 지금 배포본과 비교(CLAUDE.md).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIG_DIR = join(ROOT, "supabase", "migrations");
const BASELINE = join(ROOT, "scripts", "db-drift-baseline.json");
const PROJECT_REF = "whnczhxyjmyywhlfbgsd";
const SITE = "https://myboxer153.com";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};

// DB(repo_drift_fingerprints)와 글자 하나까지 같은 규칙 — 주석·줄바꿈만 다른 것은 같은 함수로 본다.
export const normBody = (s) =>
  s.replace(/\r/g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/[ \t\n\f\v]+/g, " ")
    .replace(/^ +| +$/g, "");
const md5 = (s) => createHash("md5").update(s, "utf8").digest("hex");

/**
 * SQL 을 훑어 주석은 같은 길이의 공백으로 가리고, 맨 바깥 달러 따옴표 구간($tag$…$tag$)의 위치를 돌려준다.
 * (함수 본문 안의 주석·문자열은 건드리지 않는다)
 */
export function scanSql(sql) {
  const out = sql.split("");
  const dollars = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];
    if (c === "-" && c2 === "-") {
      while (i < n && sql[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (c === "/" && c2 === "*") {
      let depth = 0;
      while (i < n) {
        if (sql[i] === "/" && sql[i + 1] === "*") { depth++; out[i] = out[i + 1] = " "; i += 2; continue; }
        if (sql[i] === "*" && sql[i + 1] === "/") { depth--; out[i] = out[i + 1] = " "; i += 2; if (depth === 0) break; continue; }
        if (sql[i] !== "\n") out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "'") {
      const escapes = i > 0 && /[eE]/.test(sql[i - 1]) && !/[A-Za-z0-9_]/.test(sql[i - 2] ?? "");
      i++;
      while (i < n) {
        if (escapes && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80));
      if (m && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? "")) {
        const tag = m[0];
        const contentStart = i + tag.length;
        const close = sql.indexOf(tag, contentStart);
        const end = close < 0 ? n : close;
        dollars.push({ start: i, contentStart, contentEnd: end, end: close < 0 ? n : close + tag.length });
        i = close < 0 ? n : close + tag.length;
        continue;
      }
    }
    i++;
  }
  return { masked: out.join(""), dollars };
}

/**
 * 마이그레이션 한 파일에서 public 함수 정의(create) · 삭제(drop) · 덧대기(patch)를 파일 안 순서대로 뽑는다.
 * patch = DO 블록에서 pg_get_functiondef 로 지금 정의를 읽어 replace 로 고치는 방식(저장소에 전체 본문이 없다).
 *         그 파일에 '함수이름' · 'public.함수이름(…)' 꼴 문자열이 있으면 그 함수를 덧댄 것으로 본다(넉넉하게 — 알리기만 하는 분류).
 */
export function parseMigration(sql) {
  const { masked, dollars } = scanSql(sql);
  const inDollar = (pos) => dollars.some((d) => pos >= d.start && pos < d.end);
  const events = [];
  const nameRe = String.raw`(?:(?:"?public"?)\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?`;
  const createRe = new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\s+((?:"?[A-Za-z_][A-Za-z0-9_]*"?\s*\.\s*)?)"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(`, "gi");
  for (const m of masked.matchAll(createRe)) {
    if (inDollar(m.index)) continue;
    const schema = m[1].replace(/["\s.]/g, "").toLowerCase();
    if (schema && schema !== "public") continue;
    // 인자 괄호 닫기
    let p = m.index + m[0].length;
    let depth = 1;
    while (p < masked.length && depth > 0) {
      if (masked[p] === "(") depth++;
      else if (masked[p] === ")") depth--;
      p++;
    }
    // 같은 문장(맨 바깥 ; 전)의 첫 달러 따옴표 = 본문
    const stmtEnd = (() => {
      let q = p;
      while (q < masked.length) {
        const d = dollars.find((x) => x.start === q);
        if (d) { q = d.end; continue; }
        if (masked[q] === ";") return q;
        q++;
      }
      return masked.length;
    })();
    const body = dollars.find((d) => d.start >= p && d.start < stmtEnd);
    if (!body) continue; // 따옴표('…') 본문 등 — 이 점검에서 다루지 않음
    events.push({ kind: "create", name: m[2].toLowerCase(), md5: md5(normBody(sql.slice(body.contentStart, body.contentEnd))), at: m.index });
  }
  const dropRe = new RegExp(String.raw`\bdrop\s+(?:function|procedure)\s+(?:if\s+exists\s+)?` + nameRe, "gi");
  for (const m of masked.matchAll(dropRe)) {
    if (inDollar(m.index)) continue;
    events.push({ kind: "drop", name: m[1].toLowerCase(), at: m.index });
  }
  if (/pg_get_functiondef/i.test(sql)) {
    // 'get_x' · 'public.get_x' · 'public.get_x(uuid)' · 'public.get_x(uuid)|lc' 꼴 (목록을 돌며 덧대는 경우 포함)
    for (const m of sql.matchAll(/'(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)(?=[('|])/g)) {
      events.push({ kind: "patch", name: m[1].toLowerCase(), at: m.index });
    }
  }
  return events.sort((a, b) => a.at - b.at);
}

/** 저장소 전체: 이름별 정의 이력(옛→새) · 마지막이 drop 인지 · 마지막 정의 뒤에 덧대기가 있는지 */
export function readRepo() {
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  const byName = new Map();
  const patchOnly = new Set(); // 저장소에 create 없이 덧대기만 있는 이름(DB 에만 있던 함수를 고친 것)
  for (const f of files) {
    const sql = readFileSync(join(MIG_DIR, f), "utf8");
    for (const e of parseMigration(sql)) {
      if (e.kind === "patch") {
        const h = byName.get(e.name);
        if (h) h.patched = true; // 모르는 이름(일반 문자열)은 무시
        else patchOnly.add(e.name);
        continue;
      }
      const h = byName.get(e.name) ?? { bodies: [], dropped: false, patched: false };
      if (e.kind === "create") { h.bodies.push(e.md5); h.dropped = false; h.patched = false; }
      else h.dropped = true;
      byName.set(e.name, h);
    }
  }
  byName.patchOnly = patchOnly;
  return byName;
}

async function findAnonKey() {
  const html = await (await fetch(SITE + "/")).text();
  const js = /\/assets\/index-[A-Za-z0-9_-]+\.js/.exec(html)?.[0];
  if (!js) throw new Error("운영 사이트에서 앱 파일을 못 찾음");
  const code = await (await fetch(SITE + js)).text();
  for (const tok of code.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      const p = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString("utf8"));
      if (p.ref === PROJECT_REF && p.role === "anon") return tok;
    } catch { /* 다음 후보 */ }
  }
  const pub = /sb_publishable_[A-Za-z0-9_-]+/.exec(code)?.[0];
  if (pub) return pub;
  throw new Error("운영 사이트에서 공개 앱 키를 못 찾음");
}

async function fetchDb() {
  const file = opt("--db");
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  const url = process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
  const key = process.env.SUPABASE_ANON_KEY || (await findAnonKey());
  let last;
  for (let t = 0; t < 3; t++) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/repo_drift_fingerprints`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("DB 지문이 비어 있음");
      return rows;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 3000 * (t + 1)));
    }
  }
  throw last;
}

export function classify(db, repo) {
  const dbByName = new Map();
  for (const r of db) {
    const k = String(r.name).toLowerCase();
    const list = dbByName.get(k) ?? [];
    list.push(r);
    dbByName.set(k, list);
  }
  const out = { db_edited: [], behind: [], db_only: [], repo_only: [], patched: [] };
  for (const [name, rows] of dbByName) {
    const h = repo.get(name);
    if (!h || h.bodies.length === 0) {
      const bucket = repo.patchOnly?.has(name) ? out.patched : out.db_only;
      for (const r of rows) bucket.push(`${name}:${r.md5}`);
      continue;
    }
    // 같은 이름 함수가 DB 에 여러 개(인자 다름)면 저장소 마지막 정의 여러 개와 비교한다
    const latest = new Set(h.bodies.slice(-Math.max(1, rows.length)));
    const all = new Set(h.bodies);
    for (const r of rows) {
      if (latest.has(r.md5)) continue;
      if (all.has(r.md5)) out.behind.push(`${name}:${r.md5}`);
      else if (h.patched) out.patched.push(`${name}:${r.md5}`);
      else out.db_edited.push(`${name}:${r.md5}`);
    }
  }
  for (const [name, h] of repo) {
    if (!h.dropped && h.bodies.length && !dbByName.has(name)) out.repo_only.push(name);
  }
  for (const k of Object.keys(out)) out[k].sort();
  return out;
}

const LABEL = {
  db_edited: "DB 에서만 고친 함수 — 저장소에 마이그레이션 파일로 남기세요(지금 정의는 pg_get_functiondef)",
  behind: "저장소의 새 정의가 DB 에 안 들어간 함수 — 마이그레이션 적용을 확인하세요",
  db_only: "저장소에 정의가 없는 DB 함수",
  repo_only: "저장소엔 있는데 DB 에 없는 함수",
  patched: "덧대기(DO 블록 replace)로 고친 함수 — 저장소 전체 본문이 옛것이라, 고칠 땐 DB 지금 정의 위에",
};
// 알리기만 하고 실패로 세지 않는 분류 (덧대기는 저장소에 기록이 있다)
const INFO_ONLY = new Set(["patched"]);

async function main() {
  const repo = readRepo();
  const db = await fetchDb();
  const now = classify(db, repo);

  if (flag("--write-baseline")) {
    writeFileSync(BASELINE, JSON.stringify({ note: "scripts/check-db-drift.mjs 기준선 — 여기 있는 어긋남은 알리지 않는다(이미 알던 것). 고치면 --write-baseline 으로 다시 저장.", generated_at: new Date().toISOString(), db_functions: db.length, ...now }, null, 2) + "\n");
    console.log(`기준선 저장: DB 함수 ${db.length}개 · ` + Object.entries(now).map(([k, v]) => `${k} ${v.length}`).join(" · "));
    return 0;
  }

  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
  const lines = [];
  let fresh = 0;
  for (const k of Object.keys(now)) {
    const known = new Set(base[k] ?? []);
    const add = now[k].filter((x) => !known.has(x));
    const gone = (base[k] ?? []).filter((x) => !now[k].includes(x));
    if (!INFO_ONLY.has(k)) fresh += add.length;
    if (add.length) {
      lines.push(`${INFO_ONLY.has(k) ? "ℹ" : "✖"} ${LABEL[k]} — 새로 ${add.length}개`);
      for (const x of add) lines.push(`    ${x.split(":")[0]}`);
    }
    if (gone.length) lines.push(`✔ 기준선에서 풀린 것(${k}) ${gone.length}개 — 기준선을 다시 저장해도 됩니다`);
  }
  const head = `DB 어긋남 점검 — DB 함수 ${db.length}개 · 저장소 정의 ${repo.size}개 · 새 어긋남 ${fresh}개`;
  const text = [head, ...(lines.length ? lines : ["새 어긋남 없음 👍"]), "(Edge Function 은 이 점검에 없음 — 배포 전에 지금 배포본과 비교)"].join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "```\n" + text + "\n```\n");
  return fresh ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("DB 어긋남 점검 실패:", e instanceof Error ? e.message : e);
    process.exit(2);
  });
}
