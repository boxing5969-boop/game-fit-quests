/**
 * 📺 153 PB 라이브보드 TV2 「기록 보드」 — /tv/:지점/pb2 (2026-11-08 대표님 「다음진행 추천대로」)
 *   끝까지 달리게 만드는 화면 — 상대는 지난번의 나.
 *   왼쪽: 지금 측정(코치 측정 화면 신호 · 이름 없이 번호로 — 이름 나오는 히트는 2단계) / 없으면 코스 안내 · 아래 오늘 기록
 *   가운데: 부문별 TOP 10 (기록 있는 부문만 10초마다 페이드) · 오픈은 22:00 레드 타이틀 통과선
 *   오른쪽: 이번 달 가장 많이 당긴 사람 · 153 레코드 · QR(앱 153 PB 탭)
 *   데이터: board_test153(지점, TV 열쇠) — 닉네임만 (supabase/migrations/20261108140609_board_test153.sql)
 */
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { TEST153_STATIONS, stationReps } from "@/lib/test153";
import {
  PB_LEAGUE,
  PB_RECORD_SLOTS,
  PB_RUN_TOTAL_M,
  PB_SEGMENT_COUNT,
  PB_TITLE_MS,
  pbClock,
  pbDelta,
  pbEtaMs,
  pbPrimaryRun,
  pbRankPages,
  pbRunElapsed,
  pbRunPhase,
  pbRunSeg,
  pbScore,
  pbSegLabel,
  pbTotalReps,
  type PbBoardData,
  type PbLiveRun,
  type PbRankRow,
} from "@/lib/pbBoard";

const PB_QR_URL = "https://myboxer153.com/halloffame?tab=test153";
const PAGE_MS = 10_000;

const kstClock = (now: number) => {
  const d = new Date(now);
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {});
  const hm = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date: `${day.month}.${day.day} ${day.weekday}`, time: hm };
};

interface Props {
  branchLabel: string;
  data: PbBoardData | null;
  runs: PbLiveRun[];
  now: number;
  keyRequired: boolean;
  demo: boolean;
}

const PbRecordBoard = ({ branchLabel, data, runs, now, keyRequired, demo }: Props) => {
  const pages = pbRankPages(data);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (pages.length < 2) return;
    const t = window.setInterval(() => setPage((p) => p + 1), PAGE_MS);
    return () => window.clearInterval(t);
  }, [pages.length]);
  const cur = pages[page % pages.length];
  const rows = data?.rank[cur.key] ?? [];

  const primary = pbPrimaryRun(runs);
  const liveCount = runs.filter((r) => pbRunPhase(r) === "running").length;
  const clock = kstClock(now);
  const sortedRuns = [...runs].sort((a, b) => pbRunSeg(b) - pbRunSeg(a) || a.startAt - b.startAt);

  return (
    <div className="pbx">
      <header className="pbx-h2">
        <div className="pbx-h2l">
          <div className="pbx-wm2">153 PB 기록</div>
          <div className="pbx-kicker">{branchLabel} · 전체 지점 순위</div>
        </div>
        <div className="pbx-live">
          <span className={`pbx-dot${liveCount ? " on" : ""}`} />
          {liveCount ? (
            <>
              측정 중 {liveCount}명
              {primary && <span className="num" style={{ fontWeight: 900, marginLeft: 6 }}>{pbClock(pbRunElapsed(primary, now))}</span>}
            </>
          ) : (
            "상대는 지난번의 나"
          )}
        </div>
        <div className="pbx-clock">
          {clock.date} <b className="num">{clock.time}</b>
        </div>
      </header>

      <main className="pbx-cols">
        {/* 왼쪽 — 지금 측정 / 코스 안내 + 오늘 기록 */}
        <section className="pbx-panel">
          {runs.length > 0 ? (
            <>
              <div className="pbx-ph">
                <h3>지금 측정</h3>
                <span className="s">번호 = 1번 TV 레일의 동그라미</span>
              </div>
              {sortedRuns.map((r, i) => (
                <LiveLane key={r.id} r={r} lead={i === 0 && sortedRuns.length > 1} now={now} />
              ))}
            </>
          ) : (
            <div className="pbx-idle">
              <div className="pbx-ph" style={{ marginBottom: 0 }}>
                <h3>153 PB 코스</h3>
                <span className="s">8라운드 · 셀트런 100m → 종목</span>
              </div>
              <div className="big">
                오픈 <em className="num">{pbTotalReps("open")}개</em> · 스타터 <em className="num">{pbTotalReps("starter")}개</em> + 셀트런 {PB_RUN_TOTAL_M}m
                <br />
                타임캡 25:00 · 레드 타이틀 22:00
              </div>
              <div className="pbx-course">
                {TEST153_STATIONS.map((s, i) => (
                  <div key={s.name}>
                    <i>{i + 1}</i>
                    {s.mapName}
                    <b className="num">
                      {s.open}
                      <span style={{ fontSize: 24, fontWeight: 700, color: "var(--ink2)" }}> / {stationReps(s, "starter")}</span>
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pbx-feed">
            <h4>오늘 기록</h4>
            {data?.recent.length ? (
              data.recent.slice(0, runs.length > 2 ? 1 : 2).map((f, i) => (
                <div key={`${f.at}-${i}`} className="pbx-fi">
                  <span>{f.name}</span>
                  {f.division === "starter" && <span className="sub">스타터</span>}
                  <span className="t num">{pbScore(f)}</span>
                  <span>{f.finished ? "완주" : ""}</span>
                  {f.first ? <span className="pbx-chip">첫 기록</span> : f.pb ? <span className="pbx-chip gold">개인 최고</span> : null}
                </div>
              ))
            ) : (
              <div className="pbx-fi" style={{ color: "var(--ink2)" }}>오늘 첫 기록의 주인공은?</div>
            )}
          </div>
        </section>

        {/* 가운데 — 부문별 TOP 10 */}
        <section className="pbx-panel">
          <div key={cur.key} className="pbx-fade" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div className="pbx-ph">
              <h3>TOP 10 · {cur.label}</h3>
              <span className="s">개인 최고 기록</span>
            </div>
            <RankList rows={rows} withCut={cur.division === "open"} homeBranch={branchLabel} />
            {rows.some((r) => r.staff) && <div className="pbx-note">코치님 · 운영진 기록은 순위에만 (153 레코드는 회원만)</div>}
          </div>
          <div className="pbx-dots">
            {pages.map((p, i) => (
              <span key={p.key} className={i === page % pages.length ? "on" : ""}>
                {p.label}
              </span>
            ))}
          </div>
        </section>

        {/* 오른쪽 */}
        <aside className="pbx-stack">
          <div className="pbx-card">
            <h3>이번 달 가장 많이 당긴 사람</h3>
            <div className="sub">개인 최고 기록을 줄인 시간</div>
            {data?.improved.length ? (
              data.improved.map((m, i) => (
                <div key={`${m.name}-${i}`} className="pbx-cr">
                  <span className="a">
                    {m.name}
                    <small>{m.division === "open" ? "오픈" : "스타터"}</small>
                  </span>
                  <span className="b num">{pbDelta(m.delta_ms)}</span>
                </div>
              ))
            ) : (
              <div className="pbx-rec empty">한 번 더 재면 줄인 시간이 여기에 올라요</div>
            )}
          </div>
          <div className="pbx-card gold">
            <h3>153 레코드</h3>
            {PB_RECORD_SLOTS.slice(0, 2).map((slot) => {
              const rec = data?.records.find((x) => x.key === slot.key);
              return (
                <div key={slot.key} className={`pbx-rec${rec ? "" : " empty"}`}>
                  {slot.label}
                  <br />
                  <b style={{ color: "var(--ink)" }}>
                    {rec ? `${rec.name}${rec.value ? ` ${pbClock(Number(rec.value))}` : ""}` : "첫 주인공을 기다려요"}
                  </b>
                </div>
              );
            })}
          </div>
          <div className="pbx-card">
            <div className="pbx-qrw">
              <div className="qr">
                <QRCodeSVG value={PB_QR_URL} size={150} level="M" marginSize={0} bgColor="#ffffff" fgColor="#11161A" />
              </div>
              <div className="pbx-qrt">
                <b>내 기록 보기</b>
                도전 신청도
                <br />
                여기서
                <span className="nx num">
                  지금까지 {data?.totals.records ?? 0}건 · {data?.totals.people ?? 0}명
                </span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="pbx-f2">
        <b>153 건강과 행복. 153복싱짐</b>
        {keyRequired ? (
          <span className="pbx-warn">TV 열쇠가 필요해요 — 관리자 앱 › 라이브보드의 열쇠 주소로 열어 주세요</span>
        ) : (
          <span>{demo ? "예시 화면 · 가상 데이터" : "기록은 코치님 측정 화면에서 공식 저장"}</span>
        )}
      </footer>
    </div>
  );
};

const LiveLane = ({ r, lead, now }: { r: PbLiveRun; lead: boolean; now: number }) => {
  const seg = pbRunSeg(r);
  const phase = pbRunPhase(r);
  // 끝나고 저장까지 했으면 공식 기록(저장 결과)을 그대로
  const el = phase === "finished" && r.pb ? r.pb.scoreMs : pbRunElapsed(r, now);
  const eta = pbEtaMs(r, now);
  const status =
    phase === "finished" ? "완주" : phase === "capped" ? "타임캡" : phase === "stopped" ? "멈춤" : pbSegLabel(seg, r.division);
  return (
    <div className={`pbx-lane${lead ? " lead" : ""}`}>
      <div className="pos num">{r.slot}</div>
      <div>
        <div className="pbx-lr1">
          <span className="pbx-lname">측정 {r.slot}번</span>
          <span className="pbx-chip">{r.division === "open" ? "오픈" : "스타터"}</span>
          {r.pb?.isPb && <span className="pbx-chip gold">개인 최고 {r.pb.prevMs != null ? pbDelta(r.pb.prevMs - r.pb.scoreMs) : ""}</span>}
          <span className="pbx-lnow">{status}</span>
        </div>
        <div className="pbx-mini">
          {Array.from({ length: PB_SEGMENT_COUNT }, (_, i) => (
            <b key={i} className={`${i % 2 === 0 ? "r " : ""}${i < seg ? "f" : i === seg ? "c" : ""}`} />
          ))}
        </div>
        <div className="pbx-lr3">
          <span className="st">
            경과 <b className="num">{pbClock(el)}</b>
            {r.division === "open" && phase === "running" && el <= PB_TITLE_MS && (
              <span style={{ marginLeft: 14 }}>22:00까지 {pbClock(PB_TITLE_MS - el)}</span>
            )}
          </span>
          {eta != null ? (
            <span className="pbx-eta">
              예상 완주 <b className="num">{pbClock(eta)}</b>
            </span>
          ) : phase === "finished" ? (
            <span className="pbx-eta">
              기록 <b className="num">{pbClock(el)}</b>
            </span>
          ) : (
            <span className="pbx-eta">{seg < 4 ? "예상은 4구간 뒤부터" : ""}</span>
          )}
        </div>
      </div>
    </div>
  );
};

/** '선릉역점' → '선릉' · '칠금점' → '칠금' */
const shortBranch = (b: string) => b.replace(/역?점$/, "");

const RankList = ({ rows, withCut, homeBranch }: { rows: PbRankRow[]; withCut: boolean; homeBranch: string }) => {
  const shown = rows.slice(0, 10);
  const passed = shown.filter((r) => r.finished && r.score_ms <= PB_TITLE_MS).length;
  const items: (PbRankRow | "cut" | { empty: number })[] = [];
  shown.forEach((r, i) => {
    if (withCut && i === passed) items.push("cut");
    items.push(r);
  });
  if (withCut && passed === shown.length && shown.length > 0) items.push("cut");
  // 빈 랭킹 대책 — 다음 자리 하나를 도전 문구로 (보고서 「빈 랭킹 대책」)
  if (shown.length < 10) items.push({ empty: shown.length + 1 });
  if (withCut && shown.length === 0) items.unshift("cut");
  return (
    <div>
      {items.map((it, i) => {
        if (it === "cut") {
          return (
            <div key={`cut-${i}`} className="pbx-cut">
              22:00 레드 타이틀 통과선{passed === 0 ? " · 아직 0명" : ""}
            </div>
          );
        }
        if ("empty" in it) {
          return (
            <div key={`e-${it.empty}`} className="pbx-rk empty">
              <span className="p num">{it.empty}</span>
              <span className="nm">{it.empty === 1 ? "첫 기록의 주인공은?" : "다음 주인공은?"}</span>
              <span className="tm" />
            </div>
          );
        }
        const lg = it.league ? PB_LEAGUE[it.league] : null;
        return (
          <div key={`${it.pos}-${it.name}`} className={`pbx-rk${it.pos === 1 ? " g1" : ""}`}>
            <span className="p num">{it.pos}</span>
            <span className="nm">
              {lg && <i className="lg" style={{ background: lg.color }} />}
              <span className="nmt">{it.name}</span>
              <small>
                {lg && !it.staff ? lg.label : ""}
                {it.branch && shortBranch(it.branch) !== shortBranch(homeBranch) ? `${lg && !it.staff ? " · " : ""}${shortBranch(it.branch)}` : ""}
              </small>
              {it.staff && <small className="tag">{it.staff}</small>}
            </span>
            <span className="tm num">{pbScore(it)}</span>
          </div>
        );
      })}
    </div>
  );
};

export default PbRecordBoard;
