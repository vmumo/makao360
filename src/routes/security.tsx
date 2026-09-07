import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";
import { ShieldCheck, Lock, KeyRound, Database, Eye, FileWarning } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security at Makao360" },
      { name: "description", content: "How Makao360 protects tenant, landlord and payment data." },
      { property: "og:title", content: "Security at Makao360" },
      { property: "og:description", content: "How Makao360 protects tenant, landlord and payment data." },
      { property: "og:image", content: "/og-product.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://makao-360-hub.lovable.app/security" }],
  }),
  component: SecurityPage,
});

const controls = [
  { i: Lock, t: "Encryption in transit & at rest", d: "TLS 1.2+ everywhere. Data at rest encrypted on managed Postgres." },
  { i: KeyRound, t: "Row-level access control", d: "Every table enforces RLS. A landlord can never read another landlord's rows." },
  { i: ShieldCheck, t: "Least-privilege admin access", d: "Admin operations require a distinct role and are audit-logged." },
  { i: Database, t: "Immutable ledger", d: "Rent contributions are append-only, cryptographically ordered, and reconciled daily." },
  { i: Eye, t: "Auditability", d: "Every reconciliation, refund, or role change appears in the audit trail with actor + timestamp." },
  { i: FileWarning, t: "Responsible disclosure", d: "Report vulnerabilities to security@makao360.app — we respond within 48 hours." },
];

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
            <p className="text-xs uppercase tracking-[0.16em] text-primary-foreground/70">Trust</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Security at Makao360
            </h1>
            <p className="mt-4 max-w-2xl text-primary-foreground/80">
              Makao360 handles rent money and identity data. We treat it accordingly. This page
              lists the controls that are live today. It is app-owned editable content, not an
              independent certification.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-4 md:grid-cols-2">
            {controls.map((c) => (
              <div key={c.t} className="rounded-2xl border border-border p-6">
                <c.i className="h-6 w-6 text-clay" />
                <h2 className="mt-3 font-display text-lg font-semibold">{c.t}</h2>
                <p className="mt-2 text-sm text-foreground/80">{c.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-secondary/50 p-6">
            <h2 className="font-display text-xl font-semibold">Report a vulnerability</h2>
            <p className="mt-2 text-sm text-foreground/80">
              Email <a href="mailto:security@makao360.app" className="underline">security@makao360.app</a>{" "}
              with reproduction steps and impact. Do not test on live tenant data. We acknowledge
              within 48 hours and coordinate a fix.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link to="/legal/privacy" className="underline">Privacy Policy</Link>
            <Link to="/legal/terms" className="underline">Terms of Service</Link>
            <Link to="/help" className="underline">Help Center</Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
