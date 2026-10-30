/**
 * 🎬 153 PB 종목 카드 — 옆으로 넘기는 카드 + 누르면 시범 영상 창 (2026-10-30 「153 PB 탭 디자인 보고서」 ②)
 *   · 맨 앞 셀트런 100m 카드 + 종목 8장. 카드 = 영상 첫 장면(포스터) · 이름 · 오픈/스타터 개수 · 인정 기준 한 줄 (크로스핏 오픈처럼 기준이 먼저)
 *   · 카드나 코스 지도의 원을 누르면 아래에서 창이 올라와 시범 영상이 바로 재생된다(무음 반복) — 하는 법 · 인정 기준 · 요령 · 이전/다음 종목.
 *   · 영상은 한 편 2~10MB · 1~2분이라 목록에서는 포스터(약 70KB, 보일 때 받기)만 — 영상은 창을 연 종목 하나만 받는다.
 *   · 예전 '안내 → 동작별 하는 법 · 인정 기준' 접힌 칸을 대신한다.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Footprints, Play } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { stationReps, TEST153_RUN_GUIDE, TEST153_STATIONS, type Test153Station } from "@/lib/test153";

/** -1 = 셀트런, 0~7 = 종목 */
export type Test153MovePick = number | null;
export const TEST153_RUN_PICK = -1;

const LAST = TEST153_STATIONS.length - 1;

const counts = (s: Test153Station) => `오픈 ${s.open}${s.unit} · 스타터 ${stationReps(s, "starter")}${s.unit}`;

/** 셀트런 그림 — 10m 두 줄 사이를 오가는 화살표 */
const RunPicture = ({ big }: { big?: boolean }) => (
  <div
    className={cn(
      "flex h-full w-full items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-muted/40 px-4",
      big && "gap-3",
    )}
  >
    <span aria-hidden className={cn("w-1.5 rounded-full bg-foreground/70", big ? "h-24" : "h-14")} />
    <span className="flex min-w-0 flex-1 flex-col items-center">
      <span aria-hidden className="w-full border-t-2 border-dashed border-primary" />
      <span className={cn("mt-1.5 font-black tabular-nums text-foreground", big ? "text-heading" : "text-label")}>↔ 10m × 10번</span>
      <span className="text-micro text-muted-foreground">라인을 발로 밟고 돌기</span>
    </span>
    <span aria-hidden className={cn("w-1.5 rounded-full bg-foreground/70", big ? "h-24" : "h-14")} />
  </div>
);

/** 시범 영상 — 창이 열리면 바로 재생(무음 반복), 누르면 멈춤/다시 재생 */
const MoveVideo = ({ src, poster, name }: { src: string; poster: string; name: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (v) void v.play().catch(() => setPlaying(false));
  }, [src]);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${name} 시범 영상 ${playing ? "멈추기" : "보기"}`}
      className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-muted"
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-cover"
      />
      {/* 아래 글씨 띠(이름 · 개수 · 기준)를 가리지 않게 위 동작 화면에만 얹는다 */}
      {!playing && (
        <span className="absolute inset-x-0 top-0 flex h-[56.3%] items-center justify-center bg-black/15">
          <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-label font-black text-[#191F28] shadow-md">
            <Play className="h-4 w-4 fill-current text-primary" /> 시범 영상
          </span>
        </span>
      )}
    </button>
  );
};

const Badge = ({ tone, children }: { tone: "primary" | "amber"; children: React.ReactNode }) => (
  <span
    className={cn(
      "mr-1.5 rounded-md px-1.5 py-0.5 text-micro font-black",
      tone === "primary" ? "bg-primary/10 text-primary" : "bg-amber-400/15 text-amber-700 dark:text-amber-300",
    )}
  >
    {children}
  </span>
);

interface CardProps {
  no: React.ReactNode;
  name: string;
  sub: string;
  line: string;
  boxing?: boolean;
  poster?: string;
  onClick: () => void;
}

const MoveCard = ({ no, name, sub, line, boxing, poster, onClick }: CardProps) => (
  <li className="w-[68%] max-w-[240px] shrink-0 snap-start">
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name} 자세히 보기`}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-elev-1 transition-transform active:scale-[0.98]"
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-muted">
        {poster ? (
          // 포스터 위 56% 가 동작 화면 — 16:9 칸에 위쪽만 보이게
          <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
        ) : (
          <RunPicture />
        )}
        <span className="absolute left-2 top-2 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-primary px-2 text-label font-black tabular-nums text-primary-foreground shadow-md">
          {no}
        </span>
        {poster && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-micro font-black text-[#191F28] shadow-md">
            <Play className="h-3 w-3 fill-current text-primary" /> 영상
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col p-3">
        <span className="truncate text-body font-black text-foreground">
          {name}
          {boxing && " 🥊"}
        </span>
        <span className="mt-0.5 text-label font-bold tabular-nums text-primary">{sub}</span>
        <span className="mt-1 line-clamp-2 text-label leading-snug text-muted-foreground">{line}</span>
      </span>
    </button>
  </li>
);

interface Props {
  picked: Test153MovePick;
  onPick: (pick: Test153MovePick) => void;
  className?: string;
}

const Test153MoveRail = ({ picked, onPick, className }: Props) => {
  const open = picked !== null;
  const isRun = picked === TEST153_RUN_PICK;
  const station = picked !== null && picked >= 0 ? TEST153_STATIONS[picked] : null;
  const prev = picked === null ? null : picked > 0 ? picked - 1 : picked === 0 ? TEST153_RUN_PICK : null;
  const next = picked === null ? null : picked < LAST ? picked + 1 : null;
  const pickName = (p: number) => (p === TEST153_RUN_PICK ? TEST153_RUN_GUIDE.name : TEST153_STATIONS[p].name);

  return (
    <section aria-labelledby="test153-moves-h" className={className}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 id="test153-moves-h" className="text-heading text-foreground">
          종목 {TEST153_STATIONS.length}개
        </h3>
        <span className="text-label text-muted-foreground">옆으로 넘겨요</span>
      </div>
      <p className="mt-0.5 px-1 text-label text-muted-foreground">스타터는 개수 절반 · 푸시업은 무릎 대도 돼요</p>

      {/* 화면 끝까지 넘기기 — 페이지 양옆 여백(px-5)만큼 밖으로 */}
      <ul className="-mx-5 mt-2 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
        <MoveCard
          no={<Footprints className="h-3.5 w-3.5" aria-label="셀트런" />}
          name={TEST153_RUN_GUIDE.name}
          sub="매 라운드 시작 · 모두 8번"
          line={TEST153_RUN_GUIDE.standard}
          onClick={() => onPick(TEST153_RUN_PICK)}
        />
        {TEST153_STATIONS.map((s, i) => (
          <MoveCard
            key={s.name}
            no={`${i + 1}`}
            name={s.name}
            sub={counts(s)}
            line={s.standard}
            boxing={s.boxing}
            poster={s.video?.poster}
            onClick={() => onPick(i)}
          />
        ))}
      </ul>

      <Drawer open={open} onOpenChange={(o) => !o && onPick(null)}>
        <DrawerContent className="max-h-[92vh]">
          {open && (
            <>
              <DrawerHeader className="pb-2 text-left">
                <DrawerTitle className="text-heading">
                  {isRun ? TEST153_RUN_GUIDE.name : `${(picked ?? 0) + 1}. ${station?.name ?? ""}`}
                  {station?.boxing && " 🥊"}
                </DrawerTitle>
                <DrawerDescription className="text-label font-bold text-primary">
                  {isRun ? "매 라운드 시작 · 모두 8번 · 스타터도 같아요" : station ? counts(station) : ""}
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
                {isRun ? (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl">
                    <RunPicture big />
                  </div>
                ) : (
                  station?.video && (
                    <MoveVideo key={station.video.src} src={station.video.src} poster={station.video.poster} name={station.name} />
                  )
                )}
                <p className="text-body leading-relaxed text-foreground">{isRun ? TEST153_RUN_GUIDE.howTo : station?.howTo}</p>
                <p className="text-label leading-relaxed text-muted-foreground">
                  <Badge tone="primary">인정</Badge>
                  {isRun ? TEST153_RUN_GUIDE.standard : station?.standard}
                </p>
                <p className="text-label leading-relaxed text-muted-foreground">
                  <Badge tone="amber">요령</Badge>
                  {isRun ? TEST153_RUN_GUIDE.tip : station?.tip}
                </p>
                <p className="rounded-xl bg-muted/40 px-3 py-2 text-label text-muted-foreground">
                  기준을 안 지키면 코치님이 <b className="text-foreground">“노렙”</b> — 그 한 번은 개수에 안 들어가요.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={prev === null}
                    onClick={() => prev !== null && onPick(prev)}
                    className="flex h-11 min-w-0 items-center gap-1 rounded-xl border border-border bg-card px-3 text-label font-bold text-foreground active:scale-[0.98] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span className="truncate">{prev !== null ? pickName(prev) : "처음"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={next === null}
                    onClick={() => next !== null && onPick(next)}
                    className="flex h-11 min-w-0 items-center justify-end gap-1 rounded-xl border border-primary/40 bg-card px-3 text-label font-bold text-primary active:scale-[0.98] disabled:opacity-40"
                  >
                    <span className="truncate">{next !== null ? pickName(next) : "마지막 종목"}</span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default Test153MoveRail;
