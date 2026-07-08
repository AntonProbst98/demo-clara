import { loadCleanedData } from "@/lib/data";
import { exposureByPolicy, dpdDistribution } from "@/lib/metrics";
import { Dashboard } from "@/components/dashboard/Dashboard";

// Aggregates are recomputed from the data file on every request.
export const dynamic = "force-dynamic";

// Server component. Portfolio aggregates are computed from the accounts array
// here (server-side); the day's promise metrics are computed client-side from
// in-memory state inside <Dashboard>.
export default async function DashboardPage() {
  const { accounts, metadata } = await loadCleanedData();

  return (
    <Dashboard
      metadata={metadata}
      policyExposure={exposureByPolicy(accounts)}
      dpdBuckets={dpdDistribution(accounts)}
      accountCount={accounts.length}
    />
  );
}
