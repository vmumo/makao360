import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";
import { ChevronLeft, Download, CheckCircle2, Smartphone, CalendarClock } from "lucide-react";
import { CycleProgress } from "@/components/CycleProgress";
import { ContributeDialog } from "@/components/ContributeDialog";
import { generateRentStatementPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { useAccessLog } from "@/hooks/use-access-log";
import { BilledBy } from "@/components/BilledBy";

const leaseSearchSchema = z.object({
  cycles: z.enum(["active", "all"]).catch("active").default("active"),
});

export const Route = createFileRoute("/app/tenant/leases/$leaseId")({
  validateSearch: leaseSearchSchema,
  component: LeaseDetail,
});

function LeaseDetail() {
  const { leaseId } = Route.useParams();
  const { cycles: cycleFilter } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/tenant/leases/$leaseId" });
  const qc = useQueryClient();
  useAccessLog("leases", leaseId);
  const setCycleFilter = (v: "active" | "all") =>
    void navigate({ search: (prev: { cycles: "active" | "all" }) => ({ ...prev, cycles: v }), replace: true });

  const { data: lease } = useQuery({
    queryKey: ["lease", leaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select(`*, units(label, properties(name, address)),
                 tenant:tenant_id(full_name, phone),
                 landlord:landlord_id(full_name, phone)`)
        .eq("id", leaseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cycles } = useQuery({
    queryKey: ["lease-cycles", leaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rent_cycles")
        .select("*")
        .eq("lease_id", leaseId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contributions } = useQuery({
    queryKey: ["lease-contributions", leaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .eq("lease_id", leaseId)
        .order("contributed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["lease-invoices", leaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("lease_id", leaseId)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const arrears = (invoices ?? [])
    .filter((i) => i.status !== "paid" && i.status !== "void" && new Date(i.due_date) <= new Date())
    .reduce((sum, i) => sum + (i.amount_due - i.amount_paid), 0);



  if (!lease) return <div className="text-sm text-muted-foreground">Loading lease…</div>;
  const unit = lease.units as { label: string; properties: { name: string; address: string | null } };
  const tenant = lease.tenant as unknown as { full_name: string | null; phone: string | null } | null;
  const landlord = lease.landlord as unknown as { full_name: string | null; phone: string | null } | null;

  const activeCycle = cycles?.find((c) => c.status === "open" || c.status === "partial");
  const remaining = activeCycle ? Math.max(0, activeCycle.target_amount - activeCycle.accumulated_amount) : 0;

  const onDownload = (cycleId: string) => {
    const c = cycles?.find((x) => x.id === cycleId);
    if (!c) return;
    const doc = generateRentStatementPdf({
      property: unit.properties.name,
      unit: unit.label,
      address: unit.properties.address,
      tenantName: tenant?.full_name ?? null,
      tenantPhone: tenant?.phone ?? null,
      landlordName: landlord?.full_name ?? null,
      landlordPhone: landlord?.phone ?? null,
      cycle: {
        period_start: c.period_start, period_end: c.period_end, due_date: c.due_date,
        target_amount: c.target_amount, accumulated_amount: c.accumulated_amount, status: c.status,
      },
      contributions: (contributions ?? [])
        .filter((x) => x.cycle_id === cycleId)
        .map((x) => ({
          amount: x.amount,
          contributed_at: x.contributed_at,
          mpesa_receipt: x.mpesa_receipt,
          payer_phone: x.payer_phone,
        })),
    });
    const filename = `Makao360-statement-${unit.label}-${c.period_start.slice(0,7)}.pdf`;
    doc.save(filename);
    toast.success("Statement downloaded");
  };

  return (
    <div>
      <Link to="/app/tenant/leases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="size-4" /> Back to leases
      </Link>
      <PageHeader
        title={`${unit.properties.name} · Unit ${unit.label}`}
        description={`Lease started ${formatDate(lease.start_date)} · Landlord: ${landlord?.full_name ?? "—"}`}
        actions={
          activeCycle && lease.status === "active" ? (
            <ContributeDialog
              leaseId={leaseId}
              suggested={remaining || activeCycle.target_amount}
              onDone={() => {
                void qc.invalidateQueries({ queryKey: ["lease-cycles", leaseId] });
                void qc.invalidateQueries({ queryKey: ["lease-contributions", leaseId] });
              }}
              trigger={
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Smartphone className="size-4 mr-1.5" /> Contribute now
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="grid sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Monthly rent" value={formatKES(lease.rent_amount)} />
        <Stat label="Deposit" value={formatKES(lease.deposit_amount)} />
        <Stat label="Arrears" value={formatKES(arrears)} />
        <Stat label="Status" value={lease.status} capitalize />
      </div>

      <BilledBy landlordId={lease.landlord_id} fallbackName={landlord?.full_name ?? null} />

      <div className="mb-8">
        <h2 className="font-display font-semibold mb-3">Invoices</h2>
        {!invoices?.length ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground text-center">
            No invoices raised yet. One is created for every rent cycle.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Due</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 12).map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKES(inv.amount_due)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKES(inv.amount_paid)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "secondary" : "outline"}
                        className="capitalize"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.status !== "paid" && inv.status !== "void" && lease.status === "active" ? (
                        <ContributeDialog
                          leaseId={leaseId}
                          suggested={inv.amount_due - inv.amount_paid}
                          onDone={() => {
                            void qc.invalidateQueries({ queryKey: ["lease-invoices", leaseId] });
                            void qc.invalidateQueries({ queryKey: ["lease-cycles", leaseId] });
                            void qc.invalidateQueries({ queryKey: ["lease-contributions", leaseId] });
                          }}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Smartphone className="size-4 mr-1.5" /> Pay
                            </Button>
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display font-semibold">Rent cycles</h2>
        <ToggleGroup
          type="single"
          size="sm"
          value={cycleFilter}
          onValueChange={(v) => v && setCycleFilter(v as "active" | "all")}
          className="bg-muted/50 rounded-lg p-0.5"
        >
          <ToggleGroupItem value="active" className="text-xs px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
            Active only
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="text-xs px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
            All cycles
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-3 mb-8">
        {(() => {
          const filtered = (cycles ?? []).filter((c) =>
            cycleFilter === "all" ? true : c.status === "open" || c.status === "partial"
          );
          if (!filtered.length && cycles?.length) {
            // Compute the next upcoming cycle date based on the latest period_end + 1 day
            const latestEnd = cycles
              .map((c) => new Date(c.period_end))
              .sort((a, b) => b.getTime() - a.getTime())[0];
            const nextStart = latestEnd ? new Date(latestEnd.getTime() + 86400000) : null;
            const dueDay = Math.min(Math.max(lease.rent_due_day ?? 1, 1), 28);
            const nextDue = nextStart
              ? new Date(nextStart.getFullYear(), nextStart.getMonth(), dueDay)
              : null;
            return (
              <div className="rounded-2xl border border-dashed bg-muted/20 p-6 sm:p-8 text-center">
                <div className="size-12 rounded-xl bg-accent/10 text-accent grid place-items-center mx-auto">
                  <CalendarClock className="size-6" />
                </div>
                <h3 className="mt-3 font-display font-semibold text-base sm:text-lg">
                  You're all caught up
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  No open or partial cycles for this lease right now.
                  {nextStart && (
                    <> Your next cycle starts <span className="font-medium text-foreground">{formatDate(nextStart.toISOString())}</span>{nextDue && <> with rent due <span className="font-medium text-foreground">{formatDate(nextDue.toISOString())}</span></>}.</>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setCycleFilter("all")}
                >
                  Show all cycles
                </Button>
              </div>
            );
          }
          return filtered.map((c) => {
          const cycContribs = contributions?.filter((x) => x.cycle_id === c.id) ?? [];
          const isActive = c.status === "open" || c.status === "partial";
          const cycleRemaining = Math.max(0, c.target_amount - c.accumulated_amount);
          return (
            <div key={c.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium">
                    {formatDate(c.period_start)} → {formatDate(c.period_end)}
                  </div>
                  <div className="text-xs text-muted-foreground">Due {formatDate(c.due_date)}</div>
                  <div className="mt-2 text-sm">
                    {formatKES(c.accumulated_amount)} of {formatKES(c.target_amount)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={c.status === "completed" ? "default" : c.status === "partial" ? "secondary" : "outline"} className="capitalize">
                    {c.status === "completed" && <CheckCircle2 className="size-3 mr-1" />} {c.status}
                  </Badge>
                  <CycleProgress value={c.accumulated_amount} target={c.target_amount} size={56} light />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isActive && lease.status === "active" && (
                  <ContributeDialog
                    leaseId={leaseId}
                    suggested={cycleRemaining || c.target_amount}
                    onDone={() => {
                      void qc.invalidateQueries({ queryKey: ["lease-cycles", leaseId] });
                      void qc.invalidateQueries({ queryKey: ["lease-contributions", leaseId] });
                    }}
                    trigger={
                      <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Smartphone className="size-4 mr-1.5" /> Contribute to this cycle
                      </Button>
                    }
                  />
                )}
                <Button size="sm" variant="outline" onClick={() => onDownload(c.id)}>
                  <Download className="size-4 mr-1.5" /> Download statement
                </Button>
              </div>
              {cycContribs.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {cycContribs.length} contribution{cycContribs.length > 1 ? "s" : ""}
                  </summary>
                  <ul className="mt-2 text-sm divide-y">
                    {cycContribs.map((x) => (
                      <li key={x.id} className="py-2 flex justify-between gap-3">
                        <div>
                          <div>{formatKES(x.amount)}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(x.contributed_at)}</div>
                        </div>
                        <div className="text-xs font-mono text-muted-foreground self-center">{x.mpesa_receipt}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
          });
        })()}
        {!cycles?.length && (
          <div className="text-sm text-muted-foreground">No cycles yet.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display font-semibold mt-1 ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}
