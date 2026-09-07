import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Makao360" },
      { name: "description", content: "How Makao360 collects, uses and protects your data." },
      { property: "og:title", content: "Privacy Policy — Makao360" },
      { property: "og:description", content: "How Makao360 collects, uses and protects your data." },
    ],
    links: [{ rel: "canonical", href: "https://makao-360-hub.lovable.app/legal/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 July 2026</p>

        <S title="Who we are">
          Makao360 is operated from Nairobi, Kenya. We are the data controller for personal data
          you provide when using the Service.
        </S>
        <S title="Data we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Account: name, phone, email, role (tenant/landlord/admin).</li>
            <li>KYC: government ID number, ID document image, selfie (only if you submit).</li>
            <li>Property/lease data supplied by landlords.</li>
            <li>Payment metadata (amounts, timestamps, reference numbers) — not full card details.</li>
            <li>Anonymous product analytics if you opt in via the cookie banner.</li>
          </ul>
        </S>
        <S title="How we use it">
          Operate the Service, verify identities, reconcile rent, comply with financial regulations,
          prevent fraud, and improve the product. We do not sell your data.
        </S>
        <S title="Sharing">
          With payment partners (Safaricom, participating banks) strictly to process your
          transactions. With your landlord (for tenants) or your tenants (for landlords) only for
          data required to manage the tenancy. With regulators when legally required.
        </S>
        <S title="Retention">
          Account and financial records are retained for at least 7 years as required by Kenyan
          tax and AML law. KYC documents are retained for the duration of your account plus 5
          years.
        </S>
        <S title="Your rights">
          You may request access, correction, deletion (subject to retention obligations),
          objection, or export of your data. Email{" "}
          <a href="mailto:privacy@makao360.app" className="underline">privacy@makao360.app</a>.
        </S>
        <S title="Security">
          Row-level access control, encryption in transit (TLS) and at rest, and least-privilege
          administrative access. See our{" "}
          <Link to="/security" className="underline">security page</Link>.
        </S>
        <S title="Cookies">
          See our <Link to="/legal/cookies" className="underline">cookie policy</Link>.
        </S>
      </main>
      <MarketingFooter />
    </div>
  );
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}
