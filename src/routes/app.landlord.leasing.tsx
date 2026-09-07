import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, FilePlus2, Gauge, PenLine, RefreshCw, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime, formatKES } from "@/lib/format";
import { ViewingsManager } from "@/components/ViewingsManager";


export const Route = createFileRoute("/app/landlord/leasing")({
  component: LeasingPage,
  head: () => ({
    meta: [
      { title: "Leasing lifecycle — Makao360" },
      { name: "description", content: "Screen rental applications, e-sign lease agreements, run move-in and move-out inspections and send renewal offers." },
      { property: "og:title", content: "Leasing lifecycle — Makao360" },
      { property: "og:description", content: "Applications, tenant screening, e-signed leases, inspections and renewals in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function statusTone(status: string) {
  if (["approved", "signed", "accepted", "completed"].includes(status)) return "bg-success/15 text-success";
  if (["rejected", "declined", "void", "cancelled", "expired"].includes(status)) return "bg-destructive/10 text-destructive";
  if (["sent", "screening", "offered", "in_progress"].includes(status)) return "bg-warning/20 text-warning-foreground";
  return "bg-muted text-muted-foreground";
}

function leaseTemplate(opts: {
  landlord: string; tenant: string; unit: string; property: string; rent: number; deposit: number; start: string; dueDay: number;
}) {
  return `TENANCY AGREEMENT

This agreement is made between ${opts.landlord} ("the Landlord") and ${opts.tenant} ("the Tenant") for the premises known as ${opts.unit}, ${opts.property}.

1. TERM
The tenancy commences on ${opts.start} and continues on a monthly basis until terminated by either party giving one (1) calendar month written notice.

2. RENT
Monthly rent is ${formatKES(opts.rent)}, payable on or before day ${opts.dueDay} of each month through the Makao360 rent wallet.

3. DEPOSIT
The Tenant has paid a refundable deposit of ${formatKES(opts.deposit)}, refundable within thirty (30) days of vacating, less any lawful deductions recorded in the move-out inspection.

4. USE OF PREMISES
The premises shall be used for residential purposes only and shall not be sublet without the Landlord's written consent.

5. REPAIRS
The Tenant shall report defects through the Makao360 maintenance channel. The Landlord shall carry out structural repairs; the Tenant is responsible for damage beyond fair wear and tear.

6. UTILITIES
Water, electricity and service charge are payable by the Tenant unless otherwise agreed in writing.

7. INSPECTIONS
The Landlord may inspect the premises upon twenty-four (24) hours notice. Move-in and move-out inspections shall be recorded on Makao360 and shall be the basis of any deposit deductions.

8. TERMINATION
Either party may terminate by one month's written notice. Rent arrears remain payable on termination.

Signed electronically on Makao360.`;
}

function LeasingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: units } = useQuery({
    queryKey: ["leasing-units", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, label, rent_amount, deposit_amount, status, property_id, properties!inner(id, name, landlord_id)")
        .eq("properties.landlord_id", user!.id)
        .order("label")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leases } = useQuery({
    queryKey: ["leasing-leases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("id, rent_amount, deposit_amount, rent_due_day, start_date, end_date, status, tenant_id, unit_id, units(label, properties(name)), profiles:tenant_id(full_name, phone)")
        .eq("landlord_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: applications } = useQuery({
    queryKey: ["applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_applications")
        .select("*, units(label, properties(name))")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: documents } = useQuery({
    queryKey: ["lease-documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_documents")
        .select("*")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ["inspections", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, units(label, properties(name))")
        .eq("landlord_id", user!.id)
        .order("scheduled_for", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: renewals } = useQuery({
    queryKey: ["renewals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_renewals")
        .select("*, leases(units(label, properties(name)))")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, user?.id] }));

  /* ---------------- Applications ---------------- */
  const [appOpen, setAppOpen] = useState(false);
  const [appForm, setAppForm] = useState({
    unit_id: "", applicant_name: "", applicant_phone: "", applicant_email: "",
    employment_status: "employed", employer: "", monthly_income: "", dependents: "0",
    previous_landlord_phone: "", notes: "",
  });

  const createApplication = useMutation({
    mutationFn: async () => {
      const unit = units?.find((u) => u.id === appForm.unit_id);
      const { error } = await supabase.from("rental_applications").insert({
        landlord_id: user!.id,
        unit_id: appForm.unit_id || null,
        property_id: unit?.property_id ?? null,
        applicant_name: appForm.applicant_name.trim(),
        applicant_phone: appForm.applicant_phone.trim(),
        applicant_email: appForm.applicant_email.trim() || null,
        employment_status: appForm.employment_status,
        employer: appForm.employer.trim() || null,
        monthly_income: Number(appForm.monthly_income || 0),
        dependents: Number(appForm.dependents || 0),
        previous_landlord_phone: appForm.previous_landlord_phone.trim() || null,
        notes: appForm.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application recorded");
      setAppOpen(false);
      setAppForm({ unit_id: "", applicant_name: "", applicant_phone: "", applicant_email: "", employment_status: "employed", employer: "", monthly_income: "", dependents: "0", previous_landlord_phone: "", notes: "" });
      invalidate(["applications"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const screen = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("screen_application", { _application_id: id });
      if (error) throw error;
      return data as { score: number };
    },
    onSuccess: (d) => { toast.success(`Screening complete — score ${d?.score ?? 0}/100`); invalidate(["applications"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "withdrawn" }) => {
      const { error } = await supabase.from("rental_applications")
        .update({ status, decided_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Application updated"); invalidate(["applications"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- Documents ---------------- */
  const [docOpen, setDocOpen] = useState(false);
  const [docLeaseId, setDocLeaseId] = useState("");
  const [docTitle, setDocTitle] = useState("Tenancy agreement");
  const [docBody, setDocBody] = useState("");
  const [signName, setSignName] = useState("");

  const selectedLease = useMemo(() => leases?.find((l) => l.id === docLeaseId), [leases, docLeaseId]);

  function buildTemplate(leaseId: string) {
    setDocLeaseId(leaseId);
    const l = leases?.find((x) => x.id === leaseId);
    if (!l) return;
    setDocBody(leaseTemplate({
      landlord: "The Landlord",
      tenant: (l.profiles as { full_name?: string } | null)?.full_name ?? "The Tenant",
      unit: (l.units as { label?: string } | null)?.label ?? "the unit",
      property: ((l.units as { properties?: { name?: string } } | null)?.properties?.name) ?? "the property",
      rent: l.rent_amount,
      deposit: l.deposit_amount,
      start: formatDate(l.start_date),
      dueDay: l.rent_due_day,
    }));
  }

  type DocPatch = Partial<{
    status: "draft" | "sent" | "signed" | "void";
    sent_at: string;
    landlord_signature: string;
    landlord_signed_at: string;
  }>;

  const createDoc = useMutation({
    mutationFn: async (send: boolean) => {
      if (!selectedLease) throw new Error("Choose a lease first");
      const { error } = await supabase.from("lease_documents").insert({
        lease_id: selectedLease.id,
        landlord_id: user!.id,
        tenant_id: selectedLease.tenant_id,
        title: docTitle.trim() || "Tenancy agreement",
        body: docBody,
        status: send ? "sent" : "draft",
        sent_at: send ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agreement saved"); setDocOpen(false); invalidate(["lease-documents"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDoc = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DocPatch }) => {
      const { error } = await supabase.from("lease_documents").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agreement updated"); invalidate(["lease-documents"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- Inspections ---------------- */
  const [inspOpen, setInspOpen] = useState(false);
  const [inspForm, setInspForm] = useState({ unit_id: "", kind: "move_in", scheduled_for: new Date().toISOString().slice(0, 10), inspector_name: "" });

  const createInspection = useMutation({
    mutationFn: async () => {
      const lease = leases?.find((l) => l.unit_id === inspForm.unit_id);
      const { error } = await supabase.from("inspections").insert({
        landlord_id: user!.id,
        unit_id: inspForm.unit_id || null,
        lease_id: lease?.id ?? null,
        tenant_id: lease?.tenant_id ?? null,
        kind: inspForm.kind as "move_in" | "move_out" | "routine",
        scheduled_for: inspForm.scheduled_for,
        inspector_name: inspForm.inspector_name.trim() || null,
        items: DEFAULT_CHECKLIST,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inspection scheduled"); setInspOpen(false); invalidate(["inspections"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [completing, setCompleting] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({ summary: "", deductions: "" });

  const completeInspection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspections").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: completeForm.summary.trim() || null,
        deductions: Number(completeForm.deductions || 0),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inspection completed"); setCompleting(null); setCompleteForm({ summary: "", deductions: "" }); invalidate(["inspections"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- Renewals ---------------- */
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({ lease_id: "", new_rent: "", new_end_date: "", message: "" });

  const offerRenewal = useMutation({
    mutationFn: async () => {
      const lease = leases?.find((l) => l.id === renewForm.lease_id);
      if (!lease) throw new Error("Choose a lease");
      const { error } = await supabase.from("lease_renewals").insert({
        lease_id: lease.id,
        landlord_id: user!.id,
        tenant_id: lease.tenant_id,
        current_rent: lease.rent_amount,
        new_rent: Number(renewForm.new_rent || lease.rent_amount),
        new_end_date: renewForm.new_end_date || null,
        message: renewForm.message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Renewal offer sent"); setRenewOpen(false); setRenewForm({ lease_id: "", new_rent: "", new_end_date: "", message: "" }); invalidate(["renewals"]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingApps = (applications ?? []).filter((a) => ["submitted", "screening"].includes(a.status)).length;
  const awaitingSignature = (documents ?? []).filter((d) => d.status === "sent").length;
  const upcomingInspections = (inspections ?? []).filter((i) => i.status !== "completed" && i.status !== "cancelled").length;
  const openRenewals = (renewals ?? []).filter((r) => r.status === "offered").length;

  return (
    <div>
      <PageHeader
        title="Leasing"
        description="Applications, tenant screening, e-signed agreements, inspections and renewals."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Applications in review" value={pendingApps} tone="primary" />
        <StatCard label="Awaiting signature" value={awaitingSignature} />
        <StatCard label="Inspections due" value={upcomingInspections} />
        <StatCard label="Renewal offers open" value={openRenewals} />
      </div>

      <Tabs defaultValue="applications">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="viewings">Viewings</TabsTrigger>
          <TabsTrigger value="documents">Agreements</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
        </TabsList>

        <TabsContent value="viewings">
          <ViewingsManager />
        </TabsContent>


        {/* Applications */}
        <TabsContent value="applications">
          <div className="flex justify-end mb-3">
            <Dialog open={appOpen} onOpenChange={setAppOpen}>
              <DialogTrigger asChild>
                <Button><FilePlus2 className="mr-2 h-4 w-4" />New application</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Record a rental application</DialogTitle>
                  <DialogDescription>Capture applicant details, then run screening to get an affordability score.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Unit</Label>
                    <Select value={appForm.unit_id} onValueChange={(v) => setAppForm({ ...appForm, unit_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {(units ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {(u.properties as { name?: string } | null)?.name} — {u.label} · {formatKES(u.rent_amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Full name</Label><Input value={appForm.applicant_name} onChange={(e) => setAppForm({ ...appForm, applicant_name: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={appForm.applicant_phone} onChange={(e) => setAppForm({ ...appForm, applicant_phone: e.target.value })} placeholder="07xx xxx xxx" /></div>
                    <div><Label>Email</Label><Input value={appForm.applicant_email} onChange={(e) => setAppForm({ ...appForm, applicant_email: e.target.value })} /></div>
                    <div>
                      <Label>Employment</Label>
                      <Select value={appForm.employment_status} onValueChange={(v) => setAppForm({ ...appForm, employment_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employed">Employed</SelectItem>
                          <SelectItem value="self_employed">Self-employed</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="unemployed">Unemployed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Employer / business</Label><Input value={appForm.employer} onChange={(e) => setAppForm({ ...appForm, employer: e.target.value })} /></div>
                    <div><Label>Monthly income (KES)</Label><Input type="number" value={appForm.monthly_income} onChange={(e) => setAppForm({ ...appForm, monthly_income: e.target.value })} /></div>
                    <div><Label>Dependents</Label><Input type="number" value={appForm.dependents} onChange={(e) => setAppForm({ ...appForm, dependents: e.target.value })} /></div>
                    <div><Label>Previous landlord phone</Label><Input value={appForm.previous_landlord_phone} onChange={(e) => setAppForm({ ...appForm, previous_landlord_phone: e.target.value })} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createApplication.mutate()}
                    disabled={createApplication.isPending || !appForm.applicant_name || !appForm.applicant_phone}
                  >
                    {createApplication.isPending ? "Saving…" : "Save application"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {(applications ?? []).length === 0 && <EmptyState text="No applications yet. Record a walk-in applicant to start screening." />}
            {(applications ?? []).map((a) => (
              <div key={a.id} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{a.applicant_name} <span className="text-muted-foreground font-normal">· {a.applicant_phone}</span></div>
                    <div className="text-sm text-muted-foreground">
                      {(a.units as { properties?: { name?: string } } | null)?.properties?.name ?? "—"} · {(a.units as { label?: string } | null)?.label ?? "No unit"} · income {formatKES(Number(a.monthly_income))}
                    </div>
                    {a.screening_notes && <p className="mt-2 text-xs text-muted-foreground max-w-xl">{a.screening_notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {a.screening_score != null && (
                        <Badge variant="secondary" className="font-mono">{a.screening_score}/100</Badge>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(a.status)}`}>{a.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => screen.mutate(a.id)} disabled={screen.isPending}>
                        <Gauge className="mr-1 h-3.5 w-3.5" />Screen
                      </Button>
                      {a.status !== "approved" && (
                        <Button size="sm" onClick={() => decide.mutate({ id: a.id, status: "approved" })}>Approve</Button>
                      )}
                      {a.status !== "rejected" && (
                        <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: a.id, status: "rejected" })}>Reject</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Agreements */}
        <TabsContent value="documents">
          <div className="flex justify-end mb-3">
            <Dialog open={docOpen} onOpenChange={setDocOpen}>
              <DialogTrigger asChild>
                <Button><PenLine className="mr-2 h-4 w-4" />New agreement</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Draft a tenancy agreement</DialogTitle>
                  <DialogDescription>Pick a lease to auto-fill the Kenyan tenancy template, then send it for e-signature.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Lease</Label>
                    <Select value={docLeaseId} onValueChange={buildTemplate}>
                      <SelectTrigger><SelectValue placeholder="Select active lease" /></SelectTrigger>
                      <SelectContent>
                        {(leases ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {(l.profiles as { full_name?: string } | null)?.full_name ?? "Tenant"} — {(l.units as { label?: string } | null)?.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Title</Label><Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} /></div>
                  <div><Label>Agreement text</Label><Textarea rows={14} value={docBody} onChange={(e) => setDocBody(e.target.value)} className="font-mono text-xs" /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => createDoc.mutate(false)} disabled={createDoc.isPending || !docBody}>Save draft</Button>
                  <Button onClick={() => createDoc.mutate(true)} disabled={createDoc.isPending || !docBody}>
                    <Send className="mr-2 h-4 w-4" />Send for signature
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {(documents ?? []).length === 0 && <EmptyState text="No agreements yet. Draft one from an active lease." />}
            {(documents ?? []).map((d) => (
              <div key={d.id} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{d.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Created {formatDate(d.created_at)}
                      {d.tenant_signed_at && ` · tenant signed ${formatDateTime(d.tenant_signed_at)} as ${d.tenant_signature}`}
                      {d.landlord_signed_at && ` · landlord signed ${formatDateTime(d.landlord_signed_at)}`}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(d.status)}`}>{d.status}</span>
                    <div className="flex gap-2">
                      {d.status === "draft" && (
                        <Button size="sm" onClick={() => updateDoc.mutate({ id: d.id, patch: { status: "sent", sent_at: new Date().toISOString() } })}>
                          <Send className="mr-1 h-3.5 w-3.5" />Send
                        </Button>
                      )}
                      {!d.landlord_signed_at && d.status !== "void" && (
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="outline">Sign as landlord</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Electronic signature</DialogTitle>
                              <DialogDescription>Type your full legal name to sign. This is recorded with a timestamp.</DialogDescription>
                            </DialogHeader>
                            <Input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="Full legal name" />
                            <DialogFooter>
                              <Button
                                disabled={!signName.trim()}
                                onClick={() => updateDoc.mutate({ id: d.id, patch: { landlord_signature: signName.trim(), landlord_signed_at: new Date().toISOString(), status: d.tenant_signed_at ? ("signed" as const) : d.status } })}
                              >Sign</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      {d.status !== "void" && (
                        <Button size="sm" variant="ghost" onClick={() => updateDoc.mutate({ id: d.id, patch: { status: "void" } })}>Void</Button>
                      )}
                    </div>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">View agreement text</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{d.body}</pre>
                </details>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Inspections */}
        <TabsContent value="inspections">
          <div className="flex justify-end mb-3">
            <Dialog open={inspOpen} onOpenChange={setInspOpen}>
              <DialogTrigger asChild>
                <Button><ClipboardCheck className="mr-2 h-4 w-4" />Schedule inspection</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule an inspection</DialogTitle>
                  <DialogDescription>Move-in and move-out inspections back your deposit deductions.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Unit</Label>
                    <Select value={inspForm.unit_id} onValueChange={(v) => setInspForm({ ...inspForm, unit_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {(units ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{(u.properties as { name?: string } | null)?.name} — {u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={inspForm.kind} onValueChange={(v) => setInspForm({ ...inspForm, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="move_in">Move-in</SelectItem>
                        <SelectItem value="move_out">Move-out</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={inspForm.scheduled_for} onChange={(e) => setInspForm({ ...inspForm, scheduled_for: e.target.value })} /></div>
                  <div><Label>Inspector</Label><Input value={inspForm.inspector_name} onChange={(e) => setInspForm({ ...inspForm, inspector_name: e.target.value })} placeholder="Caretaker / agent name" /></div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createInspection.mutate()} disabled={createInspection.isPending || !inspForm.unit_id}>Schedule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {(inspections ?? []).length === 0 && <EmptyState text="No inspections scheduled." />}
            {(inspections ?? []).map((i) => (
              <div key={i.id} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold capitalize">{i.kind.replace("_", "-")} inspection</div>
                    <div className="text-sm text-muted-foreground">
                      {(i.units as { properties?: { name?: string } } | null)?.properties?.name} — {(i.units as { label?: string } | null)?.label} · {formatDate(i.scheduled_for)}
                      {i.inspector_name && ` · ${i.inspector_name}`}
                    </div>
                    {i.summary && <p className="mt-2 text-sm">{i.summary}</p>}
                    {Number(i.deductions) > 0 && <p className="text-sm text-destructive">Deposit deductions: {formatKES(Number(i.deductions))}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(i.status)}`}>{i.status}</span>
                    {i.status !== "completed" && (
                      <Dialog open={completing === i.id} onOpenChange={(o) => setCompleting(o ? i.id : null)}>
                        <DialogTrigger asChild><Button size="sm" variant="outline">Complete</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Complete inspection</DialogTitle>
                            <DialogDescription>Record findings and any deposit deductions.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3">
                            <div><Label>Findings</Label><Textarea value={completeForm.summary} onChange={(e) => setCompleteForm({ ...completeForm, summary: e.target.value })} /></div>
                            <div><Label>Deductions (KES)</Label><Input type="number" value={completeForm.deductions} onChange={(e) => setCompleteForm({ ...completeForm, deductions: e.target.value })} /></div>
                          </div>
                          <DialogFooter>
                            <Button onClick={() => completeInspection.mutate(i.id)} disabled={completeInspection.isPending}>Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Renewals */}
        <TabsContent value="renewals">
          <div className="flex justify-end mb-3">
            <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
              <DialogTrigger asChild>
                <Button><RefreshCw className="mr-2 h-4 w-4" />Offer renewal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send a renewal offer</DialogTitle>
                  <DialogDescription>The tenant can accept or decline from their app.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Lease</Label>
                    <Select value={renewForm.lease_id} onValueChange={(v) => {
                      const l = leases?.find((x) => x.id === v);
                      setRenewForm({ ...renewForm, lease_id: v, new_rent: String(l?.rent_amount ?? "") });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select lease" /></SelectTrigger>
                      <SelectContent>
                        {(leases ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {(l.profiles as { full_name?: string } | null)?.full_name ?? "Tenant"} — {(l.units as { label?: string } | null)?.label} · {formatKES(l.rent_amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>New monthly rent (KES)</Label><Input type="number" value={renewForm.new_rent} onChange={(e) => setRenewForm({ ...renewForm, new_rent: e.target.value })} /></div>
                  <div><Label>New end date</Label><Input type="date" value={renewForm.new_end_date} onChange={(e) => setRenewForm({ ...renewForm, new_end_date: e.target.value })} /></div>
                  <div><Label>Message</Label><Textarea value={renewForm.message} onChange={(e) => setRenewForm({ ...renewForm, message: e.target.value })} placeholder="We'd love to have you stay another year." /></div>
                </div>
                <DialogFooter>
                  <Button onClick={() => offerRenewal.mutate()} disabled={offerRenewal.isPending || !renewForm.lease_id}>Send offer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {(renewals ?? []).length === 0 && <EmptyState text="No renewal offers yet." />}
            {(renewals ?? []).map((r) => (
              <div key={r.id} className="rounded-2xl bg-card p-4 shadow-card flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {((r.leases as { units?: { properties?: { name?: string } } } | null)?.units?.properties?.name) ?? "Lease"} — {((r.leases as { units?: { label?: string } } | null)?.units?.label) ?? ""}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatKES(r.current_rent)} → <span className="font-semibold text-foreground">{formatKES(r.new_rent)}</span>
                    {r.new_end_date && ` · until ${formatDate(r.new_end_date)}`}
                  </div>
                  {r.message && <p className="mt-1 text-sm">{r.message}</p>}
                  {r.response_note && <p className="mt-1 text-xs text-muted-foreground">Tenant: {r.response_note}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(r.status)}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const DEFAULT_CHECKLIST = [
  { area: "Walls & ceiling", condition: "" },
  { area: "Floors", condition: "" },
  { area: "Windows & grills", condition: "" },
  { area: "Doors & locks", condition: "" },
  { area: "Kitchen fittings", condition: "" },
  { area: "Bathroom & plumbing", condition: "" },
  { area: "Electrical & sockets", condition: "" },
  { area: "Water meter reading", condition: "" },
];

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
