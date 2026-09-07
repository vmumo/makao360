import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { OnboardingChecklistCard } from "@/components/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";
import { CycleProgress } from "@/components/CycleProgress";
import { ContributeDialog } from "@/components/ContributeDialog";
import { BankTransferDialog } from "@/components/BankTransferDialog";
import { RentFulizaDialog } from "@/components/RentFulizaDialog";
import { ArrowRight, Sparkles, Receipt, Calendar, Smartphone, FileBadge } from "lucide-react";

export const Route = createFileRoute("/app/tenant/")({
  component: TenantHome,
});

type Cycle = {
  id: string; period_start: string; period_end: string; due_date: string;
  target_amount: number; accumulated_amount: number; status: string;
};

function TenantHome() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: leases, isLoading } = useQuery({
    queryKey: ["tenant-leases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select(`
          *, units(label, properties(name, address)),
          rent_cycles(id, period_start, period_end, due_date, target_amount, accumulated_amount, status)
        `)
        .eq("tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contribs } = useQuery({
    queryKey: ["tenant-contribs-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, status, source, contributed_at, mpesa_receipt, external_ref, leases(units(label, properties(name)))")
        .eq("tenant_id", user!.id)
        .order("contributed_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!leases?.length) {
    return (
      <div>
        <PageHeader title={`Karibu, ${profile?.full_name ?? "tenant"}`}
                    description="You don't have an active lease yet." />
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <Sparkles className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">Got an invite code?</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Open the link your landlord sent, or paste the invite code below.
          </p>
          <InviteCodeForm />
        </div>
      </div>
    );
  }

  // Aggregate stats across leases
  const totals = leases.reduce(
    (acc, l) => {
      const cycles = (l.rent_cycles ?? []) as Cycle[];
      const current = cycles.find((c) => c.status === "open" || c.status === "partial");
      const target = current?.target_amount ?? l.rent_amount;
      const paid = current?.accumulated_amount ?? 0;
      acc.dueNow += Math.max(0, target - paid);
      acc.paidThisCycle += paid;
      acc.lifetimePaid += cycles.reduce((s, c) => s + (c.accumulated_amount ?? 0), 0);
      acc.nextDue = !acc.nextDue || (current && current.due_date < acc.nextDue) ? current?.due_date ?? acc.nextDue : acc.nextDue;
      return acc;
    },
    { dueNow: 0, paidThisCycle: 0, lifetimePaid: 0, nextDue: "" as string },
  );

  return (
    <div>
      <OnboardingChecklistCard role="tenant" />
      <PageHeader
        title={`Karibu, ${profile?.full_name?.split(" ")[0] ?? "tenant"}`}
        description="Track your rent and contribute anytime."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/mobile-preview"
              search={{ tab: "pay" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              <Smartphone className="size-3.5" /> Open mobile · Pay
            </Link>
            <Link
              to="/mobile-preview"
              search={{ tab: "passport" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              <FileBadge className="size-3.5" /> Open Passport
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard tone="primary" label="Due now" value={formatKES(totals.dueNow)} sub={totals.nextDue ? `Next due ${formatDate(totals.nextDue)}` : ""} />
        <StatCard tone="warm" label="Paid this cycle" value={formatKES(totals.paidThisCycle)} />
        <StatCard label="Lifetime paid" value={formatKES(totals.lifetimePaid)} />
        <StatCard label="Active leases" value={String(leases.length)} />
      </div>

      <div className="mt-6 space-y-6">
        {leases.map((lease) => {
          const cycles = (lease.rent_cycles ?? []) as Cycle[];
          const currentCycle = cycles.find((c) => c.status === "open" || c.status === "partial")
            ?? cycles.sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
          const upcoming = cycles
            .filter((c) => c.status === "open" || c.status === "partial")
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .slice(0, 3);
          const unit = lease.units as { label: string; properties: { name: string; address: string | null } | null } | null;
          return (
            <LeaseCard
              key={lease.id}
              leaseId={lease.id}
              unitLabel={unit?.label ?? "—"}
              propertyName={unit?.properties?.name ?? "Property"}
              rentAmount={lease.rent_amount}
              cycle={currentCycle}
              upcoming={upcoming}
              onChange={() => qc.invalidateQueries({ queryKey: ["tenant-leases"] })}
            />
          );
        })}
      </div>

      {/* Recent contributions */}
      <div className="mt-8 rounded-2xl border bg-card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Receipt className="size-4" /> Recent contributions
          </h3>
          <Link to="/app/tenant/payments" className="text-sm text-primary hover:underline">
            View all <ArrowRight className="size-3 inline" />
          </Link>
        </div>
        {!contribs?.length ? (
          <p className="text-sm text-muted-foreground">No contributions yet.</p>
        ) : (
          <ul className="divide-y">
            {contribs.map((c) => {
              const lease = c.leases as unknown as { units: { label: string; properties: { name: string } } | null } | null;
              return (
                <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {lease?.units ? `${lease.units.properties?.name ?? "Property"} — ${lease.units.label}` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(c.contributed_at)} · {(c.source ?? "").replace("_", " ")} · {c.mpesa_receipt ?? c.external_ref ?? ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatKES(c.amount)}</div>
                    <Badge
                      variant={c.status === "success" ? "default" : c.status === "pending" ? "secondary" : "destructive"}
                      className="capitalize text-[10px]"
                    >
                      {c.status}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function LeaseCard({
  leaseId, unitLabel, propertyName, rentAmount, cycle, upcoming, onChange,
}: {
  leaseId: string;
  unitLabel: string;
  propertyName: string;
  rentAmount: number;
  cycle?: Cycle;
  upcoming: Cycle[];
  onChange: () => void;
}) {
  const target = cycle?.target_amount ?? rentAmount;
  const accumulated = cycle?.accumulated_amount ?? 0;
  const remaining = Math.max(0, target - accumulated);

  return (
    <div className="rounded-3xl bg-gradient-brand text-primary-foreground p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-80">{propertyName}</div>
          <div className="font-display text-2xl font-bold">Unit {unitLabel}</div>
          {cycle && (
            <div className="text-xs opacity-80 mt-1">
              Cycle {formatDate(cycle.period_start)} → {formatDate(cycle.period_end)} · Due {formatDate(cycle.due_date)}
            </div>
          )}
        </div>
        <CycleProgress value={accumulated} target={target} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Target" value={formatKES(target)} />
        <Stat label="Paid" value={formatKES(accumulated)} />
        <Stat label="Remaining" value={formatKES(remaining)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ContributeDialog leaseId={leaseId} suggested={remaining || target} onDone={onChange} />
        <BankTransferDialog leaseId={leaseId} suggested={remaining || target} onDone={onChange} />
        <RentFulizaDialog
          leaseId={leaseId}
          rentAmount={rentAmount}
          hasActiveAdvance={false}
          onDone={onChange}
        />
        <Button asChild variant="secondary" size="sm">
          <Link to="/app/tenant/leases/$leaseId" params={{ leaseId }}>
            View lease <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>

      {upcoming.length > 1 && (
        <div className="mt-5 rounded-xl bg-white/10 p-3">
          <div className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1.5">
            <Calendar className="size-3.5" /> Upcoming
          </div>
          <ul className="mt-1.5 space-y-1 text-sm">
            {upcoming.slice(1).map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>Due {formatDate(c.due_date)}</span>
                <span className="font-medium">{formatKES(c.target_amount - c.accumulated_amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <div className="text-[11px] uppercase opacity-80">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function InviteCodeForm() {
  return (
    <form
      className="mt-4 flex max-w-sm mx-auto gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const code = String(fd.get("code") ?? "").trim();
        if (code) window.location.href = `/invite/${code}`;
      }}
    >
      <Input name="code" placeholder="Invite code" required />
      <Button type="submit">Open</Button>
    </form>
  );
}
