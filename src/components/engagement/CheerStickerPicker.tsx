/**
 * 153 QUEST — 세컨드 응원: 스티커 선택 칩 리스트.
 *
 * 자체 제작 응원 메시지. 실존 인물/저작물 미사용.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const CHEER_STICKERS: string[] = [
  "나이스 잽!",
  "오늘 폼 좋다!",
  "가드 살아있네!",
  "한 라운드 더 가자!",
  "포기 안 한 게 진짜 승리!",
  "어제의 나를 이겼네요!",
  "오삼이가 인정한 파이터!",
  "샌드백이 떨고 있다!",
  "돌아온 것부터 승리!",
  "오늘도 링에 올랐군!",
];

export interface CheerStickerPickerProps {
  selected: string | null;
  onSelect: (sticker: string) => void;
}

const CheerStickerPicker = ({ selected, onSelect }: CheerStickerPickerProps) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHEER_STICKERS.map((s) => {
        const active = s === selected;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            className={`rounded-pill border px-2.5 py-1.5 text-[11px] transition-all active:scale-[0.98] ${
              active
                ? "border-primary bg-primary/10 text-foreground font-bold"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
};

export default CheerStickerPicker;
