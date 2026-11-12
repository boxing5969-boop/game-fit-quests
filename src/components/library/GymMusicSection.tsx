/**
 * 153플레이 「음악」 탭 — 운동 음악 모음집(한 편 30분 이상) + 체육관 자동재생 (2026-11-11 · 11-12 대표님)
 *
 *   · 곡 목록은 src/data/gymMusic.ts 한 곳 — DB(boxing_programs)에 넣지 않아 라이브러리 · AI 수업 영상과 섞이지 않는다.
 *   · 카테고리는 여러 개 고를 수 있다(아무것도 안 고르면 전체). 고른 것 · 빼 둔 곡 · 볼륨은 이 기기에만 기억한다.
 *   · 곡을 누르면 그 곡부터, '자동재생'을 누르면 섞어서 — 둘 다 끝없이 이어서 튼다(GymMusicPlayer).
 *   · 바로 여는 주소: /library?tab=music&play=1 (체육관 기기 즐겨찾기 · 처음 한 번은 화면을 눌러야 소리가 난다)
 */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GYM_MUSIC, GYM_MUSIC_CATS, gymMixLength, type GymMusicCat } from "@/data/gymMusic";
import GymMusicPlayer from "./GymMusicPlayer";

const HIDDEN_KEY = "153play_music_hidden";
const CATS_KEY = "153play_music_cats";
const CAT_KEYS = new Set<string>(GYM_MUSIC_CATS.map((c) => c.key));

const readJson = <T,>(k: string, fallback: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "null");
    return v ?? fallback;
  } catch { return fallback; }
};
const writeJson = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 실패는 무시 (시크릿 창 등) */ }
};
const cleanCats = (v: unknown): GymMusicCat[] =>
  Array.isArray(v) ? (v.filter((x) => typeof x === "string" && CAT_KEYS.has(x)) as GymMusicCat[]) : [];

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const CSS = `
.p153 .gm{padding:4px 16px 28px}
.p153 .gmStart{width:100%;max-width:560px;display:flex;align-items:center;gap:14px;border:1px solid var(--mint);border-radius:14px;
  background:var(--card);color:var(--txt);padding:14px 16px;cursor:pointer;text-align:left;font-family:inherit}
.p153 .gmStart .ic{width:52px;height:52px;border-radius:50%;background:var(--mint);color:#04211E;display:flex;
  align-items:center;justify-content:center;flex:none}
.p153 .gmStart .lb{display:block;min-width:0}
.p153 .gmStart b{display:block;font-size:1.1875rem;font-weight:900;color:var(--txt)}
.p153 .gmStart .sm{display:block;font-size:.875rem;color:var(--sub);margin-top:3px}
.p153 .gmBar{display:flex;align-items:center;gap:6px;margin:14px -16px 0;padding:0 16px;overflow-x:auto;scrollbar-width:none}
.p153 .gmBar::-webkit-scrollbar{display:none}
.p153 .gmBar button{flex:none;border:1px solid var(--line);background:var(--card);color:var(--sub);border-radius:999px;
  padding:8px 13px;font-size:.875rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap}
.p153 .gmBar button.on{background:var(--mint);border-color:var(--mint);color:#04211E}
.p153 .gmBar .q{width:36px;padding:8px 0;text-align:center}
.p153 .gmHelp{margin-top:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.p153 .gmHelp h4{font-size:1rem;font-weight:900;margin-bottom:8px}
.p153 .gmHelp ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.p153 .gmHelp li{font-size:.875rem;line-height:1.6;color:var(--ink2)}
.p153 .gmHelp b{color:var(--txt)}
.p153 .gmCat{margin-top:22px}
.p153 .gmCat h3{font-size:1.1875rem;font-weight:900;letter-spacing:-.3px;display:flex;align-items:baseline;gap:8px}
.p153 .gmCat h3 span{font-size:.875rem;color:var(--dim);font-weight:700}
.p153 .gmCat .sub{font-size:.875rem;color:var(--sub);margin:3px 0 6px}
.p153 .gmList{display:grid;grid-template-columns:1fr;column-gap:20px}
.p153 .gmRow{display:flex;align-items:center;gap:12px;width:100%;min-width:0;background:none;border:none;
  border-bottom:1px solid var(--line);color:var(--txt);padding:9px 0;cursor:pointer;text-align:left;font-family:inherit}
.p153 .gmRow img{width:96px;height:54px;border-radius:6px;object-fit:cover;flex:none;background:#000}
.p153 .gmRow .tx{min-width:0;flex:1}
.p153 .gmRow .t1{font-size:1rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p153 .gmRow .t2{font-size:.875rem;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.p153 .gmRow .go{flex:none;color:var(--mint)}
.p153 .gmRow .back{flex:none;border:1px solid var(--line);background:var(--card);color:var(--txt);border-radius:8px;
  padding:8px 11px;font-size:.875rem;font-weight:800;cursor:pointer;font-family:inherit}
.p153 .gmHid{margin-top:26px}
.p153 .gmHid > button{background:none;border:none;color:var(--sub);font-size:.875rem;font-weight:800;cursor:pointer;
  padding:6px 0;font-family:inherit}
@media (min-width:768px){ .p153 .gmList{grid-template-columns:1fr 1fr} }
@media (min-width:1200px){ .p153 .gmList{grid-template-columns:1fr 1fr 1fr} }
`;

const PlayIco = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </svg>
);

const GymMusicSection = () => {
  const [params] = useSearchParams();
  const [cats, setCats] = useState<GymMusicCat[]>(() => {
    const fromUrl = cleanCats((params.get("cats") ?? "").split(",").filter(Boolean));
    return fromUrl.length ? fromUrl : cleanCats(readJson(CATS_KEY, []));
  });
  const [hidden, setHidden] = useState<Record<string, true>>(() => readJson(HIDDEN_KEY, {}));
  const [player, setPlayer] = useState<{ startWith: string | null } | null>(
    () => (params.get("play") === "1" ? { startWith: null } : null),
  );
  const [help, setHelp] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const saveCats = useCallback((cs: GymMusicCat[]) => { setCats(cs); writeJson(CATS_KEY, cs); }, []);
  const toggleCat = (c: GymMusicCat | "all") => {
    if (c === "all") return saveCats([]);
    const next = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
    saveCats(next.length === GYM_MUSIC_CATS.length ? [] : next);
  };

  const hide = useCallback((id: string) => {
    setHidden((prev) => {
      const next = { ...prev, [id]: true as const };
      writeJson(HIDDEN_KEY, next);
      return next;
    });
  }, []);
  const unhide = (id: string) => {
    setHidden((prev) => {
      const next = { ...prev };
      delete next[id];
      writeJson(HIDDEN_KEY, next);
      return next;
    });
  };

  const shownCats = useMemo(
    () => GYM_MUSIC_CATS.filter((c) => cats.length === 0 || cats.includes(c.key)),
    [cats],
  );
  const playable = useMemo(
    () => GYM_MUSIC.filter((t) => !hidden[t.id] && (cats.length === 0 || cats.includes(t.c))),
    [cats, hidden],
  );
  const hiddenList = useMemo(() => GYM_MUSIC.filter((t) => hidden[t.id]), [hidden]);
  const countOf = (c: GymMusicCat) => GYM_MUSIC.filter((t) => t.c === c && !hidden[t.id]).length;

  return (
    <>
      <style>{CSS}</style>
      <div className="navPad" />
      <div className="catHead">
        <h1>복싱 음악</h1>
        <div className="cs">운동할 때 트는 모음집 {GYM_MUSIC.length}편 · 한 편 30분 이상</div>
      </div>
      <div className="gm">
        <button type="button" className="gmStart" disabled={!playable.length}
          onClick={() => setPlayer({ startWith: null })}>
          <span className="ic"><PlayIco size={26} /></span>
          <span className="lb">
            <b>자동재생</b>
            <span className="sm">{cats.length ? `고른 카테고리 ${playable.length}편` : `전체 ${playable.length}편`} · 섞어서 끝없이</span>
          </span>
        </button>

        <div className="gmBar">
          <button type="button" className={cats.length === 0 ? "on" : ""} onClick={() => toggleCat("all")}>전체</button>
          {GYM_MUSIC_CATS.map((c) => (
            <button type="button" key={c.key} className={cats.includes(c.key) ? "on" : ""} onClick={() => toggleCat(c.key)}>
              {c.label} {countOf(c.key)}
            </button>
          ))}
          <button type="button" className={`q${help ? " on" : ""}`} aria-label="끊김 없이 틀려면"
            onClick={() => setHelp((h) => !h)}>?</button>
        </div>

        {help && (
          <div className="gmHelp">
            <h4>체육관에서 끊김 없이 틀려면</h4>
            <ol>
              <li><b>광고 없이</b> — 이 기기 크롬에 유튜브 프리미엄 계정으로 로그인해 두세요(유튜브 쿠키 차단은 끄기). 광고는 유튜브가 붙이는 거라 앱에서 끌 수 없어요.</li>
              <li><b>처음 한 번만 화면을 누르면</b> 그다음부터는 끝없이 다음 모음집으로 넘어가요. 못 트는 영상은 알아서 건너뛰고, 멈추면 다시 틀어요.</li>
              <li><b>화면이 꺼지면 소리도 멈춰요</b> — 재생 중엔 화면을 켜 둔 채로 잡아 두니, 기기는 충전기에 꽂아 두세요.</li>
              <li><b>듣기 싫은 모음집</b>은 재생 화면의 '이 모음집 빼기' — 이 기기에서만 빠지고, 아래 '빼 둔 모음집'에서 다시 넣을 수 있어요.</li>
              <li><b>키즈 수업 때는</b> 「힙합」 칩을 빼고 트세요 — 랩 가사에 욕설이 섞일 수 있어요.</li>
              <li><b>바로 여는 주소</b> — myboxer153.com/library?tab=music&amp;play=1 을 즐겨찾기에 두세요.</li>
            </ol>
          </div>
        )}

        {shownCats.map((c) => {
          const list = GYM_MUSIC.filter((t) => t.c === c.key && !hidden[t.id]);
          if (!list.length) return null;
          return (
            <section className="gmCat" key={c.key}>
              <h3>{c.title} <span>{list.length}편</span></h3>
              <div className="sub">{c.sub}</div>
              <div className="gmList">
                {list.map((t) => (
                  <button type="button" className="gmRow" key={t.id} onClick={() => setPlayer({ startWith: t.id })}>
                    <img src={thumb(t.id)} alt="" loading="lazy" />
                    <span className="tx">
                      <span className="t1" style={{ display: "block" }}>{t.t}</span>
                      <span className="t2" style={{ display: "block" }}>{t.a} · {gymMixLength(t.m)}</span>
                    </span>
                    <span className="go"><PlayIco /></span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {hiddenList.length > 0 && (
          <div className="gmHid">
            <button type="button" onClick={() => setShowHidden((s) => !s)}>
              빼 둔 모음집 {hiddenList.length} {showHidden ? "접기" : "보기"}
            </button>
            {showHidden && (
              <div className="gmList">
                {hiddenList.map((t) => (
                  <div className="gmRow" key={t.id} style={{ cursor: "default" }}>
                    <img src={thumb(t.id)} alt="" loading="lazy" />
                    <span className="tx">
                      <span className="t1" style={{ display: "block" }}>{t.t}</span>
                      <span className="t2" style={{ display: "block" }}>{t.a}</span>
                    </span>
                    <button type="button" className="back" onClick={() => unhide(t.id)}>다시 넣기</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {player && (
        <GymMusicPlayer
          tracks={GYM_MUSIC}
          hidden={hidden}
          initialCats={cats}
          startWith={player.startWith}
          onCatsChange={saveCats}
          onHide={hide}
          onClose={() => setPlayer(null)}
        />
      )}
    </>
  );
};

export default GymMusicSection;
