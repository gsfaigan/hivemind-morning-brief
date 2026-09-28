import type { Metadata } from "next";
import { Trust } from "@/components/Trust";
import { data } from "@/data";

export const metadata: Metadata = { title: "Trust" };

export default function Page() {
  return <Trust data={data} />;
}
