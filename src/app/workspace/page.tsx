import type { Metadata } from "next";
import { loadCleanedData } from "@/lib/data";
import { Workspace } from "@/components/workspace/Workspace";

// Read the data file on every request so a replaced JSON is picked up without
// a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Workspace" };

// Server component: reads the cleaned data on the server and hands it to the
// client workspace. No policy logic runs here — the fields are consumed as-is.
export default async function WorkspacePage() {
  const { accounts, metadata } = await loadCleanedData();
  return <Workspace accounts={accounts} metadata={metadata} />;
}
