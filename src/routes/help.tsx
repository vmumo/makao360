import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";
import { ChevronDown, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Makao360" },
      { name: "description", content: "Answers to common Makao360 questions for tenants and landlords." },
      { property: "og:title", content: "Help Center — Makao360" },
      { property: "og:description", content: "Answers to common Makao360 questions for tenants and landlords." },
    ],
    links: [{ rel: "canonical", href: "https://makao-360-hub.lovable.app/help" }],
  }),
  component: HelpPage,
});

const groups = [
  {
    title: "For tenants",
    items: [
      ["How do I pay rent flexibly?", "You contribute any amount, any time, via M-Pesa STK push. Your cycle progress bar shows how much is left before the due date."],
      ["What is Fuliza Rent?", "A short-term advance available around day 25 when your cycle is close to complete. It carries a transparent fee shown before you accept and is repaid next cycle."],
      ["Who can see my payment history?", "Only you and your landlord. Admins may access aggregated records for reconciliation and disputes."],
      ["How do I raise a maintenance request?", "Open your tenant dashboard → Maintenance → New request. Your landlord is notified immediately."],
    ],
  },
  {
    title: "For landlords",
    items: [
      ["How do I invite a tenant?", "Go to Tenants → Invite tenant. The button activates when you have at least one vacant unit."],
      ["Can I import properties in bulk?", "Yes — Properties → Bulk import. Download the Excel template, fill it, and upload."],
      ["How does reconciliation work?", "Every M-Pesa or bank credit is matched against expected rent. Drift is flagged in the reconciliation queue for manual review."],
      ["Can I add caretakers or property managers?", "Yes — Settings → Team. Scope their access to specific properties."],
    ],
  },
  {
    title: "Security & privacy",
    items: [
      ["Is my data safe?", "Yes — row-level access control, encryption, and audit logging. See the security page for details."],
      ["Can I delete my account?", "Contact privacy@makao360.app. Financial records are retained per Kenyan tax and AML law."],
    ],
  },
];

function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Support</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Help Center</h1>
            <p className="mt-3 max-w-2xl text-foreground/80">
              Quick answers for tenants and landlords. Can't find what you're looking for? Reach us
              at <a href="mailto:support@makao360.app" className="underline">support@makao360.app</a>.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-6 py-12">
          {groups.map((g) => (
            <div key={g.title} className="mt-10">
              <h2 className="font-display text-xl font-semibold">{g.title}</h2>
              <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {g.items.map(([q, a]) => (
                  <Faq key={q} q={q} a={a} />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-12 rounded-2xl border border-border bg-primary/5 p-6 flex items-start gap-4">
            <LifeBuoy className="h-8 w-8 text-clay" />
            <div>
              <h3 className="font-display text-lg font-semibold">Still stuck?</h3>
              <p className="mt-1 text-sm text-foreground/80">
                Email <a href="mailto:support@makao360.app" className="underline">support@makao360.app</a>{" "}
                or open a maintenance request from your tenant dashboard. See our{" "}
                <Link to="/security" className="underline">security</Link> and{" "}
                <Link to="/legal/privacy" className="underline">privacy</Link> pages for more.
              </p>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className="w-full text-left px-5 py-4"
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && <p className="mt-2 text-sm text-foreground/70">{a}</p>}
    </button>
  );
}
