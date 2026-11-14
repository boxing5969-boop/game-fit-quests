// 수업 루틴 — 153 수업 매뉴얼(레벨마다 3일) 화면. (2026-09-07 코치 4단계 루틴 열람 · '수업 완료' 기록으로 시작 → 2026-11-14 매뉴얼만 남김)
//
// 📋 2026-09-30 대표님: 레벨마다 3일 수업 — 일차별 수업 매뉴얼(level_lesson_days)을 이 화면 맨 위에.
//   오늘(다음) 수업 카드 → 레벨별 1·2·3일차 목록 → 누르면 그날 수업 시트(?day=N, 뒤로가기로 닫힘).
//   2026-11-14 영상으로 배우기 2단계(결정 7번): 코치님 루틴(class_routines — 0건) 칸은 접었다 — 이 화면은 153 수업 매뉴얼만.
//     회원님 · 코치님이 직접 짜는 수업은 훈련 탭 「영상으로 배우기」의 「내 수업」(lib/myClass). 표 class_routines 는 DB 에 그대로 둔다.
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLessonDays, useLessonToday } from "@/hooks/useLessonDays";
import { groupByLevel } from "@/lib/lessonDays";
import LessonTodayCard from "@/components/lesson/LessonTodayCard";
import LessonDayList from "@/components/lesson/LessonDayList";
import LessonDaySheet from "@/components/lesson/LessonDaySheet";

const RoutinesPage = () => {
  const navigate = useNavigate();

  // 📋 일차별 수업 매뉴얼
  const lessonDays = useLessonDays();
  const { data: lessonToday } = useLessonToday();
  const lessonGroups = groupByLevel(lessonDays.data ?? []);
  const [params, setParams] = useSearchParams();
  const openDayNo = Number(params.get("day")) || null;
  const openDay = openDayNo ? lessonDays.byDayNo.get(openDayNo) ?? null : null;
  // 목록에서 열었으면(주소를 한 칸 쌓았으면) 닫을 때 한 칸 뒤로 — 훈련 탭에서 ?day 로 바로 왔으면 주소만 지운다
  const pushedDay = useRef(false);
  useEffect(() => {
    if (!openDayNo) pushedDay.current = false;
  }, [openDayNo]);
  const openLesson = (dayNo: number) => {
    pushedDay.current = true;
    setParams({ day: String(dayNo) });
  };
  const switchLesson = (dayNo: number) => setParams({ day: String(dayNo) }, { replace: true });
  const closeLesson = () => {
    if (pushedDay.current) {
      pushedDay.current = false;
      navigate(-1);
    } else {
      setParams({}, { replace: true });
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-4 pb-24 pt-4 text-foreground">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-heading font-black">수업 루틴</h1>
      </div>

      {/* 레벨업 진행도는 훈련 탭 '레벨업까지' 카드 한 곳에서 (2026-10-28 리디자인 — 여기는 수업 매뉴얼이 주인공) */}

      {/* ── 📋 일차별 수업 매뉴얼 ── */}
      <LessonTodayCard onOpen={openLesson} showEmpty className="mb-4" />

      <div className="mb-2.5 px-1">
        <h2 className="text-heading text-foreground">153 수업 매뉴얼</h2>
        <p className="mt-0.5 text-label text-muted-foreground">레벨마다 3일 · 누르면 그날 순서가 나와요</p>
      </div>
      {lessonDays.isLoading ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : lessonDays.isError ? (
        <div className="rounded-2xl bg-card px-4 py-8 text-center shadow-elev-1">
          <p className="text-label font-bold text-foreground">수업 매뉴얼을 불러오지 못했어요</p>
          <button
            type="button"
            onClick={() => lessonDays.refetch()}
            className="mt-3 rounded-full bg-secondary px-4 py-2 text-label font-bold active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : lessonGroups.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-8 text-center text-label text-muted-foreground">
          수업 매뉴얼을 준비하고 있어요
        </p>
      ) : (
        <LessonDayList groups={lessonGroups} today={lessonToday} onOpen={openLesson} />
      )}

      <LessonDaySheet
        day={openDay}
        byDayNo={lessonDays.byDayNo}
        today={lessonToday}
        onClose={closeLesson}
        onOpenDay={switchLesson}
      />
    </div>
  );
};

export default RoutinesPage;
