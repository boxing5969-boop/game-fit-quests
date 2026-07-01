// 153멤버십 선택 화면 (/membership-plans) — 홈 상단 '멤버십' 버튼에서 진입.
// 수강권 카드·홀딩/환불 없이 '멤버십 선택(결제)'만 보여준다. (수강권 현황은 전체메뉴 '수강권'에서)
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import MembershipProducts from "@/components/MembershipProducts";

const MembershipSelectPage = () => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div>
          <h1 className="text-xl text-foreground">153멤버십</h1>
          <p className="text-[11px] text-muted-foreground">153복싱짐 선릉역점</p>
        </div>
      </div>
      <MembershipProducts />
    </div>
  );
};

export default MembershipSelectPage;
