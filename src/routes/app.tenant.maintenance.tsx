import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/app/tenant/maintenance")({
  component: TenantMaintenance,
});

const CATEGORIES = ["Plumbing", "Electrical", "Appliance", "Structural", "Pest control", "Security", "Other"];
const PRIORITIES = [
  { v: "low", l: "Low" },
  { v: "normal", l: "Normal" },
  { v: "high", l: "High" },
  { v: "urgent", l: "Urgent" },
] as const;

type Priority = typeof PRIORITIES[number]["v"];

function TenantMaintenance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState<string>("");

  const { data: leases } = useQuery({
    queryKey: ["tenant-leases-min", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("id, unit_id, units(label, properties(name))")
        .eq("tenant_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["tenant-maintenance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*, units(label, properties(name))")
        .eq("tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!title.trim() || !description.trim()) throw new Error("Add a title and description");
      const chosenUnit = unitId || leases?.[0]?.unit_id || null;
      const { error } = await supabase.from("maintenance_requests").insert({
        tenant_id: user.id,
        unit_id: chosenUnit,
        category,
        priority,
        title: title.trim(),
        description: description.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted");
      setTitle(""); setDescription("");
      void qc.invalidateQueries({ queryKey: ["tenant-maintenance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Maintenance"
        description="Report an issue with your unit. Your landlord is notified immediately."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-clay" />
          <h2 className="font-display text-lg font-semibold">New request</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <F label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leaking kitchen tap" />
          </F>
          <F label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Priority">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          {leases && leases.length > 1 && (
            <F label="Unit">
              <Select value={unitId || leases[0].unit_id} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leases.map((l) => {
                    const u = l.units as unknown as { label: string; properties: { name: string } | null } | null;
                    return (
                      <SelectItem key={l.id} value={l.unit_id!}>
                        {u?.properties?.name ?? "—"} · {u?.label ?? "—"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </F>
          )}
          <div className="sm:col-span-2">
            <F label="Description">
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening? When did it start?" />
            </F>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-muted-foreground">Your requests</h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : !requests?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((r) => {
              const u = r.units as unknown as { label: string; properties: { name: string } | null } | null;
              return (
                <li key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {u?.properties?.name ?? "—"} · {u?.label ?? "—"} · {r.category} · {formatDateTime(r.created_at)}
                      </div>
                      <p className="mt-2 text-sm text-foreground/80">{r.description}</p>
                      {r.landlord_note && (
                        <p className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-xs">
                          <span className="font-semibold">Landlord: </span>{r.landlord_note}
                        </p>
                      )}
                    </div>
                    <StatusPill status={r.status} priority={r.priority} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label><div className="mt-1.5">{children}</div></div>;
}

function StatusPill({ status, priority }: { status: string; priority: string }) {
  const map: Record<string, string> = {
    open: "bg-amber-100 text-amber-900",
    acknowledged: "bg-blue-100 text-blue-900",
    in_progress: "bg-indigo-100 text-indigo-900",
    resolved: "bg-emerald-100 text-emerald-900",
    closed: "bg-muted text-muted-foreground",
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? "bg-muted"}`}>
        {status.replace("_", " ")}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{priority}</span>
    </div>
  );
}
