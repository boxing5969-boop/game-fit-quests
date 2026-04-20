// Generates docs/customization-catalog.html from hardcoded snapshots of
// characterPresets.ts / characterCustomizationData.ts / unlockRules.ts.
//
// The snapshots below are pulled verbatim from the source files; they
// must be refreshed when the catalog changes. Run with:
//   node docs/build-customization-catalog.mjs
//
// Then render to PDF via (Windows Edge headless):
//   msedge --headless --disable-gpu --print-to-pdf="docs/customization-catalog.pdf" --no-pdf-header-footer "file:///C:/.../docs/customization-catalog.html"

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ══ SNAPSHOTS ═════════════════════════════════════════════════════
// Level rules from src/data/unlockRules.ts (requiredLevel + optional
// displayNameOverride). Items not listed here have no level gate.
const LEVEL_RULES = {
  effect: {
    sparkle: 1, stars: 1, wind: 1, daisy: 1,
    flame: 5, hearts: 5, sunflower: 5,
    lightning: 10, snow: 10, music: 10,
    cherry: 15, tulip: 15, firework: 15,
    tornado: 20, comet: 20, rainbow: 20,
    rose: 30, explosion: 30, phoenix: 30, dragon: 30,
  },
  frame: {
    basic_white: 1, fire: 1,
    ice: 5,
    ocean: 10, emerald: 10,
    gold: 20, rainbow: 20,
    galaxy: 30, holy: 30,
    eternal: 50,
  },
  title: {
    beginner: 1,
    trainee: 5,
    fighter: 10,
    warrior: 15,
    iron_fist: 20,
    thunder_king: 30,
    champion: 50,
    legend: 99,
  },
  aura: {
    aura_ocean: 1,
    aura_emerald: 5,
    aura_phantom: 10,
    aura_fire: 20,
    halo_black_gold: 30,
    aura_rainbow: 50,
  },
};

// 프리셋 캐릭터 48종 — characterPresets.ts:59
const PRESETS = [
  { style: "male_01",   label: "루키",           gender: "male",   league: "white", price: 0 },
  { style: "female_01", label: "블루 에이스",     gender: "female", league: "white", price: 0 },
  { style: "male_02",   label: "아이언 챔프",     gender: "male",   league: "white", price: 0 },
  { style: "female_02", label: "레드 퓨어리",     gender: "female", league: "white", price: 200 },
  { style: "male_03",   label: "그린 호크",       gender: "male",   league: "white", price: 250 },
  { style: "female_03", label: "퍼플 레인",       gender: "female", league: "white", price: 300 },
  { style: "male_04",   label: "스트리트 킹",     gender: "male",   league: "white", price: 350 },
  { style: "female_04", label: "골든 듀크",       gender: "female", league: "white", price: 400 },
  { style: "male_05",   label: "실버 폭스",       gender: "male",   league: "white", price: 450 },
  { style: "female_05", label: "체리",            gender: "female", league: "white", price: 450 },
  { style: "male_06",   label: "미드나잇",        gender: "male",   league: "white", price: 500 },
  { style: "female_06", label: "민트 브리즈",     gender: "female", league: "white", price: 500 },
  { style: "female_pink_01", label: "체리 뵄",    gender: "female", league: "blue",  price: 800 },
  { style: "female_pink_02", label: "로즈 워리어", gender: "female", league: "blue",  price: 900 },
  { style: "male_blue_01",   label: "썬더볼트",    gender: "male",   league: "blue",  price: 1000 },
  { style: "male_blue_02",   label: "라이트닝",    gender: "male",   league: "blue",  price: 1100 },
  { style: "male_blue_03",   label: "사이클론",    gender: "male",   league: "blue",  price: 1200 },
  { style: "male_gold_01",   label: "골든 너클",   gender: "male",   league: "red",   price: 1500 },
  { style: "male_gold_02",   label: "카이저",      gender: "male",   league: "red",   price: 2000 },
  { style: "new_13",         label: "알리",        gender: "male",   league: "black", price: 180000, hof: true },
  { style: "kpop_02",        label: "디바",        gender: "female", league: "red",   price: 2000 },
  { style: "kpop_03",        label: "슈퍼노바",    gender: "female", league: "red",   price: 2500 },
  { style: "master_male_01", label: "킹 코브라",   gender: "male",   league: "black", price: 3000 },
  { style: "master_male_02", label: "다크 나이트", gender: "male",   league: "black", price: 4000 },
  { style: "nika_male_03",   label: "라이즈",      gender: "male",   league: "black", price: 7000 },
  { style: "female_master_01", label: "다이아 퀸",   gender: "female", league: "black", price: 5000 },
  { style: "female_master_02", label: "라일락 엠프레스", gender: "female", league: "black", price: 6000 },
  { style: "female_gm_01",   label: "실버 페가수스",  gender: "female", league: "black", price: 8000 },
  { style: "female_gm_02",   label: "어비스",         gender: "female", league: "black", price: 8000 },
  { style: "female_gm_03",   label: "도미네이터",     gender: "female", league: "black", price: 10000 },
  { style: "new_16", label: "153 블레이즈",    gender: "male",   league: "black", price: 190000, hof: true },
  { style: "new_17", label: "153 퓨리",        gender: "male",   league: "black", price: 190000, hof: true },
  { style: "new_14", label: "153 나이트",      gender: "male",   league: "black", price: 200000, hof: true },
  { style: "new_18", label: "153 골든 스트라이커", gender: "male", league: "black", price: 210000, hof: true },
  { style: "new_01", label: "153 에이스",      gender: "male",   league: "black", price: 200000, hof: true },
  { style: "new_02", label: "153 챔피언",      gender: "male",   league: "black", price: 220000, hof: true },
  { style: "new_03", label: "153 레전드 퀸",   gender: "female", league: "black", price: 240000, hof: true },
  { style: "new_04", label: "153 마이스터",    gender: "male",   league: "black", price: 250000, hof: true },
  { style: "new_05", label: "153 에이스",      gender: "male",   league: "black", price: 210000, hof: true },
  { style: "new_06", label: "153 APEX 킹",     gender: "male",   league: "black", price: 260000, hof: true },
  { style: "new_07", label: "153 워리어",      gender: "male",   league: "black", price: 230000, hof: true },
  { style: "new_08", label: "153 레전드",      gender: "male",   league: "black", price: 270000, hof: true },
  { style: "new_09", label: "153 다크 퀸",     gender: "female", league: "black", price: 280000, hof: true },
  { style: "new_10", label: "153 크라운",      gender: "male",   league: "black", price: 270000, hof: true },
  { style: "new_11", label: "153 스타 퀸",     gender: "female", league: "black", price: 290000, hof: true },
  { style: "new_12", label: "마이크 타이거",   gender: "male",   league: "black", price: 320000, hof: true },
];

// 이펙트 36종 — characterCustomizationData.ts:40
const EFFECTS = [
  { key: "sparkle", label: "반짝이", price: 0, league: "white", rarity: "common", desc: "캐릭터 주변에 반짝이는 파티클" },
  { key: "stars", label: "별", price: 0, league: "white", rarity: "common", desc: "별이 떠다니는 효과" },
  { key: "flame", label: "불꽃", price: 300, league: "white", rarity: "common", desc: "타오르는 불꽃 이펙트" },
  { key: "hearts", label: "하트", price: 300, league: "white", rarity: "common", desc: "하트가 둥둥 떠오르는 효과" },
  { key: "wind", label: "바람", price: 200, league: "white", rarity: "common", desc: "바람이 부는 효과" },
  { key: "clover", label: "클로버", price: 400, league: "white", rarity: "common", desc: "행운의 클로버 파티클" },
  { key: "daisy", label: "데이지", price: 300, league: "white", rarity: "common", desc: "하얀 데이지꽃이 피어나는 효과" },
  { key: "sunflower", label: "해바라기", price: 400, league: "white", rarity: "common", desc: "해바라기가 반짝이는 효과" },
  { key: "lightning", label: "번개", price: 800, league: "blue", rarity: "uncommon", desc: "번개 스파크 이펙트" },
  { key: "snow", label: "눈송이", price: 800, league: "blue", rarity: "uncommon", desc: "눈이 내리는 효과" },
  { key: "cherry", label: "벚꽃", price: 1000, league: "blue", rarity: "uncommon", desc: "벚꽃잎이 흩날리는 효과" },
  { key: "tulip", label: "튤립", price: 1000, league: "blue", rarity: "uncommon", desc: "알록달록 튤립이 흩날리는 효과" },
  { key: "hibiscus", label: "히비스커스", price: 1200, league: "blue", rarity: "uncommon", desc: "빨간 히비스커스가 피어나는 효과" },
  { key: "music", label: "음표", price: 1000, league: "blue", rarity: "uncommon", desc: "음표가 떠다니는 효과" },
  { key: "firework", label: "폭죽", price: 1200, league: "blue", rarity: "uncommon", desc: "축하 폭죽 이펙트" },
  { key: "tornado", label: "회오리", price: 3000, league: "red", rarity: "rare", desc: "강력한 회오리 이펙트" },
  { key: "comet", label: "혜성", price: 3000, league: "red", rarity: "rare", desc: "혜성이 스쳐 지나가는 효과" },
  { key: "rainbow", label: "무지개", price: 3500, league: "red", rarity: "rare", desc: "무지개 빛 파티클" },
  { key: "rose", label: "장미", price: 3000, league: "red", rarity: "rare", desc: "빨간 장미가 흩뿌려지는 효과" },
  { key: "bouquet", label: "꽃다발", price: 4000, league: "red", rarity: "rare", desc: "화려한 꽃다발이 피어나는 효과" },
  { key: "explosion", label: "폭발", price: 3500, league: "red", rarity: "rare", desc: "펀치 폭발 이펙트" },
  { key: "ghost", label: "유령", price: 4000, league: "red", rarity: "rare", desc: "유령이 떠다니는 효과" },
  { key: "star_shoot", label: "별똥별", price: 4000, league: "red", rarity: "rare", desc: "별똥별이 쏟아지는 효과" },
  { key: "crown_effect", label: "왕관빛", price: 5000, league: "black", rarity: "epic", desc: "왕관에서 빛이 뿜어나오는 효과", blackOnly: true },
  { key: "dragon", label: "드래곤", price: 8000, league: "black", rarity: "epic", desc: "드래곤 브레스 이펙트", blackOnly: true },
  { key: "phoenix", label: "피닉스", price: 10000, league: "black", rarity: "epic", desc: "불사조 날갯짓 이펙트", blackOnly: true },
  { key: "skull", label: "해골", price: 12000, league: "black", rarity: "epic", desc: "해골 불꽃 이펙트", blackOnly: true },
  { key: "diamond_rain", label: "다이아 비", price: 15000, league: "black", rarity: "epic", desc: "다이아몬드가 쏟아지는 효과", blackOnly: true },
  { key: "inferno_dual", label: "쌍염화", price: 18000, league: "black", rarity: "epic", desc: "빨강+파랑 쌍불꽃이 교차하는 이펙트", blackOnly: true },
  { key: "thunder_god", label: "뇌신", price: 20000, league: "black", rarity: "epic", desc: "천둥번개가 연속으로 치는 이펙트", blackOnly: true },
  { key: "cosmic_dust", label: "우주먼지", price: 22000, league: "black", rarity: "epic", desc: "별가루가 반짝이며 흩날리는 이펙트", blackOnly: true },
  { key: "sword_aura", label: "검기", price: 25000, league: "black", rarity: "epic", desc: "검 기운이 감도는 이펙트", blackOnly: true },
  { key: "dark_flame", label: "흑염", price: 30000, league: "black", rarity: "epic", desc: "검은 불꽃이 타오르는 이펙트", blackOnly: true },
  { key: "lotus", label: "연꽃", price: 10000, league: "black", rarity: "epic", desc: "신비로운 연꽃이 피어나는 이펙트", blackOnly: true },
  { key: "sakura_storm", label: "벚꽃폭풍", price: 15000, league: "black", rarity: "epic", desc: "벚꽃잎이 폭풍처럼 휘몰아치는 이펙트", blackOnly: true },
  { key: "rose_gold", label: "로즈골드", price: 20000, league: "black", rarity: "epic", desc: "황금빛 장미가 화려하게 피어나는 이펙트", blackOnly: true },
];

// 프레임 28종 — characterCustomizationData.ts:84
const FRAMES = [
  { key: "none", label: "없음", price: 0, league: "white", rarity: "common", desc: "프레임 없음" },
  { key: "basic_white", label: "기본 화이트", price: 0, league: "white", rarity: "common", desc: "깔끔한 화이트 링" },
  { key: "fire", label: "불꽃 프레임", price: 300, league: "white", rarity: "common", desc: "불타는 프레임" },
  { key: "ice", label: "얼음 프레임", price: 300, league: "white", rarity: "common", desc: "차가운 얼음 프레임" },
  { key: "moon", label: "달빛 프레임", price: 500, league: "white", rarity: "common", desc: "은은한 달빛 프레임" },
  { key: "lightning", label: "번개 프레임", price: 800, league: "blue", rarity: "uncommon", desc: "번개치는 프레임" },
  { key: "cherry", label: "벚꽃 프레임", price: 800, league: "blue", rarity: "uncommon", desc: "벚꽃잎 프레임" },
  { key: "electric", label: "전기 프레임", price: 1000, league: "blue", rarity: "uncommon", desc: "전류가 흐르는 프레임" },
  { key: "ocean", label: "오션 프레임", price: 1000, league: "blue", rarity: "uncommon", desc: "바다를 담은 프레임" },
  { key: "emerald", label: "에메랄드 프레임", price: 1200, league: "blue", rarity: "uncommon", desc: "에메랄드빛 프레임" },
  { key: "sakura", label: "사쿠라 프레임", price: 1500, league: "blue", rarity: "uncommon", desc: "사쿠라 핑크 프레임" },
  { key: "diamond", label: "다이아 프레임", price: 1800, league: "blue", rarity: "uncommon", desc: "다이아 반짝임 프레임" },
  { key: "gold", label: "골드 프레임", price: 2500, league: "red", rarity: "rare", desc: "황금빛 프레임" },
  { key: "rainbow", label: "무지개 프레임", price: 2500, league: "red", rarity: "rare", desc: "무지개 프레임" },
  { key: "blood", label: "블러드 링", price: 3000, league: "red", rarity: "rare", desc: "핏빛 링 프레임" },
  { key: "dark_red", label: "블러드 레드", price: 3000, league: "red", rarity: "rare", desc: "진한 블러드 프레임" },
  { key: "purple", label: "퍼플 미스트", price: 3000, league: "red", rarity: "rare", desc: "보라색 안개 프레임" },
  { key: "neon", label: "네온 프레임", price: 3500, league: "red", rarity: "rare", desc: "네온빛 프레임" },
  { key: "crystal", label: "크리스탈", price: 3500, league: "red", rarity: "rare", desc: "크리스탈 프레임" },
  { key: "storm", label: "폭풍 프레임", price: 4000, league: "red", rarity: "rare", desc: "폭풍이 감싸는 프레임" },
  { key: "neon_green", label: "네온 그린", price: 4500, league: "red", rarity: "rare", desc: "네온 그린 프레임" },
  { key: "shadow", label: "섀도우 프레임", price: 5000, league: "black", rarity: "epic", desc: "어둠의 그림자 프레임", blackOnly: true },
  { key: "galaxy", label: "갤럭시 링", price: 6000, league: "black", rarity: "epic", desc: "우주를 담은 프레임", blackOnly: true },
  { key: "rainbow_frame", label: "레인보우 사이클", price: 7000, league: "black", rarity: "epic", desc: "무지개가 회전하는 프레임", blackOnly: true },
  { key: "holy", label: "홀리 링", price: 7000, league: "black", rarity: "epic", desc: "신성한 빛 프레임", blackOnly: true },
  { key: "inferno", label: "인페르노", price: 8000, league: "black", rarity: "epic", desc: "지옥불 프레임", blackOnly: true },
  { key: "void", label: "보이드", price: 10000, league: "black", rarity: "epic", desc: "공허의 어둠 프레임", blackOnly: true },
  { key: "eternal", label: "이터널", price: 15000, league: "black", rarity: "epic", desc: "영원의 빛 프레임", blackOnly: true },
];

// 칭호 27종 — characterCustomizationData.ts:120
const TITLES = [
  { key: "rookie", label: "루키", price: 0, league: "white", rarity: "common", desc: "첫걸음을 뗀 복서" },
  { key: "beginner", label: "초보", price: 0, league: "white", rarity: "common", desc: "성장하는 초보 복서" },
  { key: "trainee", label: "수련생", price: 300, league: "white", rarity: "common", desc: "땀흘리는 수련생" },
  { key: "goal_getter", label: "목표달성러", price: 400, league: "white", rarity: "common", desc: "목표를 향해 달려가는 자" },
  { key: "attendance_king", label: "출석왕", price: 500, league: "white", rarity: "common", desc: "꾸준히 출석하는 왕" },
  { key: "fighter", label: "파이터", price: 800, league: "blue", rarity: "uncommon", desc: "불꽃처럼 싸우는 전사" },
  { key: "warrior", label: "전사", price: 1000, league: "blue", rarity: "uncommon", desc: "강철 의지의 전사" },
  { key: "speedster", label: "스피드스터", price: 1200, league: "blue", rarity: "uncommon", desc: "빛보다 빠른 권투선수" },
  { key: "iron_fist", label: "아이언 피스트", price: 1500, league: "blue", rarity: "uncommon", desc: "강철 주먹의 소유자" },
  { key: "fire_fighter", label: "불꽃 파이터", price: 1800, league: "blue", rarity: "uncommon", desc: "불꽃을 두른 파이터" },
  { key: "night_hunter", label: "나이트 헌터", price: 2000, league: "blue", rarity: "uncommon", desc: "밤을 지배하는 사냥꾼" },
  { key: "champion", label: "챔피언", price: 2500, league: "red", rarity: "rare", desc: "링의 챔피언" },
  { key: "destroyer", label: "디스트로이어", price: 3000, league: "red", rarity: "rare", desc: "모든 것을 파괴하는 자" },
  { key: "thunder", label: "썬더", price: 3500, league: "red", rarity: "rare", desc: "천둥의 주먹" },
  { key: "thunder_king", label: "썬더킹", price: 3500, league: "red", rarity: "rare", desc: "천둥을 지배하는 왕" },
  { key: "phoenix_title", label: "피닉스", price: 4000, league: "red", rarity: "rare", desc: "불사조처럼 부활하는 자" },
  { key: "beast", label: "맹수", price: 4500, league: "red", rarity: "rare", desc: "야생의 맹수" },
  { key: "diamond_fighter", label: "다이아 파이터", price: 4500, league: "red", rarity: "rare", desc: "다이아몬드 급 파이터" },
  { key: "153_star", label: "153 스타", price: 5000, league: "red", rarity: "rare", desc: "153의 스타 복서" },
  { key: "legend", label: "레전드", price: 5000, league: "black", rarity: "epic", desc: "전설이 된 복서", blackOnly: true },
  { key: "dragon", label: "드래곤", price: 8000, league: "black", rarity: "epic", desc: "용의 힘을 가진 자", blackOnly: true },
  { key: "shadow_king", label: "그림자왕", price: 10000, league: "black", rarity: "epic", desc: "그림자를 지배하는 왕", blackOnly: true },
  { key: "god_of_war", label: "전쟁의 신", price: 12000, league: "black", rarity: "epic", desc: "링 위의 전쟁 신", blackOnly: true },
  { key: "immortal", label: "불멸", price: 15000, league: "black", rarity: "epic", desc: "절대 쓰러지지 않는 자", blackOnly: true },
  { key: "eternal_153", label: "ETERNAL 153", price: 120000, league: "legend", rarity: "legendary", desc: "153의 영원한 전설", hof: true },
  { key: "king_of_ring", label: "킹 오브 더 링", price: 150000, league: "legend", rarity: "legendary", desc: "링의 절대 지배자", hof: true },
  { key: "god_fist", label: "갓피스트", price: 180000, league: "legend", rarity: "legendary", desc: "신의 주먹", hof: true },
];

// 오라 22종 — characterCustomizationData.ts:156
const AURAS = [
  { key: "none", label: "없음", price: 0, league: "white", rarity: "common", desc: "오라 없음" },
  { key: "soft_glow", label: "은은한 빛", price: 300, league: "white", rarity: "common", desc: "부드러운 빛 오라" },
  { key: "aura_mint", label: "민트 오라", price: 400, league: "white", rarity: "common", desc: "상쾌한 민트 빛" },
  { key: "aura_fire", label: "불꽃 오라", price: 800, league: "blue", rarity: "uncommon", desc: "불꽃이 타오르는 오라" },
  { key: "aura_ice", label: "얼음 오라", price: 800, league: "blue", rarity: "uncommon", desc: "차가운 얼음 오라" },
  { key: "aura_sakura", label: "벚꽃 오라", price: 1000, league: "blue", rarity: "uncommon", desc: "벚꽃잎이 흩날리는 오라" },
  { key: "aura_ocean", label: "오션 오라", price: 1200, league: "blue", rarity: "uncommon", desc: "깊은 바다의 오라" },
  { key: "aura_lightning", label: "번개 오라", price: 1500, league: "blue", rarity: "uncommon", desc: "번개가 치는 오라" },
  { key: "aura_emerald", label: "에메랄드 오라", price: 1500, league: "blue", rarity: "uncommon", desc: "에메랄드빛 오라" },
  { key: "aura_blood", label: "블러드 오라", price: 3000, league: "red", rarity: "rare", desc: "핏빛 오라" },
  { key: "aura_sunset", label: "석양 오라", price: 3500, league: "red", rarity: "rare", desc: "노을빛 그라데이션 오라" },
  { key: "aura_rainbow", label: "무지개 오라", price: 4000, league: "red", rarity: "rare", desc: "무지개빛 오라" },
  { key: "aura_neon", label: "네온 오라", price: 5000, league: "red", rarity: "rare", desc: "네온 사인 오라" },
  { key: "aura_galaxy", label: "은하 오라", price: 8000, league: "red", rarity: "rare", desc: "은하계 오라" },
  { key: "aura_dark", label: "어둠 오라", price: 10000, league: "black", rarity: "epic", desc: "어둠의 오라", blackOnly: true },
  { key: "aura_infernal", label: "인퍼널 오라", price: 12000, league: "black", rarity: "epic", desc: "지옥불 오라", blackOnly: true },
  { key: "aura_phantom", label: "팬텀 오라", price: 12000, league: "black", rarity: "epic", desc: "유령빛 오라", blackOnly: true },
  { key: "halo_black_gold", label: "황금 헤일로", price: 15000, league: "black", rarity: "epic", desc: "블랙 골드 헤일로", blackOnly: true },
  { key: "aura_void", label: "보이드 오라", price: 18000, league: "black", rarity: "epic", desc: "공허의 오라", blackOnly: true },
  { key: "halo_rainbow_master", label: "마스터 헤일로", price: 240000, league: "legend", rarity: "legendary", desc: "무지개 마스터 오라", hof: true },
  { key: "divine", label: "신성 오라", price: 280000, league: "legend", rarity: "legendary", desc: "신성한 빛의 오라", hof: true },
  { key: "aura_celestial", label: "천체 오라", price: 320000, league: "legend", rarity: "legendary", desc: "별과 우주의 오라", hof: true },
];

// 후광 5종 (마스터 전용) — characterCustomizationData.ts:187
const HALOS = [
  { key: "none", label: "없음", price: 0, league: "black", rarity: "epic", desc: "후광 없음", blackOnly: true },
  { key: "halo_rainbow", label: "무지개 후광", price: 0, league: "black", rarity: "epic", desc: "무지개빛이 회전하는 후광", blackOnly: true },
  { key: "halo_saiyan", label: "초사이어인", price: 30000, league: "black", rarity: "epic", desc: "폭발하는 황금빛 기운", blackOnly: true },
  { key: "halo_eclipse", label: "이클립스", price: 35000, league: "black", rarity: "epic", desc: "일식처럼 타오르는 코로나", blackOnly: true },
  { key: "halo_emperor", label: "황제의 위엄", price: 50000, league: "black", rarity: "epic", desc: "보라+금빛 황제의 후광", blackOnly: true },
];

// ══ HTML TEMPLATE ═════════════════════════════════════════════════

const TODAY = new Date().toISOString().slice(0, 10);
const won = (n) => n.toLocaleString("ko-KR");

const leagueBadge = (l) => {
  const map = {
    white:  { text: "화이트", bg: "#F3F4F6", fg: "#111827" },
    blue:   { text: "블루",   bg: "#DBEAFE", fg: "#1E40AF" },
    red:    { text: "레드",   bg: "#FEE2E2", fg: "#991B1B" },
    black:  { text: "블랙",   bg: "#1F2937", fg: "#F9FAFB" },
    legend: { text: "전설",   bg: "#FEF3C7", fg: "#92400E" },
  };
  const s = map[l] ?? map.white;
  return `<span class="badge" style="background:${s.bg};color:${s.fg}">${s.text}</span>`;
};

const rarityBadge = (r) => {
  const map = {
    common:    { text: "common",    bg: "#E5E7EB", fg: "#374151" },
    uncommon:  { text: "uncommon",  bg: "#D1FAE5", fg: "#065F46" },
    rare:      { text: "rare",      bg: "#DBEAFE", fg: "#1E3A8A" },
    epic:      { text: "epic",      bg: "#EDE9FE", fg: "#5B21B6" },
    legendary: { text: "legendary", bg: "#FEF3C7", fg: "#92400E" },
  };
  const s = map[r] ?? map.common;
  return `<span class="badge small" style="background:${s.bg};color:${s.fg}">${s.text}</span>`;
};

const renderRow = (i, row, category) => {
  const levelRule = LEVEL_RULES[category]?.[row.key];
  const gate =
    row.hof ? `<span class="gate hof">HoF</span>` :
    row.blackOnly ? `<span class="gate black">black</span>` : "";
  const unlockCell =
    levelRule !== undefined
      ? `<span class="lv-pill">Lv.${levelRule}</span>`
      : `<span class="lv-none">—</span>`;
  return `<tr>
    <td class="num">${i + 1}</td>
    <td class="code">${row.key}</td>
    <td>${row.label}${gate}</td>
    <td>${leagueBadge(row.league)}</td>
    <td>${rarityBadge(row.rarity ?? "common")}</td>
    <td class="price">${won(row.price)}</td>
    <td>${unlockCell}</td>
    <td class="blank"></td>
    <td class="blank"></td>
    <td class="desc">${row.desc ?? ""}</td>
  </tr>`;
};

const renderPresetRow = (i, row) => {
  const gate =
    row.hof ? `<span class="gate hof">HoF</span>` : "";
  return `<tr>
    <td class="num">${i + 1}</td>
    <td class="code">${row.style}</td>
    <td>${row.label}${gate}</td>
    <td class="small">${row.gender === "male" ? "남" : "여"}</td>
    <td>${leagueBadge(row.league)}</td>
    <td class="price">${won(row.price)}</td>
    <td class="blank"></td>
    <td class="blank"></td>
    <td class="blank"></td>
  </tr>`;
};

const section = (titleKr, items, category) => {
  const total = items.length;
  const gated = items.filter((x) => LEVEL_RULES[category]?.[x.key] !== undefined).length;
  const blackOnly = items.filter((x) => x.blackOnly).length;
  const hof = items.filter((x) => x.hof).length;
  const rows = items.map((r, i) => renderRow(i, r, category)).join("\n");
  return `
  <section class="cat">
    <h2>${titleKr} <span class="muted">(${total})</span></h2>
    <div class="summary">
      <span class="stat"><b>${gated}</b> 개 레벨 해금 규정됨</span>
      <span class="stat"><b>${total - gated}</b> 개 가격만 (규정 없음)</span>
      <span class="stat"><b>${blackOnly}</b> 개 blackOnly</span>
      <span class="stat"><b>${hof}</b> 개 명예의 전당</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>key</th>
          <th>이름</th>
          <th>리그</th>
          <th>등급</th>
          <th>현재가격</th>
          <th>현재해금</th>
          <th class="new-col">새 가격</th>
          <th class="new-col">새 해금Lv</th>
          <th class="desc">설명</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>`;
};

const presetSection = () => {
  const total = PRESETS.length;
  const hof = PRESETS.filter((p) => p.hof).length;
  const free = PRESETS.filter((p) => p.price === 0).length;
  const rows = PRESETS.map((r, i) => renderPresetRow(i, r)).join("\n");
  return `
  <section class="cat">
    <h2>프리셋 캐릭터 <span class="muted">(${total})</span></h2>
    <div class="summary">
      <span class="stat"><b>${free}</b> 개 무료</span>
      <span class="stat"><b>${total - hof - free}</b> 개 유료 (가격만)</span>
      <span class="stat"><b>${hof}</b> 개 명예의 전당</span>
    </div>
    <p class="note">
      ℹ️ 프리셋 캐릭터는 현재 <b>레벨 해금 규정이 없고 가격만</b> 걸려 있습니다
      (HoF 전용 16개 제외). 레벨 게이트 추가 시 unlockRules.ts 를 presets
      카테고리로 확장해야 합니다.
    </p>
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>style key</th>
          <th>이름</th>
          <th>성별</th>
          <th>리그</th>
          <th>현재가격</th>
          <th class="new-col">새 가격</th>
          <th class="new-col">새 해금Lv</th>
          <th>메모</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>`;
};

const totalCount =
  PRESETS.length + EFFECTS.length + FRAMES.length + TITLES.length + AURAS.length + HALOS.length;
const totalGated =
  Object.values(LEVEL_RULES).reduce((a, m) => a + Object.keys(m).length, 0);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>캐릭터 꾸미기 가격/해금 카탈로그</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo",
                 "Malgun Gothic", system-ui, sans-serif;
    font-size: 10.5px;
    color: #0F172A;
    margin: 0;
    line-height: 1.45;
  }
  h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: -0.02em; }
  h2 { font-size: 16px; margin: 18px 0 6px; letter-spacing: -0.01em;
       padding-bottom: 4px; border-bottom: 2px solid #0F172A; }
  h3 { font-size: 13px; margin: 12px 0 4px; }
  p { margin: 6px 0; }
  .muted { color: #64748B; font-weight: 400; font-size: 13px; }
  .note { background: #FFFBEB; border-left: 3px solid #F59E0B;
          padding: 8px 10px; color: #78350F; font-size: 10px; border-radius: 4px; }

  .cover {
    page-break-after: always;
    text-align: center;
    padding-top: 40mm;
  }
  .cover h1 { font-size: 32px; margin-bottom: 4px; }
  .cover .sub { color: #475569; font-size: 12px; margin-bottom: 32px; }
  .cover .big-num { font-size: 72px; font-weight: 800; color: #DC2626;
                    letter-spacing: -0.04em; line-height: 1; margin: 20px 0 6px; }
  .cover .big-label { color: #64748B; font-size: 12px; margin-bottom: 40px; }
  .cover .grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    max-width: 460px; margin: 0 auto;
  }
  .cover .card {
    border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 10px;
    background: #F8FAFC;
  }
  .cover .card .k { color: #64748B; font-size: 10px; text-transform: uppercase;
                    letter-spacing: 0.06em; margin-bottom: 4px; }
  .cover .card .v { font-size: 22px; font-weight: 700; color: #0F172A; }
  .cover .date { margin-top: 40px; font-size: 10px; color: #94A3B8; }

  .legend {
    page-break-after: always;
    padding-top: 10mm;
  }
  .legend table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .legend td { padding: 6px 8px; border: 1px solid #E2E8F0; vertical-align: top; }
  .legend td:first-child { font-weight: 700; width: 30%; background: #F8FAFC; }

  .cat { margin-bottom: 28px; page-break-inside: auto; }
  .summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
  .stat { background: #F1F5F9; color: #334155; padding: 3px 8px;
          border-radius: 12px; font-size: 10px; }
  .stat b { color: #0F172A; }

  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  thead { background: #0F172A; color: #F8FAFC; }
  th { padding: 5px 6px; text-align: left; font-weight: 600;
       font-size: 9.5px; border: 1px solid #1E293B; }
  td { padding: 4px 6px; border: 1px solid #E2E8F0; vertical-align: middle; }
  tbody tr:nth-child(even) { background: #F8FAFC; }
  td.num, th.num { width: 24px; text-align: right; color: #64748B;
                   font-variant-numeric: tabular-nums; }
  td.code { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
            font-size: 9px; color: #0F172A; word-break: break-all; }
  td.price, th.price { text-align: right; font-variant-numeric: tabular-nums;
                       font-weight: 600; white-space: nowrap; }
  td.small, th.small { text-align: center; width: 36px; font-size: 9.5px; }
  td.desc, th.desc { font-size: 9px; color: #475569; }
  td.blank { background: #FFFBEB; border: 1px dashed #F59E0B; min-width: 54px; }
  th.new-col { background: #B45309; color: #FFFBEB; }

  .badge {
    display: inline-block; padding: 1px 6px; border-radius: 999px;
    font-size: 9px; font-weight: 600; letter-spacing: 0.02em;
  }
  .badge.small { font-size: 8.5px; }
  .gate {
    display: inline-block; margin-left: 6px; padding: 1px 5px;
    border-radius: 4px; font-size: 8.5px; font-weight: 700;
  }
  .gate.black { background: #1F2937; color: #F9FAFB; }
  .gate.hof   { background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B; }
  .lv-pill {
    display: inline-block; background: #DC2626; color: #FFF7ED;
    padding: 2px 7px; border-radius: 999px; font-weight: 700;
    font-size: 9px; letter-spacing: 0.02em; white-space: nowrap;
  }
  .lv-none { color: #CBD5E1; font-weight: 600; }

  /* Print-specific */
  @media print {
    .cat, .cover, .legend { page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <h1>캐릭터 꾸미기 가격 / 해금 카탈로그</h1>
  <p class="sub">153복싱짐 · 랭킹업 · 가격 정책 및 레벨 게이트 결정용 참고 문서</p>

  <div class="big-num">${totalCount}</div>
  <div class="big-label">전체 꾸미기 아이템 (프리셋 포함)</div>

  <div class="grid">
    <div class="card"><div class="k">프리셋</div><div class="v">${PRESETS.length}</div></div>
    <div class="card"><div class="k">이펙트</div><div class="v">${EFFECTS.length}</div></div>
    <div class="card"><div class="k">프레임</div><div class="v">${FRAMES.length}</div></div>
    <div class="card"><div class="k">칭호</div><div class="v">${TITLES.length}</div></div>
    <div class="card"><div class="k">오라</div><div class="v">${AURAS.length}</div></div>
    <div class="card"><div class="k">후광(halo)</div><div class="v">${HALOS.length}</div></div>
  </div>
  <p class="date">생성 일자: ${TODAY} · 출처: characterPresets.ts, characterCustomizationData.ts, unlockRules.ts</p>
</div>

<!-- LEGEND -->
<section class="legend">
  <h2>읽는 법 / 범례</h2>

  <h3>컬럼 의미</h3>
  <table>
    <tbody>
      <tr><td>key</td><td>코드베이스에서 쓰이는 itemKey (수정 금지 권장 — 유저 소유 데이터가 이 키를 참조)</td></tr>
      <tr><td>이름</td><td>유저에게 보이는 한국어 라벨. 단 칭호/오라 일부는 <code>displayNameOverride</code> 로 UI 에서 덮어 쓰이고 있음 (unlockRules.ts 참조)</td></tr>
      <tr><td>리그</td><td>현재 가격 책정 시 참고한 리그 밴드. 실제 해금은 리그 아닌 Lv 또는 블랙 전용 플래그로 결정됨</td></tr>
      <tr><td>등급</td><td>common / uncommon / rare / epic / legendary</td></tr>
      <tr><td>현재가격</td><td>코드에 현재 박혀 있는 price 값 (젬). 0 = 무료</td></tr>
      <tr><td>현재해금</td><td>unlockRules.ts 에 정의된 requiredLevel. 규정 없으면 —</td></tr>
      <tr><td class="blank" style="min-width:0">새 가격</td><td>✎ 결정해서 직접 기입할 빈 셀</td></tr>
      <tr><td class="blank" style="min-width:0">새 해금Lv</td><td>✎ 결정해서 직접 기입할 빈 셀 (1~99 범위, 마스터 트랙 지원)</td></tr>
    </tbody>
  </table>

  <h3>부가 표기</h3>
  <table>
    <tbody>
      <tr><td><span class="gate black">black</span></td><td>레거시 <code>blackOnly</code> 플래그 — 블랙리그 미만 구매 차단 중 (unlockRules 와 병행 운영)</td></tr>
      <tr><td><span class="gate hof">HoF</span></td><td><code>requirement: "hall_of_fame"</code> — 명예의 전당 입성자만 구매 가능 (level 무관)</td></tr>
      <tr><td><span class="lv-pill">Lv.N</span></td><td>unlockRules.ts 에 등록된 레벨 게이트. CharacterStudio 에서 자물쇠 표시</td></tr>
      <tr><td><span class="lv-none">—</span></td><td>레벨 게이트 없음. 가격만으로 구매 가능 (또는 가격 0 = 즉시 장착 가능)</td></tr>
    </tbody>
  </table>

  <h3>요약 통계</h3>
  <table>
    <tbody>
      <tr><td>전체 아이템 수</td><td><b>${totalCount}</b> 개 (프리셋 ${PRESETS.length} + 꾸미기 ${EFFECTS.length + FRAMES.length + TITLES.length + AURAS.length + HALOS.length})</td></tr>
      <tr><td>레벨 게이트 있음</td><td><b>${totalGated}</b> 개 (unlockRules.ts — effect ${Object.keys(LEVEL_RULES.effect).length} / frame ${Object.keys(LEVEL_RULES.frame).length} / title ${Object.keys(LEVEL_RULES.title).length} / aura ${Object.keys(LEVEL_RULES.aura).length})</td></tr>
      <tr><td>가격만 있음</td><td><b>${totalCount - totalGated - PRESETS.length}</b> 개 (꾸미기 중 레벨 게이트 없는 것) + 프리셋 ${PRESETS.length - PRESETS.filter(p=>p.hof).length} 개 전체</td></tr>
      <tr><td>명예의 전당 전용</td><td>${PRESETS.filter(p=>p.hof).length + TITLES.filter(t=>t.hof).length + AURAS.filter(a=>a.hof).length} 개 (프리셋 ${PRESETS.filter(p=>p.hof).length} / 칭호 ${TITLES.filter(t=>t.hof).length} / 오라 ${AURAS.filter(a=>a.hof).length})</td></tr>
      <tr><td>후광(halo)</td><td>마스터 트랙 전용 별도 카테고리 — 현재 unlockRules 미등록</td></tr>
    </tbody>
  </table>

  <h3>권장 작업 순서</h3>
  <ol>
    <li>이 문서를 인쇄 또는 PDF 로 열고 각 아이템의 <b>새 가격</b> / <b>새 해금Lv</b> 컬럼 채움</li>
    <li>결정된 값을 가지고 unlockRules.ts (레벨) + characterCustomizationData.ts (가격) 동시 업데이트</li>
    <li>프리셋에도 레벨 게이트를 넣기로 했다면 unlockRules.ts 에 <code>"preset"</code> 카테고리 신설 + 서버측 purchase_customization RPC 확장</li>
    <li>마이그레이션 기존 회원이 이미 소유한 아이템은 <code>user_owned_customizations</code> 에 기록되어 있어 해금 레벨을 올려도 장착은 가능 (purchase_customization 의 already_owned 분기 보호)</li>
  </ol>
</section>

${presetSection()}

${section("이펙트 (effect)", EFFECTS, "effect")}

${section("프레임 (frame)", FRAMES, "frame")}

${section("칭호 (title)", TITLES, "title")}

${section("오라 (aura)", AURAS, "aura")}

${section("후광 (halo)", HALOS, "halo")}

</body>
</html>`;

const outPath = join(__dirname, "customization-catalog.html");
writeFileSync(outPath, html, "utf8");
console.log(`[ok] wrote ${outPath}`);
console.log(`[ok] items: ${totalCount} (presets ${PRESETS.length}, effect ${EFFECTS.length}, frame ${FRAMES.length}, title ${TITLES.length}, aura ${AURAS.length}, halo ${HALOS.length})`);
console.log(`[ok] with level rules: ${totalGated}`);
