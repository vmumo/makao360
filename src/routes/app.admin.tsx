import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShieldCheck,
  Map,
  TrendingUp,
  Settings,
  Building2,
  Users,
  Sparkles,
  History,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/app/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/app/admin/market", label: "Market intelligence", icon: TrendingUp },
  { to: "/app/admin/map", label: "Map", icon: Map },
  { to: "/app/admin/kyc", label: "KYC review", icon: ShieldCheck },
  { to: "/app/admin/audit", label: "Access audit", icon: History },
  { to: "/app/admin/settings", label: "User settings", icon: Settings },
  { to: "/app/landlord/properties", label: "Properties", icon: Building2 },
  { to: "/app/landlord/tenants", label: "Tenants", icon: Users },
  { to: "/app/getting-started", label: "Get started", icon: Sparkles },
];

function AdminLayout() {
  const { hasRole, roles } = useAuth();
  if (!hasRole("admin")) {
    if (roles.includes("landlord")) return <Navigate to="/app/landlord" />;
    return <Navigate to="/app" />;
  }
  return (
    <AppLayout nav={nav}>
      <Outlet />
    </AppLayout>
  );
}
