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
import boxer_female_pink_01 from "@/assets/boxers/boxer_female_pink_01.jpg";
import boxer_female_pink_02 from "@/assets/boxers/boxer_female_pink_02.jpg";
import boxer_male_blue_01 from "@/assets/boxers/boxer_male_blue_01.jpg";
import boxer_male_blue_02 from "@/assets/boxers/boxer_male_blue_02.jpg";
import boxer_male_blue_03 from "@/assets/boxers/boxer_male_blue_03.jpg";
import boxer_male_gold_01 from "@/assets/boxers/boxer_male_gold_01.jpg";
import boxer_male_gold_02 from "@/assets/boxers/boxer_male_gold_02.jpg";
import boxer_master_male_01 from "@/assets/boxers/boxer_master_male_01.jpg";
import boxer_master_male_02 from "@/assets/boxers/boxer_master_male_02.jpg";
import boxer_grandmaster_male from "@/assets/boxers/boxer_grandmaster_male.jpg";
import boxer_nika_01 from "@/assets/boxers/boxer_nika_01.jpg";
import boxer_nika_02 from "@/assets/boxers/boxer_nika_02.jpg";
import boxer_nika_03 from "@/assets/boxers/boxer_nika_03.jpg";
import boxer_female_master_01 from "@/assets/boxers/boxer_female_master_01.jpg";
import boxer_female_master_02 from "@/assets/boxers/boxer_female_master_02.jpg";
import boxer_female_grandmaster_01 from "@/assets/boxers/boxer_female_grandmaster_01.jpg";
import boxer_female_grandmaster_02 from "@/assets/boxers/boxer_female_grandmaster_02.jpg";
import boxer_female_grandmaster_03 from "@/assets/boxers/boxer_female_grandmaster_03.jpg";
import boxer_female_grandmaster_04 from "@/assets/boxers/boxer_female_grandmaster_04.jpg";
import boxer_female_nika_01 from "@/assets/boxers/boxer_female_nika_01.jpg";
import boxer_female_nika_02 from "@/assets/boxers/boxer_female_nika_02.jpg";
import boxer_kpop_01 from "@/assets/boxers/boxer_kpop_01.jpg";
import boxer_kpop_02 from "@/assets/boxers/boxer_kpop_02.jpg";
import boxer_kpop_03 from "@/assets/boxers/boxer_kpop_03.jpg";

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
