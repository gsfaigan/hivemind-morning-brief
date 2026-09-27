import type { Metadata } from "next";
import { Trust } from "@/components/Trust";
import { data } from "@/data";
import { derive } from "@/lib/derive";

export const metadata: Metadata = { title: "Trust" };

export default function Page() {
  return <Trust brief={derive(data.run, data.log, data.audit)} />;
}
