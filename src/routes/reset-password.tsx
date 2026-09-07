import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password · Makao360" },
      { name: "description", content: "Set a new Makao360 password after clicking the recovery link in your email." },
    ],
  }),
});

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically on page load and fires
    // a PASSWORD_RECOVERY event; also check for an existing session so a user
    // who already clicked the link doesn't get stuck.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecovery(true);
      }
      setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecovery(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("Password updated. Redirecting…");
    setTimeout(() => void navigate({ to: "/app" }), 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-hero text-white grid place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white/95 text-foreground p-8 shadow-elevated">
        <Logo className="justify-center" />
        <div className="mt-6 flex items-center justify-center gap-2 text-primary">
          <ShieldCheck className="size-5" />
          <h1 className="font-display text-2xl font-bold">Reset your password</h1>
        </div>

        {!ready ? (
          <p className="mt-6 text-center text-sm text-muted-foreground animate-pulse">
            Checking your recovery link…
          </p>
        ) : done ? (
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 p-5 text-center">
            <CheckCircle2 className="mx-auto size-8 text-accent" />
            <p className="mt-2 font-medium">Password updated.</p>
            <p className="text-sm text-muted-foreground">Taking you into the app…</p>
          </div>
        ) : !hasRecovery ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              This page needs a valid recovery link. Open the email we sent you and click
              <span className="font-medium"> Reset password</span> — that link will bring you back here signed in.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login" search={{ redirect: undefined, invite: undefined }}>Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw" type="password" autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Confirm new password</Label>
              <Input
                id="pw2" type="password" autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required minLength={8} placeholder="Type it again"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11">
              {busy ? "Updating…" : "Update password"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              After updating, you'll be signed in automatically.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
