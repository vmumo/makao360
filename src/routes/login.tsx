import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoUrl from "@/assets/makao360-logo.png";

import {
  Smartphone, FolderCheck, Smile, Sparkles, ArrowRight, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const { invite, redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const goNext = () => {
    if (invite) void navigate({ to: "/invite/$code", params: { code: invite } });
    else window.location.assign(getSafeRedirect(redirect));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
    goNext();
  };

  const onGoogle = async () => {
    const redirectTo = invite
      ? `${window.location.origin}/invite/${invite}`
      : `${window.location.origin}${getSafeRedirect(redirect)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) toast.error(error.message);
  };

  const onForgot = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Enter your email above first, then click Forgot?");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset link sent — check your email.");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-hero text-white">

      {/* Ambient color blobs from logo palette */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-accent/40 blur-[140px] animate-float" />
        <div className="absolute top-1/4 -right-32 size-[460px] rounded-full bg-sky/40 blur-[140px] animate-float" style={{ animationDelay: "1.8s" }} />
        <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-gold/35 blur-[120px] animate-float" style={{ animationDelay: "3.2s" }} />
        <div className="absolute inset-0 grid-pattern opacity-30" />
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-5 py-3">
          <img src={logoUrl} alt="Makao360" className="h-36 w-auto" />
        </Link>
        <Link to="/signup" search={{ invite: undefined, phone: undefined }} className="text-sm text-white/85 hover:text-white">
          New here? <span className="text-accent font-semibold">Sign up →</span>
        </Link>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 grid lg:grid-cols-12 gap-10 items-center pb-16">
        {/* Left: brand panel with color chips */}
        <section className="lg:col-span-7 hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md px-3 py-1 text-xs">
            <Sparkles className="size-3.5 text-accent" />
            Welcome back to Makao360
          </div>
          <h1 className="mt-6 font-display text-6xl xl:text-7xl font-bold leading-[0.98] tracking-tight">
            Your rent,
            <br />
            <span className="text-gradient-rainbow">in living color.</span>
          </h1>
          <p className="mt-6 text-lg text-white/75 max-w-lg">
            Pick up where you left off. Track every cycle, every contribution, every payout —
            all of it in one place.
          </p>

          {/* Color promise chips */}
          <div className="mt-10 grid grid-cols-3 gap-3 max-w-xl">
            <ChipPromise color="bg-accent text-accent-foreground" icon={Smartphone} label="Flexible rent" />
            <ChipPromise color="bg-gold text-gold-foreground" icon={FolderCheck} label="Better records" />
            <ChipPromise color="bg-sky text-sky-foreground" icon={Smile} label="Less stress" />
          </div>

          <div className="mt-10 inline-flex items-center gap-3 text-sm text-white/70">
            <ShieldCheck className="size-4 text-accent" />
            Bank-grade security · M-Pesa native
          </div>
        </section>

        {/* Right: floating glass card */}
        <section className="lg:col-span-5">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-green opacity-30 blur-3xl rounded-[2rem]" />
            <div className="relative rounded-[2rem] bg-white/95 backdrop-blur-xl text-foreground p-8 sm:p-10 shadow-elevated border border-white/30">
              {/* Top color stripe */}
              <div className="absolute top-0 inset-x-0 h-1.5 rounded-t-[2rem] flex overflow-hidden">
                <span className="flex-1 bg-primary" />
                <span className="flex-1 bg-accent" />
                <span className="flex-1 bg-gold" />
                <span className="flex-1 bg-sky" />
              </div>

              <div className="lg:hidden mb-6 flex justify-center">
                <img src={logoUrl} alt="Makao360" className="h-48 w-auto" />
              </div>

              <h2 className="font-display text-3xl font-bold tracking-tight">
                Sign <span className="text-accent">in</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {invite ? "Sign in to accept your invite." : "Welcome home."}
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    required placeholder="you@example.com"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={onForgot} disabled={busy} className="text-xs text-sky hover:underline disabled:opacity-50">
                      Forgot?
                    </button>
                  </div>
                  <Input
                    id="password" type="password" autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required placeholder="••••••••"
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
                >
                  {busy ? "Signing in…" : <>Continue <ArrowRight className="size-4 ml-1.5" /></>}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                onClick={onGoogle}
                className="w-full h-11 border-2 hover:border-accent hover:text-accent"
              >
                <GoogleIcon /> Continue with Google
              </Button>

              <p className="mt-7 text-sm text-muted-foreground text-center">
                New to Makao360?{" "}
                <Link
                  to="/signup"
                  search={{ invite, phone: undefined }}
                  className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Inline rainbow gradient utility */}
      <style>{`
        .text-gradient-rainbow {
          background: linear-gradient(95deg,
            oklch(0.85 0.16 80) 0%,
            oklch(0.72 0.20 145) 35%,
            oklch(0.62 0.16 240) 70%,
            oklch(0.85 0.16 80) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
      `}</style>
    </div>
  );
}

function getSafeRedirect(value?: string) {
  if (!value) return "/app";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/app";
    if (url.pathname === "/login" || url.pathname === "/signup") return "/app";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
  }
}

function ChipPromise({
  color, icon: Icon, label,
}: { color: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="rounded-2xl bg-white/8 backdrop-blur-md border border-white/15 p-4 flex flex-col items-start gap-2.5">
      <div className={`grid place-items-center size-10 rounded-xl ${color}`}>
        <Icon className="size-5" />
      </div>
      <div className="text-sm font-semibold text-white">{label}</div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4 mr-2" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.7 36.1 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
