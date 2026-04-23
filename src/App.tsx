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
import InductionCeremonyOverlay from "@/components/induction/InductionCeremonyOverlay";
import AppLaunchSplash from "@/components/splash/AppLaunchSplash";
import RouteLoader from "@/components/splash/RouteLoader";
import { useAppLaunchSplash } from "@/hooks/useAppLaunchSplash";

// Route-level code splitting — every page below is fetched on demand.
// LoginPage + NotFound stay eager: Login is the cold-start screen
// (no point in splitting the first paint), NotFound is a tiny fallback.
const HomePage = lazy(() => import("@/pages/HomePage"));
const MissionsPage = lazy(() => import("@/pages/MissionsPage"));
const LevelMapPage = lazy(() => import("@/pages/LevelMapPage"));
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
const SafetyCheckPage = lazy(() => import("@/pages/SafetyCheckPage"));
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
const DietPhotoGalleryPage = lazy(() => import("@/pages/diet/DietPhotoGalleryPage"));
const DietCoachInboxPage = lazy(() => import("@/pages/diet/coach/DietCoachInboxPage"));
const DietMemberDetailPage = lazy(() => import("@/pages/diet/coach/DietMemberDetailPage"));
const LiveBoardPage = lazy(() => import("@/pages/LiveBoardPage"));
const SuperAdminDashboard = lazy(() => import("@/pages/SuperAdminDashboard"));

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
        <Route path="/safety-check" element={<ProtectedRoute><SafetyCheckPage /></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
        <Route path="/quests" element={<Navigate to="/missions" replace />} />
        <Route path="/levelmap" element={<ProtectedRoute><LevelMapPage /></ProtectedRoute>} />
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
        <Route path="/diet/photos" element={<ProtectedRoute><DietPhotoGalleryPage /></ProtectedRoute>} />
        <Route path="/coach/diet" element={<ProtectedRoute><ManagerRoute><DietCoachInboxPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/coach/diet/member/:memberId" element={<ProtectedRoute><ManagerRoute><DietMemberDetailPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><ManagerRoute><CoachDashboard /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute><ManagerRoute><BranchManagerHome /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/member/:memberId" element={<ProtectedRoute><ManagerRoute><MemberDetailPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/member/:memberId/preview" element={<ProtectedRoute><ManagerRoute><MemberPreviewPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/checkin-board" element={<ProtectedRoute><ManagerRoute><CheckinBoardPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><ManagerRoute><SuperAdminDashboard /></ManagerRoute></ProtectedRoute>} />
        <Route path="/live-board/:branchCode" element={<LiveBoardPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <BottomNav />
      <ChatAssistant />
      {/* 랭킹업 입단식 — 글로벌 portal 오버레이. 셋업 라우트에서는 내부에서 숨김.
          splashDone 이전에는 mount 자체 차단 — 스플래시 종료 후에만 튜토리얼 시작. */}
      {user && splashDone && <InductionCeremonyOverlay />}
      {/* 쿨드 스타트 스플래시 (z-[80] · 포털). 세션 1회. */}
      {showSplash && <AppLaunchSplash onFinished={markFinished} />}
    </>
  );
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
