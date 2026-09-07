import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, ExternalLink, CheckCircle2, Receipt, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

type Notif = {
  id: string;
  user_id: string;
  channel: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

type Filter = "all" | "unread" | "read";

export function NotificationsList({
  audience = "tenant",
}: {
  audience?: "tenant" | "landlord";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Notif[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { title: string; body: string | null };
          toast.message(n.title, { description: n.body ?? undefined });
          void qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "unread") return data.filter((n) => !n.read_at);
    if (filter === "read") return data.filter((n) => !!n.read_at);
    return data;
  }, [data, filter]);

  const unread = data?.filter((n) => !n.read_at).length ?? 0;

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("All marked as read");
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const jumpTarget = (n: Notif): { label: string; path: string } | null => {
    const p = n.payload ?? {};
    const contribId = typeof p.contribution_id === "string" ? p.contribution_id : null;
    const payoutId = typeof p.payout_id === "string" ? p.payout_id : null;
    const leaseId = typeof p.lease_id === "string" ? p.lease_id : null;

    if (audience === "tenant") {
      if (contribId) return { label: "View receipt", path: "/app/tenant/payments" };
      if (payoutId && leaseId)
        return { label: "View lease", path: `/app/tenant/leases/${leaseId}` };
      if (leaseId) return { label: "View lease", path: `/app/tenant/leases/${leaseId}` };
    } else {
      if (contribId) return { label: "Open in reconcile queue", path: "/app/landlord/reconciliation" };
      if (payoutId) return { label: "View payouts", path: "/app/landlord/payouts" };
      if (leaseId) return { label: "View tenants", path: "/app/landlord/tenants" };
    }
    return null;
  };

  const handleJump = async (n: Notif) => {
    if (!n.read_at) await markRead(n.id);
    const t = jumpTarget(n);
    if (t) void navigate({ to: t.path });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!data?.length) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Bell className="size-8 mx-auto text-muted-foreground" />
        <h3 className="mt-3 font-display font-semibold">All quiet</h3>
        <p className="text-sm text-muted-foreground mt-1">You'll see updates here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          {(["all", "unread", "read"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
              {f === "unread" && unread > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] rounded-full bg-warning/25 text-warning-foreground">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            <Check className="size-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Inbox className="size-7 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing in this view.
          </p>
        </div>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
          {filtered.map((n) => {
            const target = jumpTarget(n);
            const isPayout =
              n.payload && typeof (n.payload as Record<string, unknown>).payout_id === "string";
            const isContrib =
              n.payload &&
              typeof (n.payload as Record<string, unknown>).contribution_id === "string";
            return (
              <li
                key={n.id}
                className={`p-4 transition-colors ${
                  !n.read_at ? "bg-accent/10" : ""
                } ${target ? "hover:bg-muted/40 cursor-pointer" : ""}`}
                onClick={() => target && void handleJump(n)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`size-9 rounded-full grid place-items-center shrink-0 ${
                      isContrib
                        ? "bg-success/15 text-success"
                        : isPayout
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPayout ? (
                      <CheckCircle2 className="size-4" />
                    ) : isContrib ? (
                      <Receipt className="size-4" />
                    ) : (
                      <Bell className="size-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{n.title}</div>
                      {!n.read_at && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          New
                        </Badge>
                      )}
                    </div>
                    {n.body && (
                      <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{formatDateTime(n.created_at)}</span>
                      {target && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleJump(n);
                          }}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          {target.label}
                          <ExternalLink className="size-3" />
                        </button>
                      )}
                      {!n.read_at && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markRead(n.id);
                          }}
                          className="hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
