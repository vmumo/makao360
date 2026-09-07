import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Inbox } from "@/components/Inbox";

export const Route = createFileRoute("/app/landlord/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Makao360 landlord" },
      { name: "description", content: "Unified inbox for tenant, caretaker and manager conversations per unit." },
      { property: "og:title", content: "Landlord messages — Makao360" },
      { property: "og:description", content: "Message tenants and caretakers and share documents per unit and lease." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div>
      <PageHeader
        title="Messages"
        description="One thread per unit or lease. Loop in tenants and caretakers and share documents."
      />
      <Inbox audience="landlord" />
    </div>
  ),
});
