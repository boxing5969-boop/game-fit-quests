// 🗂 내 메뉴 배치 — 이 기기(localStorage) + DB(get_my_menu_layout · save_my_menu_layout) (2026-11-08 대표님 바로가기 편집)
//
//   · 화면은 이 기기 값으로 바로 그린다(깜빡임 없음). 그다음 DB 값을 읽어 더 새것(updatedAt)을 고른다.
//   · 고치면 이 기기에 바로 쓰고, DB 에는 0.7초 모아서 보낸다(끌기 · 이름 바꾸기를 연달아 해도 한 번).
//   · DB 함수가 아직 없거나(PGRST202) 오프라인이면 이 기기에만 — 앱은 멈추지 않는다.
//   · 계정마다 따로(키에 사용자 id) — 한 휴대폰에서 다른 계정으로 바꿔도 섞이지 않는다.
//   · 홈 전체 메뉴와 아래 '전체' 시트가 같은 캐시(React Query)를 봐서, 한쪽에서 고치면 다른 쪽도 바로 바뀐다.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseLayout, type MenuLayout } from "@/lib/menuLayout";

const LS_PREFIX = "153menu:layout:";
const PUSH_DELAY_MS = 700;

// 새 DB 함수는 생성된 타입(types.ts)에 아직 없다 — 이름으로 부른다(this 가 풀리지 않게 그 자리에서 바로 부른다)
type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

const readLocal = (uid: string): MenuLayout | null => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + uid);
    return raw ? parseLayout(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const writeLocal = (uid: string, layout: MenuLayout) => {
  try {
    localStorage.setItem(LS_PREFIX + uid, JSON.stringify(layout));
  } catch {
    /* 저장이 막힌 브라우저 — 이번 접속 동안만 */
  }
};

// DB 함수가 없으면(마이그레이션 적용 전) 이번 접속 동안 다시 부르지 않는다
let remoteOff = false;

const isMissingFn = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? ""));

/** undefined = 읽을 수 없음(함수 없음 · 오프라인) · null = DB 에 없음 */
async function fetchRemote(): Promise<MenuLayout | null | undefined> {
  if (remoteOff) return undefined;
  try {
    const { data, error } = await (supabase.rpc as unknown as UntypedRpc)("get_my_menu_layout");
    if (error) {
      if (isMissingFn(error)) remoteOff = true;
      return undefined;
    }
    return parseLayout(data);
  } catch {
    return undefined;
  }
}

const pending = new Map<string, { timer: number; layout: MenuLayout }>();

async function pushNow(layout: MenuLayout) {
  if (remoteOff) return;
  try {
    const { error } = await (supabase.rpc as unknown as UntypedRpc)("save_my_menu_layout", { _layout: layout });
    if (isMissingFn(error)) remoteOff = true;
  } catch {
    /* 오프라인 — 이 기기 값이 남아 있어 다음에 열 때 다시 보낸다 */
  }
}

function schedulePush(uid: string, layout: MenuLayout) {
  if (remoteOff) return;
  const prev = pending.get(uid);
  if (prev) window.clearTimeout(prev.timer);
  const timer = window.setTimeout(() => {
    pending.delete(uid);
    void pushNow(layout);
  }, PUSH_DELAY_MS);
  pending.set(uid, { timer, layout });
}

// 앱을 닫거나 다른 앱으로 넘어갈 때 모아 둔 것을 바로 보낸다
if (typeof window !== "undefined") {
  const flush = () => {
    for (const p of pending.values()) {
      window.clearTimeout(p.timer);
      void pushNow(p.layout);
    }
    pending.clear();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export const menuLayoutKey = (uid: string | null) => ["153menu", "layout", uid ?? "anon"] as const;

export function useMenuLayout() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: menuLayoutKey(uid),
    enabled: !!uid,
    initialData: () => (uid ? readLocal(uid) : null),
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<MenuLayout | null> => {
      if (!uid) return null;
      const remote = await fetchRemote();
      // 기다리는 동안 이 화면에서 고쳤을 수 있다 — 기기 값은 기다린 뒤에 다시 읽는다
      const local = readLocal(uid);
      if (remote === undefined) return local;
      if (remote && (!local || remote.updatedAt > local.updatedAt)) {
        writeLocal(uid, remote);
        return remote;
      }
      if (local && (!remote || local.updatedAt > remote.updatedAt)) schedulePush(uid, local);
      return local;
    },
  });

  const save = useCallback(
    (next: MenuLayout) => {
      if (!uid) return;
      const prev = qc.getQueryData<MenuLayout | null>(menuLayoutKey(uid));
      // 같은 밀리초에 두 번 고쳐도 순서가 지켜지게
      const stamped: MenuLayout = { ...next, updatedAt: Math.max(next.updatedAt, (prev?.updatedAt ?? 0) + 1) };
      qc.setQueryData(menuLayoutKey(uid), stamped);
      writeLocal(uid, stamped);
      schedulePush(uid, stamped);
    },
    [qc, uid],
  );

  return { layout: data ?? null, save };
}
