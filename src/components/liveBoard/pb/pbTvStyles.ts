/**
 * 📺 153 PB 라이브보드 화면 글씨 · 색 (2026-11-08) — TV 는 1920×1080 고정이라 px 로 짠다(TvFitFrame 이 줄여 맞춘다).
 *   화이트 기본(대표님 2026-09 「화면은 화이트톤」 · 11/08 「추천대로」) · 153-visual-output 검증 팔레트
 *   — 민트 · 골드는 칠하는 색과 글자 색을 나눈다(흰 바닥에서 민트 글자는 대비 부족).
 *   글자 28px 이상(라벨만 24px까지) · 전환은 페이드 0.5초만 · 무한 반복 애니메이션 · 블러 없음(10/26 TV 렉 규칙).
 */
export const PB_TV_CSS = `
.pbx{--bg:#F5F8F7;--panel:#FFFFFF;--panel2:#E9EEEC;--sunk:#EDF1F0;--ink:#11161A;--ink2:#5A666C;--ink3:#77838A;
  --line:#DCE3E1;--line2:#C3CDCA;--mint:#10B981;--mintInk:#07784F;--mintSoft:#D7F4E8;--gold:#EFC94C;--goldInk:#8A6510;
  --goldSoft:#FBF1CF;--red:#C8461F;--warnInk:#A8461F;
  width:1920px;height:1080px;position:relative;overflow:hidden;background:var(--bg);color:var(--ink);
  font-family:"Pretendard Variable",Pretendard,"Noto Sans KR","Noto Sans CJK KR",sans-serif;
  padding:24px 32px;display:flex;flex-direction:column;gap:16px;box-sizing:border-box;cursor:none;user-select:none}
.pbx *{box-sizing:border-box}
.pbx .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.pbx-box{background:var(--panel);border:2px solid var(--line);border-radius:24px;box-shadow:0 1px 2px rgba(17,22,26,.05)}
.pbx-kicker{font-size:26px;font-weight:700;color:var(--ink2);line-height:1.2;display:flex;align-items:center;gap:14px;white-space:nowrap}
.pbx-pill{font-size:26px;font-weight:700;line-height:1;padding:8px 14px;border-radius:999px;background:var(--ink);color:#fff;white-space:nowrap}
.pbx-pill.mint{background:var(--mintInk)}
.pbx-fade{animation:pbxFade .5s ease-out both}
@keyframes pbxFade{from{opacity:0}to{opacity:1}}

/* TV1 머리 */
.pbx-h1{height:176px;display:grid;grid-template-columns:460px 526px 1fr;gap:24px;flex:0 0 auto}
.pbx-brand{padding:14px 26px;display:flex;flex-direction:column;justify-content:center;gap:6px}
.pbx-word{font-size:78px;font-weight:900;letter-spacing:-1px;line-height:1;white-space:nowrap}
.pbx-tag{font-size:28px;font-weight:500;color:var(--ink2);line-height:1.25;white-space:nowrap}
.pbx-todo{padding:14px 28px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.pbx-todo-main{display:flex;align-items:baseline;gap:10px;line-height:1;white-space:nowrap}
.pbx-todo-main b{font-size:92px;font-weight:900;letter-spacing:-2px}
.pbx-todo-main .u{font-size:40px;font-weight:900}
.pbx-todo-main em{font-style:normal;font-size:34px;font-weight:700;margin-left:6px}
.pbx-todo-sub{font-size:28px;font-weight:500;color:var(--ink2);line-height:1.3;white-space:nowrap}
.pbx-timer{padding:16px 28px 18px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:1fr auto;column-gap:26px;row-gap:8px;align-items:center}
.pbx-digits{font-size:140px;font-weight:900;line-height:.86;letter-spacing:-3px}
.pbx-digits.idle{color:var(--ink3)}
.pbx-digits.over{color:var(--red)}
.pbx-side{display:flex;flex-direction:column;gap:6px;min-width:0}
.pbx-trow{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.pbx-trow span{font-size:26px;font-weight:700;color:var(--ink2);white-space:nowrap}
.pbx-trow b{font-size:42px;font-weight:900;line-height:1;white-space:nowrap}
.pbx-trow.title b{color:var(--red)}
.pbx-bar{grid-column:1 / span 2;height:14px;border-radius:7px;background:var(--panel2);position:relative}
.pbx-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:7px;background:var(--mint)}
.pbx-bar u{position:absolute;top:-6px;bottom:-6px;width:5px;border-radius:3px;background:var(--red)}

/* 16구간 레일 */
.pbx-rail{height:90px;position:relative;flex:0 0 auto}
.pbx-segs{position:absolute;left:0;right:0;bottom:0;height:50px;display:flex;gap:6px}
.pbx-seg{height:50px;border-radius:12px;background:var(--panel2);color:var(--ink2);font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center;white-space:nowrap;border:2px solid transparent}
.pbx-seg.run{width:48px;flex:0 0 48px}
.pbx-seg.st{flex:1 1 0;min-width:0}
.pbx-seg.done{background:var(--mintSoft);color:var(--mintInk)}
.pbx-seg.on{background:var(--panel);color:var(--ink);border:3px solid var(--mint)}
.pbx-seg .n{font-weight:900;margin-right:8px}
.pbx-mk{position:absolute;top:0;width:40px;height:40px;border-radius:50%;background:var(--mk,var(--ink));color:#fff;font-size:24px;font-weight:900;display:grid;place-items:center}
.pbx-mk::after{content:"";position:absolute;bottom:-6px;left:50%;margin-left:-6px;border:6px solid transparent;border-top-color:var(--mk,var(--ink));border-bottom:0}

/* 8분할 — 영상 1개 + 카드 겹치기 */
.pbx-grid{position:absolute}
.pbx-grid video,.pbx-grid img.poster{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;display:block}
.pbx-cell{position:absolute;border:2px solid var(--line);border-radius:22px;overflow:hidden}
.pbx-cell.on{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint)}
.pbx-dim{position:absolute;left:0;right:0;top:0;background:rgba(245,248,247,.58)}
.pbx-vchip{position:absolute;left:12px;font-size:28px;font-weight:700;line-height:1;padding:10px 16px;border-radius:14px;background:var(--ink);color:#fff;white-space:nowrap}
.pbx-vchip.ok{background:var(--panel);color:var(--mintInk);border:2px solid var(--mint)}
.pbx-info{position:absolute;left:0;right:0;bottom:0;background:var(--panel);padding:10px 18px 14px;display:flex;flex-direction:column;gap:4px}
.pbx-r1{display:flex;align-items:center;gap:10px}
.pbx-badge{flex:0 0 46px;height:46px;border-radius:13px;background:var(--ink);color:#fff;font-size:30px;font-weight:900;display:grid;place-items:center}
.pbx-cell.on .pbx-badge{background:var(--mint);color:#062A1E}
.pbx-name{font-size:36px;font-weight:900;letter-spacing:-.5px;white-space:nowrap;flex:1;min-width:0;overflow:hidden}
.pbx-reps{white-space:nowrap;line-height:1}
.pbx-reps b{font-size:54px;font-weight:900;letter-spacing:-1px}
.pbx-reps span{font-size:26px;font-weight:900;margin-left:2px}
.pbx-r2{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.pbx-std{font-size:28px;font-weight:500;white-space:nowrap;overflow:hidden;min-width:0}
.pbx-stt{font-size:26px;font-weight:700;color:var(--ink2);white-space:nowrap}

/* 완주 축하 */
.pbx-ovl{position:absolute;inset:0;background:rgba(245,248,247,.95);display:flex;align-items:center;justify-content:center;z-index:5}
.pbx-ovc{width:1560px;border-radius:40px;background:var(--panel);border:6px solid var(--gold);padding:56px 70px;text-align:center;box-shadow:0 30px 80px rgba(17,22,26,.18)}
.pbx-ovc.plain{border-color:var(--mint)}
.pbx-ovk{display:inline-block;font-size:40px;font-weight:900;background:var(--gold);color:#3D2C00;padding:12px 30px;border-radius:999px}
.pbx-ovc.plain .pbx-ovk{background:var(--mintSoft);color:var(--mintInk)}
.pbx-ovn{font-size:64px;font-weight:900;margin-top:22px;color:var(--ink2)}
.pbx-ovt{font-size:220px;font-weight:900;letter-spacing:-5px;line-height:1;margin-top:10px}
.pbx-ovt span{font-size:72px;letter-spacing:0;margin-left:16px}
.pbx-ovs{display:flex;justify-content:center;gap:24px;margin-top:30px;flex-wrap:wrap}
.pbx-ovs div{white-space:nowrap;font-size:40px;font-weight:900;padding:16px 26px;border-radius:24px;background:var(--sunk)}
.pbx-ovs .g{color:var(--mintInk);background:var(--mintSoft)}
.pbx-ovs .r{color:var(--red)}
.pbx-ovf{margin-top:26px;font-size:32px;font-weight:700;color:var(--ink2)}

/* TV2 */
.pbx-h2{height:100px;display:flex;align-items:center;justify-content:space-between;padding:0 6px;flex:0 0 auto}
.pbx-wm2{font-size:68px;font-weight:900;letter-spacing:-1px;line-height:1;white-space:nowrap}
.pbx-h2l{display:flex;align-items:baseline;gap:20px}
.pbx-live{display:flex;align-items:center;gap:14px;font-size:32px;font-weight:700;white-space:nowrap}
.pbx-dot{width:18px;height:18px;border-radius:50%;background:var(--line2)}
.pbx-dot.on{background:var(--mint);box-shadow:0 0 0 6px var(--mintSoft)}
.pbx-clock{font-size:32px;font-weight:700;color:var(--ink2);white-space:nowrap}
.pbx-clock b{color:var(--ink);font-size:40px;font-weight:900;margin-left:8px}
.pbx-cols{flex:1;display:grid;grid-template-columns:770px 600px 1fr;gap:20px;min-height:0}
.pbx-panel{background:var(--panel);border:2px solid var(--line);border-radius:24px;box-shadow:0 1px 2px rgba(17,22,26,.05);padding:18px 24px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.pbx-ph{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:12px}
.pbx-ph h3{font-size:40px;font-weight:900;letter-spacing:-.5px;line-height:1.1;margin:0;white-space:nowrap}
.pbx-ph .s{font-size:26px;font-weight:700;color:var(--ink2);white-space:nowrap}
.pbx-lane{border:2px solid var(--line);border-left-width:8px;border-radius:18px;padding:10px 16px;display:grid;grid-template-columns:54px 1fr;column-gap:12px;margin-bottom:8px;background:var(--panel)}
.pbx-lane.lead{border-left-color:var(--mint)}
.pbx-lane .pos{font-size:48px;font-weight:900;line-height:1;align-self:center;text-align:center}
.pbx-lr1{display:flex;align-items:center;gap:10px;min-width:0}
.pbx-lname{font-size:36px;font-weight:900;line-height:1.1;white-space:nowrap}
.pbx-chip{font-size:24px;font-weight:700;line-height:1;padding:7px 11px;border-radius:999px;background:var(--panel2);color:var(--ink2);white-space:nowrap;display:inline-flex;align-items:center;gap:7px}
.pbx-chip.gold{background:var(--gold);color:#3D2C00}
.pbx-lnow{margin-left:auto;font-size:28px;font-weight:700;white-space:nowrap}
.pbx-mini{display:flex;gap:3px;margin:8px 0 6px;height:18px}
.pbx-mini b{flex:1;border-radius:4px;background:var(--panel2)}
.pbx-mini b.r{flex:.42}
.pbx-mini b.f{background:var(--mint)}
.pbx-mini b.c{background:var(--mint);opacity:.45}
.pbx-mini b.g{outline:4px solid var(--gold);outline-offset:1px}
.pbx-lane .pos{color:var(--ln,var(--ink))}
.pbx-lane.lane{border-left-color:var(--ln,var(--line))}
.pbx-lname{overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:300px}
.pbx-lg{width:16px;height:16px;border-radius:50%;flex:0 0 16px}
.pbx-chip.mint{background:var(--mintSoft);color:var(--mintInk)}
.pbx-ghost{font-size:28px;font-weight:900;white-space:nowrap;color:var(--ink)}
.pbx-ghost.ahead{color:var(--mintInk)}
.pbx-lr3{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.pbx-lr3 .st{font-size:28px;font-weight:700;color:var(--ink2);white-space:nowrap}
.pbx-lr3 .st b{color:var(--ink);font-weight:900;font-size:34px}
.pbx-eta{font-size:28px;font-weight:500;color:var(--ink2);white-space:nowrap}
.pbx-eta b{font-size:32px;font-weight:900;color:var(--ink)}
.pbx-idle{display:flex;flex-direction:column;gap:12px}
.pbx-idle .big{font-size:34px;font-weight:900;line-height:1.3}
.pbx-idle .big em{font-style:normal;color:var(--mintInk)}
.pbx-course{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}
.pbx-course div{display:flex;align-items:baseline;gap:10px;font-size:28px;font-weight:700;white-space:nowrap;padding:8px 12px;border-radius:14px;background:var(--sunk)}
.pbx-course div i{font-style:normal;font-weight:900;color:var(--ink2);width:28px}
.pbx-course div b{margin-left:auto;font-weight:900}
.pbx-feed{margin-top:auto;border-top:2px solid var(--line);padding-top:10px}
.pbx-feed h4{font-size:26px;font-weight:900;color:var(--ink2);margin:0 0 4px}
.pbx-fi{display:flex;align-items:center;gap:12px;font-size:30px;font-weight:700;line-height:1.2;padding:4px 0;white-space:nowrap}
.pbx-fi .t{font-weight:900}
.pbx-fi .sub{font-size:24px;color:var(--ink2)}
.pbx-rk{display:grid;grid-template-columns:52px 1fr auto;align-items:center;height:54px;border-bottom:1px solid var(--line);column-gap:10px}
.pbx-rk .p{font-size:32px;font-weight:900;text-align:center}
.pbx-rk .nm{font-size:32px;font-weight:700;display:flex;align-items:center;gap:10px;white-space:nowrap;min-width:0;overflow:hidden}
.pbx-rk .nm small{font-size:24px;font-weight:700;color:var(--ink2)}
.pbx-rk .nm .nmt{overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
.pbx-rk .nm small{flex:0 0 auto}
.pbx-rk .nm small.tag{padding:4px 10px;border-radius:999px;background:var(--sunk);color:var(--ink2)}
.pbx-rk .lg{width:16px;height:16px;border-radius:50%;flex:0 0 16px}
.pbx-rk .tm{font-size:36px;font-weight:900}
.pbx-rk.g1{background:var(--goldSoft);border-radius:14px;border-bottom-color:transparent}
.pbx-rk.g1 .p{color:var(--goldInk)}
.pbx-rk.empty .nm{color:var(--ink3);font-weight:500}
.pbx-rk.empty .p{color:var(--ink3)}
.pbx-cut{display:flex;align-items:center;gap:12px;height:42px;font-size:24px;font-weight:900;color:var(--red);white-space:nowrap}
.pbx-cut::before,.pbx-cut::after{content:"";flex:1;border-top:3px dashed var(--red)}
.pbx-note{font-size:24px;font-weight:700;color:var(--ink3);margin-top:8px}
.pbx-dots{margin-top:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:10px}
.pbx-dots span{font-size:24px;font-weight:700;color:var(--ink3);padding:6px 12px;border-radius:999px;background:var(--sunk);white-space:nowrap}
.pbx-dots span.on{background:var(--ink);color:#fff}
.pbx-stack{display:flex;flex-direction:column;gap:16px;min-height:0}
.pbx-card{background:var(--panel);border:2px solid var(--line);border-radius:24px;padding:20px 22px;box-shadow:0 1px 2px rgba(17,22,26,.05)}
.pbx-card h3{font-size:32px;font-weight:900;line-height:1.15;margin:0 0 10px}
.pbx-card .sub{font-size:24px;font-weight:700;color:var(--ink2);margin:-6px 0 6px}
.pbx-cr{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line);gap:10px}
.pbx-cr:last-child{border-bottom:0}
.pbx-cr .a{font-size:30px;font-weight:700;white-space:nowrap;overflow:hidden}
.pbx-cr .a small{font-size:24px;color:var(--ink2);margin-left:8px}
.pbx-cr .b{font-size:34px;font-weight:900;color:var(--mintInk);white-space:nowrap}
.pbx-card.gold{border-color:var(--gold);background:var(--goldSoft)}
.pbx-card.gold h3{color:var(--goldInk)}
.pbx-rec{font-size:28px;font-weight:700;line-height:1.35;margin-top:6px}
.pbx-rec b{font-weight:900}
.pbx-rec.empty{color:var(--ink2)}
.pbx-qrw{display:flex;gap:18px;align-items:center}
.pbx-qrw .qr{width:170px;height:170px;border-radius:12px;background:#fff;padding:8px;border:2px solid var(--line);flex:0 0 170px}
.pbx-qrt{font-size:28px;font-weight:700;line-height:1.35}
.pbx-qrt b{font-size:32px;font-weight:900;display:block;margin-bottom:4px}
.pbx-qrt .nx{color:var(--ink2);font-size:26px;margin-top:6px;display:block}
.pbx-f2{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 6px;flex:0 0 auto}
.pbx-f2 b{font-size:28px;font-weight:900}
.pbx-f2 span{font-size:24px;font-weight:700;color:var(--ink3)}
.pbx-warn{font-size:28px;font-weight:700;color:var(--warnInk)}
`;
