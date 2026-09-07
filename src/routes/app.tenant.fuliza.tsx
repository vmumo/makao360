import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatKES, formatDate } from "@/lib/format";
import { Zap, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { RentFulizaDialog } from "@/components/RentFulizaDialog";

export const Route = createFileRoute("/app/tenant/fuliza")({
  component: FulizaPage,
});

type Advance = {
  id: string;
  lease_id: string;
  principal: number;
  fee: number;
  outstanding: number;
  status: "active" | "repaid" | "written_off" | "cancelled";
  due_date: string;
  reason: string | null;
  approved_at: string | null;
  repaid_at: string | null;
  created_at: string;
  leases?: { rent_amount: number; units?: { label: string; properties?: { name: string } } } | null;
};

function FulizaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [repayTarget, setRepayTarget] = useState<Advance | null>(null);
  const [repayAmount, setRepayAmount] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const { data: advances, isLoading } = useQuery({
    queryKey: ["tenant-advances", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rent_advances")
        .select("*, leases(rent_amount, units(label, properties(name)))")
        .eq("tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Advance[];
    },
  });

  const { data: leases } = useQuery({
    queryKey: ["tenant-leases-for-fuliza", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("id, rent_amount, units(label, properties(name))")
        .eq("tenant_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const list = advances ?? [];
    return {
      active: list.filter((a) => a.status === "active").length,
      outstanding: list
        .filter((a) => a.status === "active")
        .reduce((s, a) => s + a.outstanding, 0),
      lifetime: list.reduce((s, a) => s + a.principal, 0),
    };
  }, [advances]);

  const repay = useMutation({
    mutationFn: async () => {
      if (!repayTarget) throw new Error("No advance selected");
      const { data, error } = await supabase.rpc("repay_rent_fuliza", {
        _advance_id: repayTarget.id,
        _amount: repayAmount,
      });
      if (error) throw error;
      return data as { paid: number; remaining: number; status: string };
    },
    onSuccess: (res) => {
      toast.success(
        res.status === "repaid"
          ? "Rent Fuliza fully repaid 🎉"
          : `Paid ${formatKES(res.paid)}. Remaining: ${formatKES(res.remaining)}`,
      );
      setRepayTarget(null);
      setInlineError(null);
      void qc.invalidateQueries({ queryKey: ["tenant-advances"] });
    },
    onError: (e: unknown) => {
      const raw = e instanceof Error ? e.message : String(e);
      let friendly = raw;
      if (/not active/i.test(raw)) friendly = "This advance is no longer active";
      else if (/Not your advance/i.test(raw)) friendly = "Not your advance";
      else if (/PGRST00[12]|503|fetch|network/i.test(raw))
        friendly = "Backend is reloading — please try again";
      setInlineError(friendly);
    },
  });

  return (
    <div>
      <PageHeader
        title="Rent Fuliza"
        description="Short-term rent advances. Borrow when you need a few extra days."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard label="Active advances" value={stats.active} tone={stats.active ? "warning" : undefined} />
        <StatCard label="Outstanding" value={formatKES(stats.outstanding)} tone="primary" />
        <StatCard label="Lifetime borrowed" value={formatKES(stats.lifetime)} />
      </div>

      {leases && leases.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-warning/15 grid place-items-center text-warning shrink-0">
              <Zap className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold">Need a hand with rent this cycle?</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Borrow up to 50% of your monthly rent. 5% fee. Repay in 14 days.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {leases.map((l) => {
                  const u = l.units as unknown as { label: string; properties?: { name: string } } | null;
                  const hasActive = (advances ?? []).some(
                    (a) => a.lease_id === l.id && a.status === "active",
                  );
                  return (
                    <RentFulizaDialog
                      key={l.id}
                      leaseId={l.id}
                      rentAmount={l.rent_amount}
                      hasActiveAdvance={hasActive}
                      trigger={
                        <Button size="sm" variant={hasActive ? "outline" : "default"}>
                          <Zap className="size-4 mr-1.5" />
                          {u ? `${u.properties?.name ?? ""} ${u.label}` : "Lease"}
                          {hasActive && " (active)"}
                        </Button>
                      }
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <h3 className="font-display font-semibold mb-3">Your advances</h3>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !advances?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Zap className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">No advances yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            When you take a Rent Fuliza, you'll see the details, due date, and repayment progress here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {advances.map((a) => {
            const unit = a.leases?.units;
            const isActive = a.status === "active";
            return (
              <li key={a.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {unit ? `${unit.properties?.name ?? ""} — ${unit.label}` : "Advance"}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Borrowed {formatDate(a.created_at)} · Due {formatDate(a.due_date)}
                    </div>
                    {a.reason && (
                      <div className="text-xs text-muted-foreground mt-1 italic">
                        "{a.reason}"
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {isActive ? "Outstanding" : "Total"}
                    </div>
                    <div className="font-display text-xl font-bold">
                      {formatKES(isActive ? a.outstanding : a.principal + a.fee)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatKES(a.principal)} + {formatKES(a.fee)} fee
                    </div>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setRepayTarget(a);
                        setRepayAmount(a.outstanding);
                        setInlineError(null);
                      }}
                    >
                      Repay
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!repayTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRepayTarget(null);
            setInlineError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repay Rent Fuliza</DialogTitle>
            <DialogDescription>
              {repayTarget
                ? `You owe ${formatKES(repayTarget.outstanding)}. Pay any amount up to that balance.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              type="number"
              min={1}
              max={repayTarget?.outstanding}
              value={repayAmount}
              onChange={(e) => setRepayAmount(Number(e.target.value))}
            />
            {inlineError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{inlineError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRepayTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                repay.isPending || repayAmount < 1 || (!!repayTarget && repayAmount > repayTarget.outstanding)
              }
              onClick={() => {
                setInlineError(null);
                repay.mutate();
              }}
            >
              {repay.isPending ? "Processing…" : `Repay ${formatKES(repayAmount)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: Advance["status"] }) {
  if (status === "repaid")
    return (
      <Badge className="inline-flex items-center gap-1">
        <CheckCircle2 className="size-3" /> Repaid
      </Badge>
    );
  if (status === "active")
    return (
      <Badge variant="secondary" className="inline-flex items-center gap-1">
        <Clock className="size-3" /> Active
      </Badge>
    );
  return (
    <Badge variant="outline" className="capitalize">
      {status.replace("_", " ")}
    </Badge>
  );
}
