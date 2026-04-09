import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Tables, Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Tables<"profiles"> | null;
  role: AppRole | null;
  progress: Tables<"member_progress"> | null;
  loading: boolean;
  refreshProgress: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, name: string, nickname: string, phoneNumber: string, branchName: string, isCoach?: boolean) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [progress, setProgress] = useState<Tables<"member_progress"> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileRes, roleRes, progressRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      supabase.from("member_progress").select("*").eq("user_id", userId).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (roleRes.data) setRole(roleRes.data.role);
    if (progressRes.data) setProgress(progressRes.data);
  }, []);

  const refreshProgress = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("member_progress")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (data) setProgress(data);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchUserData(user.id);
  }, [user, fetchUserData]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setProgress(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, name: string, nickname: string, phoneNumber: string, branchName: string, isCoach?: boolean) => {
    // Check phone uniqueness first
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (existing) {
      return { error: new Error("이미 등록된 전화번호입니다. 한 번호당 하나의 계정만 가능합니다.") };
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, nickname, phone_number: phoneNumber, branch_name: branchName, is_coach_request: isCoach || false },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: new Error(error.message) };

    // If coach signup, sign out immediately so they wait for admin approval
    if (isCoach && data.user) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setProgress(null);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: new Error(error.message) };

    // Check if user has a pending coach request — block login
    if (data.user) {
      const { data: pendingReq } = await supabase
        .from("coach_requests")
        .select("status")
        .eq("user_id", data.user.id)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingReq) {
        await supabase.auth.signOut();
        return { error: new Error("관장님 가입 승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다.") };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setProgress(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, progress, loading, refreshProgress, refreshProfile, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
