import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Makao360" },
      { name: "description", content: "The terms that govern your use of Makao360." },
      { property: "og:title", content: "Terms of Service — Makao360" },
      { property: "og:description", content: "The terms that govern your use of Makao360." },
    ],
    links: [{ rel: "canonical", href: "https://makao-360-hub.lovable.app/legal/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 July 2026</p>

        <Section title="1. Acceptance of terms">
          By creating an account or using Makao360 ("the Service") you agree to these terms and to
          the Privacy Policy. If you do not agree, do not use the Service.
        </Section>
        <Section title="2. Eligibility">
          You must be 18 or older and legally capable of entering a binding contract. Landlord
          accounts must be authorised to manage the properties they list.
        </Section>
        <Section title="3. The service">
          Makao360 helps tenants pay rent flexibly and helps landlords track cycles, reconcile
          payments, and issue verified rental records. Availability of specific features (Fuliza
          Rent, escrow, Passport) depends on partner integrations that may change.
        </Section>
        <Section title="4. Payments">
          Payments flow through licensed providers (M-Pesa, participating banks). We do not hold
          client funds in our own account. Rent is transferred to the landlord subject to the
          reconciliation rules displayed in-app.
        </Section>
        <Section title="5. Fees">
          Standard use of the tenant app is free. Landlords pay per unit/month per the plan shown
          in <Link to="/landlords" className="underline">For Landlords</Link>. Fuliza Rent carries
          a transparent fee shown before you accept.
        </Section>
        <Section title="6. Acceptable use">
          Do not misuse the Service — no fraud, no reverse-engineering, no attempts to bypass
          security or reconciliation controls, no harassment of other users.
        </Section>
        <Section title="7. Termination">
          You may close your account at any time. We may suspend accounts that violate these terms
          or that are required to be suspended by law or by a partner (e.g. Safaricom).
        </Section>
        <Section title="8. Liability">
          The Service is provided "as is". To the maximum extent permitted by law, Makao360's total
          liability is limited to the fees you paid us in the 12 months preceding the event giving
          rise to the claim.
        </Section>
        <Section title="9. Governing law">
          These terms are governed by the laws of the Republic of Kenya. Disputes will be resolved
          in the courts of Nairobi unless another forum is required by law.
        </Section>
        <Section title="10. Contact">
          Questions? Reach us at <a href="mailto:legal@makao360.app" className="underline">legal@makao360.app</a>.
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}
