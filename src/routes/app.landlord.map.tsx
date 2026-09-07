import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PropertyMap } from "@/components/PropertyMap";

export const Route = createFileRoute("/app/landlord/map")({
  component: LandlordMapPage,
});

function LandlordMapPage() {
  return (
    <div>
      <PageHeader
        title="Portfolio map"
        description="See every property across the country. Filter by occupancy, arrears, or portfolio."
      />
      <PropertyMap scope="landlord" />
    </div>
  );
}
