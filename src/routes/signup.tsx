import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { normalizeKePhone } from "@/lib/format";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
    phone: typeof s.phone === "string" ? s.phone : undefined,
  }),
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(9, "Enter your phone").max(20),
  password: z.string().min(6, "Min 6 characters").max(128),
  role: z.enum(["tenant", "landlord"]),
});

function SignupPage() {
  const navigate = useNavigate();
  const { invite, phone: invitePhone } = Route.useSearch();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: invitePhone ?? "",
    password: "",
    role: (invite ? "tenant" : "tenant") as "tenant" | "landlord",
  });
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const phone = normalizeKePhone(parsed.data.phone);
    if (!phone) {
      toast.error("Enter a valid Kenyan phone number");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: parsed.data.full_name, phone, preferred_role: parsed.data.role },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    // Set role + preferred_role. Profile is auto-created by trigger as 'tenant'; upgrade if landlord.
    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").update({ preferred_role: parsed.data.role, phone }).eq("user_id", userId);
      if (parsed.data.role === "landlord") {
        await supabase.from("user_roles").insert({ user_id: userId, role: "landlord" });
      }
    }

    setBusy(false);
    toast.success("Account created. Welcome!");
    if (invite) void navigate({ to: "/invite/$code", params: { code: invite } });
    else void navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-gradient-brand text-primary-foreground p-10 flex-col justify-between">
        <Logo className="text-primary-foreground" />
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Build a rental history that opens doors.
          </h1>
          <p className="mt-4 text-primary-foreground/80">
            Every contribution is recorded. After 12 cycles, qualify for deposit financing,
            insurance, and a path toward your first mortgage.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/70">Powered by M-Pesa</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="lg:hidden"><Logo /></div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto">
              ← Back to home
            </Link>
          </div>
          <h2 className="font-display text-2xl font-bold">Create your account</h2>
          <p className="text-sm text-muted-foreground mt-1">It takes less than a minute.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>I am a…</Label>
              <RadioGroup
                value={form.role}
                onValueChange={(v) => update("role", v as "tenant" | "landlord")}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { v: "tenant", label: "Tenant", sub: "I rent a place" },
                  { v: "landlord", label: "Landlord", sub: "I own units" },
                ].map((o) => (
                  <label
                    key={o.v}
                    className={`cursor-pointer rounded-xl border p-3 text-sm ${
                      form.role === o.v ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <RadioGroupItem value={o.v} className="sr-only" />
                    <div className="font-medium">{o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.sub}</div>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (M-Pesa)</Label>
              <Input id="phone" inputMode="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" search={{ invite: undefined, redirect: undefined }} className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
