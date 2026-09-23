/**
 * PostgREST 1,000행 상한 우회 (2026-09-23)
 *
 * Supabase 는 한 요청에 최대 1,000행(max-rows)만 돌려준다. `.select()` 를 그냥 부르면 회원이
 * 3,000명이어도 1,000명만 오고, 그 길이를 그대로 세면 "전체 회원 1000명" 이 된다.
 * 총원은 `count` 헤더로, 목록은 1,000행씩 range 로 끝까지 읽는다.
 *
 * `.in()` 은 값이 URL 쿼리스트링에 들어가서(uuid 1개 ≈ 39자) 수백 개가 넘으면 URL 길이 한도에
 * 걸린다. 150개씩 나눠 부른다.
 */

export const PAGE_SIZE = 1000;
export const IN_CHUNK = 150;

type RowsResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/**
 * range 페이징으로 전부 읽는다. build 는 (from, to) 를 받아 `.range(from, to)` 까지 붙인 쿼리를 돌려준다.
 * 정렬은 build 안에서 반드시 고유 키까지 지정한다 (예: created_at desc, user_id) — 동률이 많으면
 * 페이지 경계에서 같은 사람이 두 번 오거나 빠진다.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<RowsResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    // PGRST103 = 요청 범위가 총 행수를 넘음(정확히 1,000의 배수일 때 마지막 빈 페이지) → 끝.
    if (error) {
      if (error.code === "PGRST103") break;
      throw new Error(error.message);
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

export function chunk<T>(arr: readonly T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** ids 를 IN_CHUNK 개씩 나눠 run 을 병렬로 부르고 결과를 합친다. 한 조각이라도 실패하면 throw. */
export async function inChunks<T>(
  ids: readonly string[],
  run: (ids: string[]) => PromiseLike<RowsResult<T>>,
  size = IN_CHUNK,
): Promise<T[]> {
  if (!ids.length) return [];
  const results = await Promise.all(chunk(ids, size).map((part) => run(part)));
  const out: T[] = [];
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
    out.push(...(r.data ?? []));
  }
  return out;
}
