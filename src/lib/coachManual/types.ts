/**
 * 📘 153 매뉴얼 — 책 · 장 · 카드 모양 (2026-11-11 · 153운영본부 「매뉴얼」 탭)
 *
 *   책 내용은 코드 한 곳(book1.ts)에 둔다 — DB 에는 서명 기록만(coach_manual_reads).
 *   글을 고치면 그 장의 version 을 올린다 → 이미 서명한 코치님에게는 '새 판 · 다시 서명'이 뜬다.
 *   글 안의 간단한 표시: **굵게** · *기울임* · [글](주소) · [12] 출처 번호
 */

export type ManualBlock =
  | { t: "p"; text: string }
  | { t: "quote"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[]; start?: number }
  | { t: "table"; head: string[]; rows: string[][] }
  /** src = public/assets/manual/<src>.webp */
  | { t: "image"; src: string; alt: string }
  /** 회원 앱 「153 영상」 미션 영상(missions.id) — 읽기만 한다. poster = public/assets/manual/<poster>.webp */
  | { t: "video"; missionId: string; poster: string; title: string; caption?: string }
  /** 153 콘텐츠 카드(training_exercises.id) — 카드 타일 → 카드 시트(코치진은 「코치용 영상」). 카드 영상을 바꾸면 매뉴얼도 같이 바뀐다 (2권 · 2026-11-13) */
  | { t: "card"; cardId: string; caption?: string }
  /** 수업 템플릿 순서 영상(class_template_videos) — template = classTemplates id · step 0 = 수업 요약, 1~ = 블록 순서 (2권 · 2026-11-13) */
  | { t: "tplvideo"; template: string; step: number; title: string; caption?: string };

export interface ManualCard {
  /** 카드 제목 — 장면 · 근거 · 이런 생각 드시죠? … (없으면 장 제목만 보인다) */
  title: string | null;
  blocks: ManualBlock[];
}

export interface ManualQuiz {
  q: string;
  options: string[];
  /** options 의 정답 자리 (0부터) */
  answer: number;
  /** 맞힌 뒤 보이는 한 줄 */
  why: string;
}

export interface ManualChapter {
  /** 서명 기록의 장 이름 — 바꾸지 않는다 (DB coach_manual_reads.chapter) */
  id: string;
  /** 「앞글 ①」 · 「프롤로그」 · 「1장」 · 「부록」 */
  no: string;
  title: string;
  /** 이 장에서 얻는 것 */
  gain: string | null;
  /** 읽는 시간(분) — 0 이면 '필요할 때' */
  minutes: number;
  /** 장 그림 — public/assets/manual/<image>.webp (작은 그림 <image>_s.webp) */
  image: string | null;
  /** 판 번호 — 글을 고치면 올린다 (1부터) */
  version: number;
  /** 필독 — 끝에 확인 문제 · 서명이 있고, 앞 장을 서명해야 다음 장이 열린다 */
  required: boolean;
  cards: ManualCard[];
  /** 오늘 한 가지 */
  today: string | null;
  /** 확인 문제 — 3개 다 맞혀야 서명 단추가 열린다 */
  quiz: ManualQuiz[];
}

export interface ManualBook {
  /** 서명 기록의 책 이름 (DB coach_manual_reads.book) */
  id: string;
  /** 「1권」 */
  no: string;
  title: string;
  tagline: string | null;
  /** 표지 그림 — public/assets/manual/<cover>.webp */
  cover: string;
  /** 이 책을 읽는 법 */
  guide: string[];
  /** 책 끝 서명 한 줄 */
  signature: string | null;
  /** 원고 출처 (사람이 읽는 메모) */
  source: string;
  chapters: ManualChapter[];
}

/** 서버 coach_manual_* 가 돌려주는 서명 한 줄 */
export interface ManualRead {
  chapter: string;
  version: number;
  quiz_tries: number;
  signed_at: string;
}

/** coach_manual_me */
export interface ManualMe {
  staff: boolean;
  hq?: boolean;
  can_direct?: boolean;
  reads?: ManualRead[];
}

/** coach_manual_board 의 한 사람 (_strategy_display + 서명) */
export interface ManualBoardPerson {
  user_id: string;
  name: string;
  title: string;
  avatar_url: string | null;
  me: boolean;
  reads: ManualRead[];
  nudged_at: string | null;
}

/** coach_manual_board */
export interface ManualBoard {
  branch: string;
  branches: string[];
  people: ManualBoardPerson[];
}

/** 그림 주소 — small = 목차용 작은 그림 */
export const manualImg = (name: string, small = false) => `/assets/manual/${name}${small ? "_s" : ""}.webp`;
