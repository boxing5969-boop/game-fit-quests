/**
 * 회원 상세(지도진) › 「보호자」 — 연결된 엄마 · 아빠 보기 · 데스크 QR 만들기 · 끊기 (2026-11-23 대표님 「추천대로」).
 *
 * 권한은 서버(guardian_staff_links · guardian_invite_create_for · guardian_unlink — 같은 지점 코치 · 지점장 · 전체관리자)가 본다.
 * 서버에 함수가 없거나 권한이 없으면 칸을 안 그린다. QR(24시간 · 한 번)은 처음 열 때만 따로 받는다.
 * 미성년 · 나이를 모르는 회원은 데스크 QR 로 바로 이어지고, 성인 회원은 본인이 앱에서 수락해야 이어진다.
 */
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { HeartHandshake, QrCode } from "lucide-react";
import { copyText } from "@/lib/appInvite";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { RELATION_LABEL, guardianInviteUrl } from "@/lib/guardian";
import { createGuardianInviteFor, useGuardianActions, useGuardianStaffLinks, type InviteMade } from "@/services/guardianService";

const GuardianQrSheet = lazyWithRetry(() => import("./GuardianQrSheet"));

const kstText = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
};

interface Props {
  memberId: string;
  memberName: string;
}

const GuardianStaffSection = ({ memberId, memberName }: Props) => {
  const { data } = useGuardianStaffLinks(memberId);
  const { unlink, changed } = useGuardianActions();
  const [qr, setQr] = useState<InviteMade | null>(null);
  const [making, setMaking] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  if (!data) return null;
  const url = qr ? guardianInviteUrl(qr.token, window.location.origin) : "";

  const make = async () => {
    if (making) return;
    setMaking(true);
    try {
      setQr(await createGuardianInviteFor(memberId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "QR 을 만들지 못했어요");
    } finally {
      setMaking(false);
    }
  };

  const doUnlink = (id: string) => {
    if (confirm !== id) {
      setConfirm(id);
      return;
    }
    setConfirm(null);
    unlink.mutate(id, {
      onSuccess: () => toast.success("보호자 연결을 끊었어요"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "연결을 끊지 못했어요"),
    });
  };

  const ageNote =
    data.minor === true ? "미성년 회원 · QR 로 바로 연결" : data.minor === false ? "성인 회원 · 본인이 앱에서 수락해야 연결" : "나이 정보 없음 · QR 로 바로 연결";

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-label text-muted-foreground">
          <HeartHandshake className="h-4 w-4" /> 보호자
        </span>
        <button
          type="button"
          onClick={() => void make()}
          disabled={making}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-micro font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
        >
          <QrCode className="h-3.5 w-3.5" />
          {making ? "만드는 중" : "보호자 연결 QR"}
        </button>
      </div>
      {data.links.length === 0 ? (
        <p className="mt-1.5 text-label text-foreground">연결된 보호자가 없어요</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-label font-medium text-foreground">
                {RELATION_LABEL[l.relation]} · {l.name}
                {l.status === "pending" && <span className="ml-1.5 text-micro font-bold text-primary">회원 수락 기다림</span>}
              </span>
              <button
                type="button"
                onClick={() => doUnlink(l.id)}
                disabled={unlink.isPending}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-micro font-bold active:scale-95 disabled:opacity-60 ${
                  confirm === l.id ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {confirm === l.id ? "한 번 더 누르면 끊겨요" : "끊기"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-micro text-muted-foreground">{ageNote} · 보호자는 출석 시각 · 운동 시간 · 레벨 · 코치 한마디만 봐요</p>
      {qr && (
        <Suspense fallback={null}>
          <GuardianQrSheet
            url={url}
            memberName={memberName}
            expiresText={kstText(qr.expiresAt)}
            needsAccept={qr.minor === false}
            onClose={() => {
              setQr(null);
              void changed();
            }}
            onCopy={() => void copyText(url).then((ok) => (ok ? toast.success("링크를 복사했어요") : toast.error("복사하지 못했어요")))}
          />
        </Suspense>
      )}
    </div>
  );
};

export default GuardianStaffSection;
