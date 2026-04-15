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
import boxer_grandmaster_male from "@/assets/boxers/boxer_grandmaster_male.png";
import boxer_nika_01 from "@/assets/boxers/boxer_nika_01.png";
import boxer_nika_03 from "@/assets/boxers/boxer_nika_03.png";
import boxer_female_master_01 from "@/assets/boxers/boxer_female_master_01.png";
import boxer_female_master_02 from "@/assets/boxers/boxer_female_master_02.png";
import boxer_female_grandmaster_01 from "@/assets/boxers/boxer_female_grandmaster_01.png";
import boxer_female_grandmaster_02 from "@/assets/boxers/boxer_female_grandmaster_02.png";
import boxer_female_grandmaster_03 from "@/assets/boxers/boxer_female_grandmaster_03.png";
import boxer_female_grandmaster_04 from "@/assets/boxers/boxer_female_grandmaster_04.png";
import boxer_female_nika_02 from "@/assets/boxers/boxer_female_nika_02.png";
import boxer_kpop_02 from "@/assets/boxers/boxer_kpop_02.png";
import boxer_kpop_03 from "@/assets/boxers/boxer_kpop_03.png";

export interface PrebuiltCharacter {
  style: string;
  label: string;
  gender: "male" | "female";
  image: string;
  color: string;
}

export const PREBUILT_CHARACTERS: PrebuiltCharacter[] = [
  { style: "male_01", label: "루키", gender: "male", image: boxerMale01, color: "red-white" },
  { style: "female_01", label: "블루 에이스", gender: "female", image: boxerFemale01, color: "blue" },
  { style: "male_02", label: "아이언 챔프", gender: "male", image: boxerMale02, color: "black-gold" },
  { style: "female_02", label: "레드 퓨어리", gender: "female", image: boxerFemale02, color: "red-white" },
  { style: "male_03", label: "그린 호크", gender: "male", image: boxerMale03, color: "green-white" },
  { style: "female_03", label: "퍼플 레인", gender: "female", image: boxerFemale03, color: "purple" },
  { style: "male_04", label: "스트리트 킹", gender: "male", image: boxerMale04, color: "orange-gray" },
  { style: "female_04", label: "골든 듀크", gender: "female", image: boxerFemale04, color: "yellow-black" },
  { style: "male_05", label: "실버 폭스", gender: "male", image: boxerMale05, color: "silver-blue" },
  { style: "female_05", label: "체리", gender: "female", image: boxerFemale05, color: "pink" },
  { style: "male_06", label: "미드나잇", gender: "male", image: boxerMale06, color: "purple-black" },
  { style: "female_06", label: "민트 브리즈", gender: "female", image: boxerFemale06, color: "mint-teal" },
  { style: "female_pink_01", label: "체리 뵄", gender: "female", image: boxer_female_pink_01, color: "pink-red" },
  { style: "female_pink_02", label: "로즈 워리어", gender: "female", image: boxer_female_pink_02, color: "pink-blue" },
  { style: "male_blue_01", label: "썬더볼트", gender: "male", image: boxer_male_blue_01, color: "blue-purple" },
  { style: "male_blue_02", label: "라이트닝", gender: "male", image: boxer_male_blue_02, color: "blue" },
  { style: "male_blue_03", label: "사이클론", gender: "male", image: boxer_male_blue_03, color: "blue-white" },
  { style: "male_gold_01", label: "골든 너클", gender: "male", image: boxer_male_gold_01, color: "gold-black" },
  { style: "male_gold_02", label: "카이저", gender: "male", image: boxer_male_gold_02, color: "gold" },
  { style: "master_male_01", label: "킹 코브라", gender: "male", image: boxer_master_male_01, color: "black-gold" },
  { style: "master_male_02", label: "다크 나이트", gender: "male", image: boxer_master_male_02, color: "black-rainbow" },
  { style: "grandmaster_male", label: "아이언 듀크", gender: "male", image: boxer_grandmaster_male, color: "silver-black" },
  { style: "nika_male_01", label: "솔라", gender: "male", image: boxer_nika_01, color: "white-gold" },
  { style: "nika_male_03", label: "라이즈", gender: "male", image: boxer_nika_03, color: "gold-white" },
  { style: "female_master_01", label: "다이아 퀴", gender: "female", image: boxer_female_master_01, color: "black-gold" },
  { style: "female_master_02", label: "라일락 엠프레스", gender: "female", image: boxer_female_master_02, color: "black-rainbow" },
  { style: "female_gm_01", label: "실버 페가수스", gender: "female", image: boxer_female_grandmaster_01, color: "silver-purple" },
  { style: "female_gm_02", label: "어비스", gender: "female", image: boxer_female_grandmaster_02, color: "black-red" },
  { style: "female_gm_03", label: "도미네이터", gender: "female", image: boxer_female_grandmaster_03, color: "black-lightning" },
  { style: "female_gm_04", label: "팬텀", gender: "female", image: boxer_female_grandmaster_04, color: "silver-black" },
  { style: "female_nika_02", label: "오로라", gender: "female", image: boxer_female_nika_02, color: "white-gold" },
  { style: "kpop_02", label: "디바", gender: "female", image: boxer_kpop_02, color: "pink-gold" },
  { style: "kpop_03", label: "슈퍼노바", gender: "female", image: boxer_kpop_03, color: "pink-black" },
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
