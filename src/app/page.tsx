import { Brief } from "@/components/Brief";
import { data } from "@/data";
import { derive } from "@/lib/derive";

export default function Page() {
  const brief = derive(data.run, data.log, data.audit);
  return <Brief brief={brief} />;
}
