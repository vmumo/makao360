import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Home, Wallet, FileBadge, User, ArrowUpRight, Plus, Bell, ChevronRight, Sparkles, Check,
  Zap, ShieldCheck, ArrowDownLeft, ArrowUpRight as ArrowOut, Building2, ArrowLeft, Receipt,
  Download, Smartphone, Mail, Loader2,
} from "lucide-react";
import { KES } from "@/lib/format";

type Tab = "home" | "pay" | "passport" | "me";

const TABS: readonly Tab[] = ["home", "pay", "passport", "me"] as const;
const isTab = (v: unknown): v is Tab => typeof v === "string" && (TABS as readonly string[]).includes(v);

export const Route = createFileRoute("/mobile-preview")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: isTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Mobile App Preview — Makao360" },
      { name: "description", content: "See the Makao360 tenant mobile app: wallet contributions, M-Pesa STK push, Rental Passport, and Fuliza Rent — all in one preview." },
      { property: "og:title", content: "Makao360 — Mobile App Preview" },
      { property: "og:description", content: "Build your rent wallet. Pay any amount, any time. Earn a Rental Passport." },
      { property: "og:image", content: "/og-mobile-preview.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-mobile-preview.jpg" },
      { name: "twitter:title", content: "Makao360 — Mobile App Preview" },
      { name: "twitter:description", content: "Build your rent wallet. Pay any amount, any time. Earn a Rental Passport." },
    ],
  }),
  component: MobilePreviewPage,
});

type Tenancy = {
  unit: string;
  landlord: string;
  property: string;
  rent: number;
  joinedAt: string;
};

const demoTenancy: Tenancy = {
  unit: "A-02",
  landlord: "Joseph M.",
  property: "Umoja Residences",
  rent: 8000,
  joinedAt: new Date().toISOString(),
};

function MobilePreviewPage() {
  const { tab: tabParam } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(tabParam ?? "home");

  // Sync from URL when search param changes (deep link navigations)
  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  return (
    <div className="min-h-screen bg-secondary/50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-elev md:my-8 md:min-h-0 md:max-h-[860px] md:overflow-hidden md:rounded-[2.25rem] md:border md:border-border">
        <StatusBar />
        <div className="flex-1 overflow-y-auto pb-24">
          {tab === "home" && <HomeScreen tenancy={demoTenancy} onPay={() => setTab("pay")} onPassport={() => setTab("passport")} />}
          {tab === "pay" && <PayScreen tenancy={demoTenancy} onBack={() => setTab("home")} />}
          {tab === "passport" && <PassportScreen onBack={() => setTab("home")} />}
          {tab === "me" && <MeScreen tenancies={[demoTenancy]} onBack={() => setTab("home")} />}
        </div>
        <TabBar tab={tab} setTab={setTab} />
      </div>
      <CaptureCTA />
      <BackToSite />
    </div>
  );
}

function CaptureCTA() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const e1 = email.trim();
    const p1 = phone.trim();
    if (!e1 && !p1) {
      toast.error("Enter an email or phone");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("marketing_contacts").insert({
      email: e1 || null,
      phone: p1 || null,
      source: "mobile_preview",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    setEmail("");
    setPhone("");
  };

  return (
    <div className="mx-auto mt-2 mb-10 max-w-md px-5 md:my-8">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        {done ? (
          <div className="text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-mpesa text-ivory">
              <Check className="h-5 w-5" />
            </div>
            <div className="mt-3 font-display text-lg font-medium">You're on the list</div>
            <p className="mt-1 text-xs text-muted-foreground">
              We'll reach out the moment the Makao360 mobile app is ready in your area.
            </p>
            <button
              onClick={() => setDone(false)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-clay hover:underline"
            >
              Add another contact
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">Get early access</div>
            <p className="mt-1 text-sm text-foreground">
              Drop your email or phone and we'll let you know when the mobile app launches in your city.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <label className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                Notify me
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              No spam. Just a single message when we're live in your area.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function BackToSite() {
  return (
    <div className="fixed bottom-4 left-4 z-50 hidden md:block">
      <Link to="/" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-soft hover:text-foreground">
        ← back to site
      </Link>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between bg-background px-6 pt-4 pb-2 font-mono text-[11px] text-foreground">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <span>●●●●</span>
        <span>5G</span>
        <span className="ml-1 inline-block h-2.5 w-5 rounded-sm border border-foreground/60">
          <span className="block h-full w-3/4 rounded-sm bg-foreground" />
        </span>
      </div>
    </div>
  );
}

/* ───────────────── Home ───────────────── */

function HomeScreen({ tenancy, onPay, onPassport }: {
  tenancy: Tenancy; onPay: () => void; onPassport: () => void;
}) {
  const target = tenancy.rent;
  const paid = Math.round(target * 0.775);
  const pct = Math.round((paid / target) * 100);
  return (
    <div>
      <div className="relative bg-gradient-hero px-6 pt-4 pb-32 text-ivory">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Habari, Wanjiru</p>
            <p className="mt-1 font-display text-xl font-medium text-ivory">Your rent wallet</p>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-ivory/10 text-ivory">
            <Bell className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-ivory/60">Unit {tenancy.unit} · {tenancy.property}</p>
        <p className="text-sm text-ivory/80">{tenancy.landlord}</p>
      </div>

      <div className="-mt-24 px-5">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elev">
          <div className="grid grid-cols-[auto,1fr] items-center gap-5 p-6">
            <Jar pct={pct} />
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xs text-muted-foreground">KES</span>
                <span className="font-display text-4xl font-medium tracking-tight">{KES(paid)}</span>
              </div>
              <div className="font-mono text-xs text-muted-foreground">of {KES(target)}</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mpesa/15 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-mpesa" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-mpesa">on track</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-border">
            <Stat k="Day" v="21 / 30" />
            <Stat k="Days left" v="9" border />
            <Stat k="Daily pace" v={`${KES(Math.round((target - paid) / 9))}`} />
          </div>
          <div className="m-4 grid grid-cols-2 gap-2">
            <button onClick={onPay} className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground shadow-glow">
              <Wallet className="h-4 w-4" /> Add to Wallet
            </button>
            <button onClick={onPay} className="flex items-center justify-center gap-1.5 rounded-2xl bg-mpesa py-3.5 text-sm font-medium text-ivory">
              <Plus className="h-4 w-4" /> Add to Rent
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 px-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quick add</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[100, 200, 500, 1000].map((a) => (
            <button key={a} onClick={onPay} className="rounded-2xl border border-border bg-card py-3 font-mono text-sm font-medium text-foreground hover:border-primary">
              {KES(a)}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onPassport} className="mt-6 mx-5 block w-[calc(100%-2.5rem)] overflow-hidden rounded-3xl bg-gradient-passport p-5 text-left text-ivory shadow-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
            <FileBadge className="h-3 w-3" /> Rental Passport · in progress
          </div>
          <ChevronRight className="h-4 w-4 text-ivory/60" />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="font-display text-3xl font-medium text-ivory">11 / 12</div>
            <div className="text-xs text-ivory/70">cycles to mortgage qualification</div>
          </div>
          <div className="rounded-full bg-ivory/10 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-ivory/80">A‑grade</div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ivory/15">
          <div className="h-full rounded-full bg-gold" style={{ width: "91.6%" }} />
        </div>
      </button>

      <div className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recent activity</p>
          <button className="text-xs text-clay">See all</button>
        </div>
        <ul className="mt-3 space-y-2">
          {[
            { who: "M-Pesa STK", note: "Daily contribution", amt: 200, when: "Today · 12:14" },
            { who: "M-Pesa STK", note: "Boda earnings", amt: 500, when: "Yesterday · 18:02" },
            { who: "Diaspora", note: "From Brian (UK)", amt: 2000, when: "May 14 · 09:11" },
            { who: "M-Pesa STK", note: "Weekly contribution", amt: 800, when: "May 12 · 17:30" },
          ].map((e, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className={`grid h-9 w-9 place-items-center rounded-full ${e.who === "Diaspora" ? "bg-gold/30 text-graphite" : "bg-mpesa/15 text-mpesa"}`}>
                {e.who === "Diaspora" ? <Sparkles className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{e.note}</div>
                <div className="text-[11px] text-muted-foreground">{e.who} · {e.when}</div>
              </div>
              <div className="font-mono text-sm font-medium text-mpesa">+{KES(e.amt)}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 mx-5 mb-8 rounded-3xl border border-gold/40 bg-gold/15 p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-graphite">
          <Zap className="h-3 w-3" /> Day 25 · Fuliza Rent ready
        </div>
        <p className="mt-2 text-sm text-foreground text-pretty">
          If you're short on Day 25, Safaricom can advance up to <span className="font-mono font-medium">{KES(1800)}</span> to complete your wallet. No application — pre-qualified from your record.
        </p>
        <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-graphite">
          See terms <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function Jar({ pct }: { pct: number }) {
  return (
    <div className="ring-jar relative grid h-28 w-28 place-items-center rounded-full" style={{ ["--p" as string]: pct }}>
      <div className="grid h-[86%] w-[86%] place-items-center rounded-full bg-card">
        <div className="text-center">
          <div className="font-display text-2xl font-medium text-foreground">{pct}%</div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">wallet</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, border }: { k: string; v: string; border?: boolean }) {
  return (
    <div className={`px-4 py-4 ${border ? "border-x border-border" : ""}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-1 text-sm font-medium">{v}</div>
    </div>
  );
}

/* ───────────────── Pay ───────────────── */

function PayScreen({ tenancy, onBack }: { tenancy: Tenancy; onBack: () => void }) {
  const [amount, setAmount] = useState(500);
  const [done, setDone] = useState(false);
  const presets = [100, 200, 500, 1000, 2000];
  const target = tenancy.rent;
  const baseline = Math.round(target * 0.775);

  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Back to wallet"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Unit {tenancy.unit}</span>
      </div>

      <h2 className="mt-5 font-display text-3xl font-medium tracking-tight">Add to your wallet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Any amount. Any time. STK push to your M-Pesa.</p>

      <div className="mt-6 rounded-3xl border border-border bg-card p-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Amount</div>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <span className="font-mono text-base text-muted-foreground">KES</span>
          <span className="font-display text-6xl font-medium tracking-tight">{KES(amount)}</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">After: <span className="font-mono text-foreground">{KES(baseline + amount)}</span> / {KES(target)} ({Math.round(((baseline + amount) / target) * 100)}%)</div>
      </div>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {presets.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className={`rounded-2xl border py-2.5 font-mono text-xs font-medium transition-colors ${amount === a ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
          >
            {a >= 1000 ? `${a / 1000}k` : a}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pay from</span>
          <span className="font-mono">M-Pesa · 0712 ••• 348</span>
        </div>
        <div className="mt-3 h-px bg-border" />
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Goes to</span>
          <span className="font-mono">Paybill 4400900 · ref {tenancy.unit}</span>
        </div>
      </div>

      {!done ? (
        <>
          <button
            onClick={() => { setDone(true); }}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-mpesa py-4 text-sm font-medium text-ivory"
          >
            Send STK push · {KES(amount)}
          </button>
          <button
            onClick={onBack}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <p className="mt-4 mb-6 text-center text-[11px] text-muted-foreground">
            Makao360 never holds your money. Funds settle directly to your landlord's paybill.
          </p>
        </>
      ) : (
        <div className="mt-8 rounded-3xl border border-mpesa/30 bg-mpesa/10 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mpesa text-ivory">
            <Check className="h-6 w-6" />
          </div>
          <div className="mt-3 font-display text-xl font-medium">STK push sent</div>
          <p className="mt-1 text-xs text-muted-foreground">Check your phone for the M-Pesa prompt to authorize {KES(amount)}.</p>
          <button
            onClick={onBack}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Done · back to wallet
          </button>
        </div>
      )}

      <FulizaSection tenancy={tenancy} />
    </div>
  );
}

function FulizaSection({ tenancy }: { tenancy: Tenancy }) {
  const today = 25;
  const daysToCycle = 30;
  const target = tenancy.rent;
  const paidSoFar = Math.round(target * 0.775);
  const shortfall = Math.max(0, target - paidSoFar);
  const eligible = Math.min(shortfall, Math.round(target * 0.5));
  const fee = Math.max(50, Math.round((eligible * 5) / 100));
  const dueDate = "next cycle (Day 14)";
  const [taken, setTaken] = useState(false);

  return (
    <div className="mt-8 mb-10 overflow-hidden rounded-3xl border border-gold/40 bg-gold/10">
      <div className="flex items-center justify-between bg-gold/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-graphite" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-graphite">
            Fuliza Rent · Day {today} of {daysToCycle}
          </span>
        </div>
        <span className="rounded-full bg-graphite px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ivory">
          Pre-qualified
        </span>
      </div>

      {!taken ? (
        <div className="px-5 py-5">
          <p className="text-sm text-foreground">
            You're <span className="font-mono">{KES(shortfall)}</span> short of this cycle's rent and we're {daysToCycle - today} day(s) from due date. Safaricom can advance up to{" "}
            <span className="font-mono font-medium">{KES(eligible)}</span> right now to top up your wallet — repaid automatically next cycle.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-background p-3 text-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Advance</div>
              <div className="mt-1 font-display text-lg font-medium">{KES(eligible)}</div>
            </div>
            <div className="border-x border-border">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Fee · 5%</div>
              <div className="mt-1 font-display text-lg font-medium">{KES(fee)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Repay by</div>
              <div className="mt-1 text-[11px] font-medium leading-tight">{dueDate}</div>
            </div>
          </div>
          <button
            onClick={() => setTaken(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-graphite py-3 text-sm font-medium text-ivory"
          >
            <Zap className="h-4 w-4 text-gold" /> Take {KES(eligible)} advance
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Auto-debited next cycle. No paperwork. No application.
          </p>
        </div>
      ) : (
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-mpesa text-ivory">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-sm font-medium">Advance credited</div>
              <div className="text-[11px] text-muted-foreground">
                {KES(eligible)} added to your wallet · this cycle complete
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-background p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Repayment</span>
              <span className="font-mono">{KES(eligible + fee)} · {dueDate}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-0 rounded-full bg-mpesa transition-all" />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>0% repaid</span>
              <span>auto on next M-Pesa contribution</span>
            </div>
          </div>
          <button
            onClick={() => setTaken(false)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-clay hover:underline"
          >
            Reset demo
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────── Passport ───────────────── */

function PassportScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-5 pt-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <h2 className="mt-5 font-display text-3xl font-medium tracking-tight">Rental Passport</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your verified rent behavior. Mortgage-ready at 12 cycles.</p>

      <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-passport p-6 text-ivory shadow-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
            <FileBadge className="h-3 w-3" /> Makao360 · Verified
          </div>
          <span className="rounded-full bg-ivory/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">A grade</span>
        </div>
        <div className="mt-12">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ivory/60">Holder</div>
          <div className="font-display text-2xl font-medium text-ivory">Wanjiru K. Mwangi</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ivory/15 pt-4">
          <div><div className="font-mono text-[10px] uppercase tracking-wider text-ivory/60">Cycles</div><div className="font-display text-2xl font-medium">11</div></div>
          <div><div className="font-mono text-[10px] uppercase tracking-wider text-ivory/60">On-time</div><div className="font-display text-2xl font-medium">96%</div></div>
          <div><div className="font-mono text-[10px] uppercase tracking-wider text-ivory/60">Avg/cycle</div><div className="font-display text-2xl font-medium">8k</div></div>
        </div>
        <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.2em] text-ivory/50">
          ID · MK360-WK-2024-08812 · Issued 14 May 2026
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <BenefitRow icon={Building2} title="KCB Micro Mortgage" desc="Pre-qualify at 12 cycles. No payslip required." cta="Pre-qualify" />
        <BenefitRow icon={ShieldCheck} title="Deposit financing" desc="Pay your next deposit in 3–6 installments." cta="Apply" />
        <BenefitRow icon={ArrowOut} title="Share with new landlord" desc="Send a verified link. They see your record, not your data." cta="Share" />
      </div>

      <div className="mt-6 mb-8 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Cycle history · last 6</div>
          <button className="inline-flex items-center gap-1 text-[11px] text-clay"><Download className="h-3 w-3" /> Receipts</button>
        </div>
        <div className="mt-3 flex h-20 items-end gap-2">
          {[100, 100, 95, 100, 100, 100].map((h, i) => (
            <div key={i} className="flex-1 rounded-md bg-primary/80" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span>
        </div>
      </div>
    </div>
  );
}

function BenefitRow({ icon: Icon, title, desc, cta }: { icon: typeof Building2; title: string; desc: string; cta: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <button className="rounded-full bg-foreground px-3 py-1.5 text-[11px] text-ivory">{cta}</button>
    </div>
  );
}

/* ───────────────── Me ───────────────── */

function MeScreen({ tenancies, onBack }: { tenancies: Tenancy[]; onBack: () => void }) {
  return (
    <div className="px-5 pt-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <div className="mt-5 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-clay text-ivory font-display text-xl">WK</div>
        <div>
          <div className="font-display text-2xl font-medium">Wanjiru K.</div>
          <div className="text-xs text-muted-foreground">Tenant since Jul 2024 · 11 cycles</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[["KES 88k", "Lifetime paid"], ["96%", "On-time"], ["A", "Grade"]].map(([k, v]) => (
          <div key={v} className="rounded-2xl border border-border bg-card p-4 text-center">
            <div className="font-display text-lg font-medium">{k}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Linked landlords</div>
        <ul className="mt-2 space-y-2">
          {tenancies.map((t, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Building2 className="h-4 w-4 text-primary" /></div>
              <div className="flex-1">
                <div className="text-sm font-medium">{t.landlord} <span className="text-muted-foreground">· {t.unit}</span></div>
                <div className="text-[11px] text-muted-foreground">{t.property} · KES {KES(t.rent)}/mo</div>
              </div>
              {i === 0 && <span className="rounded-full bg-mpesa/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mpesa">primary</span>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">A tenant can only have one active landlord, unless multi-residence is enabled.</p>
      </div>

      <ul className="mt-6 mb-8 space-y-1.5">
        {[
          { l: "Receipts & ledger", icon: Receipt },
          { l: "Linked M-Pesa numbers", icon: Smartphone },
          { l: "Diaspora contributors", icon: Sparkles },
          { l: "Notifications", icon: Bell },
          { l: "Privacy & data", icon: ShieldCheck },
          { l: "Help & support", icon: User },
        ].map((it) => (
          <li key={it.l}>
            <button className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-sm">
              <span className="inline-flex items-center gap-3"><it.icon className="h-4 w-4 text-muted-foreground" /> {it.l}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────── Tab bar ───────────────── */

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: "home", icon: Home, label: "Wallet" },
    { id: "pay", icon: Wallet, label: "Pay" },
    { id: "passport", icon: FileBadge, label: "Passport" },
    { id: "me", icon: User, label: "Me" },
  ];
  return (
    <div className="absolute inset-x-0 bottom-0 md:absolute">
      <div className="mx-auto max-w-md border-t border-border bg-background/95 backdrop-blur-xl">
        <nav className="grid grid-cols-4 px-2 pt-2 pb-5">
          {items.map((it) => {
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                onClick={() => setTab(it.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <it.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{it.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
