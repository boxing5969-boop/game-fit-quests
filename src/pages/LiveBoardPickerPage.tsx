/**
 * 라이브보드 고르기 — 관리자가 앱 안에서 TV 화면 1·2·3·4 를 골라 바로 본다 (2026-09-29 대표님).
 *
 * "관리자 계정으로 앱에서 라이브보드를 누르면 안 열린다" — 입구(체크인 보드 관리 → 라이브 보드 열기)가
 * QR 체크인을 걷어낼 때(9/2) 경로째 빠져 404 였고, 버튼도 window.open 새 창이라 설치형 앱에선 열리지 않았다.
 * 이제 같은 창의 미리보기(LiveBoardPreviewPage — TV 화면을 그대로 줄여 보여 줌)로 열고 '나가기'로 돌아온다.
 *
 * 번호 = TV 주소 끝 번호 (lib/liveBoards) — TV 세팅 때 그대로 쓴다:
 *   1 지금 운동 중 · 2 런칭 이벤트 · 3 회원 안내 카드뉴스 · 4 전체 한 화면(번호 없는 원래 주소 /tv/{지점})
 * 전체관리자는 네 지점 모두, 지점 관리자·코치는 자기 지점(지점을 못 찾으면 전부)을 고른다.
 *
 * 2026-10-19 TV 열쇠 주소 — TV 가 회원 이름을 읽으려면 지점별 열쇠가 필요하다(회원 정보 잠그기).
 *   이 화면에서 그 지점 운영진에게만 열쇠가 붙은 TV 주소를 보여 준다(get_board_tv_key). 열쇠 주소로 처음 연 순간 지점이 잠긴다.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TV_BRANCHES } from "@/lib/branchAlias";
import { boardKeyUrl } from "@/lib/boardKey";
import { LIVE_BOARD_NOS, liveBoardPreviewPath, tvBoardPath, type LiveBoardNo } from "@/lib/liveBoards";

const STORE_KEY = "153liveboard:branch";
const DOMAIN = "myboxer153.com";

// ── 미니 화면 그림 (160×90) — 실제 보드 배치를 한눈에. 민트 = 운동 중, 골드 = 순위·명예 ──
const MINT = "#2FD6A8";
const GOLD = "#F5C542";
const CARD = "rgba(255,255,255,0.07)";
const EDGE = "rgba(255,255,255,0.10)";
const INK = "rgba(255,255,255,0.34)";
const INK2 = "rgba(255,255,255,0.15)";

const MemberTile = ({ x, y, w, h, fade }: { x: number; y: number; w: number; h: number; fade: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="5" fill={CARD} stroke={EDGE} />
    <circle cx={x + h / 2.6} cy={y + h / 2} r={h / 4.6} fill={MINT} opacity={fade} />
    <rect x={x + h * 0.72} y={y + h * 0.33} width={w * 0.36} height="3.5" rx="1.75" fill={INK} />
    <rect x={x + h * 0.72} y={y + h * 0.56} width={w * 0.24} height="3" rx="1.5" fill={INK2} />
  </g>
);

const ArtNow = () => (
  <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden="true">
    {[0, 1, 2].flatMap((c) =>
      [0, 1].map((r) => <MemberTile key={`${c}${r}`} x={10 + c * 50} y={16 + r * 36} w={40} h={30} fade={0.95 - (c + r) * 0.14} />),
    )}
    <circle cx="150" cy="8.5" r="2.6" fill={MINT} />
  </svg>
);

const ArtEvent = () => (
  <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden="true">
    <rect x="34" y="52" width="28" height="30" rx="3" fill="rgba(255,255,255,0.10)" />
    <rect x="66" y="38" width="28" height="44" rx="3" fill="rgba(245,197,66,0.20)" stroke="rgba(245,197,66,0.55)" />
    <rect x="98" y="60" width="28" height="22" rx="3" fill="rgba(255,255,255,0.08)" />
    <circle cx="48" cy="42" r="5.5" fill="#D1D5DB" />
    <circle cx="80" cy="28" r="6.5" fill={GOLD} />
    <circle cx="112" cy="50" r="5" fill="#D08A4E" />
    <path d="M73.5 19.5l-1-7 4 3 3.5-5 3.5 5 4-3-1 7z" fill={GOLD} />
  </svg>
);

const ArtGuide = () => (
  <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden="true">
    <rect x="18" y="20" width="20" height="48" rx="5" fill="rgba(255,255,255,0.06)" />
    <rect x="122" y="20" width="20" height="48" rx="5" fill="rgba(255,255,255,0.06)" />
    <rect x="46" y="10" width="68" height="64" rx="7" fill="#F4F1EA" />
    <rect x="53" y="17" width="54" height="24" rx="4" fill={MINT} opacity="0.55" />
    <rect x="53" y="47" width="42" height="4" rx="2" fill="#11161A" opacity="0.55" />
    <rect x="53" y="55" width="30" height="3.5" rx="1.75" fill="#11161A" opacity="0.28" />
    <rect x="53" y="62" width="36" height="3.5" rx="1.75" fill="#11161A" opacity="0.28" />
    {[70, 75, 80, 85, 90].map((cx) => (
      <circle key={cx} cx={cx} cy="82" r="1.8" fill={cx === 75 ? MINT : "rgba(255,255,255,0.28)"} />
    ))}
  </svg>
);

const ArtAll = () => (
  <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden="true">
    {[0, 1].flatMap((c) =>
      [0, 1].map((r) => <MemberTile key={`${c}${r}`} x={10 + c * 45} y={12 + r * 29} w={39} h={24} fade={0.95 - (c + r) * 0.16} />),
    )}
    <rect x="104" y="12" width="46" height="53" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" />
    {[20, 28, 36, 44, 52].map((y, i) => (
      <rect key={y} x="110" y={y} width={i === 0 ? 26 : 32 - (i % 2) * 8} height="3" rx="1.5" fill={i === 0 ? INK : INK2} />
    ))}
    <rect x="10" y="72" width="140" height="10" rx="5" fill="rgba(245,197,66,0.16)" />
    {[16, 42, 68, 94, 120].map((x) => (
      <rect key={x} x={x} y="75.5" width="18" height="3" rx="1.5" fill="rgba(245,197,66,0.6)" />
    ))}
  </svg>
);

const BOARDS: { no: LiveBoardNo; desc: string; art: ReactNode }[] = [
  { no: 1, desc: "지금 운동 중인 회원을 크게 · QR 출석", art: <ArtNow /> },
  { no: 2, desc: "런칭 이벤트 — 출석왕 · 앱 활동왕 · 좋아요왕", art: <ArtEvent /> },
  { no: 3, desc: "회원 안내 카드뉴스가 자동으로 넘어가요", art: <ArtGuide /> },
  { no: 4, desc: "전체 한 화면 — 운동 중 · 방문 명단 · 명예의 전당", art: <ArtAll /> },
];

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
};

const LiveBoardPickerPage = () => {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const own = TV_BRANCHES.find((b) => (profile?.branch_name ?? "").includes(b.label));
  // 전체관리자이거나, 내 지점이 TV 지점 목록에 없으면(본사 등) 네 지점 모두 고를 수 있다
  const canPickAny = isAdmin || !own;

  const [code, setCode] = useState<string>(() => {
    const saved = readStored();
    if (canPickAny && saved && TV_BRANCHES.some((b) => b.code === saved)) return saved;
    return own?.code ?? TV_BRANCHES[0].code;
  });
  const branch = TV_BRANCHES.find((b) => b.code === code) ?? TV_BRANCHES[0];

  const pickBranch = (next: string) => {
    setCode(next);
    try {
      localStorage.setItem(STORE_KEY, next);
    } catch {
      /* 저장 못 해도 이번 화면에서는 그대로 쓴다 */
    }
  };

  const open = (no: LiveBoardNo) => navigate(liveBoardPreviewPath(branch.code, no));

  // TV 열쇠 — 그 지점 운영진만 받는다 (못 받으면 칸을 숨긴다)
  const [tvKey, setTvKey] = useState<{ key: string; locked: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    setTvKey(null);
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_board_tv_key", { p_branch: branch.code });
      if (!alive || error || !data?.key) return;
      setTvKey({ key: String(data.key), locked: data.locked === true });
    })();
    return () => {
      alive = false;
    };
  }, [branch.code]);
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("주소를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요 — 주소를 길게 눌러 복사해 주세요");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        sticky
        title="라이브보드"
        subtitle={`${branch.label} · 보고 싶은 화면을 눌러요`}
        leftAction={
          <button
            type="button"
            onClick={() => navigate("/manager")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {canPickAny && (
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="지점">
            {TV_BRANCHES.map((b) => {
              const active = b.code === branch.code;
              return (
                <button
                  key={b.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickBranch(b.code)}
                  className={`h-9 rounded-lg text-label font-bold transition-all active:scale-[0.97] ${
                    active ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {BOARDS.map((bd) => (
            <button
              key={bd.no}
              type="button"
              onClick={() => open(bd.no)}
              className="overflow-hidden rounded-2xl bg-card text-left shadow-elev-1 ring-1 ring-black/[0.04] transition-transform active:scale-[0.98] dark:ring-white/[0.06]"
            >
              <div className="relative aspect-video bg-gradient-to-br from-[#0B0F14] to-[#16202A]">
                {bd.art}
                {/* 번호는 화면과 글 사이 이음새에 — 그림을 가리지 않는다 */}
                <span className="absolute -bottom-3.5 left-3 grid h-7 min-w-[1.75rem] place-items-center rounded-lg bg-foreground px-1.5 text-label font-black tabular-nums text-background ring-[3px] ring-card">
                  {bd.no}
                </span>
              </div>
              <div className="px-3 pb-3 pt-5">
                <p className="text-body font-bold leading-tight text-foreground">라이브보드 {bd.no}</p>
                <p className="mt-1 text-label leading-snug text-muted-foreground">{bd.desc}</p>
                <p className="mt-2 font-mono text-label tabular-nums text-muted-foreground/80">
                  {tvBoardPath(branch.short, bd.no)}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-card p-4 text-label leading-relaxed text-muted-foreground shadow-elev-1 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-label font-bold text-foreground">TV에 띄울 때</p>
          <p className="mt-1">
            TV 브라우저 시작 페이지에{" "}
            <span className="font-mono font-bold text-foreground">
              {DOMAIN}
              {tvBoardPath(branch.short, 1)}
            </span>{" "}
            처럼 넣어 두면 켤 때마다 그 화면이 떠요. 끝 번호가 곧 라이브보드 번호예요(4번은 번호 없이).
          </p>
          <p className="mt-1">앱에서는 TV 화면을 그대로 줄여서 보여 드려요 — 가로로 돌리면 크게 보여요.</p>
        </div>

        {tvKey && (
          <div className="rounded-2xl bg-card p-4 text-label leading-relaxed text-muted-foreground shadow-elev-1 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <p className="flex items-center gap-1.5 text-label font-bold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              {branch.label} TV 열쇠 주소
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-micro font-bold ${
                  tvKey.locked ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
              >
                {tvKey.locked ? "잠김" : "아직 열림"}
              </span>
            </p>
            <p className="mt-1">
              TV 시작 페이지를 아래 주소로 바꾸면 열쇠가 있는 TV에서만 회원 이름이 보여요. 앱 주소만 아는 사람은 회원 명단을 볼 수 없어요.
            </p>
            {!tvKey.locked && (
              <p className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
                열쇠 주소로 처음 여는 순간 이 지점이 잠겨요. 이 지점 TV를 모두 함께 바꿔 주세요 — 안 바꾼 TV에는 &lsquo;열쇠 주소로 열어야 회원이 보여요&rsquo; 안내가 떠요.
              </p>
            )}
            <ul className="mt-2 space-y-1.5">
              {LIVE_BOARD_NOS.map((n) => {
                const url = boardKeyUrl(DOMAIN, tvBoardPath(branch.short, n), tvKey.key);
                return (
                  <li key={n} className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-foreground text-micro font-black text-background">{n}</span>
                    <span className="min-w-0 flex-1 select-all break-all font-mono text-micro text-foreground">{url}</span>
                    <button
                      type="button"
                      onClick={() => void copyText(`https://${url}`)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground active:scale-95"
                      aria-label={`라이브보드 ${n} 열쇠 주소 복사`}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2">열쇠 주소는 운영진만 볼 수 있어요. 회원·외부에 보내지 마세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveBoardPickerPage;
