import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatKES, formatDateTime } from "@/lib/format";
import { Landmark, CheckCircle2, XCircle, Search, Inbox, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/landlord/reconciliation")({
  component: ReconciliationQueue,
});

type PendingContribution = {
  id: string;
  amount: number;
  source: string;
  contributed_at: string;
  payer_phone: string | null;
  external_ref: string | null;
  note: string | null;
  tenant_id: string;
  lease_id: string;
  leases: {
    units: {
      label: string;
      properties: { name: string };
    } | null;
  } | null;
  tenant_profile?: { full_name: string | null; phone: string | null } | null;
};

function ReconciliationQueue() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<PendingContribution | null>(null);
  const [decision, setDecision] = useState<"success" | "failed" | null>(null);
  const [note, setNote] = useState("");
  const [inlineError, setInlineError] = useState<{ title: string; description?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["landlord-pending-contributions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get landlord's leases first, then pending contributions
      const { data: leases, error: lErr } = await supabase
        .from("leases")
        .select("id")
        .eq("landlord_id", user!.id);
      if (lErr) throw lErr;
      const leaseIds = (leases ?? []).map((l) => l.id);
      if (!leaseIds.length) return [] as PendingContribution[];

      const { data, error } = await supabase
        .from("contributions")
        .select(
          "id,amount,source,contributed_at,payer_phone,external_ref,note,tenant_id,lease_id,leases(units(label,properties(name)))",
        )
        .eq("status", "pending")
        .in("lease_id", leaseIds)
        .order("contributed_at", { ascending: true });
      if (error) throw error;

      const tenantIds = Array.from(new Set((data ?? []).map((c) => c.tenant_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,full_name,phone")
        .in("user_id", tenantIds);
      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, { full_name: p.full_name, phone: p.phone }]),
      );

      return (data as unknown as PendingContribution[]).map((c) => ({
        ...c,
        tenant_profile: profileMap.get(c.tenant_id) ?? null,
      }));
    },
  });

  const { data: driftRows } = useQuery({
    queryKey: ["ledger-drift"],
    enabled: !!user && hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ledger_consistency");
      if (error) throw error;
      return data as Array<{ lease_id: string; drift: number }>;
    },
  });
  const driftCount = driftRows?.length ?? 0;
  const driftTotal = (driftRows ?? []).reduce((s, r) => s + Math.abs(Number(r.drift) || 0), 0);

  const reconcile = useMutation({
    mutationFn: async (vars: { id: string; decision: "success" | "failed"; note: string }) => {
      const { error } = await supabase.rpc("reconcile_contribution", {
        _contribution_id: vars.id,
        _decision: vars.decision,
        _note: vars.note || undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.decision === "success"
          ? "Marked as received. Tenant has been notified."
          : "Rejected. Tenant has been notified.",
      );
      setActive(null);
      setDecision(null);
      setNote("");
      setInlineError(null);
      void qc.invalidateQueries({ queryKey: ["landlord-pending-contributions"] });
      void qc.invalidateQueries({ queryKey: ["ledger-drift"] });
    },
    onError: (e: unknown) => {
      const raw = e instanceof Error ? e.message : String(e);
      let friendly = raw;
      let description: string | undefined;
      if (/not authorized/i.test(raw)) {
        friendly = "You don't have permission to reconcile this transfer";
        description = "Only the lease's landlord (or an admin) can confirm or reject it.";
      } else if (/Only pending/i.test(raw)) {
        friendly = "Already reconciled";
        description = "This contribution was already confirmed or rejected. Refreshing the list…";
        void qc.invalidateQueries({ queryKey: ["landlord-pending-contributions"] });
      } else if (/Contribution not found/i.test(raw)) {
        friendly = "Contribution no longer exists";
        description = "It may have been removed. The list will refresh.";
        void qc.invalidateQueries({ queryKey: ["landlord-pending-contributions"] });
      } else if (/Not authenticated/i.test(raw)) {
        friendly = "Your session expired";
        description = "Sign in again to continue reconciling.";
      } else if (/Decision must be/i.test(raw)) {
        friendly = "Invalid decision";
      } else if (/PGRST00[12]|schema cache|503|504|fetch|network/i.test(raw)) {
        friendly = "Backend is reloading — please try again in a moment";
      }
      setInlineError({ title: friendly, description });
    },
  });

  const filtered = (data ?? []).filter((c) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    const hay = [
      c.external_ref,
      c.payer_phone,
      c.tenant_profile?.full_name,
      c.leases?.units?.label,
      c.leases?.units?.properties?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });

  const totalPending = (data ?? []).reduce((s, c) => s + c.amount, 0);
  const bankCount = (data ?? []).filter((c) => c.source === "bank").length;

  return (
    <div>
      <PageHeader
        title="Reconciliation queue"
        description="Pending bank transfers waiting for you to confirm receipt."
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Pending items" value={data?.length ?? 0} tone="warning" />
        <StatCard label="Bank transfers" value={bankCount} />
        <StatCard label="Total value" value={formatKES(totalPending)} tone="primary" />
      </div>

      {hasRole("admin") && driftCount > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="size-9 rounded-full grid place-items-center bg-warning/25 text-warning-foreground shrink-0">
            <AlertTriangle className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">
              Ledger drift detected on {driftCount} lease{driftCount === 1 ? "" : "s"}
            </div>
            <div className="text-sm text-muted-foreground">
              Combined drift: <span className="font-semibold">{formatKES(driftTotal)}</span>.
              Review the consistency report to investigate.
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/admin">
              Open report <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by tenant, reference, phone, or unit"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Inbox className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">
            {data?.length ? "No matches" : "Nothing to reconcile"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length
              ? "Try a different search."
              : "When tenants log a bank transfer, it will appear here for confirmation."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Logged</th>
                <th className="text-left px-4 py-3">Tenant</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Unit</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Reference</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const unit = c.leases?.units;
                const tenant = c.tenant_profile;
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(c.contributed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{tenant?.full_name ?? "Tenant"}</div>
                      <div className="text-xs text-muted-foreground">
                        {tenant?.phone ?? c.payer_phone ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {unit ? `${unit.properties.name} — ${unit.label}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatKES(c.amount)}</div>
                      <Badge variant="secondary" className="mt-1 inline-flex items-center gap-1">
                        <Landmark className="size-3" />
                        {c.source === "bank" ? "Bank" : c.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs">
                      {c.external_ref ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2"
                        onClick={() => {
                          setActive(c);
                          setDecision("failed");
                          setNote("");
                        }}
                      >
                        <XCircle className="size-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setActive(c);
                          setDecision("success");
                          setNote("");
                        }}
                      >
                        <CheckCircle2 className="size-4 mr-1" /> Confirm
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!active}
        onOpenChange={(o) => {
          if (!o) {
            setActive(null);
            setDecision(null);
            setNote("");
            setInlineError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "success" ? "Confirm receipt" : "Reject this transfer"}
            </DialogTitle>
            <DialogDescription>
              {decision === "success"
                ? "This will credit the lease, update the cycle, and notify the tenant."
                : "The tenant will be notified that the transfer wasn't matched. Add a note so they know what to do."}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <div className="rounded-xl bg-muted/40 p-4 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Tenant: </span>
                <span className="font-medium">
                  {active.tenant_profile?.full_name ?? "Tenant"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Amount: </span>
                <span className="font-medium">{formatKES(active.amount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Reference: </span>
                <span className="font-mono">{active.external_ref ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Logged: </span>
                {formatDateTime(active.contributed_at)}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Note {decision === "failed" ? "(recommended)" : "(optional)"}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                decision === "success"
                  ? "e.g. Matched on 28 Apr at 10:15 via Equity statement."
                  : "e.g. Reference doesn't match any deposit on my statement."
              }
              rows={3}
            />
          </div>

          {inlineError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-destructive">{inlineError.title}</div>
                  {inlineError.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {inlineError.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActive(null);
                setDecision(null);
                setInlineError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={decision === "failed" ? "destructive" : "default"}
              disabled={reconcile.isPending}
              onClick={() => {
                if (!active || !decision) return;
                setInlineError(null);
                reconcile.mutate({ id: active.id, decision, note });
              }}
            >
              {reconcile.isPending
                ? "Saving…"
                : decision === "success"
                  ? "Mark as received"
                  : "Reject transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
