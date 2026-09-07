import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OnboardingRole = "landlord" | "tenant" | "admin";

type Step = { title: string; description: string; to: string; cta: string };

const STEPS: Record<OnboardingRole, Step[]> = {
  landlord: [
    { title: "Add your first property", description: "Register a building and its units so you can start renting them out.", to: "/app/landlord/properties", cta: "Open Properties" },
    { title: "Invite a tenant", description: "Send an invite once a unit is vacant. Tenants join instantly via SMS or link.", to: "/app/landlord/tenants", cta: "Invite tenant" },
    { title: "View your portfolio map", description: "See occupancy, arrears and revenue plotted across all your properties.", to: "/app/landlord/map", cta: "Open Map" },
    { title: "Reconcile a bank transfer", description: "Match pending payments to leases so tenants get credited correctly.", to: "/app/landlord/reconciliation", cta: "Open Reconcile" },
    { title: "Trigger a payout", description: "Send collected rent from your Makao wallet to your bank or M-Pesa.", to: "/app/landlord/payouts", cta: "Open Payouts" },
  ],
  tenant: [
    { title: "Complete your profile", description: "Add your ID for KYC so payments and receipts are properly attributed.", to: "/app/tenant/kyc", cta: "Verify ID" },
    { title: "See your active lease", description: "Review your rent amount, due date and cycle progress.", to: "/app/tenant/leases", cta: "Open Leases" },
    { title: "Make a rent contribution", description: "Contribute any amount towards your cycle via M-Pesa STK push.", to: "/app/tenant/payments", cta: "Open Payments" },
    { title: "Try Rent Fuliza", description: "Need a hand this month? Request a micro-advance towards rent.", to: "/app/tenant/fuliza", cta: "Open Fuliza" },
    { title: "Report a maintenance issue", description: "Send photos and a description straight to your landlord.", to: "/app/tenant/maintenance", cta: "Open Maintenance" },
  ],
  admin: [
    { title: "Review the KYC queue", description: "Approve or reject pending identity submissions from tenants.", to: "/app/admin/kyc", cta: "Open KYC" },
    { title: "Manage users & roles", description: "Search users, promote landlords, revoke access.", to: "/app/admin/settings", cta: "Open Users" },
    { title: "Inspect the platform map", description: "See every property across every landlord with occupancy signals.", to: "/app/admin/map", cta: "Open Map" },
    { title: "Audit ledger consistency", description: "Detect and resolve drift between contributions, payouts and the ledger.", to: "/app/admin", cta: "Open Admin" },
    { title: "Backfill notifications", description: "Retroactively send in-app alerts for older contributions and payouts.", to: "/app/admin", cta: "Run backfill" },
  ],
};

function storageKey(role: OnboardingRole) {
  return `makao360.onboarding.${role}`;
}

function useCompleted(role: OnboardingRole) {
  const key = storageKey(role);
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, [key]);
  const toggle = (title: string) => {
    setDone((d) => {
      const next = { ...d, [title]: !d[title] };
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };
  return { done, toggle };
}

function useDismissed(role: OnboardingRole) {
  const key = `${storageKey(role)}.dismissed`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(key) === "1");
  }, [key]);
  return {
    dismissed,
    dismiss: () => {
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        /* noop */
      }
      setDismissed(true);
    },
  };
}

export function OnboardingChecklistCard({ role }: { role: OnboardingRole }) {
  const steps = STEPS[role];
  const { done } = useCompleted(role);
  const { dismissed, dismiss } = useDismissed(role);
  if (dismissed) return null;
  const completed = steps.filter((s) => done[s.title]).length;
  const first = steps.find((s) => !done[s.title]) ?? steps[0];

  return (
    <div className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="font-display font-semibold">Get started with Makao360</div>
            <p className="text-sm text-muted-foreground">
              {completed} of {steps.length} steps complete — try this next:
            </p>
          </div>
        </div>
        <button
          aria-label="Dismiss checklist"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">{first.title}</div>
          <div className="text-xs text-muted-foreground">{first.description}</div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to={first.to}>
              {first.cta} <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/getting-started">See all</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingChecklistFull({ role }: { role: OnboardingRole }) {
  const steps = STEPS[role];
  const { done, toggle } = useCompleted(role);
  const completed = steps.filter((s) => done[s.title]).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {role} checklist
          </div>
          <div className="mt-1 font-display text-lg font-semibold">
            {completed}/{steps.length} steps complete
          </div>
        </div>
        <div className="text-3xl font-display font-bold text-primary">{pct}%</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => {
          const isDone = !!done[step.title];
          return (
            <li
              key={step.title}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4",
                isDone ? "border-primary/30 bg-primary/5" : "bg-background",
              )}
            >
              <button
                onClick={() => toggle(step.title)}
                aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 text-transparent hover:border-primary",
                )}
              >
                <Check className="size-3.5" />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                </div>
                <div className={cn("font-medium", isDone && "line-through text-muted-foreground")}>
                  {step.title}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">{step.description}</div>
              </div>
              <Button asChild size="sm" variant={isDone ? "outline" : "default"}>
                <Link to={step.to}>
                  {step.cta} <ChevronRight className="size-4" />
                </Link>
              </Button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
