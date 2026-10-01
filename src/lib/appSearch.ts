/**
 * 🔍 앱 기능 검색 — 검색어 하나로 기능·영상·수업을 바로 찾는다 (2026-10-01 대표님).
 *
 * 예) "타이틀매치미션" → 레벨 10 타이틀매치 영상이 맨 위, 누르면 바로 재생.
 *
 * 찾는 범위
 *   · feature — 앱 기능 바로가기 (아래 FEATURES, 동의어 포함 · 지도진 전용은 staffOnly)
 *   · video   — 153 레벨·워밍업 영상 (missions + mission_videos). 레벨 10 = 타이틀매치
 *   · lesson  — 일차별 수업 매뉴얼 (level_lesson_days)
 *
 * 맞추는 규칙 (회원이 대충 쳐도 나오게)
 *   · 띄어쓰기·대소문자·기호는 무시한다 — "타이틀 매치 미션" = "타이틀매치미션"
 *   · 여러 낱말이면 모두 들어 있어야 한다 — "잽 영상" 은 잽이 들어간 영상
 *   · 초성만 쳐도 된다 — "ㅌㅇㅌㅁㅊ" → 타이틀매치
 */
import type { MenuGlyphName } from "@/components/icons/menuGlyphs";

export type SearchGroup = "feature" | "video" | "lesson";

export type SearchAction =
  /** 앱 안 화면으로 이동 */
  | { kind: "route"; to: string }
  /** 앱 밖 정적 페이지(예: /rankup 안내 페이지) — 전체 새로 열기 */
  | { kind: "href"; href: string }
  /** 영상 바로 재생 */
  | { kind: "video"; url: string; title: string }
  /** 아이디·비밀번호 바꾸기 창 열기 */
  | { kind: "credentials" };

export interface SearchEntry {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  /** 동의어·관련어 — 화면에는 안 보인다 */
  keywords: string[];
  glyph?: MenuGlyphName;
  /** 영상 썸네일 */
  thumb?: string | null;
  /** 타이틀매치 영상 등 눈에 띄게 할 표시 */
  badge?: string;
  action: SearchAction;
  /** 지도진(코치·지점장·관리자)에게만 */
  staffOnly?: boolean;
  /** 이 조건이 켜진 회원에게만 */
  requires?: "diet" | "dm";
  /** 같은 점수면 앞에 — 자주 찾는 것 */
  boost?: number;
}

// ── 글자 다듬기 ─────────────────────────────────────────────

/** 띄어쓰기·기호를 빼고 소문자로 — 한글·영문·숫자·초성만 남긴다 */
export function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^0-9a-zㄱ-ㅎ가-힣]/g, "");
}

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

/** 한글 음절을 초성으로 — "타이틀" → "ㅌㅇㅌ" (영문·숫자는 그대로) */
export function toChosung(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHO[Math.floor((code - 0xac00) / 588)];
    else out += ch;
  }
  return out;
}

/** 초성으로만 쓴 검색어인가 ("ㅌㅇㅌ") */
export const isChosungOnly = (q: string): boolean => /^[ㄱ-ㅎ]+$/.test(q);

// ── 점수 ───────────────────────────────────────────────────

/**
 * 너무 흔한 말 — 검색어 "안에" 들어 있다는 이유만으로는 맞다고 하지 않는다.
 * (안 그러면 "타이틀매치 미션 영상" 에 '영상' 이 있어서 모든 영상이 딸려 나온다)
 */
const GENERIC = new Set(["영상", "동영상", "미션", "미션영상", "레벨미션", "수업", "레슨", "일차", "레벨", "보기", "확인"]);

/** 숫자 경계를 지키는 포함 — "레벨10" 안의 "레벨1" 은 맞지 않는다 */
export function includesWord(hay: string, needle: string): boolean {
  if (!needle) return false;
  const digitStart = /\d/.test(needle[0]);
  const digitEnd = /\d/.test(needle[needle.length - 1]);
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] ?? "";
    const after = hay[i + needle.length] ?? "";
    if ((!digitStart || !/\d/.test(before)) && (!digitEnd || !/\d/.test(after))) return true;
  }
  return false;
}

/**
 * 검색어 낱말 — 숫자만 있는 낱말은 옆 낱말에 붙인다.
 * "레벨 1" → ["레벨1"] (안 붙이면 '1번' 이 들어간 레벨 10 영상까지 걸린다), "1 일차" → ["1일차"]
 */
export function queryTokens(query: string): string[] {
  const out: string[] = [];
  for (const t of query.split(/\s+/).map(normalize).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last !== undefined && (/^\d+$/.test(t) || /^\d+$/.test(last))) out[out.length - 1] = last + t;
    else out.push(t);
  }
  return out;
}

const startsWithWord = (hay: string, needle: string): boolean =>
  hay.startsWith(needle) && !(/\d/.test(needle[needle.length - 1] ?? "") && /\d/.test(hay[needle.length] ?? ""));

/** 0 = 안 맞음. 클수록 위로 */
export function scoreEntry(e: SearchEntry, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(e.title);
  const keys = e.keywords.map(normalize).filter(Boolean);
  const sub = normalize(e.subtitle ?? "");
  const boost = e.boost ?? 0;

  if (isChosungOnly(q)) {
    const ct = toChosung(title);
    if (ct.startsWith(q)) return 45 + boost;
    if (ct.includes(q)) return 35 + boost;
    if (keys.some((k) => toChosung(k).includes(q))) return 25 + boost;
    return 0;
  }

  let best = 0;
  if (title === q) best = 100;
  else if (startsWithWord(title, q)) best = 85;
  else if (includesWord(title, q)) best = 70;
  // 검색어가 제목을 통째로 품은 경우 ("타이틀매치 미션 영상 보기")
  if (best < 75 && title.length >= 3 && includesWord(q, title)) best = 75;
  if (best < 90 && keys.some((k) => k === q)) best = Math.max(best, 90);
  if (best < 65 && keys.some((k) => includesWord(k, q))) best = Math.max(best, 62);
  // 검색어가 관련어를 품은 경우 ("타이틀매치미션" ⊃ "타이틀매치") — 흔한 말·숫자만인 말은 빼고
  if (best < 60 && keys.some((k) => k.length >= 2 && !GENERIC.has(k) && !/^\d+$/.test(k) && includesWord(q, k))) {
    best = Math.max(best, 55);
  }
  if (best < 30 && includesWord(sub, q)) best = 30;

  // 여러 낱말 — 낱말마다 어딘가에 있어야 한다 ("잽 영상", "레벨 10 미션")
  const tokens = queryTokens(query);
  if (best === 0 && tokens.length > 1) {
    const hay = [title, sub, ...keys];
    if (tokens.every((t) => hay.some((h) => includesWord(h, t)))) best = 40;
  }
  return best > 0 ? best + boost : 0;
}

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

/** 맞는 것만 점수순(같으면 원래 순서). 그룹마다 최대 limit 개 */
export function searchEntries(entries: readonly SearchEntry[], query: string, limitPerGroup = 8): SearchHit[] {
  if (!normalize(query)) return [];
  const hits = entries
    .map((entry, i) => ({ entry, score: scoreEntry(entry, query), i }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const perGroup: Record<SearchGroup, number> = { feature: 0, video: 0, lesson: 0 };
  const out: SearchHit[] = [];
  for (const h of hits) {
    if (perGroup[h.entry.group] >= limitPerGroup) continue;
    perGroup[h.entry.group] += 1;
    out.push({ entry: h.entry, score: h.score });
  }
  return out;
}

/** 결과를 화면 묶음으로 — 가장 잘 맞는 묶음이 위로 */
export function groupHits(hits: readonly SearchHit[]): { group: SearchGroup; hits: SearchHit[] }[] {
  const order: SearchGroup[] = [];
  const map = new Map<SearchGroup, SearchHit[]>();
  for (const h of hits) {
    if (!map.has(h.entry.group)) {
      map.set(h.entry.group, []);
      order.push(h.entry.group);
    }
    map.get(h.entry.group)!.push(h);
  }
  return order.map((group) => ({ group, hits: map.get(group)! }));
}

export const GROUP_LABEL: Record<SearchGroup, string> = {
  feature: "바로가기",
  video: "영상",
  lesson: "수업",
};

// ── 누가 볼 수 있나 ────────────────────────────────────────

export interface SearchViewer {
  staff: boolean;
  diet: boolean;
  /** 메시지를 쓸 수 없는 계정이면 false */
  dm: boolean;
}

export const visibleFor = (e: SearchEntry, v: SearchViewer): boolean =>
  (!e.staffOnly || v.staff) && (e.requires !== "diet" || v.diet) && (e.requires !== "dm" || v.dm);

// ── 앱 기능 바로가기 ────────────────────────────────────────
// 회원이 실제로 칠 만한 말을 keywords 에 넣는다. 경로는 App.tsx 라우트와 같아야 한다.

const f = (
  id: string,
  title: string,
  subtitle: string,
  glyph: MenuGlyphName,
  action: SearchAction,
  keywords: string[],
  extra: Partial<SearchEntry> = {},
): SearchEntry => ({ id: `f:${id}`, group: "feature", title, subtitle, glyph, action, keywords, ...extra });

const go = (to: string): SearchAction => ({ kind: "route", to });

export const FEATURES: readonly SearchEntry[] = [
  // 훈련 · 레벨
  f("title-match", "타이틀매치 미션 영상", "레벨 10·20·30·40 심사 동작 — 내 레벨 연습에서 바로 보기", "medal", go("/missions?open=practice"),
    ["타이틀매치", "타이틀 매치", "타이틀매치 미션", "타이틀미션", "미션 영상", "심사", "심사 동작", "승급 심사", "레벨10", "레벨 10", "관문", "보스"], { boost: 6 }),
  f("practice", "내 레벨 연습하기", "이번 레벨 동작과 영상", "glove", go("/missions?open=practice"),
    ["연습", "레벨 연습", "레벨 영상", "동작", "복습", "집에서", "따라하기"], { boost: 3 }),
  f("course", "오늘의 코스", "훈련 탭 — 출석·영상·연습 1·2·3", "glove", go("/missions"),
    ["훈련", "오늘 할 일", "코스", "오삼 코치", "출석 확인", "오늘 운동"], { boost: 2 }),
  f("lesson", "수업 매뉴얼 · 오늘 수업", "레벨마다 1·2·3일차 수업 순서", "clipboard", go("/routines"),
    ["수업", "레슨", "일차", "오늘 수업", "수업 루틴", "커리큘럼", "매뉴얼", "수업 내용", "라운드"], { boost: 3 }),
  f("rankup", "레벨업 기준", "출석 몇 번이면 레벨이 오르나 · 리그별 기준", "medal", go("/rank-up"),
    ["레벨업", "승급", "랭크업", "리그", "화이트", "블루", "레드", "블랙", "출석 3번", "레벨 올리기", "등급"], { boost: 2 }),
  f("rankup-guide", "타이틀매치 · 직행권 안내", "심사 기준과 관문 직행권 한 장 정리", "medal", { kind: "href", href: "/rankup" },
    ["타이틀매치", "직행권", "관문 직행권", "패스트트랙", "심사 기준", "타이틀매치 미션", "승급 안내"]),
  f("training-library", "훈련 라이브러리", "동작 설명 · 그림", "books", go("/training-library"),
    ["라이브러리", "운동 설명", "드릴", "동작 그림", "운동법"]),
  f("library", "153플레이", "레벨 미션 영상 모음", "play", go("/library"),
    ["영상", "동영상", "유튜브", "153 플레이", "레벨 영상", "미션 영상"]),
  f("minigame", "복싱 트레이닝", "반응 속도 게임", "glove", go("/minigame"),
    ["게임", "미니게임", "반응속도", "트레이닝 게임"]),

  // 이벤트 · 커뮤니티
  f("challenge", "153 챌린지 · 왕좌", "출석왕·앱활동왕·닉네임왕 등 8개 왕좌", "crown", go("/myboxer/quest"),
    ["챌린지", "왕좌", "킹", "출석왕", "앱활동왕", "앱 활동왕", "닉네임왕", "닉네임 좋아요왕", "버피", "버피왕", "체력왕", "순위", "1위"], { boost: 2 }),
  f("launch-event", "런칭 이벤트", "왕좌마다 1위 50,000 마일리지", "crown", go("/myboxer/quest"),
    ["이벤트", "런칭", "런칭 이벤트", "1위 선물", "선물", "상품", "5만 마일리지"], { boost: 3 }),
  f("heart", "하트 보내기", "같은 지점 회원 닉네임에 하트", "crown", go("/myboxer/quest"),
    ["하트", "좋아요", "닉네임 좋아요", "응원", "하트 보내기"]),
  f("community", "153 커뮤니티", "챔피언 일기 · 코너맨 · 응원", "chat", go("/myboxer/community"),
    ["커뮤니티", "일기", "챔피언 일기", "코너맨", "장비 나눔", "게시판"]),
  f("messages", "메시지", "회원·코치님과 1:1 대화", "dm", go("/messages"),
    ["메시지", "dm", "디엠", "쪽지", "대화", "채팅", "코치님께 연락", "문의"], { requires: "dm" }),
  f("ranking", "랭킹 · 명예의 전당", "지점 순위", "medal", go("/halloffame"),
    ["랭킹", "순위", "등수", "명예의 전당", "명예의전당"]),

  // 내 정보 · 혜택
  f("myboxer", "MY복서 · 내 라이센스", "내 레벨 카드 · 오늘의 할 일", "myboxer", go("/myboxer"),
    ["라이센스", "내 카드", "내 레벨", "마이복서", "my복서", "오늘의 할 일"], { boost: 1 }),
  f("mileage", "마일리지", "출석 +500 · 레벨업 +500 · 타이틀매치 +5,000", "myboxer", go("/myboxer"),
    ["마일리지", "포인트", "적립", "현금", "마일리지 확인", "내 마일리지"], { boost: 3 }),
  f("membership", "수강권 · 남은 기간", "이용 기간과 남은 횟수", "idcard", go("/membership"),
    ["수강권", "이용권", "회원권", "기간", "만료", "남은 기간", "남은 횟수", "pt"]),
  f("membership-plans", "멤버십 상품", "재등록 · 연장", "idcard", go("/membership-plans"),
    ["멤버십", "재등록", "연장", "가격", "상품"]),
  f("rewards", "리워드", "젬과 보상", "medal", go("/rewards"),
    ["리워드", "젬", "보석", "보상", "상점"]),
  f("character", "캐릭터 꾸미기", "내 복서 캐릭터", "avatar", go("/character-studio"),
    ["캐릭터", "아바타", "꾸미기", "옷", "스타일"]),
  f("mindset", "153마인드셋", "마음 훈련 · 스토리", "mind", go("/myboxer/visualization"),
    ["마인드셋", "마인드", "명상", "스토리", "이미지 트레이닝"]),
  f("cert", "단증혜택", "단증과 혜택 안내", "medal", go("/cert-benefits"),
    ["단증", "협회", "자격증", "단증 혜택"]),
  f("diet", "153다이어트", "식단 · 체중 관리", "bowl", go("/diet"),
    ["다이어트", "식단", "체중", "감량", "몸무게"], { requires: "diet" }),
  f("mypage", "내 정보", "프로필 · 지점 · 연락처", "idcard", go("/mypage"),
    ["내 정보", "프로필", "전화번호", "지점", "사진", "마이페이지"]),

  // 설정 · 계정
  f("nickname", "닉네임 바꾸기", "순위·TV에 실명 대신 닉네임으로", "gear", go("/settings"),
    ["닉네임", "별명", "이름 숨기기", "실명", "닉네임 변경"], { boost: 2 }),
  f("credentials", "아이디 · 비밀번호 바꾸기", "처음 받은 계정 정보를 내 것으로", "gear", { kind: "credentials" },
    ["비밀번호", "비번", "아이디", "계정", "로그인 정보", "비밀번호 변경", "아이디 변경"]),
  f("passkey", "지문 · 얼굴 로그인", "다음부터 지문이나 얼굴로 바로 로그인", "gear", go("/settings"),
    ["지문", "얼굴 로그인", "패스키", "간편 로그인", "생체 인증"]),
  f("theme", "밝은 화면 · 어두운 화면", "화면 테마 바꾸기", "gear", go("/settings"),
    ["다크모드", "다크 모드", "테마", "밝게", "어둡게", "화면 색"]),
  f("settings", "설정", "알림 · 계정 · 화면", "gear", go("/settings"),
    ["설정", "환경설정", "알림"]),
  f("attendance", "출석 방법", "입구 얼굴 인식이면 자동 출석 — 훈련 탭에서 확인", "glove", go("/missions"),
    ["출석", "출석 방법", "얼굴 인식", "체크인", "qr", "출석 체크"], { boost: 1 }),
  f("guide", "가이드 · 사용법", "처음 쓰는 분을 위한 안내", "compass", go("/guide"),
    ["가이드", "사용법", "도움말", "처음", "안내", "설명서"]),
  f("faq", "자주 묻는 질문", "궁금한 점 모음", "compass", go("/guide/faq"),
    ["faq", "질문", "자주 묻는", "문의", "궁금"]),
  f("safety", "안전 수칙", "부상 없이 운동하기", "compass", go("/guide/safety"),
    ["안전", "부상", "통증", "다쳤", "주의"]),
  f("about", "153이란?", "153복싱짐 이야기", "fish", go("/about/153"),
    ["153", "소개", "153 뜻", "브랜드"]),

  // 지도진 전용
  f("coach", "코치 화면", "회원 승인 · 심사 · 오늘 출석", "clipboard", go("/coach"),
    ["코치", "코치 화면", "회원 관리", "승인", "레벨 승인", "심사 승인"], { staffOnly: true }),
  f("manager", "관리자 화면", "지점 관리", "gear", go("/manager"),
    ["관리자", "관리", "지점 관리", "매니저"], { staffOnly: true }),
  f("live-board", "라이브보드 · TV", "지점 TV 화면 고르기", "play", go("/manager/live-board"),
    ["tv", "티비", "사이니지", "라이브보드", "전광판"], { staffOnly: true }),
  f("routine-builder", "수업 루틴 만들기", "코치 루틴 빌더", "clipboard", go("/routine-builder"),
    ["루틴 만들기", "루틴 빌더", "수업 만들기"], { staffOnly: true }),
];

/** 처음 들어왔을 때 보여 줄 추천 검색어 */
export const SUGGESTED_QUERIES: readonly string[] = [
  "타이틀매치 미션",
  "오늘 수업",
  "마일리지",
  "런칭 이벤트",
  "닉네임",
  "비밀번호",
  "레벨업 기준",
  "출석",
];

// ── 영상 · 수업 → 검색 항목 ────────────────────────────────

export interface VideoSource {
  id: string;
  title: string;
  description?: string | null;
  keyPoints: string[];
  videoUrl: string;
  thumb?: string | null;
  category?: string | null;
  rank?: string | null;
  level?: number | null;
}

const RANK_KO: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

/** "[복싱/잽] 4스텝 잽ㅣ설명" → { tag, name, sub } (useLevelVideos 의 parseVideoTitle 과 같은 규칙) */
export const splitVideoTitle = (raw: string) => {
  const tagMatch = raw.match(/^\[[^/\]]*\/?([^\]]*)\]\s*/);
  const tag = tagMatch ? tagMatch[1].trim() : "";
  const rest = raw.replace(/^\[[^\]]*\]\s*/, "");
  const [name, ...subParts] = rest.split("ㅣ");
  return { tag, name: name.trim(), sub: subParts.join("ㅣ").trim() };
};

export function videoEntry(v: VideoSource): SearchEntry {
  const { tag, name, sub } = splitVideoTitle(v.title);
  const isTitle = v.level === 10 && v.category !== "warmup";
  const isWarmup = v.category === "warmup";
  const rankKo = v.rank ? RANK_KO[v.rank] ?? v.rank : "";
  const where = isWarmup ? "워밍업 영상" : rankKo && v.level ? `${rankKo} L${v.level}` : "153 영상";
  const keywords = [
    tag, sub, v.description ?? "", ...v.keyPoints,
    rankKo, v.level ? `레벨${v.level}` : "", v.level ? `레벨 ${v.level}` : "",
    "영상", "동영상",
    ...(isTitle ? ["타이틀매치", "타이틀 매치", "타이틀매치 미션", "타이틀미션", "미션", "심사", "심사 동작", "승급 심사", "관문"] : []),
    ...(isWarmup ? ["워밍업", "몸풀기", "준비운동", "줄넘기"] : ["레벨 미션", "미션 영상"]),
  ].filter(Boolean) as string[];
  return {
    id: `v:${v.id}`,
    group: "video",
    title: name || v.title,
    subtitle: [where, isTitle ? "타이틀매치" : "", tag].filter(Boolean).join(" · "),
    keywords,
    thumb: v.thumb ?? null,
    badge: isTitle ? "타이틀매치" : undefined,
    action: { kind: "video", url: v.videoUrl, title: v.title },
    // 타이틀매치 영상은 같은 점수면 위로
    boost: isTitle ? 8 : 0,
  };
}

export interface LessonSource {
  dayNo: number;
  level: number;
  title: string;
  goal: string;
  stepNames: string[];
  levelLabel: string;
}

export function lessonEntry(d: LessonSource): SearchEntry {
  return {
    id: `l:${d.dayNo}`,
    group: "lesson",
    title: `${d.dayNo}일차 · ${d.title}`,
    subtitle: `${d.levelLabel}${d.goal ? ` · ${d.goal}` : ""}`,
    keywords: [`${d.dayNo}일차`, `${d.dayNo}일`, `레벨${d.level}`, `레벨 ${d.level}`, "수업", "레슨", "일차", ...d.stepNames],
    action: { kind: "route", to: `/routines?day=${d.dayNo}` },
  };
}

// ── 최근 검색 (이 기기에만) ─────────────────────────────────

const RECENT_KEY = "153search:recent";
const RECENT_MAX = 8;

export function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(q: string): string[] {
  const t = q.trim().slice(0, 40);
  if (!t) return loadRecent();
  const next = [t, ...loadRecent().filter((x) => normalize(x) !== normalize(t))].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막힌 브라우저 — 무시 */
  }
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* 무시 */
  }
}
