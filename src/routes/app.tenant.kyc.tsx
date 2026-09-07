import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle, Info } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/tenant/kyc")({
  component: KycPage,
});

const ID_TYPES = [
  { v: "national_id", l: "National ID" },
  { v: "passport", l: "Passport" },
  { v: "alien_id", l: "Alien ID" },
];

function KycPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [country, setCountry] = useState("KE");

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["kyc", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const latest = submissions?.[0];

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!fullName.trim() || !idNumber.trim()) throw new Error("Fill all fields");
      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: user.id,
        full_name: fullName.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
        country,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted for review");
      setFullName("");
      setIdNumber("");
      void qc.invalidateQueries({ queryKey: ["kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !latest || latest.status === "rejected" || latest.status === "unverified";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Identity verification"
        description="Verify your identity to unlock Fuliza Rent, higher payment limits, and a verified Rental Passport."
      />

      {latest && <StatusBanner status={latest.status} notes={latest.reviewer_notes} at={latest.updated_at} />}

      {canSubmit && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">
            {latest ? "Resubmit" : "Submit your details"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We check against government registries. Typical decision under 2 minutes.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full legal name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As on your ID" />
            </Field>
            <Field label="ID type">
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ID number">
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. 12345678" />
            </Field>
            <Field label="Country">
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KE">Kenya</SelectItem>
                  <SelectItem value="UG">Uganda</SelectItem>
                  <SelectItem value="TZ">Tanzania</SelectItem>
                  <SelectItem value="RW">Rwanda</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-muted-foreground">History</h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : !submissions?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.id_type.replace("_", " ")} · {formatDateTime(s.created_at)}
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label><div className="mt-1.5">{children}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string }> = {
    pending: { l: "Pending", c: "bg-amber-100 text-amber-900" },
    verified: { l: "Verified", c: "bg-emerald-100 text-emerald-900" },
    rejected: { l: "Rejected", c: "bg-rose-100 text-rose-900" },
    unverified: { l: "More info needed", c: "bg-blue-100 text-blue-900" },
  };
  const m = map[status] ?? { l: status, c: "bg-muted" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${m.c}`}>{m.l}</span>;
}

function StatusBanner({ status, notes, at }: { status: string; notes: string | null; at: string }) {
  const icon = status === "verified" ? ShieldCheck : status === "pending" ? Clock : status === "rejected" ? XCircle : Info;
  const Icon = icon;
  const bg =
    status === "verified" ? "border-emerald-300 bg-emerald-50" :
    status === "rejected" ? "border-rose-300 bg-rose-50" :
    status === "unverified" ? "border-blue-300 bg-blue-50" :
    "border-amber-300 bg-amber-50";
  return (
    <div className={`rounded-2xl border p-5 ${bg}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold capitalize">{status.replace("_", " ")}</span>
            <Badge variant="outline" className="bg-white/60">{formatDateTime(at)}</Badge>
          </div>
          {notes && <p className="mt-1 text-sm">{notes}</p>}
        </div>
      </div>
    </div>
  );
}
