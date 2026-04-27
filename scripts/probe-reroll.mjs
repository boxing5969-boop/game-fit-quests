/**
 * generateMealPlan 동작 시뮬레이션 — 10회 reroll 시 각 슬롯의 고유 메뉴 개수 측정.
 * 빌드된 dist 가 아닌, 메뉴 라이브러리에서 직접 모드 풀 추출 후 무작위 선택을 흉내.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1")), "..");
const src = await readFile(path.join(ROOT, "src/data/nutrition/mealLibrary.ts"), "utf8");

const items = [];
const tupleRe = /\["([^"]+)",\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*"(breakfast|lunch|dinner|snack)",\s*\[([^\]]*)\]\]/g;
let m, idx = 0;
while ((m = tupleRe.exec(src)) !== null) {
  idx++;
  const id = `meal_${String(idx).padStart(4, "0")}`;
  const tags = [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  items.push({ id, name: m[1], type: m[2], tags });
}

function modeFilter(it, mode) {
  if (mode === "random") return true;
  const allow = mode === "home_korean" ? ["korean", "home"] : ["quick", "simple", "office"];
  return it.tags.some((t) => allow.includes(t));
}

function simulate(mode, rerolls = 10) {
  const recents = [];
  const RECENT_LIMIT = 10;
  const slots = ["breakfast", "lunch", "dinner"];
  const picksHistory = { breakfast: [], lunch: [], dinner: [] };

  for (let r = 0; r < rerolls; r++) {
    const used = new Set();
    const avoid = new Set(recents);
    for (const slot of slots) {
      const pool = items.filter((i) => i.type === slot && modeFilter(i, mode));
      const fresh = pool.filter((i) => !avoid.has(i.id) && !used.has(i.id));
      const candidates = fresh.length > 0 ? fresh : pool;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      used.add(pick.id);
      picksHistory[slot].push(pick.name);
    }
    // 누적 회피 큐 갱신 — 최근 10개
    const newCodes = slots.map((s) => picksHistory[s][r]);
    const fresh = recents.filter((c) => !newCodes.includes(c));
    recents.length = 0;
    recents.push(...[...fresh, ...newCodes].slice(-RECENT_LIMIT));
  }

  return picksHistory;
}

for (const mode of ["random", "home_korean", "office_quick"]) {
  console.log(`\n=== ${mode} ===`);
  const h = simulate(mode, 10);
  for (const slot of ["breakfast", "lunch", "dinner"]) {
    const unique = new Set(h[slot]).size;
    console.log(`  ${slot}: ${unique}개 고유 / 10회 reroll`);
    console.log(`    picks: ${h[slot].slice(0, 5).join(" | ")}...`);
  }
}
