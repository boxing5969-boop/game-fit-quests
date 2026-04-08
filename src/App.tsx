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
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import CertBenefitsPage from "@/pages/CertBenefitsPage";
import NotFound from "@/pages/NotFound";
import ChatAssistant from "@/components/ChatAssistant";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
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
  return <>{children}</>;
};

const CoachRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "coach" && role !== "admin") return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const HomeRouter = () => {
  const { loading } = useAuth();
  if (loading) return null;
  return <HomePage />;
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
        <Route path="/" element={user ? <Navigate to="/home" replace /> : <LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/home" element={<ProtectedRoute><HomeRouter /></ProtectedRoute>} />
        <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
        <Route path="/quests" element={<Navigate to="/missions" replace />} />
        <Route path="/levelmap" element={<ProtectedRoute><LevelMapPage /></ProtectedRoute>} />
        <Route path="/rewards" element={<ProtectedRoute><RewardsPage /></ProtectedRoute>} />
        <Route path="/halloffame" element={<ProtectedRoute><HallOfFamePage /></ProtectedRoute>} />
        <Route path="/cert-benefits" element={<ProtectedRoute><CertBenefitsPage /></ProtectedRoute>} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><CoachRoute><CoachDashboard /></CoachRoute></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
      <ChatAssistant />
    </>
  );
};

const App = () => (
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

export default App;
