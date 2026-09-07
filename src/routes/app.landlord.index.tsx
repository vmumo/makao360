import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { OnboardingChecklistCard } from "@/components/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";
import { Building2, Plus, Users, AlertCircle, Wallet, ArrowRight, AlertTriangle, Smartphone, FileBadge, Home } from "lucide-react";
import { useVacantUnits } from "@/hooks/use-vacant-units";

export const Route = createFileRoute("/app/landlord/")({
  component: LandlordOverview,
});

type CycleRow = {
  id: string;
  target_amount: number;
  accumulated_amount: number;
  status: string;
  due_date: string;
  period_start: string;
  period_end: string;
  lease_id: string;
  leases: {
    landlord_id: string;
    units: { label: string; properties: { name: string } } | null;
    profiles: { full_name: string | null } | null;
  };
};

function LandlordOverview() {
  const { user } = useAuth();
  const { count: vacantCount, hasVacancy } = useVacantUnits();

  const { data, isLoading } = useQuery({
    queryKey: ["landlord-overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [props, units, leases, openCycles, allCycles, payouts, recentContribs] = await Promise.all([
        supabase.from("properties").select("id, name, units(id, status)").eq("landlord_id", user!.id),
        supabase.from("units").select("id, status, rent_amount, properties!inner(landlord_id)").eq("properties.landlord_id", user!.id),
        supabase.from("leases").select("id, status").eq("landlord_id", user!.id),
        supabase.from("rent_cycles")
          .select(`id, target_amount, accumulated_amount, status, due_date, period_start, period_end, lease_id,
                   leases!inner(landlord_id, units(label, properties(name)), profiles:tenant_id(full_name))`)
          .eq("leases.landlord_id", user!.id)
          .in("status", ["open", "partial"])
          .order("due_date", { ascending: true })
          .limit(50),
        supabase.from("rent_cycles")
          .select("target_amount, accumulated_amount, status, leases!inner(landlord_id)")
          .eq("leases.landlord_id", user!.id),
        supabase.from("payouts")
          .select("id, amount, status, paid_at, created_at, mpesa_receipt, leases(units(label, properties(name)))")
          .eq("landlord_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("contributions")
          .select("id, amount, status, contributed_at, source, mpesa_receipt, leases!inner(landlord_id, units(label, properties(name)), profiles:tenant_id(full_name))")
          .eq("leases.landlord_id", user!.id)
          .order("contributed_at", { ascending: false })
          .limit(8),
      ]);
      const unitsList = units.data ?? [];
      const allC = allCycles.data ?? [];
      const openC = (openCycles.data ?? []) as unknown as CycleRow[];
      const propsList = props.data ?? [];
      const payoutsList = payouts.data ?? [];
      const expectedThisCycle = openC.reduce((s, c) => s + (c.target_amount ?? 0), 0);
      const accumulatedThisCycle = openC.reduce((s, c) => s + (c.accumulated_amount ?? 0), 0);
      const pendingThisCycle = Math.max(0, expectedThisCycle - accumulatedThisCycle);
      const totalCollected = allC.reduce((s, c) => s + (c.accumulated_amount ?? 0), 0);
      const totalExpected = allC.reduce((s, c) => s + (c.target_amount ?? 0), 0);
      return {
        properties: propsList,
        propertyCount: propsList.length,
        unitCount: unitsList.length,
        occupiedCount: unitsList.filter((u) => u.status === "occupied").length,
        leaseCount: leases.data?.length ?? 0,
        expectedThisCycle,
        accumulatedThisCycle,
        pendingThisCycle,
        totalCollected,
        totalExpected,
        openCycles: openC,
        recentPayouts: payoutsList,
        recentContribs: recentContribs.data ?? [],
        paidOutTotal: payoutsList.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0),
        pendingPayouts: payoutsList.filter((p) => p.status === "pending").reduce((s, p) => s + (p.amount ?? 0), 0),
      };
    },
  });

  const occupancy = data && data.unitCount ? Math.round((data.occupiedCount / data.unitCount) * 100) : 0;
  const collectedPct = data && data.expectedThisCycle ? Math.round((data.accumulatedThisCycle / data.expectedThisCycle) * 100) : 0;

  const overdue = (data?.openCycles ?? []).filter((c) => new Date(c.due_date) < new Date() && c.accumulated_amount < c.target_amount);

  return (
    <div>
      <OnboardingChecklistCard role="landlord" />
      <PageHeader
        title="Welcome back"
        description="Your portfolio at a glance."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Link to="/mobile-preview" search={{ tab: "pay" }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
              <Smartphone className="size-3.5" /> Tenant mobile · Pay
            </Link>
            <Link to="/mobile-preview" search={{ tab: "passport" }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
              <FileBadge className="size-3.5" /> Tenant Passport
            </Link>
            <Link to="/app/landlord/tenants" className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/20">
              <Home className="size-3.5" /> Vacancies
              <Badge variant={hasVacancy ? "default" : "secondary"} className="ml-1">{vacantCount}</Badge>
            </Link>
            <Button asChild>
              <Link to="/app/landlord/properties"><Plus className="size-4 mr-2" /> Add property</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          tone="primary"
          label="Expected this cycle"
          value={isLoading ? "…" : formatKES(data?.expectedThisCycle ?? 0)}
          sub={`${data?.leaseCount ?? 0} active leases`}
        />
        <StatCard
          tone="warm"
          label="Paid in"
          value={isLoading ? "…" : formatKES(data?.accumulatedThisCycle ?? 0)}
          sub={`${collectedPct}% of target`}
        />
        <StatCard
          label="Pending"
          value={isLoading ? "…" : formatKES(data?.pendingThisCycle ?? 0)}
          sub={overdue.length ? `${overdue.length} overdue` : "On track"}
        />
        <StatCard
          label="Paid out"
          value={isLoading ? "…" : formatKES(data?.paidOutTotal ?? 0)}
          sub={data?.pendingPayouts ? `${formatKES(data.pendingPayouts)} pending` : "No pending payouts"}
        />
      </div>

      {/* Cycle progress + occupancy */}
      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display font-semibold">Collection this cycle</h3>
            <span className="text-sm text-muted-foreground">
              {formatKES(data?.accumulatedThisCycle ?? 0)} / {formatKES(data?.expectedThisCycle ?? 0)}
            </span>
          </div>
          <Progress value={collectedPct} className="mt-3 h-3" />
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Mini label="Lifetime collected" value={formatKES(data?.totalCollected ?? 0)} />
            <Mini label="Lifetime expected" value={formatKES(data?.totalExpected ?? 0)} />
            <Mini label="Overdue cycles" value={String(overdue.length)} accent={overdue.length > 0} />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-display font-semibold">Occupancy</h3>
          <div className="mt-2 text-3xl font-display font-bold">{occupancy}%</div>
          <div className="text-xs text-muted-foreground">{data?.occupiedCount ?? 0} of {data?.unitCount ?? 0} units</div>
          <Progress value={occupancy} className="mt-3 h-2" />
          <div className="mt-3 text-xs text-muted-foreground">{data?.propertyCount ?? 0} properties</div>
        </div>
      </div>

      {/* Properties status */}
      {!!data?.properties.length && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-semibold">Properties</h3>
            <Link to="/app/landlord/properties" className="text-sm text-primary hover:underline">
              View all <ArrowRight className="size-3 inline" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.properties.slice(0, 6).map((p) => {
              const total = (p.units as { status: string }[] | null)?.length ?? 0;
              const occ = (p.units as { status: string }[] | null)?.filter((u) => u.status === "occupied").length ?? 0;
              const pct = total ? Math.round((occ / total) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  to="/app/landlord/properties/$propertyId"
                  params={{ propertyId: p.id }}
                  className="rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-card transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{p.name}</div>
                    <Badge variant="secondary">{occ}/{total}</Badge>
                  </div>
                  <Progress value={pct} className="mt-2 h-1.5" />
                  <div className="mt-1 text-xs text-muted-foreground">{pct}% occupied</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> Overdue cycles
          </h3>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Tenant / Unit</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Due</th>
                  <th className="text-left px-4 py-3">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {overdue.slice(0, 6).map((c) => {
                  const remaining = (c.target_amount ?? 0) - (c.accumulated_amount ?? 0);
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.leases.profiles?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.leases.units ? `${c.leases.units.properties.name} — ${c.leases.units.label}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">{formatDate(c.due_date)}</td>
                      <td className="px-4 py-3 font-medium text-destructive">{formatKES(remaining)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent activity: contributions + payouts */}
      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-semibold">Recent contributions</h3>
          </div>
          {!data?.recentContribs.length ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recentContribs.map((c) => {
                const lease = c.leases as unknown as { units: { label: string; properties: { name: string } } | null; profiles: { full_name: string | null } | null };
                return (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{lease.profiles?.full_name ?? "Tenant"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {lease.units ? `${lease.units.properties.name} — ${lease.units.label}` : ""} · {formatDateTime(c.contributed_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatKES(c.amount)}</div>
                      <Badge variant={c.status === "success" ? "default" : c.status === "pending" ? "secondary" : "destructive"} className="capitalize text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-semibold">Recent payouts</h3>
            <Link to="/app/landlord/payouts" className="text-sm text-primary hover:underline">
              <Wallet className="size-3 inline mr-1" /> Manage
            </Link>
          </div>
          {!data?.recentPayouts.length ? (
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recentPayouts.map((p) => {
                const lease = p.leases as unknown as { units: { label: string; properties: { name: string } } | null } | null;
                return (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {lease?.units ? `${lease.units.properties.name} — ${lease.units.label}` : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(p.paid_at ?? p.created_at)} · {p.mpesa_receipt ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatKES(p.amount)}</div>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"} className="capitalize text-[10px]">
                        {p.status}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <QuickAction
          icon={Building2}
          title="Add a property"
          description="Create properties and assign units. Bulk import supported."
          to="/app/landlord/properties"
        />
        <QuickAction
          icon={Users}
          title="Invite a tenant"
          description="Send an invite by phone — they'll join their unit and start contributing."
          to="/app/landlord/tenants"
        />
      </div>

      {data && data.unitCount === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
          <AlertCircle className="size-6 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">Let's get you set up</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first property and unit to start tracking rent.
          </p>
          <Button asChild className="mt-4">
            <Link to="/app/landlord/properties">Add property</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon, title, description, to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border bg-card p-5 hover:shadow-card hover:border-primary/40 transition"
    >
      <div className="flex items-start gap-4">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="font-display font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
    </Link>
  );
}
