/**
 * 라이브보드 TV 2번 머리 왼쪽 — 두 탭 표시 「마이복서153」 · 「체육관 공지사항」 (2026-11-26 대표님 「체육관 공지사항 탭하나 만들자」)
 *   지금 탭 = 민트 알약 + 지금 장면 · 공지 이름 칩 / 다른 탭 = 회색 글자. 누르는 곳은 없다(TV) — 1분마다 저절로 바뀐다(lib/gymNotices.ts).
 *   글자 28px 이상.
 */
export type Tv2TabId = "value" | "notice";

const TABS: readonly { id: Tv2TabId; label: string }[] = [
  { id: "value", label: "마이복서153" },
  { id: "notice", label: "체육관 공지사항" },
];

const Tv2TabPills = ({ active, tag }: { active: Tv2TabId; tag: string }) => (
  <div className="flex shrink-0 items-center gap-4" role="tablist" aria-label="TV 2번 탭">
    {TABS.map((t) =>
      t.id === active ? (
        <span key={t.id} role="tab" aria-selected="true" className="flex items-center gap-3">
          <span className="rounded-full bg-primary px-4 py-1 text-[28px] font-black leading-none text-gray-950">{t.label}</span>
          <span className="rounded-full bg-white/10 px-4 py-1 text-[28px] font-black leading-none text-white">{tag}</span>
        </span>
      ) : (
        <span key={t.id} role="tab" aria-selected="false" className="text-[28px] font-bold leading-none text-gray-500">
          {t.label}
        </span>
      ),
    )}
  </div>
);

export default Tv2TabPills;
