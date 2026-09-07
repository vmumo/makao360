import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Makao360" },
      { name: "description", content: "The cookies Makao360 uses and how to control them." },
      { property: "og:title", content: "Cookie Policy — Makao360" },
      { property: "og:description", content: "The cookies Makao360 uses and how to control them." },
    ],
    links: [{ rel: "canonical", href: "https://makao-360-hub.lovable.app/legal/cookies" }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Cookie Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 July 2026</p>

        <p className="mt-6 text-sm leading-relaxed text-foreground/80">
          We keep cookies to a minimum. This page lists what we use and how you can control it.
        </p>

        <Row
          category="Essential"
          purpose="Session, login, CSRF, and security. Cannot be disabled — the app will not work without them."
          examples="sb-*, mk_session_id"
        />
        <Row
          category="Analytics (opt-in)"
          purpose="Aggregated usage patterns to improve the product. No third-party trackers."
          examples="mk_cookie_consent_v1"
        />
        <Row
          category="Marketing"
          purpose="Currently unused. Reserved for future campaign measurement — off by default."
          examples="—"
        />

        <p className="mt-8 text-sm leading-relaxed text-foreground/80">
          You can change your choice any time by clearing the <code>mk_cookie_consent_v1</code>{" "}
          entry in your browser's site data — the consent banner will reappear on your next visit.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Row({ category, purpose, examples }: { category: string; purpose: string; examples: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-border p-5">
      <div className="font-display font-semibold">{category}</div>
      <p className="mt-1 text-sm text-foreground/80">{purpose}</p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{examples}</p>
    </div>
  );
}
