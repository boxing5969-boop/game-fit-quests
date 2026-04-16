import boxerMale01 from "@/assets/characters/prebuilt/boxer_male_01.png";
import boxerFemale01 from "@/assets/characters/prebuilt/boxer_female_01.png";
import boxerMale02 from "@/assets/characters/prebuilt/boxer_male_02.png";
import boxerFemale02 from "@/assets/characters/prebuilt/boxer_female_02.png";
import boxerMale03 from "@/assets/characters/prebuilt/boxer_male_03.png";
import boxerFemale03 from "@/assets/characters/prebuilt/boxer_female_03.png";
import boxerMale04 from "@/assets/characters/prebuilt/boxer_male_04.png";
import boxerFemale04 from "@/assets/characters/prebuilt/boxer_female_04.png";
import boxerMale05 from "@/assets/characters/prebuilt/boxer_male_05.png";
import boxerFemale05 from "@/assets/characters/prebuilt/boxer_female_05.png";
import boxerMale06 from "@/assets/characters/prebuilt/boxer_male_06.png";
import boxerFemale06 from "@/assets/characters/prebuilt/boxer_female_06.png";
import boxer_female_pink_01 from "@/assets/boxers/boxer_female_pink_01.png";
import boxer_female_pink_02 from "@/assets/boxers/boxer_female_pink_02.png";
import boxer_male_blue_01 from "@/assets/boxers/boxer_male_blue_01.png";
import boxer_male_blue_02 from "@/assets/boxers/boxer_male_blue_02.png";
import boxer_male_blue_03 from "@/assets/boxers/boxer_male_blue_03.png";
import boxer_male_gold_01 from "@/assets/boxers/boxer_male_gold_01.png";
import boxer_male_gold_02 from "@/assets/boxers/boxer_male_gold_02.png";
import boxer_master_male_01 from "@/assets/boxers/boxer_master_male_01.png";
import boxer_master_male_02 from "@/assets/boxers/boxer_master_male_02.png";
import boxer_nika_03 from "@/assets/boxers/boxer_nika_03.png";
import boxer_female_master_01 from "@/assets/boxers/boxer_female_master_01.png";
import boxer_female_master_02 from "@/assets/boxers/boxer_female_master_02.png";
import boxer_female_grandmaster_01 from "@/assets/boxers/boxer_female_grandmaster_01.png";
import boxer_female_grandmaster_02 from "@/assets/boxers/boxer_female_grandmaster_02.png";
import boxer_female_grandmaster_03 from "@/assets/boxers/boxer_female_grandmaster_03.png";
import boxer_kpop_02 from "@/assets/boxers/boxer_kpop_02.png";
import boxer_kpop_03 from "@/assets/boxers/boxer_kpop_03.png";
import boxer_new_01 from "@/assets/boxers/boxer_new_01.png";
import boxer_new_02 from "@/assets/boxers/boxer_new_02.png";
import boxer_new_03 from "@/assets/boxers/boxer_new_03.png";
import boxer_new_04 from "@/assets/boxers/boxer_new_04.png";
import boxer_new_05 from "@/assets/boxers/boxer_new_05.png";
import boxer_new_06 from "@/assets/boxers/boxer_new_06.png";
import boxer_new_07 from "@/assets/boxers/boxer_new_07.png";
import boxer_new_08 from "@/assets/boxers/boxer_new_08.png";
import boxer_new_09 from "@/assets/boxers/boxer_new_09.png";
import boxer_new_10 from "@/assets/boxers/boxer_new_10.png";
import boxer_new_11 from "@/assets/boxers/boxer_new_11.png";
import boxer_new_12 from "@/assets/boxers/boxer_new_12.png";
import boxer_new_13 from "@/assets/boxers/boxer_new_13.png";
import boxer_new_14 from "@/assets/boxers/boxer_new_14.png";
import boxer_new_16 from "@/assets/boxers/boxer_new_16.png";
import boxer_new_17 from "@/assets/boxers/boxer_new_17.png";
import boxer_new_18 from "@/assets/boxers/boxer_new_18.png";

export interface PrebuiltCharacter {
  style: string;
  label: string;
  gender: "male" | "female";
  image: string;
  color: string;
  league: "white" | "blue" | "red" | "black";
  price: number;
  requirement?: "hall_of_fame";
}

export const PREBUILT_CHARACTERS: PrebuiltCharacter[] = [
  // ── White league (free) ──────────────────────────────────────
  { style: "male_01",   label: "루키",        gender: "male",   image: boxerMale01,   color: "red-white",    league: "white", price: 0 },
  { style: "female_01", label: "블루 에이스", gender: "female", image: boxerFemale01, color: "blue",         league: "white", price: 0 },
  { style: "male_02",   label: "아이언 챔프", gender: "male",   image: boxerMale02,   color: "black-gold",   league: "white", price: 0 },
  // ── White league (200–500) ───────────────────────────────────
  { style: "female_02", label: "레드 퓨어리", gender: "female", image: boxerFemale02, color: "red-white",    league: "white", price: 200 },
  { style: "male_03",   label: "그린 호크",   gender: "male",   image: boxerMale03,   color: "green-white",  league: "white", price: 250 },
  { style: "female_03", label: "퍼플 레인",   gender: "female", image: boxerFemale03, color: "purple",       league: "white", price: 300 },
  { style: "male_04",   label: "스트리트 킹", gender: "male",   image: boxerMale04,   color: "orange-gray",  league: "white", price: 350 },
  { style: "female_04", label: "골든 듀크",   gender: "female", image: boxerFemale04, color: "yellow-black", league: "white", price: 400 },
  { style: "male_05",   label: "실버 폭스",   gender: "male",   image: boxerMale05,   color: "silver-blue",  league: "white", price: 450 },
  { style: "female_05", label: "체리",        gender: "female", image: boxerFemale05, color: "pink",         league: "white", price: 450 },
  { style: "male_06",   label: "미드나잇",    gender: "male",   image: boxerMale06,   color: "purple-black", league: "white", price: 500 },
  { style: "female_06", label: "민트 브리즈", gender: "female", image: boxerFemale06, color: "mint-teal",    league: "white", price: 500 },
  // ── Blue league (800–1200) ───────────────────────────────────
  { style: "female_pink_01", label: "체리 뵄",    gender: "female", image: boxer_female_pink_01, color: "pink-red",    league: "blue", price: 800 },
  { style: "female_pink_02", label: "로즈 워리어", gender: "female", image: boxer_female_pink_02, color: "pink-blue",  league: "blue", price: 900 },
  { style: "male_blue_01",   label: "썬더볼트",   gender: "male",   image: boxer_male_blue_01,   color: "blue-purple", league: "blue", price: 1000 },
  { style: "male_blue_02",   label: "라이트닝",   gender: "male",   image: boxer_male_blue_02,   color: "blue",        league: "blue", price: 1100 },
  { style: "male_blue_03",   label: "사이클론",   gender: "male",   image: boxer_male_blue_03,   color: "blue-white",  league: "blue", price: 1200 },
  // ── Red league (1500–2500) ───────────────────────────────────
  { style: "male_gold_01", label: "골든 너클", gender: "male",   image: boxer_male_gold_01, color: "gold-black", league: "red", price: 1500 },
  { style: "male_gold_02", label: "카이저",    gender: "male",   image: boxer_male_gold_02, color: "gold",       league: "red", price: 2000 },
  { style: "new_13",       label: "알리",      gender: "male",   image: boxer_new_13,       color: "hof",        league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "kpop_02",      label: "디바",      gender: "female", image: boxer_kpop_02,      color: "pink-gold",  league: "red", price: 2000 },
  { style: "kpop_03",      label: "슈퍼노바",  gender: "female", image: boxer_kpop_03,      color: "pink-black", league: "red", price: 2500 },
  // ── Black league (3000–15000) ────────────────────────────────
  { style: "master_male_01",   label: "킹 코브라",     gender: "male",   image: boxer_master_male_01,       color: "black-gold",     league: "black", price: 3000 },
  { style: "master_male_02",   label: "다크 나이트",   gender: "male",   image: boxer_master_male_02,       color: "black-rainbow",  league: "black", price: 4000 },
  { style: "nika_male_03",     label: "라이즈",        gender: "male",   image: boxer_nika_03,              color: "gold-white",     league: "black", price: 7000 },
  { style: "female_master_01", label: "다이아 퀸",     gender: "female", image: boxer_female_master_01,     color: "black-gold",     league: "black", price: 5000 },
  { style: "female_master_02", label: "라일락 엠프레스", gender: "female", image: boxer_female_master_02,  color: "black-rainbow",  league: "black", price: 6000 },
  { style: "female_gm_01",     label: "실버 페가수스", gender: "female", image: boxer_female_grandmaster_01, color: "silver-purple", league: "black", price: 8000 },
  { style: "female_gm_02",     label: "어비스",        gender: "female", image: boxer_female_grandmaster_02, color: "black-red",    league: "black", price: 8000 },
  { style: "female_gm_03",     label: "도미네이터",    gender: "female", image: boxer_female_grandmaster_03, color: "black-lightning", league: "black", price: 10000 },
  // ── Black league — Hall of Fame only (100000) ───────────────
  { style: "new_16", label: "153 블레이즈",       gender: "male",   image: boxer_new_16, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_17", label: "153 퓨리",           gender: "male",   image: boxer_new_17, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_14", label: "153 나이트",         gender: "male",   image: boxer_new_14, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_18", label: "153 골든 스트라이커", gender: "male",  image: boxer_new_18, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_01", label: "153 에이스",         gender: "male",   image: boxer_new_01, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_02", label: "153 챔피언",         gender: "male",   image: boxer_new_02, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_03", label: "153 레전드 퀸",      gender: "female", image: boxer_new_03, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_04", label: "153 마이스터",       gender: "male",   image: boxer_new_04, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_05", label: "153 에이스",         gender: "male",   image: boxer_new_05, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_06", label: "153 APEX 킹",        gender: "male",   image: boxer_new_06, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_07", label: "153 워리어",         gender: "male",   image: boxer_new_07, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_08", label: "153 레전드",         gender: "male",   image: boxer_new_08, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_09", label: "153 다크 퀸",        gender: "female", image: boxer_new_09, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_10", label: "153 크라운",         gender: "male",   image: boxer_new_10, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_11", label: "153 스타 퀸",        gender: "female", image: boxer_new_11, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
  { style: "new_12", label: "마이크 타이거",        gender: "male",   image: boxer_new_12, color: "hof", league: "black", price: 100000, requirement: "hall_of_fame" },
];

export function getCharacterImage(style?: string): string {
  if (!style) return boxerMale01;
  const found = PREBUILT_CHARACTERS.find(c => c.style === style);
  return found?.image || boxerMale01;
}

export function getRandomCharacter(): PrebuiltCharacter {
  return PREBUILT_CHARACTERS[Math.floor(Math.random() * PREBUILT_CHARACTERS.length)];
}

/** Deterministic character from a string (e.g. user_id) */
export function getCharacterByHash(key: string): PrebuiltCharacter {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return PREBUILT_CHARACTERS[Math.abs(hash) % PREBUILT_CHARACTERS.length];
}
