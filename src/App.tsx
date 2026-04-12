import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import MissionsPage from "@/pages/MissionsPage";
import LevelMapPage from "@/pages/LevelMapPage";
import RewardsPage from "@/pages/RewardsPage";
import HallOfFamePage from "@/pages/HallOfFamePage";
import MyPage from "@/pages/MyPage";
import CoachDashboard from "@/pages/CoachDashboard";
import SettingsPage from "@/pages/SettingsPage";

import CertBenefitsPage from "@/pages/CertBenefitsPage";
import BranchManagerHome from "@/pages/BranchManagerHome";
import MemberDetailPage from "@/pages/MemberDetailPage";
import MemberPreviewPage from "@/pages/MemberPreviewPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SelectBranchPage from "@/pages/SelectBranchPage";
import WaitingApprovalPage from "@/pages/WaitingApprovalPage";
import SafetyCheckPage from "@/pages/SafetyCheckPage";
import GuidePage from "@/pages/GuidePage";
import GuideProgramPage from "@/pages/guide/GuideProgramPage";
import GuideSciencePage from "@/pages/guide/GuideSciencePage";
import GuideValueMapPage from "@/pages/guide/GuideValueMapPage";
import GuideExercisePurposePage from "@/pages/guide/GuideExercisePurposePage";
import GuideSafetyPage from "@/pages/guide/GuideSafetyPage";
import GuideFaqPage from "@/pages/guide/GuideFaqPage";
import RankUpPage from "@/pages/RankUpPage";
import NotFound from "@/pages/NotFound";
import ChatAssistant from "@/components/ChatAssistant";
import CheckinBoardPage from "@/pages/CheckinBoardPage";
import LiveBoardPage from "@/pages/LiveBoardPage";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import { isManagerRole } from "@/lib/rankLabels";

const queryClient = new QueryClient();

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/20 text-3xl">🥊</div>
      </div>
    );
  }

  return (
    <>
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
        <Route path="/coach" element={<ProtectedRoute><ManagerRoute><CoachDashboard /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute><ManagerRoute><BranchManagerHome /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/member/:memberId" element={<ProtectedRoute><ManagerRoute><MemberDetailPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/member/:memberId/preview" element={<ProtectedRoute><ManagerRoute><MemberPreviewPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/manager/checkin-board" element={<ProtectedRoute><ManagerRoute><CheckinBoardPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/live-board/:branchCode" element={<LiveBoardPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
      <ChatAssistant />
    </>
  );
};

const App = () => {
  return (
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
  );
};

export default App;
