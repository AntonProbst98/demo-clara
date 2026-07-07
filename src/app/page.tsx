import { redirect } from "next/navigation";

// The workspace is the primary surface; the root path lands there.
export default function Home() {
  redirect("/workspace");
}
