/**
 * 153 챌린지 — 회원끼리 왕좌를 겨루는 페이지 (2026-09-23 개편).
 *
 * 라우트: /myboxer/quest (DB / 튜토리얼 anchor 호환을 위해 path 는 유지).
 *
 * 구성:
 *   · 킹 보드 — 출석왕·연속출석왕·얼리버드왕·레벨업왕·버피왕·체력왕 (King153Board)
 *     글 대신 버튼 6개, 누르면 규칙·현재 왕·내 순위·Top 10 이 열린다.
 *   · 개인 보조 챌린지 (HomeEngagementSection personal) — 리턴 라운드 / 오삼 브리핑 / 아레나 / 퀴즈
 *
 * 챔피언 일기는 153 커뮤니티 메뉴로 이관됨 (/myboxer/community).
 * 예전 quest_xp 기반 "도전 점수 랭킹" 카드(Challenge153LeaderboardCard)는 킹 보드로 대체됐다.
 *
 * 보호 원칙:
 *   · 공식 1~40 레벨업 / 코치 승인 미션과 무관 — 왕좌는 읽기 전용 순위
 *   · 기존 명예의 전당 랭킹 (/halloffame) 과 별개
 */

import { motion } from "framer-motion";
import HomeEngagementSection from "@/components/engagement/HomeEngagementSection";
import King153Board from "@/components/engagement/King153Board";

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
            이번 주 왕좌는 누구? 버튼을 눌러 확인하세요
          </p>
        </header>

        {/* 킹 보드 — 6개 왕좌 */}
        <King153Board />

        {/* 안내 — 공식 레벨업과 무관 (한 줄) */}
        <p
          data-tour="challenge153-intro"
          className="rounded-xl border-l-2 border-primary/40 bg-primary/5 px-3.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground"
        >
          153 챌린지 왕좌는 재미와 습관을 위한 순위예요. 공식 1~40 레벨업·명예의 전당 랭킹과는 별개입니다.
        </p>

        {/* 본문 — 개인 보조 챌린지 (일기는 153 커뮤니티 로 이관됨) */}
        <HomeEngagementSection mode="personal" />
      </div>
    </motion.div>
  );
};

export default MyBoxerQuestPage;
