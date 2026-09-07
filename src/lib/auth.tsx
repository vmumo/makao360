import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "tenant" | "landlord" | "caretaker" | "admin";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  /** Stored separately in profile_identity; not exposed on the shared profile row. */
  national_id?: string | null;

  avatar_url: string | null;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  preferred_role: AppRole | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  authError: string | null;
  /** True while a transient backend error is being retried in the background. */
  recovering: boolean;
  /** Current retry attempt (1-based) when recovering, otherwise 0. */
  recoveryAttempt: number;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Larger retry envelope for the chat-reported transient PGRST002/503s.
// 10 attempts with capped exponential backoff (~30s total wall time)
const MAX_PROFILE_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 350;
const MAX_BACKOFF_MS = 4000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);

  const loadProfileAndRoles = async (uid: string) => {
    setAuthError(null);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_PROFILE_ATTEMPTS; attempt++) {
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (rolesRes.error) throw rolesRes.error;
        setProfile((profileRes.data as Profile) ?? null);
        setRoles(((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role));
        setRecovering(false);
        setRecoveryAttempt(0);
        return;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          /PGRST00[12]|schema cache|fetch|network|Load failed|503|504|timeout|connection/i.test(msg);
        if (!isTransient || attempt === MAX_PROFILE_ATTEMPTS) throw err;
        // Show the recovery banner from attempt 2 onwards (first try is "normal loading")
        if (attempt >= 1) {
          setRecovering(true);
          setRecoveryAttempt(attempt);
        }
        const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    setRecovering(false);
    throw lastError;
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => {
          void loadProfileAndRoles(newSession.user.id).catch((error) => {
            setAuthError(error instanceof Error ? error.message : "Could not load account details");
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setRecovering(false);
        setRecoveryAttempt(0);
      }
    });

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) setAuthError(error.message);
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await loadProfileAndRoles(data.session.user.id).catch((error) => {
            setAuthError(error instanceof Error ? error.message : "Could not load account details");
          });
        }
        setLoading(false);
      })
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : "Could not connect to auth");
        setLoading(false);
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      await loadProfileAndRoles(user.id);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not load account details");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        loading,
        authError,
        recovering,
        recoveryAttempt,
        hasRole,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
