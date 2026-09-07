import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatKES, formatDateTime } from "@/lib/format";
import { History, Search, CheckCircle2, XCircle, X } from "lucide-react";

export const Route = createFileRoute("/app/landlord/audit")({
  component: AuditTrail,
});

type AuditRow = {
  contribution_id: string;
  amount: number;
  source: string;
  status: string;
  reconciled_at: string;
  reconciled_by: string;
  reconciled_by_name: string | null;
  reconciliation_note: string | null;
  tenant_id: string;
  tenant_name: string | null;
  lease_id: string;
  unit_label: string | null;
  property_name: string | null;
  external_ref: string | null;
};

function AuditTrail() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reconciliation-audit", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_reconciliation_audit", { _limit: 500 });
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  // Derive option lists for tenant/reviewer dropdowns
  const tenantOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.tenant_id) map.set(r.tenant_id, r.tenant_name ?? "Tenant");
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const reviewerOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.reconciled_by) map.set(r.reconciled_by, r.reconciled_by_name ?? "Reviewer");
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    return data.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tenantFilter !== "all" && r.tenant_id !== tenantFilter) return false;
      if (reviewerFilter !== "all" && r.reconciled_by !== reviewerFilter) return false;
      if (fromTs || toTs) {
        const ts = new Date(r.reconciled_at).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      if (!needle) return true;
      const hay = [
        r.tenant_name,
        r.reconciled_by_name,
        r.reconciliation_note,
        r.external_ref,
        r.property_name,
        r.unit_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [data, q, statusFilter, tenantFilter, reviewerFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const success = filtered.filter((r) => r.status === "success");
    const failed = filtered.filter((r) => r.status === "failed");
    return {
      total: filtered.length,
      confirmed: success.length,
      rejected: failed.length,
      value: success.reduce((s, r) => s + r.amount, 0),
    };
  }, [filtered]);

  const hasActiveFilters =
    !!q || statusFilter !== "all" || tenantFilter !== "all" || reviewerFilter !== "all" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setQ("");
    setStatusFilter("all");
    setTenantFilter("all");
    setReviewerFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div>
      <PageHeader
        title="Reconciliation audit trail"
        description="Every confirmed or rejected bank transfer, who actioned it, and when."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total decisions" value={totals.total} />
        <StatCard label="Confirmed" value={totals.confirmed} tone="success" />
        <StatCard label="Rejected" value={totals.rejected} tone="warning" />
        <StatCard label="Value confirmed" value={formatKES(totals.value)} tone="primary" />
      </div>

      <div className="rounded-2xl border bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search note, reference, unit…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decisions</SelectItem>
              <SelectItem value="success">Confirmed</SelectItem>
              <SelectItem value="failed">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              {tenantOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Reviewer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviewers</SelectItem>
              {reviewerOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              aria-label="From date"
            />
          </div>
          <div>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              aria-label="To date"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} of {data?.length ?? 0} decisions match your filters</span>
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="size-3.5 mr-1" /> Clear
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          Could not load audit trail: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <History className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">
            {data?.length ? "Nothing matches your filters" : "No reconciliation history yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length
              ? "Try clearing filters or using a different search term."
              : "Once you confirm or reject pending bank transfers, the history will appear here."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Decision</th>
                <th className="text-left px-4 py-3">Reviewer</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Tenant / Unit</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.contribution_id} className="border-t align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateTime(r.reconciled_at)}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "success" ? (
                      <Badge className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Confirmed
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="inline-flex items-center gap-1">
                        <XCircle className="size-3" /> Rejected
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.reconciled_by_name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="font-medium">{r.tenant_name ?? "Tenant"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.property_name && r.unit_label
                        ? `${r.property_name} — ${r.unit_label}`
                        : "—"}
                    </div>
                    {r.external_ref && (
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">
                        {r.external_ref}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {formatKES(r.amount)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground max-w-xs">
                    {r.reconciliation_note ?? <span className="italic">No note</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
