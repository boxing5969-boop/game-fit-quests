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

/** 단계별 티칭 (2026-11-13 대표님 「모든 동작을 지도할 때 … 단계별 티칭」 — 매뉴얼 2권 2장 기준과 같은 말) — 템플릿마다 코치님께 한마디에 */
export const STEP_TEACHING_POINT =
  "새 동작은 단계별로 — 하나 · 둘 · 셋 부분 동작(시범) → 힘 빼고 이어서 천천히 → 연속. 설명은 1분 안, 미트를 칠 때 티칭은 치는 동안 핵심만 10초 — 꽂히는 데 집중해요.";

/* 두 그룹 · 처음 온 회원 (2026-11-13 대표님 「추천대로 진행하자」 — 매뉴얼 2권 결정 1 · 2번)
 *   기본 그룹 = 그날 동작 중 원 · 투까지 · 숙련 그룹 = 그날 동작 전부 · 처음 온 회원 = 템플릿과 상관없이 1권 첫 수업(스텝 · 잽 4라운드) */

export const CLASS_TEMPLATES: ClassTemplate[] = [
  {
    id: "mitt2-sandbag-call",
    title: "미트 두 콤보 + 샌드백 구령",
    summary: "거울 앞 자세 → 코치 미트 두 동작 → 샌드백 구령 · 30초 대시 → 자율 운동",
    who: "② 잽 → 더킹 → 왼손 훅 → 오른손 카운터는 기본기가 완성된 회원(레벨 10) 또는 다른 곳에서 배운 경험이 있는 회원만 해요. 그 밖의 회원은 같은 시간에 ① 동작을 미트로 해요. 처음 온 회원은 매뉴얼 1권 첫 수업(스텝 · 잽 4라운드)으로 시작해요.",
    points: [
      "회원님 감정이 가장 중요해요 — 스트레스가 시원하게 풀리고, 땀이 나고, 에너지를 받고, 미트에 팍팍 꽂혀야 해요.",
      STEP_TEACHING_POINT,
      "회원님은 신나야 해요 — 주먹이 미트에 꽂히는 쾌감이 이 수업의 주인공이에요.",
      "흐름이 끊기지 않게 — 동작 사이 설명 · 기다리는 시간을 줄여요.",
      "미트 라운드는 인원 · 기본기에 맞춰요 — 인원이 많아 한 명씩 정성껏 받으면 3라운드, 적고 기본기가 잡혀 있으면 2라운드.",
    ],
    blocks: [
      {
        kind: "warmup",
        title: "거울 앞 스텝 · 자세 연습",
        minutes: 10,
        note: "오늘 할 두 동작을 단계별로 — 하나 · 둘 · 셋 부분 동작 → 이어서 천천히. 설명은 1분 안, 미트를 칠 때는 핵심만 10초.",
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
  /* 2026-11-12 대표님 「추천대로 진행하자 · 전략부분에 템플릿 영상으로 활용」 — 11/12 DJI 촬영 순서 그대로(위빙 세 단계 · 미트 · 2인1조 · 샌드백 구령).
   *   블록 노트는 영상 속 코치님 말을 줄였다. 분은 50분 어림(설계 문서 「153 트레이닝 콘텐츠 구조 설계」 결정 5번). 순서 영상 = step 1~8, 0 = 수업 요약 */
  {
    id: "weave-hook-call",
    title: "위빙 수업 — 스텝 위빙 · 양훅 · 샌드백 구령",
    summary: "스탠스 스텝 워밍업 → 위빙 세 단계 → 미트 → 2인 1조 → 샌드백 구령(어이 · 대시) → 자율 운동",
    who: "두 그룹으로 해요 — 기본 그룹(스트레이트를 다지는 회원)은 ②의 훅 · ③의 양훅 자리를 원 · 투로, 숙련 그룹은 그날 동작 전부. 처음 온 회원은 매뉴얼 1권 첫 수업(스텝 · 잽 4라운드)으로 시작해요. 위빙이 처음이면 천천히 정확하게, 익숙해지면 빠르고 강하게.",
    points: [
      STEP_TEACHING_POINT,
      "뒤로 빠지며 위빙하면 거리가 생겨 더 위험해요 — 앞으로 가면서 짧게 해요.",
      "위빙은 머리가 대각선으로 먼저 떨어지지 않게 — 무릎으로 먼저 아래로 내려갔다가 풀어 줘요.",
      "주먹은 뻗었다가 턱으로 돌아오고, 치지 않는 손은 가드를 지켜요.",
      "양훅은 따라오는 발이 바닥을 찍은 다음에 — 발보다 주먹이 먼저 나가면 체중이 안 실려요.",
    ],
    blocks: [
      {
        kind: "warmup",
        title: "스탠스 유지 스텝 · 십자 스텝",
        minutes: 8,
        note: "뒷발로 밀며 가는 쪽 발부터 짧게 — 앞 · 뒤 · 옆 4방향, 스탠스가 무너지지 않게. 이어서 십자 스텝.",
      },
      {
        kind: "skill",
        title: "① 앞으로 가며 스텝 위빙",
        minutes: 5,
        note: "뒤로 빠지지 말고 앞으로 짧게. 머리는 대각선이 아니라 먼저 아래로 — 따라오는 발로 원래 스탠스를 만들어요.",
      },
      {
        kind: "skill",
        title: "② 원 · 투 · 훅 → 위빙 위빙",
        minutes: 5,
        note: "원투 · 훅 할 때 반대손 가드를 올리고, 주먹은 턱으로 돌아와요. 위빙할 때는 양손 모두 턱 쪽.",
      },
      {
        kind: "skill",
        title: "③ 위빙 → 양훅",
        minutes: 5,
        note: "위빙 하나 둘 → 따라오는 발이 찍히자마자 양훅을 강하게. 다음 라운드는 반대쪽부터.",
      },
      {
        kind: "mitt",
        title: "미트 · 위빙 → 양훅",
        minutes: 8,
        note: "코치 미트로 ③ 동작 — 인원이 많으면 3라운드, 적고 기본기가 잡혀 있으면 2라운드.",
      },
      {
        kind: "defense",
        title: "2인 1조 — 한 명 공격 · 한 명 위빙",
        minutes: 6,
        note: "두 명씩 짝 — 한 명은 공격만, 한 명은 위빙으로 수비해요. 라운드마다 바꿔요.",
      },
      {
        kind: "conditioning",
        title: "샌드백 구령 「어이」 · 「대시」",
        minutes: 6,
        note: "가까운 거리 샌드백 — 「어이」 = 위빙 위빙 양훅, 「대시」 = 한쪽 방향만 하나 둘 빵빵 최대한 세게. 다음 라운드는 반대쪽.",
      },
      {
        kind: "etc",
        title: "자율 운동",
        minutes: 7,
        note: "코치님이 한 분씩 미트를 봐 드려요 — 샌드백 · 2인 1조로 복싱을 이어가요.",
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

/* ───────── 순서마다 참고 영상 (2026-11-12 대표님 「각 순서마다 참고할수있는 영상을 첨부해서」) ─────────
 *   DB class_template_videos (20261112020054) — 자리 = (템플릿 id, step). step 0 = 전체 흐름(실제 수업 요약), 1~ = 블록 순서(1부터)
 *   코드에서 블록 순서를 바꾸면 DB 의 영상 자리(step)도 같이 옮긴다 */

export const TEMPLATE_OVERVIEW_STEP = 0;

/** 영상 자리 이름 — 화면 지도(Map) 열쇠 */
export const templateVideoKey = (templateId: string, step: number): string => `${templateId}:${step}`;

/** 저장소 경로 — 넣는 분 폴더 안(저장소 정책 · 서버가 맨 앞 폴더를 본다) */
export function templateVideoPath(uid: string, templateId: string, step: number, ext: string, rand: string): string {
  const safeExt = /^[a-z0-9]{2,4}$/.test(ext) ? ext : "mp4";
  const safeRand = rand.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "v";
  return `${uid}/tpl-${templateId}-${step}-${safeRand}.${safeExt}`;
}

/** 영상 길이 글 — 59초까지 '31초', 그 위 '2:45' */
export function formatClipLength(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  const s = Math.round(seconds);
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 올린 파일 이름 → 영상 제목 (확장자 · 밑줄 정리, 80자). 카메라가 붙인 이름(dji_ · IMG_ · 숫자뿐)이면 제목 없음 */
export function videoTitleFromFileName(name: string | null | undefined): string | null {
  const base = (name ?? "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return null;
  if (/^(dji|img|vid|mov|pxl|gopr|gh\d|dsc|kakaotalk|screen ?recording|video|clip)\b.*\d{3,}/i.test(base)) return null;
  if (!/[가-힣]/.test(base) && /\d{6,}/.test(base)) return null;
  if (!/[가-힣a-z]/i.test(base)) return null;
  return base.slice(0, 80);
}

/** 영상 창 제목 — 전체 흐름이면 '템플릿 이름 · 수업 요약', 블록이면 그 블록 이름 */
export function templateVideoTitle(t: ClassTemplate, step: number): string {
  if (step === TEMPLATE_OVERVIEW_STEP) return `${t.title} · 수업 요약`;
  return t.blocks[step - 1]?.title ?? t.title;
}
