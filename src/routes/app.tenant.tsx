import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { Home, Receipt, FileText, Bell, Zap, Wrench, FileSignature, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/tenant")({
  component: TenantLayout,
});

const nav = [
  { to: "/app/tenant", label: "Home", icon: Home },
  { to: "/app/getting-started", label: "Get started", icon: Sparkles },
  { to: "/app/tenant/payments", label: "Payments", icon: Receipt },
  { to: "/app/tenant/fuliza", label: "Fuliza", icon: Zap },
  { to: "/app/tenant/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/app/tenant/leases", label: "Leases", icon: FileText },
  { to: "/app/tenant/leasing", label: "My tenancy", icon: FileSignature },
  { to: "/app/tenant/messages", label: "Messages", icon: MessageSquare },
  { to: "/app/tenant/kyc", label: "Verify ID", icon: ShieldCheck },
  { to: "/app/tenant/notifications", label: "Alerts", icon: Bell, notifications: true },
];

function TenantLayout() {
  const { roles } = useAuth();
  if (roles.length && !roles.includes("tenant") && !roles.includes("admin")) {
    if (roles.includes("landlord")) return <Navigate to="/app/landlord" />;
  }
  return (
    <AppLayout nav={nav}>
      <Outlet />
    </AppLayout>
  );
}
