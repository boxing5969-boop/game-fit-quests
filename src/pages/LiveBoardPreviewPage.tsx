/**
 * 라이브보드 미리보기 — 앱에서 TV 화면을 '그대로 줄여서' 보여 준다 (2026-09-29 대표님: 라이브보드 1·2·3·4 선택).
 *
 * 보드는 1920×1080 TV 에 맞춰 짜여 있어서 폰 크기로 그냥 열면 글자가 세로로 쪼개지는 등 모양이 무너진다.
 * 그래서 실제 TV 주소(/tv/{지점}/{번호})를 1920×1080 iframe 에 띄우고 화면에 맞게 축소한다 —
 * iframe 안의 vw·vh·창 크기가 TV 와 같아서 배치가 TV 와 똑같다. TV 보드 코드는 한 줄도 건드리지 않는다.
 * 위: 나가기 · 라이브보드 1·2·3·4 바로 바꾸기. 세로 화면이면 아래에 '가로로 돌리면 크게' 안내.
 * (사이니지 경로로 등록돼 있어 탭바·AI 버튼·튜토리얼이 뜨지 않고 어두운 화면으로 고정된다 — lib/displayMode)
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import SignageExitButton from "@/components/liveBoard/SignageExitButton";
import { TV_BRANCHES } from "@/lib/branchAlias";
import {
  LIVE_BOARD_NOS,
  LIVE_BOARD_PICKER_PATH,
  isLiveBoardNo,
  liveBoardPreviewPath,
  tvBoardPath,
} from "@/lib/liveBoards";

const STAGE_W = 1920;
const STAGE_H = 1080;
/** 세로 화면에서 위(버튼)·아래(안내) 로 비워 두는 높이 */
const PORTRAIT_TOP = 72;
const PORTRAIT_BOTTOM = 88;

const readViewport = () => ({ w: window.innerWidth, h: window.innerHeight });

const LiveBoardPreviewPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [vp, setVp] = useState(readViewport);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setVp(readViewport());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const branch = TV_BRANCHES.find((b) => b.code === params.get("b"));
  const no = Number(params.get("n"));
  if (!branch || !isLiveBoardNo(no)) return <Navigate to={LIVE_BOARD_PICKER_PATH} replace />;

  const src = tvBoardPath(branch.code, no);
  const portrait = vp.h > vp.w;
  const areaTop = portrait ? PORTRAIT_TOP : 0;
  const areaH = Math.max(1, vp.h - (portrait ? PORTRAIT_TOP + PORTRAIT_BOTTOM : 0));
  const scale = Math.min(vp.w / STAGE_W, areaH / STAGE_H);
  const stageW = STAGE_W * scale;
  const stageH = STAGE_H * scale;
  const left = (vp.w - stageW) / 2;
  const top = areaTop + (areaH - stageH) / 2;
  // 가로 화면에서 보드 양옆 여백이 넉넉하면 버튼을 여백으로 — 보드 머리글(로고·시계)을 가리지 않는다
  const side = !portrait && left >= 52;
  const gutterInset = (left - 44) / 2;

  const exit = () => {
    // 고르기 화면에서 들어왔으면 뒤로, 주소로 바로 들어왔으면 고르기 화면으로
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(LIVE_BOARD_PICKER_PATH, { replace: true });
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <div
        className="absolute overflow-hidden rounded-xl bg-gray-950 shadow-2xl ring-1 ring-white/10"
        style={{ left, top, width: stageW, height: stageH }}
      >
        <iframe
          key={src}
          src={src}
          title={`라이브보드 ${no} 미리보기 — ${branch.label}`}
          onLoad={() => setLoadedSrc(src)}
          allow="screen-wake-lock"
          className="block border-0"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
        {loadedSrc !== src && (
          <div className="absolute inset-0 grid place-items-center bg-gray-950 text-[13px] font-bold text-white/60">
            라이브보드 {no} 여는 중…
          </div>
        )}
      </div>

      <SignageExitButton onExit={exit} compact={side} style={side ? { left: gutterInset } : undefined} />

      {/* 1·2·3·4 바로 바꾸기 */}
      <div
        className={`fixed z-[100] flex gap-1 rounded-full bg-black/65 p-1 shadow-lg ring-1 ring-white/15 backdrop-blur-md ${side ? "flex-col" : ""}`}
        style={
          side
            ? { right: gutterInset, top: "50%", transform: "translateY(-50%)" }
            : { right: 12, top: "max(12px, env(safe-area-inset-top))" }
        }
        role="tablist"
        aria-label="라이브보드 번호"
      >
        {LIVE_BOARD_NOS.map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={n === no}
            aria-label={`라이브보드 ${n}`}
            onClick={() => n !== no && navigate(liveBoardPreviewPath(branch.code, n), { replace: true })}
            className={`h-9 w-9 rounded-full text-[15px] font-black tabular-nums transition-all active:scale-95 ${
              n === no ? "bg-white text-black" : "text-white/70"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {portrait && (
        <div
          className="absolute inset-x-0 px-6 text-center"
          style={{ top: top + stageH + 16 }}
        >
          <p className="text-[15px] font-bold text-white">
            라이브보드 {no} · {branch.label}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
            TV 화면을 그대로 줄여서 보여 드려요 · 가로로 돌리면 크게 보여요
          </p>
        </div>
      )}
    </div>
  );
};

export default LiveBoardPreviewPage;
