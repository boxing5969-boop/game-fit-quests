// 캘린더 3-5 날씨 도장 — 기상청 응답을 읽어 표에 넣을 모양으로 바꾸는 순수 함수 (Deno · vitest 같이 쓴다 — 시험 src/lib/kmaWeather.test.ts)
//   · 초단기실황(getUltraSrtNcst) — 지점 격자의 정시 관측: T1H 기온 · RN1 1시간 강수량 · PTY 강수 형태 · REH 습도 · WSD 풍속
//   · 단기예보(getVilageFcst) — 지점 격자의 오늘 ~ 사흘 뒤: TMP · TMN · TMX · POP · PTY · SKY · SNO
//   · 지상(종관, ASOS) 일자료(getWthrDataList) — 가까운 관측소의 하루: minTa · maxTa · sumRn · ddMefs · iscs (전일 D-1 까지)
//   · 격자 = 기상청 람베르트 정각원추도법(5km) — latLonToGrid. 관측소 = 서울 108 · 충주 127 (설정 app_settings.weather_sites)
// 시각은 모두 한국 시간(KST, UTC+9 — 서머타임 없음)으로 계산한다.

export const KMA_BASE = "https://apis.data.go.kr/1360000";

export type Site = { branch: string; nx: number; ny: number; stn: number };
export type KmaItem = Record<string, unknown>;
export type KmaResult = { ok: boolean; code: string; msg: string; items: KmaItem[]; total: number };

const KST_MS = 9 * 3600_000;
const p2 = (n: number) => String(n).padStart(2, "0");

/** 한국 시간의 날짜 · 시 · 분 */
export function kst(now: Date): { ymd: string; day: string; hh: number; mm: number } {
  const t = new Date(now.getTime() + KST_MS);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + 1;
  const d = t.getUTCDate();
  return { ymd: `${y}${p2(m)}${p2(d)}`, day: `${y}-${p2(m)}-${p2(d)}`, hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}

/** 'YYYY-MM-DD' 에 n일 */
export function addDays(day: string, n: number): string {
  const t = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) + n * 864e5;
  return new Date(t).toISOString().slice(0, 10);
}
export const ymdOf = (day: string) => day.replace(/-/g, "");
export const dayOf = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

/** 기상청 발표 날짜(YYYYMMDD) · 시각(HHMM, 한국 시간) → UTC ISO */
export function kstIso(ymd: string, hhmm: string): string {
  const ms = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)), Number(hhmm.slice(0, 2)), Number(hhmm.slice(2, 4)));
  return new Date(ms - KST_MS).toISOString();
}

/** 초단기실황 발표 시각 — 정시 자료 · 45분 여유(그 전이면 한 시간 앞 자료) */
export function ncstBase(now: Date): { base_date: string; base_time: string } {
  const k = kst(new Date(now.getTime() - 45 * 60_000));
  return { base_date: k.ymd, base_time: `${p2(k.hh)}00` };
}

const FCST_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];

/** 단기예보 발표 시각 — 02 · 05 · 08 · 11 · 14 · 17 · 20 · 23시 · 15분 여유 (02:15 전이면 전날 23시) */
export function fcstBase(now: Date): { base_date: string; base_time: string } {
  const k = kst(new Date(now.getTime() - 15 * 60_000));
  const h = [...FCST_HOURS].reverse().find((x) => x <= k.hh);
  if (h === undefined) return { base_date: ymdOf(addDays(k.day, -1)), base_time: "2300" };
  return { base_date: k.ymd, base_time: `${p2(h)}00` };
}

/** 기상청 응답 글 → 결과 (JSON 이 아니면 공공데이터포털 XML 오류 글에서 까닭만) — 키는 돌려주지 않는다 */
export function parseKma(text: string): KmaResult {
  // deno-lint-ignore no-explicit-any
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = null;
  }
  const header = j?.response?.header;
  if (header) {
    const code = String(header.resultCode ?? "");
    const msg = String(header.resultMsg ?? "");
    const raw = j?.response?.body?.items?.item;
    const items: KmaItem[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
    const total = Number(j?.response?.body?.totalCount ?? items.length);
    return { ok: code === "00", code, msg, items, total: Number.isFinite(total) ? total : items.length };
  }
  const pick = (tag: string) => new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(text)?.[1]?.trim() || null;
  const code = pick("returnReasonCode") ?? pick("resultCode") ?? "BAD_RESPONSE";
  const msg = pick("returnAuthMsg") ?? pick("resultMsg") ?? pick("errMsg") ?? text.replace(/\s+/g, " ").trim().slice(0, 80);
  return { ok: false, code, msg, items: [], total: 0 };
}

/** 숫자 칸 — 빈 칸 · 결측(-900 아래 · 900 이상)은 null */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= -900 || n >= 900) return null;
  return n;
}

const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

/** 강수량 글('강수없음' · '1mm 미만' · '1.5' · '30.0~50.0mm' · '50.0mm 이상') → mm (모르면 null) */
export function rainMm(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s === "강수없음") return 0;
  if (s.includes("미만")) return 0.5;
  const m = /-?\d+(?:\.\d+)?/.exec(s);
  if (!m) return null;
  return num(m[0]);
}

export type HourRow = { obs_at: string; t1h: number | null; rn1: number | null; pty: number | null; reh: number | null; wsd: number | null };

/** 초단기실황 한 번(정시) → 시간 한 줄 */
export function ncstHour(items: readonly KmaItem[], base: { base_date: string; base_time: string }): HourRow | null {
  const by = new Map<string, unknown>();
  for (const it of items) by.set(String(it.category ?? ""), it.obsrValue);
  if (!by.has("T1H") && !by.has("PTY") && !by.has("RN1")) return null;
  const rn1 = rainMm(by.get("RN1"));
  return {
    obs_at: kstIso(base.base_date, base.base_time),
    t1h: num(by.get("T1H")),
    rn1: rn1 === null ? null : Math.max(0, rn1),
    pty: int(by.get("PTY")),
    reh: int(by.get("REH")),
    wsd: num(by.get("WSD")),
  };
}

export type FcDay = {
  day: string;
  tmin: number | null;
  tmax: number | null;
  pop: number | null;
  /** 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기 (하루 중 가장 큰 것 — 눈 > 비/눈 > 비 > 소나기) */
  pty: number;
  /** 1 맑음 · 3 구름많음 · 4 흐림 (낮 9 ~ 18시에 가장 많은 것) */
  sky: number | null;
  snow: boolean;
  /** 그날 시간별 기온(TMP)이 몇 시간치 있나 — 마지막 날은 몇 시간뿐이라 걸러 낸다 */
  hours: number;
};

const PTY_RANK: Record<number, number> = { 3: 4, 2: 3, 1: 2, 4: 1, 0: 0 };

/** 단기예보 → 날마다 한 줄 (TMN · TMX 가 있으면 그 값, 없으면 그날 TMP 의 최저 · 최고) */
export function fcstDays(items: readonly KmaItem[]): FcDay[] {
  type Acc = { tmp: number[]; tmn: number | null; tmx: number | null; pop: number[]; pty: number[]; skyDay: number[]; skyAll: number[]; snow: boolean };
  const days = new Map<string, Acc>();
  for (const it of items) {
    const date = String(it.fcstDate ?? "");
    const time = String(it.fcstTime ?? "");
    if (!/^\d{8}$/.test(date)) continue;
    const day = dayOf(date);
    const hour = Number(time.slice(0, 2));
    let a = days.get(day);
    if (!a) {
      a = { tmp: [], tmn: null, tmx: null, pop: [], pty: [], skyDay: [], skyAll: [], snow: false };
      days.set(day, a);
    }
    const v = it.fcstValue;
    switch (String(it.category ?? "")) {
      case "TMP": {
        const n = num(v);
        if (n !== null) a.tmp.push(n);
        break;
      }
      case "TMN":
        a.tmn = num(v) ?? a.tmn;
        break;
      case "TMX":
        a.tmx = num(v) ?? a.tmx;
        break;
      case "POP": {
        const n = int(v);
        if (n !== null) a.pop.push(n);
        break;
      }
      case "PTY": {
        const n = int(v);
        if (n !== null) a.pty.push(n);
        break;
      }
      case "SKY": {
        const n = int(v);
        if (n !== null) {
          a.skyAll.push(n);
          if (hour >= 9 && hour <= 18) a.skyDay.push(n);
        }
        break;
      }
      case "SNO": {
        const s = String(v ?? "").trim();
        if (s && s !== "적설없음" && !/^0(\.0)?(cm)?$/.test(s)) a.snow = true;
        break;
      }
    }
  }
  const mode = (xs: number[]) => {
    if (xs.length === 0) return null;
    const c = new Map<number, number>();
    for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
    // 같은 수면 더 흐린 쪽
    return [...c.entries()].sort((p, q) => q[1] - p[1] || q[0] - p[0])[0][0];
  };
  return [...days.entries()]
    .sort((p, q) => (p[0] < q[0] ? -1 : 1))
    .map(([day, a]) => ({
      day,
      tmin: a.tmn ?? (a.tmp.length ? Math.min(...a.tmp) : null),
      tmax: a.tmx ?? (a.tmp.length ? Math.max(...a.tmp) : null),
      pop: a.pop.length ? Math.max(...a.pop) : null,
      pty: a.pty.reduce((best, x) => ((PTY_RANK[x] ?? 0) > (PTY_RANK[best] ?? 0) ? x : best), 0),
      sky: mode(a.skyDay) ?? mode(a.skyAll),
      snow: a.snow || a.pty.includes(3),
      hours: a.tmp.length,
    }));
}

export type ObsDay = { day: string; tmin: number | null; tmax: number | null; rain: number; snow: number | null; snowDay: boolean };

/** 일기현상(iscs)에 눈 갈래가 있나 — {눈} · {진눈깨비} · {싸락눈} · {가루눈} · {소낙눈} · {눈보라} · {눈날림} … */
const SNOW_RE = /\{(?:소낙성)?(?:눈|진눈깨비|싸락눈|가루눈|소낙눈)/;

/** ASOS 일자료 → 날마다 한 줄 (일강수량 빈 칸 = 비 없음 0) */
export function asosDays(items: readonly KmaItem[]): ObsDay[] {
  const out: ObsDay[] = [];
  for (const it of items) {
    const day = String(it.tm ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const snow = num(it.ddMefs);
    out.push({
      day,
      tmin: num(it.minTa),
      tmax: num(it.maxTa),
      rain: Math.max(0, num(it.sumRn) ?? 0),
      snow,
      snowDay: (snow ?? 0) > 0 || SNOW_RE.test(String(it.iscs ?? "")),
    });
  }
  return out.sort((p, q) => (p.day < q.day ? -1 : 1));
}

/** 위도 · 경도 → 기상청 동네예보 격자(nx, ny) — 기상청 격자 변환식(LCC, 5km) */
export function latLonToGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180;
  const re = RE / GRID, s1 = SLAT1 * D, s2 = SLAT2 * D, ol = OLON * D, oa = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5);
  sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + s1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(s1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + oa * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let th = lon * D - ol;
  if (th > Math.PI) th -= 2 * Math.PI;
  if (th < -Math.PI) th += 2 * Math.PI;
  th *= sn;
  return { nx: Math.floor(ra * Math.sin(th) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(th) + YO + 0.5) };
}

/** 설정(app_settings.weather_sites.sites)을 믿지 않고 다듬는다 — 지점 이름 · 격자(1~149 · 1~253) · 관측소 번호 */
export function readSites(v: unknown): Site[] {
  // deno-lint-ignore no-explicit-any
  const list: any[] = Array.isArray((v as any)?.sites) ? (v as any).sites : [];
  const out: Site[] = [];
  for (const s of list) {
    const branch = typeof s?.branch === "string" ? s.branch.trim() : "";
    const nx = Number(s?.nx), ny = Number(s?.ny), stn = Number(s?.stn);
    if (!branch || !Number.isInteger(nx) || !Number.isInteger(ny) || !Number.isInteger(stn)) continue;
    if (nx < 1 || nx > 149 || ny < 1 || ny > 253 || stn < 90 || stn > 999) continue;
    if (out.some((o) => o.branch === branch)) continue;
    out.push({ branch, nx, ny, stn });
  }
  return out;
}
