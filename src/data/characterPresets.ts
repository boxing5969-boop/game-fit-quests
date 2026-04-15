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
import boxer_nika_02 from "@/assets/boxers/boxer_nika_02.jpg";
import boxer_nika_03 from "@/assets/boxers/boxer_nika_03.jpg";
import boxer_female_master_01 from "@/assets/boxers/boxer_female_master_01.png";
import boxer_female_master_02 from "@/assets/boxers/boxer_female_master_02.jpg";
import boxer_female_grandmaster_01 from "@/assets/boxers/boxer_female_grandmaster_01.png";
import boxer_female_grandmaster_02 from "@/assets/boxers/boxer_female_grandmaster_02.png";
import boxer_female_grandmaster_03 from "@/assets/boxers/boxer_female_grandmaster_03.png";
import boxer_female_grandmaster_04 from "@/assets/boxers/boxer_female_grandmaster_04.png";
import boxer_female_nika_01 from "@/assets/boxers/boxer_female_nika_01.png";
import boxer_female_nika_02 from "@/assets/boxers/boxer_female_nika_02.png";
import boxer_kpop_01 from "@/assets/boxers/boxer_kpop_01.jpg";
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
  { style: "male_01", label: "화이트 파이터", gender: "male", image: boxerMale01, color: "red-white" },
  { style: "female_01", label: "블루 파이터", gender: "female", image: boxerFemale01, color: "blue" },
  { style: "male_02", label: "챔피언", gender: "male", image: boxerMale02, color: "black-gold" },
  { style: "female_02", label: "레드 스트라이커", gender: "female", image: boxerFemale02, color: "red-white" },
  { style: "male_03", label: "그린 복서", gender: "male", image: boxerMale03, color: "green-white" },
  { style: "female_03", label: "퍼플 파이터", gender: "female", image: boxerFemale03, color: "purple" },
  { style: "male_04", label: "스트리트 복서", gender: "male", image: boxerMale04, color: "orange-gray" },
  { style: "female_04", label: "골든 스트라이커", gender: "female", image: boxerFemale04, color: "yellow-black" },
  { style: "male_05", label: "실버 복서", gender: "male", image: boxerMale05, color: "silver-blue" },
  { style: "female_05", label: "핑크 파이터", gender: "female", image: boxerFemale05, color: "pink" },
  { style: "male_06", label: "다크 스트라이커", gender: "male", image: boxerMale06, color: "purple-black" },
  { style: "female_06", label: "민트 파이터", gender: "female", image: boxerFemale06, color: "mint-teal" },
  { style: "female_pink_01", label: "핑크 파이터", gender: "female", image: boxer_female_pink_01, color: "pink-red" },
  { style: "female_pink_02", label: "핑크 워리어", gender: "female", image: boxer_female_pink_02, color: "pink-blue" },
  { style: "male_blue_01", label: "블루 스파이크", gender: "male", image: boxer_male_blue_01, color: "blue-purple" },
  { style: "male_blue_02", label: "블루 스트라이커", gender: "male", image: boxer_male_blue_02, color: "blue" },
  { style: "male_blue_03", label: "블루 챔프", gender: "male", image: boxer_male_blue_03, color: "blue-white" },
  { style: "male_gold_01", label: "골든 파이터", gender: "male", image: boxer_male_gold_01, color: "gold-black" },
  { style: "male_gold_02", label: "골든 챔피언", gender: "male", image: boxer_male_gold_02, color: "gold" },
  { style: "master_male_01", label: "마스터 킹", gender: "male", image: boxer_master_male_01, color: "black-gold" },
  { style: "master_male_02", label: "마스터 레전드", gender: "male", image: boxer_master_male_02, color: "black-rainbow" },
  { style: "grandmaster_male", label: "그랜드마스터", gender: "male", image: boxer_grandmaster_male, color: "silver-black" },
  { style: "nika_male_01", label: "태양신 니카", gender: "male", image: boxer_nika_01, color: "white-gold" },
  { style: "nika_male_02", label: "태양신 전사", gender: "male", image: boxer_nika_02, color: "white-rainbow" },
  { style: "nika_male_03", label: "태양신 제왕", gender: "male", image: boxer_nika_03, color: "gold-white" },
  { style: "female_master_01", label: "마스터 팀", gender: "female", image: boxer_female_master_01, color: "black-gold" },
  { style: "female_master_02", label: "마스터 엠프레스", gender: "female", image: boxer_female_master_02, color: "black-rainbow" },
  { style: "female_gm_01", label: "그랜드마스터 팀", gender: "female", image: boxer_female_grandmaster_01, color: "silver-purple" },
  { style: "female_gm_02", label: "다크 팀", gender: "female", image: boxer_female_grandmaster_02, color: "black-red" },
  { style: "female_gm_03", label: "패왕 팀", gender: "female", image: boxer_female_grandmaster_03, color: "black-lightning" },
  { style: "female_gm_04", label: "세도우 팀", gender: "female", image: boxer_female_grandmaster_04, color: "silver-black" },
  { style: "female_nika_01", label: "태양신 여신", gender: "female", image: boxer_female_nika_01, color: "white-rainbow" },
  { style: "female_nika_02", label: "태양신 팀", gender: "female", image: boxer_female_nika_02, color: "white-gold" },
  { style: "kpop_01", label: "케이팝 아이돌", gender: "female", image: boxer_kpop_01, color: "pink-purple" },
  { style: "kpop_02", label: "케이팝 마스터", gender: "female", image: boxer_kpop_02, color: "pink-gold" },
  { style: "kpop_03", label: "케이팝 챔프", gender: "female", image: boxer_kpop_03, color: "pink-black" },
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
