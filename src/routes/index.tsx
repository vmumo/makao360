import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/makao360-logo.png";
import heroNavIllustration from "@/assets/hero-nav-illustration.png";

import {
  Smartphone,
  FolderCheck,
  Smile,
  ArrowRight,
  ShieldCheck,
  Wallet,
  TrendingUp,
  Building2,
  Users,
  CheckCircle2,
  Sparkles,
  PieChart,
  Bell,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Makao360 — Flexible rent. Better records. Less stress." },
      {
        name: "description",
        content:
          "Pay rent your way, track every shilling, and build a verified rental history. Makao360 is the rent operating layer for landlords and tenants across urban Africa.",
      },
      { property: "og:title", content: "Makao360 — Flexible rent for urban Africa" },
      {
        property: "og:description",
        content:
          "Flexible rent contributions, transparent records, instant payouts. Built for Kenyan landlords and tenants.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />

      <Hero />
      <BrandPromise />
      <Stats />
      <ForLandlords />
      <ForTenants />
      <HowItWorks />
      <Trust />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 min-h-32 sm:min-h-56 py-3 sm:py-0 flex items-center gap-3 sm:gap-6">
        <Link to="/" aria-label="Makao360 home" className="flex items-center gap-2 shrink min-w-0">
          <img src={logoUrl} alt="Makao360 rent platform logo" className="h-24 max-w-[52vw] sm:h-52 sm:max-w-none w-auto object-contain object-left" />
        </Link>
        <div className="hidden lg:flex flex-1 items-center justify-center min-w-0 px-4" aria-hidden="false">
          <img
            src={heroNavIllustration}
            alt="Tenant using the Makao360 mobile app to pay rent"
            className="pointer-events-none h-48 w-auto max-w-full object-contain select-none"
            draggable={false}
            decoding="async"
          />
        </div>
        <div className="ml-auto flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          <Button asChild variant="ghost" size="sm">
            <Link data-testid="landing-sign-in" to="/login" search={{ invite: undefined, redirect: undefined }}>Sign in</Link>
          </Button>
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow">
            <Link data-testid="landing-get-started" to="/signup" search={{ invite: undefined, phone: undefined }}>Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroNavStrip() {
  return (
    <div className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-center gap-6 text-sm font-medium text-white/85">
        <nav className="flex items-center gap-6 sm:gap-8 flex-wrap justify-center">
          <Link to="/product" className="hover:text-white transition">Product</Link>
          <Link to="/landlords" className="hover:text-white transition">For landlords</Link>
          <Link to="/mobile-preview" search={{ tab: undefined }} className="hover:text-white transition">Mobile app</Link>
          <a href="#how" className="hover:text-white transition">How it works</a>
        </nav>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background: dramatic dark hero */}
      <div className="absolute inset-0 -z-10 bg-gradient-hero" />
      <div className="absolute inset-0 -z-10 grid-pattern opacity-40" />
      {/* Floating orbs */}
      <div className="absolute -top-32 -right-32 size-[480px] rounded-full bg-accent/30 blur-[120px] -z-10 animate-float" />
      <div className="absolute top-1/3 -left-40 size-[420px] rounded-full bg-sky/30 blur-[120px] -z-10 animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-0 right-1/3 size-[360px] rounded-full bg-gold/20 blur-[100px] -z-10 animate-float" style={{ animationDelay: "4s" }} />

      <HeroNavStrip />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-28 sm:pt-16 sm:pb-36">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="size-3.5 text-accent" />
              The rent operating layer for urban Africa
            </div>
            <h1 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight">
              Rent, <span className="italic font-normal text-gold">reimagined</span>
              <br />
              for the way you
              <br />
              <span className="text-accent">actually earn.</span>
            </h1>
            <p className="mt-6 text-lg text-white/75 max-w-xl leading-relaxed">
              Makao360 lets tenants contribute rent in flexible installments via M-Pesa,
              and gives landlords a real-time ledger, automatic reminders, and instant
              payouts — all in one place.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow text-base px-7 h-12"
              >
                <Link to="/mobile-preview" search={{ tab: undefined }}>
                  Preview mobile app <ArrowRight className="size-4 ml-1.5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 text-white bg-white/5 hover:bg-white/10 hover:text-white text-base px-7 h-12"
              >
                <a href="#how">See how it works</a>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-white/65">
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> No setup fees</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> M-Pesa native</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Built in Kenya</div>
            </div>
          </div>

          {/* Hero card mock */}
          <div className="lg:col-span-5 relative">
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-green opacity-40 blur-2xl rounded-3xl" />
              <PhoneMock />
            </div>
          </div>
        </div>
      </div>
      {/* Bottom curve */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-background" style={{ clipPath: "ellipse(120% 100% at 50% 100%)" }} />
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[380px] aspect-[9/16] rounded-[40px] bg-gradient-to-b from-card to-secondary border-[10px] border-foreground/90 shadow-elevated overflow-hidden">
      {/* notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/90 rounded-b-2xl z-10" />
      <div className="p-5 pt-10 h-full flex flex-col">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>9:41</span>
          <span className="font-mono">●●● 5G</span>
        </div>
        <div className="mt-4 rounded-2xl bg-gradient-brand text-primary-foreground p-5 shadow-card">
          <div className="text-xs uppercase tracking-wider opacity-75">Westlands · Unit 4B</div>
          <div className="font-display text-xl font-bold mt-1">November rent</div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-3xl font-display font-bold">KES 18,500</div>
              <div className="text-xs opacity-75">of KES 25,000 · due Nov 30</div>
            </div>
            <RingBadge value={74} />
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: "74%" }} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "+1,000", color: "bg-accent text-accent-foreground" },
            { label: "+2,500", color: "bg-secondary text-secondary-foreground" },
            { label: "+5,000", color: "bg-secondary text-secondary-foreground" },
          ].map((b) => (
            <div key={b.label} className={`rounded-xl ${b.color} text-center py-2.5 text-sm font-semibold shadow-sm`}>
              {b.label}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">M-Pesa · 25 Nov</span>
            <span className="font-semibold text-success">+ KES 2,500</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">RKG3PQ8M2W</div>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">M-Pesa · 18 Nov</span>
            <span className="font-semibold text-success">+ KES 5,000</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">RKB1XV9TQA</div>
        </div>
        <div className="mt-auto rounded-2xl bg-foreground text-background py-3 text-center font-semibold text-sm">
          Contribute now
        </div>
      </div>
    </div>
  );
}

function RingBadge({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={r} stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
      <circle
        cx="30" cy="30" r={r} stroke="oklch(0.72 0.20 145)"
        strokeWidth="6" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="34" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{value}%</text>
    </svg>
  );
}

function BrandPromise() {
  const items = [
    { icon: Smartphone, label: "Flexible rent", color: "bg-accent text-accent-foreground", desc: "Contribute any amount, anytime, via M-Pesa." },
    { icon: FolderCheck, label: "Better records", color: "bg-gold text-gold-foreground", desc: "Every payment receipted, ledgered, and downloadable." },
    { icon: Smile, label: "Less stress", color: "bg-sky text-sky-foreground", desc: "Smart reminders, automatic reconciliation, instant payouts." },
  ];
  return (
    <section className="relative -mt-8 sm:-mt-12 z-10">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.label} className="rounded-2xl bg-card border border-border shadow-card p-6 flex items-start gap-4">
              <div className={`grid place-items-center size-12 rounded-2xl ${it.color} shrink-0`}>
                <it.icon className="size-6" />
              </div>
              <div>
                <div className="font-display font-bold text-lg">{it.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{it.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { v: "KES 0", l: "to start", sub: "Free for landlords with up to 5 units" },
    { v: "<60s", l: "to invite a tenant", sub: "Phone number is all you need" },
    { v: "100%", l: "M-Pesa native", sub: "Built around how Kenya already pays" },
    { v: "24/7", l: "transparent ledger", sub: "Tenants & landlords see the same numbers" },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.l}>
            <div className="font-display text-4xl sm:text-5xl font-bold text-gradient-brand">{s.v}</div>
            <div className="mt-1 font-display font-semibold">{s.l}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ForLandlords() {
  const features = [
    { icon: Building2, title: "Properties & units", desc: "Organize bedsitters, apartments, single rooms — all in one dashboard." },
    { icon: Users, title: "Invite tenants in seconds", desc: "Share a link or code. They sign up, sign the lease, and you're live." },
    { icon: Wallet, title: "Instant M-Pesa payouts", desc: "Cash out the moment a cycle is ready, with one tap." },
    { icon: PieChart, title: "Real occupancy view", desc: "See vacancies, expected rent, and overdue cycles at a glance." },
  ];
  return (
    <section id="landlords" className="py-24 bg-secondary/40 relative">
      <div className="absolute inset-0 dot-pattern opacity-60 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="size-1.5 rounded-full bg-accent" /> For landlords
          </div>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Manage every door,<br /> not every spreadsheet.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Stop chasing payments on WhatsApp. Makao360 gives you a single source of truth
            for every unit, lease, and shilling.
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group rounded-3xl bg-card border border-border p-7 hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <div className={`grid place-items-center size-12 rounded-2xl ${i % 2 === 0 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-display font-bold text-xl">{f.title}</h3>
              </div>
              <p className="mt-4 text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForTenants() {
  return (
    <section id="tenants" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1 relative">
          <div className="absolute -inset-4 bg-gradient-gold opacity-30 blur-3xl rounded-3xl" />
          <div className="relative rounded-3xl bg-gradient-brand text-primary-foreground p-8 shadow-elevated">
            <div className="text-xs uppercase tracking-wider opacity-75">November cycle</div>
            <div className="mt-1 font-display text-3xl font-bold">73% there</div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Pill label="Target" value="25,000" />
              <Pill label="Paid" value="18,500" />
              <Pill label="Left" value="6,500" />
            </div>
            <div className="mt-6 h-3 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: "73%" }} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-4">
                <div className="text-xs opacity-75">Next reminder</div>
                <div className="font-semibold mt-1">3 days before due</div>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <div className="text-xs opacity-75">Last contribution</div>
                <div className="font-semibold mt-1">+ KES 5,000</div>
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="size-1.5 rounded-full bg-accent" /> For tenants
          </div>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Pay rent at <span className="text-accent">your</span> pace.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Earnings come in bits and pieces — your rent should too. Send 500 today,
            2,000 next week, and the rest on payday. Makao360 keeps the receipts,
            tracks the progress, and reminds you on time.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "Contribute any amount via M-Pesa STK push",
              "Watch your cycle fill up in real time",
              "Download a rent statement PDF for any cycle",
              "Build a verified rental history that follows you",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-accent mt-0.5 shrink-0" />
                <span className="text-foreground">{t}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-9 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/signup" search={{ invite: undefined, phone: undefined }}>
              Create my tenant account <ArrowRight className="size-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <div className="text-[11px] uppercase opacity-75">{label}</div>
      <div className="font-display font-bold text-lg">{value}</div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Landlord lists units", d: "Add your property, set rent and deposit per unit." },
    { n: "02", t: "Invite the tenant", d: "Share a link or 6-character code. They sign up in under a minute." },
    { n: "03", t: "Contribute flexibly", d: "Tenant pays any amount, anytime, via M-Pesa STK." },
    { n: "04", t: "Cycle completes, payout happens", d: "When 100% is met, the landlord gets paid out instantly." },
  ];
  return (
    <section id="how" className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 -translate-y-1/2 -right-40 size-[500px] rounded-full bg-accent/20 blur-[140px]" />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="size-1.5 rounded-full bg-accent" /> How it works
          </div>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            From <em className="not-italic text-accent">"can you send it?"</em><br />
            to "it's already in."
          </h2>
        </div>
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="text-7xl font-display font-bold text-accent/30">{s.n}</div>
              <h3 className="mt-2 font-display font-bold text-2xl">{s.t}</h3>
              <p className="mt-3 text-primary-foreground/75 leading-relaxed">{s.d}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden lg:block size-5 text-accent/60 absolute top-12 -right-3" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const items = [
    { icon: ShieldCheck, t: "Bank-grade security", d: "Encrypted data, role-based access, and audit trails on every action." },
    { icon: Bell, t: "Reminders that respect you", d: "You choose when and how often we nudge — no spam, ever." },
    { icon: TrendingUp, t: "Built for growth", d: "From 2 units to 200, the same dashboard scales with you." },
  ];
  return (
    <section id="trust" className="py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid md:grid-cols-3 gap-8">
        {items.map((it) => (
          <div key={it.t} className="rounded-3xl border border-border p-8 bg-card">
            <div className="grid place-items-center size-12 rounded-2xl bg-secondary text-primary">
              <it.icon className="size-6" />
            </div>
            <h3 className="mt-5 font-display font-bold text-xl">{it.t}</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-hero p-10 sm:p-16 text-white shadow-elevated">
          <div className="absolute inset-0 grid-pattern opacity-30" />
          <div className="absolute -bottom-20 -right-20 size-[360px] rounded-full bg-accent/40 blur-[100px]" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
              Ready to make rent <span className="text-accent">work</span> for everyone?
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Join landlords and tenants already running their rent on Makao360.
              Free to start. No credit card needed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-7 text-base shadow-glow">
                <Link to="/product">Explore product <ArrowRight className="size-4 ml-1.5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white bg-white/5 hover:bg-white/10 hover:text-white h-12 px-7 text-base">
                <Link to="/login" search={{ invite: undefined, redirect: undefined }}>I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Makao360" className="h-10 w-auto" />
        </div>
        <div className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Makao360. Flexible rent. Better records. Less stress.
        </div>
      </div>
    </footer>
  );
}
