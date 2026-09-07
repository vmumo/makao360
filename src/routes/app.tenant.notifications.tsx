import { createFileRoute } from "@tanstack/react-router";
import { NotificationsList } from "@/components/NotificationsList";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/tenant/notifications")({
  component: () => (
    <div>
      <PageHeader title="Notifications" description="Reminders, payment receipts, and updates." />
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="settings">Reminder settings</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <NotificationsList audience="tenant" />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <NotificationPreferences audience="tenant" />
        </TabsContent>
      </Tabs>
    </div>
  ),
});
