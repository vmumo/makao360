import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/landlord/maintenance")({
  component: LandlordMaintenance,
});

const STATUSES = ["open", "acknowledged", "in_progress", "resolved", "closed"] as const;
type Status = typeof STATUSES[number];

function LandlordMaintenance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | "all">("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["landlord-maintenance", user?.id, filter],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("maintenance_requests")
        .select("*, units(label, properties(name)), profiles!maintenance_requests_tenant_profile_fkey(full_name, phone)")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status?: Status; note?: string }) => {
      const patch: {
        status?: Status;
        resolved_at?: string;
        landlord_note?: string;
      } = {};
      if (status) {
        patch.status = status;
        if (status === "resolved") patch.resolved_at = new Date().toISOString();
      }
      if (note !== undefined) patch.landlord_note = note;
      const { error } = await supabase.from("maintenance_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      void qc.invalidateQueries({ queryKey: ["landlord-maintenance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Maintenance"
        description="Work orders reported by your tenants."
        actions={
          <Select value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !rows?.length ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No maintenance requests {filter !== "all" ? `in ${filter}` : "yet"}.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const u = r.units as unknown as { label: string; properties: { name: string } | null } | null;
            const t = r.profiles as unknown as { full_name: string | null; phone: string | null } | null;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-display text-base font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {u?.properties?.name ?? "—"} · {u?.label ?? "—"} · {r.category} ·{" "}
                      <span className="uppercase">{r.priority}</span> · {formatDateTime(r.created_at)}
                    </div>
                    <div className="mt-1 text-xs">
                      Tenant: <span className="font-medium">{t?.full_name ?? "—"}</span>
                      {t?.phone && <span className="text-muted-foreground"> · {t.phone}</span>}
                    </div>
                    <p className="mt-3 text-sm text-foreground/80">{r.description}</p>
                  </div>
                  <Select
                    value={r.status}
                    onValueChange={(v) => update.mutate({ id: r.id, status: v as Status })}
                  >
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <NoteEditor
                  initial={r.landlord_note ?? ""}
                  onSave={(note) => update.mutate({ id: r.id, note })}
                  pending={update.isPending}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoteEditor({ initial, onSave, pending }: { initial: string; onSave: (n: string) => void; pending: boolean }) {
  const [note, setNote] = useState(initial);
  return (
    <div className="mt-4">
      <Textarea
        rows={2}
        placeholder="Update the tenant (visible to them)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" disabled={pending || note === initial} onClick={() => onSave(note)}>
          Save note
        </Button>
      </div>
    </div>
  );
}
