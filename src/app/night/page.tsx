import type { Metadata } from "next";
import { Night } from "@/components/Night";
import { data } from "@/data";
import { derive } from "@/lib/derive";

export const metadata: Metadata = { title: "Night Log" };

export default function Page() {
  return <Night brief={derive(data.run, data.log, data.audit)} />;
}
