import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import ChatAssistant from "@/components/ChatAssistant";
import ErrorBoundary from "@/components/ErrorBoundary";
import { isManagerRole } from "@/lib/rankLabels";
import TutorialFloatingMascot from "@/components/tutorial/TutorialFloatingMascot";
import TutorialActionSpotlight from "@/components/tutorial/TutorialActionSpotlight";
import OsamiWelcomeModal from "@/components/tutorial/OsamiWelcomeModal";
import { useTutorialAutoDetect } from "@/hooks/useTutorialAutoDetect";
import TutorialCampProvider from "@/features/tutorial-camp/TutorialCampProvider";
import TutorialDevPanel from "@/features/tutorial-camp/TutorialDevPanel";
import TutorialCustomizer from "@/features/tutorial-camp/TutorialCustomizer";
import PostActionReflectionSheet from "@/components/home/PostActionReflectionSheet";
import AppLaunchSplash from "@/components/splash/AppLaunchSplash";
import RouteLoader from "@/components/splash/RouteLoader";
import { useAppLaunchSplash } from "@/hooks/useAppLaunchSplash";

// Route-level code splitting — every page below is fetched on demand.
// LoginPage + NotFound stay eager: Login is the cold-start screen
// (no point in splitting the first paint), NotFound is a tiny fallback.
const HomePage = lazy(() => import("@/pages/HomePage"));
const MissionsPage = lazy(() => import("@/pages/MissionsPage"));
// LevelMapPage — /rank-up 에 탭으로 통합, /levelmap 경로는 리다이렉트만 유지.
const RewardsPage = lazy(() => import("@/pages/RewardsPage"));
const HallOfFamePage = lazy(() => import("@/pages/HallOfFamePage"));
const MyPage = lazy(() => import("@/pages/MyPage"));
const CoachDashboard = lazy(() => import("@/pages/CoachDashboard"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const CertBenefitsPage = lazy(() => import("@/pages/CertBenefitsPage"));
const BranchManagerHome = lazy(() => import("@/pages/BranchManagerHome"));
const MemberDetailPage = lazy(() => import("@/pages/MemberDetailPage"));
const MemberPreviewPage = lazy(() => import("@/pages/MemberPreviewPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const SelectBranchPage = lazy(() => import("@/pages/SelectBranchPage"));
const WaitingApprovalPage = lazy(() => import("@/pages/WaitingApprovalPage"));
const GuidePage = lazy(() => import("@/pages/GuidePage"));
const GuideProgramPage = lazy(() => import("@/pages/guide/GuideProgramPage"));
const GuideSciencePage = lazy(() => import("@/pages/guide/GuideSciencePage"));
const GuideValueMapPage = lazy(() => import("@/pages/guide/GuideValueMapPage"));
const GuideExercisePurposePage = lazy(() => import("@/pages/guide/GuideExercisePurposePage"));
const GuideSafetyPage = lazy(() => import("@/pages/guide/GuideSafetyPage"));
const GuideFaqPage = lazy(() => import("@/pages/guide/GuideFaqPage"));
const RankUpPage = lazy(() => import("@/pages/RankUpPage"));
const CharacterStudioPage = lazy(() => import("@/pages/CharacterStudioPage"));
const MasterTrackPage = lazy(() => import("@/pages/MasterTrackPage"));
const MinigamePage = lazy(() => import("@/pages/MinigamePage"));
const CheckinBoardPage = lazy(() => import("@/pages/CheckinBoardPage"));
const DietHubPage = lazy(() => import("@/pages/diet/DietHubPage"));
const DietOnboardingPage = lazy(() => import("@/pages/diet/DietOnboardingPage"));
const DietTrackerPage = lazy(() => import("@/pages/diet/DietTrackerPage"));
const DietProgressPage = lazy(() => import("@/pages/diet/DietProgressPage"));
const DietFoodGuidePage = lazy(() => import("@/pages/diet/DietFoodGuidePage"));
const DietRankingPage = lazy(() => import("@/pages/diet/DietRankingPage"));
const DietValuePage = lazy(() => import("@/pages/diet/DietValuePage"));
const DietMealPlanPage = lazy(() => import("@/pages/diet/DietMealPlanPage"));
const DietAfter21GuidePage = lazy(() => import("@/pages/diet/DietAfter21GuidePage"));
const ChallengesPage = lazy(() => import("@/pages/ChallengesPage"));
const DietAutoMealsPage = lazy(() => import("@/pages/diet/DietAutoMealsPage"));
const DietPostProgramPage = lazy(() => import("@/pages/diet/DietPostProgramPage"));
const DietPhotoGalleryPage = lazy(() => import("@/pages/diet/DietPhotoGalleryPage"));
const AboutOneFiveThreePage = lazy(() => import("@/pages/AboutOneFiveThreePage"));
const DietCoachInboxPage = lazy(() => import("@/pages/diet/coach/DietCoachInboxPage"));
const DietMemberDetailPage = lazy(() => import("@/pages/diet/coach/DietMemberDetailPage"));
const LiveBoardPage = lazy(() => import("@/pages/LiveBoardPage"));
const SuperAdminDashboard = lazy(() => import("@/pages/SuperAdminDashboard"));
// 153마인드셋 — 시각화 훈련 (153복싱짐으로 돌아온 사람).
//
// 보존된 RPG 자산:
//   · src/pages/StoryRpgPage.tsx (47A/47B 단계 — 153 스토리 RPG)
//   · src/components/story-rpg/ 전체
//   · public/assets/story-rpg/ 17장 PNG
//   · src/pages/BoxerRoutePage.tsx (직전 단계 — 7 라운드 RoundTimer 시각화)
// 위 파일은 모두 그대로 보존. 라우트 import 만 신규 페이지로 교체 — 1커밋 rollback 가능.
const MyBoxerVisualizationPage = lazy(
  () => import("@/pages/MyBoxerVisualizationPage"),
);
const MyBoxerQuestPage = lazy(() => import("@/pages/MyBoxerQuestPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 30s so tab-switching and route
      // remounts don't refire every query. Hooks that need live
      // data (rankings, attendance) override this locally.
      staleTime: 30_000,
      // Keep cached data for 5 min before garbage collection —
      // back-navigation on mobile should hit cache, not network.
      gcTime: 5 * 60_000,
      // Don't refetch on every window focus; manual invalidations
      // from mutations are the explicit freshness contract.
      refetchOnWindowFocus: false,
      // Avoid thundering-herd retries on mobile networks.
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return <RouteLoader />;
  }
  if (!user) return <Navigate to="/" replace />;
  
  // Allow select-branch and waiting-approval pages without checks
  const path = window.location.pathname;
  if (path === "/select-branch" || path === "/waiting-approval") {
    return <>{children}</>;
  }
  
  // Social login users without branch → select branch
  if (profile && !profile.branch_name) {
    return <Navigate to="/select-branch" replace />;
  }
  
  // Unapproved users → waiting page
  if (profile && !profile.is_approved) {
    return <Navigate to="/waiting-approval" replace />;
  }
  
  return <>{children}</>;
};

const ManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!isManagerRole(role)) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

// 153 스토리 RPG 미공개 — admin/super_admin 만 진입 (회원 직접 URL 접근 차단)
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "admin" && role !== "super_admin") {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

const RoleBasedRedirect = () => {
  const { role, profile, loading } = useAuth();
  if (loading) return null;
  
  // Social login users without branch need to select one
  if (profile && !profile.branch_name) {
    return <Navigate to="/select-branch" replace />;
  }
  
  // Unapproved users see a waiting message
  if (profile && !profile.is_approved) {
    return <Navigate to="/waiting-approval" replace />;
  }
  
  if (role === "branch_manager" || role === "coach") return <Navigate to="/manager" replace />;
  if (role === "super_admin" || role === "admin") return <Navigate to="/manager" replace />;
  return <Navigate to="/home" replace />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  // Splash gate.
  //   • 쿨드 스타트 시 1회만 재생 (sessionStorage 키 'rankingup_splash_seen_v1').
  //   • auth loading 중이거나 user 가 없으면 gated=true — waiting 유지.
  //   • 로그인·셋업·퍼블릭 라우트에서는 hook 내부에서 bypass.
  //   • 새로고침은 같은 세션으로 간주 → 재생 안 함. 탭 완전 종료 후 새로 열면 재생.
  //   • 튜토리얼 오버레이는 splashDone 이 될 때까지 mount 금지 (아래 {splashDone && ...}).
  const splashGated = loading || !user;
  const { shouldShow: showSplash, splashDone, markFinished } = useAppLaunchSplash(
    pathname,
    splashGated,
  );

  if (loading) {
    return <RouteLoader />;
  }

  return (
    <>
      <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={user ? <RoleBasedRedirect /> : <LoginPage />} />
        <Route path="/select-branch" element={<ProtectedRoute><SelectBranchPage /></ProtectedRoute>} />
        <Route path="/waiting-approval" element={<ProtectedRoute><WaitingApprovalPage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
        <Route path="/quests" element={<Navigate to="/missions" replace />} />
        {/* /levelmap 은 /rank-up 안에 levelmap 탭으로 통합됨. 기존 링크 깨짐 방지용 리다이렉트. */}
        <Route path="/levelmap" element={<Navigate to="/rank-up" replace />} />
        <Route path="/rank-up" element={<ProtectedRoute><RankUpPage /></ProtectedRoute>} />
        <Route path="/rewards" element={<ProtectedRoute><RewardsPage /></ProtectedRoute>} />
        <Route path="/halloffame" element={<ProtectedRoute><HallOfFamePage /></ProtectedRoute>} />
        <Route path="/cert-benefits" element={<ProtectedRoute><CertBenefitsPage /></ProtectedRoute>} />
        <Route path="/guide" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
        <Route path="/guide/program" element={<ProtectedRoute><GuideProgramPage /></ProtectedRoute>} />
        <Route path="/guide/science" element={<ProtectedRoute><GuideSciencePage /></ProtectedRoute>} />
        <Route path="/guide/value-map" element={<ProtectedRoute><GuideValueMapPage /></ProtectedRoute>} />
        <Route path="/guide/exercise-purpose" element={<ProtectedRoute><GuideExercisePurposePage /></ProtectedRoute>} />
        <Route path="/guide/safety" element={<ProtectedRoute><GuideSafetyPage /></ProtectedRoute>} />
        <Route path="/guide/faq" element={<ProtectedRoute><GuideFaqPage /></ProtectedRoute>} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/character-studio" element={<ProtectedRoute><CharacterStudioPage /></ProtectedRoute>} />
        <Route path="/master-track" element={<ProtectedRoute><MasterTrackPage /></ProtectedRoute>} />
        <Route path="/minigame" element={<ProtectedRoute><MinigamePage /></ProtectedRoute>} />
        <Route path="/diet" element={<ProtectedRoute><DietHubPage /></ProtectedRoute>} />
        <Route path="/diet/onboarding" element={<ProtectedRoute><DietOnboardingPage /></ProtectedRoute>} />
        <Route path="/diet/tracker" element={<ProtectedRoute><DietTrackerPage /></ProtectedRoute>} />
        <Route path="/diet/progress" element={<ProtectedRoute><DietProgressPage /></ProtectedRoute>} />
        <Route path="/diet/food" element={<ProtectedRoute><DietFoodGuidePage /></ProtectedRoute>} />
        <Route path="/diet/ranking" element={<ProtectedRoute><DietRankingPage /></ProtectedRoute>} />
        <Route path="/diet/value" element={<ProtectedRoute><DietValuePage /></ProtectedRoute>} />
        <Route path="/diet/meal-plan" element={<ProtectedRoute><DietMealPlanPage /></ProtectedRoute>} />
        <Route path="/diet/after-21" element={<ProtectedRoute><DietAfter21GuidePage /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><ChallengesPage /></ProtectedRoute>} />
        <Route path="/diet/auto-meals" element={<ProtectedRoute><DietAutoMealsPage /></ProtectedRoute>} />
        <Route path="/diet/post-program" element={<ProtectedRoute><DietPostProgramPage /></ProtectedRoute>} />
        <Route path="/diet/photos" element={<ProtectedRoute><DietPhotoGalleryPage /></ProtectedRoute>} />
        <Route path="/about/153" element={<ProtectedRoute><AboutOneFiveThreePage /></ProtectedRoute>} />
        <Route path="/coach/diet" element={<ProtectedRoute><ManagerRoute><DietCoachInboxPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/coach/diet/member/:memberId" element={<ProtectedRoute><ManagerRoute><DietMemberDetailPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><ManagerRoute><CoachDashboard /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute><ManagerRoute><BranchManagerHome /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/member/:memberId" element={<ProtectedRoute><ManagerRoute><MemberDetailPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/member/:memberId/preview" element={<ProtectedRoute><ManagerRoute><MemberPreviewPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/checkin-board" element={<ProtectedRoute><ManagerRoute><CheckinBoardPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><ManagerRoute><SuperAdminDashboard /></ManagerRoute></ProtectedRoute>} />
        {/* 153마인드셋 — 시각화 훈련 (153복싱짐으로 돌아온 사람). */}
        {/* 일반 회원에게 공개. ProtectedRoute 만 유지 — 비로그인 진입 차단. */}
        {/* admin/super_admin 전용 제한 (AdminOnlyRoute) 은 제거. */}
        <Route path="/story-rpg" element={<ProtectedRoute><MyBoxerVisualizationPage /></ProtectedRoute>} />
        <Route path="/boxer-route" element={<ProtectedRoute><MyBoxerVisualizationPage /></ProtectedRoute>} />
        <Route path="/myboxer/visualization" element={<ProtectedRoute><MyBoxerVisualizationPage /></ProtectedRoute>} />
        <Route path="/myboxer/quest" element={<ProtectedRoute><MyBoxerQuestPage /></ProtectedRoute>} />
        <Route path="/live-board/:branchCode" element={<LiveBoardPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <BottomNav />
      <ChatAssistant />
      {/* 마이복서153 — 오삼 마스코트 튜토리얼 (행동기반 미션 5개). */}
      {user && splashDone && <TutorialFloatingMascotWithDetect />}
      {/* 5개 미션 spotlight 가이드 — navTarget 페이지에서 어떤 element 누를지 안내 */}
      {user && splashDone && <TutorialActionSpotlight />}
      {/* 첫 로그인 환영 모달 — 신규 회원 1회 노출, 오삼이 코치 인사 + 앱 핵심 안내 */}
      {user && splashDone && <OsamiWelcomeModal />}
      {/* 7일 스타터 캠프 overlay — localStorage 기반, isActive 시에만 렌더 */}
      {user && splashDone && <TutorialCampProvider />}
      {/* 개발자 preview 패널 — localhost / ?tutorialDev=1 / dev 토글 ON 일 때만 노출 */}
      {user && splashDone && <TutorialDevPanel />}
      {/* 64-V: 관리자 floating 커스텀 도구 — 화면 위 element picker + 토글 */}
      {user && splashDone && <TutorialCustomizer />}
      {/* 활동 후 30초 마무리 sheet — 글로벌 trigger 이벤트 listen, 하루 1회 큰 sheet */}
      {user && splashDone && <PostActionReflectionSheet />}
      {/* 쿨드 스타트 스플래시 (z-[80] · 포털). 세션 1회. */}
      {showSplash && <AppLaunchSplash onFinished={markFinished} />}
    </>
  );
};

/** 자동완료감지 훅 + floating 마스코트 함께 마운트 (router 컨텍스트 안). */
const TutorialFloatingMascotWithDetect = () => {
  useTutorialAutoDetect();
  return <TutorialFloatingMascot />;
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
