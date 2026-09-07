import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { Eye, Building2, X } from "lucide-react";

export const Route = createFileRoute("/app/admin/audit")({
  head: () => ({
    meta: [
      { title: "Access audit · Makao360 admin" },
      { name: "description", content: "Review who accessed which records and when, with a per-property activity feed." },
    ],
  }),
  component: AdminAudit,
});

type LogRow = {
  id: string;
  created_at: string;
  action: string;
  entity_table: string | null;
  entity_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_phone: string | null;
  meta: unknown;
};

type ActivityRow = {
  occurred_at: string;
  kind: string;
  title: string;
  detail: string | null;
  actor_name: string | null;
};

function AdminAudit() {
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["admin-access-log", search, entity, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_access_log", {
        _limit: 400,
        _search: search.trim() || undefined,
        _entity: entity === "all" ? undefined : entity,
        _from: from ? new Date(from).toISOString() : undefined,
        _to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const [propertySearch, setPropertySearch] = useState("");
  const { data: properties } = useQuery({
    queryKey: ["admin-audit-properties", propertySearch],
    queryFn: async () => {
      let q = supabase.from("properties").select("id, name").order("name").limit(200);
      if (propertySearch.trim()) q = q.ilike("name", `%${propertySearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["admin-property-activity", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_property_activity", {
        _property_id: propertyId,
        _limit: 120,
      });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    (logs ?? []).forEach((l) => l.entity_table && set.add(l.entity_table));
    return Array.from(set).sort();
  }, [logs]);

  const uniqueActors = useMemo(
    () => new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean)).size,
    [logs],
  );
  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (logs ?? []).filter((l) => new Date(l.created_at).getTime() >= cutoff).length;
  }, [logs]);

  const hasFilters = !!search || entity !== "all" || !!from || !!to;

  return (
    <div>
      <PageHeader
        title="Access audit"
        description="Who touched which records, when — plus a full activity feed per property."
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <StatCard label="Events shown" value={String(logs?.length ?? 0)} />
        <StatCard label="Distinct users" value={String(uniqueActors)} />
        <StatCard label="Last 24 hours" value={String(last24h)} />
      </div>

      <div className="rounded-xl border bg-card p-3 sm:p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Search user, action or table…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:col-span-2"
        />
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger><SelectValue placeholder="All records" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All records</SelectItem>
            {entityOptions.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <div className="flex gap-2">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear filters"
              onClick={() => { setSearch(""); setEntity("all"); setFrom(""); setTo(""); }}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Loading audit trail…</div>
      ) : !logs?.length ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Eye className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">No access events yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sensitive record views and money actions will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Record</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatDateTime(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.actor_name ?? "System"}</div>
                    <div className="text-xs text-muted-foreground">{l.actor_phone ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="secondary">{l.action}</Badge></td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {l.entity_table ?? "—"}
                    {l.entity_id ? <span className="font-mono text-xs"> · {l.entity_id.slice(0, 8)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Building2 className="size-4" /> Property activity feed
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Leases, payments and record access for a single property.
        </p>
        <div className="mt-3 max-w-md grid gap-2">
          <Input
            placeholder="Search properties by name…"
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
          />
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
            <SelectContent>
              {(properties ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


        {propertyId && (
          activityLoading ? (
            <div className="text-sm text-muted-foreground mt-4">Loading activity…</div>
          ) : !activity?.length ? (
            <div className="text-sm text-muted-foreground mt-4">No activity recorded for this property yet.</div>
          ) : (
            <ol className="mt-4 space-y-3 border-l pl-4">
              {activity.map((a, i) => (
                <li key={`${a.occurred_at}-${i}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{a.kind}</Badge>
                    <span className="font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(a.occurred_at)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {a.detail} {a.actor_name ? `· ${a.actor_name}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          )
        )}
      </div>
    </div>
  );
}
