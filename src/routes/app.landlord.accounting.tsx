import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatKES } from "@/lib/format";

export const Route = createFileRoute("/app/landlord/accounting")({
  component: AccountingPage,
  head: () => ({
    meta: [
      { title: "Accounting & reports — Makao360" },
      { name: "description", content: "Double-entry general ledger, trial balance and profit & loss for your rental portfolio." },
    ],
  }),
});

function firstOfYear() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function AccountingPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: pnl } = useQuery({
    queryKey: ["gl-pnl", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gl_profit_and_loss", { _from: from, _to: to });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: trial } = useQuery({
    queryKey: ["gl-trial", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gl_trial_balance", { _from: from, _to: to });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: journals } = useQuery({
    queryKey: ["gl-journals", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, journal_lines(id, debit, credit, description, gl_accounts(code, name)), properties(name)")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false })
        .limit(150);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["gl-accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gl_accounts").select("*").eq("active", true).order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const rows = pnl ?? [];
    const income = rows.filter((r) => r.section === "income").reduce((s, r) => s + Number(r.amount), 0);
    const expense = rows.filter((r) => r.section === "expense").reduce((s, r) => s + Number(r.amount), 0);
    return { income, expense, net: income - expense };
  }, [pnl]);

  const balanced = useMemo(() => {
    const rows = trial ?? [];
    const d = rows.reduce((s, r) => s + Number(r.debits), 0);
    const c = rows.reduce((s, r) => s + Number(r.credits), 0);
    return { debits: d, credits: c, ok: Math.abs(d - c) < 0.01 };
  }, [trial]);

  return (
    <div>
      <PageHeader
        title="Accounting"
        description="A real double-entry ledger behind every shilling that moves through your portfolio."
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Income
          </div>
          <div className="text-2xl font-display font-semibold mt-1">{formatKES(summary.income)}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" /> Expenses
          </div>
          <div className="text-2xl font-display font-semibold mt-1">{formatKES(summary.expense)}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Scale className="h-3.5 w-3.5" /> Net position
          </div>
          <div className="text-2xl font-display font-semibold mt-1">{formatKES(summary.net)}</div>
        </div>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">Profit &amp; loss</TabsTrigger>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="coa">Chart of accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="mt-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            {!pnl?.length ? (
              <EmptyState label="No income or expenses posted in this period yet." />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {["income", "expense"].map((section) => {
                    const rows = (pnl ?? []).filter((r) => r.section === section);
                    if (!rows.length) return null;
                    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
                    return (
                      <Fragment key={section}>
                        <tr className="bg-muted/50">
                          <td colSpan={2} className="px-4 py-2 text-xs uppercase tracking-wider font-medium">
                            {section === "income" ? "Income" : "Expenses"}
                          </td>
                        </tr>
                        {rows.map((r, ri) => (
                          <tr key={`${section}-${ri}-${r.code}`} className="border-t">
                            <td className="px-4 py-2.5">
                              <span className="text-muted-foreground mr-2">{r.code}</span>{r.name}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium">{formatKES(Number(r.amount))}</td>
                          </tr>
                        ))}
                        <tr key={`${section}-total`} className="border-t bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">Total {section}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{formatKES(total)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  <tr className="border-t-2">
                    <td className="px-4 py-3 font-display font-semibold">Net profit</td>
                    <td className="px-4 py-3 text-right font-display font-semibold">{formatKES(summary.net)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trial" className="mt-4">
          <div className="mb-3">
            <Badge variant={balanced.ok ? "secondary" : "destructive"}>
              {balanced.ok ? "Books balance" : "Out of balance — review journal"}
            </Badge>
          </div>
          <div className="rounded-2xl border bg-card overflow-hidden">
            {!trial?.length ? (
              <EmptyState label="Nothing posted yet. Record a payment or expense to start the ledger." />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Account</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-right px-4 py-3">Debits</th>
                    <th className="text-right px-4 py-3">Credits</th>
                    <th className="text-right px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {trial.map((r) => (
                    <tr key={r.account_id} className="border-t">
                      <td className="px-4 py-2.5">
                        <span className="text-muted-foreground mr-2">{r.code}</span>{r.name}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">{r.type}</td>
                      <td className="px-4 py-2.5 text-right">{formatKES(Number(r.debits))}</td>
                      <td className="px-4 py-2.5 text-right">{formatKES(Number(r.credits))}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatKES(Number(r.balance))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 bg-muted/30">
                    <td className="px-4 py-3 font-medium" colSpan={2}>Totals</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatKES(balanced.debits)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatKES(balanced.credits)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="journal" className="mt-4">
          <div className="space-y-3">
            {!journals?.length ? (
              <div className="rounded-2xl border bg-card">
                <EmptyState label="No journal entries in this period." />
              </div>
            ) : (
              journals.map((j) => {
                const lines = (j.journal_lines ?? []) as unknown as Array<{
                  id: string; debit: number; credit: number; description: string | null;
                  gl_accounts: { code: string; name: string } | null;
                }>;
                const prop = j.properties as unknown as { name: string } | null;
                return (
                  <div key={j.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="font-medium">{j.memo ?? "Journal entry"}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(j.entry_date)}{prop ? ` · ${prop.name}` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize">{j.source.replace("_", " ")}</Badge>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {lines.map((l) => (
                          <tr key={l.id} className="border-t">
                            <td className="py-2">
                              <span className="text-muted-foreground mr-2">{l.gl_accounts?.code}</span>
                              {l.gl_accounts?.name}
                              {l.description && (
                                <span className="text-xs text-muted-foreground block">{l.description}</span>
                              )}
                            </td>
                            <td className="py-2 text-right w-32">
                              {Number(l.debit) > 0 ? formatKES(Number(l.debit)) : ""}
                            </td>
                            <td className="py-2 text-right w-32">
                              {Number(l.credit) > 0 ? formatKES(Number(l.credit)) : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="coa" className="mt-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Account</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Scope</th>
                </tr>
              </thead>
              <tbody>
                {(accounts ?? []).map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2.5 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{a.name}</div>
                      {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{a.type}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={a.is_system ? "secondary" : "outline"}>
                        {a.is_system ? "Standard" : "Custom"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-10 text-center">
      <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
