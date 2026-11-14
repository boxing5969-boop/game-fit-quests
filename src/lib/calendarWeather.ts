/**
 * 캘린더 3-5 날씨 도장 (2026-11-14 대표님 「기상청 api도 비용이 안드는거면 진행하자」)
 *   · 자료 = get_my_calendar 의 weather — 내 지점 · 보이는 날짜 (서버 _branch_weather_json · Edge Function kma-weather 가 매시 받아 둠)
 *   · 판정(비 · 눈 · 폭염 · 한파)은 서버 한 곳 — 기준 app_settings.weather_sites: 비 = 하루 1mm 이상 · 폭염 = 최고 33℃ 이상 ·
 *     한파 = 최저 -12℃ 이하(기상청 폭염 · 한파 일수 기준) · 눈 = 신적설 · 눈 갈래 일기현상 · 실황 눈 · 겹치면 눈 > 비 > 한파 > 폭염
 *   · 화면 규칙(회원 감정 설계): 도장은 출석한 날에만 — 칭찬('비 오는 날도 왔어요'). 오지 않은 날의 날씨는 말하지 않는다.
 *     오늘 · 앞날은 예보 한 줄(맑음 · 비 · 강수확률 · 최저 ~ 최고).
 */

export type WeatherKind = "rain" | "snow" | "heat" | "cold";

export interface WeatherFc {
  tmin: number | null;
  tmax: number | null;
  /** 강수확률 % (그날 가장 높은 값) */
  pop: number | null;
  /** 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기 */
  pty: number;
  /** 1 맑음 · 3 구름많음 · 4 흐림 */
  sky: number | null;
  snow: boolean;
}

export interface DayWeather {
  day: string;
  /** 관측한 날씨(지난 날 · 오늘 지금까지) — 도장 */
  kind: WeatherKind | null;
  /** 관측 강수량 mm */
  rain: number | null;
  tmin: number | null;
  tmax: number | null;
  /** 오늘 · 앞날 예보 */
  fc: WeatherFc | null;
}

/** 도장 — 칭찬 글 · 짧은 이름 (그림은 components/attendance/CalendarMarkIcons WeatherIcon — 우산 · 눈송이 · 불꽃 · 온도계) */
export const WEATHER_META: Record<WeatherKind, { label: string; short: string }> = {
  rain: { label: "비 오는 날도 왔어요", short: "비" },
  snow: { label: "눈 오는 날도 왔어요", short: "눈" },
  heat: { label: "폭염에도 왔어요", short: "폭염" },
  cold: { label: "한파에도 왔어요", short: "한파" },
};

const KINDS: readonly WeatherKind[] = ["rain", "snow", "heat", "cold"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const num = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

function normalizeFc(raw: unknown): WeatherFc | null {
  const r = obj(raw);
  if (!r) return null;
  const pty = num(r.pty);
  const sky = num(r.sky);
  return {
    tmin: num(r.tmin),
    tmax: num(r.tmax),
    pop: num(r.pop),
    pty: pty != null && [0, 1, 2, 3, 4].includes(pty) ? pty : 0,
    sky: sky != null && [1, 3, 4].includes(sky) ? sky : null,
    snow: r.snow === true,
  };
}

/** 서버 weather 배열 → 날짜마다 (모르는 칸은 버림) */
export function normalizeWeather(raw: unknown): Map<string, DayWeather> {
  const out = new Map<string, DayWeather>();
  for (const e of Array.isArray(raw) ? raw : []) {
    const r = obj(e);
    const day = typeof r?.day === "string" ? r.day.slice(0, 10) : "";
    if (!r || !YMD.test(day)) continue;
    const kind = typeof r.kind === "string" && (KINDS as readonly string[]).includes(r.kind) ? (r.kind as WeatherKind) : null;
    out.set(day, { day, kind, rain: num(r.rain), tmin: num(r.tmin), tmax: num(r.tmax), fc: normalizeFc(r.fc) });
  }
  return out;
}

export const weatherOn = (map: ReadonlyMap<string, DayWeather> | null | undefined, day: string): DayWeather | null => map?.get(day) ?? null;

/** 출석한 날의 날씨 도장 — 오지 않은 날은 없다(칭찬만) */
export function weatherStamp(w: DayWeather | null | undefined, attended: boolean): WeatherKind | null {
  return attended && w?.kind ? w.kind : null;
}

const deg = (n: number) => `${Math.round(n)}°`;

/** 그날 카드의 도장 한 줄 — '비 오는 날도 왔어요 · 12.5mm' · '폭염에도 왔어요 · 최고 34°' · '한파에도 왔어요 · 최저 -13°' */
export function stampLine(w: DayWeather): string | null {
  if (!w.kind) return null;
  const head = WEATHER_META[w.kind].label;
  if (w.kind === "rain" && w.rain != null && w.rain > 0) return `${head} · ${Math.round(w.rain * 10) / 10}mm`;
  if (w.kind === "heat" && w.tmax != null) return `${head} · 최고 ${deg(w.tmax)}`;
  if (w.kind === "cold" && w.tmin != null) return `${head} · 최저 ${deg(w.tmin)}`;
  return head;
}

const PTY_WORD: Record<number, string> = { 1: "비", 2: "비 또는 눈", 3: "눈", 4: "소나기" };
const SKY_WORD: Record<number, string> = { 1: "맑음", 3: "구름 많음", 4: "흐림" };

/** 예보 그림 갈래 — 화면이 아이콘을 고른다 */
export type FcLook = "rain" | "snow" | "sun" | "cloudsun" | "cloud";

export function fcLook(fc: WeatherFc): FcLook {
  if (fc.pty === 3 || fc.pty === 2 || fc.snow) return "snow";
  if (fc.pty === 1 || fc.pty === 4) return "rain";
  if (fc.sky === 1) return "sun";
  if (fc.sky === 3) return "cloudsun";
  return "cloud";
}

/** 예보 한 줄 — '비 · 강수확률 60% · 9° ~ 14°' · '맑음 · 10° ~ 19°' (강수확률은 30% 넘을 때만) */
export function forecastLine(fc: WeatherFc): string {
  const parts: string[] = [];
  const word = fc.pty > 0 ? PTY_WORD[fc.pty] : fc.snow ? "눈" : fc.sky != null ? SKY_WORD[fc.sky] : null;
  if (word) parts.push(word);
  if (fc.pop != null && fc.pop >= 30) parts.push(`강수확률 ${Math.round(fc.pop)}%`);
  if (fc.tmin != null && fc.tmax != null) parts.push(fc.tmin === fc.tmax ? deg(fc.tmin) : `${deg(fc.tmin)} ~ ${deg(fc.tmax)}`);
  else if (fc.tmax != null) parts.push(`최고 ${deg(fc.tmax)}`);
  else if (fc.tmin != null) parts.push(`최저 ${deg(fc.tmin)}`);
  return parts.join(" · ");
}

/** 보이는 날짜 중 날씨 도장이 찍힌 날 수 — 출석한 날(byDay)만 */
export function stampCount(map: ReadonlyMap<string, DayWeather> | null | undefined, days: readonly string[], attended: (d: string) => boolean): number {
  if (!map) return 0;
  return days.filter((d) => weatherStamp(map.get(d), attended(d)) != null).length;
}
