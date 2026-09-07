import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Inbox } from "@/components/Inbox";

export const Route = createFileRoute("/app/tenant/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Makao360 tenant" },
      { name: "description", content: "Message your landlord or caretaker and share documents, organised by unit." },
      { property: "og:title", content: "Tenant messages — Makao360" },
      { property: "og:description", content: "One thread per unit for tenants, landlords and caretakers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div>
      <PageHeader
        title="Messages"
        description="Talk to your landlord or caretaker and share documents — one thread per unit."
      />
      <Inbox audience="tenant" />
    </div>
  ),
});
