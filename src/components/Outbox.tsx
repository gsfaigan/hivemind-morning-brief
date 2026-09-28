"use client";

import { useState } from "react";
import type { Brief } from "@/lib/derive";
import { ago, money } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useDemoTime, useStore } from "@/lib/store";
import { Btn, Sheet } from "./ui";

// Every tap in the brief becomes a line in a reply to the agent(s) it
// concerns. The agents have no API, so the reply is the steering channel: the
// user reviews it, sends it in one go, and each agent picks it up on its next
// turn. Muse lives on muse.ai, Instinct in iMessage.
const OPEN: Record<string, string> = { muse: "https://muse.ai" };

export function Outbox({ brief }: { brief: Brief }) {
  const { s, dispatch, now } = useStore();
  const toDemo = useDemoTime();
  const live = useLive(brief);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const n = s.outbox.length;
  const agents = brief.run.agents;
  const replies = agents
    .map((a) => {
      const items = s.outbox.filter((o) => !o.to || o.to.includes(a.id));
      const others = agents.filter((x) => x.id !== a.id).map((x) => x.name);
      return {
        ...a,
        count: items.length,
        text: [
          "Morning! Here's what I decided:",
          ...items.map((o, i) => `${i + 1}. ${o.text}`),
          "",
          `That should put the trip at about ${money(live.projected)} of ${money(live.budget)}.${others.length ? ` ${others.join(" and ")} got the same list, so don't double-book anything they hold.` : ""} Confirm each one back to me with the final price, and flag anything that changed since last night.`,
        ].join("\n"),
      };
    })
    .filter((r) => r.count > 0);

  const send = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {}
    dispatch({ t: "sent" });
    if (OPEN[id]) window.open(OPEN[id], "_blank", "noopener");
  };

  if (!n && !s.sentAt) return null;

  const sentAtDemo = s.sentAt ? toDemo(s.sentAt) : null;

  return (
    <>
      {/* Floats above the page, dark in both themes, like a system tray. */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4 sm:bottom-6">
        <div className="night rise mx-auto flex max-w-[560px] items-center justify-between gap-4 py-3 pl-5 pr-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
          <div className="min-w-0 leading-tight">
            {s.sentAt ? (
              <>
                <div className="text-[15px] font-semibold">Sent to {replies.map((r) => r.name).join(" and ")}</div>
                <div className="mt-0.5 text-[13px] text-muted">{ago(new Date(sentAtDemo!).toISOString(), now)}. Waiting to confirm.</div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-semibold">
                  <span className="num">{n}</span> change{n === 1 ? "" : "s"} for {replies.map((r) => r.name).join(" and ")}
                </div>
                <div className="mt-0.5 text-[13px] text-muted">Nothing is sent yet</div>
              </>
            )}
          </div>
          <Btn kind="primary" onClick={() => setOpen(true)}>
            {s.sentAt ? "View" : "Review"}
          </Btn>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={replies.length > 1 ? "Your replies" : `Your reply to ${replies[0]?.name ?? "Muse"}`}>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Everything you changed, as {replies.length > 1 ? "one message per agent" : "one message"}.
        </p>
        {replies.map((r) => (
          <div key={r.id} className="mt-8">
            <h4 className="text-[17px] font-semibold tracking-[-0.01em]">To {r.name}</h4>
            <pre className="mt-3 whitespace-pre-wrap bg-paper p-5 font-sans text-[15px] leading-relaxed">{r.text}</pre>
            <Btn kind="primary" className="mt-4" onClick={() => send(r.id, r.text)}>
              {copied === r.id ? `Copied. Paste in ${r.name}` : OPEN[r.id] ? `Copy & open ${r.name}` : `Copy for ${r.name}`}
            </Btn>
          </div>
        ))}
        <div className="mt-8">
          <Btn kind="ghost" onClick={() => dispatch({ t: "reset" })}>
            Start over
          </Btn>
        </div>
      </Sheet>
    </>
  );
}
