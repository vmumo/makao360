import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, FileSignature, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatKES } from "@/lib/format";

export const Route = createFileRoute("/app/tenant/leasing")({
  component: TenantLeasingPage,
  head: () => ({
    meta: [
      { title: "My tenancy documents — Makao360" },
      { name: "description", content: "Sign your tenancy agreement, review inspections and respond to renewal offers from your landlord." },
      { property: "og:title", content: "My tenancy documents — Makao360" },
      { property: "og:description", content: "E-sign your lease, track inspections and accept renewal offers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function TenantLeasingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [signName, setSignName] = useState("");
  const [note, setNote] = useState("");

  const { data: docs } = useQuery({
    queryKey: ["tenant-lease-docs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("lease_documents").select("*")
        .eq("tenant_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: renewals } = useQuery({
    queryKey: ["tenant-renewals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("lease_renewals").select("*")
        .eq("tenant_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ["tenant-inspections", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("inspections").select("*, units(label, properties(name))")
        .eq("tenant_id", user!.id).order("scheduled_for", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lease_documents").update({
        tenant_signature: signName.trim(),
        tenant_signed_at: new Date().toISOString(),
        status: "signed",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agreement signed"); setSignName(""); qc.invalidateQueries({ queryKey: ["tenant-lease-docs", user?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase.from("lease_renewals").update({
        status, responded_at: new Date().toISOString(), response_note: note.trim() || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Response sent to your landlord"); setNote(""); qc.invalidateQueries({ queryKey: ["tenant-renewals", user?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="My tenancy" description="Agreements to sign, inspections and renewal offers." />

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><FileSignature className="h-4 w-4" />Agreements</h2>
        {(docs ?? []).length === 0 && <Empty text="Nothing to sign right now." />}
        <div className="space-y-3">
          {(docs ?? []).map((d) => (
            <div key={d.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Sent {formatDate(d.sent_at ?? d.created_at)}
                    {d.tenant_signed_at && ` · you signed ${formatDateTime(d.tenant_signed_at)}`}
                  </div>
                </div>
                {d.status === "sent" && !d.tenant_signed_at ? (
                  <Dialog>
                    <DialogTrigger asChild><Button size="sm">Review & sign</Button></DialogTrigger>
                    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{d.title}</DialogTitle>
                        <DialogDescription>Read the agreement, then type your full legal name to sign electronically.</DialogDescription>
                      </DialogHeader>
                      <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{d.body}</pre>
                      <Label>Full legal name</Label>
                      <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
                      <DialogFooter>
                        <Button disabled={!signName.trim() || sign.isPending} onClick={() => sign.mutate(d.id)}>Sign agreement</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{d.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><RefreshCw className="h-4 w-4" />Renewal offers</h2>
        {(renewals ?? []).length === 0 && <Empty text="No renewal offers." />}
        <div className="space-y-3">
          {(renewals ?? []).map((r) => (
            <div key={r.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{formatKES(r.current_rent)} → {formatKES(r.new_rent)}</div>
                  {r.new_end_date && <div className="text-sm text-muted-foreground">Runs to {formatDate(r.new_end_date)}</div>}
                  {r.message && <p className="mt-1 text-sm">{r.message}</p>}
                </div>
                {r.status === "offered" ? (
                  <div className="flex flex-col items-end gap-2">
                    <Textarea className="w-56" rows={2} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respond.mutate({ id: r.id, status: "accepted" })} disabled={respond.isPending}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: r.id, status: "declined" })} disabled={respond.isPending}>Decline</Button>
                    </div>
                  </div>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><ClipboardCheck className="h-4 w-4" />Inspections</h2>
        {(inspections ?? []).length === 0 && <Empty text="No inspections recorded." />}
        <div className="space-y-3">
          {(inspections ?? []).map((i) => (
            <div key={i.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="font-semibold capitalize">{i.kind.replace("_", "-")} · {formatDate(i.scheduled_for)}</div>
              <div className="text-sm text-muted-foreground">
                {(i.units as { properties?: { name?: string } } | null)?.properties?.name} — {(i.units as { label?: string } | null)?.label} · {i.status}
              </div>
              {i.summary && <p className="mt-1 text-sm">{i.summary}</p>}
              {Number(i.deductions) > 0 && <p className="text-sm text-destructive">Deposit deductions: {formatKES(Number(i.deductions))}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
