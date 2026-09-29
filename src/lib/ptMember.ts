/**
 * PT(퍼스널 트레이닝) 회원 — 2026-09-29 대표님: "PT 회원님들은 회원카드에 블루 배지 + 경험치 2배".
 *
 * PT 여부는 브로제이 PT 수업권 기준이다. 153OS 가 회원별 이용권을 확인할 때 같이 기록하고,
 * sync-pt-members(매시 40분)가 profiles.pt_until(KST 날짜)에 옮긴다. pt_until 이 오늘 이후면 PT 회원.
 * 경험치 2배는 서버(DB 트리거 trg_pt_xp_bonus)가 같은 기준(is_pt_active)으로 준다 — 이 함수는 화면 표시만 한다.
 */
import { kstToday } from "@/lib/levelPractice";

type PtLike = { pt_until?: string | null };

export const isPtMember = (p: unknown, today: string = kstToday()): boolean => {
  if (!p || typeof p !== "object") return false;
  const until = (p as PtLike).pt_until;
  return typeof until === "string" && until.slice(0, 10) >= today;
};
