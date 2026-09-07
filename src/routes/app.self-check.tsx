import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

const checks: { label: string; to: string; search?: Record<string, string> }[] = [
  { label: "App router", to: "/app" },
  { label: "Landlord overview", to: "/app/landlord" },
  { label: "Landlord tenants", to: "/app/landlord/tenants" },
  { label: "Landlord properties", to: "/app/landlord/properties" },
  { label: "Landlord payouts", to: "/app/landlord/payouts" },
  { label: "Tenant dashboard", to: "/app/tenant" },
  { label: "Tenant leases", to: "/app/tenant/leases" },
  { label: "Tenant payments", to: "/app/tenant/payments" },
  { label: "Mobile preview · Home", to: "/mobile-preview" },
  { label: "Mobile preview · Pay (Fuliza)", to: "/mobile-preview?tab=pay" },
  { label: "Mobile preview · Passport", to: "/mobile-preview?tab=passport" },
  { label: "Mobile preview · Me", to: "/mobile-preview?tab=me" },
];

export const Route = createFileRoute("/app/self-check")({
  component: SelfCheckPage,
});

function SelfCheckPage() {
  const { session, profile, roles } = useAuth();
  const ready = Boolean(session && profile);

  return (
    <div>
      <PageHeader
        title="App self-check"
        description="Quick route and session check for Makao360 after sign-in."
        actions={
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="size-4" /> Refresh check
          </Button>
        }
      />
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-start gap-3">
          {ready ? <CheckCircle2 className="mt-0.5 size-5 text-accent" /> : <CircleAlert className="mt-0.5 size-5 text-warning" />}
          <div>
            <h2 className="font-display font-semibold">{ready ? "Session is ready" : "Session is still incomplete"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready
                ? `Signed in as ${profile?.full_name ?? "User"}${roles.length ? ` · ${roles.join(", ")}` : ""}.`
                : "If this stays here, refresh or sign in again so routes can mount with a complete profile."}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <a key={check.to} href={check.to} className="rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{check.label}</div>
                <div className="text-xs text-muted-foreground">{check.to}</div>
              </div>
              <CheckCircle2 className="size-4 text-accent" />
            </div>
          </a>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
        If a page fails to mount, Makao360 will show the branded recovery screen with refresh and copy-error actions.
      </div>
    </div>
  );
}