/**
 * 어디서든 회원 이름·카드를 누르면 뜨는 회원 카드 (2026-10-18 대표님: "이름을 클릭하면 회원 상세 정보를 볼수있고
 * 좋아요 · 메시지 보내기 · 짝꿍 신청 · 응원 보내기 … 랭킹에서 회원 카드를 클릭해도 항상 그렇게").
 *
 * App 에 한 번만 둔다. 화면들은 openMemberCard(userId) (lib/appEvents) 만 부르면 된다.
 * 카드 자체는 MemberLicenseSheet — 처음 열 때 불러온다(첫 화면 무게를 늘리지 않게).
 * 화면이 바뀌면 닫는다 — App 에 계속 떠 있어서, 안드로이드 뒤로가기로 뒤 화면만 바뀌고 카드는 남던 것 (2026-10-19 검수)
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { OPEN_MEMBER_CARD_EVENT, type OpenMemberCardDetail } from "@/lib/appEvents";

const MemberLicenseSheet = lazy(() => import("@/components/license/MemberLicenseSheet"));

const GlobalMemberCard = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [used, setUsed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setUserId(null);
  }, [pathname]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<OpenMemberCardDetail>).detail?.userId;
      if (!id) return;
      setUsed(true);
      setUserId(id);
    };
    window.addEventListener(OPEN_MEMBER_CARD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MEMBER_CARD_EVENT, onOpen);
  }, []);

  if (!used) return null;
  return (
    <Suspense fallback={null}>
      <MemberLicenseSheet userId={userId} onClose={() => setUserId(null)} />
    </Suspense>
  );
};

export default GlobalMemberCard;
