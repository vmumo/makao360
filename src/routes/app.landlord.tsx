import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Building2, Users, Wallet, Bell, Landmark, History, Settings, Wrench, Map, Sparkles, Receipt, BookOpen, FileText, Banknote, FileSignature, MessageSquare, UserCog } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/landlord")({
  component: LandlordLayout,
});

const nav = [
  { to: "/app/landlord", label: "Overview", icon: LayoutDashboard },
  { to: "/app/getting-started", label: "Get started", icon: Sparkles },
  { to: "/app/landlord/properties", label: "Properties", icon: Building2 },
  { to: "/app/landlord/map", label: "Map", icon: Map },
  { to: "/app/landlord/tenants", label: "Tenants", icon: Users },
  { to: "/app/landlord/leasing", label: "Leasing", icon: FileSignature },
  { to: "/app/landlord/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/app/landlord/expenses", label: "Expenses", icon: Receipt },
  { to: "/app/landlord/accounting", label: "Accounting", icon: BookOpen },
  { to: "/app/landlord/statements", label: "Statements", icon: FileText },
  { to: "/app/landlord/banking", label: "Banking", icon: Banknote },
  { to: "/app/landlord/reconciliation", label: "Reconcile", icon: Landmark },
  { to: "/app/landlord/audit", label: "Audit", icon: History },
  { to: "/app/landlord/payouts", label: "Payouts", icon: Wallet },
  { to: "/app/landlord/messages", label: "Messages", icon: MessageSquare },
  { to: "/app/landlord/profile", label: "My profile", icon: UserCog },
  { to: "/app/landlord/settings", label: "Settings", icon: Settings },
  { to: "/app/landlord/notifications", label: "Notifications", icon: Bell, notifications: true },
];


function LandlordLayout() {
  const { roles, hasRole } = useAuth();
  if (!hasRole("landlord") && !hasRole("admin")) {
    if (roles.includes("tenant")) return <Navigate to="/app/tenant" />;
    return <Navigate to="/app" />;
  }
  return (
    <AppLayout nav={nav}>
      <Outlet />
    </AppLayout>
  );
}
