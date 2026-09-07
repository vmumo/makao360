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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatKES, formatDateTime, formatDate } from "@/lib/format";
import { Receipt, Search, Smartphone, Landmark, Printer, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tenant/payments")({
  component: TenantPayments,
});

type Source = "all" | "mpesa_stk" | "bank" | "cash" | "other";
type Status = "all" | "success" | "pending" | "failed";

type Contribution = {
  id: string;
  amount: number;
  status: string;
  source: string;
  contributed_at: string;
  created_at: string;
  payer_phone: string | null;
  mpesa_receipt: string | null;
  external_ref: string | null;
  note: string | null;
  cycle_id: string | null;
  lease_id: string;
  leases:
    | {
        units?: {
          label: string;
          properties: { name: string; address: string | null };
        } | null;
      }
    | null;
};

function sourceLabel(s: string) {
  if (s === "mpesa_stk" || s === "mpesa_paybill") return "M-Pesa";
  if (s === "bank") return "Bank";
  if (s === "cash") return "Cash";
  if (s === "card") return "Card";
  return "Other";
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  if (source === "mpesa_stk" || source === "mpesa_paybill")
    return <Smartphone className={className ?? "size-4 text-success"} />;
  if (source === "bank")
    return <Landmark className={className ?? "size-4 text-primary"} />;
  return <Receipt className={className ?? "size-4 text-muted-foreground"} />;
}

function TenantPayments() {
  const { user } = useAuth();
  const [source, setSource] = useState<Source>("all");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Contribution | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-contributions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select(
          "id,amount,status,source,contributed_at,created_at,payer_phone,mpesa_receipt,external_ref,note,cycle_id,lease_id,leases(units(label,properties(name,address)))",
        )
        .eq("tenant_id", user!.id)
        .order("contributed_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Contribution[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.filter((c) => {
      if (source !== "all" && c.source !== source) return false;
      if (status !== "all" && c.status !== status) return false;
      if (needle) {
        const hay = [
          c.mpesa_receipt,
          c.external_ref,
          c.payer_phone,
          c.note,
          c.leases?.units?.label,
          c.leases?.units?.properties?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, source, status, q]);

  const totals = useMemo(() => {
    const all = filtered;
    const sum = (xs: Contribution[]) => xs.reduce((s, c) => s + c.amount, 0);
    return {
      total: sum(all.filter((c) => c.status === "success")),
      mpesa: sum(all.filter((c) => c.source === "mpesa_stk" && c.status === "success")),
      bank: sum(all.filter((c) => c.source === "bank" && c.status === "success")),
      pending: sum(all.filter((c) => c.status === "pending")),
    };
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="My contributions"
        description="Every M-Pesa, bank, and other rent contribution you've made."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total paid" value={formatKES(totals.total)} tone="primary" />
        <StatCard label="Via M-Pesa" value={formatKES(totals.mpesa)} tone="success" />
        <StatCard label="Via Bank" value={formatKES(totals.bank)} />
        <StatCard label="Pending" value={formatKES(totals.pending)} tone="warning" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by receipt, reference, phone, or unit"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={source} onValueChange={(v) => setSource(v as Source)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="mpesa_stk">M-Pesa</SelectItem>
            <SelectItem value="bank">Bank transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Receipt className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">
            {data?.length ? "No contributions match your filters" : "No contributions yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length
              ? "Try clearing filters or searching for a different reference."
              : "Make your first contribution from the home tab."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Reference</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Unit</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const unit = c.leases?.units;
                const ref = c.mpesa_receipt ?? c.external_ref ?? "—";
                return (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(c.contributed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <SourceIcon source={c.source} />
                        <span>{sourceLabel(c.source)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatKES(c.amount)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs">{ref}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {unit ? `${unit.properties?.name ?? "Property"} — ${unit.label}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          c.status === "success"
                            ? "default"
                            : c.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(c);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ContributionDetailDialog
        contribution={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function ContributionDetailDialog({
  contribution,
  onClose,
}: {
  contribution: Contribution | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const open = !!contribution;
  const c = contribution;
  const unit = c?.leases?.units;
  const ref = c?.mpesa_receipt ?? c?.external_ref ?? "";

  const copyRef = async () => {
    if (!ref) return;
    await navigator.clipboard.writeText(ref);
    setCopied(true);
    toast.success("Reference copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const printReceipt = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg print:shadow-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            Contribution receipt
          </DialogTitle>
          <DialogDescription>
            Keep this for your records. You can print or copy the reference.
          </DialogDescription>
        </DialogHeader>

        {c && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-brand text-primary-foreground p-5">
              <div className="text-xs uppercase tracking-wider opacity-80">Amount</div>
              <div className="font-display text-3xl font-bold mt-1">
                {formatKES(c.amount)}
              </div>
              <div className="mt-2 inline-flex items-center gap-2 text-sm">
                <SourceIcon source={c.source} className="size-4" />
                {sourceLabel(c.source)} · {formatDateTime(c.contributed_at)}
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
              <dt className="text-muted-foreground col-span-1">Status</dt>
              <dd className="col-span-2">
                <Badge
                  variant={
                    c.status === "success"
                      ? "default"
                      : c.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                  className="capitalize"
                >
                  {c.status}
                </Badge>
              </dd>

              <dt className="text-muted-foreground col-span-1">Reference</dt>
              <dd className="col-span-2 font-mono break-all flex items-center gap-2">
                {ref || "—"}
                {ref && (
                  <button
                    type="button"
                    onClick={copyRef}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Copy reference"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </button>
                )}
              </dd>

              <dt className="text-muted-foreground col-span-1">Payer phone</dt>
              <dd className="col-span-2">{c.payer_phone ?? "—"}</dd>

              <dt className="text-muted-foreground col-span-1">Unit</dt>
              <dd className="col-span-2">
                {unit
                  ? `${unit.properties?.name ?? "Property"} — ${unit.label}`
                  : "—"}
              </dd>

              {unit?.properties?.address && (
                <>
                  <dt className="text-muted-foreground col-span-1">Address</dt>
                  <dd className="col-span-2">{unit.properties.address}</dd>
                </>
              )}

              <dt className="text-muted-foreground col-span-1">Logged</dt>
              <dd className="col-span-2">{formatDate(c.created_at)}</dd>

              {c.note && (
                <>
                  <dt className="text-muted-foreground col-span-1">Note</dt>
                  <dd className="col-span-2">{c.note}</dd>
                </>
              )}
            </dl>

            {c.status === "pending" && c.source === "bank" && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                Awaiting confirmation from your landlord. They'll mark this as
                received once your transfer hits their account.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={printReceipt}>
            <Printer className="size-4 mr-2" /> Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
