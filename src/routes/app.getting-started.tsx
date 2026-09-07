import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import {
  OnboardingChecklistFull,
  type OnboardingRole,
} from "@/components/OnboardingChecklist";

export const Route = createFileRoute("/app/getting-started")({
  component: GettingStartedPage,
  head: () => ({
    meta: [
      { title: "Getting started · Makao360" },
      { name: "description", content: "Role-aware onboarding checklist for landlords, tenants and admins on Makao360." },
    ],
  }),
});

function GettingStartedPage() {
  const { loading, session, roles } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" search={{ redirect: "/app/getting-started", invite: undefined }} />;

  const role: OnboardingRole = roles.includes("admin")
    ? "admin"
    : roles.includes("landlord")
      ? "landlord"
      : "tenant";

  const otherRoles = (["landlord", "tenant", "admin"] as OnboardingRole[]).filter(
    (r) => r !== role && roles.includes(r),
  );

  const dashboardTo = role === "admin" ? "/app/admin" : role === "landlord" ? "/app/landlord" : "/app/tenant";

  return (
    <div className="min-h-screen bg-background px-4 lg:px-8 py-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={dashboardTo}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Getting started"
        description="A guided tour of Makao360 tailored to your role. Check items off as you go — progress is saved on this device."
      />

      <OnboardingChecklistFull role={role} />
      {otherRoles.length > 0 && (
        <div className="mt-8 space-y-6">
          <h2 className="font-display text-lg font-semibold">Also available to you</h2>
          {otherRoles.map((r) => (
            <OnboardingChecklistFull key={r} role={r} />
          ))}
        </div>
      )}
    </div>
  );
}
