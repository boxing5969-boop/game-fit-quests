import { Suspense, useEffect, useState } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ThemeProvider } from "next-themes";
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
import { isSignageRoute } from "@/lib/displayMode";
import TutorialFloatingMascot from "@/components/tutorial/TutorialFloatingMascot";
import TutorialActionSpotlight from "@/components/tutorial/TutorialActionSpotlight";
import OsamiWelcomeModal from "@/components/tutorial/OsamiWelcomeModal";
import WelcomeLetter from "@/components/WelcomeLetter";
import { useTutorialAutoDetect } from "@/hooks/useTutorialAutoDetect";
import TutorialCampProvider from "@/features/tutorial-camp/TutorialCampProvider";
import TutorialDevPanel from "@/features/tutorial-camp/TutorialDevPanel";
import TutorialCustomizer from "@/features/tutorial-camp/TutorialCustomizer";
import PostActionReflectionSheet from "@/components/home/PostActionReflectionSheet";
import CredentialChangePrompt from "@/components/CredentialChangePrompt";
import LinkAccountPrompt from "@/components/LinkAccountPrompt";
import AppLaunchSplash from "@/components/splash/AppLaunchSplash";
import RouteLoader from "@/components/splash/RouteLoader";
import { useAppLaunchSplash } from "@/hooks/useAppLaunchSplash";
import { useTutorialGlobalOverridesBoot } from "@/hooks/useTutorialGlobalOverrides";
import ExitConfirm from "@/components/ExitConfirm";
import { initBackExit } from "@/lib/androidBackExit";

// Route-level code splitting — every page below is fetched on demand.
// LoginPage + NotFound stay eager: Login is the cold-start screen
// (no point in splitting the first paint), NotFound is a tiny fallback.
const TvBranchPicker = lazyWithRetry(() => import("@/pages/TvBranchPicker"));
const HomePage = lazyWithRetry(() => import("@/pages/HomePage"));
const MissionsPage = lazyWithRetry(() => import("@/pages/MissionsPage"));
// LevelMapPage — /rank-up 에 탭으로 통합, /levelmap 경로는 리다이렉트만 유지.
const RewardsPage = lazyWithRetry(() => import("@/pages/RewardsPage"));
const HallOfFamePage = lazyWithRetry(() => import("@/pages/HallOfFamePage"));
const MyPage = lazyWithRetry(() => import("@/pages/MyPage"));
const MembershipPage = lazyWithRetry(() => import("@/pages/MembershipPage"));
const SignupApply = lazyWithRetry(() => import("@/pages/SignupApply"));
const MembershipSelectPage = lazyWithRetry(() => import("@/pages/MembershipSelectPage"));
const CoachDashboard = lazyWithRetry(() => import("@/pages/CoachDashboard"));
const SettingsPage = lazyWithRetry(() => import("@/pages/SettingsPage"));
const CertBenefitsPage = lazyWithRetry(() => import("@/pages/CertBenefitsPage"));
const BranchManagerHome = lazyWithRetry(() => import("@/pages/BranchManagerHome"));
const MemberDetailPage = lazyWithRetry(() => import("@/pages/MemberDetailPage"));
const MemberPreviewPage = lazyWithRetry(() => import("@/pages/MemberPreviewPage"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/OnboardingPage"));
const SelectBranchPage = lazyWithRetry(() => import("@/pages/SelectBranchPage"));
const WaitingApprovalPage = lazyWithRetry(() => import("@/pages/WaitingApprovalPage"));
const GuidePage = lazyWithRetry(() => import("@/pages/GuidePage"));
const GuideProgramPage = lazyWithRetry(() => import("@/pages/guide/GuideProgramPage"));
const GuideSciencePage = lazyWithRetry(() => import("@/pages/guide/GuideSciencePage"));
const GuideValueMapPage = lazyWithRetry(() => import("@/pages/guide/GuideValueMapPage"));
const GuideExercisePurposePage = lazyWithRetry(() => import("@/pages/guide/GuideExercisePurposePage"));
const GuideSafetyPage = lazyWithRetry(() => import("@/pages/guide/GuideSafetyPage"));
const GuideFaqPage = lazyWithRetry(() => import("@/pages/guide/GuideFaqPage"));
const RankUpPage = lazyWithRetry(() => import("@/pages/RankUpPage"));
const CharacterStudioPage = lazyWithRetry(() => import("@/pages/CharacterStudioPage"));
const MasterTrackPage = lazyWithRetry(() => import("@/pages/MasterTrackPage"));
const MinigamePage = lazyWithRetry(() => import("@/pages/MinigamePage"));
const DietHubPage = lazyWithRetry(() => import("@/pages/diet/DietHubPage"));
const DietOnboardingPage = lazyWithRetry(() => import("@/pages/diet/DietOnboardingPage"));
const DietTrackerPage = lazyWithRetry(() => import("@/pages/diet/DietTrackerPage"));
const DietProgressPage = lazyWithRetry(() => import("@/pages/diet/DietProgressPage"));
const DietFoodGuidePage = lazyWithRetry(() => import("@/pages/diet/DietFoodGuidePage"));
const DietRankingPage = lazyWithRetry(() => import("@/pages/diet/DietRankingPage"));
const DietValuePage = lazyWithRetry(() => import("@/pages/diet/DietValuePage"));
const DietMealPlanPage = lazyWithRetry(() => import("@/pages/diet/DietMealPlanPage"));
const DietAfter21GuidePage = lazyWithRetry(() => import("@/pages/diet/DietAfter21GuidePage"));
const ChallengesPage = lazyWithRetry(() => import("@/pages/ChallengesPage"));
const DietAutoMealsPage = lazyWithRetry(() => import("@/pages/diet/DietAutoMealsPage"));
const DietPostProgramPage = lazyWithRetry(() => import("@/pages/diet/DietPostProgramPage"));
const DietPhotoGalleryPage = lazyWithRetry(() => import("@/pages/diet/DietPhotoGalleryPage"));
const AboutOneFiveThreePage = lazyWithRetry(() => import("@/pages/AboutOneFiveThreePage"));
const DietCoachInboxPage = lazyWithRetry(() => import("@/pages/diet/coach/DietCoachInboxPage"));
const DietMemberDetailPage = lazyWithRetry(() => import("@/pages/diet/coach/DietMemberDetailPage"));
const LiveBoardPage = lazyWithRetry(() => import("@/pages/LiveBoardPage"));
const FaceKioskPage = lazyWithRetry(() => import("@/pages/FaceKioskPage"));
const SuperAdminDashboard = lazyWithRetry(() => import("@/pages/SuperAdminDashboard"));
// 153마인드셋 — 시각화 훈련 (153복싱짐으로 돌아온 사람).
//
// 보존된 RPG 자산:
//   · src/pages/StoryRpgPage.tsx (47A/47B 단계 — 153 스토리 RPG)
//   · src/components/story-rpg/ 전체
//   · public/assets/story-rpg/ 17장 PNG
//   · src/pages/BoxerRoutePage.tsx (직전 단계 — 7 라운드 RoundTimer 시각화)
// 위 파일은 모두 그대로 보존. 라우트 import 만 신규 페이지로 교체 — 1커밋 rollback 가능.
const MyBoxerVisualizationPage = lazyWithRetry(
  () => import("@/pages/MyBoxerVisualizationPage"),
);
const MyBoxerQuestPage = lazyWithRetry(() => import("@/pages/MyBoxerQuestPage"));
const MyBoxerCommunityPage = lazyWithRetry(() => import("@/pages/MyBoxerCommunityPage"));
const TrainingLibraryPage = lazyWithRetry(() => import("@/pages/TrainingLibraryPage"));
const RoutineBuilderPage = lazyWithRetry(() => import("@/pages/RoutineBuilderPage"));
const RoutinesPage = lazyWithRetry(() => import("@/pages/RoutinesPage"));
const BoxingLibraryPage = lazyWithRetry(() => import("@/pages/BoxingLibraryPage"));

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
  if (loading) return <RouteLoader />;
  if (!isManagerRole(role)) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

// 153 스토리 RPG 미공개 — admin/super_admin 만 진입 (회원 직접 URL 접근 차단)
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return <RouteLoader />;
  if (role !== "admin" && role !== "super_admin") {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

const RoleBasedRedirect = () => {
  const { role, profile, loading } = useAuth();
  if (loading) return <RouteLoader />;
  
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

  // 사이니지(TV)·키오스크에서는 앱 UI를 통째로 끈다. 아래 전역 크롬 전부가 이 한 줄에 걸린다.
  const signage = isSignageRoute(pathname);

  // 65-A: 앱 부팅 시 1회 — 관리자가 publish 한 글로벌 튜토리얼 오버라이드 로드.
  // 실패해도 조용히 — base + 본인 local 만으로 동작.
  useTutorialGlobalOverridesBoot();

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

  // 안드로이드 뒤로가기 — 더 갈 곳이 없을 때 앱을 바로 끄지 않고 물어본다.
  // (하위 화면에서의 뒤로가기는 라우터가 그대로 처리 — 여기서 가로채지 않는다)
  const [exitAsk, setExitAsk] = useState(false);
  // 홈 = 메인 화면과 로그인 화면. 여기서 뒤로가면 더 갈 곳이 없으므로 종료를 묻는다.
  useEffect(() => { initBackExit(() => setExitAsk(true), ["/", "/login"]); }, []);

  if (loading) {
    // 사이니지는 153 로고 풀스크린이 깜빡이면 안 된다 — 배경색만 깔고 기다린다.
    return signage ? <div className="fixed inset-0 bg-background" /> : <RouteLoader />;
  }

  return (
    <>
      <Suspense fallback={signage ? <div className="fixed inset-0 bg-background" /> : <RouteLoader />}>
      <Routes>
        <Route path="/" element={user ? <RoleBasedRedirect /> : <LoginPage />} />
        {/* OAuth callback 안전망 — Google/Apple/Microsoft broker 가 흔히 사용하는 path 들.
            search/hash 의 OAuth 파라미터 (code/state/access_token) 는 LoginPage 가 받아
            Supabase JS 의 detectSessionInUrl 로 자동 세션 설정. NotFound 도 추가 fallback. */}
        <Route path="/auth/callback" element={<LoginPage />} />
        <Route path="/oauth/callback" element={<LoginPage />} />
        <Route path="/login/callback" element={<LoginPage />} />
        <Route path="/auth/v1/callback" element={<LoginPage />} />
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
        <Route path="/membership" element={<ProtectedRoute><MembershipPage /></ProtectedRoute>} />
        <Route path="/signup" element={<SignupApply />} />
        <Route path="/membership-plans" element={<ProtectedRoute><MembershipSelectPage /></ProtectedRoute>} />
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
        <Route path="/admin" element={<ProtectedRoute><ManagerRoute><SuperAdminDashboard /></ManagerRoute></ProtectedRoute>} />
        {/* 153마인드셋 — 시각화 훈련 (153복싱짐으로 돌아온 사람). */}
        {/* 일반 회원에게 공개. ProtectedRoute 만 유지 — 비로그인 진입 차단. */}
        {/* admin/super_admin 전용 제한 (AdminOnlyRoute) 은 제거. */}
        <Route path="/story-rpg" element={<ProtectedRoute><MyBoxerVisualizationPage /></ProtectedRoute>} />
        <Route path="/boxer-route" element={<ProtectedRoute><MyBoxerVisualizationPage /></ProtectedRoute>} />
        <Route path="/myboxer/visualization" element={<ProtectedRoute><MyBoxerVisualizationPage /></ProtectedRoute>} />
        <Route path="/myboxer/quest" element={<ProtectedRoute><MyBoxerQuestPage /></ProtectedRoute>} />
        <Route path="/myboxer/community" element={<ProtectedRoute><MyBoxerCommunityPage /></ProtectedRoute>} />
        <Route path="/training-library" element={<ProtectedRoute><TrainingLibraryPage /></ProtectedRoute>} />
        <Route path="/routine-builder" element={<ProtectedRoute><ManagerRoute><RoutineBuilderPage /></ManagerRoute></ProtectedRoute>} />
        <Route path="/routines" element={<ProtectedRoute><RoutinesPage /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><BoxingLibraryPage /></ProtectedRoute>} />
        <Route path="/live-board/:branchCode" element={<LiveBoardPage />} />
        {/* 사이니지용 짧은 주소 — 리모컨으로 치기 쉽게. /tv/sunreung/1 처럼 화면 번호를 붙이면
            나란히 놓인 2대에 좌·우로 나눠 띄운다(번호 없으면 예전처럼 한 화면에 전부). */}
        {/* 지점 코드 없이 /tv 만 치면 지점 선택 화면 — TV 리모컨 입력을 줄이려는 것 */}
        <Route path="/tv" element={<TvBranchPicker />} />
        <Route path="/tv/:branchCode" element={<LiveBoardPage />} />
        <Route path="/tv/:branchCode/:screen" element={<LiveBoardPage />} />
        <Route path="/face-kiosk/:branchCode" element={<FaceKioskPage />} />
        {/* 설치형 앱 전용 — 지점은 키오스크 키가 결정한다(주소에 지점코드 불필요) */}
        <Route path="/face-kiosk" element={<FaceKioskPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      {/* 토스트는 라우터 안에 둬야 경로를 알 수 있다 — TV에 토스트가 뜨면 안 된다 */}
      {!signage && <Toaster />}
      {!signage && <Sonner />}
      {!signage && <BottomNav />}
      {!signage && <ChatAssistant />}
      {/* 마이복서153 — 오삼 마스코트 튜토리얼 (행동기반 미션 5개). */}
      {user && splashDone && !signage && <TutorialFloatingMascotWithDetect />}
      {/* 5개 미션 spotlight 가이드 — navTarget 페이지에서 어떤 element 누를지 안내 */}
      {user && splashDone && !signage && <TutorialActionSpotlight />}
      {/* 첫 로그인 환영 모달 — 신규 회원 1회 노출, 오삼이 코치 인사 + 앱 핵심 안내 */}
      {user && splashDone && !signage && <OsamiWelcomeModal />}
      {/* 감동편지 — 웰컴 1통 + 리그 승급(블루/레드/블랙) 3통, localStorage 1회 노출 */}
      {user && splashDone && !signage && <WelcomeLetter />}
      {/* 7일 스타터 캠프 overlay — localStorage 기반, isActive 시에만 렌더 */}
      {user && splashDone && !signage && <TutorialCampProvider />}
      {/* 개발자 preview 패널 — localhost / ?tutorialDev=1 / dev 토글 ON 일 때만 노출 */}
      {user && splashDone && !signage && <TutorialDevPanel />}
      {/* 64-V: 관리자 floating 커스텀 도구 — 화면 위 element picker + 토글 */}
      {user && splashDone && !signage && <TutorialCustomizer />}
      {/* 활동 후 30초 마무리 sheet — 글로벌 trigger 이벤트 listen, 하루 1회 큰 sheet */}
      {user && splashDone && !signage && <PostActionReflectionSheet />}
      {/* 최초 로그인 아이디·비번 변경 권장(스킵 가능) — 일괄등록 회원 must_change_credentials */}
      {user && splashDone && !signage && <CredentialChangePrompt />}
      {/* 소셜 첫 로그인 전화번호 연동(권장·스킵) — phone 없는 소셜 회원 */}
      {user && splashDone && !signage && <LinkAccountPrompt />}
      {/* 쿨드 스타트 스플래시 (z-[80] · 포털). 세션 1회. */}
      {showSplash && !signage && <AppLaunchSplash onFinished={markFinished} />}
      {/* 안드로이드 뒤로가기로 앱이 그냥 꺼지지 않게 — 홈에서 한 번 물어본다 */}
      <ExitConfirm open={exitAsk} onClose={() => setExitAsk(false)} />
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
      {/* 65-O: 다크/라이트 모드 — next-themes 가 <html class> 토글.
          · defaultTheme="dark" — 기존 비주얼 그대로 유지
          · enableSystem=false — 회원 명시적 선택만 (OS 변경에 휘둘리지 않음)
          · storageKey="myboxer-theme" — localStorage 키 */}
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="myboxer-theme"
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <BrowserRouter>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
