/**
 * 🥊 153 수업 템플릿 — 오늘 프로그램을 만들 때 고르는 수업 틀 (153운영본부 › 전략 회의 › 오늘 프로그램)
 *
 *   2026-11-11 대표님 「선택할 수 있는 수업 템플릿 중 하나로 지정하자」 — 첫 템플릿 = 미트 두 콤보 + 샌드백 구령
 *   · 블록 모양은 오늘 프로그램(ProgramBlock)과 같다 — 고르면 이름 · 블록 · 코치님께 한마디가 채워지고, 대표님 · 지점장님이 고쳐서 보낸다
 *   · 코치님은 오늘 프로그램 칸에서 템플릿을 언제든 펼쳐 보고, 수업 기록의 '진행한 프로그램'에서도 고른다
 *   · 분은 50분 수업 기준 어림 — 라운드 수는 블록 메모(2~3라운드)가 기준이고, 지점 타이머에 맞춰 고친다
 *   · 템플릿을 더하려면 아래 목록에 한 칸 (테스트 classTemplates.test.ts — 합계 분 · 블록 종류 · 글자 수)
 */
import type { ProgramBlock } from "@/services/strategyService";

export interface ClassTemplate {
  /** 바꾸지 않는 이름 (소문자 · 숫자 · -) */
  id: string;
  /** 오늘 프로그램 이름으로 들어간다 (120자까지) */
  title: string;
  /** 한 줄 흐름 */
  summary: string;
  /** 누구에게 — 동작마다 대상이 다르면 여기 */
  who: string;
  /** 지도 원칙 — 코치님께 한마디로 들어간다 */
  points: string[];
  blocks: ProgramBlock[];
}

export const CLASS_TEMPLATES: ClassTemplate[] = [
  {
    id: "mitt2-sandbag-call",
    title: "미트 두 콤보 + 샌드백 구령",
    summary: "거울 앞 자세 → 코치 미트 두 동작 → 샌드백 구령 · 30초 대시 → 자율 운동",
    who: "② 잽 → 더킹 → 왼손 훅 → 오른손 카운터는 기본기가 완성된 회원(레벨 10) 또는 다른 곳에서 배운 경험이 있는 회원만 해요. 그 밖의 회원은 같은 시간에 ① 동작을 미트로 해요.",
    points: [
      "회원님 감정이 가장 중요해요 — 스트레스가 시원하게 풀리고, 땀이 나고, 에너지를 받고, 미트에 팍팍 꽂혀야 해요.",
      "설명은 거울 앞 자세 연습에서 충분히 해요. 미트를 칠 때는 스트레스 푸는 시간 — 티칭은 짧게, 꽂히는 데 집중해요.",
      "회원님은 신나야 해요 — 주먹이 미트에 꽂히는 쾌감이 이 수업의 주인공이에요.",
      "흐름이 끊기지 않게 — 동작 사이 설명 · 기다리는 시간을 줄여요.",
      "미트 라운드는 인원 · 기본기에 맞춰요 — 인원이 많아 한 명씩 정성껏 받으면 3라운드, 적고 기본기가 잡혀 있으면 2라운드.",
    ],
    blocks: [
      {
        kind: "warmup",
        title: "거울 앞 스텝 · 자세 연습",
        minutes: 10,
        note: "오늘 할 두 동작을 여기서 충분히 설명해요 — 미트를 칠 때는 설명을 줄여요.",
      },
      {
        kind: "mitt",
        title: "① 잽 → 앉았다 일어나며 카운터",
        minutes: 10,
        note: "글러브 끼고 돌아가며 코치 미트 · 2~3라운드 — 인원이 많으면 3라운드, 적고 기본기가 잡혀 있으면 2라운드.",
      },
      {
        kind: "mitt",
        title: "② 잽(안면) → 더킹 → 왼손 훅 → 오른손 카운터",
        minutes: 10,
        note: "2~3라운드 · 흐름이 끊기지 않게 — 레벨 10 또는 다른 곳에서 배운 회원만, 그 밖의 회원은 ① 동작을 미트로.",
      },
      {
        kind: "conditioning",
        title: "샌드백 구령 2라운드 + 30초 대시",
        minutes: 8,
        note: "코치 구령에 맞춰 1라운드 ① 동작 · 2라운드 ② 동작 — 마지막 30초는 구령 동작을 빠르게 반복(대시).",
      },
      {
        kind: "etc",
        title: "자율 운동",
        minutes: 12,
        note: "2인1조 타이틀 미션 기술 훈련 · 어깨치기 · 샌드백 · 코치 1:1 미트 등으로 복싱을 이어가요.",
      },
    ],
  },
];

/** 템플릿 → 코치님께 한마디 (대상 + 지도 원칙) */
export function classTemplateNote(t: ClassTemplate): string {
  return [`대상 · ${t.who}`, ...t.points.map((p) => `· ${p}`)].join("\n");
}

/** 블록 복사본 — 고친 내용이 템플릿 원본에 번지지 않게 */
export function classTemplateBlocks(t: ClassTemplate): ProgramBlock[] {
  return t.blocks.map((b) => ({ ...b }));
}

export const classTemplateMinutes = (t: ClassTemplate): number => t.blocks.reduce((s, b) => s + b.minutes, 0);
