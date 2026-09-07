import { createFileRoute, Navigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/app/admin/kyc")({
  component: AdminKycPage,
});

type Status = "pending" | "verified" | "rejected" | "unverified";
const STATUSES: Status[] = ["pending", "verified", "rejected", "unverified"];

function AdminKycPage() {
  const { hasRole, loading } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status>("pending");

  if (!loading && !hasRole("admin")) return <Navigate to="/app" />;


  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-kyc", filter],
    enabled: hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("status", filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      let profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", ids);
        profileMap = new Map((profs ?? []).map((p) => [p.user_id, { full_name: p.full_name, phone: p.phone }]));
      }
      return (data ?? []).map((r) => ({ ...r, profiles: profileMap.get(r.user_id) ?? null }));
    },

  });

  const decide = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: Status; notes: string }) => {
      const { data: sess } = await supabase.auth.getSession();
      const { error } = await supabase
        .from("kyc_submissions")
        .update({
          status,
          reviewer_notes: notes || null,
          reviewed_by: sess.session?.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision saved");
      void qc.invalidateQueries({ queryKey: ["admin-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!hasRole("admin")) {
    return <p className="text-sm text-muted-foreground">Admin access required.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="KYC review queue"
        description="Approve or reject identity verification submissions."
        actions={
          <Select value={filter} onValueChange={(v) => setFilter(v as Status)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !rows?.length ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No submissions in {filter}.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const p = r.profiles as unknown as { full_name: string | null; phone: string | null } | null;
            return (
              <Row key={r.id} sub={r} profile={p} onDecide={(status, notes) => decide.mutate({ id: r.id, status, notes })} pending={decide.isPending} />
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Sub = {
  id: string; full_name: string; id_type: string; id_number: string; country: string;
  status: string; reviewer_notes: string | null; created_at: string;
};

function Row({ sub, profile, onDecide, pending }: { sub: Sub; profile: { full_name: string | null; phone: string | null } | null; onDecide: (s: Status, n: string) => void; pending: boolean }) {
  const [notes, setNotes] = useState(sub.reviewer_notes ?? "");
  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-display text-base font-semibold">{sub.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {sub.id_type.replace("_", " ")} · {sub.id_number} · {sub.country} · {formatDateTime(sub.created_at)}
          </div>
          {profile && (
            <div className="mt-1 text-xs">
              Account: {profile.full_name ?? "—"} {profile.phone && <span className="text-muted-foreground">· {profile.phone}</span>}
            </div>
          )}
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">{sub.status}</span>
      </div>
      <Textarea
        className="mt-4"
        rows={2}
        placeholder="Reviewer notes (visible to the user)…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => onDecide("unverified", notes)}>Needs info</Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => onDecide("rejected", notes)}>Reject</Button>
        <Button size="sm" disabled={pending} onClick={() => onDecide("verified", notes)}>Verify</Button>
      </div>
    </li>
  );
}
