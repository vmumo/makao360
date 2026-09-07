import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Upload, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useLandlordBalance } from "@/hooks/use-landlord-balance";
import { Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatKES } from "@/lib/format";

export const Route = createFileRoute("/app/landlord/banking")({
  component: BankingPage,
  head: () => ({
    meta: [
      { title: "Bank & M-Pesa reconciliation — Makao360" },
      { name: "description", content: "Import bank or M-Pesa statement lines and match them against tenant payments automatically." },
    ],
  }),
});

type ParsedRow = {
  txn_date: string;
  narrative: string;
  amount: number;
  reference: string | null;
  counterparty_phone: string | null;
};

// Accepts CSV / pasted statement rows: date, narrative, amount, reference, phone
function parseStatement(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) continue;
    const [date, narrative, amountRaw, reference, phone] = cols;
    if (/date/i.test(date) && /narrat|desc/i.test(narrative)) continue; // header
    const amount = Number(String(amountRaw).replace(/[^\d.-]/g, ""));
    const parsedDate = new Date(date);
    if (!Number.isFinite(amount) || amount === 0 || Number.isNaN(parsedDate.getTime())) continue;
    rows.push({
      txn_date: parsedDate.toISOString().slice(0, 10),
      narrative: narrative || "Statement line",
      amount,
      reference: reference || null,
      counterparty_phone: phone || null,
    });
  }
  return rows;
}

function BankingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: balance } = useLandlordBalance(user?.id ?? null);
  const [sourceLabel, setSourceLabel] = useState("M-Pesa statement");
  const [paste, setPaste] = useState("");
  const [statusFilter, setStatusFilter] = useState("unmatched");

  const { data: imports } = useQuery({
    queryKey: ["bank-imports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statement_imports").select("*")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: txns } = useQuery({
    queryKey: ["bank-txns", user?.id, statusFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("bank_transactions").select("*")
        .eq("landlord_id", user!.id)
        .order("txn_date", { ascending: false }).limit(300);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as "unmatched");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pending } = useQuery({
    queryKey: ["bank-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, payer_phone, contributed_at, external_ref, leases!inner(landlord_id, units(label))")
        .eq("leases.landlord_id", user!.id)
        .eq("status", "pending")
        .order("contributed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const doImport = useMutation({
    mutationFn: async () => {
      const rows = parseStatement(paste);
      if (!rows.length) throw new Error("No usable rows found. Use: date, narrative, amount, reference, phone");
      const { data: imp, error: impErr } = await supabase
        .from("bank_statement_imports")
        .insert({
          landlord_id: user!.id,
          source_label: sourceLabel,
          row_count: rows.length,
          period_start: rows.reduce((m, r) => (r.txn_date < m ? r.txn_date : m), rows[0].txn_date),
          period_end: rows.reduce((m, r) => (r.txn_date > m ? r.txn_date : m), rows[0].txn_date),
          created_by: user!.id,
        })
        .select("id").single();
      if (impErr) throw impErr;

      const { error: txErr } = await supabase.from("bank_transactions").insert(
        rows.map((r) => ({ ...r, landlord_id: user!.id, import_id: imp.id })),
      );
      if (txErr) throw txErr;

      const { data: matched, error: matchErr } = await supabase
        .rpc("auto_match_bank_transactions", { _import_id: imp.id });
      if (matchErr) throw matchErr;
      return { rows: rows.length, matched: (matched as { matched?: number } | null)?.matched ?? 0 };
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.rows} lines — ${r.matched} auto-matched`);
      setPaste("");
      void qc.invalidateQueries({ queryKey: ["bank-imports"] });
      void qc.invalidateQueries({ queryKey: ["bank-txns"] });
      void qc.invalidateQueries({ queryKey: ["landlord-balance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const match = useMutation({
    mutationFn: async ({ txnId, contributionId }: { txnId: string; contributionId: string }) => {
      const { error } = await supabase.rpc("match_bank_transaction", {
        _txn_id: txnId, _contribution_id: contributionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matched and posted to the ledger");
      void qc.invalidateQueries({ queryKey: ["bank-txns"] });
      void qc.invalidateQueries({ queryKey: ["landlord-balance"] });
      void qc.invalidateQueries({ queryKey: ["bank-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ignore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_transactions").update({ status: "ignored" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line ignored");
      void qc.invalidateQueries({ queryKey: ["bank-txns"] });
      void qc.invalidateQueries({ queryKey: ["landlord-balance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Bank & M-Pesa reconciliation"
        description="Import statement lines, auto-match them to tenant payments and clear the exceptions."
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Bank balance</div>
          <div className="mt-1 text-2xl font-display font-bold">{formatKES(balance?.balance ?? 0)}</div>
          <div className="text-xs text-muted-foreground">Matched credits minus settled payouts</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownLeft className="h-3.5 w-3.5" /> Received (matched)</div>
          <div className="mt-1 text-2xl font-display font-bold text-accent">{formatKES(balance?.matchedIn ?? 0)}</div>
          <div className="text-xs text-muted-foreground">
            {balance?.unmatchedCount ?? 0} unmatched lines · {formatKES(balance?.unmatchedTotal ?? 0)} pending review
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpRight className="h-3.5 w-3.5" /> Paid out</div>
          <div className="mt-1 text-2xl font-display font-bold">{formatKES(balance?.paidOut ?? 0)}</div>
          <div className="text-xs text-muted-foreground">Settled landlord payouts</div>
        </div>
      </div>


      <div className="rounded-2xl border bg-card p-5 mb-6">
        <div className="flex items-center gap-2 font-medium mb-3">
          <Upload className="h-4 w-4" /> Import statement lines
        </div>
        <div className="grid gap-3 sm:grid-cols-[220px_1fr] items-start">
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Paste CSV rows</Label>
            <Textarea
              rows={5} value={paste} onChange={(e) => setPaste(e.target.value)}
              placeholder={"2026-03-04, RENT PAYMENT JOHN M, 25000, QGH12ABCD, +254712345678"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Columns: date, narrative, amount, reference, phone. Header row is ignored.
            </p>
          </div>
        </div>
        <Button className="mt-4" onClick={() => doImport.mutate()} disabled={doImport.isPending || !paste.trim()}>
          <Wand2 className="h-4 w-4 mr-2" />
          {doImport.isPending ? "Importing…" : "Import & auto-match"}
        </Button>
        {!!imports?.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {imports.slice(0, 6).map((i) => (
              <Badge key={i.id} variant="outline">
                {i.source_label} · {i.row_count} rows · {i.matched_count} matched
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs">Show</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unmatched">Unmatched</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
              <SelectItem value="all">All lines</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {!txns?.length ? (
          <div className="p-10 text-center">
            <Banknote className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">Nothing to review</div>
            <p className="text-sm text-muted-foreground mt-1">
              Import a statement above to start reconciling against tenant payments.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Narrative</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Match to payment</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.txn_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.narrative}</div>
                      <div className="text-xs text-muted-foreground">
                        {[t.reference, t.counterparty_phone].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatKES(Number(t.amount))}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status === "matched" ? "secondary" : "outline"} className="capitalize">
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === "unmatched" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            onValueChange={(v) => match.mutate({ txnId: t.id, contributionId: v })}
                          >
                            <SelectTrigger className="w-64"><SelectValue placeholder="Pick pending payment" /></SelectTrigger>
                            <SelectContent>
                              {(pending ?? []).map((c) => {
                                const lease = c.leases as unknown as { units: { label: string } | null } | null;
                                return (
                                  <SelectItem key={c.id} value={c.id}>
                                    {formatKES(Number(c.amount))} · {lease?.units?.label ?? "unit"} · {formatDate(c.contributed_at)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" onClick={() => ignore.mutate(t.id)}>Ignore</Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t.matched_at ? formatDate(t.matched_at) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
