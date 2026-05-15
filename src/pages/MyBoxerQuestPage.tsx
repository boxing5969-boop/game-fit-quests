/**
 * 153 챌린지 — 회원 간 랭킹 경쟁 + 개인 보조 챌린지 페이지.
 *
 * 라우트: /myboxer/quest (DB / 튜토리얼 anchor 호환을 위해 path 는 유지).
 * 라벨/카피는 '153 챌린지' 로 리브랜드.
 *
 * 포함:
 *   · 153 챌린지 랭킹 — quest_xp 기반 회원 간 리더보드 (기존 명예의 전당과 별개)
 *   · 리턴 라운드 / 오삼 코치 브리핑 / 오늘의 보조 챌린지 미니 패널
 *   · 복싱 IQ 퀴즈 / 챌린지 아레나
 *
 * 챔피언 일기는 153 커뮤니티 메뉴로 이관됨 (/myboxer/community).
 *
 * 보호 원칙:
 *   · 공식 1~40 레벨업 / 코치 승인 미션과 무관
 *   · 기존 명예의 전당 랭킹 (/halloffame) 과 별개 — quest_xp 만 활용
 */

import { motion } from "framer-motion";
import HomeEngagementSection from "@/components/engagement/HomeEngagementSection";
import Challenge153LeaderboardCard from "@/components/engagement/Challenge153LeaderboardCard";

const MyBoxerQuestPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-dvh bg-background pb-32"
    >
      <div
        data-tour="challenge153-page"
        className="mx-auto w-full max-w-md md:max-w-xl space-y-5 px-4 py-5"
      >
        {/* 헤더 — 메뉴 제목 + 부제 */}
        <header data-tour="challenge153-header" className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">
            MYBOXER 153
          </p>
          <h1 className="text-2xl font-black leading-tight text-foreground">
            153 챌린지
          </h1>
          <p className="text-[12px] text-muted-foreground">
            회원끼리 도전 점수로 겨루는 별도 랭킹
          </p>
        </header>

        {/* 안내 — 공식 레벨업과 무관 */}
        <div
          data-tour="challenge153-intro"
          className="rounded-xl border-l-2 border-primary/40 bg-primary/5 px-3.5 py-2.5"
        >
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            153 챌린지는 공식 1~40 레벨업 / 명예의 전당 랭킹과 별개입니다.
            <br />
            공식 훈련은 <strong className="text-foreground">훈련</strong> 메뉴, 공식 랭킹은 <strong className="text-foreground">랭킹</strong> 메뉴에서 확인하세요.
          </p>
        </div>

        {/* 153 챌린지 회원 간 랭킹 — quest_xp 누적 기반 */}
        <div data-tour="challenge153-leaderboard">
          <Challenge153LeaderboardCard />
        </div>

        {/* 본문 — 개인 챌린지 (일기는 153 커뮤니티 로 이관됨) */}
        <HomeEngagementSection mode="personal" />
      </div>
    </motion.div>
  );
};

export default MyBoxerQuestPage;
