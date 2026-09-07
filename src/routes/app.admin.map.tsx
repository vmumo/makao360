import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PropertyMap } from "@/components/PropertyMap";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/admin/map")({
  component: AdminMapPage,
});

function AdminMapPage() {
  const { hasRole, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!hasRole("admin")) return <Navigate to="/app" />;
  return (
    <div className="min-h-screen bg-background px-4 lg:px-8 py-6 max-w-7xl mx-auto">
      <PageHeader
        title="Platform map"
        description="Every property across every landlord on Makao360."
      />
      <PropertyMap scope="admin" />
    </div>
  );
}
