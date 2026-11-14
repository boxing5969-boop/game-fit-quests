/**
 * 💬 영상으로 배우기 3단계 — 반응 · 의견 · 찾았는데 없는 동작 · 영상 찍어 주세요 (2026-11-15 대표님 「3단계시작」)
 *
 *   · useCardSocial — 카드 한 장: 내 ♥ · 내 쉬워요/어려워요 · 영상 요청했나 · 내 의견과 답 · ♥ 숫자(5명 넘을 때만)
 *                     코치진이면 + 회원 숫자 전부 · 그 지점(대표님은 모든 지점) 회원님 의견. 열쇠 ["card-react","social",항목]
 *   · useCardReactActions — ♥ · 쉬워요/어려워요(누르는 즉시 화면) · 의견 보내기 · 답 · 읽음 · 지우기 · 영상 찍어 주세요
 *   · useCardOpinions — 코치진: 회원님 의견 목록(지난 60일 · 답 기다리는 것 먼저)
 *   · logSearchMiss — 찾기 결과가 0일 때 한 번(이 창에서 같은 검색어는 한 번만 · 보이지 않게)
 *   · 서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) available:false — 화면은 반응 칸을 그리지 않는다
 *   · 예시 모드(?demo=1): 서버를 부르지 않고 이 창(sessionStorage)에만 — 숫자 · 이름은 예시
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  HEART_SHOW_OVER,
  applyReact,
  askKey,
  cleanQuery,
  parseOpinionList,
  parseSocial,
  type CardSocial,
  type Feel,
  type OpinionList,
} from "@/lib/cardReact";
import { isTrainingDemo } from "@/services/trainingCardService";

export const CARD_REACT_KEY = ["card-react"] as const;

export interface CardSocialState {
  /** 서버에 반응 함수가 있나 (예시 모드면 true) */
  available: boolean;
  demo: boolean;
  social: CardSocial | null;
}

export interface OpinionListState {
  available: boolean;
  demo: boolean;
  list: OpinionList;
}

type RpcError = { code?: string; message?: string } | null;
const missingFn = (error: RpcError) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);

const mode = () => (isTrainingDemo() ? "demo" : "db");
export const cardSocialKey = (item: string | null) => [...CARD_REACT_KEY, "social", item ?? "", mode()] as const;
const opinionsKey = (branch: string | null | undefined) => [...CARD_REACT_KEY, "opinions", branch ?? "", mode()] as const;

let socialOff = false;
let asksOff = false;

/* ───────── 예시 모드 (이 창에만) ───────── */

const DEMO_KEY = "153react:demo";
interface DemoOpinion {
  id: string;
  body: string;
  at: string;
  reply?: { body: string; at: string } | null;
}
interface DemoItem {
  heart?: boolean;
  feel?: Feel | null;
  asked?: boolean;
  opinions?: DemoOpinion[];
  /** 코치님 화면 예시 — 예시 회원 의견에 단 답 */
  replies?: Record<string, string>;
}
type DemoStore = Record<string, DemoItem>;

function readDemo(): DemoStore {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(DEMO_KEY) ?? "{}");
    return r && typeof r === "object" && !Array.isArray(r) ? (r as DemoStore) : {};
  } catch {
    return {};
  }
}
function writeDemo(s: DemoStore) {
  try {
    window.sessionStorage.setItem(DEMO_KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}
function patchDemo(item: string, f: (d: DemoItem) => DemoItem) {
  const s = readDemo();
  s[item] = f(s[item] ?? {});
  writeDemo(s);
}

const hash = (key: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
};
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;

/** 예시 — 보낸 지 10초가 지나면 예시 코치님 답이 붙는다(답이 오는 모습을 눌러 보려고) */
const DEMO_REPLY = "좋은 질문이에요 — 다음 수업 때 거울 앞에서 같이 볼게요";
const DEMO_SAMPLE_OPINIONS = [
  { id: "d1000000-0000-4000-8000-0000000000a1", owner: "예시 회원 A", body: "발 순서가 헷갈려요. 천천히 하는 영상도 있으면 좋겠어요" },
  { id: "d1000000-0000-4000-8000-0000000000a2", owner: "예시 회원 B", body: "이 동작 할 때 어깨가 아파요 — 자세를 봐 주세요" },
];

function demoSocial(item: string, staff: boolean): CardSocial {
  const d = readDemo()[item] ?? {};
  const now = Date.now();
  const heartsBase = 4 + hash(item, 9); // 예시 숫자
  const mine = (d.opinions ?? []).map((o) => {
    const replied = o.reply ?? (now - Date.parse(o.at) > 10_000 ? { body: DEMO_REPLY, at: new Date(Date.parse(o.at) + 10_000).toISOString() } : null);
    return { id: o.id, item, body: o.body, at: o.at, reply: replied ? { ...replied, by: { name: "예시 코치", title: "코치" }, mine: false } : null, seen: false };
  });
  const replies = d.replies ?? {};
  return parseSocial({
    viewer: staff ? "staff" : "member",
    me: { heart: !!d.heart, feel: d.feel ?? null, asked: !!d.asked },
    hearts: heartsBase + (d.heart ? 1 : 0),
    opinions: staff ? [] : mine,
    staff: staff
      ? {
          counts: { hearts: heartsBase, easy: hash(`${item}e`, 4), ok: 2 + hash(`${item}o`, 5), hard: hash(`${item}h`, 6), asks: hash(`${item}a`, 3), opinions: 2 },
          opinions: DEMO_SAMPLE_OPINIONS.map((o, i) => ({
            id: o.id,
            item,
            body: o.body,
            at: new Date(now - (i + 1) * 3600_000).toISOString(),
            reply: replies[o.id] ? { body: replies[o.id], at: new Date(now).toISOString(), by: { name: "예시 코치", title: "코치" }, mine: true } : null,
            seen: true,
            branch: "예시 지점",
            item_name: "이 카드",
            owner: { user_id: `demo-${i}`, name: o.owner, avatar_url: null },
            can_reply: true,
          })),
        }
      : null,
  });
}

function demoOpinionList(): OpinionList {
  const now = Date.now();
  const s = readDemo();
  const replies = Object.values(s).reduce<Record<string, string>>((acc, d) => ({ ...acc, ...(d.replies ?? {}) }), {});
  const rows = [
    ...DEMO_SAMPLE_OPINIONS.map((o, i) => ({ ...o, item: "c:demo", itemName: i === 0 ? "사다리 스텝" : "아령 쉐도우" })),
    { id: "d1000000-0000-4000-8000-0000000000a3", owner: "예시 회원 C", body: "원투 다음에 바로 훅을 치면 균형이 무너져요", item: "c:demo", itemName: "원투 → 리드 피벗" },
  ];
  const opinions = rows.map((o, i) => ({
    id: o.id,
    item: o.item,
    body: o.body,
    at: new Date(now - (i + 1) * 5400_000).toISOString(),
    reply: replies[o.id] ? { body: replies[o.id], at: new Date(now).toISOString(), by: { name: "예시 코치", title: "코치" }, mine: true } : null,
    seen: true,
    branch: "예시 지점",
    item_name: o.itemName,
    owner: { user_id: `demo-${i}`, name: o.owner, avatar_url: null },
    can_reply: true,
  }));
  return parseOpinionList({ branch: "예시 지점", waiting: opinions.filter((o) => !o.reply).length, opinions });
}

/* ───────── 카드 한 장 ───────── */

export function useCardSocial(item: string | null, enabled: boolean, staffHint = false) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: cardSocialKey(item),
    enabled: enabled && !!item,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<CardSocialState> => {
      if (!item) return { available: false, demo, social: null };
      if (demo) return { available: true, demo: true, social: demoSocial(item, staffHint) };
      if (socialOff) return { available: false, demo: false, social: null };
      const { data, error } = await rpc("training_card_social", { p_item: item });
      if (error) {
        if (missingFn(error)) {
          socialOff = true;
          return { available: false, demo: false, social: null };
        }
        throw new Error(error.message ?? "반응을 불러오지 못했어요");
      }
      return { available: true, demo: false, social: parseSocial(data) };
    },
  });
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
};

export function useCardReactActions() {
  const qc = useQueryClient();
  const patch = (item: string, f: (s: CardSocial) => CardSocial) =>
    qc.setQueryData<CardSocialState>(cardSocialKey(item), (old) => (old?.social ? { ...old, social: f(old.social) } : old));
  const refresh = (item?: string) => {
    if (item) void qc.invalidateQueries({ queryKey: cardSocialKey(item) });
    void qc.invalidateQueries({ queryKey: [...CARD_REACT_KEY, "opinions"] });
  };

  return {
    /** ♥ · 쉬워요/어려워요 — feel: undefined = 그대로 · null = 지우기 */
    react: async (item: string, p: { heart?: boolean; feel?: Feel | null }) => {
      const prev = qc.getQueryData<CardSocialState>(cardSocialKey(item));
      patch(item, (s) => applyReact(s, p));
      try {
        if (isTrainingDemo()) {
          patchDemo(item, (d) => ({ ...d, ...(p.heart !== undefined ? { heart: p.heart } : {}), ...(p.feel !== undefined ? { feel: p.feel } : {}) }));
          patch(item, (s) => ({ ...s, hearts: s.hearts == null ? s.hearts : s.hearts + (p.heart === true ? 1 : p.heart === false ? -1 : 0) }));
          return;
        }
        const { data, error } = await rpc("training_card_react", {
          p_item: item,
          p_heart: p.heart ?? null,
          p_feel: p.feel === undefined ? null : p.feel ?? "",
        });
        if (error) throw new Error(error.message ?? "반응을 남기지 못했어요");
        const r = (data ?? {}) as Record<string, unknown>;
        const hearts = n(r.hearts);
        patch(item, (s) => ({
          ...s,
          me: { ...s.me, heart: r.heart === true, feel: r.feel === "easy" || r.feel === "ok" || r.feel === "hard" ? r.feel : null },
          hearts: hearts > HEART_SHOW_OVER ? hearts : null,
        }));
      } catch (e) {
        qc.setQueryData(cardSocialKey(item), prev);
        throw e;
      }
    },

    /** 코치님께 의견 */
    opinion: async (item: string, body: string): Promise<{ notified: number }> => {
      if (isTrainingDemo()) {
        patchDemo(item, (d) => ({ ...d, opinions: [...(d.opinions ?? []), { id: newId(), body: body.trim(), at: new Date().toISOString() }] }));
        refresh(item);
        return { notified: 2 };
      }
      const { data, error } = await rpc("training_card_opinion_add", { p_item: item, p_body: body });
      if (error) throw new Error(error.message ?? "의견을 보내지 못했어요");
      refresh(item);
      return { notified: n((data as Record<string, unknown> | null)?.notified) };
    },

    /** 코치님 답 (처음 답할 때만 회원님 알림) */
    reply: async (id: string, body: string, item?: string) => {
      if (isTrainingDemo()) {
        patchDemo(item ?? "c:demo", (d) => ({ ...d, replies: { ...(d.replies ?? {}), [id]: body.trim() } }));
        refresh(item);
        return;
      }
      const { error } = await rpc("training_card_opinion_reply", { p_id: id, p_body: body });
      if (error) throw new Error(error.message ?? "답을 남기지 못했어요");
      refresh(item);
    },

    /** 답 읽음 — 카드 시트에서 답을 보면 */
    seen: async (item: string) => {
      patch(item, (s) => ({ ...s, opinions: s.opinions.map((o) => ({ ...o, seen: true })) }));
      if (isTrainingDemo()) return;
      await rpc("training_card_opinion_seen", { p_item: item });
    },

    /** 의견 지우기 — 쓴 분 · 대표님 */
    remove: async (id: string, item?: string) => {
      if (isTrainingDemo()) {
        if (item) patchDemo(item, (d) => ({ ...d, opinions: (d.opinions ?? []).filter((o) => o.id !== id) }));
        refresh(item);
        return;
      }
      const { data, error } = await rpc("training_card_opinion_remove", { p_id: id });
      if (error) throw new Error(error.message ?? "의견을 지우지 못했어요");
      if (data !== true) throw new Error("이미 지운 의견이에요");
      refresh(item);
    },

    /** 영상 찍어 주세요 — 영상 없는 카드(item) 또는 없던 검색어(query) */
    askFilm: async (target: { item?: string; query?: string }): Promise<boolean> => {
      if (target.item) patch(target.item, (s) => ({ ...s, me: { ...s.me, asked: true } }));
      if (isTrainingDemo()) {
        if (target.item) patchDemo(target.item, (d) => ({ ...d, asked: true }));
        return true;
      }
      if (asksOff) return false;
      const { data, error } = await rpc("training_card_ask", {
        p_kind: "film",
        p_item: target.item ?? null,
        p_query: target.query ? cleanQuery(target.query) : null,
      });
      if (missingFn(error)) {
        asksOff = true;
        return false;
      }
      if (error) throw new Error(error.message ?? "요청을 남기지 못했어요");
      return data === true;
    },
  };
}

/* ───────── 코치진 — 회원님 의견 목록 ───────── */

export function useCardOpinions(branch: string | null | undefined, enabled: boolean) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: opinionsKey(branch),
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<OpinionListState> => {
      const empty: OpinionList = { branch: null, waiting: 0, opinions: [] };
      if (demo) return { available: true, demo: true, list: demoOpinionList() };
      const { data, error } = await rpc("training_card_opinions", { p_branch: branch ?? null });
      if (error) {
        if (missingFn(error)) return { available: false, demo: false, list: empty };
        throw new Error(error.message ?? "의견을 불러오지 못했어요");
      }
      return { available: true, demo: false, list: parseOpinionList(data) };
    },
  });
}

/* ───────── 찾았는데 없는 동작 (보이지 않게) ───────── */

const missSent = new Set<string>();

/** 찾기 결과가 0일 때 — 같은 검색어는 이 창에서 한 번만. 실패해도 조용히 */
export function logSearchMiss(query: string): void {
  if (asksOff || typeof window === "undefined" || isTrainingDemo()) return;
  const k = askKey(query);
  if (!k || missSent.has(k)) return;
  missSent.add(k);
  void rpc("training_card_ask", { p_kind: "miss", p_item: null, p_query: cleanQuery(query) }).then(
    ({ error }) => {
      if (missingFn(error)) asksOff = true;
    },
    () => undefined,
  );
}
