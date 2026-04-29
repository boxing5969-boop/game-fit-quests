/**
 * 153 QUEST — 챔피언 일기: 질문 선택 칩 리스트.
 *
 * 질문 seed 는 자체 제작. 실존 명언/저작물 미사용.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const CHAMPION_JOURNAL_PROMPTS: string[] = [
  "오늘 가장 잘한 펀치는?",
  "오늘 가장 어려웠던 동작은?",
  "오늘의 나에게 한마디 한다면?",
  "오늘 다시 도전하고 싶은 기술은?",
  "오늘 나를 링에 올린 이유는?",
  "오늘의 컨디션을 한 단어로 표현한다면?",
  "오늘 배운 복싱 습관은?",
  "7일 뒤의 나에게 남기고 싶은 말은?",
];

export interface ChampionJournalPromptListProps {
  selected: string;
  onSelect: (prompt: string) => void;
}

const ChampionJournalPromptList = ({
  selected,
  onSelect,
}: ChampionJournalPromptListProps) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHAMPION_JOURNAL_PROMPTS.map((p) => {
        const active = p === selected;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className={`rounded-pill border px-2.5 py-1.5 text-[11px] transition-all active:scale-[0.98] ${
              active
                ? "border-primary bg-primary/10 text-foreground font-bold"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
};

export default ChampionJournalPromptList;
