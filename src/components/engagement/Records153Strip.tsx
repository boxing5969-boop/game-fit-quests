/**
 * 🏆 153 레코드 최초 기록자 띠 — 랭킹 탭 · 명예의 전당 탭 위 (2026-10-16 대표님:
 * "명예의 전당과 랭킹 탭에 최초 기록자들 레코드 확인할 수 있게")
 *   · 새겨진 최초 기록을 가로로 넘겨 보고, 이름을 누르면 그 회원 라이센스
 *   · 아직 주인 없는 기록 수 + 도전하면 마일리지 → '153 레코드' 탭으로
 *   데이터는 153 레코드 탭과 같은 get_153_records (useRecords153)
 */
import { ChevronRight } from "lucide-react";

import { RECORD_153_FIRSTS, RECORD_153_MILEAGE, useRecords153 } from "@/services/records153Service";

interface Props {
  onOpenAll: () => void;
  onOpenMember?: (m: { id: string; nickname: string }) => void;
}

const Records153Strip = ({ onOpenAll, onOpenMember }: Props) => {
  const { data } = useRecords153();
  if (!data) return null;
  const byKey = new Map(data.firsts.map((f) => [f.key, f]));
  const filled = RECORD_153_FIRSTS.filter((f) => byKey.has(f.key));
  const open = RECORD_153_FIRSTS.length - filled.length;

  return (
    <section className="rounded-card border border-[#F6C453]/40 bg-gradient-to-b from-[#F6C453]/10 to-card p-3.5">
      <button type="button" onClick={onOpenAll} className="flex w-full items-center gap-2 text-left active:opacity-80">
        <span className="text-[15px] font-black text-foreground">🏆 153 레코드 최초 기록자</span>
        <span className="ml-auto flex items-center text-[12px] font-bold text-muted-foreground">
          전체 보기
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>

      {filled.length > 0 && (
        <div className="-mx-3.5 mt-2.5 flex gap-2 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filled.map((f) => {
            const rec = byKey.get(f.key)!;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onOpenMember?.({ id: rec.user_id, nickname: rec.nickname })}
                className={`flex shrink-0 items-center gap-2 rounded-xl border bg-card px-2.5 py-2 text-left active:scale-[0.98] ${
                  rec.is_me ? "border-primary/60" : "border-border"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-reward/15 text-[16px]">{f.emoji}</span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[10.5px] font-black text-reward">{f.title}</span>
                  <span className="block max-w-[8.5rem] truncate text-[13.5px] font-black text-foreground">
                    {rec.nickname}
                    {rec.is_me && <span className="ml-1 text-[11px] text-primary">나</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {open > 0 && (
        <button
          type="button"
          onClick={onOpenAll}
          className="mt-2.5 w-full rounded-xl bg-reward/15 px-3 py-2 text-[12.5px] font-black text-reward active:scale-[0.99]"
        >
          아직 주인 없는 기록 {open}개 — 최초가 되면 마일리지 {RECORD_153_MILEAGE.toLocaleString()} 🎁
        </button>
      )}
    </section>
  );
};

export default Records153Strip;
