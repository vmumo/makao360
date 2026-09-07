import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { OnboardingChecklistCard } from "@/components/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatKES, formatDateTime } from "@/lib/format";
import {
  ShieldAlert,
  Database,
  Trash2,
  RefreshCw,
  BellRing,
  Sparkles,
  AlertTriangle,
  Users,
  Map as MapIcon,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/")({
  component: AdminScreen,
});

type Drift = {
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  expected_balance: number;
  ledger_balance: number;
  drift: number;
  contributions_total: number;
  payouts_total: number;
  last_ledger_at: string | null;
};

function AdminScreen() {
  const { hasRole, loading } = useAuth();
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<null | "wipe">(null);

  const driftQuery = useQuery({
    queryKey: ["admin-ledger-drift"],
    enabled: !loading && hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ledger_consistency");
      if (error) throw error;
      return (data ?? []) as Drift[];
    },
  });

  const counts = useQuery({
    queryKey: ["admin-counts"],
    enabled: !loading && hasRole("admin"),
    queryFn: async () => {
      const tables = [
        "profiles",
        "user_roles",
        "properties",
        "units",
        "leases",
        "rent_cycles",
        "contributions",
        "payouts",
        "notifications",
      ] as const;
      const results = await Promise.all(
        tables.map(async (t) => {
          const { count } = await supabase
            .from(t)
            .select("*", { count: "exact", head: true });
          return [t, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(results) as Record<(typeof tables)[number], number>;
    },
  });

  const friendlyError = (e: unknown) => {
    const raw = e instanceof Error ? e.message : String(e);
    if (/Admin only/i.test(raw)) return "Admin role required";
    if (/PGRST002|schema cache|503|504/i.test(raw))
      return "Backend is reloading — try again in a moment";
    return raw;
  };

  const wipe = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_wipe_demo_data");
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (data) => {
      toast.success("Demo data wiped", {
        description: `Deleted ${Object.values(data ?? {}).reduce((a, b) => a + b, 0)} rows across tables.`,
      });
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const topup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_topup_open_cycles");
      if (error) throw error;
      return data as { opened: number };
    },
    onSuccess: (data) => {
      toast.success(`Opened ${data.opened} new cycle(s)`);
      void qc.invalidateQueries({ queryKey: ["admin-counts"] });
      void qc.invalidateQueries({ queryKey: ["admin-ledger-drift"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const backfill = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_backfill_notifications");
      if (error) throw error;
      return data as { contribution_notifs: number; payout_notifs: number };
    },
    onSuccess: (data) => {
      toast.success("Notifications backfilled", {
        description: `${data.contribution_notifs} contributions + ${data.payout_notifs} payouts notified.`,
      });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["admin-counts"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;
  if (!hasRole("admin")) return <Navigate to="/app" />;

  const drift = driftQuery.data ?? [];
  const c = counts.data;

  return (
    <div className="min-h-screen bg-background px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <OnboardingChecklistCard role="admin" />
      <PageHeader
        title="Super admin"
        description="Reseed the platform, run consistency checks, and review system health."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/app/admin/market"><TrendingUp className="size-4 mr-1.5" />Market intel</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/admin/map"><MapIcon className="size-4 mr-1.5" />Platform map</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/admin/kyc"><ShieldAlert className="size-4 mr-1.5" />KYC queue</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/admin/settings"><Users className="size-4 mr-1.5" />Manage users</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Profiles" value={c?.profiles ?? "…"} />
        <StatCard label="Properties" value={c?.properties ?? "…"} />
        <StatCard label="Active leases" value={c?.leases ?? "…"} tone="primary" />
        <StatCard label="Open cycles" value={c?.rent_cycles ?? "…"} />
        <StatCard label="Contributions" value={c?.contributions ?? "…"} tone="success" />
        <StatCard label="Payouts" value={c?.payouts ?? "…"} />
        <StatCard label="Notifications" value={c?.notifications ?? "…"} />
        <StatCard label="Ledger drift" value={drift.length} tone={drift.length ? "warning" : "default"} />
      </div>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Reseed actions</h2>
            <p className="text-sm text-muted-foreground">
              Choose how aggressive to reset. Wipe is destructive — it removes properties, leases,
              and payments (but keeps user accounts and roles intact).
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <ActionCard
            tone="destructive"
            icon={<Trash2 className="size-4" />}
            title="Wipe demo data"
            description="Deletes all properties, units, leases, cycles, contributions, payouts, ledger entries, invites, and notifications. Auth users and roles stay."
            buttonLabel={wipe.isPending ? "Wiping…" : "Wipe everything"}
            disabled={wipe.isPending}
            onClick={() => setConfirmAction("wipe")}
          />
          <ActionCard
            tone="default"
            icon={<RefreshCw className="size-4" />}
            title="Top-up cycles"
            description="Opens a fresh rent cycle for every active lease that doesn't have one. Idempotent — safe to run repeatedly."
            buttonLabel={topup.isPending ? "Opening…" : "Run top-up"}
            disabled={topup.isPending}
            onClick={() => topup.mutate()}
          />
          <ActionCard
            tone="default"
            icon={<BellRing className="size-4" />}
            title="Backfill notifications"
            description="Generates missing in-app notifications for existing contributions and payouts. Won't duplicate."
            buttonLabel={backfill.isPending ? "Backfilling…" : "Backfill"}
            disabled={backfill.isPending}
            onClick={() => backfill.mutate()}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`size-10 rounded-full grid place-items-center ${
              drift.length
                ? "bg-warning/15 text-warning-foreground"
                : "bg-success/15 text-success"
            }`}
          >
            <Database className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Ledger consistency</h2>
            <p className="text-sm text-muted-foreground">
              Compares each lease's last ledger balance against the sum of successful contributions
              minus payouts. Drift = ledger − expected.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void driftQuery.refetch()}
            disabled={driftQuery.isFetching}
          >
            <RefreshCw className={`size-4 mr-1 ${driftQuery.isFetching ? "animate-spin" : ""}`} />
            Re-check
          </Button>
        </div>

        {driftQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Running check…</div>
        ) : driftQuery.error ? (
          <div className="rounded-lg bg-destructive/10 text-destructive-foreground p-3 text-sm">
            {friendlyError(driftQuery.error)}
          </div>
        ) : !drift.length ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Sparkles className="size-6 mx-auto text-success" />
            <p className="mt-2 text-sm font-medium">All ledgers reconcile cleanly.</p>
            <p className="text-xs text-muted-foreground">
              Every lease's ledger balance matches its contribution / payout history.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Lease</th>
                  <th className="text-right px-3 py-2">Contributions</th>
                  <th className="text-right px-3 py-2">Payouts</th>
                  <th className="text-right px-3 py-2">Expected</th>
                  <th className="text-right px-3 py-2">Ledger</th>
                  <th className="text-right px-3 py-2">Drift</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Last ledger</th>
                </tr>
              </thead>
              <tbody>
                {drift.slice(0, 50).map((d) => (
                  <tr key={d.lease_id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[120px]">
                      {d.lease_id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 text-right">{formatKES(d.contributions_total)}</td>
                    <td className="px-3 py-2 text-right">{formatKES(d.payouts_total)}</td>
                    <td className="px-3 py-2 text-right">{formatKES(d.expected_balance)}</td>
                    <td className="px-3 py-2 text-right">{formatKES(d.ledger_balance)}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={d.drift === 0 ? "secondary" : "destructive"}>
                        {d.drift > 0 ? "+" : ""}
                        {formatKES(d.drift)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                      {formatDateTime(d.last_ledger_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drift.length > 50 && (
              <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                Showing 50 of {drift.length} drifting leases.
              </div>
            )}
          </div>
        )}
      </section>

      <AlertDialog open={confirmAction === "wipe"} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              Wipe all demo data?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This deletes every property, unit, lease, rent cycle, contribution, payout,
                ledger entry, invite, and notification in the database.
              </span>
              <span className="block font-medium text-foreground">
                Auth users, profiles, and role assignments are kept.
              </span>
              <span className="inline-flex items-center gap-1 text-warning-foreground">
                <AlertTriangle className="size-4" />
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmAction(null);
                wipe.mutate();
              }}
            >
              Yes, wipe everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "default" | "destructive";
}) {
  return (
    <div className="rounded-xl border bg-background p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`size-8 rounded-lg grid place-items-center ${
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground flex-1 mb-3">{description}</p>
      <Button
        variant={tone === "destructive" ? "destructive" : "default"}
        size="sm"
        disabled={disabled}
        onClick={onClick}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
