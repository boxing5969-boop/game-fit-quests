/**
 * 153 QUEST — 보조 퀘스트 / 커뮤니티 활동 허브 페이지.
 *
 * 홈 화면의 HomeEngagementSection 을 별도 메뉴로 분리한 페이지.
 * 라우트: /myboxer/quest (ProtectedRoute 만 적용 — 로그인 회원 전체 접근).
 * BottomNav 메인 슬롯에는 노출 X. "전체 메뉴" 안에서 진입.
 *
 * 포함 내용 (HomeEngagementSection 통째 마운트):
 *   · 리턴 라운드 배너 / 컨디션 게이지 / 오삼 코치 브리핑 / 오늘의 퀘스트 미니 패널
 *   · 복싱 IQ 퀴즈 / 챌린지 아레나 / 챔피언 일기 / 세컨드 응원
 *   · 코너맨 매칭 / 짐 레이드
 *
 * 보호 원칙:
 *   · 기존 HomeEngagementSection 컴포넌트 props/state/로직 0 변경
 *   · 공식 1~40 레벨업 / 코치 승인 미션과 무관 (기존 보조 퀘스트 정책 유지)
 *   · DB / RPC / 마이그레이션 추가 0
 */

import { motion } from "framer-motion";
import HomeEngagementSection from "@/components/engagement/HomeEngagementSection";

const MyBoxerQuestPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-dvh bg-background pb-32"
    >
      <div className="mx-auto w-full max-w-md md:max-w-xl space-y-5 px-4 py-5">
        {/* 헤더 — 메뉴 제목 + 부제 */}
        <header className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">
            MYBOXER 153
          </p>
          <h1 className="text-2xl font-black leading-tight text-foreground">
            153 QUEST
          </h1>
          <p className="text-[12px] text-muted-foreground">
            오늘의 보조 퀘스트와 커뮤니티 활동
          </p>
        </header>

        {/* 안내 — 공식 레벨업과 무관 */}
        <div className="rounded-xl border-l-2 border-primary/40 bg-primary/5 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            보조 퀘스트는 공식 1~40 레벨업과 무관합니다.
            <br />
            공식 훈련은 <strong className="text-foreground">훈련</strong> 메뉴에서, 공식 레벨업은 코치 승인으로 진행됩니다.
          </p>
        </div>

        {/* 본문 — 기존 HomeEngagementSection 통째 마운트 */}
        <HomeEngagementSection />
      </div>
    </motion.div>
  );
};

export default MyBoxerQuestPage;
