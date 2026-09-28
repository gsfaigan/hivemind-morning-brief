import type { Metadata } from "next";
import { Night } from "@/components/Night";
import { data } from "@/data";

export const metadata: Metadata = { title: "Night Log" };

export default function Page() {
  return <Night data={data} />;
}
