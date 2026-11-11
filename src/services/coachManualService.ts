/**
 * 📘 153 매뉴얼 — 훅 · 뮤테이션 (["coach-manual", …] 캐시)
 *   서버: coach_manual_book · coach_manual_me · coach_manual_sign · coach_manual_board · coach_manual_nudge (20261111131159_coach_manual.sql)
 *
 *   책은 DB(coach_manual_books) — 코치진만 coach_manual_book 으로 받고 normalize.ts 로 거른다. 비공개 장(앞글 2편 · 부록)은 DB 에만,
 *   일반 장(프롤로그~9장)은 DB 에 번호 · 판만 두고 글은 앱 안 1권(book1Sample)에서 (DB 에 장 전체를 넣으면 그 글이 앞선다).
 *   서버에 함수가 아직 없을 때(PGRST202 — DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기):
 *   · 책은 앱 안 예시(book1Sample — 프롤로그~9장)를 보인다 · DB 에 책 줄이 없을 때도 같은 예시('준비 중')
 *   · 읽기 · 확인 문제는 그대로 되고, 서명은 이 기기에만 남긴다(localStorage `153manual:<책>:reads`) — 화면에 '이 휴대폰에만 남아요'
 *   · 현황은 예시 코치님 세 분(이름 없이 '예시')으로 보여 준다 · '읽어 주세요' 알림은 보내지 않는다
 *   다른 오류는 그대로 알린다(가짜로 채우지 않는다).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { BOOK1_SAMPLE } from "@/lib/coachManual/book1Sample";
import { normalizeBook } from "@/lib/coachManual/normalize";
import type { ManualBoard, ManualBook, ManualMe, ManualRead } from "@/lib/coachManual/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

export const COACH_MANUAL_KEY = ["coach-manual"] as const;

type RpcError = { code?: string; message?: string; status?: number } | null;

/** 서버에 함수가 없다 — DB 적용 전 · 옛 DB 미리보기 */
export const isMissingFunction = (e: RpcError): boolean =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));

const localKey = (book: string) => `153manual:${book}:reads`;

export function readLocalReads(book: string): ManualRead[] {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(book)) || "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (r): r is ManualRead =>
            !!r && typeof r.chapter === "string" && typeof r.version === "number" && typeof r.signed_at === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeLocalRead(book: string, chapter: string, version: number, tries: number): ManualRead[] {
  const reads = readLocalReads(book);
  if (!reads.some((r) => r.chapter === chapter && r.version === version)) {
    reads.push({ chapter, version, quiz_tries: tries, signed_at: new Date().toISOString() });
    // 사파리 시크릿 모드 등 저장이 막힌 곳에서도 화면은 계속 간다
    try {
      localStorage.setItem(localKey(book), JSON.stringify(reads));
    } catch {
      /* 저장 실패는 무시 */
    }
  }
  return reads;
}

export interface ManualBookView {
  book: ManualBook;
  /** server = DB 책 · offline = 서버 함수가 없어 앱 안 예시(미리보기) · empty = DB 에 책이 없거나 읽을 수 없어 앱 안 예시 */
  source: "server" | "offline" | "empty";
}

export const useManualBook = (book: string, enabled = true) =>
  useQuery({
    queryKey: [...COACH_MANUAL_KEY, "book", book],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ManualBookView> => {
      const { data, error } = await rpc("coach_manual_book", { p_book: book });
      if (error) {
        if (isMissingFunction(error)) return { book: BOOK1_SAMPLE, source: "offline" };
        throw new Error(translateError(error, "매뉴얼을 불러오지 못했어요"));
      }
      // 일반 장은 DB 에 번호 · 판만 — 글은 앱 안 1권(book1Sample)에서
      const parsed = normalizeBook(data, book === BOOK1_SAMPLE.id ? BOOK1_SAMPLE : null);
      return parsed ? { book: parsed, source: "server" } : { book: BOOK1_SAMPLE, source: "empty" };
    },
  });

export interface ManualMeView extends ManualMe {
  reads: ManualRead[];
  /** 서버 함수가 없어 이 기기 기록으로 보여 주는 중 */
  offline: boolean;
}

export const useManualMe = (book: string, enabled = true) =>
  useQuery({
    queryKey: [...COACH_MANUAL_KEY, "me", book],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ManualMeView> => {
      const { data, error } = await rpc("coach_manual_me", { p_book: book });
      if (error) {
        if (isMissingFunction(error)) return { staff: true, reads: readLocalReads(book), offline: true };
        throw new Error(translateError(error, "매뉴얼 기록을 불러오지 못했어요"));
      }
      const me = (data ?? { staff: false }) as ManualMe;
      return { ...me, reads: Array.isArray(me.reads) ? me.reads : [], offline: false };
    },
  });

export interface SignInput {
  chapter: string;
  version: number;
  tries: number;
}

export const useManualSign = (book: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: SignInput): Promise<{ reads: ManualRead[]; offline: boolean }> => {
      const { data, error } = await rpc("coach_manual_sign", {
        p_book: book,
        p_chapter: v.chapter,
        p_version: v.version,
        p_quiz_tries: v.tries,
      });
      if (error) {
        if (isMissingFunction(error)) return { reads: writeLocalRead(book, v.chapter, v.version, v.tries), offline: true };
        throw new Error(translateError(error, "서명하지 못했어요 · 잠시 뒤 다시 눌러 주세요"));
      }
      return { reads: Array.isArray(data) ? (data as ManualRead[]) : [], offline: false };
    },
    onSuccess: (res) => {
      qc.setQueryData<ManualMeView>([...COACH_MANUAL_KEY, "me", book], (old) =>
        old ? { ...old, reads: res.reads, offline: res.offline } : old,
      );
      void qc.invalidateQueries({ queryKey: [...COACH_MANUAL_KEY, "board"] });
    },
  });
};

export interface ManualBoardView extends ManualBoard {
  /** 서버 함수가 없어 예시로 보여 주는 중 */
  demo: boolean;
}

/** 서버 함수가 없을 때의 예시 현황 — 이름 없이 '예시' (실제 코치님 정보 아님) */
function demoBoard(myReads: ManualRead[]): ManualBoardView {
  const at = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  const r = (chapter: string, d: number, version = 1): ManualRead => ({ chapter, version, quiz_tries: 0, signed_at: at(d) });
  const all = ["author", "solution", "prologue", "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9"];
  return {
    demo: true,
    branch: "예시 지점",
    branches: ["예시 지점"],
    people: [
      { user_id: "demo-me", name: "나", title: "미리보기", avatar_url: null, me: true, reads: myReads, nudged_at: null },
      { user_id: "demo-a", name: "예시 코치 A", title: "코치", avatar_url: null, me: false, reads: all.map((c, i) => r(c, 12 - i)), nudged_at: null },
      { user_id: "demo-b", name: "예시 코치 B", title: "코치", avatar_url: null, me: false, reads: all.slice(0, 5).map((c, i) => r(c, 5 - i)), nudged_at: null },
      { user_id: "demo-c", name: "예시 코치 C", title: "코치", avatar_url: null, me: false, reads: [], nudged_at: at(0.2) },
    ],
  };
}

export const useManualBoard = (book: string, branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...COACH_MANUAL_KEY, "board", book, branch],
    enabled,
    staleTime: 20_000,
    queryFn: async (): Promise<ManualBoardView> => {
      const { data, error } = await rpc("coach_manual_board", { p_book: book, p_branch: branch });
      if (error) {
        if (isMissingFunction(error)) return demoBoard(readLocalReads(book));
        throw new Error(translateError(error, "읽음 현황을 불러오지 못했어요"));
      }
      const b = data as ManualBoard;
      return {
        demo: false,
        branch: b?.branch ?? "",
        branches: Array.isArray(b?.branches) ? b.branches : [],
        people: Array.isArray(b?.people) ? b.people : [],
      };
    },
  });

export const useManualNudge = (book: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { user: string; left: number }): Promise<"sent" | "too_soon" | "offline"> => {
      const { data, error } = await rpc("coach_manual_nudge", { p_book: book, p_user: v.user, p_left: v.left });
      if (error) {
        if (isMissingFunction(error)) return "offline";
        throw new Error(translateError(error, "알림을 보내지 못했어요"));
      }
      return data === "too_soon" ? "too_soon" : "sent";
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...COACH_MANUAL_KEY, "board"] }),
  });
};
