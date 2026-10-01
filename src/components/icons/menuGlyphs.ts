/**
 * 153 글리프 — 마이복서153 전체 메뉴 전용 아이콘 (2026-09-29 대표님: 이모지 말고 우리 스타일로).
 *
 * 디자인 규칙
 *   · 48 × 48 그리드, 위쪽에서 빛이 드는 부드러운 2.5D (세로 그라데이션 + 흰 하이라이트).
 *   · 색은 브랜드 3색만 — 민트(훈련·핵심) · 금(보상·도전) · 먹(구조). 보라·파랑·네온 없음.
 *   · 먹/종이 부품은 CSS 변수(--glyph-*, src/index.css)라 다크 모드에서 은색으로 자동 반전된다.
 *
 * 각 함수는 SVG 안쪽 마크업을 돌려준다. p = 그라데이션 id 접두사 (화면에 같은 아이콘이 여러 번
 * 떠도 id 가 겹치지 않게 GlyphTile 이 useId 로 넘긴다). 마크업은 고정 문자열 — 사용자 입력 없음.
 */

export type MenuGlyphName =
  | "myboxer"
  | "play"
  | "titlematch"
  | "glove"
  | "books"
  | "clipboard"
  | "crown"
  | "chat"
  | "dm"
  | "mind"
  | "medal"
  | "avatar"
  | "bowl"
  | "compass"
  | "fish"
  | "idcard"
  | "gear";

type GradientKey = "mint" | "mintD" | "gold" | "goldD" | "ink" | "paper" | "skin";

const stops = (top: string, bottom: string) =>
  `<stop offset="0" style="stop-color:${top}"/><stop offset="1" style="stop-color:${bottom}"/>`;

const GRADIENTS: Record<GradientKey, (p: string) => string> = {
  mint: (p) => `<linearGradient id="${p}mint" x1="0" y1="0" x2="0" y2="1">${stops("#7DF3D7", "#17B990")}</linearGradient>`,
  mintD: (p) => `<linearGradient id="${p}mintD" x1="0" y1="0" x2="0" y2="1">${stops("#34D9AF", "#0C9171")}</linearGradient>`,
  gold: (p) => `<linearGradient id="${p}gold" x1="0" y1="0" x2="0" y2="1">${stops("#FFE593", "#F3A73B")}</linearGradient>`,
  goldD: (p) => `<linearGradient id="${p}goldD" x1="0" y1="0" x2="0" y2="1">${stops("#F7BF52", "#D98A1E")}</linearGradient>`,
  ink: (p) => `<linearGradient id="${p}ink" x1="0" y1="0" x2="0" y2="1">${stops("var(--glyph-ink-t)", "var(--glyph-ink-b)")}</linearGradient>`,
  paper: (p) => `<linearGradient id="${p}paper" x1="0" y1="0" x2="0" y2="1">${stops("var(--glyph-paper-t)", "var(--glyph-paper-b)")}</linearGradient>`,
  skin: (p) => `<linearGradient id="${p}skin" x1="0" y1="0" x2="0" y2="1">${stops("#FFE1C4", "#F4B58A")}</linearGradient>`,
};

const defs = (p: string, keys: GradientKey[]) => `<defs>${keys.map((k) => GRADIENTS[k](p)).join("")}</defs>`;

const INK_FILL = 'style="fill:var(--glyph-ink)"';
const EDGE_FILL = 'style="fill:var(--glyph-paper-edge)"';
const EDGE_STROKE = 'style="stroke:var(--glyph-paper-edge)"';

const GEAR_TEETH = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((a) => `<rect x="20.5" y="4.5" width="7" height="9" rx="2.2" transform="rotate(${a} 24 24)"/>`)
  .join("");

export const MENU_GLYPHS: Record<MenuGlyphName, (p: string) => string> = {
  /** MY복서 — 내 복서 홈(예전 홈 화면: 라이센스 카드·오늘의 할 일·순위). 먹색 집 + 민트 지붕 + 금별 (2026-09-29) */
  myboxer: (p) => `${defs(p, ["ink", "mint", "gold"])}
<path d="M10.5 22.3 22.2 12.1a2.8 2.8 0 0 1 3.6 0l11.7 10.2v16.2a4 4 0 0 1-4 4h-19a4 4 0 0 1-4-4Z" fill="url(#${p}ink)"/>
<path d="M6.2 23.8 24 8.2l17.8 15.6" fill="none" stroke="url(#${p}mint)" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M11.8 19.9 19.6 13" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>
<path d="M24 25.6l2.2 4.5 5 .7-3.6 3.5.8 4.9-4.4-2.3-4.4 2.3.8-4.9-3.6-3.5 5-.7Z" fill="url(#${p}gold)" stroke="url(#${p}gold)" stroke-width="1.4" stroke-linejoin="round"/>`,

  /** 153플레이 — 영상관: 먹색 모니터 + 민트 화면 + 재생 */
  play: (p) => `${defs(p, ["ink", "mint"])}
<rect x="4.5" y="8.5" width="39" height="28" rx="8" fill="url(#${p}ink)"/>
<rect x="8.5" y="12.5" width="31" height="20" rx="4.5" fill="url(#${p}mint)"/>
<path d="M8.5 17a4.5 4.5 0 0 1 4.5-4.5h17.5L17.8 32.5H13A4.5 4.5 0 0 1 8.5 28Z" fill="#fff" opacity=".16"/>
<path d="M21 18.3v9.4c0 1 1.1 1.6 1.9 1.1l7.5-4.7c.8-.5.8-1.7 0-2.2l-7.5-4.7c-.8-.5-1.9.1-1.9 1.1Z" fill="#fff"/>
<rect x="21.5" y="36" width="5" height="4" ${INK_FILL} opacity=".85"/>
<rect x="15" y="39.5" width="18" height="3.5" rx="1.75" fill="url(#${p}ink)"/>`,

  /** 타이틀매치 — 금 트로피 + 흰 재생 표시(타이틀매치 영상 모음) + 먹 받침·민트 명판 (2026-10-01) */
  titlematch: (p) => `${defs(p, ["gold", "goldD", "ink", "mint"])}
<path d="M13 10.6H9.3a1.7 1.7 0 0 0-1.7 1.8c.5 5.6 3.7 9 8.3 9.8" fill="none" stroke="url(#${p}goldD)" stroke-width="2.9" stroke-linecap="round"/>
<path d="M35 10.6h3.7a1.7 1.7 0 0 1 1.7 1.8c-.5 5.6-3.7 9-8.3 9.8" fill="none" stroke="url(#${p}goldD)" stroke-width="2.9" stroke-linecap="round"/>
<rect x="21.2" y="26" width="5.6" height="8" fill="url(#${p}goldD)"/>
<path d="M13 7.5h22v9a11 11 0 0 1-22 0Z" fill="url(#${p}gold)" stroke="url(#${p}gold)" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M16.6 10.6v5.6" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
<path d="M21.3 11.9v8.6c0 .9 1 1.4 1.8.9l6.9-4.3c.7-.4.7-1.4 0-1.9l-6.9-4.3c-.8-.5-1.8.1-1.8 1Z" fill="#fff"/>
<rect x="14" y="33.2" width="20" height="9.6" rx="2.8" fill="url(#${p}ink)"/>
<rect x="18.5" y="36.7" width="11" height="2.6" rx="1.3" fill="url(#${p}mint)"/>`,

  /** 복싱 트레이닝 — 뻗는 민트 글러브(둥근 주먹 + 엄지 감싼 선 + 흰 끈) + 금색 타격감 */
  glove: (p) => `${defs(p, ["mint", "mintD", "gold"])}
<g transform="rotate(18 24 26)">
<path d="M14.8 33.6h19.4v6.9a3.3 3.3 0 0 1-3.3 3.3H18.1a3.3 3.3 0 0 1-3.3-3.3Z" fill="url(#${p}mintD)"/>
<rect x="14.8" y="36.3" width="19.4" height="2.4" fill="#fff" opacity=".9"/>
<path d="M24.8 4.8c8.7 0 15.2 6.3 15.2 14.6v5.7c0 6.3-5 10.6-11.3 10.6H18.3c-4.4 0-7.9-3.5-7.9-7.9V19.4C10.4 11.1 16.4 4.8 24.8 4.8Z" fill="url(#${p}mint)"/>
<path d="M10.6 24.4c0-3 2.4-5.4 5.4-5.4h6.6a3.6 3.6 0 0 1 0 7.2H17c-1.5 0-2.7 1.2-2.7 2.7v1.3" fill="none" stroke="#0C9171" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
<path d="M17.6 10.3c1.8-1.7 4.1-2.7 6.7-2.9" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round" fill="none"/>
</g>
<g stroke="url(#${p}gold)" stroke-width="2.6" stroke-linecap="round"><path d="M39.9 6.8l2.3-3.2"/><path d="M42.8 11.8l3.4-1.2"/><path d="M43.2 17.5l3.2.5"/></g>`,

  /** 훈련 라이브러리 — 책장 (민트·먹·금 책) */
  books: (p) => `${defs(p, ["mint", "ink", "gold"])}
<rect x="6.5" y="12" width="9.5" height="29" rx="2.6" fill="url(#${p}mint)"/>
<rect x="17.5" y="7.5" width="10" height="33.5" rx="2.6" fill="url(#${p}ink)"/>
<g transform="rotate(16 30 41)"><rect x="30" y="14" width="9.5" height="27" rx="2.6" fill="url(#${p}gold)"/><rect x="32" y="18" width="5.5" height="2" rx="1" fill="#fff" opacity=".75"/></g>
<g fill="#fff"><rect x="8.5" y="16" width="5.5" height="2" rx="1" opacity=".75"/><rect x="8.5" y="34" width="5.5" height="2" rx="1" opacity=".75"/><rect x="19.5" y="12" width="6" height="2" rx="1" opacity=".55"/><rect x="19.5" y="34" width="6" height="2" rx="1" opacity=".55"/></g>
<rect x="4" y="41" width="40" height="3" rx="1.5" ${EDGE_FILL}/>`,

  /** 수업 루틴 — 클립보드 체크리스트 */
  clipboard: (p) => `${defs(p, ["ink", "paper", "mint"])}
<rect x="8.5" y="7" width="31" height="37" rx="6.5" fill="url(#${p}ink)"/>
<rect x="12" y="11" width="24" height="29.5" rx="3.6" fill="url(#${p}paper)"/>
<rect x="17" y="4.2" width="14" height="7.6" rx="3.8" fill="url(#${p}mint)"/>
<circle cx="17.5" cy="18.5" r="2.7" fill="url(#${p}mint)"/><circle cx="17.5" cy="26" r="2.7" fill="url(#${p}mint)"/><circle cx="17.5" cy="33.5" r="2.7" ${EDGE_FILL}/>
<g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.3 18.6l.9.9 1.7-1.9"/><path d="M16.3 26.1l.9.9 1.7-1.9"/></g>
<g ${INK_FILL}><rect x="22.5" y="17.2" width="10.5" height="2.6" rx="1.3" opacity=".55"/><rect x="22.5" y="24.7" width="8.5" height="2.6" rx="1.3" opacity=".55"/><rect x="22.5" y="32.2" width="10" height="2.6" rx="1.3" opacity=".25"/></g>`,

  /** 153 챌린지 — 왕좌(킹 보드) 금관 + 민트 보석 */
  crown: (p) => `${defs(p, ["gold", "goldD", "mint"])}
<g transform="translate(24 25) scale(1.1) translate(-24 -25)">
<path d="M8.5 17.5l8 7.3 6-12.3c.6-1.2 2.4-1.2 3 0l6 12.3 8-7.3-3.4 16.3H11.9Z" fill="url(#${p}gold)" stroke="url(#${p}gold)" stroke-width="2.4" stroke-linejoin="round"/>
<rect x="11" y="35.5" width="26" height="5.5" rx="2.75" fill="url(#${p}goldD)"/>
<circle cx="8" cy="16" r="2.8" fill="url(#${p}gold)"/><circle cx="24" cy="9.5" r="2.8" fill="url(#${p}gold)"/><circle cx="40" cy="16" r="2.8" fill="url(#${p}gold)"/>
<path d="M24 22.8l3.6 4.2-3.6 4.2-3.6-4.2Z" fill="url(#${p}mint)"/>
<path d="M13 20.6l3.2 2.9" stroke="#fff" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round"/>
</g>`,

  /** 153 커뮤니티 — 말풍선 둘 (먹 + 민트, 입력 중 점 셋) */
  chat: (p) => `${defs(p, ["ink", "mint"])}
<path d="M12.5 7h14a8 8 0 0 1 8 8v2.5a8 8 0 0 1-8 8H15l-5.2 4c-.8.6-1.9 0-1.8-1l.4-4.1A8 8 0 0 1 4.5 17.5V15a8 8 0 0 1 8-8Z" fill="url(#${p}ink)"/>
<g fill="#fff" opacity=".7"><rect x="11" y="13.2" width="15" height="2.4" rx="1.2"/><rect x="11" y="18" width="9" height="2.4" rx="1.2" opacity=".7"/></g>
<path d="M22 18.5h14a8 8 0 0 1 8 8V29a8 8 0 0 1-4 6.9l.4 4.1c.1 1-1 1.6-1.8 1l-5.2-4H22a8 8 0 0 1-8-8v-2.5a8 8 0 0 1 8-8Z" fill="url(#${p}mint)"/>
<g fill="#fff"><circle cx="22.5" cy="27.8" r="2.1"/><circle cx="29" cy="27.8" r="2.1"/><circle cx="35.5" cy="27.8" r="2.1"/></g>`,

  /** 메시지(DM) — 민트 종이비행기(윗날개 밝게·아랫날개 진하게 + 먹색 접힌 자락) + 금색 속도선 (2026-09-30) */
  dm: (p) => `${defs(p, ["mint", "mintD", "ink", "gold"])}
<path d="M5.8 21.6 41.6 6.9 20.9 27.4Z" fill="url(#${p}mint)" stroke="url(#${p}mint)" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M20.9 27.4 41.6 6.9 29.2 41.2Z" fill="url(#${p}mintD)" stroke="url(#${p}mintD)" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M20.9 27.4 22.6 38.2 27 33Z" fill="url(#${p}ink)" stroke="url(#${p}ink)" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M10.4 21 33.6 11.6" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>
<g stroke="url(#${p}gold)" stroke-width="2.6" stroke-linecap="round"><path d="M4.6 32.4h7.2"/><path d="M8.6 38.6h6.2"/></g>`,

  /** 153마인드셋 — 옆얼굴 + 민트 반짝임 */
  mind: (p) => `${defs(p, ["ink", "mint", "gold"])}
<path d="M21.5 5.5C12.9 5.5 7 11.7 7 19.6c0 4.8 2.2 8.3 5 10.9V41a2.5 2.5 0 0 0 2.5 2.5h11.3A2.5 2.5 0 0 0 28.3 41v-3.6h3.9a4 4 0 0 0 4-4v-4.6l2.9-1c1-.3 1.3-1.5.6-2.3L36.5 21c-.6-8.8-6.6-15.5-15-15.5Z" fill="url(#${p}ink)"/>
<path d="M21 11.8c.4 3.6 1.6 4.8 5.2 5.2-3.6.4-4.8 1.6-5.2 5.2-.4-3.6-1.6-4.8-5.2-5.2 3.6-.4 4.8-1.6 5.2-5.2Z" fill="url(#${p}mint)" stroke="url(#${p}mint)" stroke-width="1.6" stroke-linejoin="round"/>
<circle cx="29" cy="11.5" r="1.7" fill="url(#${p}gold)"/><circle cx="14.5" cy="24" r="1.3" fill="#fff" opacity=".6"/>`,

  /** 단증혜택 — 금메달 로제트 + 민트 리본 */
  medal: (p) => `${defs(p, ["mint", "mintD", "gold", "goldD"])}
<path d="M15.5 27.5 11.2 42c-.2.8.6 1.5 1.4 1.1l4.4-2.1 3 3.8c.5.7 1.6.5 1.8-.3l3.4-11.7Z" fill="url(#${p}mint)"/>
<path d="M32.5 27.5 36.8 42c.2.8-.6 1.5-1.4 1.1L31 41l-3 3.8c-.5.7-1.6.5-1.8-.3l-3.4-11.7Z" fill="url(#${p}mintD)"/>
<circle cx="24" cy="19.5" r="13" fill="url(#${p}gold)"/>
<circle cx="24" cy="19.5" r="9.3" fill="none" stroke="url(#${p}goldD)" stroke-width="1.8"/>
<path d="M24 13.3l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6Z" fill="#FFF6D8" stroke="#FFF6D8" stroke-width="1" stroke-linejoin="round"/>
<path d="M14.2 14.3a11 11 0 0 1 5-4.6" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round" fill="none"/>`,

  /** 캐릭터 — 민트 헤드밴드 복서 + 금색 반짝임 */
  avatar: (p) => `${defs(p, ["mint", "skin", "ink", "gold"])}
<path d="M8.5 44c0-8.4 6.9-13.5 15.5-13.5S39.5 35.6 39.5 44Z" fill="url(#${p}mint)"/>
<circle cx="24" cy="19.5" r="10.5" fill="url(#${p}skin)"/>
<path d="M13.5 19c-.3-6.6 4.2-11 10.5-11s10.8 4.4 10.5 11c-2.9-2.6-6.6-3.9-10.5-3.9S16.4 16.4 13.5 19Z" fill="url(#${p}ink)"/>
<path d="M13.6 17.2c6.4-3.3 14.4-3.3 20.8 0l-.4 3.2c-6.1-2.9-13.9-2.9-20 0Z" fill="url(#${p}mint)"/>
<g ${INK_FILL}><circle cx="20.2" cy="23" r="1.35"/><circle cx="27.8" cy="23" r="1.35"/></g>
<path d="M22 27.2c1.2.9 2.8.9 4 0" style="stroke:var(--glyph-ink)" stroke-width="1.3" stroke-linecap="round" fill="none"/>
<path d="M39 5.5c.3 2.6 1.1 3.4 3.7 3.7-2.6.3-3.4 1.1-3.7 3.7-.3-2.6-1.1-3.4-3.7-3.7 2.6-.3 3.4-1.1 3.7-3.7Z" fill="url(#${p}gold)"/>`,

  /** 153다이어트 — 샐러드 볼 */
  bowl: (p) => `${defs(p, ["mint", "mintD", "paper", "gold"])}
<path d="M17.8 21.8c-.6-5.8 3-10.6 9-12 .8 5.9-2.9 10.8-9 12Z" fill="url(#${p}mint)"/>
<path d="M24.5 21.5c1.2-6.4 6.2-10.4 12.7-10.4-.9 6.4-5.9 10.4-12.7 10.4Z" fill="url(#${p}mintD)"/>
<circle cx="14" cy="19" r="4.6" fill="url(#${p}gold)"/>
<path d="M5.5 23.5h37c0 9.6-7.8 17.5-17.5 17.5h-2C13.3 41 5.5 33.1 5.5 23.5Z" fill="url(#${p}paper)" ${EDGE_STROKE} stroke-width="1.2"/>
<rect x="4.5" y="21.5" width="39" height="4" rx="2" fill="url(#${p}mint)"/>
<path d="M11 29.5c1.2 3.6 4 6.3 7.6 7.4" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".8"/>`,

  /** 가이드 — 나침반 */
  compass: (p) => `${defs(p, ["paper", "mint", "ink"])}
<circle cx="24" cy="24" r="18.5" fill="url(#${p}ink)"/>
<circle cx="24" cy="24" r="15" fill="url(#${p}paper)"/>
<g ${INK_FILL} opacity=".35"><rect x="23" y="11" width="2" height="3.2" rx="1"/><rect x="23" y="33.8" width="2" height="3.2" rx="1"/><rect x="11" y="23" width="3.2" height="2" rx="1"/><rect x="33.8" y="23" width="3.2" height="2" rx="1"/></g>
<path d="M30.6 17.4 26 26l-4-4Z" fill="url(#${p}mint)" stroke="url(#${p}mint)" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M17.4 30.6 22 22l4 4Z" style="fill:var(--glyph-ink);stroke:var(--glyph-ink)" stroke-width="1.6" stroke-linejoin="round"/>
<circle cx="24" cy="24" r="2" fill="#fff"/>`,

  /** 153이란? — 153마리 물고기 이야기의 물고기 */
  fish: (p) => `${defs(p, ["mint", "mintD", "gold"])}
<g transform="translate(24 24) scale(1.08) translate(-24 -24)">
<path d="M37 24l6.3-6.2c.8-.8 2.2-.2 2 1l-1 5.2 1 5.2c.2 1.2-1.2 1.8-2 1Z" fill="url(#${p}mintD)"/>
<path d="M4.5 24c4.3-7.6 11.6-12 19.6-12 6.3 0 11.2 3.1 14.9 7.5a7 7 0 0 1 0 9C35.3 32.9 30.4 36 24.1 36 16.1 36 8.8 31.6 4.5 24Z" fill="url(#${p}mint)"/>
<path d="M24 13.5c-2.3 3-3.4 6.5-3.4 10.5s1.1 7.5 3.4 10.5" stroke="#0C9171" stroke-opacity=".35" stroke-width="1.8" stroke-linecap="round" fill="none"/>
<circle cx="13.8" cy="22.3" r="2.7" fill="#fff"/><circle cx="14.3" cy="22.5" r="1.35" fill="#12202B"/>
<path d="M9 19.2c2.5-2.4 5.6-4 9-4.6" stroke="#fff" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
<circle cx="31" cy="12.5" r="1.8" fill="url(#${p}gold)"/><circle cx="35.5" cy="9" r="1.2" fill="url(#${p}gold)" opacity=".8"/>
</g>`,

  /** 내정보 — 회원증 */
  idcard: (p) => `${defs(p, ["paper", "mint", "ink"])}
<rect x="4.5" y="9.5" width="39" height="29" rx="6.5" fill="url(#${p}paper)" ${EDGE_STROKE} stroke-width="1.2"/>
<path d="M4.5 16a6.5 6.5 0 0 1 6.5-6.5h26a6.5 6.5 0 0 1 6.5 6.5v.5h-39Z" fill="url(#${p}mint)"/>
<circle cx="15.5" cy="25" r="4.2" fill="url(#${p}ink)"/>
<path d="M8.8 34.5c.6-3.6 3.3-5.6 6.7-5.6s6.1 2 6.7 5.6Z" fill="url(#${p}ink)"/>
<g ${INK_FILL}><rect x="25" y="22" width="13" height="3" rx="1.5" opacity=".75"/><rect x="25" y="28.5" width="9" height="3" rx="1.5" opacity=".3"/></g>`,

  /** 설정 — 톱니 + 민트 축 */
  gear: (p) => `${defs(p, ["mint", "paper"])}
<defs><linearGradient id="${p}gearg" x1="0" y1="4" x2="0" y2="44" gradientUnits="userSpaceOnUse">${stops("var(--glyph-ink-t)", "var(--glyph-ink-b)")}</linearGradient></defs>
<g fill="url(#${p}gearg)">${GEAR_TEETH}<circle cx="24" cy="24" r="14.5"/></g>
<circle cx="24" cy="24" r="7" fill="url(#${p}mint)"/><circle cx="24" cy="24" r="3.2" fill="url(#${p}paper)"/>`,
};
