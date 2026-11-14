// 캘린더 3-5 날씨 도장 — 기상청 날씨를 지점마다 받아 둔다 (2026-11-14 대표님 「기상청 api도 비용이 안드는거면 진행하자」)
//   · 크론이 매시 45분에 부른다(x-auto-key = internal_sync_config.auto_sync_key · verify_jwt = false).
//   · 지점 · 격자 · 관측소 = app_settings.weather_sites (마이그레이션 …_calendar_weather.sql)
//   · ① 초단기실황 — 격자마다 한 번 → branch_weather_hours(지점 · 정시) ② 단기예보 — 발표 시각이 바뀌었을 때만 → branch_weather_days 의 fc_* (오늘 ~ 사흘 뒤)
//     ③ ASOS 일자료 — 관측소마다 어제까지 빈 날(처음엔 backfill_days, 기본 62일) → branch_weather_days 의 obs_* (09시 전이면 어제 자료는 기다린다)
//   · 비 · 눈 · 폭염 · 한파 판정은 DB _branch_weather_json 한 곳(화면 lib/calendarWeather 와 같은 말).
//   · 키 = Edge Function 시크릿 KMA_SERVICE_KEY(공공데이터포털 일반 인증키 — 대표님이 넣음). 응답 · 기록에 키를 남기지 않는다.
//   · body: { probe?: true (선릉 격자 실황 한 번 · DB 안 씀), dry_run?: true (받기만 · DB 안 씀), backfill_days?: 1~400 }
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  addDays,
  asosDays,
  fcstBase,
  fcstDays,
  KMA_BASE,
  kst,
  type KmaResult,
  ncstBase,
  ncstHour,
  parseKma,
  readSites,
  type Site,
  ymdOf,
} from "./logic.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BACKFILL_DAYS = 62;

async function kmaGet(path: string, params: Record<string, string | number>, key: string): Promise<KmaResult> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${KMA_BASE}/${path}?serviceKey=${encodeURIComponent(key)}&${qs.toString()}`;
  let last: KmaResult = { ok: false, code: "FETCH_FAILED", msg: "", items: [], total: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      last = parseKma(await res.text());
      // 정상 · 자료 없음(03) · 키 오류(20 · 30 · 31)는 다시 해도 같다
      if (last.ok || ["03", "20", "22", "30", "31"].includes(last.code)) return last;
    } catch (e) {
      last = { ok: false, code: "FETCH_FAILED", msg: String((e as Error)?.name ?? e).slice(0, 60), items: [], total: 0 };
    } finally {
      clearTimeout(timer);
    }
    await sleep(700);
  }
  return last;
}

/** 단기예보 — 1,000줄씩 모자라면 다음 쪽(최대 3쪽) */
async function fcstAll(site: Site, base: { base_date: string; base_time: string }, key: string): Promise<KmaResult> {
  const first = await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", { pageNo: 1, numOfRows: 1000, dataType: "JSON", ...base, nx: site.nx, ny: site.ny }, key);
  if (!first.ok) return first;
  const items = [...first.items];
  for (let page = 2; items.length < first.total && page <= 3; page++) {
    const more = await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", { pageNo: page, numOfRows: 1000, dataType: "JSON", ...base, nx: site.nx, ny: site.ny }, key);
    if (!more.ok) break;
    items.push(...more.items);
  }
  return { ...first, items };
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const provided = req.headers.get("x-auto-key") || "";
  const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
  if (!provided || !cfg?.value || provided !== cfg.value) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const probe = body?.probe === true;
  const dryRun = body?.dry_run === true;
  const bfIn = Number(body?.backfill_days ?? BACKFILL_DAYS);
  const backfill = Number.isFinite(bfIn) ? Math.min(400, Math.max(1, Math.round(bfIn))) : BACKFILL_DAYS;

  const key = (Deno.env.get("KMA_SERVICE_KEY") ?? "").trim();
  if (!key) return json({ ok: false, code: "NO_KEY", msg: "KMA_SERVICE_KEY 시크릿이 없어요" });

  const now = new Date();
  const k = kst(now);

  // 키 확인 — 선릉 격자(61, 125) 실황 한 번 (설정이 없어도 된다)
  if (probe) {
    const base = ncstBase(now);
    const r = await kmaGet("VilageFcstInfoService_2.0/getUltraSrtNcst", { pageNo: 1, numOfRows: 100, dataType: "JSON", ...base, nx: 61, ny: 125 }, key);
    const hour = r.ok ? ncstHour(r.items, base) : null;
    return json({ ok: r.ok, code: r.code, msg: r.msg, base, n: r.items.length, t1h: hour?.t1h ?? null, rn1: hour?.rn1 ?? null, pty: hour?.pty ?? null });
  }

  // 받기만 하는 시험(dry_run)은 설정 대신 body.sites 로도 — 표가 생기기 전 확인용
  const { data: setting } = dryRun && Array.isArray(body?.sites)
    ? { data: { value: { sites: body.sites } } }
    : await app.from("app_settings").select("value").eq("key", "weather_sites").maybeSingle();
  const sites = readSites(setting?.value);
  if (sites.length === 0) return json({ ok: false, code: "NO_SITES", msg: "app_settings.weather_sites 가 비었어요" });

  const errors: string[] = [];
  const grids = new Map<string, Site[]>();
  for (const s of sites) {
    const g = `${s.nx},${s.ny}`;
    grids.set(g, [...(grids.get(g) ?? []), s]);
  }

  // ① 초단기실황 — 격자마다 정시 한 번
  const nb = ncstBase(now);
  const hourRows: Record<string, unknown>[] = [];
  for (const [g, list] of grids) {
    const r = await kmaGet("VilageFcstInfoService_2.0/getUltraSrtNcst", { pageNo: 1, numOfRows: 100, dataType: "JSON", ...nb, nx: list[0].nx, ny: list[0].ny }, key);
    if (!r.ok) {
      errors.push(`ncst ${g} ${r.code} ${r.msg}`);
      continue;
    }
    const h = ncstHour(r.items, nb);
    if (!h) continue;
    for (const s of list) hourRows.push({ branch_name: s.branch, ...h, fetched_at: now.toISOString() });
  }
  if (!dryRun && hourRows.length) {
    const { error } = await app.from("branch_weather_hours").upsert(hourRows, { onConflict: "branch_name,obs_at" });
    if (error) errors.push(`hours upsert ${error.message}`);
  }

  // ② 단기예보 — 발표 시각이 바뀐 격자만
  const fb = fcstBase(now);
  const fbTag = `${fb.base_date}${fb.base_time}`;
  const fcRows: Record<string, unknown>[] = [];
  let fcFetched = 0;
  for (const [g, list] of grids) {
    const { data: had } = await app
      .from("branch_weather_days")
      .select("fc_base")
      .eq("branch_name", list[0].branch)
      .eq("day", k.day)
      .maybeSingle();
    if (had?.fc_base === fbTag && !dryRun) continue;
    const r = await fcstAll(list[0], fb, key);
    fcFetched++;
    if (!r.ok) {
      errors.push(`fcst ${g} ${r.code} ${r.msg}`);
      continue;
    }
    for (const d of fcstDays(r.items)) {
      // 지난 날은 버리고, 앞날은 하루치(12시간 넘게)가 있는 날만 — 예보 끝 날은 몇 시간뿐이다
      if (d.day < k.day || (d.day > k.day && d.hours < 12)) continue;
      for (const s of list) {
        fcRows.push({
          branch_name: s.branch,
          day: d.day,
          fc_tmin: d.tmin,
          fc_tmax: d.tmax,
          fc_pop: d.pop,
          fc_pty: d.pty,
          fc_sky: d.sky,
          fc_snow: d.snow,
          fc_base: fbTag,
          fc_at: now.toISOString(),
        });
      }
    }
  }
  if (!dryRun && fcRows.length) {
    const { error } = await app.from("branch_weather_days").upsert(fcRows, { onConflict: "branch_name,day" });
    if (error) errors.push(`fcst upsert ${error.message}`);
  }

  // ③ ASOS 일자료 — 관측소마다 어제까지 빈 날
  const yesterday = addDays(k.day, -1);
  const stations = new Map<number, Site[]>();
  for (const s of sites) stations.set(s.stn, [...(stations.get(s.stn) ?? []), s]);
  const obsRows: Record<string, unknown>[] = [];
  const asos: Record<string, unknown>[] = [];
  for (const [stn, list] of stations) {
    const { data: last } = await app
      .from("branch_weather_days")
      .select("day")
      .in("branch_name", list.map((s) => s.branch))
      .eq("obs_stn", stn)
      .not("obs_at", "is", null)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    const floor = addDays(k.day, -backfill);
    const start = last?.day && last.day >= floor ? addDays(last.day, 1) : floor;
    // 어제 자료는 아침(09시)부터 묻는다 — 그 전에는 그제까지만
    const end = k.hh >= 9 ? yesterday : addDays(yesterday, -1);
    if (start > end) {
      asos.push({ stn, skip: "up_to_date" });
      continue;
    }
    const r = await kmaGet(
      "AsosDalyInfoService/getWthrDataList",
      { pageNo: 1, numOfRows: 999, dataType: "JSON", dataCd: "ASOS", dateCd: "DAY", startDt: ymdOf(start), endDt: ymdOf(end), stnIds: stn },
      key,
    );
    if (!r.ok) {
      // 어제 자료가 아직이면 03(자료 없음) — 다음 시간에 다시
      if (r.code !== "03") errors.push(`asos ${stn} ${r.code} ${r.msg}`);
      asos.push({ stn, start, end, code: r.code });
      continue;
    }
    const days = asosDays(r.items);
    asos.push({ stn, start, end, days: days.length });
    for (const d of days) {
      for (const s of list) {
        obsRows.push({
          branch_name: s.branch,
          day: d.day,
          obs_stn: stn,
          obs_tmin: d.tmin,
          obs_tmax: d.tmax,
          obs_rain: d.rain,
          obs_snow: d.snow,
          obs_snow_day: d.snowDay,
          obs_at: now.toISOString(),
        });
      }
    }
  }
  if (!dryRun && obsRows.length) {
    for (let i = 0; i < obsRows.length; i += 500) {
      const { error } = await app.from("branch_weather_days").upsert(obsRows.slice(i, i + 500), { onConflict: "branch_name,day" });
      if (error) {
        errors.push(`obs upsert ${error.message}`);
        break;
      }
    }
  }

  return json({
    ok: errors.length === 0,
    dryRun,
    at: `${k.day} ${String(k.hh).padStart(2, "0")}:${String(k.mm).padStart(2, "0")}`,
    sites: sites.length,
    ncst: { base: nb, rows: hourRows.length },
    fcst: { base: fbTag, fetched: fcFetched, rows: fcRows.length },
    asos,
    obs: obsRows.length,
    errors,
    // 받기만 하는 시험이면 모양을 볼 수 있게 몇 줄
    ...(dryRun ? { sample: { hour: hourRows.slice(0, 2), fcst: fcRows.slice(0, 5), obs: obsRows.slice(-3) } } : {}),
  });
});
