import { createFileRoute, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

function AppShell() {
  const {
    loading,
    session,
    profile,
    roles,
    signOut,
    authError,
    refreshProfile,
    recovering,
    recoveryAttempt,
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !session) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/app") return;
    if (roles.includes("landlord") || roles.includes("admin") || profile?.preferred_role === "landlord") {
      void navigate({ to: "/app/landlord" });
    } else {
      void navigate({ to: "/app/tenant" });
    }
  }, [loading, session, roles, profile?.preferred_role, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
        </div>
      </div>
    );
  }

  if (!session) {
    const redirect = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/app";
    return <Navigate to="/login" search={{ redirect, invite: undefined }} />;
  }

  // Profile not loaded yet AND we are still recovering: show non-blocking loader
  if (!profile && recovering && !authError) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-sm text-center">
          <Logo className="justify-center" />
          <Loader2 className="size-6 mx-auto mt-5 animate-spin text-primary" />
          <h1 className="mt-3 font-display text-lg font-semibold">Reconnecting to your account…</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The backend is briefly unavailable. We're retrying automatically (attempt {recoveryAttempt}/10).
          </p>
        </div>
      </div>
    );
  }

  // Only show terminal error screen after retries exhausted
  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-sm text-center">
          <Logo className="justify-center" />
          <h1 className="mt-5 font-display text-xl font-semibold">We could not finish loading your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {authError || "Your sign-in worked, but your profile record was not returned. Refresh or sign out and try again."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => void refreshProfile()}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Refresh page</Button>
            <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {recovering && (
        <div className="fixed top-0 inset-x-0 z-50 bg-warning/15 border-b border-warning/30 px-4 py-2 text-xs flex items-center justify-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          <span className="text-foreground">
            Reconnecting to backend… (attempt {recoveryAttempt}/10)
          </span>
        </div>
      )}
      <Outlet />
    </>
  );
}
