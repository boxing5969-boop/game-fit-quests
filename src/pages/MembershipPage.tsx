// 수강권 전용 화면 (/membership) — 전체메뉴 "수강권"에서 진입. 디지털 멤버십 카드 확인용.
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import MembershipCard from "@/components/MembershipCard";

const MembershipPage = () => {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const memEnd = (profile as { membership_end?: string } | null)?.membership_end ?? null;
  const hasMembership = isManagerRole(role) || !!memEnd;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">수강권</h1>
      </div>

      {hasMembership ? (
        <div className="space-y-4">
          <MembershipCard />
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            출석·수강 시 이 화면을 보여주세요. 만료일·남은 기간은 매일 자동으로 갱신됩니다.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">🎫</span>
          <p className="mt-2 text-sm font-medium text-foreground">등록된 수강권이 없습니다</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            관장님께 문의하시거나, 구글·카카오로 가입하셨다면 전화번호 연동을 진행해주세요.
          </p>
        </div>
      )}
    </div>
  );
};

export default MembershipPage;
