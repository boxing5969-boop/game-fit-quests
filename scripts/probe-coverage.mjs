/**
 * 가중 무작위 선택 시 메인 3슬롯이 평균 몇 % 영양 충족하는지 시뮬레이션.
 * 30회 reroll × 3 모드. 단백질/섬유 평균 + 부족 케이스 빈도.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1")), "..");
const src = await readFile(path.join(ROOT, "src/data/nutrition/mealLibrary.ts"), "utf8");

const items = [];
const tupleRe = /\["([^"]+)",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*"(breakfast|lunch|dinner|snack)",\s*\[([^\]]*)\]\]/g;
let m, idx = 0;
while ((m = tupleRe.exec(src)) !== null) {
  idx++;
  const tags = [...m[7].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const name = m[1];
  // 섬유 추정 (라이브러리 estimateFiber 와 동일 로직)
  const carbs = +m[4];
  const HIGH_FIBER = ["현미", "잡곡", "통밀", "오트", "귀리", "보리", "콩", "두부", "시금치", "케일", "브로콜리", "양배추", "고구마", "호박", "버섯", "샐러드", "나물", "쌈", "채소"];
  let fiberG = Math.max(2, Math.round(carbs * 0.06));
  for (const kw of HIGH_FIBER) if (name.includes(kw)) fiberG += 2;
  fiberG = Math.min(fiberG, 14);
  items.push({
    id: `meal_${String(idx).padStart(4, "0")}`,
    name, type: m[6], tags,
    kcal: +m[2], proteinG: +m[3], carbsG: +m[4], fatG: +m[5],
    fiberG,
    hasProbiotic: ["김치", "된장", "청국장", "낫또", "요거트", "고추장"].some((k) => name.includes(k)),
  });
}

function modeFilter(it, mode) {
  if (mode === "random") return true;
  const allow = mode === "home_korean" ? ["korean", "home"] : ["quick", "simple", "office"];
  return it.tags.some((t) => allow.includes(t));
}

function weightedPick(pool) {
  const weights = pool.map((m) => {
    let proteinTier;
    if (m.proteinG >= 30) proteinTier = m.proteinG * m.proteinG * 0.15;
    else if (m.proteinG >= 25) proteinTier = m.proteinG * m.proteinG * 0.08;
    else if (m.proteinG >= 20) proteinTier = m.proteinG * m.proteinG * 0.04;
    else if (m.proteinG >= 15) proteinTier = m.proteinG * 0.5;
    else proteinTier = m.proteinG * 0.1;
    const fiberW = Math.pow(m.fiberG, 1.5) * 0.4;
    const probioticW = m.hasProbiotic ? 8 : 0;
    return 0.2 + proteinTier + fiberW + probioticW;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function simulate(mode, target) {
  const N = 30;
  const slotTargets = { breakfast: target.proteinG * 0.27, lunch: target.proteinG * 0.36, dinner: target.proteinG * 0.36 };
  const FIBER_TARGET = 25;
  const stats = { protein: [], fiber: [], probiotic: 0 };
  for (let r = 0; r < N; r++) {
    const used = new Set();
    let totalP = 0, totalF = 0, hasProb = false;
    for (const slot of ["breakfast", "lunch", "dinner"]) {
      const pool = items.filter((it) => it.type === slot && modeFilter(it, mode) && !used.has(it.id));
      if (pool.length === 0) continue;
      const picked = weightedPick(pool);
      used.add(picked.id);
      totalP += picked.proteinG;
      totalF += picked.fiberG;
      if (picked.hasProbiotic) hasProb = true;
    }
    stats.protein.push(totalP);
    stats.fiber.push(totalF);
    if (hasProb) stats.probiotic++;
  }
  const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / a.length);
  const proteinAvg = avg(stats.protein);
  const fiberAvg = avg(stats.fiber);
  console.log(`[${mode}] (목표 단백질 ${target.proteinG}g, 섬유 ${FIBER_TARGET}g)`);
  console.log(`  단백질 평균: ${proteinAvg}g (${Math.round(proteinAvg / target.proteinG * 100)}%) · min ${Math.min(...stats.protein)}, max ${Math.max(...stats.protein)}`);
  console.log(`  섬유 평균:   ${fiberAvg}g (${Math.round(fiberAvg / FIBER_TARGET * 100)}%) · min ${Math.min(...stats.fiber)}, max ${Math.max(...stats.fiber)}`);
  console.log(`  유산균 hit:  ${stats.probiotic}/${N}회 (${Math.round(stats.probiotic / N * 100)}%)`);
}

// 일반 회원: 70kg 활동중인 남성 → 단백질 ~120g
const target = { proteinG: 120 };
for (const mode of ["random", "home_korean", "office_quick"]) {
  simulate(mode, target);
  console.log("");
}
