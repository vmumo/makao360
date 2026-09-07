import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Paperclip, Plus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Thread = {
  id: string;
  subject: string;
  landlord_id: string;
  tenant_id: string | null;
  lease_id: string | null;
  unit_id: string | null;
  property_id: string | null;
  last_message_at: string;
};

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
};

type LeaseOption = {
  id: string;
  unit_id: string;
  tenant_id: string;
  landlord_id: string;
  units: { label: string; property_id: string; properties: { name: string } | null } | null;
  profiles: { full_name: string | null } | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
}

export function Inbox({ audience }: { audience: "tenant" | "landlord" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [open, setOpen] = useState(false);

  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_threads")
        .select("id, subject, landlord_id, tenant_id, lease_id, unit_id, property_id, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Thread[];
    },
  });

  useEffect(() => {
    if (!activeId && threads && threads.length > 0) setActiveId(threads[0].id);
  }, [threads, activeId]);

  const { data: messages } = useQuery({
    queryKey: ["messages", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", activeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // realtime updates for the open thread + thread list
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inbox-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["messages"] });
        void qc.invalidateQueries({ queryKey: ["threads"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, qc]);

  const { data: leases } = useQuery({
    queryKey: ["inbox-leases", user?.id, audience],
    enabled: !!user && open,
    queryFn: async () => {
      const q = supabase
        .from("leases")
        .select("id, unit_id, tenant_id, landlord_id, units(label, property_id, properties(name)), profiles:tenant_id(full_name)")
        .eq("status", "active")
        .limit(200);
      const { data, error } = await (audience === "landlord"
        ? q.eq("landlord_id", user!.id)
        : q.eq("tenant_id", user!.id));
      if (error) throw error;
      return (data ?? []) as unknown as LeaseOption[];
    },
  });

  const createThread = useMutation({
    mutationFn: async (input: { leaseId: string; subject: string; body: string }) => {
      const lease = leases?.find((l) => l.id === input.leaseId);
      if (!lease) throw new Error("Select a unit first");
      const { data, error } = await supabase
        .from("message_threads")
        .insert({
          landlord_id: lease.landlord_id,
          tenant_id: lease.tenant_id,
          lease_id: lease.id,
          unit_id: lease.unit_id,
          property_id: lease.units?.property_id ?? null,
          subject: input.subject,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (input.body.trim()) {
        const { error: mErr } = await supabase
          .from("messages")
          .insert({ thread_id: data.id, sender_id: user!.id, body: input.body.trim() });
        if (mErr) throw mErr;
      }
      return data.id as string;
    },
    onSuccess: (id) => {
      setOpen(false);
      setActiveId(id);
      void qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Conversation started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!activeId) throw new Error("Choose a conversation");
      if (!draft.trim() && !attachment.trim()) throw new Error("Write a message first");
      const { error } = await supabase.from("messages").insert({
        thread_id: activeId,
        sender_id: user!.id,
        body: draft.trim(),
        attachment_url: attachment.trim() || null,
        attachment_name: attachment.trim() ? attachment.trim().split("/").pop() ?? "Document" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      setAttachment("");
      void qc.invalidateQueries({ queryKey: ["messages", activeId] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = useMemo(() => threads?.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="font-display font-semibold text-sm">Conversations</div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary"><Plus className="size-4 mr-1" /> New</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Start a conversation</DialogTitle></DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createThread.mutate({
                    leaseId: String(fd.get("lease_id") ?? ""),
                    subject: String(fd.get("subject") ?? "").trim() || "General enquiry",
                    body: String(fd.get("body") ?? ""),
                  });
                }}
              >
                <div className="space-y-1.5">
                  <Label>Unit / tenancy</Label>
                  <Select name="lease_id" required>
                    <SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger>
                    <SelectContent>
                      {(leases ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.units?.properties?.name ?? "Property"} · {l.units?.label}
                          {audience === "landlord" ? ` — ${l.profiles?.full_name ?? "Tenant"}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" placeholder="e.g. Water leak in kitchen" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="body">Message</Label>
                  <Textarea id="body" name="body" rows={4} placeholder="Type your message…" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createThread.isPending}>
                    {createThread.isPending ? "Starting…" : "Start conversation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : !threads || threads.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="size-7 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No conversations yet. Start one with your {audience === "tenant" ? "landlord or caretaker" : "tenant"}.
              </p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left px-4 py-3 border-t first:border-t-0 transition ${
                  t.id === activeId ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <div className="font-medium text-sm truncate">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{timeAgo(t.last_message_at)}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card flex flex-col min-h-[420px]">
        {!active ? (
          <div className="flex-1 grid place-items-center p-8 text-sm text-muted-foreground">
            Select a conversation to read messages.
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-display font-semibold">{active.subject}</div>
                <div className="text-xs text-muted-foreground">Thread for this unit / lease</div>
              </div>
              <Badge variant="secondary">{audience === "tenant" ? "Landlord & caretaker" : "Tenant"}</Badge>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[420px]">
              {(messages ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages yet — say hello.</div>
              ) : (
                (messages ?? []).map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                        {m.attachment_url && (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 underline text-xs"
                          >
                            <Paperclip className="size-3" /> {m.attachment_name ?? "Document"}
                          </a>
                        )}
                        <div className="mt-1 text-[10px] opacity-70">{timeAgo(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t p-3 space-y-2">
              <Textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
              />
              <div className="flex items-center gap-2">
                <Input
                  value={attachment}
                  onChange={(e) => setAttachment(e.target.value)}
                  placeholder="Attach a document link (optional)"
                />
                <Button onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending}>
                  <Send className="size-4 mr-1" /> Send
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
