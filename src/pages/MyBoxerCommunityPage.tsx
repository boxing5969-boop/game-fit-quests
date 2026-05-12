/**
 * 153 커뮤니티 — 회원 간 소통 / 응원 / 페어 활동 허브 페이지 (단계 64-AS).
 *
 * 라우트: /myboxer/community (ProtectedRoute 만 적용 — 로그인 회원 전체 접근).
 *
 * 포함 (HomeEngagementSection mode='community'):
 *   · 세컨드 응원 — 오늘 링에 오른 동료에게 박수
 *   · 코너맨 매칭 — 같은 지점 회원과 1:1 페어
 *   · 짐 레이드 — 지점 누적 목표
 *
 * 보호 원칙:
 *   · 공식 1~40 레벨업 / 코치 승인 미션과 무관 (커뮤니티 활동)
 *   · DB / RPC / 마이그레이션 추가 0
 */

import { motion } from "framer-motion";
import HomeEngagementSection from "@/components/engagement/HomeEngagementSection";

const MyBoxerCommunityPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-dvh bg-background pb-32"
    >
      <div className="mx-auto w-full max-w-md md:max-w-xl space-y-5 px-4 py-5">
        {/* 헤더 */}
        <header className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">
            MYBOXER 153
          </p>
          <h1 className="text-2xl font-black leading-tight text-foreground">
            153 커뮤니티
          </h1>
          <p className="text-[12px] text-muted-foreground">
            함께 가는 동료의 응원과 페어 활동
          </p>
        </header>

        {/* 안내 — 공식 레벨업과 무관 */}
        <div className="rounded-xl border-l-2 border-primary/40 bg-primary/5 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            커뮤니티 활동은 공식 1~40 레벨업과 무관합니다.
            <br />
            함께 가는 동료의 응원과 페어로 매일 한 라운드씩 더 가볍게.
          </p>
        </div>

        {/* 본문 — 커뮤니티 카드만 */}
        <HomeEngagementSection mode="community" />
      </div>
    </motion.div>
  );
};

export default MyBoxerCommunityPage;
