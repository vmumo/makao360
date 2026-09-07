import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Mail, ShieldCheck, ChevronLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/admin/settings")({
  component: AdminSettings,
});

type AdminUser = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  kyc_status: string;
  roles: string[];
  created_at: string;
  property_count: number;
  lease_count: number;
};

function AdminSettings() {
  const { hasRole, loading } = useAuth();
  const [filter, setFilter] = useState<"all" | "admin" | "landlord" | "tenant" | "caretaker">("all");
  const [search, setSearch] = useState("");

  const users = useQuery({
    queryKey: ["admin-users", filter],
    enabled: !loading && hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", {
        _role: filter === "all" ? undefined : filter,
      });
      if (error) throw error;
      return data as AdminUser[];
    },
  });

  const invites = useQuery({
    queryKey: ["admin-pending-invites"],
    enabled: !loading && hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invites")
        .select("id, tenant_phone, tenant_name, expires_at, accepted_at, created_at, units(label, properties(name))")
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;
  if (!hasRole("admin")) return <Navigate to="/app" />;

  const filtered = (users.data ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.user_id.toLowerCase().includes(q)
    );
  });

  const counts = (users.data ?? []).reduce(
    (acc, u) => {
      u.roles.forEach((r) => {
        if (r === "admin") acc.admin++;
        if (r === "landlord") acc.landlord++;
        if (r === "tenant") acc.tenant++;
        if (r === "caretaker") acc.caretaker++;
      });
      return acc;
    },
    { admin: 0, landlord: 0, tenant: 0, caretaker: 0 },
  );

  return (
    <div className="min-h-screen bg-background px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <Link to="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="size-4" />Back to Super admin
      </Link>
      <PageHeader
        title="User management"
        description="Manage all platform users — landlords, tenants, caretakers, admins."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Landlords" value={counts.landlord} tone="primary" />
        <StatCard label="Tenants" value={counts.tenant} />
        <StatCard label="Caretakers" value={counts.caretaker} />
        <StatCard label="Admins" value={counts.admin} tone="warning" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users"><Users className="size-4 mr-1.5" />Users</TabsTrigger>
          <TabsTrigger value="invites"><Mail className="size-4 mr-1.5" />Pending invites</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="rounded-2xl border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="landlord">Landlords</SelectItem>
                <SelectItem value="tenant">Tenants</SelectItem>
                <SelectItem value="caretaker">Caretakers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {users.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="rounded-2xl border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Phone</th>
                    <th className="text-left px-3 py-2">Roles</th>
                    <th className="text-right px-3 py-2 hidden md:table-cell">Properties</th>
                    <th className="text-right px-3 py-2 hidden md:table-cell">Leases</th>
                    <th className="text-left px-3 py-2 hidden lg:table-cell">Joined</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((u) => (
                    <UserRow key={u.user_id} user={u} />
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                  Showing 200 of {filtered.length}. Refine your search.
                </div>
              )}
              {!filtered.length && (
                <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invites">
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-display text-lg font-semibold mb-1">Pending tenant invites</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tenant invites that haven't been accepted yet.
            </p>
            {invites.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : !invites.data?.length ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No pending invites.
              </div>
            ) : (
              <ul className="divide-y">
                {invites.data.map((i) => {
                  const u = i.units as unknown as { label: string; properties?: { name: string } } | null;
                  const expired = new Date(i.expires_at) < new Date();
                  return (
                    <li key={i.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{i.tenant_name ?? i.tenant_phone}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.tenant_phone}
                          {u && ` · ${u.properties?.name ?? ""} ${u.label}`}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Sent {formatDate(i.created_at)}
                      </div>
                      <Badge variant={expired ? "destructive" : "secondary"}>
                        {expired ? "expired" : "pending"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<string | null>(null);

  const assign = useMutation({
    mutationFn: async (role: string) => {
      const { error } = await supabase.rpc("admin_assign_role", {
        _user_id: user.user_id,
        _role: role as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role assigned");
      setAdding(null);
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const revoke = useMutation({
    mutationFn: async (role: string) => {
      const { error } = await supabase.rpc("admin_revoke_role", {
        _user_id: user.user_id,
        _role: role as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const allRoles = ["admin", "landlord", "tenant", "caretaker"];
  const missing = allRoles.filter((r) => !user.roles.includes(r));

  return (
    <tr className="border-t hover:bg-muted/20">
      <td className="px-3 py-2">
        <div className="font-medium truncate max-w-[180px]">{user.full_name ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{user.user_id.slice(0, 8)}…</div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{user.phone ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-secondary">
              {r === "admin" && <ShieldCheck className="size-3" />}
              {r}
              <button onClick={() => revoke.mutate(r)} className="hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-right hidden md:table-cell">{user.property_count}</td>
      <td className="px-3 py-2 text-right hidden md:table-cell">{user.lease_count}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell">
        {formatDate(user.created_at)}
      </td>
      <td className="px-3 py-2 text-right">
        {missing.length > 0 && (
          adding === user.user_id ? (
            <Select onValueChange={(v) => assign.mutate(v)}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Add role" /></SelectTrigger>
              <SelectContent>
                {missing.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setAdding(user.user_id)}>
              <Plus className="size-3.5" />
            </Button>
          )
        )}
      </td>
    </tr>
  );
}
