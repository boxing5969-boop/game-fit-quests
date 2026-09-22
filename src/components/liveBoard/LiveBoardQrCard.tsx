/**
 * 153 — 라이브보드 QR 출석 카드 (2026-09-22)
 *
 * 왜 있나:
 *   브로제이(얼굴 인식) 서버가 느려지면 출석이 보드에 늦게 뜬다. 문은 얼굴 인식으로만
 *   열리니 출석 자체는 이미 된 상태 — 회원이 앱에서 이 QR을 찍으면 보드에 바로 올라간다.
 *   대표님 지시: 장애 때만이 아니라 "항상" 띄운다. 안내 문구도 그대로 상시 노출.
 *
 * 동작:
 *   · get_board_qr_token(지점) — anon 호출 가능. 토큰은 서버가 5분마다 바꾼다(HMAC).
 *   · 만료 직후 또는 늦어도 30초마다 다시 받아 QR 을 갱신한다.
 *   · QR 내용은 https://myboxer153.com/qr-checkin?b=<지점코드>&t=<토큰>.
 *     앱 안 스캐너(QrCheckinPage)가 이 URL 에서 b·t 를 꺼내 qr_manual_checkin 을 부른다.
 *   · 토큰을 못 받으면 카드 자리에 안내만 남긴다 — 보드의 다른 부분은 영향 없음.
 *   · 보드 키(선택): 지점에 키가 등록되면(internal_sync_config board_key:<지점명>) 그 키를 가진
 *     TV 에만 토큰이 나온다. TV 에서 /tv/<코드>?k=<키> 를 한 번 열면 localStorage 에 남는다.
 *     키가 등록되지 않은 지점은 지금처럼 열려 있다.
 *
 * variant:
 *   · sidebar  — 오른쪽 패널 맨 위 (기본 화면·2번 화면)
 *   · floating — 1번 화면(운동 중만)엔 오른쪽 패널이 없어서 우하단에 띄운다
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/** 회원 앱의 공식 주소 — 보드가 어느 도메인에서 열려도 QR 은 항상 이 주소를 가리킨다.
 *  (pages.dev 등 다른 도메인이면 회원 폰의 로그인 세션이 없어 로그인부터 다시 하게 된다) */
const QR_CHECKIN_ORIGIN = "https://myboxer153.com";

function buildQrCheckinUrl(branchKey: string, token: string): string {
  const u = new URL("/qr-checkin", QR_CHECKIN_ORIGIN);
  u.searchParams.set("b", branchKey);
  u.searchParams.set("t", token);
  return u.toString();
}

/** 보드에 항상 나오는 한 줄 — 대표님 문구 그대로. */
const BOARD_QR_NOTICE_MAIN = "브로제이 서버 불안정으로 인해 출석 반영이 늦어지고 있어요~";
const BOARD_QR_NOTICE_SUB = "앱에서 QR을 통해 출석체크 부탁드립니다";

interface TokenRes {
  ok: boolean;
  branch?: string;
  code?: string | null;
  token?: string;
  expires_in_sec?: number;
  rotate_sec?: number;
  error?: string;
}

interface Props {
  branchName: string;
  variant?: "sidebar" | "floating";
  /** sidebar 변형에 덧붙일 클래스 (2번 화면은 폭 제한) */
  className?: string;
}

/** TV 마다 한 번 /tv/<코드>?k=<키> 로 열면 저장되는 보드 키. 지점에 키가 등록돼 있을 때만 쓰인다. */
function readBoardKey(branchName: string): string | null {
  const store = `153_board_key:${branchName}`;
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(window.location.search).get("k");
  } catch {
    /* noop */
  }
  if (fromUrl) {
    try {
      localStorage.setItem(store, fromUrl);
    } catch {
      /* 저장소가 막혀도 URL 의 키는 그대로 쓴다 */
    }
    return fromUrl;
  }
  try {
    return localStorage.getItem(store);
  } catch {
    return null;
  }
}

const POLL_MS = 30_000;
const QR_SIZE = 168;

const LiveBoardQrCard = ({ branchName, variant = "sidebar", className = "" }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<null | "key" | "net">(null);
  // 마지막으로 받은 토큰이 서버에서 거부되기 시작하는 시각(만료 + 직전 구간 허용 300초).
  // 네트워크가 끊겨 갱신을 못 하면 이 시각 뒤엔 QR 을 내린다 — 멀쩡해 보이는 죽은 QR 을 두지 않는다.
  const [staleAt, setStaleAt] = useState<number>(0);

  useEffect(() => {
    if (!branchName) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      let nextMs = POLL_MS;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("get_board_qr_token", {
          p_branch: branchName,
          p_key: readBoardKey(branchName),
        });
        if (!alive) return;
        const res = (data ?? null) as TokenRes | null;
        if (error || !res?.ok || !res.token) {
          setFailed(res?.error === "board_key_required" ? "key" : "net");
          if (res?.error === "board_key_required") setUrl(null); // 잠긴 지점 — 이전 QR 을 남기지 않는다
          else if (staleAt && Date.now() > staleAt) setUrl(null); // 갱신 실패가 길어져 토큰이 죽었다
        } else {
          setFailed(null);
          setUrl(buildQrCheckinUrl(res.code || res.branch || branchName, res.token));
          setStaleAt(Date.now() + ((res.expires_in_sec ?? 300) + (res.rotate_sec ?? 300)) * 1000);
          // 토큰이 바뀌는 순간 바로 새 QR 로 — 단, 3초보다 잦게는 안 부른다.
          const untilRotate = ((res.expires_in_sec ?? 30) + 1) * 1000;
          nextMs = Math.min(POLL_MS, Math.max(3_000, untilRotate));
        }
      } catch {
        if (!alive) return;
        setFailed("net");
        if (staleAt && Date.now() > staleAt) setUrl(null);
      }
      timer = setTimeout(load, nextMs);
    };

    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // staleAt 은 load 안에서 최신값을 읽기만 하면 되므로 effect 재시작 대상이 아니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchName]);

  const body = (
    <div className="flex items-center gap-4">
      <div className="shrink-0 rounded-xl bg-white p-2.5">
        {url ? (
          <QRCodeSVG value={url} size={QR_SIZE} level="M" marginSize={0} />
        ) : (
          <div
            className="flex items-center justify-center rounded-lg bg-gray-200 text-gray-400"
            style={{ width: QR_SIZE, height: QR_SIZE }}
          >
            <QrCode className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-black tracking-wide text-primary">
          <QrCode className="h-4 w-4" /> 앱에서 QR 출석
        </p>
        <p className="mt-2 text-sm font-bold leading-snug text-white">{BOARD_QR_NOTICE_MAIN}</p>
        <p className="mt-1.5 text-sm font-bold leading-snug text-white/80">{BOARD_QR_NOTICE_SUB}</p>
        <p className="mt-2 text-xs font-bold leading-snug text-white/40">
          마이복서153 → 홈 → 오늘의 시작 → QR 출석
        </p>
        {failed === "key" && (
          <p className="mt-1 text-xs font-bold text-destructive/80">이 TV 는 보드 키 등록이 필요해요 — 관리자에게 문의</p>
        )}
        {failed === "net" && !url && (
          <p className="mt-1 text-xs font-bold text-destructive/80">QR 을 불러오지 못했어요 — 잠시 후 다시 시도합니다</p>
        )}
      </div>
    </div>
  );

  if (variant === "floating") {
    return (
      <div className="fixed bottom-5 right-5 z-40 w-[27rem] rounded-2xl border border-primary/30 bg-gray-950/90 p-4 shadow-2xl backdrop-blur">
        {body}
      </div>
    );
  }
  return (
    <div className={`mx-3 mt-3 flex-shrink-0 rounded-2xl border border-primary/30 bg-gray-950/70 p-4 ${className}`}>
      {body}
    </div>
  );
};

export default LiveBoardQrCard;
