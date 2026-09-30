/**
 * 메시지(DM) 사람 표기 — 지점 짧은 이름 · 이름 아래 한 줄.
 */
import { RANK_LABELS } from "@/lib/rankLabels";
import type { DmPerson } from "@/services/dmService";

/** "153복싱짐 선릉역점" → "선릉역점" */
export const shortBranch = (b: string | null | undefined): string => (b ?? "").replace(/^153복싱짐\s*/, "");

/** 이름 아래 한 줄 — 회원: '화이트 L3 · 선릉역점' · 코치님: '선릉역점 지도진' · 본사: '153 본사' */
export const dmPersonLine = (p: Pick<DmPerson, "kind" | "rank" | "level" | "branch"> | null, withBranch = true): string => {
  if (!p) return "";
  const branch = withBranch ? shortBranch(p.branch) : "";
  if (p.kind === "coach") return branch ? `${branch} 지도진` : "지도진";
  if (p.kind === "hq") return "153 본사";
  const league = `${RANK_LABELS[(p.rank ?? "white").toLowerCase()] ?? "화이트"} L${p.level ?? 1}`;
  return branch ? `${league} · ${branch}` : league;
};
