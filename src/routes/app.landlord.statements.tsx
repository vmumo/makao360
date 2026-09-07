import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Percent, Printer, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatKES } from "@/lib/format";

export const Route = createFileRoute("/app/landlord/statements")({
  component: StatementsPage,
  head: () => ({
    meta: [
      { title: "Owner statements & fees — Makao360" },
      { name: "description", content: "Monthly owner statements with rent collected, expenses, management fees, withholding tax and net payout." },
    ],
  }),
});

function lastMonthStart() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}

type Breakdown = {
  rent_collected?: number;
  late_fees?: number;
  expenses?: Array<{ category: string; amount: number }>;
  units?: number;
  leases?: number;
};

function StatementsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(lastMonthStart());
  const [propertyId, setPropertyId] = useState<string>("all");
  const [openStatement, setOpenStatement] = useState<string | null>(null);

  const { data: properties } = useQuery({
    queryKey: ["stmt-properties", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties").select("id, name").eq("landlord_id", user!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: statements } = useQuery({
    queryKey: ["owner-statements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_statements")
        .select("*, properties(name)")
        .eq("landlord_id", user!.id)
        .order("period_start", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tax } = useQuery({
    queryKey: ["tax-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlord_tax_settings").select("*").eq("landlord_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["late-fee-rules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("late_fee_rules").select("*, properties(name)")
        .eq("landlord_id", user!.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: charges } = useQuery({
    queryKey: ["late-fee-charges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("late_fee_charges")
        .select("*")
        .eq("landlord_id", user!.id)
        .order("charged_on", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data ?? [];
      const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter(Boolean))];
      let names = new Map<string, string | null>();
      if (tenantIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id, full_name").in("user_id", tenantIds as string[]);
        names = new Map((profs ?? []).map((p) => [p.user_id, p.full_name]));
      }
      return rows.map((r) => ({ ...r, tenant_name: names.get(r.tenant_id) ?? null }));
    },
  });


  const generate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("generate_owner_statement", {
        _landlord_id: user!.id,
        _period_start: period,
        ...(propertyId !== "all" ? { _property_id: propertyId } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statement generated");
      void qc.invalidateQueries({ queryKey: ["owner-statements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runLateFees = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("apply_late_fees", { _landlord_id: user!.id });
      if (error) throw error;
      return data as { charged?: number } | null;
    },
    onSuccess: (d) => {
      toast.success(`Late fee run complete — ${d?.charged ?? 0} charge(s) applied`);
      void qc.invalidateQueries({ queryKey: ["late-fee-charges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const waive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("waive_late_fee", {
        _charge_id: id, _reason: "Waived by landlord",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Late fee waived");
      void qc.invalidateQueries({ queryKey: ["late-fee-charges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTax = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("landlord_tax_settings").upsert({
        landlord_id: user!.id,
        wht_rate: Number(tax?.wht_rate ?? 7.5),
        management_fee_rate: Number(tax?.management_fee_rate ?? 0),
        ...patch,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["tax-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRule = useMutation({
    mutationFn: async (rule: Record<string, unknown>) => {
      const { error } = await supabase.from("late_fee_rules").upsert({
        landlord_id: user!.id,
        name: "Default late fee",
        ...rule,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Late fee rule saved");
      void qc.invalidateQueries({ queryKey: ["late-fee-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newRule, setNewRule] = useState({
    grace_days: "5", kind: "fixed", amount: "500", max_cap: "",
  });

  return (
    <div>
      <PageHeader
        title="Owner statements"
        description="Rent collected less expenses, management fees and withholding tax — the number that lands in your account."
      />

      <Tabs defaultValue="statements">
        <TabsList>
          <TabsTrigger value="statements">Statements</TabsTrigger>
          <TabsTrigger value="latefees">Late fees</TabsTrigger>
          <TabsTrigger value="settings">Tax &amp; payout</TabsTrigger>
        </TabsList>

        <TabsContent value="statements" className="mt-4">
          <div className="rounded-2xl border bg-card p-4 mb-6 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Statement month (start date)</Label>
              <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scope</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole portfolio</SelectItem>
                  {(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              <FileText className="h-4 w-4 mr-2" />
              {generate.isPending ? "Generating…" : "Generate statement"}
            </Button>
          </div>

          <div className="space-y-3">
            {!statements?.length ? (
              <div className="rounded-2xl border bg-card p-10 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <div className="font-medium">No statements yet</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Pick a month above and generate your first owner statement.
                </p>
              </div>
            ) : (
              statements.map((s) => {
                const prop = s.properties as unknown as { name: string } | null;
                const b = (s.breakdown ?? {}) as Breakdown;
                const expanded = openStatement === s.id;
                return (
                  <div key={s.id} className="rounded-2xl border bg-card overflow-hidden">
                    <button
                      className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/40"
                      onClick={() => setOpenStatement(expanded ? null : s.id)}
                    >
                      <div>
                        <div className="font-medium">
                          {formatDate(s.period_start)} → {formatDate(s.period_end)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {prop?.name ?? "Whole portfolio"}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Net payout</div>
                          <div className="font-display font-semibold">{formatKES(Number(s.net_payout))}</div>
                        </div>
                        <Badge variant={s.status === "paid" ? "secondary" : "outline"} className="capitalize">
                          {s.status}
                        </Badge>
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t p-4 bg-muted/20">
                        <table className="w-full text-sm max-w-xl">
                          <tbody>
                            <Row label="Gross rent collected" value={Number(s.gross_rent)} />
                            <Row label="Other income (late fees etc.)" value={Number(s.other_income)} />
                            <Row label="Expenses" value={-Number(s.expenses_total)} />
                            <Row label="Management fee" value={-Number(s.management_fee)} />
                            <Row label="Withholding tax" value={-Number(s.wht_amount)} />
                            <tr className="border-t-2">
                              <td className="py-2.5 font-display font-semibold">Net payable to owner</td>
                              <td className="py-2.5 text-right font-display font-semibold">
                                {formatKES(Number(s.net_payout))}
                              </td>
                            </tr>
                            {Number(s.arrears_closing) > 0 && (
                              <tr>
                                <td className="py-2 text-muted-foreground text-xs">Closing arrears carried forward</td>
                                <td className="py-2 text-right text-xs text-muted-foreground">
                                  {formatKES(Number(s.arrears_closing))}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {!!b.expenses?.length && (
                          <div className="mt-4">
                            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                              Expense detail
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {b.expenses.map((e) => (
                                <Badge key={e.category} variant="outline" className="capitalize">
                                  {e.category}: {formatKES(Number(e.amount))}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm" variant="outline" className="mt-4"
                          onClick={() => window.print()}
                        >
                          <Printer className="h-4 w-4 mr-2" />Print / save as PDF
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="latefees" className="mt-4">
          <div className="rounded-2xl border bg-card p-4 mb-6">
            <div className="font-medium mb-3">Late fee rule</div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Grace days</Label>
                <Input
                  type="number" value={newRule.grace_days}
                  onChange={(e) => setNewRule({ ...newRule, grace_days: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={newRule.kind} onValueChange={(v) => setNewRule({ ...newRule, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                    <SelectItem value="percent">% of rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{newRule.kind === "percent" ? "Percent" : "Amount (KES)"}</Label>
                <Input
                  type="number" value={newRule.amount}
                  onChange={(e) => setNewRule({ ...newRule, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max cap (optional)</Label>
                <Input
                  type="number" value={newRule.max_cap}
                  onChange={(e) => setNewRule({ ...newRule, max_cap: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                onClick={() => saveRule.mutate({
                  grace_days: Number(newRule.grace_days),
                  kind: newRule.kind,
                  amount: Number(newRule.amount),
                  max_cap: newRule.max_cap ? Number(newRule.max_cap) : null,
                  enabled: true,
                })}
                disabled={saveRule.isPending}
              >
                Save rule
              </Button>
              <Button variant="outline" onClick={() => runLateFees.mutate()} disabled={runLateFees.isPending}>
                <Zap className="h-4 w-4 mr-2" />
                {runLateFees.isPending ? "Running…" : "Run late fee check now"}
              </Button>
            </div>
            {!!rules?.length && (
              <div className="mt-4 flex flex-wrap gap-2">
                {rules.map((r) => (
                  <Badge key={r.id} variant={r.enabled ? "secondary" : "outline"}>
                    {r.name}: {r.kind === "percent" ? `${r.amount}% of rent` : formatKES(Number(r.amount))} after {r.grace_days}d
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            {!charges?.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No late fees charged yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Charged</th>
                    <th className="text-left px-4 py-3">Tenant</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => {
                    const p = { full_name: c.tenant_name };
                    return (
                      <tr key={c.id} className="border-t">
                        <td className="px-4 py-3">{formatDate(c.charged_on)}</td>
                        <td className="px-4 py-3">{p?.full_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {c.waived_at
                            ? <span className="line-through text-muted-foreground">{formatKES(Number(c.amount))}</span>
                            : formatKES(Number(c.amount))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.waived_at ? (
                            <Badge variant="outline">Waived</Badge>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => waive.mutate(c.id)}>Waive</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="rounded-2xl border bg-card p-5 max-w-2xl space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Percent className="h-4 w-4" /> Tax &amp; payout details
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>KRA PIN</Label>
                <Input
                  defaultValue={tax?.kra_pin ?? ""}
                  onBlur={(e) => saveTax.mutate({ kra_pin: e.target.value || null })}
                  placeholder="A001234567X"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Withholding tax rate (%)</Label>
                <Input
                  type="number" step="0.1" defaultValue={tax?.wht_rate ?? 7.5}
                  onBlur={(e) => saveTax.mutate({ wht_rate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Management fee rate (%)</Label>
                <Input
                  type="number" step="0.1" defaultValue={tax?.management_fee_rate ?? 0}
                  onBlur={(e) => saveTax.mutate({ management_fee_rate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payout M-Pesa number</Label>
                <Input
                  defaultValue={tax?.payout_phone ?? ""}
                  onBlur={(e) => saveTax.mutate({ payout_phone: e.target.value || null })}
                  placeholder="+2547…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payout bank</Label>
                <Input
                  defaultValue={tax?.payout_bank_name ?? ""}
                  onBlur={(e) => saveTax.mutate({ payout_bank_name: e.target.value || null })}
                  placeholder="Equity Bank"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payout account</Label>
                <Input
                  defaultValue={tax?.payout_account ?? ""}
                  onBlur={(e) => saveTax.mutate({ payout_account: e.target.value || null })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="font-medium text-sm">VAT registered</div>
                <p className="text-xs text-muted-foreground">Affects how management fees are presented on statements.</p>
              </div>
              <Switch
                checked={!!tax?.vat_registered}
                onCheckedChange={(v) => saveTax.mutate({ vat_registered: v })}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t">
      <td className="py-2.5">{label}</td>
      <td className="py-2.5 text-right font-medium">{formatKES(value)}</td>
    </tr>
  );
}
