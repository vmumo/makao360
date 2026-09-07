import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Banknote, User, Wallet } from "lucide-react";
import { useLandlordProfile } from "@/hooks/use-landlord-profile";
import { useLandlordBalance } from "@/hooks/use-landlord-balance";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/app/landlord/profile")({
  head: () => ({
    meta: [
      { title: "Landlord profile · Makao360" },
      {
        name: "description",
        content:
          "Edit your business details, payout bank account and contact information used on Makao360 invoices and payments.",
      },
      { property: "og:title", content: "Landlord profile · Makao360" },
      {
        property: "og:description",
        content: "Business details, bank account and contact info used on rent invoices and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandlordProfile,
});

type Form = {
  business_name: string;
  kra_pin: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  invoice_footer: string;
  payout_bank_name: string;
  payout_account: string;
  payout_phone: string;
};

const empty: Form = {
  business_name: "",
  kra_pin: "",
  business_email: "",
  business_phone: "",
  business_address: "",
  invoice_footer: "",
  payout_bank_name: "",
  payout_account: "",
  payout_phone: "",
};

function LandlordProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const landlordId = user?.id ?? null;
  const { data: settings, isLoading } = useLandlordProfile(landlordId);
  const { data: balance } = useLandlordBalance(landlordId);
  const [form, setForm] = useState<Form>(empty);
  const [fullName, setFullName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile-row", landlordId],
    enabled: !!landlordId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", landlordId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name ?? "",
        kra_pin: settings.kra_pin ?? "",
        business_email: settings.business_email ?? "",
        business_phone: settings.business_phone ?? "",
        business_address: settings.business_address ?? "",
        invoice_footer: settings.invoice_footer ?? "",
        payout_bank_name: settings.payout_bank_name ?? "",
        payout_account: settings.payout_account ?? "",
        payout_phone: settings.payout_phone ?? "",
      });
    }
  }, [settings]);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!landlordId) throw new Error("Not signed in");
      const { error } = await supabase.from("landlord_tax_settings").upsert(
        {
          landlord_id: landlordId,
          business_name: form.business_name.trim() || null,
          kra_pin: form.kra_pin.trim() || null,
          business_email: form.business_email.trim() || null,
          business_phone: form.business_phone.trim() || null,
          business_address: form.business_address.trim() || null,
          invoice_footer: form.invoice_footer.trim() || null,
          payout_bank_name: form.payout_bank_name.trim() || null,
          payout_account: form.payout_account.trim() || null,
          payout_phone: form.payout_phone.trim() || null,
        },
        { onConflict: "landlord_id" },
      );
      if (error) throw error;

      if (fullName.trim()) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ full_name: fullName.trim() })
          .eq("user_id", landlordId);
        if (pErr) throw pErr;
      }
    },
    onSuccess: () => {
      toast.success("Profile saved — invoices and payouts now use these details");
      void qc.invalidateQueries({ queryKey: ["landlord-business-profile", landlordId] });
      void qc.invalidateQueries({ queryKey: ["my-profile-row", landlordId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof Form, label: string, placeholder?: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Business details, payout bank account and contact info. These appear on rent invoices, receipts and payouts."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Building2 className="size-4" /> Business details
            </h2>
            {field("business_name", "Business / trading name", "Makao Properties Ltd")}
            {field("kra_pin", "KRA PIN", "A001234567Z")}
            {field("business_address", "Business address", "Westlands, Nairobi")}
            <div className="space-y-1.5">
              <Label htmlFor="invoice_footer">Invoice footer note</Label>
              <Textarea
                id="invoice_footer"
                rows={3}
                value={form.invoice_footer}
                placeholder="Rent is due by the 5th. Quote your invoice number when paying."
                onChange={(e) => setForm((f) => ({ ...f, invoice_footer: e.target.value }))}
              />
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Wallet className="size-4" /> Collection balance
            </h2>
            <div className="text-3xl font-display font-bold">{formatKES(balance?.balance ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatKES(balance?.matchedIn ?? 0)} received (matched) · {formatKES(balance?.paidOut ?? 0)} paid out.
              Reconciled on the Banking screen.
            </p>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Banknote className="size-4" /> Bank & payout account
            </h2>
            {field("payout_bank_name", "Bank name", "Equity Bank")}
            {field("payout_account", "Account number", "0123456789")}
            {field("payout_phone", "M-Pesa payout number", "07XX XXX XXX")}
            <p className="text-xs text-muted-foreground">
              Rent collected is settled to this account, and tenants see it on their invoice as the pay-to account.
            </p>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <User className="size-4" /> Contact info
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Your name</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            {field("business_email", "Contact email", "billing@example.co.ke", "email")}
            {field("business_phone", "Contact phone", "07XX XXX XXX", "tel")}
          </section>
        </div>
      )}

      <div className="mt-5">
        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
