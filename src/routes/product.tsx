import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";
import { Wallet, ShieldCheck, FileBadge, Building2, Receipt, Zap, Plane } from "lucide-react";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "Product Architecture — Makao360" },
      { name: "description", content: "Eight products across three phases. The full housing financial services platform built into M-Pesa." },
      { property: "og:title", content: "Makao360 — Full Product Suite" },
      { property: "og:description", content: "Rent accumulation, Fuliza, Passport, escrow, mortgage, diaspora — eight integrated products." },
      { property: "og:image", content: "/og-product.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-product.jpg" },
      { name: "twitter:title", content: "Makao360 — Full Product Suite" },
      { name: "twitter:description", content: "Rent accumulation, Fuliza, Passport, escrow, mortgage, diaspora — eight integrated products." },
    ],
  }),
  component: ProductPage,
});

const phases = [
  {
    n: "Phase 1",
    title: "Core platform",
    status: "LIVE",
    items: [
      { i: Wallet, t: "Rent Accumulation", d: "Progressive M-Pesa contributions, immutable ledger, STK push." },
      { i: Building2, t: "Landlord Console", d: "Multi-unit dashboard, at-risk alerts, reconciliation." },
      { i: Receipt, t: "Admin Console", d: "Operations, dispute resolution, audit trail." },
    ],
  },
  {
    n: "Phase 1B",
    title: "Safaricom integrations",
    status: "INTEGRATING",
    items: [
      { i: Zap, t: "Rent Fuliza", d: "Day-25 micro-advance when tenant is short. Repaid next cycle." },
      { i: ShieldCheck, t: "Landlord Insurance", d: "Default cover via Safaricom Bima distribution." },
      { i: Plane, t: "Diaspora Rent", d: "M-Pesa Global corridor. Family abroad pays rent directly." },
    ],
  },
  {
    n: "Phase 2",
    title: "KCB co-creation",
    status: "COMING",
    items: [
      { i: ShieldCheck, t: "Deposit Escrow", d: "Pay deposit in installments. Held in licensed escrow." },
      { i: FileBadge, t: "Rental Passport", d: "Portable verified credential. Mortgage-ready at 12 cycles." },
      { i: Building2, t: "Rent-Backed Mortgage", d: "KCB underwriting against rent record. No payslip required." },
    ],
  },
];

function ProductPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-16">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-clay">Architecture</span>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-medium leading-[1.02] tracking-tight text-balance md:text-7xl">
          The full housing financial <span className="italic text-clay">services platform.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
          Eight products. Three phases. One ledger. Each phase commercially viable on its own — together they form a moat no competitor can replicate.
        </p>
      </section>

      <section className="border-t border-border">
        {phases.map((p, idx) => (
          <div key={p.n} className={`border-b border-border ${idx % 2 === 1 ? "bg-secondary/30" : ""}`}>
            <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-12 md:py-24">
              <div className="md:col-span-4">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-clay">{p.n}</span>
                <h2 className="mt-3 font-display text-4xl font-medium leading-tight">{p.title}</h2>
                <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${
                  p.status === "LIVE" ? "bg-mpesa/15 text-mpesa" : p.status === "INTEGRATING" ? "bg-gold/30 text-graphite" : "bg-secondary text-muted-foreground"
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {p.status}
                </span>
              </div>
              <div className="md:col-span-8 grid gap-4 md:grid-cols-3">
                {p.items.map((it) => (
                  <div key={it.t} className="rounded-2xl border border-border bg-card p-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                      <it.i className="h-4 w-4" />
                    </span>
                    <h3 className="mt-6 font-display text-xl font-medium leading-tight">{it.t}</h3>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">{it.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-foreground text-ivory">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-gold">Pan-African expansion</span>
              <h2 className="mt-4 font-display text-4xl font-medium text-ivory leading-tight md:text-5xl">
                Same model. Same infrastructure. Five markets.
              </h2>
            </div>
            <div className="md:col-span-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                ["Kenya", "Safaricom · M-Pesa", "Live"],
                ["Tanzania", "Vodacom · M-Pesa", "2027"],
                ["Uganda", "MTN · MoMo", "2027"],
                ["Ethiopia", "Telebirr", "2028"],
                ["DRC", "Airtel Money", "2028"],
                ["Rwanda", "MTN · MoMo", "2028"],
              ].map(([c, t, w]) => (
                <div key={c} className="rounded-2xl border border-ivory/15 p-5">
                  <div className="font-display text-xl font-medium text-ivory">{c}</div>
                  <div className="mt-1 text-xs text-ivory/60">{t}</div>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-gold">{w}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
