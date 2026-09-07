import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate, formatKES } from "@/lib/format";

export const Route = createFileRoute("/app/landlord/expenses")({
  component: ExpensesPage,
  head: () => ({
    meta: [
      { title: "Property expenses — Makao360" },
      { name: "description", content: "Record and track repairs, utilities, levies and other property costs against each building." },
    ],
  }),
});

const CATEGORIES = [
  "repairs", "utilities", "security", "cleaning", "insurance", "levies",
  "legal", "staff", "management", "marketing", "tax", "other",
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  repairs: "Repairs & maintenance",
  utilities: "Utilities",
  security: "Security",
  cleaning: "Cleaning",
  insurance: "Insurance",
  levies: "Service charge & levies",
  legal: "Legal & professional",
  staff: "Staff costs",
  management: "Management fees",
  marketing: "Marketing",
  tax: "Taxes",
  other: "Other",
};

function monthStart(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().slice(0, 10);
}

function ExpensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthStart(-2));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const [form, setForm] = useState({
    property_id: "",
    category: "repairs" as Category,
    vendor_name: "",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    receipt_ref: "",
  });

  const { data: properties } = useQuery({
    queryKey: ["expense-properties", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .eq("landlord_id", user!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", user?.id, from, to, categoryFilter, propertyFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("*, properties(name)")
        .eq("landlord_id", user!.id)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false })
        .limit(500);
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter as Category);
      if (propertyFilter !== "all") q = q.eq("property_id", propertyFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const rows = expenses ?? [];
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount));
    }
    return {
      total,
      count: rows.length,
      top: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    };
  }, [expenses]);

  const createExpense = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      if (!form.description.trim()) throw new Error("Describe what the money was spent on");
      const { error } = await supabase.from("expenses").insert({
        landlord_id: user!.id,
        property_id: form.property_id || null,
        category: form.category,
        vendor_name: form.vendor_name || null,
        description: form.description.trim(),
        amount,
        expense_date: form.expense_date,
        receipt_ref: form.receipt_ref || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense recorded and posted to your books");
      setOpen(false);
      setForm((f) => ({ ...f, description: "", amount: "", vendor_name: "", receipt_ref: "" }));
      void qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").update({ status: "void" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense voided");
      void qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Every cost you record posts straight into your books and reduces the owner payout."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Record expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record an expense</DialogTitle>
                <DialogDescription>
                  This creates a balanced accounting entry against the property you choose.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Property</Label>
                    <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Whole portfolio" /></SelectTrigger>
                      <SelectContent>
                        {(properties ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Replaced burst pipe in Block B stairwell"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Amount (KES)</Label>
                    <Input
                      type="number" min="1" value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="12500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input
                      type="date" value={form.expense_date}
                      onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vendor</Label>
                    <Input
                      value={form.vendor_name}
                      onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                      placeholder="Njoroge Plumbers"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Receipt no.</Label>
                    <Input
                      value={form.receipt_ref}
                      onChange={(e) => setForm({ ...form, receipt_ref: e.target.value })}
                      placeholder="INV-2291"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createExpense.mutate()} disabled={createExpense.isPending}>
                  {createExpense.isPending ? "Saving…" : "Save expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total in range</div>
          <div className="text-2xl font-display font-semibold mt-1">{formatKES(totals.total)}</div>
          <div className="text-xs text-muted-foreground mt-1">{totals.count} entries</div>
        </div>
        {totals.top.map(([cat, amt]) => (
          <div key={cat} className="rounded-2xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABEL[cat as Category] ?? cat}
            </div>
            <div className="text-2xl font-display font-semibold mt-1">{formatKES(amt)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totals.total ? Math.round((amt / totals.total) * 100) : 0}% of spend
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Property</Label>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Loading expenses…</div>
        ) : !expenses?.length ? (
          <div className="p-10 text-center">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">No expenses in this range</div>
            <p className="text-sm text-muted-foreground mt-1">
              Record repairs, water bills or levies to see a true net position per property.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Property</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const prop = e.properties as unknown as { name: string } | null;
                  return (
                    <tr key={e.id} className="border-t">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.description}</div>
                        {e.vendor_name && (
                          <div className="text-xs text-muted-foreground">
                            {e.vendor_name}{e.receipt_ref ? ` · ${e.receipt_ref}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{prop?.name ?? "Portfolio"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{CATEGORY_LABEL[e.category as Category] ?? e.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {e.status === "void"
                          ? <span className="line-through text-muted-foreground">{formatKES(Number(e.amount))}</span>
                          : formatKES(Number(e.amount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.status !== "void" && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => voidExpense.mutate(e.id)}
                            aria-label={`Void expense ${e.description}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
