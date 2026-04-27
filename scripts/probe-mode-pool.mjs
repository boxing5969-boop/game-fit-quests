/**
 * home_korean / office_quick 모드 풀 크기 + 슬롯별 분포 검증.
 * 실행: node scripts/probe-mode-pool.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1")), "..");
const src = await readFile(path.join(ROOT, "src/data/nutrition/mealLibrary.ts"), "utf8");

// v6.1 RAW 튜플 파싱 — ["name", cal, pro, carb, fat, "type", [...tags]]
const items = [];
const tupleRe = /\["([^"]+)",\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*"(breakfast|lunch|dinner|snack)",\s*\[([^\]]*)\]\]/g;
let m;
while ((m = tupleRe.exec(src)) !== null) {
  const name = m[1];
  const type = m[2];
  const tags = [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  items.push({ name, slots: [type], tags });
}

console.log(`총 메뉴: ${items.length}개`);

const HOME_KOREAN = ["korean", "home"];
const OFFICE_QUICK = ["quick", "simple", "office"];

function poolFor(allow) {
  return items.filter((it) => it.tags.some((t) => allow.includes(t)));
}

const hk = poolFor(HOME_KOREAN);
const oq = poolFor(OFFICE_QUICK);

console.log(`\n[home_korean] 풀 크기: ${hk.length}개`);
const hkBySlot = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
hk.forEach((it) => it.slots.forEach((s) => hkBySlot[s] != null && (hkBySlot[s]++)));
console.log(`  슬롯별 가능: 아침=${hkBySlot.breakfast}, 점심=${hkBySlot.lunch}, 저녁=${hkBySlot.dinner}, 간식=${hkBySlot.snack}`);

console.log(`\n[office_quick] 풀 크기: ${oq.length}개`);
const oqBySlot = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
oq.forEach((it) => it.slots.forEach((s) => oqBySlot[s] != null && (oqBySlot[s]++)));
console.log(`  슬롯별 가능: 아침=${oqBySlot.breakfast}, 점심=${oqBySlot.lunch}, 저녁=${oqBySlot.dinner}, 간식=${oqBySlot.snack}`);

console.log(`\n[random] 풀 크기: ${items.length}개 (전체)`);
