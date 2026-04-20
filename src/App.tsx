import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import { useTutorialVisitTracker } from "@/hooks/useTutorialVisitTracker";

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
const AvatarPage = lazy(() => import("@/pages/AvatarPage"));
const CharacterStudioPage = lazy(() => import("@/pages/CharacterStudioPage"));
const CheckinBoardPage = lazy(() => import("@/pages/CheckinBoardPage"));
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/20 text-3xl">🥊</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
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
  useTutorialVisitTracker();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/20 text-3xl">🥊</div>
      </div>
    );
  }

  return (
    <>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/20 text-3xl">🥊</div>
          </div>
        }
      >
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
        <Route path="/avatar" element={<ProtectedRoute><AvatarPage /></ProtectedRoute>} />
        <Route path="/character-studio" element={<ProtectedRoute><CharacterStudioPage /></ProtectedRoute>} />
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
