import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/app/landlord/payouts")({
  component: PayoutsPage,
});

function PayoutsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: completedCycles } = useQuery({
    queryKey: ["payable-cycles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rent_cycles")
        .select(`*, leases!inner(id, landlord_id, units(label, properties(name)),
                  profiles:tenant_id(full_name)),
                  payouts(id)`)
        .eq("leases.landlord_id", user!.id)
        .in("status", ["completed", "partial"])
        .order("period_end", { ascending: false });
      if (error) throw error;
      // filter cycles that don't already have a payout
      return (data ?? []).filter((c) => !(c.payouts as unknown[])?.length);
    },
  });

  const { data: payouts } = useQuery({
    queryKey: ["payouts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*, leases(units(label, properties(name)), profiles:tenant_id(full_name))")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const triggerPayout = async (leaseId: string, cycleId: string, amount: number) => {
    const { error } = await supabase.rpc("record_payout", {
      _lease_id: leaseId, _cycle_id: cycleId, _amount: amount,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Payout of ${formatKES(amount)} initiated`);
    void qc.invalidateQueries({ queryKey: ["payouts"] });
    void qc.invalidateQueries({ queryKey: ["payable-cycles"] });
  };

  return (
    <div>
      <PageHeader title="Payouts" description="Move accumulated rent to your account." />

      <h2 className="font-display font-semibold mb-3">Ready to payout</h2>
      <div className="rounded-2xl border bg-card mb-8 overflow-hidden">
        {!completedCycles?.length ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No cycles ready for payout.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Tenant / Unit</th>
                <th className="text-left px-4 py-3">Cycle</th>
                <th className="text-left px-4 py-3">Available</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {completedCycles.map((c) => {
                const lease = c.leases as unknown as { id: string; units: { label: string; properties: { name: string } }; profiles: { full_name: string | null } | null };
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{lease.profiles?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{lease.units.properties.name} — {lease.units.label}</div>
                    </td>
                    <td className="px-4 py-3">{formatDate(c.period_start)} → {formatDate(c.period_end)}</td>
                    <td className="px-4 py-3 font-medium">{formatKES(c.accumulated_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => triggerPayout(lease.id, c.id, c.accumulated_amount)}>
                        Payout {formatKES(c.accumulated_amount)}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="font-display font-semibold mb-3">History</h2>
      {!payouts?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Wallet className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">No payouts yet</h3>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Tenant / Unit</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Receipt</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const lease = p.leases as unknown as { units: { label: string; properties: { name: string } }; profiles: { full_name: string | null } | null } | null;
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{formatDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div>{lease?.profiles?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {lease ? `${lease.units.properties.name} — ${lease.units.label}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatKES(p.amount)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs">{p.mpesa_receipt ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
