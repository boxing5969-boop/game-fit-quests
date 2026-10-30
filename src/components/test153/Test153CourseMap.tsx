/**
 * 🗺️ 153 PB 코스 지도 — 153 PB 탭 맨 위 (2026-10-30 대표님 "153 PB 탭 들어가면 글만 보이는데, 회원님들이 직관적으로
 *   153 PB가 어떤 건지 알고 볼 수 있도록 — 하이록스 · 크로스핏 · 당근 · 토스처럼 성공한 UI 모델을 따라서" → 「153 PB 탭 디자인 보고서」 ①)
 *   · 8라운드를 지도 한 장으로: 점선 = 셀트런 100m, 원 = 종목. 1~4 는 왼쪽 → 오른쪽, 5~8 은 오른쪽 → 왼쪽 (이어 달리는 순서 그대로).
 *   · 원을 누르면 그 종목 시범 영상이 열린다 (onPick — 종목 카드 칸과 같은 창).
 *   · '상대는 지난번의 나'는 지도 아래 한 줄 (보고서 — 대표님 "니가 추천하는 대로").
 */
import { Flag, Timer } from "lucide-react";
import { TEST153_CAP_MS, TEST153_NAME, TEST153_NAME_KO, TEST153_STATIONS } from "@/lib/test153";

/** 지도 한 줄 높이 — 원(40) + 이름(18) + 틈 */
const CIRCLE = 40;
const ROW_GAP = 16;
const ROW_H = CIRCLE + 6 + 18;
/** 선이 지나는 높이 = 원 가운데 */
const LINE_1 = CIRCLE / 2;
const LINE_2 = ROW_H + ROW_GAP + CIRCLE / 2;

const ROUNDS = TEST153_STATIONS.length;
const CAP_MIN = Math.round(TEST153_CAP_MS / 60000);

interface Props {
  onPick: (index: number) => void;
}

const Stop = ({ index, onPick }: { index: number; onPick: (index: number) => void }) => {
  const s = TEST153_STATIONS[index];
  // 윗줄 1~4 = 1~4칸, 아랫줄 5~8 = 4~1칸 (뱀 모양)
  const lower = index >= 4;
  const col = lower ? 8 - index : index + 1;
  return (
    <li className="flex min-w-0 flex-col items-center" style={{ gridColumnStart: col, gridRowStart: lower ? 2 : 1 }}>
      <button
        type="button"
        onClick={() => onPick(index)}
        aria-label={`${index + 1}라운드 ${s.name} 시범 영상 보기`}
        className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-card text-body font-black tabular-nums text-primary shadow-elev-1 transition-transform active:scale-90"
      >
        {index + 1}
      </button>
      <span className="mt-1.5 w-full truncate text-center text-micro font-bold text-foreground">{s.mapName}</span>
    </li>
  );
};

const Test153CourseMap = ({ onPick }: Props) => (
  <section
    aria-labelledby="test153-course-h"
    className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-elev-1"
  >
    <p className="flex items-center gap-1.5 text-label font-bold text-primary">
      <Timer className="h-4 w-4 shrink-0" />
      {TEST153_NAME} · {TEST153_NAME_KO}
    </p>
    <h2 id="test153-course-h" className="mt-1 text-title text-foreground">
      {CAP_MIN}분 안에 {ROUNDS}라운드
    </h2>
    <p className="mt-0.5 text-label text-muted-foreground">셀트런 100m 달리고 → 종목 하나 · {ROUNDS}번 이어서</p>

    {/* 지도 — 점선(셀트런)은 뒤에, 원(종목)은 위에. 선은 원 가운데 높이를 지난다 */}
    <div className="relative mt-4" style={{ height: ROW_H * 2 + ROW_GAP }}>
      {/* 출발 → 1번 원 */}
      <span
        aria-hidden
        className="absolute left-0 border-t-2 border-dashed border-primary/60"
        style={{ top: LINE_1 - 1, width: "12.5%" }}
      />
      {/* 1 → 4 → (오른쪽으로 돌아) 5 → 8 */}
      <span
        aria-hidden
        className="absolute rounded-r-2xl border-y-2 border-r-2 border-dashed border-primary/60"
        style={{ top: LINE_1 - 1, height: LINE_2 - LINE_1 + 2, left: "12.5%", right: 2 }}
      />
      <Flag aria-hidden className="absolute left-0 h-3.5 w-3.5 text-primary" style={{ top: LINE_1 - 16 }} />
      {/* 아랫줄은 오른쪽 → 왼쪽(5가 오른쪽 끝) — 글 순서는 1 → 8 그대로 두고 칸 자리만 정한다 (화면 읽기도 1 → 8) */}
      <ol className="relative grid grid-cols-4" style={{ rowGap: ROW_GAP }} aria-label={`${ROUNDS}라운드 순서`}>
        {TEST153_STATIONS.map((s, i) => (
          <Stop key={s.name} index={i} onPick={onPick} />
        ))}
      </ol>
    </div>

    {/* 범례 — 점선 · 원 */}
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="w-5 border-t-2 border-dashed border-primary/60" />
        셀트런 100m
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-3 rounded-full border-2 border-primary bg-card" />
        종목 · 누르면 시범 영상
      </span>
    </p>

    <p className="mt-3 border-t border-border/70 pt-3 text-label text-foreground">
      <b>상대는 지난번의 나</b>
      <span className="text-muted-foreground"> — 1초라도 당기면 이긴 날이에요</span>
    </p>
  </section>
);

export default Test153CourseMap;
