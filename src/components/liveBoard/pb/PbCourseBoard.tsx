/**
 * 📺 153 PB 라이브보드 TV1 「코스 보드」 — /tv/:지점/pb1 (2026-11-08 대표님 「다음진행 추천대로」)
 *   멀리서 3초 안에: 지금 몇 분 · 무엇을 몇 개.
 *   ① 큰 타이머(경과 · 25:00 캡까지 · 22:00 레드 타이틀까지) ② 오늘 끝낼 것(410개 + 셀트런 800m · 스타터 205개)
 *   ③ 16구간 레일(측정 중인 사람 위치 = 번호) ④ 8분할 시범(영상 1개 — public/test153/pb-grid.mp4) ⑤ 종목 카드
 *   ⑥ 지금 그 종목 표시 ⑦ 완주 · 개인 최고 축하 10초.
 *   타이머는 코치 측정 화면 신호를 따른다. 신호가 없을 때 TV 리모컨: OK/Enter/스페이스 = 단체 타이머 시작·멈춤, ←/Backspace = 멈춘 타이머 지우기.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { TEST153_CAP_MS, TEST153_STATIONS, stationReps, type Test153Division } from "@/lib/test153";
import {
  PB_GRID,
  PB_RUN_TOTAL_M,
  PB_SEGMENT_COUNT,
  PB_TITLE_MS,
  pbCellPos,
  pbClock,
  pbDelta,
  pbPrimaryRun,
  pbRunElapsed,
  pbRunPhase,
  pbRunSeg,
  pbSegLabel,
  pbTotalReps,
  type PbLiveRun,
} from "@/lib/pbBoard";

/** TV 카드 한 줄 기준 (28px · 칸 폭 448px 안) — 종목을 바꾸면 같이 고친다. 정식 기준은 test153.ts standard */
const TV_STD = [
  "가슴 바닥 → 원투",
  "1·2·3스텝 → 복귀",
  "엉덩이 무릎 아래",
  "가슴 매트 → 팔 펴기",
  "원투 + 좌우 3스텝",
  "등 매트 → 원투",
  "뒷무릎 매트 터치",
  "카운터 숫자 채우기",
];
const tvStd = (i: number) => TV_STD[i] ?? TEST153_STATIONS[i]?.standard.split(/[(,]/)[0].slice(0, 12) ?? "";
const tvName = (i: number) => TEST153_STATIONS[i].name.replace(/·/g, "");

/** 레일 칸 폭 (1856px = 셀트런 8 × 48 + 종목 8 + 사이 15 × 6) */
const RUN_W = 48;
const GAP_W = 6;
const ST_W = (PB_GRID.w - 8 * RUN_W - 15 * GAP_W) / 8;
const segCenter = (i: number) => {
  const runsBefore = Math.floor((i + 1) / 2);
  const stBefore = Math.floor(i / 2);
  const left = runsBefore * RUN_W + stBefore * ST_W + i * GAP_W;
  return left + (i % 2 === 0 ? RUN_W : ST_W) / 2;
};

interface Overlay {
  key: string;
  kind: "finish" | "pb" | "cap";
  run: PbLiveRun;
  until: number;
}

interface Props {
  branchLabel: string;
  runs: PbLiveRun[];
  now: number;
  lite: boolean;
}

const PbCourseBoard = ({ branchLabel, runs, now, lite }: Props) => {
  // ── 단체 타이머 (신호가 없을 때만 · TV 리모컨) ──
  const [local, setLocal] = useState<{ start: number | null; acc: number }>({ start: null, acc: 0 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "MediaPlayPause") {
        e.preventDefault();
        setLocal((l) => (l.start == null ? { start: Date.now(), acc: l.acc } : { start: null, acc: l.acc + Date.now() - l.start }));
      } else if (e.key === "Backspace" || e.key === "ArrowLeft" || e.key === "Escape") {
        setLocal((l) => (l.start == null ? { start: null, acc: 0 } : l));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const localElapsed = Math.min(TEST153_CAP_MS, local.acc + (local.start != null ? now - local.start : 0));
  const localOn = local.start != null || local.acc > 0;

  const primary = pbPrimaryRun(runs);
  const live = runs.length > 0;
  const division: Test153Division = primary?.division ?? "open";
  const elapsed = primary ? pbRunElapsed(primary, now) : localOn ? localElapsed : null;
  const showTitle = division === "open";

  // ── 레일 · 칸 상태 ──
  const segs = runs.map((r) => ({ r, seg: pbRunSeg(r) }));
  const minSeg = segs.length ? Math.min(...segs.map((s) => s.seg)) : -1;

  // ── 완주 · 개인 최고 · 캡 축하 (측정마다 한 번씩) ──
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const shown = useRef<Set<string>>(new Set());
  useEffect(() => {
    const t = Date.now();
    for (const r of runs) {
      const ph = pbRunPhase(r);
      const endTv = (ph === "finished" ? r.marks[PB_SEGMENT_COUNT - 1] : (r.stoppedAt ?? r.startAt)) + r.offset;
      const fresh = t - endTv < 3 * 60_000;
      const pick = (kind: Overlay["kind"], ms: number) => {
        const key = `${r.id}:${kind}`;
        if (shown.current.has(key)) return false;
        shown.current.add(key);
        if (!fresh) return false;
        setOverlay({ key, kind, run: r, until: t + ms });
        return true;
      };
      if (r.pb?.isPb && pick("pb", 10_000)) break;
      if (ph === "finished" && pick("finish", 10_000)) break;
      if (ph === "capped" && pick("cap", 6_000)) break;
    }
  }, [runs]);
  useEffect(() => {
    if (!overlay) return;
    const ms = overlay.until - Date.now();
    const t = window.setTimeout(() => setOverlay(null), Math.max(0, ms));
    return () => window.clearTimeout(t);
  }, [overlay]);

  const [videoBroken, setVideoBroken] = useState(false);

  const pill = live ? `측정 ${runs.length}명` : localOn ? "단체 타이머" : "코스 안내";
  const capLeft = elapsed == null ? TEST153_CAP_MS : TEST153_CAP_MS - elapsed;
  const titleLeft = elapsed == null ? PB_TITLE_MS : PB_TITLE_MS - elapsed;
  const over = showTitle && elapsed != null && elapsed > PB_TITLE_MS;

  const stations = useMemo(
    () => TEST153_STATIONS.map((s, i) => ({ i, open: s.open, starter: stationReps(s, "starter"), unit: s.unit })),
    [],
  );

  return (
    <div className="pbx">
      <header className="pbx-h1">
        <div className="pbx-box pbx-brand">
          <div className="pbx-kicker">
            {branchLabel}
            <span className={`pbx-pill${live ? " mint" : ""}`}>{pill}</span>
          </div>
          <div className="pbx-word">153 PB</div>
          <div className="pbx-tag">내 최고 기록 · 상대는 지난번의 나</div>
        </div>
        <div className="pbx-box pbx-todo">
          <div className="pbx-kicker">오늘 끝낼 것 · 8라운드</div>
          <div className="pbx-todo-main">
            <b className="num">{pbTotalReps(division)}</b>
            <span className="u">개</span>
            <em>+ 셀트런 {PB_RUN_TOTAL_M}m</em>
          </div>
          <div className="pbx-todo-sub">
            {division === "open" ? `스타터는 ${pbTotalReps("starter")}개 · 개수 절반` : `스타터 · 오픈은 ${pbTotalReps("open")}개`}
          </div>
        </div>
        <div className="pbx-box pbx-timer">
          <div className={`pbx-digits num${elapsed == null ? " idle" : over ? " over" : ""}`}>
            {pbClock(elapsed ?? TEST153_CAP_MS)}
          </div>
          <div className="pbx-side">
            <div className="pbx-trow">
              <span>{elapsed == null ? "타임캡" : "25:00 캡까지"}</span>
              <b className="num">{pbClock(capLeft)}</b>
            </div>
            {showTitle ? (
              <div className="pbx-trow title">
                <span>{elapsed == null ? "레드 타이틀" : over ? "22:00 타이틀" : "22:00 타이틀까지"}</span>
                <b className="num">{over ? "지남" : pbClock(titleLeft)}</b>
              </div>
            ) : (
              <div className="pbx-trow">
                <span>지금</span>
                <b>{primary ? pbSegLabel(pbRunSeg(primary), division) : "—"}</b>
              </div>
            )}
          </div>
          <div className="pbx-bar">
            <i style={{ width: `${((elapsed ?? 0) / TEST153_CAP_MS) * 100}%` }} />
            {showTitle && <u style={{ left: `${(PB_TITLE_MS / TEST153_CAP_MS) * 100}%` }} />}
          </div>
        </div>
      </header>

      <div className="pbx-rail">
        <div className="pbx-segs">
          {Array.from({ length: PB_SEGMENT_COUNT }, (_, i) => {
            const run = i % 2 === 0;
            const on = segs.some((s) => s.seg === i);
            const done = live && i < minSeg;
            const st = (i - 1) / 2;
            return (
              <div key={i} className={`pbx-seg ${run ? "run" : "st"}${done ? " done" : ""}${on ? " on" : ""}`}>
                {run ? "런" : (
                  <>
                    <span className="n">{st + 1}</span>
                    {TEST153_STATIONS[st].mapName}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {segs.map(({ r, seg }) => {
          if (seg >= PB_SEGMENT_COUNT) return null;
          const same = segs.filter((s) => s.seg === seg);
          const k = same.findIndex((s) => s.r.id === r.id);
          const shift = (k - (same.length - 1) / 2) * 44;
          return (
            <div key={r.id} className="pbx-mk" style={{ left: segCenter(seg) - 20 + shift }}>
              {r.slot}
            </div>
          );
        })}
      </div>

      <div className="pbx-grid" style={{ left: PB_GRID.x, top: PB_GRID.y, width: PB_GRID.w, height: PB_GRID.h }}>
        {lite || videoBroken ? (
          <img className="poster" src="/test153/pb-grid.jpg" alt="" />
        ) : (
          <video
            src="/test153/pb-grid.mp4"
            poster="/test153/pb-grid.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={() => setVideoBroken(true)}
          />
        )}
        {stations.map(({ i, open, starter, unit }) => {
          const pos = pbCellPos(i);
          const stSeg = i * 2 + 1;
          const here = segs.filter((s) => s.seg === stSeg).map((s) => s.r.slot);
          const done = live && minSeg > stSeg;
          const on = here.length > 0;
          return (
            <div
              key={i}
              className={`pbx-cell${on ? " on" : ""}`}
              style={{ left: pos.left, top: pos.top, width: PB_GRID.cellW, height: PB_GRID.cellH }}
            >
              {done && <div className="pbx-dim" style={{ height: PB_GRID.videoH }} />}
              {on && (
                <div className="pbx-vchip" style={{ top: PB_GRID.videoH - 58 }}>
                  {runs.length === 1 ? "지금 측정 중" : `지금 · ${here.join(" · ")}번`}
                </div>
              )}
              {!on && done && (
                <div className="pbx-vchip ok" style={{ top: PB_GRID.videoH - 60 }}>
                  ✓ 모두 통과
                </div>
              )}
              <div className="pbx-info" style={{ height: PB_GRID.cellH - PB_GRID.border * 2 - PB_GRID.videoH }}>
                <div className="pbx-r1">
                  <div className="pbx-badge">{i + 1}</div>
                  <div className="pbx-name">{tvName(i)}</div>
                  <div className="pbx-reps num">
                    <b>{open}</b>
                    <span>{unit}</span>
                  </div>
                </div>
                <div className="pbx-r2">
                  <div className="pbx-std">{tvStd(i)}</div>
                  <div className="pbx-stt">스타터 {starter}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {overlay && <FinishOverlay o={overlay} />}
    </div>
  );
};

const FinishOverlay = ({ o }: { o: Overlay }) => {
  const r = o.run;
  const score = o.kind === "cap" ? TEST153_CAP_MS : r.pb?.scoreMs ?? r.marks[PB_SEGMENT_COUNT - 1] - r.startAt;
  const passTitle = r.division === "open" && o.kind !== "cap" && score <= PB_TITLE_MS;
  const head = o.kind === "pb" ? "개인 최고 기록!" : o.kind === "finish" ? "완주!" : "25:00 타임캡";
  return (
    <div className="pbx-ovl pbx-fade">
      <div className={`pbx-ovc${o.kind === "pb" ? "" : " plain"}`}>
        <div className="pbx-ovk">{head}</div>
        <div className="pbx-ovn">
          {r.division === "open" ? "오픈" : "스타터"} · 측정 {r.slot}번
        </div>
        <div className="pbx-ovt num">
          {pbClock(score)}
          <span>{o.kind === "cap" ? "끝까지" : "완주"}</span>
        </div>
        <div className="pbx-ovs">
          {o.kind === "pb" && r.pb?.prevMs != null && <div className="g">지난번보다 {pbDelta(r.pb.prevMs - score)}</div>}
          {passTitle && <div className="r">레드 타이틀 22:00 통과</div>}
          {o.kind === "finish" && <div>코치님이 저장하면 순위에 올라요</div>}
          {o.kind === "cap" && <div>남은 개수는 코치님께</div>}
        </div>
        <div className="pbx-ovf">잠시 뒤 레이스 화면으로 돌아가요</div>
      </div>
    </div>
  );
};

export default PbCourseBoard;
