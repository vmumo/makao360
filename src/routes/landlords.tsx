import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";
import { ArrowUpRight, Check } from "lucide-react";
import heroLandlord from "@/assets/hero-landlord.jpg";

export const Route = createFileRoute("/landlords")({
  head: () => ({
    meta: [
      { title: "For Landlords — Makao360" },
      { name: "description", content: "Real-time rent visibility, at-risk alerts, default insurance, and verified tenant records." },
      { property: "og:title", content: "Makao360 — For Landlords" },
      { property: "og:description", content: "Stop chasing rent. Start operating your portfolio." },
      { property: "og:image", content: "/og-landlords.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-landlords.jpg" },
      { name: "twitter:title", content: "Makao360 — For Landlords" },
      { name: "twitter:description", content: "Stop chasing rent. Start operating your portfolio." },
    ],
  }),
  component: LandlordsPage,
});

function LandlordsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto grid max-w-7xl gap-12 px-6 pt-20 pb-24 md:grid-cols-12">
        <div className="md:col-span-7">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-clay">For landlords</span>
          <h1 className="mt-4 font-display text-5xl font-medium leading-[1.02] tracking-tight text-balance md:text-7xl">
            Stop chasing rent. <span className="italic text-clay">Start operating.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
            8–20 units, managed via WhatsApp, phone calls and physical visits. Three to five days lost every month. Makao360 gives you the operations console urban Kenyan landlords have never had.
          </p>
          <Link
            to="/signup"
            search={{ invite: undefined, phone: undefined }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-glow hover:bg-graphite"
          >
            Open the console <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="md:col-span-5">
          <img src={heroLandlord} alt="A landlord in Nairobi reviewing the Makao360 console" className="rounded-3xl shadow-elev w-full h-[480px] object-cover" loading="lazy" width={1080} height={1920} />
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="max-w-2xl font-display text-3xl font-medium leading-tight md:text-5xl text-balance">
            What changes the day you onboard.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { t: "Day 1 visibility", d: "Every unit, every contribution, in real-time. No more month-end surprises." },
              { t: "Day 22 alerts", d: "Behavioral signals fire 3 days before the Fuliza window. Act early." },
              { t: "Day 30 reconciliation", d: "Auto-generated ledger. Export for tax, audit, or financing. Done in 2 minutes." },
              { t: "Cycle 12 passport", d: "Each tenant becomes a mortgage prospect. KCB referrals earn you a finder's fee." },
              { t: "Default insurance", d: "Optional Safaricom Bima cover. We pay you if a tenant defaults." },
              { t: "Tenant pipeline", d: "Verified Passport-holders apply with proven records. Choose better tenants." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-border bg-card p-6">
                <Check className="h-5 w-5 text-mpesa" />
                <h3 className="mt-4 font-display text-xl font-medium">{b.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="rounded-3xl border border-border bg-card p-10 md:p-14">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-clay">Pricing</span>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">Built for the way you actually work.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { name: "Starter", units: "1–10 units", price: "Free", note: "Console + ledger. 1.5% on contributions." },
              { name: "Operator", units: "11–50 units", price: "KES 1,500/mo", note: "+ at-risk alerts · default insurance · Passport queue.", highlight: true },
              { name: "Portfolio", units: "50+ units", price: "Talk to us", note: "API access · KCB referral revenue share · dedicated support." },
            ].map((p) => (
              <div key={p.name} className={`rounded-2xl p-6 ${p.highlight ? "bg-foreground text-ivory" : "border border-border bg-background"}`}>
                <div className={`font-mono text-[10px] uppercase tracking-[0.18em] ${p.highlight ? "text-gold" : "text-clay"}`}>{p.name}</div>
                <div className={`mt-2 text-sm ${p.highlight ? "text-ivory/60" : "text-muted-foreground"}`}>{p.units}</div>
                <div className={`mt-8 font-display text-3xl font-medium ${p.highlight ? "text-ivory" : "text-foreground"}`}>{p.price}</div>
                <p className={`mt-2 text-sm ${p.highlight ? "text-ivory/70" : "text-muted-foreground"}`}>{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
