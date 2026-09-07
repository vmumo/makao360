import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FolderTree, Tag, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/landlord/settings")({
  component: LandlordSettings,
});

function LandlordSettings() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your team, group properties into portfolios, and tag them for filtering."
      />
      <Tabs defaultValue="team">
        <TabsList className="mb-4">
          <TabsTrigger value="team"><Users className="size-4 mr-1.5" />Team</TabsTrigger>
          <TabsTrigger value="portfolios"><FolderTree className="size-4 mr-1.5" />Portfolios</TabsTrigger>
          <TabsTrigger value="tags"><Tag className="size-4 mr-1.5" />Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="team"><TeamSection /></TabsContent>
        <TabsContent value="portfolios"><PortfoliosSection /></TabsContent>
        <TabsContent value="tags"><TagsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===== TEAM =====
type TeamMember = {
  id: string;
  member_phone: string;
  member_name: string | null;
  role: "caretaker" | "manager";
  status: "invited" | "active" | "revoked";
  property_ids: string[];
  invited_at: string;
  accepted_at: string | null;
};

function TeamSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"caretaker" | "manager">("caretaker");
  const [selectedProps, setSelectedProps] = useState<string[]>([]);

  const team = useQuery({
    queryKey: ["team-members", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlord_team_members")
        .select("*")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as TeamMember[];
    },
  });

  const properties = useQuery({
    queryKey: ["landlord-properties", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .eq("landlord_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      if (!phone.trim()) throw new Error("Phone is required");
      const { error } = await supabase.from("landlord_team_members").insert({
        landlord_id: user!.id,
        member_phone: phone.trim(),
        member_name: name.trim() || null,
        role,
        property_ids: selectedProps,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team member invited");
      setOpen(false); setPhone(""); setName(""); setSelectedProps([]); setRole("caretaker");
      void qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not invite"),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landlord_team_members")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access revoked");
      void qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke"),
  });

  const propMap = Object.fromEntries((properties.data ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Caretakers & managers</h2>
          <p className="text-sm text-muted-foreground">
            Invite people by phone and scope them to specific properties.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="size-4 mr-1.5" />Invite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite team member</DialogTitle>
              <DialogDescription>They'll get access tied to their phone number.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254..." />
              </div>
              <div>
                <Label>Name (optional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "caretaker" | "manager")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caretaker">Caretaker (view & log)</SelectItem>
                    <SelectItem value="manager">Property manager (broader access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Properties they can access</Label>
                <div className="mt-1.5 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {(properties.data ?? []).map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProps.includes(p.id)}
                        onChange={(e) => {
                          setSelectedProps((prev) =>
                            e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                          );
                        }}
                      />
                      {p.name}
                    </label>
                  ))}
                  {!properties.data?.length && (
                    <div className="text-xs text-muted-foreground">No properties yet</div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => invite.mutate()} disabled={invite.isPending}>
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {team.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !team.data?.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Users className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No team yet</p>
          <p className="text-xs text-muted-foreground">Invite a caretaker to help manage day-to-day issues.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {team.data.map((m) => (
            <li key={m.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{m.member_name ?? m.member_phone}</div>
                <div className="text-xs text-muted-foreground">
                  {m.member_phone} · {m.property_ids.length} {m.property_ids.length === 1 ? "property" : "properties"}
                  {m.property_ids.length > 0 && (
                    <span className="ml-1">
                      ({m.property_ids.slice(0, 2).map((id) => propMap[id] ?? "?").join(", ")}
                      {m.property_ids.length > 2 && ` +${m.property_ids.length - 2}`})
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={m.status === "active" ? "default" : m.status === "invited" ? "secondary" : "outline"}>
                {m.status}
              </Badge>
              <Badge variant="outline" className="capitalize">{m.role}</Badge>
              {m.status !== "revoked" && (
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(m.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===== PORTFOLIOS =====
function PortfoliosSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const portfolios = useQuery({
    queryKey: ["portfolios", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_portfolios")
        .select("*, properties(id, name)")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase
        .from("property_portfolios")
        .insert({ landlord_id: user!.id, name: name.trim(), description: desc.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Portfolio created");
      setName(""); setDesc("");
      void qc.invalidateQueries({ queryKey: ["portfolios"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_portfolios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Portfolio deleted");
      void qc.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="font-display text-lg font-semibold mb-1">Property portfolios</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Group properties (e.g. by location or building type) for easier reporting.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <Input placeholder="Portfolio name (e.g. Westlands)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4 mr-1" />Add
        </Button>
      </div>
      {!portfolios.data?.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No portfolios yet — create one above.
        </div>
      ) : (
        <ul className="space-y-2">
          {portfolios.data.map((p) => {
            const props = (p.properties ?? []) as { id: string; name: string }[];
            return (
              <li key={p.id} className="flex items-center gap-3 p-3 border rounded-xl">
                <FolderTree className="size-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {props.length} {props.length === 1 ? "property" : "properties"}
                    {p.description && ` · ${p.description}`}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground mt-4">
        Tip: assign properties to a portfolio from the property edit screen.
      </p>
    </div>
  );
}

// ===== TAGS =====
function TagsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");

  const tags = useQuery({
    queryKey: ["property-tags", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_tags")
        .select("*")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Label required");
      const { error } = await supabase
        .from("property_tags")
        .insert({ landlord_id: user!.id, label: label.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tag added");
      setLabel("");
      void qc.invalidateQueries({ queryKey: ["property-tags"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["property-tags"] });
    },
  });

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="font-display text-lg font-semibold mb-1">Property tags</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Flexible labels (e.g. "high-end", "student housing") for filtering across portfolios.
      </p>
      <div className="flex gap-2 mb-6">
        <Input placeholder="Tag label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4 mr-1" />Add
        </Button>
      </div>
      {!tags.data?.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tags yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.data.map((t) => (
            <button
              key={t.id}
              onClick={() => remove.mutate(t.id)}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
              title="Click to delete"
            >
              <Tag className="size-3" />
              {t.label}
              <Trash2 className="size-3 opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
