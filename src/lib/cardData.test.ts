import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DATA_LINK,
  FILM_PICK,
  POPULAR_OVER,
  RATE_MIN,
  completeRate,
  demoPopular,
  demoStats,
  detailRows,
  filmListText,
  filmPlan,
  hardRate,
  leagueLine,
  metricText,
  parseStats,
  periodLabel,
  rankBy,
  statParts,
  totalsLeagueLine,
  type FilmTarget,
  type ItemStat,
} from "./cardData";

const SQL = readFileSync("supabase/migrations/20261115110446_training_card_data.sql", "utf8");
const PURGE = readFileSync("supabase/migrations/20261115110555_training_card_purge.sql", "utf8");

const C1 = "c:11111111-1111-4111-8111-111111111111";
const C2 = "c:22222222-2222-4222-8222-222222222222";
const C3 = "c:33333333-3333-4333-8333-333333333333";
const M1 = "m:44444444-4444-4444-8444-444444444444";

const stat = (item: string, extra: Partial<ItemStat> = {}): ItemStat => ({
  item,
  viewers: 0,
  opens: 0,
  players: 0,
  completers: 0,
  replayers: 0,
  savers: 0,
  hearts: 0,
  easy: 0,
  ok: 0,
  hard: 0,
  opinions: 0,
  waiting: 0,
  film: 0,
  leagues: {},
  ...extra,
});

describe("영상으로 배우기 4단계 — 데이터 읽기", () => {
  it("서버 값을 믿지 않고 다듬는다 — 틀린 열쇠 · 음수 · 모르는 리그 · 검색어 아닌 요청은 버린다", () => {
    const empty = parseStats(null);
    expect(empty.days).toBe(28);
    expect(empty.list).toEqual([]);
    expect(empty.totals.members).toBe(0);
    const s = parseStats({
      days: 7,
      since: "2026-11-09",
      branch: " ",
      branches: ["153복싱짐 선릉역점", 3, ""],
      totals: { members: 4, savers: -2, leagues: { white: 3, gold: 9, blue: 0 } },
      items: [
        { item: C1, viewers: 3, savers: "2", hard: -1, leagues: { white: { s: 1, h: 2 }, purple: { s: 9 }, blue: { s: 0 } } },
        { item: C1, viewers: 99 },
        { item: "x:nope", viewers: 5 },
        { item: "shelf", viewers: 5 },
      ],
      wishes: [{ key: "q:어퍼컷", query: " 어퍼 컷 ", miss: 2, users: 2 }, { key: "c:abc", query: "카드" }, { key: "q:스웨이" }],
    });
    expect(s.days).toBe(7);
    expect(s.branch).toBeNull();
    expect(s.branches).toEqual(["153복싱짐 선릉역점"]);
    expect(s.totals).toMatchObject({ members: 4, savers: 0, leagues: { white: 3 } });
    expect(s.list).toHaveLength(1);
    expect(s.items.get(C1)).toMatchObject({ viewers: 3, savers: 2, hard: 0, leagues: { white: { s: 1, e: 0, o: 0, h: 2 } } });
    expect(s.wishes).toEqual([
      { key: "q:어퍼컷", query: "어퍼 컷", miss: 2, film: 0, users: 2, lastAt: "" },
      { key: "q:스웨이", query: "스웨이", miss: 0, film: 0, users: 0, lastAt: "" },
    ]);
    expect(periodLabel(28)).toBe("지난 4주");
    expect(periodLabel(14)).toBe("지난 14일");
  });

  it("비율은 3명 이상 모였을 때만 — 끝까지 · 어려워요", () => {
    expect(RATE_MIN).toBe(3);
    expect(completeRate(stat(C1, { players: 2, completers: 2 }))).toBeNull();
    expect(completeRate(stat(C1, { players: 4, completers: 3 }))).toBe(75);
    expect(completeRate(stat(C1, { players: 3, completers: 9 }))).toBe(100);
    expect(hardRate({ easy: 1, ok: 0, hard: 1 })).toBeNull();
    expect(hardRate({ easy: 1, ok: 0, hard: 2 })).toBe(67);
    expect(metricText(stat(C1, { easy: 1, hard: 2 }), "hard")).toBe("67%");
    expect(metricText(stat(C1, { players: 1 }), "complete")).toBe("—");
    expect(metricText(stat(C1, { opinions: 2 }), "opinions")).toBe("2개");
    expect(metricText(stat(C1, { savers: 2 }), "savers")).toBe("2명");
  });

  it("줄 세우기 — 값이 있는 카드만 큰 순 (같으면 본 회원 · 어려워요는 어려워요 수)", () => {
    const list = [
      stat(C1, { viewers: 5, savers: 1, easy: 2, hard: 1 }),
      stat(C2, { viewers: 9, savers: 1, hard: 3 }),
      stat(C3, { viewers: 2, savers: 4, easy: 1, hard: 2 }),
      stat(M1, { viewers: 9, savers: 0 }),
    ];
    expect(rankBy(list, "viewers").map((s) => s.item)).toEqual([C2, M1, C1, C3]);
    expect(rankBy(list, "savers").map((s) => s.item)).toEqual([C3, C2, C1]);
    expect(rankBy(list, "hard").map((s) => s.item)).toEqual([C2, C3, C1]); // 100% · 67% · 33%
    expect(rankBy(list, "film")).toEqual([]);
    expect(rankBy(list, "viewers", 2)).toHaveLength(2);
  });

  it("카드 숫자 한 줄 · 카드 창 줄 · 리그별 — 0 은 그리지 않는다", () => {
    expect(statParts(null)).toEqual([]);
    expect(statParts(stat(C1))).toEqual([]);
    expect(statParts(stat(C1, { viewers: 12, savers: 3, hearts: 2, easy: 1, ok: 1, hard: 2 }))).toEqual(["본 12", "담기 3", "♥ 2", "어려워요 50%"]);
    expect(statParts(stat(C1, { viewers: 1, hard: 1, opinions: 2 }))).toEqual(["본 1", "의견 2"]); // 어려워요 1명은 비율 없이
    expect(detailRows(stat(C1))).toEqual([]);
    const rows = detailRows(stat(C1, { viewers: 4, opens: 7, players: 3, completers: 2, savers: 1, easy: 1, ok: 1, hard: 1, opinions: 2, waiting: 1, film: 3 }));
    expect(rows.map((r) => r.label)).toEqual(["본 회원", "끝까지 본 회원", "담은 회원", "쉬워요 · 딱 좋아요 · 어려워요", "의견", "영상 찍어 주세요"]);
    expect(rows[0].value).toBe("4명 · 7번 열기");
    expect(rows[1].value).toBe("2명 / 영상 본 3명 · 67%");
    expect(rows[3].value).toBe("1 · 1 · 1 (어려워요 33%)");
    expect(rows[4].value).toBe("2개 · 답 기다려요 1");
    const lg = stat(C1, { leagues: { blue: { s: 1, e: 0, o: 1, h: 1 }, white: { s: 3, e: 1, o: 0, h: 1 } } });
    expect(leagueLine(lg, "savers")).toBe("화이트 3 · 블루 1");
    expect(leagueLine(lg, "hard")).toBe("화이트 1/2 · 블루 1/2");
    expect(leagueLine(stat(C1), "savers")).toBeNull();
    expect(totalsLeagueLine(parseStats({ totals: { leagues: { blue: 2, white: 9 } } }).totals)).toBe("화이트 9 · 블루 2");
  });
});

describe("다음 촬영 목록", () => {
  const targets = new Map<string, FilmTarget>([
    [C1, { key: C1, name: "사다리 스텝", hasVideo: false }],
    [C2, { key: C2, name: "원투", hasVideo: true }],
    [C3, { key: C3, name: "어퍼컷 연결", hasVideo: false }],
  ]);
  const matchQuery = (q: string) => (q.includes("원투") ? targets.get(C2)! : q.includes("어퍼") ? targets.get(C3)! : null);

  it("영상 없는 카드 + 없는 검색어 — 영상 있는 카드 · 레벨 미션은 빼고, 맞는 카드로 합친다 · 맨 위 5개 추천", () => {
    const s = parseStats({
      items: [
        { item: C1, viewers: 4, film: 2, easy: 1, hard: 2 }, // 6 + 4 + 4 = 14
        { item: C2, viewers: 20, film: 5 }, // 영상 있음 → 빠짐
        { item: M1, viewers: 9, film: 1 }, // 레벨 미션 → 빠짐
      ],
      wishes: [
        { key: "q:원투", query: "원투", film: 3, miss: 1, users: 3 }, // 영상 있는 카드 → 빠짐
        { key: "q:어퍼컷", query: "어퍼컷", film: 1, miss: 2, users: 2 }, // 어퍼컷 연결로 합침 7
        { key: "q:스웨이", query: "스웨이", film: 0, miss: 3, users: 3 }, // 찾은 말 6
        { key: "q:빈", query: "빈", film: 0, miss: 0, users: 0 }, // 점수 0 → 빠짐
      ],
    });
    const plan = filmPlan(s, { targets, matchQuery });
    expect(plan.map((c) => [c.name, c.kind, c.score])).toEqual([
      ["사다리 스텝", "card", 14],
      ["어퍼컷 연결", "card", 7],
      ["스웨이", "query", 6],
    ]);
    expect(plan[0].reasons).toEqual(["영상 요청 2명", "본 회원 4명", "어려워요 67%"]);
    expect(plan[1].reasons).toEqual(["찾기 ‘어퍼컷’ 2명"]);
    expect(plan[1].key).toBe(C3);
    expect(plan[2].key).toBeNull();
    expect(plan[2].reasons).toEqual(["찾았는데 없음 3명"]);
    expect(plan.every((c) => c.recommended)).toBe(true);
    const text = filmListText(plan, "지난 4주", null);
    expect(text.split("\n")[0]).toBe("153 다음 촬영 목록 · 지난 4주 · 회원 기준");
    expect(text).toContain("1. 사다리 스텝 ★ — 영상 요청 2명 · 본 회원 4명 · 어려워요 67%");
    expect(text).toContain("3. 스웨이 (찾은 말) ★ — 찾았는데 없음 3명");
    expect(filmListText([], "지난 4주", null)).toBe("");
  });

  it(`추천은 맨 위 ${FILM_PICK}개까지`, () => {
    const wishes = Array.from({ length: 8 }, (_, i) => ({ key: `q:동작${i}`, query: `동작${i}`, miss: 8 - i, users: 8 - i }));
    const plan = filmPlan(parseStats({ wishes }), { targets, matchQuery: () => null });
    expect(plan).toHaveLength(8);
    expect(plan.filter((c) => c.recommended).map((c) => c.name)).toEqual(["동작0", "동작1", "동작2", "동작3", "동작4"]);
  });

  it("예시 숫자는 늘 같고 「예시」 표시", () => {
    const keys = [C1, C2, C3, M1];
    expect(demoStats(28, null, keys)).toEqual(demoStats(28, null, keys));
    expect(demoStats(28, null, keys).demo).toBe(true);
    expect([...demoPopular(keys)].every((k) => k.startsWith("c:"))).toBe(true);
  });
});

describe("서버(마이그레이션)와 같은 기준", () => {
  it("「많이 담은 동작」은 담은 회원이 5명을 넘을 때 · 숫자 없이 열쇠만", () => {
    expect(POPULAR_OVER).toBe(5);
    expect(SQL).toContain("having count(*) > 5");
    expect(SQL).toMatch(/training_card_popular\(\)[\s\S]*jsonb_agg\(x\.item/);
  });

  it("대표님 · 운영진만 · 회원 줄만 · 이름 없이", () => {
    expect(SQL).toContain("if not public._training_shelf_can_edit(auth.uid()) then");
    expect(SQL).toContain("'데이터는 대표님 · 운영진만 볼 수 있어요'");
    for (const t of ["e.member", "s.member", "x.member", "o.member", "a.member"]) expect(SQL).toContain(t);
    expect(SQL).not.toMatch(/'user_id',/);
  });

  it("월요일 요약 — 08:17 KST · 데이터 창 링크 · 어려워요 많은 = 3명 중 2명 이상", () => {
    expect(SQL).toContain("select cron.schedule('training-card-weekly', '17 23 * * 0', $$select public._training_card_weekly()$$);");
    expect(SQL).toContain(`'${DATA_LINK}'`);
    expect(SQL).toContain("(x->>'hard')::integer >= 2 and (x->>'easy')::integer + (x->>'ok')::integer + (x->>'hard')::integer >= 3");
    expect(SQL).toContain("'📊 지난주 영상으로 배우기'");
    expect(SQL).toContain("on conflict (week) do nothing");
  });

  it("1년 지우기 — 이용 기록 · 담기 · 찾기 · 요청만 (반응 · 의견 · 내 수업은 그대로) · 매일 03:41 KST", () => {
    expect(PURGE).toContain("(now() at time zone 'Asia/Seoul')::date - 365");
    expect(PURGE).toContain("now() - interval '365 days'");
    expect(PURGE).toContain("delete from public.training_card_events where day < v_cut;");
    expect(PURGE).toContain("delete from public.training_card_saves where last_at < v_ts;");
    expect(PURGE).toContain("delete from public.training_card_asks where last_at < v_ts;");
    expect(PURGE).not.toMatch(/delete from public\.training_card_(reactions|opinions)|delete from public\.training_my_classes/);
    expect(PURGE).toContain("select cron.schedule('training-card-purge', '41 18 * * *', $$select public._training_card_purge()$$);");
    // 데이터 화면 파일에는 지우는 문장이 없다(승인 창 없이 들어가게)
    expect(SQL).not.toMatch(/\bdelete\s+from\b/i);
  });
});
