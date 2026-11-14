/**
 * 🎬 내 수업 창 모음 — 고르기 · 편집(+ 카드 더 담기) · 재생 · 코치님 보기 (2026-11-14 2단계)
 *   TrainingShelf 맨 아래에 하나. 창은 모두 body 로 띄운다(움직이는 부모 안에 갇히지 않게).
 */
import type { ArrangedShelf } from "@/lib/shelfLayout";
import type { ClassItem } from "@/lib/myClass";
import MyClassChooser from "./MyClassChooser";
import MyClassEditor from "./MyClassEditor";
import MyClassPlayer from "./MyClassPlayer";
import SharedClassSheet from "./SharedClassSheet";
import type { MyClassFlow, PosterOf } from "./useMyClassFlow";

const MyClassLayer = ({
  flow,
  posterOf,
  sections,
  onToPlan,
}: {
  flow: MyClassFlow;
  posterOf: PosterOf;
  sections: readonly ArrangedShelf[];
  onToPlan?: (c: { name: string; items: ClassItem[] }) => void;
}) => {
  if (!flow.available) return null;
  return (
    <>
      <MyClassChooser flow={flow} posterOf={posterOf} />
      <MyClassEditor flow={flow} posterOf={posterOf} sections={sections} onToPlan={onToPlan} />
      {flow.staffView && <SharedClassSheet flow={flow} posterOf={posterOf} />}
      <MyClassPlayer flow={flow} posterOf={posterOf} />
    </>
  );
};

export default MyClassLayer;
